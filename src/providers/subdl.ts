import { RawSubtitleResult, SubtitleQuery } from '../types';
import { toIso639_1, toIso639_2, toSubdlCode } from '../languages';

interface SubdlSubtitleItem {
  release_name?: string;
  name?: string;
  lang?: string;
  language?: string;
  url?: string;
  hi?: boolean;
  season?: number;
  episode?: number;
}

interface SubdlResponse {
  status?: boolean;
  subtitles?: SubdlSubtitleItem[];
}

const SUBDL_API_BASE = process.env.SUBDL_API_URL || 'https://api.subdl.com/api/v1/subtitles';
const SUBDL_DL_BASE = process.env.SUBDL_DL_URL || 'https://dl.subdl.com';

export async function searchSubdl(
  query: SubtitleQuery,
  apiKey?: string,
  timeoutMs = 7000
): Promise<RawSubtitleResult[]> {
  if (!apiKey || !query.imdbId) return [];

  const subdlLangs = new Set(query.languages.map((l) => toSubdlCode(l)));
  if (query.languages.includes('pob') || query.languages.includes('por')) {
    subdlLangs.add('BR_PT');
    subdlLangs.add('PT');
  }
  if (query.languages.includes('zho')) {
    subdlLangs.add('ZH');
    subdlLangs.add('ZH_BG');
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    imdb_id: query.imdbId.startsWith('tt') ? query.imdbId : `tt${query.imdbId}`,
    type: query.type === 'series' ? 'tv' : 'movie',
    languages: Array.from(subdlLangs).join(','),
    subs_per_page: '30'
  });

  if (query.type === 'series' && query.season !== undefined && query.episode !== undefined) {
    params.set('season_number', String(query.season));
    params.set('episode_number', String(query.episode));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${SUBDL_API_BASE}?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'StremioMultimodalSubtitles/1.0'
      },
      signal: controller.signal
    });

    if (!res.ok) return [];

    const json = (await res.json()) as SubdlResponse;
    if (!json.status || !Array.isArray(json.subtitles)) return [];

    const results: RawSubtitleResult[] = [];
    for (let i = 0; i < json.subtitles.length; i++) {
      const sub = json.subtitles[i];
      if (!sub.url) continue;

      const cleanUrlPath = sub.url.split('?')[0];
      if (!cleanUrlPath || /\.rar$/i.test(cleanUrlPath)) continue;

      const rawLang = sub.language || sub.lang || 'english';
      const lang = toIso639_2(rawLang);
      const iso1 = toIso639_1(lang);
      const downloadUrl = cleanUrlPath.startsWith('http')
        ? cleanUrlPath
        : `${SUBDL_DL_BASE}${cleanUrlPath.startsWith('/') ? '' : '/'}${cleanUrlPath}`;

      const releaseName = sub.release_name || sub.name;
      let score = 82 - Math.min(i, 30);
      if (
        query.filename &&
        releaseName &&
        query.filename.toLowerCase().includes(releaseName.toLowerCase())
      ) {
        score += 20;
      }

      results.push({
        id: `subdl-${i}-${lang}`,
        provider: 'subdl',
        downloadUrl,
        lang,
        iso639_1: iso1,
        format: downloadUrl.toLowerCase().endsWith('.zip') ? 'zip' : 'srt',
        encoding: 'UTF-8',
        releaseName,
        hearingImpaired: Boolean(sub.hi),
        hashMatch: false,
        score
      });
    }

    return results;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
