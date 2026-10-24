import {
  AddonConfig,
  ProxyTokenPayload,
  RawSubtitleResult,
  StremioSubtitle,
  SubtitleQuery
} from '../types';
import { searchCache } from '../cache';
import { encodeDualToken, encodeProxyToken, encodeTranslateToken } from '../config';
import { searchWyzie } from './wyzie';
import { searchOpenSubtitles } from './opensubtitles';
import { searchSubdl } from './subdl';
import { summarizeRelease } from './releaseScorer';

const LANG_SHORT_LABELS: Record<string, string> = {
  pob: 'PT-BR',
  por: 'PT-PT',
  eng: 'EN',
  spa: 'ES',
  fre: 'FR',
  ger: 'DE',
  ita: 'IT',
  jpn: 'JA',
  kor: 'KO',
  chi: 'ZH',
  rus: 'RU',
  ara: 'AR',
  hin: 'HI',
  tur: 'TR',
  pol: 'PL',
  dut: 'NL',
  swe: 'SV',
  nor: 'NO',
  dan: 'DA',
  fin: 'FI'
};

function formatLangShort(code: string): string {
  return LANG_SHORT_LABELS[code.toLowerCase()] || code.toUpperCase();
}

function formatProviderTag(sub: RawSubtitleResult): string {
  if (sub.id.startsWith('osv3-')) return 'OSv3';
  if (sub.provider === 'subdl') return 'SubDL';
  if (sub.provider === 'opensubtitles') return 'OpenSub';
  if (sub.provider === 'wyzie') return 'Wyzie';
  return 'AI';
}

export function formatSubtitleLabel(sub: RawSubtitleResult, rank: number): string {
  const langTag = formatLangShort(sub.originalLang || sub.lang);
  const providerTag = formatProviderTag(sub);
  const relSummary = summarizeRelease(sub.releaseName);
  const flags: string[] = [];
  if (sub.hashMatch) flags.push('★Hash');
  if (sub.hearingImpaired) flags.push('HI');

  const parts = [`${langTag} #${rank}`, providerTag];
  if (relSummary) parts.push(relSummary);
  if (flags.length > 0) parts.push(flags.join(' '));
  return parts.join(' • ');
}

export function parseStremioSubtitleRequest(
  type: string,
  id: string,
  extraRaw?: string,
  languages: string[] = ['eng']
): SubtitleQuery {
  const decodedId = decodeURIComponent(id);
  const parts = decodedId.split(':');
  const imdbId = parts[0];
  let season: number | undefined;
  let episode: number | undefined;

  if (parts.length >= 3) {
    const s = parseInt(parts[1], 10);
    const e = parseInt(parts[2], 10);
    if (!Number.isNaN(s)) season = s;
    if (!Number.isNaN(e)) episode = e;
  }

  let videoHash: string | undefined;
  let videoSize: number | undefined;
  let filename: string | undefined;

  if (extraRaw) {
    const cleanExtra = extraRaw.replace(/\.json$/i, '');
    const params = new URLSearchParams(cleanExtra);
    videoHash = params.get('videoHash') || undefined;
    const sizeStr = params.get('videoSize');
    if (sizeStr && !Number.isNaN(Number(sizeStr))) {
      videoSize = Number(sizeStr);
    }
    filename = params.get('filename') || undefined;
  }

  return {
    type,
    imdbId,
    season,
    episode,
    videoHash,
    videoSize,
    filename,
    languages
  };
}

export async function fetchRawSubtitles(
  query: SubtitleQuery,
  config: AddonConfig
): Promise<RawSubtitleResult[]> {
  const osKey = config.openSubtitlesApiKey || process.env.OPENSUBTITLES_API_KEY;
  const subdlKey = config.subdlApiKey || process.env.SUBDL_API_KEY;
  const hasOsKey = Boolean(osKey);
  const hasSubdlKey = Boolean(subdlKey);
  const cacheKey = [
    'raw',
    query.type,
    query.imdbId,
    query.season ?? '',
    query.episode ?? '',
    query.videoHash ?? '',
    config.providers.slice().sort().join(','),
    query.languages.slice().sort().join(','),
    hasOsKey ? 'os1' : 'os0',
    hasSubdlKey ? 'sd1' : 'sd0'
  ].join(':');

  const cached = searchCache.get(cacheKey) as RawSubtitleResult[] | undefined;
  if (cached) {
    return cached;
  }

  const tasks: Promise<RawSubtitleResult[]>[] = [];

  if (config.providers.includes('wyzie')) {
    tasks.push(searchWyzie(query));
  }
  if (config.providers.includes('opensubtitles') && osKey) {
    tasks.push(searchOpenSubtitles(query, osKey));
  }
  if (config.providers.includes('subdl') && subdlKey) {
    tasks.push(searchSubdl(query, subdlKey));
  }

  const settled = await Promise.allSettled(tasks);
  const combined: RawSubtitleResult[] = [];
  const seenUrls = new Set<string>();

  for (const item of settled) {
    if (item.status === 'fulfilled' && Array.isArray(item.value)) {
      for (const sub of item.value) {
        if (!seenUrls.has(sub.downloadUrl)) {
          seenUrls.add(sub.downloadUrl);
          combined.push(sub);
        }
      }
    }
  }

  combined.sort((a, b) => b.score - a.score);

  if (combined.length > 0) {
    searchCache.set(cacheKey, combined);
  }

  return combined;
}

function toProxyPayload(
  sub: RawSubtitleResult,
  query: SubtitleQuery,
  config: AddonConfig,
  fallbackSub?: RawSubtitleResult
): ProxyTokenPayload {
  const hasDistinctFallback = Boolean(fallbackSub && fallbackSub.downloadUrl !== sub.downloadUrl);
  return {
    u: sub.downloadUrl,
    f: sub.format,
    e: sub.encoding,
    osKey: sub.provider === 'opensubtitles' ? config.openSubtitlesApiKey : undefined,
    fb: hasDistinctFallback ? fallbackSub!.downloadUrl : undefined,
    fbf: hasDistinctFallback ? fallbackSub!.format : undefined,
    se: query.season,
    ep: query.episode
  };
}

function pickFallbackSub(
  primary: RawSubtitleResult,
  directCandidates: RawSubtitleResult[],
  offset = 0
): RawSubtitleResult | undefined {
  const distinct = directCandidates.filter((c) => c.downloadUrl !== primary.downloadUrl);
  if (distinct.length === 0) return undefined;
  const crossProvider = distinct.filter((c) => c.provider !== primary.provider);
  const pool = crossProvider.length > 0 ? crossProvider : distinct;
  return pool[offset % pool.length];
}

function selectBestCompanion(
  primary: RawSubtitleResult,
  candidates: RawSubtitleResult[]
): RawSubtitleResult {
  if (primary.hashMatch) {
    const hashMatched = candidates.find((c) => c.hashMatch);
    if (hashMatched) return hashMatched;
  }
  if (primary.releaseName) {
    const normPrimary = primary.releaseName.trim().toLowerCase();
    const releaseMatched = candidates.find(
      (c) => c.releaseName && c.releaseName.trim().toLowerCase() === normPrimary
    );
    if (releaseMatched) return releaseMatched;
  }
  return candidates[0];
}

export async function getStremioSubtitles(
  query: SubtitleQuery,
  config: AddonConfig,
  baseUrl: string,
  options?: { descriptiveLang?: boolean }
): Promise<StremioSubtitle[]> {
  const descriptiveLang = Boolean(options?.descriptiveLang);
  const nativeLang = config.dualSubtitlesNativeLang || 'eng';
  const effectiveQuery: SubtitleQuery =
    config.dualSubtitles && !query.languages.includes(nativeLang)
      ? {
          ...query,
          languages: Array.from(new Set([...query.languages, nativeLang]))
        }
      : query;

  const rawResults = await fetchRawSubtitles(effectiveQuery, config);

  const filtered = config.includeHearingImpaired
    ? rawResults
    : rawResults.filter((r) => !r.hearingImpaired);

  const requestedLangs = new Set(config.languages);
  const groupingLangs = new Set(
    config.dualSubtitles ? [...config.languages, nativeLang] : config.languages
  );
  const byLang = new Map<string, RawSubtitleResult[]>();

  for (const sub of filtered) {
    let targetLang = sub.lang;
    let langPenalty = 0;
    if (!groupingLangs.has(targetLang)) {
      if (targetLang === 'por' && groupingLangs.has('pob')) {
        targetLang = 'pob';
        langPenalty = 12;
      } else if (targetLang === 'pob' && groupingLangs.has('por')) {
        targetLang = 'por';
        langPenalty = 12;
      } else {
        continue;
      }
    }
    const list = byLang.get(targetLang) || [];
    list.push({
      ...sub,
      originalLang: sub.originalLang || sub.lang,
      lang: targetLang,
      score: sub.score - langPenalty
    });
    byLang.set(targetLang, list);
  }

  for (const list of byLang.values()) {
    list.sort((a, b) => b.score - a.score);
  }

  const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
  const stremioSubs: StremioSubtitle[] = [];
  const hasAiKey = Boolean(
    config.aiApiKey ||
      (config.aiProvider === 'openai'
        ? process.env.OPENAI_API_KEY
        : process.env.GEMINI_API_KEY)
  );
  const aiDisplayName = config.aiProvider === 'openai' ? 'OpenAI' : 'Gemini';

  if (config.dualSubtitles) {
    const secondaryCandidates = byLang.get(nativeLang) || [];
    const secondaryDirect = secondaryCandidates.filter((m) => !m.downloadUrl.startsWith('os://'));
    for (const lang of config.languages) {
      if (lang === nativeLang) continue;
      const primaryCandidates = byLang.get(lang) || [];
      const primaryDirect = primaryCandidates.filter((m) => !m.downloadUrl.startsWith('os://'));

      if (primaryCandidates.length > 0 && secondaryCandidates.length > 0) {
        const bestPrimary = primaryCandidates[0];
        const bestSecondary = selectBestCompanion(bestPrimary, secondaryCandidates);
        const dualToken = encodeDualToken({
          primary: toProxyPayload(
            bestPrimary,
            query,
            config,
            pickFallbackSub(bestPrimary, primaryDirect)
          ),
          secondary: toProxyPayload(
            bestSecondary,
            query,
            config,
            pickFallbackSub(bestSecondary, secondaryDirect)
          ),
          primaryLang: lang,
          secondaryLang: nativeLang,
          annotate: Boolean(config.dualSubtitlesAnnotate && hasAiKey),
          aiProvider: config.aiProvider,
          aiApiKey: config.aiApiKey,
          aiModel: config.aiModel,
          aiBaseUrl: config.aiBaseUrl
        });
        const relSummary = summarizeRelease(bestPrimary.releaseName);
        const label = [
          `${formatLangShort(lang)}+${formatLangShort(nativeLang)}`,
          'Dual',
          relSummary
        ]
          .filter(Boolean)
          .join(' • ');
        stremioSubs.push({
          id: `dual-${lang}-${nativeLang}-${bestPrimary.id}`,
          url: `${cleanBaseUrl}/dual/${dualToken}.srt`,
          lang: descriptiveLang ? label : lang,
          label
        });
      } else if (config.aiMode !== 'off' && hasAiKey) {
        if (primaryCandidates.length > 0 && secondaryCandidates.length === 0) {
          const bestPrimary = primaryCandidates[0];
          const dualToken = encodeDualToken({
            primary: toProxyPayload(
              bestPrimary,
              query,
              config,
              pickFallbackSub(bestPrimary, primaryDirect)
            ),
            primaryLang: lang,
            secondaryLang: nativeLang,
            annotate: Boolean(config.dualSubtitlesAnnotate),
            aiProvider: config.aiProvider,
            aiApiKey: config.aiApiKey,
            aiModel: config.aiModel,
            aiBaseUrl: config.aiBaseUrl
          });
          const label = `${formatLangShort(lang)}+${formatLangShort(nativeLang)} • Dual + AI (${aiDisplayName})`;
          stremioSubs.push({
            id: `dual-ai-${lang}-${nativeLang}-${bestPrimary.id}`,
            url: `${cleanBaseUrl}/dual/${dualToken}.srt`,
            lang: descriptiveLang ? label : lang,
            label
          });
        } else if (primaryCandidates.length === 0 && secondaryCandidates.length > 0) {
          const bestSecondary = secondaryCandidates[0];
          const dualToken = encodeDualToken({
            secondary: toProxyPayload(
              bestSecondary,
              query,
              config,
              pickFallbackSub(bestSecondary, secondaryDirect)
            ),
            primaryLang: lang,
            secondaryLang: nativeLang,
            annotate: Boolean(config.dualSubtitlesAnnotate),
            aiProvider: config.aiProvider,
            aiApiKey: config.aiApiKey,
            aiModel: config.aiModel,
            aiBaseUrl: config.aiBaseUrl
          });
          const label = `${formatLangShort(lang)}+${formatLangShort(nativeLang)} • Dual + AI (${aiDisplayName})`;
          stremioSubs.push({
            id: `dual-ai-${lang}-${nativeLang}-${bestSecondary.id}`,
            url: `${cleanBaseUrl}/dual/${dualToken}.srt`,
            lang: descriptiveLang ? label : lang,
            label
          });
        }
      }
    }
  }

  for (const lang of config.languages) {
    const allMatches = byLang.get(lang) || [];
    const directFallbacks = allMatches.filter((m) => !m.downloadUrl.startsWith('os://'));
    const matches =
      directFallbacks.length >= 2
        ? allMatches.filter((m) => !m.downloadUrl.startsWith('os://') || m.hashMatch)
        : allMatches;
    let fbIdx = 0;
    const topMatches = matches.slice(0, 15);
    for (let idx = 0; idx < topMatches.length; idx++) {
      const sub = topMatches[idx];
      const needsProxy =
        config.proxySubtitles ||
        sub.downloadUrl.startsWith('os://') ||
        sub.format !== 'srt' ||
        (sub.encoding && sub.encoding.toUpperCase() !== 'UTF-8');

      let url = sub.downloadUrl;
      if (needsProxy) {
        const fallbackSub = pickFallbackSub(sub, directFallbacks, fbIdx++);
        const proxyPayload = toProxyPayload(sub, query, config, fallbackSub);
        url = `${cleanBaseUrl}/sub/${encodeProxyToken(proxyPayload)}.srt`;
      }

      const label = formatSubtitleLabel(sub, idx + 1);
      if (descriptiveLang && idx === 0) {
        // Emit standard ISO 639-2 entry first so TV/native players auto-select preferred language
        stremioSubs.push({
          id: `${sub.id}-auto`,
          url,
          lang: sub.lang,
          label
        });
      }

      stremioSubs.push({
        id: sub.id,
        url,
        lang: descriptiveLang ? label : sub.lang,
        label
      });
    }
  }

  // AI Fallback / Multimodal Translation tracks
  if (config.aiMode !== 'off' && hasAiKey) {
    const langsNeedingAi = config.languages.filter((targetLang) => {
      const existingCount = (byLang.get(targetLang) || []).length;
      return config.aiMode === 'always' || (config.aiMode === 'fallback' && existingCount === 0);
    });

    if (langsNeedingAi.length > 0) {
      let englishSource = filtered.find((s) => s.lang === 'eng');
      if (!englishSource && !requestedLangs.has('eng')) {
        const engRaw = await fetchRawSubtitles(
          { ...query, languages: ['eng'] },
          { ...config, languages: ['eng'] }
        );
        const engFiltered = config.includeHearingImpaired
          ? engRaw
          : engRaw.filter((r) => !r.hearingImpaired);
        englishSource = engFiltered.find((s) => s.lang === 'eng') || engFiltered[0];
      }
      const bestSource = englishSource || filtered[0];

      for (const targetLang of langsNeedingAi) {
        if (bestSource && bestSource.lang !== targetLang) {
          const srcDirect = filtered.filter(
            (s) => s.lang === bestSource.lang && !s.downloadUrl.startsWith('os://')
          );
          const srcPayload = toProxyPayload(
            bestSource,
            query,
            config,
            pickFallbackSub(bestSource, srcDirect)
          );

          const translateToken = encodeTranslateToken({
            src: srcPayload,
            fromLang: bestSource.lang,
            toLang: targetLang,
            aiProvider: config.aiProvider,
            aiApiKey: config.aiApiKey,
            aiModel: config.aiModel,
            aiBaseUrl: config.aiBaseUrl
          });

          const srcSummary = summarizeRelease(bestSource.releaseName);
          const label = [
            formatLangShort(targetLang),
            `AI (${aiDisplayName})`,
            `${formatLangShort(bestSource.lang)}→${formatLangShort(targetLang)}`,
            srcSummary
          ]
            .filter(Boolean)
            .join(' • ');
          const url = `${cleanBaseUrl}/translate/${translateToken}.srt`;
          const aiId = `ai-${config.aiProvider}-${targetLang}-${bestSource.id}`;

          if (descriptiveLang && (byLang.get(targetLang) || []).length === 0) {
            stremioSubs.push({
              id: `${aiId}-auto`,
              url,
              lang: targetLang,
              label
            });
          }

          stremioSubs.push({
            id: aiId,
            url,
            lang: descriptiveLang ? label : targetLang,
            label
          });
        }
      }
    }
  }

  return stremioSubs;
}
