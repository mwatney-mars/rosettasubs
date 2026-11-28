import 'dotenv/config';
import dns from 'dns';
import { createApp, createStatsApp } from './app';

dns.setDefaultResultOrder('ipv4first');
import { getDefaultConfig } from './config';
import { metrics } from './metrics';
import { fetchRawSubtitles, parseStremioSubtitleRequest } from './providers';

const port = Number(process.env.PORT) || 7000;
const statsPort = Number(process.env.STATS_PORT) || 7001;
const app = createApp();
const statsApp = createStatsApp();

const WARMUP_TARGETS: Array<[string, string]> = [
  ['movie', 'tt0111161'],
  ['movie', 'tt0133093'],
  ['movie', 'tt0468569'],
  ['movie', 'tt1375666'],
  ['movie', 'tt15398776'],
  ['movie', 'tt1392170'],
  ['movie', 'tt4154796'],
  ['series', 'tt0108778:1:1'],
  ['series', 'tt0903747:1:1'],
  ['series', 'tt0944947:1:1'],
  ['series', 'tt4574334:1:1']
];

async function warmupPopularCache() {
  if (process.env.REDIRECT_TO_URL || process.env.RENDER === 'true') return;
  const cfg = getDefaultConfig();
  await Promise.allSettled(
    WARMUP_TARGETS.map(([type, id]) =>
      fetchRawSubtitles(parseStremioSubtitleRequest(type, id, undefined, cfg.languages), cfg)
    )
  );
}

app.listen(port, '0.0.0.0', () => {
  console.log(`Stremio Multimodal Subtitles Add-on listening on http://localhost:${port}`);
  console.log(`Manifest URL: http://localhost:${port}/manifest.json`);
  console.log(`Configure URL: http://localhost:${port}/configure`);
  void warmupPopularCache();
});

statsApp.listen(statsPort, '0.0.0.0', () => {
  console.log(`Private Observability Dashboard listening on http://localhost:${statsPort}`);
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    metrics.flushToDisk();
    process.exit(0);
  });
}
