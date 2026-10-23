# RosettaSubs — Stremio Multimodal Subtitles Add-on

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/mwatney-mars/rosettasubs)

A TypeScript + Express Stremio Subtitles Add-on combining **multi-provider aggregation** (**Wyzie Subs**, **OpenSubtitles REST API v1**, **SubDL**) with **Multimodal AI fallback translation & audio/video transcription** (**Google Gemini** & **OpenAI-compatible** APIs).

## Features

- **Multi-Provider Parallel Aggregation**: Queries Wyzie Subs (no key required), OpenSubtitles v1 (with exact `moviehash` matching and lazy download resolution), and SubDL in parallel.
- **Multimodal AI Fallback & Translation**:
  - Automatically generates on-the-fly AI translation tracks when a configured language is missing from upstream providers (or always, if configured).
  - Preserves exact `.srt` cue timestamps while translating dialogue in concurrent batches.
  - Exposes `POST /api/multimodal/transcribe` for direct audio/video-to-SRT transcription and translation via Gemini.
- **Subtitle Proxy & Encoding/Format Normalization**:
  - Automatically detects and converts `UTF-16LE/BE`, `Windows-1252` / `Latin1`, and `UTF-8 BOM` to clean `UTF-8`.
  - Converts `.vtt` (WebVTT), `.ass`/`.ssa` (SubStation Alpha), `.sub` (MicroDVD), and `.zip` archives into standard `.srt` on the fly.
- **In-Memory LRU + TTL Caching**: Caches provider search results, normalized `.srt` files, and AI translations.
- **User Configuration UI (`/configure`)**: Interactive configuration page that encodes preferences into a stateless URL token (`/:config/manifest.json`).

## Quick Start

```bash
npm install
npm run dev
```

- **Configure UI**: `http://localhost:7000/configure`
- **Default Manifest**: `http://localhost:7000/manifest.json`
- **Health & Cache Stats**: `http://localhost:7000/health`

## Docker

```bash
cp .env.example .env
docker compose up --build -d
```
