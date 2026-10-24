import {
  AddonConfig,
  ProxyTokenPayload,
  RawSubtitleResult,
  StremioSubtitle,
  SubtitleQuery
} from '../types';
import { searchCache } from '../cache';
import { encodeProxyToken, encodeTranslateToken } from '../config';
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
    config.languages.slice().sort().join(','),
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

export async function getStremioSubtitles(
  query: SubtitleQuery,
  config: AddonConfig,
  baseUrl: string
): Promise<StremioSubtitle[]> {
  const rawResults = await fetchRawSubtitles(query, config);

  const filtered = config.includeHearingImpaired
    ? rawResults
    : rawResults.filter((r) => !r.hearingImpaired);

  const requestedLangs = new Set(config.languages);
  const byLang = new Map<string, RawSubtitleResult[]>();

  for (const sub of filtered) {
    let targetLang = sub.lang;
    if (!requestedLangs.has(targetLang)) {
      if (targetLang === 'por' && requestedLangs.has('pob')) {
        targetLang = 'pob';
      } else if (targetLang === 'pob' && requestedLangs.has('por')) {
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

  for (const lang of config.languages) {
    const matches = byLang.get(lang) || [];
    for (const sub of matches.slice(0, 15)) {
      const needsProxy =
        config.proxySubtitles ||
        sub.downloadUrl.startsWith('os://') ||
        sub.format !== 'srt' ||
        (sub.encoding && sub.encoding.toUpperCase() !== 'UTF-8');

      let url = sub.downloadUrl;
      if (needsProxy) {
        const proxyPayload: ProxyTokenPayload = {
          u: sub.downloadUrl,
          f: sub.format,
          e: sub.encoding,
          osKey: sub.provider === 'opensubtitles' ? config.openSubtitlesApiKey : undefined,
          se: query.season,
          ep: query.episode
        };
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
  const hasAiKey = Boolean(
    config.aiApiKey ||
      (config.aiProvider === 'openai'
        ? process.env.OPENAI_API_KEY
        : process.env.GEMINI_API_KEY)
  );

  if (config.aiMode !== 'off' && hasAiKey && filtered.length > 0) {
    // Pick best source subtitle (prefer English, otherwise top-scored subtitle)
    const englishSource = filtered.find((s) => s.lang === 'eng');
    const bestSource = englishSource || filtered[0];

    for (const targetLang of config.languages) {
      const existingCount = (byLang.get(targetLang) || []).length;
      const shouldAddAi =
        config.aiMode === 'always' || (config.aiMode === 'fallback' && existingCount === 0);

      if (shouldAddAi && bestSource && bestSource.lang !== targetLang) {
        const srcPayload: ProxyTokenPayload = {
          u: bestSource.downloadUrl,
          f: bestSource.format,
          e: bestSource.encoding,
          osKey:
            bestSource.provider === 'opensubtitles' ? config.openSubtitlesApiKey : undefined,
          se: query.season,
          ep: query.episode
        };

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

  return stremioSubs;
}
