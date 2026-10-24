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
      --bg: #07090f;
      --bg-elevated: #0f1320;
      --card: rgba(19, 24, 38, 0.82);
      --card-hover: rgba(25, 32, 50, 0.92);
      --input-bg: #090c15;
      --border: rgba(255, 255, 255, 0.08);
      --border-strong: rgba(255, 255, 255, 0.15);
      --accent: #7c5cff;
      --accent-hover: #6946ff;
      --accent-soft: rgba(124, 92, 255, 0.14);
      --accent-glow: rgba(124, 92, 255, 0.35);
      --teal: #2dd4bf;
      --teal-soft: rgba(45, 212, 191, 0.12);
      --text: #f3f5fb;
      --text-secondary: #c4cadb;
      --muted: #8590ad;
      --radius-lg: 18px;
      --radius-md: 12px;
      --radius-sm: 8px;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: var(--bg);
      background-image:
        radial-gradient(ellipse 80% 50% at 50% -15%, rgba(124, 92, 255, 0.25), transparent),
        radial-gradient(ellipse 60% 40% at 85% 10%, rgba(45, 212, 191, 0.10), transparent);
      color: var(--text);
      min-height: 100vh;
      padding: 2.5rem 1.25rem 5rem;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }

    .container {
      max-width: 840px;
      margin: 0 auto;
    }

    /* Hero Header */
    header.hero {
      text-align: center;
      margin-bottom: 2.25rem;
    }

    .hero-title-row {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.85rem;
      margin-bottom: 0.65rem;
    }

    .hero-logo {
      width: 52px;
      height: 52px;
      border-radius: 14px;
      box-shadow: 0 8px 28px rgba(124, 92, 255, 0.28);
      flex-shrink: 0;
    }

    header.hero h1 {
      margin: 0;
      font-size: clamp(2rem, 4vw, 2.65rem);
      font-weight: 800;
      letter-spacing: -0.03em;
      background: linear-gradient(135deg, #ffffff 30%, #b9c2dc 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    header.hero p.subtitle {
      margin: 0 auto 1rem;
      max-width: 580px;
      color: var(--muted);
      font-size: 1rem;
    }

    .trust-strip {
      display: inline-flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.6rem;
      font-size: 0.78rem;
      color: var(--muted);
    }

    .trust-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.28rem 0.68rem;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border);
    }

    .trust-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--teal);
    }

    /* Section Cards */
    .card {
      background: var(--card);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 1.6rem;
      margin-bottom: 1.25rem;
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.32);
      transition: border-color 0.2s;
    }

    .card:hover {
      border-color: var(--border-strong);
    }

    .card-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1.15rem;
      flex-wrap: wrap;
    }

    .step-title {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      margin: 0 0 0.25rem;
      font-size: 1.15rem;
      font-weight: 700;
      letter-spacing: -0.01em;
    }

    .step-num {
      width: 26px;
      height: 26px;
      border-radius: 8px;
      background: var(--accent-soft);
      border: 1px solid rgba(124, 92, 255, 0.35);
      color: #cbbaff;
      font-size: 0.82rem;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .card p.hint {
      margin: 0;
      color: var(--muted);
      font-size: 0.88rem;
    }

    .badge-count {
      font-size: 0.78rem;
      font-weight: 600;
      padding: 0.3rem 0.7rem;
      border-radius: 999px;
      background: var(--accent-soft);
      color: #d4c6ff;
      border: 1px solid rgba(124, 92, 255, 0.3);
      white-space: nowrap;
    }

    /* Language Selector */
    .selected-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
      margin-bottom: 0.9rem;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.32rem 0.65rem;
      border-radius: 999px;
      background: linear-gradient(135deg, rgba(124, 92, 255, 0.22), rgba(124, 92, 255, 0.1));
      border: 1px solid rgba(124, 92, 255, 0.45);
      color: #f0ecff;
      font-size: 0.82rem;
      font-weight: 500;
    }

    .chip button {
      background: none;
      border: none;
      color: #cbbaff;
      cursor: pointer;
      padding: 0;
      font-size: 0.95rem;
      line-height: 1;
      display: inline-flex;
      align-items: center;
    }

    .chip button:hover {
      color: #fff;
    }

    .lang-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
      gap: 0.5rem;
      max-height: 310px;
      overflow-y: auto;
      padding: 0.25rem;
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.16) transparent;
    }

    .pill {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0.55rem 0.75rem;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border);
      border-radius: 10px;
      cursor: pointer;
      font-size: 0.87rem;
      user-select: none;
      transition: all 0.15s ease;
    }

    .pill:hover {
      border-color: rgba(124, 92, 255, 0.5);
      background: rgba(255, 255, 255, 0.04);
    }

    .pill.active {
      background: var(--accent-soft);
      border-color: var(--accent);
      color: #fff;
      box-shadow: inset 0 0 0 1px rgba(124, 92, 255, 0.25);
    }

    .pill-left {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      min-width: 0;
    }

    .pill input[type="checkbox"] {
      accent-color: var(--accent);
      width: 15px;
      height: 15px;
      margin: 0;
      cursor: pointer;
      flex-shrink: 0;
    }

    .pill-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 500;
    }

    .pill-code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.72rem;
      color: var(--muted);
      background: rgba(255, 255, 255, 0.05);
      padding: 0.1rem 0.38rem;
      border-radius: 5px;
      text-transform: uppercase;
      flex-shrink: 0;
    }

    .pill.active .pill-code {
      color: #d8ceff;
      background: rgba(124, 92, 255, 0.25);
    }

    /* Provider Cards */
    .provider-stack {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }

    .provider-card {
      background: rgba(9, 12, 21, 0.65);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 1rem 1.15rem;
      transition: border-color 0.15s, background 0.15s;
    }

    .provider-card.active {
      border-color: rgba(124, 92, 255, 0.45);
      background: rgba(18, 23, 39, 0.85);
    }

    .provider-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .provider-label {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.96rem;
    }

    .provider-label input[type="checkbox"] {
      accent-color: var(--accent);
      width: 17px;
      height: 17px;
      margin: 0;
      cursor: pointer;
    }

    .tag {
      font-size: 0.72rem;
      font-weight: 600;
      padding: 0.18rem 0.55rem;
      border-radius: 999px;
      letter-spacing: 0.01em;
    }

    .tag-free {
      background: var(--teal-soft);
      color: var(--teal);
      border: 1px solid rgba(45, 212, 191, 0.3);
    }

    .tag-key {
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-secondary);
      border: 1px solid var(--border);
    }

    .ext-link {
      font-size: 0.8rem;
      color: #a58fff;
      text-decoration: none;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }

    .ext-link:hover {
      color: #c6b8ff;
      text-decoration: underline;
    }

    .provider-desc {
      margin: 0.35rem 0 0;
      color: var(--muted);
      font-size: 0.83rem;
    }

    .provider-key-row {
      margin-top: 0.75rem;
      position: relative;
      display: flex;
      align-items: center;
    }

    /* Form Controls */
    .field-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-top: 0.85rem;
    }

    @media (max-width: 640px) {
      .field-grid {
        grid-template-columns: 1fr;
      }
    }

    label.field {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      font-size: 0.84rem;
      font-weight: 500;
      color: var(--text-secondary);
    }

    .field-label-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
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
      background: var(--input-bg);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 0.65rem 0.85rem;
      border-radius: 10px;
      font-size: 0.9rem;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }

    .input-with-toggle input {
      padding-right: 3.6rem;
    }

    input[type="text"]:focus,
    input[type="password"]:focus,
    select:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.15);
    }

    .eye-btn {
      position: absolute;
      right: 0.5rem;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border);
      color: var(--muted);
      border-radius: 6px;
      padding: 0.22rem 0.5rem;
      font-size: 0.73rem;
      font-weight: 600;
      cursor: pointer;
    }

    .eye-btn:hover {
      color: var(--text);
      background: rgba(255, 255, 255, 0.1);
    }

    .ai-details {
      transition: opacity 0.2s ease;
    }

    .ai-details.disabled {
      opacity: 0.45;
    }

    /* Switch rows */
    .switch-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.85rem;
    }

    @media (max-width: 640px) {
      .switch-grid {
        grid-template-columns: 1fr;
      }
    }

    .switch-card {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.9rem 1rem;
      background: rgba(9, 12, 21, 0.55);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: border-color 0.15s;
    }

    .switch-card:hover {
      border-color: var(--border-strong);
    }

    .switch-card input[type="checkbox"] {
      accent-color: var(--accent);
      width: 17px;
      height: 17px;
      margin-top: 0.18rem;
      cursor: pointer;
      flex-shrink: 0;
    }

    .switch-title {
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--text);
      margin-bottom: 0.18rem;
    }

    .switch-sub {
      font-size: 0.8rem;
      color: var(--muted);
    }

    /* Install Card */
    .install-card {
      background: linear-gradient(180deg, rgba(25, 31, 52, 0.95) 0%, rgba(15, 19, 32, 0.98) 100%);
      border: 1px solid rgba(124, 92, 255, 0.4);
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), 0 0 35px rgba(124, 92, 255, 0.12);
    }

    .summary-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .summary-item {
      font-size: 0.78rem;
      padding: 0.28rem 0.65rem;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border);
      color: var(--text-secondary);
    }

    .summary-item strong {
      color: #fff;
    }

    .url-box {
      background: #06080f;
      border: 1px solid var(--border);
      padding: 0.75rem 0.95rem;
      border-radius: 10px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.8rem;
      word-break: break-all;
      color: var(--teal);
      margin-bottom: 1rem;
      max-height: 76px;
      overflow-y: auto;
    }

    .actions {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.82rem 1.4rem;
      border-radius: 11px;
      font-weight: 600;
      font-size: 0.95rem;
      text-decoration: none;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s ease;
    }

    .btn-primary {
      background: linear-gradient(135deg, var(--accent) 0%, #5f3dc4 100%);
      color: #fff;
      flex: 1.5;
      min-width: 200px;
      box-shadow: 0 8px 24px var(--accent-glow);
    }

    .btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 12px 28px rgba(124, 92, 255, 0.48);
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.06);
      border-color: var(--border-strong);
      color: var(--text);
      flex: 1;
      min-width: 150px;
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.11);
    }

    .coffee-footer {
      margin-top: 2rem;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.6rem;
      color: var(--muted);
      font-size: 0.84rem;
    }

    .coffee-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.55rem;
      padding: 0.62rem 1.2rem;
      border-radius: 999px;
      background: linear-gradient(135deg, rgba(255, 221, 0, 0.14), rgba(245, 158, 11, 0.1));
      border: 1px solid rgba(255, 221, 0, 0.35);
      color: #fde68a;
      font-weight: 600;
      font-size: 0.88rem;
      text-decoration: none;
      transition: all 0.15s ease;
    }

    .coffee-btn:hover {
      background: linear-gradient(135deg, rgba(255, 221, 0, 0.22), rgba(245, 158, 11, 0.18));
      border-color: rgba(255, 221, 0, 0.6);
      transform: translateY(-1px);
      color: #fff;
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="hero">
      <div class="hero-title-row">
        <img class="hero-logo" src="/logo.svg" alt="RosettaSubs Logo" width="52" height="52" />
        <h1>RosettaSubs</h1>
      </div>
      <p class="subtitle">Subtitles in 30+ languages from OpenSubtitles, SubDL, and Wyzie — with dual-language immersion tracks and instant AI translation when subtitles are missing in your language.</p>
      <div class="trust-strip">
        <span class="trust-pill"><span class="trust-dot"></span> Stateless &amp; Zero-Storage</span>
        <span class="trust-pill"><span class="trust-dot"></span> Dual-Language Immersion</span>
        <span class="trust-pill"><span class="trust-dot"></span> Auto UTF-8 &amp; SRT Normalization</span>
        <span class="trust-pill"><span class="trust-dot"></span> MovieHash Sync</span>
      </div>
    </header>

    <!-- STEP 1: LANGUAGES -->
    <div class="card">
      <div class="card-header">
        <div>
          <h2 class="step-title"><span class="step-num">1</span> Subtitle Languages</h2>
          <p class="hint">Pick the languages you want to appear in Stremio's subtitle menu.</p>
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
          <h2 class="step-title"><span class="step-num">2</span> Subtitle Sources</h2>
          <p class="hint">All enabled sources are queried in parallel and deduplicated by release/hash score.</p>
        </div>
      </div>

      <div class="provider-stack">
        <div id="cardWyzie" class="provider-card">
          <div class="provider-top">
            <label class="provider-label">
              <input type="checkbox" id="provWyzie" />
              <span>Wyzie &amp; Stremio OpenSubtitles v3</span>
            </label>
            <span class="tag tag-free">Built-in &bull; No Key Required</span>
          </div>
          <p class="provider-desc">Instant zero-config subtitle lookup across community archives and Stremio's official OpenSubtitles v3 mirror.</p>
        </div>

        <div id="cardOs" class="provider-card">
          <div class="provider-top">
            <label class="provider-label">
              <input type="checkbox" id="provOs" />
              <span>OpenSubtitles REST API v1</span>
            </label>
            <div style="display:flex;align-items:center;gap:0.6rem;">
              <span class="tag tag-key">Optional Key</span>
              <a class="ext-link" href="https://www.opensubtitles.com/en/consumers" target="_blank" rel="noopener noreferrer">Get free key &nearr;</a>
            </div>
          </div>
          <p class="provider-desc">Queries the official OpenSubtitles.com REST API with exact video hash matching and regional language codes.</p>
          <div class="provider-key-row">
            <div class="input-with-toggle">
              <input type="password" id="osKey" placeholder="Paste your OpenSubtitles API Key..." autocomplete="off" />
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
            <div style="display:flex;align-items:center;gap:0.6rem;">
              <span class="tag tag-key">Optional Key</span>
              <a class="ext-link" href="https://subdl.com/panel/api" target="_blank" rel="noopener noreferrer">Get free key &nearr;</a>
            </div>
          </div>
          <p class="provider-desc">High-coverage movie and TV season pack archive with automatic ZIP episode extraction.</p>
          <div class="provider-key-row">
            <div class="input-with-toggle">
              <input type="password" id="subdlKey" placeholder="Paste your SubDL API Key..." autocomplete="off" />
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
          <h2 class="step-title"><span class="step-num">3</span> AI Translation Fallback</h2>
          <p class="hint">When a stream has no subtitles in your language, RosettaSubs translates the best available track on the fly while preserving exact timestamps.</p>
        </div>
      </div>

      <div class="field-grid">
        <label class="field">
          <span>Translation Trigger</span>
          <select id="aiMode">
            <option value="fallback">Smart Fallback (only when native subtitles are missing)</option>
            <option value="always">Always include an AI-translated subtitle option</option>
            <option value="off">Off (disable AI translation)</option>
          </select>
        </label>

        <label class="field">
          <span>AI Engine</span>
          <select id="aiProvider">
            <option value="gemini">Google Gemini (Fast Parallel Flash)</option>
            <option value="openai">OpenAI / Compatible API</option>
          </select>
        </label>
      </div>

      <div id="aiDetails" class="field-grid ai-details">
        <label class="field">
          <div class="field-label-row">
            <span>AI Provider API Key</span>
            <a id="aiKeyHelpLink" class="ext-link" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Get Gemini key &nearr;</a>
          </div>
          <div class="input-with-toggle">
            <input type="password" id="aiApiKey" placeholder="Paste your Gemini or OpenAI API key..." autocomplete="off" />
            <button type="button" class="eye-btn" data-target="aiApiKey">Show</button>
          </div>
        </label>

        <label class="field">
          <span>Model Override <span style="color:var(--muted);font-weight:400;">(Optional)</span></span>
          <input type="text" id="aiModel" placeholder="Default: gemini-2.0-flash" />
        </label>
      </div>
    </div>

    <!-- STEP 4: PLAYBACK & FORMATTING -->
    <div class="card">
      <div class="card-header">
        <div>
          <h2 class="step-title"><span class="step-num">4</span> Formatting &amp; Accessibility</h2>
          <p class="hint">Prevent broken accents, garbled characters, and unsupported subtitle formats in Stremio's player.</p>
        </div>
      </div>

      <div class="switch-grid">
        <label class="switch-card">
          <input type="checkbox" id="proxySubtitles" />
          <div>
            <div class="switch-title">Normalize to UTF-8 SRT</div>
            <div class="switch-sub">Converts Windows-1252/Latin1/UTF-16 &amp; VTT/ASS/ZIP archives into clean UTF-8 SubRip files.</div>
          </div>
        </label>

        <label class="switch-card">
          <input type="checkbox" id="includeHi" />
          <div>
            <div class="switch-title">Include Hearing Impaired (HI)</div>
            <div class="switch-sub">Keep subtitle tracks that include sound-effect descriptions and speaker cues.</div>
          </div>
        </label>

        <label class="switch-card">
          <input type="checkbox" id="dualSubtitles" />
          <div>
            <div class="switch-title">Dual-Language Immersion Subtitles</div>
            <div class="switch-sub">Timestamp-aligns target language on top with your native reference language below.</div>
          </div>
        </label>

        <label class="switch-card">
          <input type="checkbox" id="dualSubtitlesAnnotate" />
          <div>
            <div class="switch-title">Inline B2/C1 Idiom Annotations</div>
            <div class="switch-sub">Uses AI to append concise inline notes for non-literal slang or idioms on dual tracks.</div>
          </div>
        </label>
      </div>

      <div id="dualDetails" class="field-grid ai-details" style="margin-top:0.85rem;">
        <label class="field">
          <span>Native Reference Language (Bottom Line)</span>
          <select id="dualSubtitlesNativeLang"></select>
        </label>
      </div>
    </div>

    <!-- STEP 5: INSTALL -->
    <div class="card install-card">
      <div class="card-header" style="margin-bottom:0.75rem;">
        <div>
          <h2 class="step-title"><span class="step-num">5</span> Install in Stremio</h2>
          <p class="hint">Your configuration is encoded directly into your personal install link below.</p>
        </div>
      </div>

      <div id="summaryBar" class="summary-bar"></div>
      <div id="manifestUrlBox" class="url-box"></div>

      <div class="actions">
        <a id="installBtn" class="btn btn-primary" href="#">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          <span>Install in Stremio App</span>
        </a>
        <a id="webInstallBtn" class="btn btn-secondary" href="#" target="_blank" rel="noopener noreferrer">Open in Stremio Web</a>
        <button id="copyBtn" class="btn btn-secondary" type="button">Copy Manifest URL</button>
      </div>
    </div>

    <footer class="coffee-footer">
      <a class="coffee-btn" href="${supportUrl}" target="_blank" rel="noopener noreferrer">
        <span>&#9749;</span>
        <span>Buy me a coffee</span>
      </a>
      <span>Open-source &bull; Built for the Stremio community</span>
    </footer>
  </div>

  <script>
    const INITIAL_CONFIG = ${initialConfigJson};
    const LANGUAGES = ${languagesJson};
    const BASE_URL = ${JSON.stringify(baseUrl.replace(/\/+$/, ''))} || window.location.origin;

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
      codeSpan.textContent = lang.iso639_2;

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

    // Auto-enable provider checkbox when user enters an API key
    osKey.addEventListener('input', () => {
      if (osKey.value.trim()) provOs.checked = true;
      updateLinks();
    });
    subdlKey.addEventListener('input', () => {
      if (subdlKey.value.trim()) provSubdl.checked = true;
      updateLinks();
    });

    // Show/Hide password buttons
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
        aiModel.placeholder = 'Default: gpt-4o-mini';
      } else {
        aiKeyHelpLink.href = 'https://aistudio.google.com/apikey';
        aiKeyHelpLink.innerHTML = 'Get Gemini key &nearr;';
        aiModel.placeholder = 'Default: gemini-2.0-flash';
      }

      const langNames = cfg.languages.map((c) => (langByCode.get(c) ? langByCode.get(c).name : c)).join(', ');
      const aiSummary = cfg.aiMode === 'off' ? 'Off' : (cfg.aiProvider === 'openai' ? 'OpenAI' : 'Gemini') + ' (' + cfg.aiMode + ')';
      const dualSummary = cfg.dualSubtitles
        ? '<span class="summary-item"><strong>Dual Subs:</strong> ' + (langByCode.get(cfg.dualSubtitlesNativeLang) ? langByCode.get(cfg.dualSubtitlesNativeLang).name : cfg.dualSubtitlesNativeLang) + '</span>'
        : '';
      summaryBar.innerHTML =
        '<span class="summary-item"><strong>Languages:</strong> ' + langNames + '</span>' +
        '<span class="summary-item"><strong>Sources:</strong> ' + cfg.providers.length + ' active</span>' +
        '<span class="summary-item"><strong>AI Translation:</strong> ' + aiSummary + '</span>' +
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
      btn.textContent = 'Copied!';
      setTimeout(() => (btn.textContent = 'Copy Manifest URL'), 1500);
    });

    updateLinks();
  </script>
</body>
</html>`;
}
