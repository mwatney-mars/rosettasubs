import { AddonConfig, ProxyTokenPayload, TranslateTokenPayload } from './types';
import { toIso639_2 } from './languages';

export function getDefaultConfig(): AddonConfig {
  const defaultLangs = (process.env.DEFAULT_LANGUAGES || 'eng,spa,fre')
    .split(',')
    .map((l) => toIso639_2(l))
    .filter(Boolean);

  const openaiKey = process.env.OPENAI_API_KEY || '';
  const geminiKey = process.env.GEMINI_API_KEY || '';

  return {
    languages: defaultLangs.length > 0 ? Array.from(new Set(defaultLangs)) : ['eng'],
    providers: ['wyzie', 'opensubtitles', 'subdl'],
    openSubtitlesApiKey: undefined,
    subdlApiKey: undefined,
    aiProvider: geminiKey ? 'gemini' : openaiKey ? 'openai' : 'gemini',
    aiApiKey: undefined,
    aiModel: process.env.AI_MODEL || undefined,
    aiBaseUrl: process.env.AI_BASE_URL || undefined,
    aiMode: 'fallback',
    proxySubtitles: true,
    includeHearingImpaired: true
  };
}

export function encodeConfig(config: Partial<AddonConfig>): string {
  const json = JSON.stringify(config);
  return Buffer.from(json, 'utf8').toString('base64url');
}

export function decodeConfig(encoded?: string): AddonConfig {
  const defaults = getDefaultConfig();
  if (!encoded || encoded === 'configure' || encoded === 'manifest.json') {
    return defaults;
  }

  try {
    const json = Buffer.from(encoded, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as Partial<AddonConfig>;

    const languages =
      Array.isArray(parsed.languages) && parsed.languages.length > 0
        ? Array.from(new Set(parsed.languages.map((l) => toIso639_2(String(l)))))
        : defaults.languages;

    const validProviders = new Set(['wyzie', 'opensubtitles', 'subdl']);
    const providers =
      Array.isArray(parsed.providers) && parsed.providers.length > 0
        ? parsed.providers.filter((p) => validProviders.has(p))
        : defaults.providers;

    return {
      languages,
      providers: providers.length > 0 ? providers : defaults.providers,
      openSubtitlesApiKey: parsed.openSubtitlesApiKey?.trim() || defaults.openSubtitlesApiKey,
      subdlApiKey: parsed.subdlApiKey?.trim() || defaults.subdlApiKey,
      aiProvider: parsed.aiProvider === 'openai' ? 'openai' : 'gemini',
      aiApiKey: parsed.aiApiKey?.trim() || defaults.aiApiKey,
      aiModel: parsed.aiModel?.trim() || defaults.aiModel,
      aiBaseUrl: parsed.aiBaseUrl?.trim() || defaults.aiBaseUrl,
      aiMode:
        parsed.aiMode === 'always' || parsed.aiMode === 'off' || parsed.aiMode === 'fallback'
          ? parsed.aiMode
          : defaults.aiMode,
      proxySubtitles:
        typeof parsed.proxySubtitles === 'boolean'
          ? parsed.proxySubtitles
          : defaults.proxySubtitles,
      includeHearingImpaired:
        typeof parsed.includeHearingImpaired === 'boolean'
          ? parsed.includeHearingImpaired
          : defaults.includeHearingImpaired
    };
  } catch {
    return defaults;
  }
}

export function encodeToken<T>(payload: T): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeToken<T>(token: string): T | null {
  try {
    const clean = token.replace(/\.(srt|vtt)$/i, '');
    const json = Buffer.from(clean, 'base64url').toString('utf8');
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export function encodeProxyToken(payload: ProxyTokenPayload): string {
  return encodeToken(payload);
}

export function decodeProxyToken(token: string): ProxyTokenPayload | null {
  return decodeToken<ProxyTokenPayload>(token);
}

export function encodeTranslateToken(payload: TranslateTokenPayload): string {
  return encodeToken(payload);
}

export function decodeTranslateToken(token: string): TranslateTokenPayload | null {
  return decodeToken<TranslateTokenPayload>(token);
}
