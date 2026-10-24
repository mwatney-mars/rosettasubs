type SourceFamily = 'web' | 'bluray' | 'hdtv' | 'dvd' | 'screener';

const SCREENER_RE = /\b(dvdscr|screener|scr|cam|camrip|hdcam|hdts|telesync|telecine|workprint)\b/i;
const WEB_RE = /\b(web[-_.]?dl|webrip|web|amzn|nf|netflix|dsnp|atvp|hmax|pcok|webios)\b/i;
const BLURAY_RE = /\b(blu[-_.]?ray|bdrip|brrip|remux|bdremux|uhd)\b/i;
const HDTV_RE = /\b(hdtv|pdtv|dsr|tvrip)\b/i;
const DVD_RE = /\b(dvdrip|dvd5|dvd9|rl[-_.]?dvd|dvd)\b/i;

const GENERIC_GROUP_TOKENS = new Set([
  'x264',
  'x265',
  'h264',
  'h265',
  'hevc',
  'avc',
  'xvid',
  'divx',
  '1080p',
  '720p',
  '2160p',
  '480p',
  '4k',
  'uhd',
  'hdr',
  'hdr10',
  'dovi',
  'dv',
  'web',
  'dl',
  'webdl',
  'webrip',
  'bluray',
  'bdrip',
  'brrip',
  'dvdrip',
  'dvd',
  'hdtv',
  'aac',
  'ac3',
  'ddp5',
  'dd5',
  'dts',
  'truehd',
  'atmos',
  'dual',
  'dublado',
  'pt',
  'br',
  'por',
  'pob',
  'eng',
  'hi',
  'srt',
  'mkv',
  'mp4',
  'avi'
]);

const KNOWN_GROUPS = [
  'yify',
  'yts',
  'rarbg',
  'psa',
  'ethel',
  'xebec',
  'drones',
  'evo',
  'galaxyrg',
  'flux',
  'ntb',
  'sparks',
  'amiable',
  'geckos',
  'ctrlhd',
  'schizo',
  'hdwing',
  'bioma',
  'mgb',
  'highcode',
  'fookas',
  'webios'
];

function detectSourceFamily(text: string, formatHint?: string): SourceFamily | undefined {
  const combined = `${text} ${formatHint || ''}`;
  if (SCREENER_RE.test(combined)) return 'screener';
  if (WEB_RE.test(combined)) return 'web';
  if (BLURAY_RE.test(combined)) return 'bluray';
  if (HDTV_RE.test(combined)) return 'hdtv';
  if (DVD_RE.test(combined)) return 'dvd';
  return undefined;
}

function stripMediaExtension(name: string): string {
  return name
    .replace(/\.(mkv|mp4|avi|mov|wmv|flv|webm|m4v|srt|vtt|ass|ssa|sub)$/i, '')
    .replace(/-\[[^\]]+\]$/i, '')
    .trim();
}

function extractReleaseGroup(raw: string): string | undefined {
  const cleaned = stripMediaExtension(raw);
  const lower = cleaned.toLowerCase();

  for (const g of KNOWN_GROUPS) {
    const re = new RegExp(`(?:^|[^a-z0-9])${g}(?:$|[^a-z0-9])`, 'i');
    if (re.test(lower)) return g;
  }

  const hyphenMatch = cleaned.match(/-([A-Za-z0-9]{2,16})$/);
  if (hyphenMatch) {
    const candidate = hyphenMatch[1].toLowerCase();
    if (!GENERIC_GROUP_TOKENS.has(candidate) && !/^\d+$/.test(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function extractResolution(raw: string): string | undefined {
  const m = raw.toLowerCase().match(/\b(2160p|1080p|720p|480p)\b/);
  if (m) return m[1];
  if (/\b(4k|uhd)\b/i.test(raw)) return '2160p';
  return undefined;
}

export function scoreReleaseMatch(
  filename?: string,
  releaseName?: string,
  releaseFormat?: string
): number {
  if (!releaseName && !releaseFormat) return 0;

  const relText = releaseName || '';
  const relSource = detectSourceFamily(relText, releaseFormat);
  const fileSource = filename ? detectSourceFamily(filename) : undefined;

  let delta = 0;

  if (relSource === 'screener' && fileSource !== 'screener') {
    delta -= 30;
  }

  if (!filename) return delta;

  if (fileSource && relSource) {
    if (fileSource === relSource) {
      delta += 22;
    } else {
      delta -= 15;
    }
  }

  const fileGroup = extractReleaseGroup(filename);
  const relGroup = extractReleaseGroup(relText);
  if (fileGroup && relGroup && fileGroup === relGroup) {
    delta += 30;
  }

  const fileRes = extractResolution(filename);
  const relRes = extractResolution(relText);
  if (fileRes && relRes && fileRes === relRes) {
    delta += 6;
  }

  const hdrRe = /\b(hdr|hdr10|dovi|dv)\b/i;
  if (hdrRe.test(filename) && hdrRe.test(relText)) {
    delta += 5;
  }

  const normFile = stripMediaExtension(filename)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const normRel = stripMediaExtension(relText)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  if (normFile && normRel && normFile === normRel && (relSource || relGroup || relRes)) {
    delta += 20;
  }

  return delta;
}

export function summarizeRelease(releaseName?: string): string | undefined {
  if (!releaseName) return undefined;
  const trimmed = releaseName.trim();
  if (!trimmed || /^OSv3\s*#\d+$/i.test(trimmed)) return undefined;

  const res = extractResolution(trimmed);
  let sourceTag: string | undefined;
  if (/\bweb[-_.]?dl\b/i.test(trimmed)) {
    sourceTag = 'WEB-DL';
  } else if (/\bwebrip\b/i.test(trimmed)) {
    sourceTag = 'WEBRip';
  } else {
    const family = detectSourceFamily(trimmed);
    if (family === 'web') sourceTag = 'WEB';
    else if (family === 'bluray') sourceTag = 'BluRay';
    else if (family === 'hdtv') sourceTag = 'HDTV';
    else if (family === 'dvd') sourceTag = 'DVDRip';
    else if (family === 'screener') sourceTag = 'CAM/SCR';
  }

  const group = extractReleaseGroup(trimmed)?.toUpperCase();
  const base = [res, sourceTag].filter(Boolean).join(' ');
  if (base && group) return `${base}-${group}`;
  if (base) return base;
  if (group) return group;

  const cleaned = stripMediaExtension(trimmed).replace(/[._]+/g, ' ').trim();
  if (!cleaned) return undefined;
  return cleaned.length > 24 ? `${cleaned.slice(0, 22).trim()}…` : cleaned;
}
