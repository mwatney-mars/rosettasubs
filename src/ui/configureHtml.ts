import { AddonConfig } from '../types';
import { LANGUAGES } from '../languages';

export function renderConfigurePage(config: AddonConfig, baseUrl: string): string {
  const initialConfigJson = JSON.stringify(config).replace(/</g, '\\u003c');
  const languagesJson = JSON.stringify(LANGUAGES).replace(/</g, '\\u003c');
  const supportUrl =
    process.env.SUPPORT_URL || 'https://github.com/sponsors/mwatney-mars';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="icon" type="image/svg+xml" href="/logo.svg" />
  <title>RosettaSubs — Stremio Subtitles Configuration</title>
  <style>
    :root {
      --bg-deep: #0f0f10;
      --bg: #141415;
      --card: #19191b;
      --raised: #232325;
      --hairline: rgba(237, 237, 237, 0.08);
      --hairline-strong: rgba(237, 237, 237, 0.16);
      --text: #ededed;
      --text-secondary: #a1a1a6;
      --muted: #85858b;
      --accent: #e5a93c;
      --positive: #4cc38a;
      --ease: cubic-bezier(0.22, 1, 0.36, 1);
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      min-height: 100vh;
      padding: 0 24px 64px;
      font-size: 14px;
      line-height: 20px;
      font-weight: 400;
      -webkit-font-smoothing: antialiased;
    }

    .shell {
      max-width: 1120px;
      margin: 0 auto;
    }

    /* Top Bar */
    .topbar {
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--hairline);
      margin-bottom: 48px;
    }

    .brand {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      color: var(--text);
      text-decoration: none;
    }

    .brand img {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      display: block;
    }

    .brand-name {
      font-size: 16px;
      line-height: 16px;
      font-weight: 500;
      color: var(--text);
    }

    .topbar-meta {
      display: flex;
      align-items: center;
      gap: 16px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      line-height: 16px;
      color: var(--muted);
    }

    .topbar-link {
      color: var(--text-secondary);
      text-decoration: none;
      font-family: Inter, -apple-system, sans-serif;
      font-size: 13px;
      transition: color 150ms var(--ease);
    }

    .topbar-link:hover {
      color: var(--text);
    }

    /* Split Hero */
    header.hero {
      display: grid;
      grid-template-columns: 1fr 1.15fr;
      gap: 48px;
      align-items: center;
      margin-bottom: 64px;
    }

    @media (max-width: 860px) {
      header.hero {
        grid-template-columns: 1fr;
        gap: 32px;
        margin-bottom: 48px;
      }
    }

    .hero-copy h1 {
      margin: 0 0 16px;
      font-size: 40px;
      line-height: 44px;
      font-weight: 500;
      letter-spacing: -0.02em;
      color: var(--text);
    }

    .hero-copy p.subtitle {
      margin: 0 0 24px;
      max-width: 480px;
      font-size: 16px;
      line-height: 24px;
      color: var(--text-secondary);
    }

    .hero-specs {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      line-height: 16px;
      color: var(--muted);
    }

    .hero-spec-item {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .spec-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--accent);
    }

    /* Cinema Subtitle Bench Preview (The Moment) */
    .cinema-stage {
      background: var(--bg-deep);
      border: 1px solid var(--hairline);
      border-radius: 16px;
      padding: 16px;
    }

    .cinema-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      line-height: 16px;
      color: var(--muted);
      font-variant-numeric: tabular-nums;
    }

    .cinema-screen {
      position: relative;
      height: 208px;
      border-radius: 8px;
      background:
        linear-gradient(180deg, rgba(15, 15, 16, 0.2) 0%, rgba(15, 15, 16, 0.92) 100%),
        repeating-linear-gradient(90deg, #18181b 0px, #18181b 1px, #131315 1px, #131315 24px);
      border: 1px solid var(--hairline);
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      align-items: center;
      padding: 24px;
      text-align: center;
    }

    .cinema-scene-meta {
      position: absolute;
      top: 16px;
      left: 16px;
      right: 16px;
      display: flex;
      justify-content: space-between;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      line-height: 16px;
      color: var(--muted);
      font-variant-numeric: tabular-nums;
    }

    .cinema-cue-box {
      background: rgba(15, 15, 16, 0.88);
      border: 1px solid var(--hairline);
      border-radius: 8px;
      padding: 12px 20px;
      max-width: 100%;
    }

    .cinema-line-primary {
      font-size: 16px;
      line-height: 24px;
      font-weight: 500;
      color: var(--text);
    }

    .cinema-line-note {
      color: var(--accent);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      margin-left: 8px;
      font-weight: 400;
    }

    .cinema-line-secondary {
      margin-top: 4px;
      font-size: 14px;
      line-height: 20px;
      color: var(--accent);
    }

    /* Main 2-Column Layout */
    .workspace {
      display: grid;
      grid-template-columns: 1fr 360px;
      gap: 24px;
      align-items: start;
    }

    @media (max-width: 920px) {
      .workspace {
        grid-template-columns: 1fr;
      }
    }

    .steps-col {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    /* Section Cards */
    .card {
      background: var(--card);
      border: 1px solid var(--hairline);
      border-radius: 16px;
      padding: 24px;
      transition: border-color 150ms var(--ease);
    }

    .card-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .step-title {
      display: flex;
      align-items: baseline;
      gap: 12px;
      margin: 0 0 4px;
      font-size: 16px;
      line-height: 24px;
      font-weight: 500;
      color: var(--text);
    }

    .step-num {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      line-height: 16px;
      font-weight: 400;
      color: var(--muted);
      font-variant-numeric: tabular-nums;
    }

    .card p.hint {
      margin: 0;
      color: var(--text-secondary);
      font-size: 13px;
      line-height: 20px;
    }

    .badge-count {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      line-height: 16px;
      color: var(--muted);
      font-variant-numeric: tabular-nums;
    }

    /* Language Selector */
    .selected-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      height: 28px;
      gap: 8px;
      padding: 0 10px;
      border-radius: 6px;
      background: var(--raised);
      border: 1px solid var(--hairline);
      color: var(--text);
      font-size: 13px;
      line-height: 20px;
    }

    .chip button {
      background: none;
      border: none;
      color: var(--muted);
      cursor: pointer;
      padding: 0;
      font-size: 14px;
      line-height: 1;
      display: inline-flex;
      align-items: center;
      transition: color 120ms var(--ease);
    }

    .chip button:hover {
      color: var(--text);
    }

    .lang-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(188px, 1fr));
      gap: 8px;
      max-height: 296px;
      overflow-y: auto;
      padding-right: 4px;
      scrollbar-width: thin;
      scrollbar-color: var(--raised) transparent;
    }

    .pill {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 36px;
      gap: 8px;
      padding: 0 12px;
      background: var(--bg);
      border: 1px solid var(--hairline);
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      line-height: 20px;
      color: var(--text-secondary);
      user-select: none;
      transition: background-color 120ms var(--ease), border-color 120ms var(--ease), color 120ms var(--ease);
    }

    .pill:hover {
      border-color: var(--hairline-strong);
      color: var(--text);
    }

    .pill.active {
      background: var(--raised);
      border-color: var(--hairline-strong);
      color: var(--text);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
    }

    .pill-left {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .pill input[type="checkbox"] {
      accent-color: var(--accent);
      width: 14px;
      height: 14px;
      margin: 0;
      cursor: pointer;
      flex-shrink: 0;
    }

    .pill-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 400;
    }

    .pill.active .pill-name {
      font-weight: 500;
    }

    .pill-code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      line-height: 16px;
      color: var(--muted);
      flex-shrink: 0;
    }

    /* Provider Cards */
    .provider-stack {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .provider-card {
      background: var(--bg);
      border: 1px solid var(--hairline);
      border-radius: 8px;
      padding: 16px;
      transition: border-color 150ms var(--ease), background-color 150ms var(--ease);
    }

    .provider-card.active {
      background: var(--raised);
      border-color: var(--hairline-strong);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
    }

    .provider-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .provider-label {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      font-weight: 500;
      font-size: 14px;
      line-height: 20px;
      color: var(--text);
    }

    .provider-label input[type="checkbox"] {
      accent-color: var(--accent);
      width: 16px;
      height: 16px;
      margin: 0;
      cursor: pointer;
    }

    .tag {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      line-height: 16px;
      color: var(--muted);
    }

    .tag-free {
      color: var(--positive);
    }

    .ext-link {
      font-size: 13px;
      line-height: 20px;
      color: var(--text-secondary);
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: color 120ms var(--ease);
    }

    .ext-link:hover {
      color: var(--text);
    }

    .provider-desc {
      margin: 8px 0 0;
      color: var(--text-secondary);
      font-size: 13px;
      line-height: 20px;
    }

    .provider-key-row {
      margin-top: 12px;
      position: relative;
      display: flex;
      align-items: center;
    }

    /* Form Controls */
    .field-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-top: 16px;
    }

    @media (max-width: 640px) {
      .field-grid {
        grid-template-columns: 1fr;
      }
    }

    label.field {
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 13px;
      line-height: 20px;
      font-weight: 400;
      color: var(--text-secondary);
    }

    .field-label-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .input-with-toggle {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
    }

    input[type="text"],
    input[type="password"],
    select {
      width: 100%;
      height: 36px;
      background: var(--bg-deep);
      border: 1px solid var(--hairline);
      color: var(--text);
      padding: 0 12px;
      border-radius: 8px;
      font-family: inherit;
      font-size: 13px;
      line-height: 20px;
      outline: none;
      transition: border-color 120ms var(--ease);
    }

    .input-with-toggle input {
      padding-right: 56px;
    }

    input[type="text"]:focus,
    input[type="password"]:focus,
    select:focus {
      border-color: var(--accent);
    }

    .eye-btn {
      position: absolute;
      right: 6px;
      height: 24px;
      background: var(--raised);
      border: 1px solid var(--hairline);
      color: var(--text-secondary);
      border-radius: 4px;
      padding: 0 8px;
      font-size: 12px;
      line-height: 16px;
      font-weight: 400;
      cursor: pointer;
      transition: color 120ms var(--ease);
    }

    .eye-btn:hover {
      color: var(--text);
    }

    .ai-details {
      transition: opacity 150ms var(--ease);
    }

    .ai-details.disabled {
      opacity: 0.4;
    }

    /* Switch rows */
    .switch-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    @media (max-width: 640px) {
      .switch-grid {
        grid-template-columns: 1fr;
      }
    }

    .switch-card {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      background: var(--bg);
      border: 1px solid var(--hairline);
      border-radius: 8px;
      cursor: pointer;
      transition: border-color 120ms var(--ease), background-color 120ms var(--ease);
    }

    .switch-card:hover {
      border-color: var(--hairline-strong);
    }

    .switch-card input[type="checkbox"] {
      accent-color: var(--accent);
      width: 16px;
      height: 16px;
      margin: 2px 0 0;
      cursor: pointer;
      flex-shrink: 0;
    }

    .switch-title {
      font-size: 14px;
      line-height: 20px;
      font-weight: 500;
      color: var(--text);
      margin-bottom: 4px;
    }

    .switch-sub {
      font-size: 13px;
      line-height: 20px;
      color: var(--text-secondary);
    }

    /* Sticky Install Panel */
    .install-card {
      position: sticky;
      top: 24px;
      background: var(--card);
      border: 1px solid var(--hairline-strong);
    }

    .summary-bar {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px 0;
      border-top: 1px solid var(--hairline);
      border-bottom: 1px solid var(--hairline);
      margin-bottom: 16px;
    }

    .summary-item {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      font-size: 13px;
      line-height: 20px;
      color: var(--text-secondary);
    }

    .summary-item strong {
      color: var(--text);
      font-weight: 500;
      text-align: right;
    }

    .url-box {
      background: var(--bg-deep);
      border: 1px solid var(--hairline);
      padding: 12px;
      border-radius: 8px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      line-height: 16px;
      word-break: break-all;
      color: var(--text-secondary);
      margin-bottom: 16px;
      max-height: 72px;
      overflow-y: auto;
    }

    .actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 44px;
      gap: 8px;
      padding: 0 16px;
      border-radius: 8px;
      font-weight: 500;
      font-size: 14px;
      line-height: 20px;
      text-decoration: none;
      cursor: pointer;
      border: 1px solid transparent;
      transition: background-color 120ms var(--ease), border-color 120ms var(--ease), transform 120ms var(--ease);
    }

    .btn:active {
      transform: scale(0.98);
    }

    .btn-primary {
      background: var(--text);
      color: var(--bg);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
    }

    .btn-primary:hover {
      background: #ffffff;
    }

    .btn-secondary {
      height: 36px;
      background: var(--raised);
      border-color: var(--hairline);
      color: var(--text);
      font-size: 13px;
    }

    .btn-secondary:hover {
      border-color: var(--hairline-strong);
    }

    .coffee-footer {
      margin-top: 48px;
      padding-top: 24px;
      border-top: 1px solid var(--hairline);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
      color: var(--muted);
      font-size: 13px;
      line-height: 20px;
    }

    .coffee-btn {
      display: inline-flex;
      align-items: center;
      height: 32px;
      gap: 8px;
      padding: 0 12px;
      border-radius: 6px;
      background: var(--card);
      border: 1px solid var(--hairline);
      color: var(--text-secondary);
      font-weight: 400;
      font-size: 13px;
      text-decoration: none;
      transition: border-color 120ms var(--ease), color 120ms var(--ease);
    }

    .coffee-btn:hover {
      border-color: var(--hairline-strong);
      color: var(--text);
    }
  </style>
</head>
<body>
  <div class="shell">
    <nav class="topbar">
      <div class="hero-title-row brand">
        <img class="hero-logo" src="/logo.svg" alt="RosettaSubs Logo" width="28" height="28" />
        <span class="brand-name">RosettaSubs</span>
      </div>
      <div class="topbar-meta">
        <span>org.stremio.rosettasubs • v1.1.3</span>
        <a class="topbar-link" href="${supportUrl}" target="_blank" rel="noopener noreferrer">Sponsor</a>
      </div>
    </nav>

    <header class="hero">
      <div class="hero-copy">
        <h1>Subtitles for every release, in one track or two</h1>
        <p class="subtitle">Subtitles in 30+ languages from OpenSubtitles, SubDL, and Wyzie — with dual-language immersion tracks and instant AI translation when subtitles are missing in your language</p>
        <div class="hero-specs">
          <span class="hero-spec-item"><span class="spec-dot"></span>MovieHash sync</span>
          <span class="hero-spec-item">UTF-8 SubRip normalization</span>
          <span class="hero-spec-item">Dual-language cue alignment</span>
        </div>
      </div>

      <div class="cinema-stage" aria-label="Subtitle cue preview">
        <div class="cinema-bar">
          <span id="previewTrackLabel">JA + EN • Dual track</span>
          <span>00:42:18,400 --&gt; 00:42:21,150</span>
        </div>
        <div class="cinema-screen">
          <div class="cinema-scene-meta">
            <span>23.976 fps • UTF-8 SRT</span>
            <span id="previewModeBadge">Dual immersion</span>
          </div>
          <div class="cinema-cue-box">
            <div class="cinema-line-primary">
              <span id="previewPrimaryText">目が覚めたか、ネオ</span><span id="previewIdiomNote" class="cinema-line-note">[目が覚める: wake up to reality]</span>
            </div>
            <div id="previewSecondaryText" class="cinema-line-secondary">Wake up, Neo</div>
          </div>
        </div>
      </div>
    </header>

    <div class="workspace">
      <div class="steps-col">
        <!-- STEP 1: LANGUAGES -->
        <div class="card">
          <div class="card-header">
            <div>
              <h2 class="step-title"><span class="step-num">01</span> Subtitle languages</h2>
              <p class="hint">Select the languages to list in Stremio's player menu</p>
            </div>
            <span id="langCountBadge" class="badge-count">1 selected</span>
          </div>

          <div id="selectedChips" class="selected-chips"></div>
          <div id="langGrid" class="lang-grid"></div>
        </div>

        <!-- STEP 2: PROVIDERS -->
        <div class="card">
          <div class="card-header">
            <div>
              <h2 class="step-title"><span class="step-num">02</span> Subtitle sources</h2>
              <p class="hint">Queried in parallel and ranked by video hash and release group</p>
            </div>
          </div>

          <div class="provider-stack">
            <div id="cardWyzie" class="provider-card">
              <div class="provider-top">
                <label class="provider-label">
                  <input type="checkbox" id="provWyzie" />
                  <span>Wyzie &amp; Stremio OpenSubtitles v3</span>
                </label>
                <span class="tag tag-free">No key required</span>
              </div>
              <p class="provider-desc">Zero-config lookup across Wyzie archives and Stremio's OpenSubtitles v3 mirror</p>
            </div>

            <div id="cardOs" class="provider-card">
              <div class="provider-top">
                <label class="provider-label">
                  <input type="checkbox" id="provOs" />
                  <span>OpenSubtitles REST API v1</span>
                </label>
                <div style="display:flex;align-items:center;gap:12px;">
                  <span class="tag">Optional key</span>
                  <a class="ext-link" href="https://www.opensubtitles.com/en/consumers" target="_blank" rel="noopener noreferrer">Get key &nearr;</a>
                </div>
              </div>
              <p class="provider-desc">Direct OpenSubtitles.com REST queries with exact video hash matching</p>
              <div class="provider-key-row">
                <div class="input-with-toggle">
                  <input type="password" id="osKey" placeholder="OpenSubtitles API key" autocomplete="off" />
                  <button type="button" class="eye-btn" data-target="osKey">Show</button>
                </div>
              </div>
            </div>

            <div id="cardSubdl" class="provider-card">
              <div class="provider-top">
                <label class="provider-label">
                  <input type="checkbox" id="provSubdl" />
                  <span>SubDL API</span>
                </label>
                <div style="display:flex;align-items:center;gap:12px;">
                  <span class="tag">Optional key</span>
                  <a class="ext-link" href="https://subdl.com/panel/api" target="_blank" rel="noopener noreferrer">Get key &nearr;</a>
                </div>
              </div>
              <p class="provider-desc">Movie and TV season pack archive with automatic ZIP episode extraction</p>
              <div class="provider-key-row">
                <div class="input-with-toggle">
                  <input type="password" id="subdlKey" placeholder="SubDL API key" autocomplete="off" />
                  <button type="button" class="eye-btn" data-target="subdlKey">Show</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- STEP 3: MULTIMODAL AI -->
        <div class="card">
          <div class="card-header">
            <div>
              <h2 class="step-title"><span class="step-num">03</span> AI translation fallback</h2>
              <p class="hint">Works out of the box when your language is missing — add an optional API key for higher-quality LLM translation</p>
            </div>
          </div>

          <div class="field-grid">
            <label class="field">
              <span>Translation trigger</span>
              <select id="aiMode">
                <option value="fallback">Fallback only when native subtitles are missing</option>
                <option value="always">Always include an AI-translated track</option>
                <option value="off">Off</option>
              </select>
            </label>

            <label class="field">
              <span>AI provider (optional upgrade)</span>
              <select id="aiProvider">
                <option value="gemini">Google Gemini</option>
                <option value="openai">OpenAI compatible</option>
              </select>
            </label>
          </div>

          <div id="aiDetails" class="field-grid ai-details">
            <label class="field">
              <div class="field-label-row">
                <span>Provider API key (optional)</span>
                <a id="aiKeyHelpLink" class="ext-link" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Get Gemini key &nearr;</a>
              </div>
              <div class="input-with-toggle">
                <input type="password" id="aiApiKey" placeholder="Optional — leave blank for built-in translation" autocomplete="off" />
                <button type="button" class="eye-btn" data-target="aiApiKey">Show</button>
              </div>
            </label>

            <label class="field">
              <span>Model override</span>
              <input type="text" id="aiModel" placeholder="gemini-2.5-flash" />
            </label>
          </div>
        </div>

        <!-- STEP 4: PLAYBACK & FORMATTING -->
        <div class="card">
          <div class="card-header">
            <div>
              <h2 class="step-title"><span class="step-num">04</span> Formatting &amp; immersion</h2>
              <p class="hint">Encoding normalization, hearing-impaired filtering, and dual-language cue stacking</p>
            </div>
          </div>

          <div class="switch-grid">
            <label class="switch-card">
              <input type="checkbox" id="proxySubtitles" />
              <div>
                <div class="switch-title">Normalize to UTF-8 SRT</div>
                <div class="switch-sub">Converts legacy encodings and VTT, ASS, or ZIP archives into UTF-8 SubRip</div>
              </div>
            </label>

            <label class="switch-card">
              <input type="checkbox" id="includeHi" />
              <div>
                <div class="switch-title">Include hearing impaired</div>
                <div class="switch-sub">Keep tracks with sound descriptions and speaker labels</div>
              </div>
            </label>

            <label class="switch-card">
              <input type="checkbox" id="dualSubtitles" />
              <div>
                <div class="switch-title">Dual-language immersion</div>
                <div class="switch-sub">Stacks target language on top with your reference language below</div>
              </div>
            </label>

            <label class="switch-card">
              <input type="checkbox" id="dualSubtitlesAnnotate" />
              <div>
                <div class="switch-title">Inline B2/C1 idiom notes</div>
                <div class="switch-sub">Appends brief bracketed meanings for non-literal slang on dual tracks</div>
              </div>
            </label>
          </div>

          <div id="dualDetails" class="field-grid ai-details">
            <label class="field">
              <span>Reference language (bottom line)</span>
              <select id="dualSubtitlesNativeLang"></select>
            </label>
          </div>
        </div>
      </div>

      <!-- STEP 5: INSTALL -->
      <div class="card install-card">
        <div class="card-header" style="margin-bottom:12px;">
          <div>
            <h2 class="step-title"><span class="step-num">05</span> Install add-on</h2>
            <p class="hint">Stateless manifest URL encoded with your settings</p>
          </div>
        </div>

        <div id="summaryBar" class="summary-bar"></div>
        <div id="manifestUrlBox" class="url-box"></div>

        <div class="actions">
          <a id="installBtn" class="btn btn-primary" href="#">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            <span>Install in Stremio</span>
          </a>
          <a id="webInstallBtn" class="btn btn-secondary" href="#" target="_blank" rel="noopener noreferrer">Open in Stremio Web</a>
          <button id="copyBtn" class="btn btn-secondary" type="button">Copy manifest URL</button>
        </div>
      </div>
    </div>

    <footer class="coffee-footer">
      <span>RosettaSubs • Open-source Stremio subtitle add-on</span>
      <a class="coffee-btn" href="${supportUrl}" target="_blank" rel="noopener noreferrer">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 8h1a4 4 0 1 1 0 8h-1"></path>
          <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"></path>
        </svg>
        <span>Support development</span>
      </a>
    </footer>
  </div>

  <script>
    const INITIAL_CONFIG = ${initialConfigJson};
    const LANGUAGES = ${languagesJson};
    const BASE_URL = ${JSON.stringify(baseUrl.replace(/\/+$/, ''))} || window.location.origin;

    const SAMPLE_LINES = {
      jpn: { text: '目が覚めたか、ネオ', note: '[目が覚める: wake up to reality]' },
      spa: { text: 'No manches, despierta ya', note: '[no manches: no way]' },
      fre: { text: 'Tu racontes des salades, Néo', note: '[raconter des salades: spin tales]' },
      ger: { text: 'Mach mir nichts vor, Neo', note: '[vormachen: fool someone]' },
      pob: { text: 'Acorda pra vida, Neo', note: '[acordar pra vida: get real]' },
      por: { text: 'Acorda para a vida, Neo', note: '[acordar: wake up]' },
      ita: { text: 'Apri gli occhi, Neo', note: '[aprire gli occhi: face facts]' },
      kor: { text: '정신 차려, 네오', note: '[정신 차리다: come to your senses]' },
      eng: { text: 'Wake up, Neo', note: '[wake up: see what is real]' }
    };

    const langGrid = document.getElementById('langGrid');
    const selectedChips = document.getElementById('selectedChips');
    const langCountBadge = document.getElementById('langCountBadge');
    const summaryBar = document.getElementById('summaryBar');

    const selectedLangs = new Set(INITIAL_CONFIG.languages || ['eng']);
    const langByCode = new Map(LANGUAGES.map((l) => [l.iso639_2, l]));
    const pillElements = new Map();

    function renderChips() {
      selectedChips.innerHTML = '';
      selectedLangs.forEach((code) => {
        const entry = langByCode.get(code);
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.appendChild(document.createTextNode((entry ? entry.name : code) + ' '));
        if (selectedLangs.size > 1) {
          const rm = document.createElement('button');
          rm.type = 'button';
          rm.title = 'Remove ' + (entry ? entry.name : code);
          rm.textContent = '×';
          rm.addEventListener('click', () => {
            selectedLangs.delete(code);
            const pillObj = pillElements.get(code);
            if (pillObj) {
              pillObj.cb.checked = false;
              pillObj.lbl.classList.remove('active');
            }
            updateLinks();
          });
          chip.appendChild(rm);
        }
        selectedChips.appendChild(chip);
      });
      langCountBadge.textContent = selectedLangs.size + ' selected';
    }

    LANGUAGES.forEach((lang) => {
      const lbl = document.createElement('label');
      const isChecked = selectedLangs.has(lang.iso639_2);
      lbl.className = 'pill' + (isChecked ? ' active' : '');
      lbl.dataset.search = (lang.name + ' ' + lang.iso639_2 + ' ' + lang.iso639_1).toLowerCase();

      const left = document.createElement('span');
      left.className = 'pill-left';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = lang.iso639_2;
      cb.checked = isChecked;
      cb.addEventListener('change', () => {
        if (cb.checked) {
          selectedLangs.add(lang.iso639_2);
          lbl.classList.add('active');
        } else if (selectedLangs.size > 1) {
          selectedLangs.delete(lang.iso639_2);
          lbl.classList.remove('active');
        } else {
          cb.checked = true;
        }
        updateLinks();
      });

      const nameSpan = document.createElement('span');
      nameSpan.className = 'pill-name';
      nameSpan.textContent = lang.name;

      const codeSpan = document.createElement('span');
      codeSpan.className = 'pill-code';
      codeSpan.textContent = lang.iso639_2.toUpperCase();

      left.appendChild(cb);
      left.appendChild(nameSpan);
      lbl.appendChild(left);
      lbl.appendChild(codeSpan);
      langGrid.appendChild(lbl);
      pillElements.set(lang.iso639_2, { lbl, cb });
    });

    const provWyzie = document.getElementById('provWyzie');
    const provOs = document.getElementById('provOs');
    const provSubdl = document.getElementById('provSubdl');
    const osKey = document.getElementById('osKey');
    const subdlKey = document.getElementById('subdlKey');
    const aiMode = document.getElementById('aiMode');
    const aiProvider = document.getElementById('aiProvider');
    const aiApiKey = document.getElementById('aiApiKey');
    const aiModel = document.getElementById('aiModel');
    const proxySubtitles = document.getElementById('proxySubtitles');
    const includeHi = document.getElementById('includeHi');
    const dualSubtitles = document.getElementById('dualSubtitles');
    const dualSubtitlesNativeLang = document.getElementById('dualSubtitlesNativeLang');
    const dualSubtitlesAnnotate = document.getElementById('dualSubtitlesAnnotate');

    LANGUAGES.forEach((lang) => {
      const opt = document.createElement('option');
      opt.value = lang.iso639_2;
      opt.textContent = lang.name + ' (' + lang.iso639_2.toUpperCase() + ')';
      dualSubtitlesNativeLang.appendChild(opt);
    });

    provWyzie.checked = INITIAL_CONFIG.providers.includes('wyzie');
    provOs.checked = INITIAL_CONFIG.providers.includes('opensubtitles');
    provSubdl.checked = INITIAL_CONFIG.providers.includes('subdl');
    osKey.value = INITIAL_CONFIG.openSubtitlesApiKey || '';
    subdlKey.value = INITIAL_CONFIG.subdlApiKey || '';
    aiMode.value = INITIAL_CONFIG.aiMode || 'fallback';
    aiProvider.value = INITIAL_CONFIG.aiProvider || 'gemini';
    aiApiKey.value = INITIAL_CONFIG.aiApiKey || '';
    aiModel.value = INITIAL_CONFIG.aiModel || '';
    proxySubtitles.checked = INITIAL_CONFIG.proxySubtitles !== false;
    includeHi.checked = INITIAL_CONFIG.includeHearingImpaired !== false;
    dualSubtitles.checked = Boolean(INITIAL_CONFIG.dualSubtitles);
    dualSubtitlesNativeLang.value = INITIAL_CONFIG.dualSubtitlesNativeLang || 'eng';
    dualSubtitlesAnnotate.checked = Boolean(INITIAL_CONFIG.dualSubtitlesAnnotate);

    osKey.addEventListener('input', () => {
      if (osKey.value.trim()) provOs.checked = true;
      updateLinks();
    });
    subdlKey.addEventListener('input', () => {
      if (subdlKey.value.trim()) provSubdl.checked = true;
      updateLinks();
    });

    document.querySelectorAll('.eye-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.target);
        if (!input) return;
        const isPwd = input.type === 'password';
        input.type = isPwd ? 'text' : 'password';
        btn.textContent = isPwd ? 'Hide' : 'Show';
      });
    });

    [provWyzie, provOs, provSubdl, osKey, subdlKey, aiMode, aiProvider, aiApiKey, aiModel, proxySubtitles, includeHi, dualSubtitles, dualSubtitlesNativeLang, dualSubtitlesAnnotate].forEach((el) => {
      el.addEventListener('input', updateLinks);
      el.addEventListener('change', updateLinks);
    });

    function toBase64Url(str) {
      const bytes = new TextEncoder().encode(str);
      let bin = '';
      bytes.forEach((b) => (bin += String.fromCharCode(b)));
      return btoa(bin).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
    }

    function buildCurrentConfig() {
      const providers = [];
      if (provWyzie.checked) providers.push('wyzie');
      if (provOs.checked) providers.push('opensubtitles');
      if (provSubdl.checked) providers.push('subdl');
      if (providers.length === 0) providers.push('wyzie');

      const cfg = {
        languages: Array.from(selectedLangs),
        providers,
        aiProvider: aiProvider.value,
        aiMode: aiMode.value,
        proxySubtitles: proxySubtitles.checked,
        includeHearingImpaired: includeHi.checked,
        dualSubtitles: dualSubtitles.checked,
        dualSubtitlesNativeLang: dualSubtitlesNativeLang.value || 'eng',
        dualSubtitlesAnnotate: dualSubtitlesAnnotate.checked
      };
      if (osKey.value.trim()) cfg.openSubtitlesApiKey = osKey.value.trim();
      if (subdlKey.value.trim()) cfg.subdlApiKey = subdlKey.value.trim();
      if (aiApiKey.value.trim()) cfg.aiApiKey = aiApiKey.value.trim();
      if (aiModel.value.trim()) cfg.aiModel = aiModel.value.trim();
      return cfg;
    }

    function syncVisualStates(cfg) {
      document.getElementById('cardWyzie').classList.toggle('active', provWyzie.checked);
      document.getElementById('cardOs').classList.toggle('active', provOs.checked);
      document.getElementById('cardSubdl').classList.toggle('active', provSubdl.checked);

      const aiDetails = document.getElementById('aiDetails');
      aiDetails.classList.toggle('disabled', cfg.aiMode === 'off');

      const dualDetails = document.getElementById('dualDetails');
      dualDetails.classList.toggle('disabled', !cfg.dualSubtitles);

      const aiKeyHelpLink = document.getElementById('aiKeyHelpLink');
      if (cfg.aiProvider === 'openai') {
        aiKeyHelpLink.href = 'https://platform.openai.com/api-keys';
        aiKeyHelpLink.innerHTML = 'Get OpenAI key &nearr;';
        aiModel.placeholder = 'gpt-4o-mini';
      } else {
        aiKeyHelpLink.href = 'https://aistudio.google.com/apikey';
        aiKeyHelpLink.innerHTML = 'Get Gemini key &nearr;';
        aiModel.placeholder = 'gemini-2.5-flash';
      }

      // Update live cinema preview
      const nativeCode = cfg.dualSubtitlesNativeLang || 'eng';
      const primaryCode = cfg.languages.find((l) => l !== nativeCode) || cfg.languages[0] || 'jpn';
      const sample = SAMPLE_LINES[primaryCode] || SAMPLE_LINES.jpn;
      const refSample = SAMPLE_LINES[nativeCode] || SAMPLE_LINES.eng;
      document.getElementById('previewPrimaryText').textContent = sample.text;
      const idiomEl = document.getElementById('previewIdiomNote');
      idiomEl.textContent = sample.note;
      idiomEl.style.display = cfg.dualSubtitles && cfg.dualSubtitlesAnnotate ? 'inline' : 'none';
      const secEl = document.getElementById('previewSecondaryText');
      secEl.textContent = refSample.text;
      secEl.style.display = cfg.dualSubtitles ? 'block' : 'none';
      document.getElementById('previewTrackLabel').textContent = cfg.dualSubtitles
        ? primaryCode.toUpperCase() + ' + ' + nativeCode.toUpperCase() + ' • Dual track'
        : primaryCode.toUpperCase() + ' • Single track';
      document.getElementById('previewModeBadge').textContent = cfg.dualSubtitles
        ? 'Dual immersion'
        : 'Standard SRT';

      const langNames = cfg.languages.map((c) => (langByCode.get(c) ? langByCode.get(c).name : c)).join(', ');
      const aiSummary =
        cfg.aiMode === 'off'
          ? 'Off'
          : (cfg.aiApiKey ? (cfg.aiProvider === 'openai' ? 'OpenAI' : 'Gemini') : 'Built-in') +
            ' (' +
            cfg.aiMode +
            ')';
      const dualSummary = cfg.dualSubtitles
        ? '<div class="summary-item"><span>Dual reference</span><strong>' + (langByCode.get(cfg.dualSubtitlesNativeLang) ? langByCode.get(cfg.dualSubtitlesNativeLang).name : cfg.dualSubtitlesNativeLang) + '</strong></div>'
        : '';
      summaryBar.innerHTML =
        '<div class="summary-item"><span>Languages</span><strong>' + langNames + '</strong></div>' +
        '<div class="summary-item"><span>Sources</span><strong>' + cfg.providers.length + ' active</strong></div>' +
        '<div class="summary-item"><span>AI fallback</span><strong>' + aiSummary + '</strong></div>' +
        dualSummary;
    }

    function updateLinks() {
      renderChips();
      const cfg = buildCurrentConfig();
      syncVisualStates(cfg);

      const encoded = toBase64Url(JSON.stringify(cfg));
      const origin = window.location.origin || BASE_URL;
      const manifestUrl = origin + '/' + encoded + '/manifest.json';
      const stremioUrl = manifestUrl.replace(/^https?:\\/\\//i, 'stremio://');
      const webUrl = 'https://web.stremio.com/#/addons?addon=' + encodeURIComponent(manifestUrl);

      document.getElementById('manifestUrlBox').textContent = manifestUrl;
      document.getElementById('installBtn').href = stremioUrl;
      document.getElementById('webInstallBtn').href = webUrl;
    }

    document.getElementById('copyBtn').addEventListener('click', async () => {
      const text = document.getElementById('manifestUrlBox').textContent;
      await navigator.clipboard.writeText(text);
      const btn = document.getElementById('copyBtn');
      btn.textContent = 'Copied';
      setTimeout(() => (btn.textContent = 'Copy manifest URL'), 1500);
    });

    updateLinks();
  </script>
</body>
</html>`;
}
