import { RawSubtitleResult, SubtitleQuery } from '../types';
import { toIso639_1, toIso639_2 } from '../languages';

interface WyzieSubItem {
  id?: string;
  url?: string;
  format?: string;
  encoding?: string;
  isHearingImpaired?: boolean;
  language?: string;
  media?: string;
  release?: string;
}

interface StremioOsV3Item {
  id?: string;
  url?: string;
  SubEncoding?: string;
  lang?: string;
  m?: string;
  movieReleaseName?: string;
  subtitleFileName?: string;
}

const WYZIE_BASE_URL = process.env.WYZIE_API_URL || 'https://sub.wyzie.ru';
const STREMIO_OSV3_BASE =
  process.env.STREMIO_OSV3_URL || 'https://opensubtitles-v3.strem.io';

async function searchStremioOsV3(
  query: SubtitleQuery,
  timeoutMs = 6000
): Promise<RawSubtitleResult[]> {
  const idPart =
    query.type === 'series' && query.season !== undefined && query.episode !== undefined
      ? `${query.imdbId}:${query.season}:${query.episode}`
      : query.imdbId;

  const extraParts: string[] = [];
  if (query.videoHash) extraParts.push(`videoHash=${encodeURIComponent(query.videoHash)}`);
  if (query.videoSize) extraParts.push(`videoSize=${encodeURIComponent(String(query.videoSize))}`);
  if (query.filename) extraParts.push(`filename=${encodeURIComponent(query.filename)}`);

  const path =
    extraParts.length > 0
      ? `/subtitles/${query.type}/${encodeURIComponent(idPart)}/${extraParts.join('&')}.json`
      : `/subtitles/${query.type}/${encodeURIComponent(idPart)}.json`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${STREMIO_OSV3_BASE}${path}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'RosettaSubs/1.0'
      },
      signal: controller.signal
    });
    if (!res.ok) return [];

    const json = (await res.json()) as { subtitles?: StremioOsV3Item[] };
    if (!Array.isArray(json.subtitles)) return [];

    const results: RawSubtitleResult[] = [];
    for (let i = 0; i < json.subtitles.length; i++) {
      const item = json.subtitles[i];
      if (!item.url || !item.lang) continue;

      const lang = toIso639_2(item.lang);
      const iso1 = toIso639_1(lang);
      const hashMatch = item.m === 'h';
      const releaseName = item.movieReleaseName || item.subtitleFileName;
      let score = 85 - Math.min(i, 30);
      if (hashMatch) score += 50;

      results.push({
        id: `osv3-${item.id || i}-${lang}`,
        provider: 'wyzie',
        downloadUrl: item.url,
        lang,
        iso639_1: iso1,
        format: 'srt',
        encoding: 'UTF-8', // subencoding-stremio-utf8 URLs are already UTF-8
        releaseName,
        hearingImpaired: false,
        hashMatch,
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

export async function searchWyzie(
  query: SubtitleQuery,
  timeoutMs = 7000
): Promise<RawSubtitleResult[]> {
  if (!query.imdbId) return [];

  const params = new URLSearchParams({
    id: query.imdbId
  });

  if (query.type === 'series' && query.season !== undefined && query.episode !== undefined) {
    params.set('season', String(query.season));
    params.set('episode', String(query.episode));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${WYZIE_BASE_URL}/search?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'RosettaSubs/1.0'
      },
      signal: controller.signal
    });

    if (res.ok) {
      const data = (await res.json()) as WyzieSubItem[];
      if (Array.isArray(data) && data.length > 0) {
        const results: RawSubtitleResult[] = [];
        for (let i = 0; i < data.length; i++) {
          const item = data[i];
          if (!item.url || !item.language) continue;

          const lang = toIso639_2(item.language);
          const iso1 = toIso639_1(lang);
          const fmtRaw = (item.format || 'srt').toLowerCase();
          const format =
            fmtRaw === 'vtt' || fmtRaw === 'ass' || fmtRaw === 'sub' ? fmtRaw : 'srt';

          const releaseName = item.release || item.media || undefined;
          let score = 70 - Math.min(i, 30);
          if (
            query.filename &&
            releaseName &&
            query.filename.toLowerCase().includes(releaseName.toLowerCase())
          ) {
            score += 20;
          }

          results.push({
            id: `wyzie-${item.id || i}-${lang}`,
            provider: 'wyzie',
            downloadUrl: item.url,
            lang,
            iso639_1: iso1,
            format,
            encoding: item.encoding || 'UTF-8',
            releaseName,
            hearingImpaired: Boolean(item.isHearingImpaired),
            hashMatch: false,
            score
          });
        }
        if (results.length > 0) return results;
      }
    }
  } catch {
    // Fallback to Stremio OpenSubtitles v3 below
  } finally {
    clearTimeout(timer);
  }

  return searchStremioOsV3(query, timeoutMs);
}
