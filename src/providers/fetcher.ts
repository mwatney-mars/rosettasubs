import { ProxyTokenPayload } from '../types';
import { subtitleContentCache } from '../cache';
import {
  decodeSubtitleBuffer,
  extractSubtitleFromZip,
  isZipBuffer,
  normalizeToSrt
} from '../subtitleConverter';
import { resolveOpenSubtitlesDownloadUrl } from './opensubtitles';

async function downloadAndDecodeSingleUrl(
  rawUrl: string,
  formatHint: string | undefined,
  encodingHint: string | undefined,
  se: number | undefined,
  ep: number | undefined,
  timeoutMs: number
): Promise<string> {
  const parsedUrl = new URL(rawUrl);
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error(`Unsupported protocol: ${parsedUrl.protocol}`);
  }
  if (parsedUrl.hostname === 'dl.subdl.com') {
    parsedUrl.search = '';
  }
  const cleanUrl = parsedUrl.toString();

  let lastErr: Error | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(cleanUrl, {
        headers: {
          'User-Agent': 'StremioMultimodalSubtitles/1.0',
          Accept: '*/*'
        },
        signal: controller.signal
      });

      if (!res.ok) {
        const err = new Error(`Upstream subtitle fetch failed with HTTP ${res.status}`);
        if ((res.status === 429 || res.status >= 500) && attempt === 0) {
          lastErr = err;
          await new Promise((r) => setTimeout(r, 250));
          continue;
        }
        throw err;
      }

      const arrayBuf = await res.arrayBuffer();
      let buffer: Buffer = Buffer.from(arrayBuf);
      let effectiveFormat = formatHint;

      if (effectiveFormat === 'zip' || isZipBuffer(buffer)) {
        const extracted = extractSubtitleFromZip(buffer, se, ep);
        if (!extracted) {
          throw new Error('No valid subtitle file found inside ZIP archive');
        }
        buffer = extracted.buffer;
        const extMatch = extracted.filename.match(/\.(srt|vtt|ass|ssa|sub)$/i);
        effectiveFormat = extMatch ? extMatch[1].toLowerCase() : 'srt';
      }

      const decoded = decodeSubtitleBuffer(buffer, encodingHint);
      const srt = normalizeToSrt(decoded, effectiveFormat);
      if (!srt.trim()) {
        throw new Error('Decoded subtitle content is empty');
      }

      return srt;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      const isRetryable =
        attempt === 0 &&
        !lastErr.message.includes('HTTP 40') &&
        !lastErr.message.includes('ZIP archive');
      if (isRetryable) {
        await new Promise((r) => setTimeout(r, 250));
        continue;
      }
      throw lastErr;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastErr || new Error('Subtitle fetch failed');
}

export async function fetchAndNormalizeSubtitle(
  payload: ProxyTokenPayload,
  timeoutMs = 12000
): Promise<string> {
  const cacheKey = `sub:${payload.u}:${payload.se ?? ''}:${payload.ep ?? ''}`;
  const cached = subtitleContentCache.get(cacheKey);
  if (cached) return cached;

  let primaryError: Error | undefined;

  try {
    let targetUrl = payload.u;
    if (targetUrl.startsWith('os://')) {
      const fileId = targetUrl.replace(/^os:\/\//, '');
      const resolved = await resolveOpenSubtitlesDownloadUrl(
        fileId,
        payload.osKey,
        Math.min(timeoutMs, 6000)
      );
      if (!resolved) {
        throw new Error(`Failed to resolve OpenSubtitles download link for file ${fileId}`);
      }
      targetUrl = resolved;
    }

    const srt = await downloadAndDecodeSingleUrl(
      targetUrl,
      payload.f,
      payload.e,
      payload.se,
      payload.ep,
      timeoutMs
    );
    subtitleContentCache.set(cacheKey, srt);
    return srt;
  } catch (err) {
    primaryError = err instanceof Error ? err : new Error(String(err));
  }

  if (payload.fb && !payload.fb.startsWith('os://')) {
    const srt = await downloadAndDecodeSingleUrl(
      payload.fb,
      payload.fbf || 'srt',
      'UTF-8',
      payload.se,
      payload.ep,
      timeoutMs
    );
    subtitleContentCache.set(cacheKey, srt);
    return srt;
  }

  throw primaryError || new Error('Subtitle fetch failed');
}
