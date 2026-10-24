import express, { Request, Response } from 'express';
import cors from 'cors';
import {
  decodeConfig,
  decodeDualToken,
  decodeProxyToken,
  decodeTranslateToken
} from './config';
import { buildManifest } from './manifest';
import { renderConfigurePage } from './ui/configureHtml';
import { LOGO_SVG } from './ui/logo';
import { getStremioSubtitles, parseStremioSubtitleRequest } from './providers';
import { fetchAndNormalizeSubtitle } from './providers/fetcher';
import { annotateSrtIdioms, transcribeMediaToSrt, translateSrtContent } from './ai/multimodal';
import { mergeDualSrt } from './subtitleConverter';
import { searchCache, subtitleContentCache } from './cache';

function resolveBaseUrl(req: Request): string {
  const configuredUrl = process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL;
  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, '');
  }
  const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0]?.trim() || req.protocol || 'http';
  const host = (req.headers['x-forwarded-host'] as string)?.split(',')[0]?.trim() || req.get('host') || 'localhost:7000';
  return `${proto}://${host}`;
}

export function createApp() {
  const app = express();
  const recentLogs: string[] = [];
  const logEvent = (msg: string) => {
    const entry = `${new Date().toISOString()} ${msg}`;
    recentLogs.push(entry);
    if (recentLogs.length > 100) recentLogs.shift();
    if (process.env.NODE_ENV !== 'test') {
      console.log(entry);
    }
  };

  app.set('trust proxy', true);
  app.use(cors());
  app.use(express.json({ limit: '25mb' }));

  app.use((req: Request, res: Response, next) => {
    if (req.path === '/health' || req.path === '/logo.svg') {
      next();
      return;
    }
    const start = Date.now();
    res.on('finish', () => {
      const ua = req.headers['user-agent'] || '-';
      const shortPath =
        req.originalUrl.length > 140 ? `${req.originalUrl.slice(0, 140)}...` : req.originalUrl;
      logEvent(
        `[HTTP] ${req.method} ${shortPath} -> ${res.statusCode} (${Date.now() - start}ms) ua="${ua}"`
      );
    });
    next();
  });

  app.get('/', (_req: Request, res: Response) => {
    res.redirect('/configure');
  });

  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      cache: {
        search: searchCache.stats(),
        subtitles: subtitleContentCache.stats()
      },
      recentLogs
    });
  });

  app.get('/logo.svg', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(LOGO_SVG);
  });

  app.get(['/configure', '/:config/configure'], (req: Request, res: Response) => {
    const config = decodeConfig(req.params.config);
    const baseUrl = resolveBaseUrl(req);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderConfigurePage(config, baseUrl));
  });

  app.get(['/manifest.json', '/:config/manifest.json'], (req: Request, res: Response) => {
    const config = decodeConfig(req.params.config);
    res.json(buildManifest(config, Boolean(req.params.config), resolveBaseUrl(req)));
  });

  const handleSubtitles = async (req: Request, res: Response) => {
    try {
      const config = decodeConfig(req.params.config);
      const { type } = req.params;
      const rawId = req.params.id.replace(/\.json$/i, '');
      const rawExtra = req.params.extra;

      const query = parseStremioSubtitleRequest(type, rawId, rawExtra, config.languages);
      const baseUrl = resolveBaseUrl(req);
      const descriptiveLang = req.query.descriptiveLang === '1';
      const subtitles = await getStremioSubtitles(query, config, baseUrl, { descriptiveLang });

      logEvent(
        `[SUBTITLES] type=${type} id=${rawId} extra=${rawExtra || '-'} langs=${config.languages.join(',')} count=${subtitles.length} sample=${subtitles
          .slice(0, 5)
          .map((s) => `${s.id}(${s.lang})`)
          .join(',')}`
      );

      res.setHeader('Vary', 'Origin, User-Agent');
      res.setHeader('Cache-Control', 'public, max-age=900, stale-while-revalidate=1800');
      res.json({
        subtitles,
        cacheMaxAge: 900,
        staleRevalidate: 1800,
        staleError: 86400
      });
    } catch (err) {
      logEvent(`[SUBTITLES-ERR] ${err instanceof Error ? err.message : String(err)}`);
      res.json({ subtitles: [] });
    }
  };

  app.get('/subtitles/:type/:id/:extra.json', handleSubtitles);
  app.get('/subtitles/:type/:id.json', handleSubtitles);
  app.get('/:config/subtitles/:type/:id/:extra.json', handleSubtitles);
  app.get('/:config/subtitles/:type/:id.json', handleSubtitles);

  app.get('/sub/:token', async (req: Request, res: Response) => {
    const payload = decodeProxyToken(req.params.token);
    if (!payload || !payload.u) {
      logEvent(`[SUB-400] invalid token=${req.params.token.slice(0, 30)}`);
      res.status(400).send('Invalid subtitle token');
      return;
    }

    try {
      const srt = await fetchAndNormalizeSubtitle(payload);
      logEvent(
        `[SUB-OK] u=${payload.u} fb=${payload.fb || '-'} bytes=${Buffer.byteLength(srt, 'utf8')} se=${payload.se ?? '-'} ep=${payload.ep ?? '-'}`
      );
      res.setHeader('Content-Type', 'application/x-subrip; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(srt);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Subtitle fetch failed';
      logEvent(`[SUB-ERR] u=${payload.u} fb=${payload.fb || '-'} err="${msg}"`);
      res.status(502).send(msg);
    }
  });

  app.get('/translate/:token', async (req: Request, res: Response) => {
    const payload = decodeTranslateToken(req.params.token);
    if (!payload || !payload.src || !payload.toLang) {
      res.status(400).send('Invalid translation token');
      return;
    }

    const cacheKey = `tr:${payload.aiProvider}:${payload.aiModel ?? ''}:${payload.fromLang}:${payload.toLang}:${payload.src.u}:${payload.src.se ?? ''}:${payload.src.ep ?? ''}`;
    const cached = subtitleContentCache.get(cacheKey);
    if (cached) {
      res.setHeader('Content-Type', 'application/x-subrip; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(cached);
      return;
    }

    try {
      const sourceSrt = await fetchAndNormalizeSubtitle(payload.src);
      const translatedSrt = await translateSrtContent({
        srtContent: sourceSrt,
        fromLang: payload.fromLang,
        toLang: payload.toLang,
        aiProvider: payload.aiProvider,
        apiKey: payload.aiApiKey,
        model: payload.aiModel,
        baseUrl: payload.aiBaseUrl
      });

      if (translatedSrt.trim()) {
        subtitleContentCache.set(cacheKey, translatedSrt);
      }

      res.setHeader('Content-Type', 'application/x-subrip; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(translatedSrt);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Subtitle translation failed';
      res.status(502).send(msg);
    }
  });

  app.get('/dual/:token', async (req: Request, res: Response) => {
    const payload = decodeDualToken(req.params.token);
    if (
      !payload ||
      (!payload.primary && !payload.secondary) ||
      !payload.primaryLang ||
      !payload.secondaryLang
    ) {
      res.status(400).send('Invalid dual subtitle token');
      return;
    }

    const cacheKey = [
      'dual',
      payload.primary?.u ?? '',
      payload.secondary?.u ?? '',
      payload.primaryLang,
      payload.secondaryLang,
      payload.annotate ? 'ann1' : 'ann0',
      payload.aiProvider ?? '',
      payload.aiModel ?? '',
      payload.primary?.se ?? payload.secondary?.se ?? '',
      payload.primary?.ep ?? payload.secondary?.ep ?? ''
    ].join(':');

    const cached = subtitleContentCache.get(cacheKey);
    if (cached) {
      res.setHeader('Content-Type', 'application/x-subrip; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(cached);
      return;
    }

    try {
      const aiProvider = payload.aiProvider || 'gemini';
      let primarySrt = '';
      let secondarySrt = '';

      if (payload.primary && payload.secondary) {
        [primarySrt, secondarySrt] = await Promise.all([
          fetchAndNormalizeSubtitle(payload.primary),
          fetchAndNormalizeSubtitle(payload.secondary)
        ]);
      } else if (payload.primary) {
        primarySrt = await fetchAndNormalizeSubtitle(payload.primary);
        secondarySrt = await translateSrtContent({
          srtContent: primarySrt,
          fromLang: payload.primaryLang,
          toLang: payload.secondaryLang,
          aiProvider,
          apiKey: payload.aiApiKey,
          model: payload.aiModel,
          baseUrl: payload.aiBaseUrl
        });
      } else if (payload.secondary) {
        secondarySrt = await fetchAndNormalizeSubtitle(payload.secondary);
        primarySrt = await translateSrtContent({
          srtContent: secondarySrt,
          fromLang: payload.secondaryLang,
          toLang: payload.primaryLang,
          aiProvider,
          apiKey: payload.aiApiKey,
          model: payload.aiModel,
          baseUrl: payload.aiBaseUrl
        });
      }

      if (payload.annotate) {
        primarySrt = await annotateSrtIdioms({
          srtContent: primarySrt,
          fromLang: payload.primaryLang,
          toLang: payload.secondaryLang,
          aiProvider,
          apiKey: payload.aiApiKey,
          model: payload.aiModel,
          baseUrl: payload.aiBaseUrl
        });
      }

      const merged = mergeDualSrt(primarySrt, secondarySrt);
      if (merged.trim()) {
        subtitleContentCache.set(cacheKey, merged);
      }

      res.setHeader('Content-Type', 'application/x-subrip; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(merged);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Dual subtitle generation failed';
      res.status(502).send(msg);
    }
  });

  app.post('/api/multimodal/transcribe', async (req: Request, res: Response) => {
    const { mediaBase64, mimeType, targetLang, apiKey, model, baseUrl } = req.body || {};
    if (!mediaBase64 || !mimeType) {
      res.status(400).json({ error: 'mediaBase64 and mimeType are required' });
      return;
    }

    try {
      const srt = await transcribeMediaToSrt({
        mediaBase64: String(mediaBase64),
        mimeType: String(mimeType),
        targetLang: String(targetLang || 'eng'),
        apiKey: apiKey ? String(apiKey) : undefined,
        model: model ? String(model) : undefined,
        baseUrl: baseUrl ? String(baseUrl) : undefined
      });
      res.json({ srt });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Multimodal transcription failed';
      res.status(502).json({ error: msg });
    }
  });

  return app;
}
