export function renderDashboardPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="icon" type="image/svg+xml" href="/logo.svg" />
  <title>RosettaSubs — Private Observability</title>
  <style>
    :root {
      --bg: #07090f;
      --card: rgba(18, 23, 38, 0.9);
      --border: rgba(255, 255, 255, 0.08);
      --accent: #7c5cff;
      --teal: #2dd4bf;
      --amber: #f59e0b;
      --danger: #ef4444;
      --text: #f3f5fb;
      --muted: #8590ad;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 1.5rem 1.25rem 3rem;
    }
    .container { max-width: 1180px; margin: 0 auto; }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .title-row { display: flex; align-items: center; gap: 0.75rem; }
    .title-row img { width: 40px; height: 40px; border-radius: 10px; }
    h1 { margin: 0; font-size: 1.45rem; font-weight: 800; }
    .badge-private {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.25rem 0.6rem;
      border-radius: 999px;
      background: rgba(45, 212, 191, 0.14);
      border: 1px solid rgba(45, 212, 191, 0.38);
      color: var(--teal);
    }
    .meta-status { font-size: 0.82rem; color: var(--muted); font-family: ui-monospace, monospace; }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
      margin-bottom: 1.25rem;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 1.15rem 1.25rem;
    }
    .kpi-label { font-size: 0.78rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .kpi-value { font-size: 1.85rem; font-weight: 800; margin: 0.25rem 0; color: #fff; }
    .kpi-sub { font-size: 0.8rem; color: var(--muted); }
    .kpi-sub strong { color: var(--teal); }
    .grid-2 {
      display: grid;
      grid-template-columns: 1.6fr 1fr;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }
    .grid-3 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1rem;
      margin-bottom: 1.25rem;
    }
    @media (max-width: 860px) {
      .grid-2 { grid-template-columns: 1fr; }
    }
    h2 { margin: 0 0 0.85rem; font-size: 0.98rem; font-weight: 700; color: #dce2f2; display: flex; justify-content: space-between; align-items: center; }
    .bars {
      display: flex;
      align-items: flex-end;
      gap: 3px;
      height: 120px;
      padding-top: 12px;
      border-bottom: 1px solid var(--border);
    }
    .bar-col {
      flex: 1;
      min-width: 4px;
      background: linear-gradient(180deg, var(--accent), var(--teal));
      border-radius: 3px 3px 0 0;
      opacity: 0.85;
      transition: height 0.2s;
      position: relative;
    }
    .bar-col:hover { opacity: 1; }
    .chart-axis { display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--muted); margin-top: 0.4rem; font-family: ui-monospace, monospace; }
    table { width: 100%; border-collapse: collapse; font-size: 0.83rem; }
    th, td { text-align: left; padding: 0.5rem 0.55rem; border-bottom: 1px solid rgba(255,255,255,0.05); }
    th { color: var(--muted); font-weight: 600; font-size: 0.75rem; text-transform: uppercase; }
    td.num, th.num { text-align: right; font-family: ui-monospace, monospace; }
    .pill-list { display: flex; flex-wrap: wrap; gap: 0.45rem; }
    .stat-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.3rem 0.65rem;
      border-radius: 8px;
      background: rgba(255,255,255,0.04);
      border: 1px solid var(--border);
      font-size: 0.8rem;
    }
    .stat-pill strong { color: var(--teal); font-family: ui-monospace, monospace; }
    .status-ok { color: var(--teal); font-weight: 600; }
    .status-warn { color: var(--amber); font-weight: 600; }
    .status-err { color: var(--danger); font-weight: 600; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.78rem; }
    a { color: #a58fff; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .table-scroll { max-height: 360px; overflow-y: auto; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="title-row">
        <img src="/logo.svg" alt="RosettaSubs" />
        <div>
          <div style="display:flex;align-items:center;gap:0.6rem;">
            <h1>RosettaSubs Observability</h1>
            <span class="badge-private">LAN Private</span>
          </div>
          <div id="uptimeText" class="meta-status">Loading live metrics...</div>
        </div>
      </div>
      <div id="refreshIndicator" class="meta-status">Auto-refresh: 3s</div>
    </header>

    <div class="kpi-grid">
      <div class="card">
        <div class="kpi-label">Unique Users (24h)</div>
        <div id="kpiUsers24h" class="kpi-value">0</div>
        <div class="kpi-sub">5m: <strong id="kpiUsers5m">0</strong> &bull; 1h: <strong id="kpiUsers1h">0</strong> &bull; All-time: <strong id="kpiUsersTotal">0</strong></div>
      </div>
      <div class="card">
        <div class="kpi-label">Total Requests</div>
        <div id="kpiReqTotal" class="kpi-value">0</div>
        <div class="kpi-sub">Current: <strong id="kpiReqMin">0</strong>/min &bull; Last 60m: <strong id="kpiReq60m">0</strong></div>
      </div>
      <div class="card">
        <div class="kpi-label">Traffic (Egress / Ingress)</div>
        <div id="kpiTrafficOut" class="kpi-value">0 B</div>
        <div class="kpi-sub">In: <strong id="kpiTrafficIn">0 B</strong> &bull; Avg: <strong id="kpiAvgMs">0 ms</strong> (p95: <strong id="kpiP95Ms">0 ms</strong>)</div>
      </div>
      <div class="card">
        <div class="kpi-label">Cache Hit Ratio &amp; RAM</div>
        <div id="kpiCacheHit" class="kpi-value">0%</div>
        <div class="kpi-sub">Search: <strong id="kpiSearchCache">0</strong> &bull; SRTs: <strong id="kpiSubCache">0</strong> &bull; RSS: <strong id="kpiRam">0 MB</strong></div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h2>
          <span>Requests per Minute (Last 60m)</span>
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
        <h2>Traffic by Route</h2>
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

    <div class="grid-3">
      <div class="card">
        <h2>Top Requested Languages</h2>
        <div id="langPills" class="pill-list"></div>
      </div>
      <div class="card">
        <h2>Top Countries (Cloudflare)</h2>
        <div id="countryPills" class="pill-list"></div>
      </div>
      <div class="card">
        <h2>Most Watched Titles (IMDb)</h2>
        <div id="mediaPills" class="pill-list"></div>
      </div>
    </div>

    <div class="card">
      <h2>Live Request Stream (Last 60)</h2>
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
      subtitles: 'Subtitles Search (/subtitles)',
      subProxy: 'SRT Proxy (/sub)',
      dual: 'Dual Subtitles (/dual)',
      translate: 'AI Translate (/translate)',
      configure: 'Configure UI (/configure)',
      manifest: 'Manifest (/manifest.json)',
      transcribe: 'Audio Transcribe (/api)',
      other: 'Other'
    };

    async function refresh() {
      try {
        const q = window.location.search || '';
        const res = await fetch('/api/stats' + q);
        if (!res.ok) return;
        const d = await res.json();

        document.getElementById('uptimeText').textContent =
          'Uptime: ' + fmtUptime(d.uptimeSeconds) + ' • Since ' + d.startedAt.slice(0, 19).replace('T', ' ') + ' UTC';

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

        const st = d.traffic.byStatus;
        document.getElementById('statusSummary').textContent =
          '2xx: ' + st['2xx'] + ' • 3xx: ' + st['3xx'] + ' • 4xx: ' + st['4xx'] + ' • 5xx: ' + st['5xx'];

        const barsEl = document.getElementById('barsContainer');
        barsEl.innerHTML = '';
        const maxReq = Math.max(1, ...d.timeline60m.map((x) => x.requests));
        d.timeline60m.forEach((b) => {
          const col = document.createElement('div');
          col.className = 'bar-col';
          const pct = b.requests === 0 ? 3 : Math.max(8, Math.round((b.requests / maxReq) * 100));
          col.style.height = pct + '%';
          if (b.requests === 0) col.style.opacity = '0.18';
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
          const avg = rm.count > 0 ? Math.round(rm.totalMs / rm.count) + 'ms' : '-';
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
          ? d.topLanguages.map((x) => '<span class="stat-pill">' + x.lang.toUpperCase() + ' <strong>' + x.count + '</strong></span>').join('')
          : '<span class="meta-status">No subtitle requests yet</span>';

        const countryPills = document.getElementById('countryPills');
        countryPills.innerHTML = d.users.topCountries.length
          ? d.users.topCountries.map((x) => '<span class="stat-pill">' + x.country + ' <strong>' + x.count + '</strong></span>').join('')
          : '<span class="meta-status">No visitors yet</span>';

        const mediaPills = document.getElementById('mediaPills');
        mediaPills.innerHTML = d.topMedia.length
          ? d.topMedia.map((x) => '<a class="stat-pill" href="https://www.imdb.com/title/' + x.imdbId + '/" target="_blank" rel="noopener">' + x.imdbId + ' (' + x.type + ') <strong>' + x.count + '</strong></a>').join('')
          : '<span class="meta-status">No titles queried yet</span>';

        const eventsBody = document.getElementById('eventsBody');
        eventsBody.innerHTML = '';
        d.recentEvents.forEach((ev) => {
          const tr = document.createElement('tr');
          const stClass = ev.status >= 500 ? 'status-err' : ev.status >= 400 ? 'status-warn' : 'status-ok';
          tr.innerHTML =
            '<td class="mono">' + ev.ts.slice(11, 19) + '</td>' +
            '<td>' + ev.route + '</td>' +
            '<td class="mono">' + ev.path.replace(/</g, '&lt;') + '</td>' +
            '<td class="num ' + stClass + '">' + ev.status + '</td>' +
            '<td class="num">' + ev.durationMs + 'ms</td>' +
            '<td class="num">' + fmtBytes(ev.bytesSent) + '</td>' +
            '<td class="mono">' + ev.country + ' • ' + ev.clientHash.slice(0, 8) + '</td>';
          eventsBody.appendChild(tr);
        });
      } catch (e) {
        // ignore transient fetch errors
      }
    }

    refresh();
    setInterval(refresh, 3000);
  </script>
</body>
</html>`;
}
