import { AddonConfig } from './types';
import { getLanguageName } from './languages';

export interface StremioManifest {
  id: string;
  version: string;
  name: string;
  description: string;
  logo?: string;
  resources: string[];
  types: string[];
  idPrefixes: string[];
  catalogs: never[];
  behaviorHints: {
    configurable: boolean;
    configurationRequired: boolean;
  };
  stremioAddonsConfig: {
    issuer: string;
    signature: string;
  };
}

export function buildManifest(
  config: AddonConfig,
  isConfigured = false,
  baseUrl?: string
): StremioManifest {
  const baseDescription =
    'Subtitles in 30+ languages from OpenSubtitles, SubDL, and Wyzie — with dual-language immersion tracks and instant AI translation when subtitles are missing in your language.';
  const langNames = config.languages.map((l) => getLanguageName(l)).join(', ');
  const dualSuffix = config.dualSubtitles
    ? ` Dual-language immersion enabled (${getLanguageName(config.dualSubtitlesNativeLang || 'eng')} reference).`
    : '';
  const description = isConfigured
    ? `${baseDescription} Configured for: ${langNames}.${dualSuffix}`
    : baseDescription;
  const cleanBase = baseUrl ? baseUrl.replace(/\/+$/, '') : '';

  return {
    id: 'org.stremio.rosettasubs',
    version: '1.0.0',
    name: 'RosettaSubs',
    description,
    logo: `${cleanBase}/logo.svg`,
    resources: ['subtitles'],
    types: ['movie', 'series'],
    idPrefixes: ['tt'],
    catalogs: [],
    behaviorHints: {
      configurable: true,
      configurationRequired: false
    },
    stremioAddonsConfig: {
      issuer: 'https://stremio-addons.net',
      signature:
        'eyJhbGciOiJkaXIiLCJlbmMiOiJBMTI4Q0JDLUhTMjU2In0..c1EvV0j__vjhcVCfSbF67A.NfDS5NmCGwYra8f-DwjUcRFZozVFZko0n7xjWRM9DWT9k4jliP6nSwBsKZ8UNv4FwbIJyFliAnOuOIYuEkiFP5pxvOnaxMIKtiENKW_P9DfTyWrMpVLoBw1QBBqwjVD7.4aj1-S1kTkO70CFR3sVYfw'
    }
  };
}
