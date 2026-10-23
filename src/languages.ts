export interface LanguageEntry {
  iso639_2: string; // Stremio standard (e.g. 'eng', 'spa', 'fre', 'pob')
  iso639_1: string; // 2-letter / BCP-47 code (e.g. 'en', 'es', 'fr', 'pt-BR')
  subdlCode: string; // SubDL language code
  name: string;
}

export const LANGUAGES: LanguageEntry[] = [
  { iso639_2: 'eng', iso639_1: 'en', subdlCode: 'EN', name: 'English' },
  { iso639_2: 'spa', iso639_1: 'es', subdlCode: 'ES', name: 'Spanish' },
  { iso639_2: 'fre', iso639_1: 'fr', subdlCode: 'FR', name: 'French' },
  { iso639_2: 'ger', iso639_1: 'de', subdlCode: 'DE', name: 'German' },
  { iso639_2: 'ita', iso639_1: 'it', subdlCode: 'IT', name: 'Italian' },
  { iso639_2: 'por', iso639_1: 'pt', subdlCode: 'PT', name: 'Portuguese' },
  { iso639_2: 'pob', iso639_1: 'pb', subdlCode: 'BR_PT', name: 'Portuguese (Brazil)' },
  { iso639_2: 'rus', iso639_1: 'ru', subdlCode: 'RU', name: 'Russian' },
  { iso639_2: 'jpn', iso639_1: 'ja', subdlCode: 'JA', name: 'Japanese' },
  { iso639_2: 'kor', iso639_1: 'ko', subdlCode: 'KO', name: 'Korean' },
  { iso639_2: 'zho', iso639_1: 'zh', subdlCode: 'ZH', name: 'Chinese (Simplified)' },
  { iso639_2: 'ara', iso639_1: 'ar', subdlCode: 'AR', name: 'Arabic' },
  { iso639_2: 'hin', iso639_1: 'hi', subdlCode: 'HI', name: 'Hindi' },
  { iso639_2: 'tur', iso639_1: 'tr', subdlCode: 'TR', name: 'Turkish' },
  { iso639_2: 'pol', iso639_1: 'pl', subdlCode: 'PL', name: 'Polish' },
  { iso639_2: 'nld', iso639_1: 'nl', subdlCode: 'NL', name: 'Dutch' },
  { iso639_2: 'swe', iso639_1: 'sv', subdlCode: 'SV', name: 'Swedish' },
  { iso639_2: 'nor', iso639_1: 'no', subdlCode: 'NO', name: 'Norwegian' },
  { iso639_2: 'dan', iso639_1: 'da', subdlCode: 'DA', name: 'Danish' },
  { iso639_2: 'fin', iso639_1: 'fi', subdlCode: 'FI', name: 'Finnish' },
  { iso639_2: 'ell', iso639_1: 'el', subdlCode: 'EL', name: 'Greek' },
  { iso639_2: 'heb', iso639_1: 'he', subdlCode: 'HE', name: 'Hebrew' },
  { iso639_2: 'tha', iso639_1: 'th', subdlCode: 'TH', name: 'Thai' },
  { iso639_2: 'vie', iso639_1: 'vi', subdlCode: 'VI', name: 'Vietnamese' },
  { iso639_2: 'ind', iso639_1: 'id', subdlCode: 'ID', name: 'Indonesian' },
  { iso639_2: 'ces', iso639_1: 'cs', subdlCode: 'CS', name: 'Czech' },
  { iso639_2: 'hun', iso639_1: 'hu', subdlCode: 'HU', name: 'Hungarian' },
  { iso639_2: 'ron', iso639_1: 'ro', subdlCode: 'RO', name: 'Romanian' },
  { iso639_2: 'ukr', iso639_1: 'uk', subdlCode: 'UK', name: 'Ukrainian' },
  { iso639_2: 'bul', iso639_1: 'bg', subdlCode: 'BG', name: 'Bulgarian' },
  { iso639_2: 'hrv', iso639_1: 'hr', subdlCode: 'HR', name: 'Croatian' },
  { iso639_2: 'srp', iso639_1: 'sr', subdlCode: 'SR', name: 'Serbian' },
  { iso639_2: 'slk', iso639_1: 'sk', subdlCode: 'SK', name: 'Slovak' },
  { iso639_2: 'slv', iso639_1: 'sl', subdlCode: 'SL', name: 'Slovenian' }
];

const BY_ISO2 = new Map<string, LanguageEntry>();
const BY_ISO1 = new Map<string, LanguageEntry>();
const BY_NAME = new Map<string, LanguageEntry>();

for (const entry of LANGUAGES) {
  BY_ISO2.set(entry.iso639_2.toLowerCase(), entry);
  BY_ISO1.set(entry.iso639_1.toLowerCase(), entry);
  BY_NAME.set(entry.name.toLowerCase(), entry);
}

// Aliases for ISO 639-2/T vs 639-2/B and regional variants
const ISO2_ALIASES: Record<string, string> = {
  fra: 'fre',
  deu: 'ger',
  nld: 'nld',
  dut: 'nld',
  zho: 'zho',
  chi: 'zho',
  ces: 'ces',
  cze: 'ces',
  ell: 'ell',
  gre: 'ell',
  ron: 'ron',
  rum: 'ron',
  slk: 'slk',
  slo: 'slk',
   'pt-br': 'pob',
  'pt_br': 'pob',
  pb: 'pob',
  'zh-cn': 'zho',
  'zh-tw': 'zho',
  'es-la': 'spa',
  'es-es': 'spa'
};

export function toIso639_2(codeOrName: string): string {
  const clean = codeOrName.trim().toLowerCase();
  if (ISO2_ALIASES[clean]) {
    return ISO2_ALIASES[clean];
  }
  const by2 = BY_ISO2.get(clean);
  if (by2) return by2.iso639_2;
  const by1 = BY_ISO1.get(clean);
  if (by1) return by1.iso639_2;
  if (clean.includes('-')) {
    const base = clean.split('-')[0];
    const byBase = BY_ISO1.get(base);
    if (byBase) return byBase.iso639_2;
  }
  const byName = BY_NAME.get(clean);
  if (byName) return byName.iso639_2;
  return clean.length === 3 ? clean : 'eng';
}

export function toIso639_1(iso639_2: string): string {
  const norm = toIso639_2(iso639_2);
  return BY_ISO2.get(norm)?.iso639_1 ?? 'en';
}

export function toSubdlCode(iso639_2: string): string {
  const norm = toIso639_2(iso639_2);
  return BY_ISO2.get(norm)?.subdlCode ?? 'EN';
}

export function getLanguageName(code: string): string {
  const norm = toIso639_2(code);
  return BY_ISO2.get(norm)?.name ?? code;
}
