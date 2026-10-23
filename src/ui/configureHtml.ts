import { AddonConfig } from '../types';
import { LANGUAGES } from '../languages';

export function renderConfigurePage(config: AddonConfig, baseUrl: string): string {
  const initialConfigJson = JSON.stringify(config).replace(/</g, '\\u003c');
  const languagesJson = JSON.stringify(LANGUAGES).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Multimodal Subtitles — Stremio Add-on Configuration</title>
  <style>
    :root {
      --bg: #0b0d14;
      --card: #151926;
      --border: #262d42;
      --accent: #7b5bf2;
      --accent-hover: #6846e8;
      --text: #eef1f8;
      --muted: #939bb4;
      --success: #2dd4bf;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: radial-gradient(circle at top, #171c2e 0%, var(--bg) 70%);
      color: var(--text);
      min-height: 100vh;
      padding: 2rem 1rem 4rem;
    }
    .container {
      max-width: 780px;
      margin: 0 auto;
    }
    header {
      text-align: center;
      margin-bottom: 2rem;
    }
    header h1 {
      margin: 0 0 0.5rem;
      font-size: 2rem;
      letter-spacing: -0.02em;
    }
    header p {
      margin: 0;
      color: var(--muted);
      font-size: 0.98rem;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 1.5rem;
      margin-bottom: 1.25rem;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
    }
    .card h2 {
      margin: 0 0 0.35rem;
      font-size: 1.15rem;
    }
    .card p.hint {
      margin: 0 0 1rem;
      color: var(--muted);
      font-size: 0.88rem;
    }
    .lang-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(165px, 1fr));
      gap: 0.5rem;
      max-height: 260px;
      overflow-y: auto;
      padding: 0.25rem;
    }
    .pill {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.88rem;
      user-select: none;
      transition: border-color 0.15s, background 0.15s;
    }
    .pill input {
      accent-color: var(--accent);
    }
    .pill:hover {
      border-color: var(--accent);
    }
    .field-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-top: 0.75rem;
    }
    @media (max-width: 640px) {
      .field-grid { grid-template-columns: 1fr; }
    }
    label.field {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      font-size: 0.86rem;
      color: var(--muted);
    }
    input[type="text"], input[type="password"], select {
      background: #0e121d;
      border: 1px solid var(--border);
      color: var(--text);
      padding: 0.6rem 0.75rem;
      border-radius: 8px;
      font-size: 0.92rem;
      outline: none;
    }
    input[type="text"]:focus, input[type="password"]:focus, select:focus {
      border-color: var(--accent);
    }
    .toggle-row {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      margin-top: 0.5rem;
    }
    .url-box {
      background: #0b0e17;
      border: 1px solid var(--border);
      padding: 0.75rem 1rem;
      border-radius: 8px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.83rem;
      word-break: break-all;
      color: var(--success);
      margin-bottom: 1rem;
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
      padding: 0.75rem 1.35rem;
      border-radius: 9px;
      font-weight: 600;
      font-size: 0.95rem;
      text-decoration: none;
      cursor: pointer;
      border: none;
      transition: background 0.15s;
    }
    .btn-primary {
      background: var(--accent);
      color: #fff;
      flex: 1;
    }
    .btn-primary:hover {
      background: var(--accent-hover);
    }
    .btn-secondary {
      background: #232a3d;
      color: var(--text);
    }
    .btn-secondary:hover {
      background: #2d364f;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Multimodal Subtitles</h1>
      <p>Multi-Provider Aggregation (Wyzie, OpenSubtitles, SubDL) + Multimodal AI Translation &amp; Transcription</p>
    </header>

    <div class="card">
      <h2>1. Subtitle Languages</h2>
      <p class="hint">Select one or more target languages to fetch and translate into.</p>
      <div id="langGrid" class="lang-grid"></div>
    </div>

    <div class="card">
      <h2>2. Subtitle Providers</h2>
      <p class="hint">Wyzie works without keys. Add OpenSubtitles v1 or SubDL keys for higher match rates and hash matching.</p>
      <div class="toggle-row">
        <label class="pill"><input type="checkbox" id="provWyzie" /> Wyzie Subs (Free)</label>
        <label class="pill"><input type="checkbox" id="provOs" /> OpenSubtitles v1</label>
        <label class="pill"><input type="checkbox" id="provSubdl" /> SubDL</label>
      </div>
      <div class="field-grid">
        <label class="field">
          <span>OpenSubtitles REST API Key</span>
          <input type="password" id="osKey" placeholder="Optional API key" autocomplete="off" />
        </label>
        <label class="field">
          <span>SubDL API Key</span>
          <input type="password" id="subdlKey" placeholder="Optional API key" autocomplete="off" />
        </label>
      </div>
    </div>

    <div class="card">
      <h2>3. Multimodal AI Fallback &amp; Translation</h2>
      <p class="hint">Automatically translates available subtitles into missing target languages while preserving exact SRT timestamps.</p>
      <div class="field-grid">
        <label class="field">
          <span>AI Mode</span>
          <select id="aiMode">
            <option value="fallback">Fallback (only when target language is missing)</option>
            <option value="always">Always include AI translation track</option>
            <option value="off">Off (disable AI translation)</option>
          </select>
        </label>
        <label class="field">
          <span>AI Provider</span>
          <select id="aiProvider">
            <option value="gemini">Google Gemini (Multimodal + Fast SRT)</option>
            <option value="openai">OpenAI / OpenAI-Compatible API</option>
          </select>
        </label>
        <label class="field">
          <span>AI API Key</span>
          <input type="password" id="aiApiKey" placeholder="Gemini or OpenAI API key" autocomplete="off" />
        </label>
        <label class="field">
          <span>AI Model Override (Optional)</span>
          <input type="text" id="aiModel" placeholder="e.g. gemini-2.5-flash or gpt-4o-mini" />
        </label>
      </div>
    </div>

    <div class="card">
      <h2>4. Subtitle Normalization &amp; Proxy</h2>
      <p class="hint">Normalizes encodings (Windows-1252, Latin1, UTF-16) and converts VTT/ASS/ZIP to UTF-8 SRT.</p>
      <div class="toggle-row">
        <label class="pill">
          <input type="checkbox" id="proxySubtitles" />
          Proxy &amp; Normalize to UTF-8 SRT
        </label>
        <label class="pill">
          <input type="checkbox" id="includeHi" />
          Include Hearing Impaired (HI) Subtitles
        </label>
      </div>
    </div>

    <div class="card">
      <h2>5. Install in Stremio</h2>
      <div id="manifestUrlBox" class="url-box"></div>
      <div class="actions">
        <a id="installBtn" class="btn btn-primary" href="#">Install in Stremio</a>
        <button id="copyBtn" class="btn btn-secondary" type="button">Copy Manifest URL</button>
      </div>
    </div>
  </div>

  <script>
    const INITIAL_CONFIG = ${initialConfigJson};
    const LANGUAGES = ${languagesJson};
    const BASE_URL = ${JSON.stringify(baseUrl.replace(/\/+$/, ''))} || window.location.origin;

    const langGrid = document.getElementById('langGrid');
    const selectedLangs = new Set(INITIAL_CONFIG.languages || ['eng']);

    LANGUAGES.forEach((lang) => {
      const lbl = document.createElement('label');
      lbl.className = 'pill';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = lang.iso639_2;
      cb.checked = selectedLangs.has(lang.iso639_2);
      cb.addEventListener('change', () => {
        if (cb.checked) selectedLangs.add(lang.iso639_2);
        else if (selectedLangs.size > 1) selectedLangs.delete(lang.iso639_2);
        else cb.checked = true;
        updateLinks();
      });
      lbl.appendChild(cb);
      lbl.appendChild(document.createTextNode(lang.name + ' (' + lang.iso639_2 + ')'));
      langGrid.appendChild(lbl);
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

    [provWyzie, provOs, provSubdl, osKey, subdlKey, aiMode, aiProvider, aiApiKey, aiModel, proxySubtitles, includeHi].forEach((el) => {
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
        includeHearingImpaired: includeHi.checked
      };
      if (osKey.value.trim()) cfg.openSubtitlesApiKey = osKey.value.trim();
      if (subdlKey.value.trim()) cfg.subdlApiKey = subdlKey.value.trim();
      if (aiApiKey.value.trim()) cfg.aiApiKey = aiApiKey.value.trim();
      if (aiModel.value.trim()) cfg.aiModel = aiModel.value.trim();
      return cfg;
    }

    function updateLinks() {
      const cfg = buildCurrentConfig();
      const encoded = toBase64Url(JSON.stringify(cfg));
      const origin = window.location.origin || BASE_URL;
      const manifestUrl = origin + '/' + encoded + '/manifest.json';
      const stremioUrl = manifestUrl.replace(/^https?:\\/\\//i, 'stremio://');

      document.getElementById('manifestUrlBox').textContent = manifestUrl;
      document.getElementById('installBtn').href = stremioUrl;
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
