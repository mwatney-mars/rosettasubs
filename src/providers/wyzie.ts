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

const WYZIE_BASE_URL = process.env.WYZIE_API_URL || 'https://sub.wyzie.ru';

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
        'User-Agent': 'StremioMultimodalSubtitles/1.0'
      },
      signal: controller.signal
    });

    if (!res.ok) return [];

    const data = (await res.json()) as WyzieSubItem[];
    if (!Array.isArray(data)) return [];

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

    return results;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
