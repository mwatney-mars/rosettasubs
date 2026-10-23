import 'dotenv/config';
import { createApp } from './app';

const port = Number(process.env.PORT) || 7000;
const app = createApp();

app.listen(port, '0.0.0.0', () => {
  console.log(`Stremio Multimodal Subtitles Add-on listening on http://localhost:${port}`);
  console.log(`Manifest URL: http://localhost:${port}/manifest.json`);
  console.log(`Configure URL: http://localhost:${port}/configure`);
});
