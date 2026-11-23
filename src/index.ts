import 'dotenv/config';
import { createApp, createStatsApp } from './app';
import { metrics } from './metrics';

const port = Number(process.env.PORT) || 7000;
const statsPort = Number(process.env.STATS_PORT) || 7001;
const app = createApp();
const statsApp = createStatsApp();

app.listen(port, '0.0.0.0', () => {
  console.log(`Stremio Multimodal Subtitles Add-on listening on http://localhost:${port}`);
  console.log(`Manifest URL: http://localhost:${port}/manifest.json`);
  console.log(`Configure URL: http://localhost:${port}/configure`);
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
