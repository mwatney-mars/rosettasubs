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
}

export function buildManifest(config: AddonConfig): StremioManifest {
  const langNames = config.languages.map((l) => getLanguageName(l)).join(', ');
  const providerList = config.providers.map((p) => p.toUpperCase()).join(' + ');
  const aiLabel =
    config.aiMode === 'off'
      ? 'AI Off'
      : `AI ${config.aiProvider.toUpperCase()} (${config.aiMode})`;

  return {
    id: 'org.stremio.multimodal.subtitles',
    version: '1.0.0',
    name: 'Multimodal Subtitles',
    description: `Multi-provider subtitles (${providerList}) + Multimodal AI translation & transcription [${aiLabel}]. Active languages: ${langNames}.`,
    resources: ['subtitles'],
    types: ['movie', 'series'],
    idPrefixes: ['tt'],
    catalogs: [],
    behaviorHints: {
      configurable: true,
      configurationRequired: false
    }
  };
}
