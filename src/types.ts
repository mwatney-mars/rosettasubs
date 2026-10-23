export type ProviderName = 'wyzie' | 'opensubtitles' | 'subdl';

export type AIProviderName = 'gemini' | 'openai';

export type AIMode = 'fallback' | 'always' | 'off';

export interface AddonConfig {
  languages: string[]; // ISO 639-2 three-letter codes (e.g. ['eng', 'spa'])
  providers: ProviderName[];
  openSubtitlesApiKey?: string;
  subdlApiKey?: string;
  aiProvider: AIProviderName;
  aiApiKey?: string;
  aiModel?: string;
  aiBaseUrl?: string;
  aiMode: AIMode;
  proxySubtitles: boolean;
  includeHearingImpaired: boolean;
}

export interface StremioSubtitle {
  id: string;
  url: string;
  lang: string;
}

export interface StremioSubtitlesResponse {
  subtitles: StremioSubtitle[];
  cacheMaxAge?: number;
  staleRevalidate?: number;
  staleError?: number;
}

export interface SubtitleQuery {
  type: 'movie' | 'series' | string;
  imdbId: string;
  season?: number;
  episode?: number;
  videoHash?: string;
  videoSize?: number;
  filename?: string;
  languages: string[]; // ISO 639-2 codes
}

export interface RawSubtitleResult {
  id: string;
  provider: ProviderName | 'ai';
  downloadUrl: string; // HTTP(S) URL or internal scheme like os://<file_id>:<api_key_hash>
  lang: string; // ISO 639-2 code for Stremio
  iso639_1: string; // ISO 639-1 code
  format: 'srt' | 'vtt' | 'ass' | 'sub' | 'zip';
  encoding?: string;
  releaseName?: string;
  hearingImpaired?: boolean;
  hashMatch?: boolean;
  score: number;
}

export interface SrtCue {
  index: number;
  startTime: string;
  endTime: string;
  text: string;
}

export interface ProxyTokenPayload {
  u: string; // upstream URL or os://<fileId>
  f?: 'srt' | 'vtt' | 'ass' | 'sub' | 'zip';
  e?: string; // encoding hint
  osKey?: string; // OpenSubtitles API key if needed for lazy download
  ep?: number; // episode number hint for zip extraction
  se?: number; // season number hint for zip extraction
}

export interface TranslateTokenPayload {
  src: ProxyTokenPayload;
  fromLang: string;
  toLang: string;
  aiProvider: AIProviderName;
  aiApiKey?: string;
  aiModel?: string;
  aiBaseUrl?: string;
}
