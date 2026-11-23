import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Request } from 'express';
import { searchCache, subtitleContentCache } from './cache';

export type RouteCategory =
  | 'manifest'
  | 'configure'
  | 'subtitles'
  | 'subProxy'
  | 'translate'
  | 'dual'
  | 'transcribe'
  | 'other';

export interface RouteMetrics {
  count: number;
  bytesSent: number;
  errors: number;
  totalMs: number;
}

export interface UserRecord {
  firstSeen: number;
  lastSeen: number;
  requests: number;
  bytesSent: number;
  country: string;
  viaRender?: boolean;
}

export interface MinuteBucket {
  minute: number; // Math.floor(Date.now() / 60000)
  requests: number;
  renderRequests: number;
  bytesSent: number;
  users: Set<string>;
}

export interface RecentRequestEvent {
  ts: string;
  method: string;
  path: string;
  route: RouteCategory;
  status: number;
  durationMs: number;
  bytesSent: number;
  clientHash: string;
  country: string;
  viaRender: boolean;
}

interface PersistedMetrics {
  startedAt: number;
  totalRequests: number;
  totalBytesSent: number;
  totalBytesReceived: number;
  renderRedirectRequests?: number;
  renderOffloadedBytes?: number;
  byRoute: Record<RouteCategory, RouteMetrics>;
  byStatus: Record<'2xx' | '3xx' | '4xx' | '5xx', number>;
  users: Array<[string, UserRecord]>;
  topLanguages: Array<[string, number]>;
  topMedia: Array<[string, { imdbId: string; type: string; count: number; lastSeen: number }]>;
  recentEvents?: RecentRequestEvent[];
  minuteBuckets?: Array<
    [number, { minute: number; requests: number; renderRequests: number; bytesSent: number; users: string[] }]
  >;
}

const ROUTE_CATEGORIES: RouteCategory[] = [
  'manifest',
  'configure',
  'subtitles',
  'subProxy',
  'translate',
  'dual',
  'transcribe',
  'other'
];

function createEmptyRouteMap(): Record<RouteCategory, RouteMetrics> {
  const res = {} as Record<RouteCategory, RouteMetrics>;
  for (const r of ROUTE_CATEGORIES) {
    res[r] = { count: 0, bytesSent: 0, errors: 0, totalMs: 0 };
  }
  return res;
}

export function classifyRoute(reqPath: string): RouteCategory {
  if (reqPath.endsWith('/manifest.json')) return 'manifest';
  if (reqPath === '/' || reqPath.endsWith('/configure')) return 'configure';
  if (reqPath.includes('/subtitles/')) return 'subtitles';
  if (reqPath.startsWith('/sub/')) return 'subProxy';
  if (reqPath.startsWith('/translate/')) return 'translate';
  if (reqPath.startsWith('/dual/')) return 'dual';
  if (reqPath.startsWith('/api/multimodal/')) return 'transcribe';
  return 'other';
}

export function extractClientHashAndCountry(req: Request): { clientHash: string; country: string } {
  const cfIp = (req.headers['cf-connecting-ip'] as string)?.trim();
  const xff = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim();
  const rawIp = cfIp || xff || req.socket?.remoteAddress || req.ip || 'unknown';
  const country = ((req.headers['cf-ipcountry'] as string) || 'LAN').trim().toUpperCase();
  const clientHash = crypto.createHash('sha256').update(rawIp).digest('hex').slice(0, 12);
  return { clientHash, country };
}

export function isPrivateLanRequest(req: Request): boolean {
  const token = process.env.STATS_TOKEN?.trim();
  if (token) {
    const qToken = typeof req.query.token === 'string' ? req.query.token : '';
    const authHeader = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (qToken === token || authHeader === token) {
      return true;
    }
  }
  // If request came through Cloudflare public proxy, block unless token matched above
  if (req.headers['cf-connecting-ip'] || req.headers['cf-ray']) {
    return false;
  }
  const remote = (req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
  if (
    !remote ||
    remote === '127.0.0.1' ||
    remote === '::1' ||
    remote.startsWith('192.168.') ||
    remote.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(remote)
  ) {
    return true;
  }
  return false;
}

class MetricsCollector {
  private startedAt = Date.now();
  private totalRequests = 0;
  private totalBytesSent = 0;
  private totalBytesReceived = 0;
  private renderRedirectRequests = 0;
  private renderOffloadedBytes = 0;
  private byRoute: Record<RouteCategory, RouteMetrics> = createEmptyRouteMap();
  private byStatus: Record<'2xx' | '3xx' | '4xx' | '5xx', number> = {
    '2xx': 0,
    '3xx': 0,
    '4xx': 0,
    '5xx': 0
  };
  private users = new Map<string, UserRecord>();
  private topLanguages = new Map<string, number>();
  private topMedia = new Map<
    string,
    { imdbId: string; type: string; count: number; lastSeen: number }
  >();
  private minuteBuckets = new Map<number, MinuteBucket>();
  private recentLatencies: number[] = [];
  private recentEvents: RecentRequestEvent[] = [];
  private persistPath: string;
  private dirty = false;

  constructor() {
    this.persistPath = process.env.METRICS_FILE || '/data/metrics.json';
    this.loadFromDisk();

    if (process.env.NODE_ENV !== 'test') {
      const timer = setInterval(() => this.flushToDisk(), 10_000);
      timer.unref();
    }
  }

  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(this.persistPath)) return;
      const raw = fs.readFileSync(this.persistPath, 'utf8');
      const data = JSON.parse(raw) as Partial<PersistedMetrics>;
      if (typeof data.startedAt === 'number') this.startedAt = data.startedAt;
      if (typeof data.totalRequests === 'number') this.totalRequests = data.totalRequests;
      if (typeof data.totalBytesSent === 'number') this.totalBytesSent = data.totalBytesSent;
      if (typeof data.totalBytesReceived === 'number') {
        this.totalBytesReceived = data.totalBytesReceived;
      }
      if (typeof data.renderRedirectRequests === 'number') {
        this.renderRedirectRequests = data.renderRedirectRequests;
      }
      if (typeof data.renderOffloadedBytes === 'number') {
        this.renderOffloadedBytes = data.renderOffloadedBytes;
      }
      if (data.byRoute) {
        for (const r of ROUTE_CATEGORIES) {
          if (data.byRoute[r]) {
            this.byRoute[r] = { ...this.byRoute[r], ...data.byRoute[r] };
          }
        }
      }
      if (data.byStatus) {
        this.byStatus = { ...this.byStatus, ...data.byStatus };
      }
      if (Array.isArray(data.users)) {
        this.users = new Map(data.users.slice(-25000));
      }
      if (Array.isArray(data.topLanguages)) {
        this.topLanguages = new Map(data.topLanguages);
      }
      if (Array.isArray(data.topMedia)) {
        this.topMedia = new Map(data.topMedia.slice(-2000));
      }
      if (Array.isArray(data.recentEvents)) {
        this.recentEvents = data.recentEvents.slice(0, 120);
      }
      if (Array.isArray(data.minuteBuckets)) {
        this.minuteBuckets = new Map(
          data.minuteBuckets.map(([k, v]) => [
            k,
            {
              minute: v.minute,
              requests: v.requests || 0,
              renderRequests: v.renderRequests || 0,
              bytesSent: v.bytesSent || 0,
              users: new Set(Array.isArray(v.users) ? v.users : [])
            }
          ])
        );
      }
    } catch {
      // Ignore corrupt or missing file
    }
  }

  public flushToDisk(): void {
    if (!this.dirty || process.env.NODE_ENV === 'test') return;
    try {
      const dir = path.dirname(this.persistPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const payload: PersistedMetrics = {
        startedAt: this.startedAt,
        totalRequests: this.totalRequests,
        totalBytesSent: this.totalBytesSent,
        totalBytesReceived: this.totalBytesReceived,
        renderRedirectRequests: this.renderRedirectRequests,
        renderOffloadedBytes: this.renderOffloadedBytes,
        byRoute: this.byRoute,
        byStatus: this.byStatus,
        users: Array.from(this.users.entries()).slice(-25000),
        topLanguages: Array.from(this.topLanguages.entries()),
        topMedia: Array.from(this.topMedia.entries()).slice(-1000),
        recentEvents: this.recentEvents.slice(0, 120),
        minuteBuckets: Array.from(this.minuteBuckets.entries()).map(([k, b]) => [
          k,
          {
            minute: b.minute,
            requests: b.requests,
            renderRequests: b.renderRequests,
            bytesSent: b.bytesSent,
            users: Array.from(b.users)
          }
        ])
      };
      fs.writeFileSync(this.persistPath, JSON.stringify(payload), 'utf8');
      this.dirty = false;
    } catch {
      // Ignore read-only filesystem
    }
  }

  public recordRequest(params: {
    req: Request;
    status: number;
    durationMs: number;
    bytesSent: number;
    bytesReceived: number;
  }): void {
    const { req, status, durationMs, bytesSent, bytesReceived } = params;
    if (
      req.path === '/health' ||
      req.path === '/logo.svg' ||
      req.path === '/robots.txt' ||
      req.path === '/favicon.ico' ||
      req.path.startsWith('/stats') ||
      req.path.startsWith('/api/stats')
    ) {
      return;
    }

    const now = Date.now();
    const route = classifyRoute(req.path);
    const { clientHash, country } = extractClientHashAndCountry(req);
    const referer = String(req.headers.referer || '');
    const viaRender = req.query.via === 'render' || referer.includes('onrender.com');

    this.totalRequests++;
    this.totalBytesSent += bytesSent;
    this.totalBytesReceived += bytesReceived;
    if (viaRender) {
      this.renderRedirectRequests++;
      this.renderOffloadedBytes += bytesSent;
    }

    const rm = this.byRoute[route];
    rm.count++;
    rm.bytesSent += bytesSent;
    rm.totalMs += durationMs;
    if (status >= 400) rm.errors++;

    if (status >= 500) this.byStatus['5xx']++;
    else if (status >= 400) this.byStatus['4xx']++;
    else if (status >= 300) this.byStatus['3xx']++;
    else this.byStatus['2xx']++;

    const existingUser = this.users.get(clientHash);
    if (existingUser) {
      existingUser.lastSeen = now;
      existingUser.requests++;
      existingUser.bytesSent += bytesSent;
      if (country !== 'LAN') existingUser.country = country;
      if (viaRender) existingUser.viaRender = true;
    } else {
      if (this.users.size >= 50000) {
        const oldestKey = this.users.keys().next().value;
        if (oldestKey) this.users.delete(oldestKey);
      }
      this.users.set(clientHash, {
        firstSeen: now,
        lastSeen: now,
        requests: 1,
        bytesSent,
        country,
        viaRender
      });
    }

    const curMin = Math.floor(now / 60000);
    let bucket = this.minuteBuckets.get(curMin);
    if (!bucket) {
      bucket = { minute: curMin, requests: 0, renderRequests: 0, bytesSent: 0, users: new Set() };
      this.minuteBuckets.set(curMin, bucket);
      if (this.minuteBuckets.size > 120) {
        const oldestMin = this.minuteBuckets.keys().next().value;
        if (oldestMin !== undefined) this.minuteBuckets.delete(oldestMin);
      }
    }
    bucket.requests++;
    if (viaRender) bucket.renderRequests++;
    bucket.bytesSent += bytesSent;
    bucket.users.add(clientHash);

    this.recentLatencies.push(durationMs);
    if (this.recentLatencies.length > 500) {
      this.recentLatencies.shift();
    }

    const shortPath =
      req.originalUrl.length > 110 ? `${req.originalUrl.slice(0, 110)}...` : req.originalUrl;
    this.recentEvents.unshift({
      ts: new Date(now).toISOString(),
      method: req.method,
      path: shortPath,
      route,
      status,
      durationMs,
      bytesSent,
      clientHash,
      country,
      viaRender
    });
    if (this.recentEvents.length > 120) {
      this.recentEvents.pop();
    }

    this.dirty = true;
  }

  public recordSubtitleQuery(type: string, imdbId: string, languages: string[]): void {
    for (const lang of languages) {
      this.topLanguages.set(lang, (this.topLanguages.get(lang) || 0) + 1);
    }
    if (imdbId && imdbId.startsWith('tt')) {
      const cleanId = imdbId.split(':')[0];
      const existing = this.topMedia.get(cleanId);
      if (existing) {
        existing.count++;
        existing.lastSeen = Date.now();
      } else {
        if (this.topMedia.size >= 2000) {
          const oldest = this.topMedia.keys().next().value;
          if (oldest) this.topMedia.delete(oldest);
        }
        this.topMedia.set(cleanId, {
          imdbId: cleanId,
          type,
          count: 1,
          lastSeen: Date.now()
        });
      }
    }
    this.dirty = true;
  }

  public snapshot() {
    const now = Date.now();
    let active5m = 0;
    let active1h = 0;
    let active24h = 0;
    let active7d = 0;
    let renderUsers24h = 0;
    let renderUsersTotal = 0;
    const countryCounts = new Map<string, number>();

    for (const u of this.users.values()) {
      const age = now - u.lastSeen;
      if (age <= 5 * 60_000) active5m++;
      if (age <= 60 * 60_000) active1h++;
      if (age <= 24 * 3600_000) {
        active24h++;
        if (u.viaRender) renderUsers24h++;
      }
      if (age <= 7 * 24 * 3600_000) active7d++;
      if (u.viaRender) renderUsersTotal++;
      countryCounts.set(u.country, (countryCounts.get(u.country) || 0) + 1);
    }

    const curMin = Math.floor(now / 60000);
    const timeline60m: Array<{
      minuteOffset: number;
      label: string;
      requests: number;
      renderRequests: number;
      bytesSent: number;
      uniqueUsers: number;
    }> = [];

    for (let i = 59; i >= 0; i--) {
      const m = curMin - i;
      const b = this.minuteBuckets.get(m);
      const d = new Date(m * 60000);
      const hh = String(d.getUTCHours()).padStart(2, '0');
      const mm = String(d.getUTCMinutes()).padStart(2, '0');
      timeline60m.push({
        minuteOffset: -i,
        label: `${hh}:${mm}`,
        requests: b ? b.requests : 0,
        renderRequests: b ? b.renderRequests : 0,
        bytesSent: b ? b.bytesSent : 0,
        uniqueUsers: b ? b.users.size : 0
      });
    }

    const sortedLat = [...this.recentLatencies].sort((a, b) => a - b);
    const avgMs =
      sortedLat.length > 0
        ? Math.round(sortedLat.reduce((acc, v) => acc + v, 0) / sortedLat.length)
        : 0;
    const p95Ms =
      sortedLat.length > 0
        ? sortedLat[Math.min(sortedLat.length - 1, Math.floor(sortedLat.length * 0.95))]
        : 0;

    const searchStats = searchCache.stats();
    const subStats = subtitleContentCache.stats();
    const totalCacheLookups =
      searchStats.hits + searchStats.misses + subStats.hits + subStats.misses;
    const cacheHitRate =
      totalCacheLookups > 0
        ? Math.round(((searchStats.hits + subStats.hits) / totalCacheLookups) * 1000) / 10
        : 0;

    const mem = process.memoryUsage();

    return {
      now: new Date(now).toISOString(),
      startedAt: new Date(this.startedAt).toISOString(),
      uptimeSeconds: Math.floor((now - this.startedAt) / 1000),
      users: {
        active5m,
        active1h,
        active24h,
        active7d,
        totalUnique: this.users.size,
        topCountries: Array.from(countryCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 12)
          .map(([country, count]) => ({ country, count }))
      },
      traffic: {
        totalRequests: this.totalRequests,
        requestsLastMinute: timeline60m[timeline60m.length - 1]?.requests || 0,
        requestsLast60m: timeline60m.reduce((s, x) => s + x.requests, 0),
        totalBytesSent: this.totalBytesSent,
        totalBytesReceived: this.totalBytesReceived,
        avgLatencyMs: avgMs,
        p95LatencyMs: p95Ms,
        byStatus: this.byStatus,
        byRoute: this.byRoute
      },
      render: {
        redirectRequests: this.renderRedirectRequests,
        redirectRequests60m: timeline60m.reduce((s, x) => s + x.renderRequests, 0),
        legacyUsers24h: renderUsers24h,
        legacyUsersTotal: renderUsersTotal,
        estimatedRenderHeaderBytes: this.renderRedirectRequests * 220,
        offloadedBytes: this.renderOffloadedBytes
      },
      cache: {
        hitRatePercent: cacheHitRate,
        search: searchStats,
        subtitles: subStats
      },
      system: {
        rssBytes: mem.rss,
        heapUsedBytes: mem.heapUsed
      },
      topLanguages: Array.from(this.topLanguages.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([lang, count]) => ({ lang, count })),
      topMedia: Array.from(this.topMedia.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 15),
      timeline60m,
      recentEvents: this.recentEvents.slice(0, 60)
    };
  }
}

export const metrics = new MetricsCollector();
