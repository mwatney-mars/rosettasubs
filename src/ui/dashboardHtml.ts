export function renderDashboardPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="icon" type="image/svg+xml" href="/logo.svg" />
  <title>RosettaSubs — Observability</title>
  <style>
    :root {
      --bg-deep: #0f0f10;
      --bg: #141415;
      --card: #19191b;
      --raised: #232325;
      --bar-neutral: #2c2c30;
      --hairline: rgba(237, 237, 237, 0.08);
      --text: #ededed;
      --text-secondary: #a1a1a6;
      --muted: #85858b;
      --accent: #e5a93c;
      --positive: #4cc38a;
      --negative: #e5484d;
      --ease: cubic-bezier(0.22, 1, 0.36, 1);
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      font-size: 14px;
      line-height: 20px;
      font-weight: 400;
      padding: 0 32px 48px;
      -webkit-font-smoothing: antialiased;
    }

    .container {
      max-width: 1480px;
      margin: 0 auto;
    }

    header.topbar {
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
      border-bottom: 1px solid var(--hairline);
      margin-bottom: 24px;
    }

    .title-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .title-row img {
      width: 28px;
      height: 28px;
      border-radius: 6px;
    }

    h1 {
      margin: 0;
      font-size: 16px;
      line-height: 20px;
      font-weight: 500;
      color: var(--text);
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--positive);
      display: inline-block;
    }

    .meta-status {
      font-size: 12px;
      line-height: 16px;
      color: var(--muted);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-variant-numeric: tabular-nums;
    }

    /* 5 Compact Stat Cards (Numbers Only) */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }

    @media (max-width: 1120px) {
      .kpi-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 560px) {
      .kpi-grid {
        grid-template-columns: 1fr;
      }
    }

    .card {
      background: var(--card);
      border: 1px solid var(--hairline);
      border-radius: 12px;
      padding: 20px;
    }

    .kpi-label {
      font-size: 13px;
      line-height: 20px;
      color: var(--text-secondary);
      font-weight: 400;
    }

    .kpi-value {
      font-size: 28px;
      line-height: 32px;
      font-weight: 500;
      margin: 8px 0;
      color: var(--text);
      font-variant-numeric: tabular-nums;
    }

    .kpi-sub {
      font-size: 12px;
      line-height: 16px;
      color: var(--muted);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-variant-numeric: tabular-nums;
    }

    .kpi-sub strong {
      color: var(--text-secondary);
      font-weight: 500;
    }

    /* Main Chart (2/3) + Route Table (1/3) */
    .main-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 16px;
      margin-bottom: 24px;
    }

    @media (max-width: 1024px) {
      .main-grid {
        grid-template-columns: 1fr;
      }
    }

    h2 {
      margin: 0 0 16px;
      font-size: 14px;
      line-height: 20px;
      font-weight: 500;
      color: var(--text);
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }

    .bars {
      display: flex;
      align-items: flex-end;
      gap: 4px;
      height: 280px;
      padding-top: 16px;
      border-bottom: 1px solid var(--hairline);
      background-image: linear-gradient(to bottom, var(--hairline) 1px, transparent 1px);
      background-size: 100% 70px;
    }

    .bar-col {
      flex: 1;
      min-width: 4px;
      background: var(--bar-neutral);
      border-radius: 2px 2px 0 0;
      transition: opacity 120ms var(--ease);
    }

    .bar-col.current {
      background: var(--accent);
    }

    .bar-col:hover {
      opacity: 0.8;
    }

    .chart-axis {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      line-height: 16px;
      color: var(--muted);
      margin-top: 8px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-variant-numeric: tabular-nums;
    }

    /* Asymmetric Bottom Grid: Ranked Lists (1fr) + Live Stream (2fr) */
    .bottom-grid {
      display: grid;
      grid-template-columns: 1fr 2fr;
      gap: 16px;
    }

    @media (max-width: 1024px) {
      .bottom-grid {
        grid-template-columns: 1fr;
      }
    }

    .side-stack {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      line-height: 20px;
      font-variant-numeric: tabular-nums;
    }

    th, td {
      text-align: left;
      height: 36px;
      padding: 0 8px;
      border-bottom: 1px solid var(--hairline);
    }

    th {
      color: var(--muted);
      font-weight: 400;
      font-size: 12px;
      line-height: 16px;
    }

    td.num, th.num {
      text-align: right;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
    }

    .rank-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .rank-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 28px;
      font-size: 13px;
      line-height: 20px;
      color: var(--text-secondary);
      border-bottom: 1px solid var(--hairline);
    }

    .rank-row strong {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      font-weight: 400;
      color: var(--text);
      font-variant-numeric: tabular-nums;
    }

    .status-ok { color: var(--positive); }
    .status-warn { color: var(--accent); }
    .status-err { color: var(--negative); }

    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      line-height: 16px;
      font-variant-numeric: tabular-nums;
    }

    a {
      color: var(--text-secondary);
      text-decoration: none;
    }

    a:hover {
      color: var(--text);
    }

    .table-scroll {
      max-height: 440px;
      overflow-y: auto;
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="topbar">
      <div class="title-row">
        <img src="/logo.svg" alt="RosettaSubs" />
        <h1>RosettaSubs Observability</h1>
        <span class="status-dot" title="LAN private telemetry active"></span>
      </div>
      <div style="display:flex;align-items:center;gap:24px;">
        <span id="uptimeText" class="meta-status">Loading metrics</span>
        <span id="refreshIndicator" class="meta-status">3s interval</span>
      </div>
    </header>

    <div class="kpi-grid">
      <div class="card">
        <div class="kpi-label">Active users (24h)</div>
        <div id="kpiUsers24h" class="kpi-value">0</div>
        <div class="kpi-sub">5m <strong id="kpiUsers5m">0</strong> • 1h <strong id="kpiUsers1h">0</strong> • Total <strong id="kpiUsersTotal">0</strong></div>
      </div>
      <div class="card">
        <div class="kpi-label">Requests</div>
        <div id="kpiReqTotal" class="kpi-value">0</div>
        <div class="kpi-sub">Now <strong id="kpiReqMin">0</strong>/min • 60m <strong id="kpiReq60m">0</strong></div>
      </div>
      <div class="card">
        <div class="kpi-label">Egress traffic</div>
        <div id="kpiTrafficOut" class="kpi-value">0 B</div>
        <div class="kpi-sub">In <strong id="kpiTrafficIn">0 B</strong> • Avg <strong id="kpiAvgMs">0 ms</strong> (p95 <strong id="kpiP95Ms">0 ms</strong>)</div>
      </div>
      <div class="card">
        <div class="kpi-label">Cache hit rate</div>
        <div id="kpiCacheHit" class="kpi-value">0%</div>
        <div class="kpi-sub">Search <strong id="kpiSearchCache">0</strong> • SRT <strong id="kpiSubCache">0</strong> • RSS <strong id="kpiRam">0 MB</strong></div>
      </div>
      <div class="card">
        <div class="kpi-label">Render redirects</div>
        <div id="kpiRenderReqs" class="kpi-value">0</div>
        <div class="kpi-sub">Users <strong id="kpiRenderUsers">0</strong> • Saved <strong id="kpiRenderSaved">0 B</strong></div>
      </div>
    </div>

    <div class="main-grid">
      <div class="card">
        <h2>
          <span>Requests per minute (last 60 minutes)</span>
          <span id="statusSummary" class="meta-status"></span>
        </h2>
        <div id="barsContainer" class="bars"></div>
        <div class="chart-axis">
          <span id="axisStart">-59m</span>
          <span>-30m</span>
          <span id="axisEnd">Now</span>
        </div>
      </div>

      <div class="card">
        <h2>Traffic by route</h2>
        <table>
          <thead>
            <tr>
              <th>Endpoint</th>
              <th class="num">Reqs</th>
              <th class="num">Egress</th>
              <th class="num">Avg</th>
              <th class="num">Err</th>
            </tr>
          </thead>
          <tbody id="routeTableBody"></tbody>
        </table>
      </div>
    </div>

    <div class="bottom-grid">
      <div class="side-stack">
        <div class="card">
          <h2>Top languages</h2>
          <div id="langPills" class="rank-list"></div>
        </div>
        <div class="card">
          <h2>Top countries</h2>
          <div id="countryPills" class="rank-list"></div>
        </div>
        <div class="card">
          <h2>Most requested titles</h2>
          <div id="mediaPills" class="rank-list"></div>
        </div>
      </div>

      <div class="card">
        <h2>Recent requests</h2>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Time (UTC)</th>
                <th>Route</th>
                <th>Path</th>
                <th class="num">Status</th>
                <th class="num">Latency</th>
                <th class="num">Size</th>
                <th>Client</th>
              </tr>
            </thead>
            <tbody id="eventsBody"></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <script>
    function fmtBytes(b) {
      if (!b || b < 1024) return (b || 0) + ' B';
      if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
      if (b < 1024 * 1024 * 1024) return (b / (1024 * 1024)).toFixed(2) + ' MB';
      return (b / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }

    function fmtUptime(s) {
      const d = Math.floor(s / 86400);
      const h = Math.floor((s % 86400) / 3600);
      const m = Math.floor((s % 3600) / 60);
      return (d > 0 ? d + 'd ' : '') + h + 'h ' + m + 'm';
    }

    const ROUTE_NAMES = {
      subtitles: 'Subtitles (/subtitles)',
      subProxy: 'SRT proxy (/sub)',
      dual: 'Dual track (/dual)',
      translate: 'AI translate (/translate)',
      configure: 'Configure (/configure)',
      manifest: 'Manifest (/manifest.json)',
      transcribe: 'Transcribe (/api)',
      other: 'Other'
    };

    async function refresh() {
      const ind = document.getElementById('refreshIndicator');
      try {
        const sep = window.location.search ? '&' : '?';
        const res = await fetch('/api/stats' + (window.location.search || '') + sep + '_t=' + Date.now(), {
          cache: 'no-store'
        });
        if (!res.ok) {
          ind.textContent = 'HTTP ' + res.status + ' • retrying';
          return;
        }
        const d = await res.json();
        ind.textContent = 'Updated ' + d.now.slice(11, 19) + ' UTC • 3s';

        document.getElementById('uptimeText').textContent =
          'Uptime ' + fmtUptime(d.uptimeSeconds) + ' • Since ' + d.startedAt.slice(0, 19).replace('T', ' ') + ' UTC';

        document.getElementById('kpiUsers24h').textContent = d.users.active24h.toLocaleString();
        document.getElementById('kpiUsers5m').textContent = d.users.active5m.toLocaleString();
        document.getElementById('kpiUsers1h').textContent = d.users.active1h.toLocaleString();
        document.getElementById('kpiUsersTotal').textContent = d.users.totalUnique.toLocaleString();

        document.getElementById('kpiReqTotal').textContent = d.traffic.totalRequests.toLocaleString();
        document.getElementById('kpiReqMin').textContent = d.traffic.requestsLastMinute.toLocaleString();
        document.getElementById('kpiReq60m').textContent = d.traffic.requestsLast60m.toLocaleString();

        document.getElementById('kpiTrafficOut').textContent = fmtBytes(d.traffic.totalBytesSent);
        document.getElementById('kpiTrafficIn').textContent = fmtBytes(d.traffic.totalBytesReceived);
        document.getElementById('kpiAvgMs').textContent = d.traffic.avgLatencyMs + ' ms';
        document.getElementById('kpiP95Ms').textContent = d.traffic.p95LatencyMs + ' ms';

        document.getElementById('kpiCacheHit').textContent = d.cache.hitRatePercent + '%';
        document.getElementById('kpiSearchCache').textContent = d.cache.search.size + '/' + d.cache.search.maxEntries;
        document.getElementById('kpiSubCache').textContent = d.cache.subtitles.size + '/' + d.cache.subtitles.maxEntries;
        document.getElementById('kpiRam').textContent = Math.round(d.system.rssBytes / (1024 * 1024)) + ' MB';

        if (d.render) {
          document.getElementById('kpiRenderReqs').textContent = d.render.redirectRequests.toLocaleString();
          document.getElementById('kpiRenderUsers').textContent = d.render.legacyUsersTotal.toLocaleString();
          document.getElementById('kpiRenderSaved').textContent = fmtBytes(d.render.offloadedBytes);
        }

        const st = d.traffic.byStatus;
        document.getElementById('statusSummary').textContent =
          '2xx ' + st['2xx'] + ' • 3xx ' + st['3xx'] + ' • 4xx ' + st['4xx'] + ' • 5xx ' + st['5xx'];

        const barsEl = document.getElementById('barsContainer');
        barsEl.innerHTML = '';
        const maxReq = Math.max(1, ...d.timeline60m.map((x) => x.requests));
        d.timeline60m.forEach((b, idx) => {
          const col = document.createElement('div');
          const isCurrent = idx === d.timeline60m.length - 1;
          col.className = 'bar-col' + (isCurrent ? ' current' : '');
          const pct = b.requests === 0 ? 2 : Math.max(6, Math.round((b.requests / maxReq) * 100));
          col.style.height = pct + '%';
          col.title = b.label + ' UTC — ' + b.requests + ' reqs (' + fmtBytes(b.bytesSent) + ', ' + b.uniqueUsers + ' users)';
          barsEl.appendChild(col);
        });
        if (d.timeline60m.length > 0) {
          document.getElementById('axisStart').textContent = d.timeline60m[0].label + ' UTC';
          document.getElementById('axisEnd').textContent = d.timeline60m[d.timeline60m.length - 1].label + ' UTC';
        }

        const routeBody = document.getElementById('routeTableBody');
        routeBody.innerHTML = '';
        Object.entries(d.traffic.byRoute).forEach(([key, rm]) => {
          if (rm.count === 0 && key === 'other') return;
          const tr = document.createElement('tr');
          const avg = rm.count > 0 ? Math.round(rm.totalMs / rm.count) + ' ms' : '-';
          tr.innerHTML =
            '<td>' + (ROUTE_NAMES[key] || key) + '</td>' +
            '<td class="num">' + rm.count.toLocaleString() + '</td>' +
            '<td class="num">' + fmtBytes(rm.bytesSent) + '</td>' +
            '<td class="num">' + avg + '</td>' +
            '<td class="num ' + (rm.errors > 0 ? 'status-err' : '') + '">' + rm.errors + '</td>';
          routeBody.appendChild(tr);
        });

        const langPills = document.getElementById('langPills');
        langPills.innerHTML = d.topLanguages.length
          ? d.topLanguages.map((x) => '<div class="rank-row"><span>' + x.lang.toUpperCase() + '</span><strong>' + x.count.toLocaleString() + '</strong></div>').join('')
          : '<span class="meta-status">No subtitle requests yet</span>';

        const countryPills = document.getElementById('countryPills');
        countryPills.innerHTML = d.users.topCountries.length
          ? d.users.topCountries.map((x) => '<div class="rank-row"><span>' + x.country + '</span><strong>' + x.count.toLocaleString() + '</strong></div>').join('')
          : '<span class="meta-status">No visitors yet</span>';

        const mediaPills = document.getElementById('mediaPills');
        mediaPills.innerHTML = d.topMedia.length
          ? d.topMedia.map((x) => '<div class="rank-row"><a href="https://www.imdb.com/title/' + x.imdbId + '/" target="_blank" rel="noopener">' + x.imdbId + ' (' + x.type + ')</a><strong>' + x.count.toLocaleString() + '</strong></div>').join('')
          : '<span class="meta-status">No titles queried yet</span>';

        const eventsBody = document.getElementById('eventsBody');
        eventsBody.innerHTML = '';
        d.recentEvents.forEach((ev) => {
          const tr = document.createElement('tr');
          const stClass = ev.status >= 500 ? 'status-err' : ev.status >= 400 ? 'status-warn' : 'status-ok';
          const srcTag = ev.viaRender ? ' • <span class="status-warn">render</span>' : '';
          tr.innerHTML =
            '<td class="mono">' + ev.ts.slice(11, 19) + '</td>' +
            '<td>' + ev.route + srcTag + '</td>' +
            '<td class="mono">' + ev.path.replace(/</g, '&lt;') + '</td>' +
            '<td class="num ' + stClass + '">' + ev.status + '</td>' +
            '<td class="num">' + ev.durationMs + ' ms</td>' +
            '<td class="num">' + fmtBytes(ev.bytesSent) + '</td>' +
            '<td class="mono">' + ev.country + ' • ' + ev.clientHash.slice(0, 8) + '</td>';
          eventsBody.appendChild(tr);
        });
      } catch (e) {
        if (ind) ind.textContent = 'Offline • retrying';
      }
    }

    refresh();
    setInterval(refresh, 3000);
  </script>
</body>
</html>`;
}
