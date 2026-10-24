import { ProxyTokenPayload } from '../types';
import { subtitleContentCache } from '../cache';
import {
  decodeSubtitleBuffer,
  extractSubtitleFromZip,
  isZipBuffer,
  normalizeToSrt
} from '../subtitleConverter';
import { resolveOpenSubtitlesDownloadUrl } from './opensubtitles';

export async function fetchAndNormalizeSubtitle(
  payload: ProxyTokenPayload,
  timeoutMs = 12000
): Promise<string> {
  const cacheKey = `sub:${payload.u}:${payload.se ?? ''}:${payload.ep ?? ''}`;
  const cached = subtitleContentCache.get(cacheKey);
  if (cached) return cached;

  let targetUrl = payload.u;
  let formatHint: string | undefined = payload.f;
  if (targetUrl.startsWith('os://')) {
    const fileId = targetUrl.replace(/^os:\/\//, '');
    const resolved = await resolveOpenSubtitlesDownloadUrl(fileId, payload.osKey, timeoutMs);
    if (resolved) {
      targetUrl = resolved;
    } else if (payload.fb) {
      targetUrl = payload.fb;
      formatHint = payload.fbf || 'srt';
    } else {
      throw new Error(`Failed to resolve OpenSubtitles download link for file ${fileId}`);
    }
  }

  const parsedUrl = new URL(targetUrl);
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error(`Unsupported protocol: ${parsedUrl.protocol}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'StremioMultimodalSubtitles/1.0',
        Accept: '*/*'
      },
      signal: controller.signal
    });

    if (!res.ok) {
      throw new Error(`Upstream subtitle fetch failed with HTTP ${res.status}`);
    }

    const arrayBuf = await res.arrayBuffer();
    let buffer: Buffer = Buffer.from(arrayBuf);

    if (formatHint === 'zip' || isZipBuffer(buffer)) {
      const extracted = extractSubtitleFromZip(buffer, payload.se, payload.ep);
      if (!extracted) {
        throw new Error('No valid subtitle file found inside ZIP archive');
      }
      buffer = extracted.buffer;
      const extMatch = extracted.filename.match(/\.(srt|vtt|ass|ssa|sub)$/i);
      formatHint = extMatch ? extMatch[1].toLowerCase() : 'srt';
    }

    const decoded = decodeSubtitleBuffer(buffer, payload.e);
    const srt = normalizeToSrt(decoded, formatHint);

    if (srt.trim()) {
      subtitleContentCache.set(cacheKey, srt);
    }

    return srt;
  } finally {
    clearTimeout(timer);
  }
}
