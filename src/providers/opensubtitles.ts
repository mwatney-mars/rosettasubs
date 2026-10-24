import { RawSubtitleResult, SubtitleQuery } from '../types';
import { toIso639_1, toIso639_2 } from '../languages';
import { scoreReleaseMatch } from './releaseScorer';

interface OpenSubtitlesFile {
  file_id?: number;
  file_name?: string;
}

interface OpenSubtitlesAttributes {
  subtitle_id?: string;
  language?: string;
  download_count?: number;
  hearing_impaired?: boolean;
  moviehash_match?: boolean;
  release?: string;
  files?: OpenSubtitlesFile[];
}

interface OpenSubtitlesItem {
  id?: string;
  attributes?: OpenSubtitlesAttributes;
}

interface OpenSubtitlesSearchResponse {
  data?: OpenSubtitlesItem[];
}

const OS_API_BASE = process.env.OPENSUBTITLES_API_URL || 'https://api.opensubtitles.com/api/v1';
const USER_AGENT = 'StremioMultimodalSubtitles v1.0.0';

export async function searchOpenSubtitles(
  query: SubtitleQuery,
  apiKey?: string,
  timeoutMs = 7000
): Promise<RawSubtitleResult[]> {
  if (!apiKey || !query.imdbId) return [];

  const numericImdb = parseInt(query.imdbId.replace(/^tt/i, ''), 10);
  if (Number.isNaN(numericImdb)) return [];

  const iso1Langs = new Set(query.languages.map((l) => toIso639_1(l)));
  if (query.languages.includes('pob') || query.languages.includes('por')) {
    iso1Langs.add('pt-br');
    iso1Langs.add('pt-pt');
  }
  if (query.languages.includes('zho')) {
    iso1Langs.add('zh-cn');
    iso1Langs.add('zh-tw');
    iso1Langs.add('ze');
    iso1Langs.add('zh-ca');
  }
  if (query.languages.includes('spa')) {
    iso1Langs.add('es');
    iso1Langs.add('ea');
    iso1Langs.add('sp');
  }

  const params = new URLSearchParams({
    languages: Array.from(iso1Langs).join(',')
  });

  if (query.type === 'series' && query.season !== undefined && query.episode !== undefined) {
    params.set('parent_imdb_id', String(numericImdb));
    params.set('season_number', String(query.season));
    params.set('episode_number', String(query.episode));
  } else {
    params.set('imdb_id', String(numericImdb));
  }

  if (query.videoHash) {
    params.set('moviehash', query.videoHash);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${OS_API_BASE}/subtitles?${params.toString()}`, {
      headers: {
        'Api-Key': apiKey,
        'User-Agent': USER_AGENT,
        Accept: 'application/json'
      },
      signal: controller.signal
    });

    if (!res.ok) return [];

    const json = (await res.json()) as OpenSubtitlesSearchResponse;
    if (!Array.isArray(json.data)) return [];

    const results: RawSubtitleResult[] = [];
    const langCounts = new Map<string, number>();
    for (let i = 0; i < json.data.length; i++) {
      const item = json.data[i];
      const attrs = item.attributes;
      if (!attrs || !attrs.language || !Array.isArray(attrs.files) || attrs.files.length === 0) {
        continue;
      }

      const file = attrs.files[0];
      if (!file.file_id) continue;

      const lang = toIso639_2(attrs.language);
      const iso1 = toIso639_1(lang);
      const langIdx = langCounts.get(lang) || 0;
      langCounts.set(lang, langIdx + 1);

      const hashMatch = Boolean(attrs.moviehash_match);
      const releaseName = attrs.release || file.file_name;

      let score = 68 - Math.min(langIdx, 30);
      if (hashMatch) score += 50;
      score += scoreReleaseMatch(query.filename, releaseName);

      results.push({
        id: `os-${file.file_id}-${lang}`,
        provider: 'opensubtitles',
        downloadUrl: `os://${file.file_id}`,
        lang,
        iso639_1: iso1,
        format: 'srt',
        encoding: 'UTF-8',
        releaseName,
        hearingImpaired: Boolean(attrs.hearing_impaired),
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

export async function resolveOpenSubtitlesDownloadUrl(
  fileId: string,
  apiKey?: string,
  timeoutMs = 7000
): Promise<string | null> {
  const key = apiKey || process.env.OPENSUBTITLES_API_KEY;
  if (!key) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${OS_API_BASE}/download`, {
      method: 'POST',
      headers: {
        'Api-Key': key,
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ file_id: Number(fileId) }),
      signal: controller.signal
    });

    if (!res.ok) return null;
    const data = (await res.json()) as { link?: string };
    return data.link || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
