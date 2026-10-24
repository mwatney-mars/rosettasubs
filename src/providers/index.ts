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
  const isOs = sub.downloadUrl.startsWith('os://');
  return {
    u: sub.downloadUrl,
    f: sub.format,
    e: sub.encoding,
    osKey: sub.provider === 'opensubtitles' ? config.openSubtitlesApiKey : undefined,
    fb: isOs && fallbackSub ? fallbackSub.downloadUrl : undefined,
    fbf: isOs && fallbackSub ? fallbackSub.format : undefined,
    se: query.season,
    ep: query.episode
  };
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
  baseUrl: string
): Promise<StremioSubtitle[]> {
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
    if (!groupingLangs.has(targetLang)) {
      if (targetLang === 'por' && groupingLangs.has('pob')) {
        targetLang = 'pob';
      } else if (targetLang === 'pob' && groupingLangs.has('por')) {
        targetLang = 'por';
      } else {
        continue;
      }
    }
    const list = byLang.get(targetLang) || [];
    list.push({ ...sub, lang: targetLang });
    byLang.set(targetLang, list);
  }

  const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
  const stremioSubs: StremioSubtitle[] = [];
  const hasAiKey = Boolean(
    config.aiApiKey ||
      (config.aiProvider === 'openai'
        ? process.env.OPENAI_API_KEY
        : process.env.GEMINI_API_KEY)
  );

  if (config.dualSubtitles) {
    const secondaryCandidates = byLang.get(nativeLang) || [];
    for (const lang of config.languages) {
      if (lang === nativeLang) continue;
      const primaryCandidates = byLang.get(lang) || [];

      if (primaryCandidates.length > 0 && secondaryCandidates.length > 0) {
        const bestPrimary = primaryCandidates[0];
        const bestSecondary = selectBestCompanion(bestPrimary, secondaryCandidates);
        const dualToken = encodeDualToken({
          primary: toProxyPayload(bestPrimary, query, config),
          secondary: toProxyPayload(bestSecondary, query, config),
          primaryLang: lang,
          secondaryLang: nativeLang,
          annotate: Boolean(config.dualSubtitlesAnnotate && hasAiKey),
          aiProvider: config.aiProvider,
          aiApiKey: config.aiApiKey,
          aiModel: config.aiModel,
          aiBaseUrl: config.aiBaseUrl
        });
        stremioSubs.push({
          id: `dual-${lang}-${nativeLang}-${bestPrimary.id}`,
          url: `${cleanBaseUrl}/dual/${dualToken}.srt`,
          lang
        });
      } else if (config.aiMode !== 'off' && hasAiKey) {
        if (primaryCandidates.length > 0 && secondaryCandidates.length === 0) {
          const bestPrimary = primaryCandidates[0];
          const dualToken = encodeDualToken({
            primary: toProxyPayload(bestPrimary, query, config),
            primaryLang: lang,
            secondaryLang: nativeLang,
            annotate: Boolean(config.dualSubtitlesAnnotate),
            aiProvider: config.aiProvider,
            aiApiKey: config.aiApiKey,
            aiModel: config.aiModel,
            aiBaseUrl: config.aiBaseUrl
          });
          stremioSubs.push({
            id: `dual-ai-${lang}-${nativeLang}-${bestPrimary.id}`,
            url: `${cleanBaseUrl}/dual/${dualToken}.srt`,
            lang
          });
        } else if (primaryCandidates.length === 0 && secondaryCandidates.length > 0) {
          const bestSecondary = secondaryCandidates[0];
          const dualToken = encodeDualToken({
            secondary: toProxyPayload(bestSecondary, query, config),
            primaryLang: lang,
            secondaryLang: nativeLang,
            annotate: Boolean(config.dualSubtitlesAnnotate),
            aiProvider: config.aiProvider,
            aiApiKey: config.aiApiKey,
            aiModel: config.aiModel,
            aiBaseUrl: config.aiBaseUrl
          });
          stremioSubs.push({
            id: `dual-ai-${lang}-${nativeLang}-${bestSecondary.id}`,
            url: `${cleanBaseUrl}/dual/${dualToken}.srt`,
            lang
          });
        }
      }
    }
  }

  for (const lang of config.languages) {
    const matches = byLang.get(lang) || [];
    const directFallbacks = matches.filter((m) => !m.downloadUrl.startsWith('os://'));
    let fbIdx = 0;
    for (const sub of matches.slice(0, 15)) {
      const needsProxy =
        config.proxySubtitles ||
        sub.downloadUrl.startsWith('os://') ||
        sub.format !== 'srt' ||
        (sub.encoding && sub.encoding.toUpperCase() !== 'UTF-8');

      let url = sub.downloadUrl;
      if (needsProxy) {
        const fallbackSub =
          sub.downloadUrl.startsWith('os://') && directFallbacks.length > 0
            ? directFallbacks[fbIdx++ % directFallbacks.length]
            : undefined;
        const proxyPayload = toProxyPayload(sub, query, config, fallbackSub);
        url = `${cleanBaseUrl}/sub/${encodeProxyToken(proxyPayload)}.srt`;
      }

      stremioSubs.push({
        id: sub.id,
        url,
        lang: sub.lang
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
          const srcPayload = toProxyPayload(bestSource, query, config);

          const translateToken = encodeTranslateToken({
            src: srcPayload,
            fromLang: bestSource.lang,
            toLang: targetLang,
            aiProvider: config.aiProvider,
            aiApiKey: config.aiApiKey,
            aiModel: config.aiModel,
            aiBaseUrl: config.aiBaseUrl
          });

          stremioSubs.push({
            id: `ai-${config.aiProvider}-${targetLang}-${bestSource.id}`,
            url: `${cleanBaseUrl}/translate/${translateToken}.srt`,
            lang: targetLang
          });
        }
      }
    }
  }

  return stremioSubs;
}
