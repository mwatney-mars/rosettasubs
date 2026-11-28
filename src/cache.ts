import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  maxEntries: number;
  diskFiles?: number;
  diskBytes?: number;
}

export class TTLCache<T> {
  protected store = new Map<string, CacheEntry<T>>();
  protected hits = 0;
  protected misses = 0;

  constructor(
    protected readonly defaultTtlMs: number = 15 * 60 * 1000,
    protected readonly maxEntries: number = 1000
  ) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return undefined;
    }

    // Refresh LRU order
    this.store.delete(key);
    this.store.set(key, entry);
    this.hits++;
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number = this.defaultTtlMs): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs
    });
  }

  clear(): void {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
  }

  stats(): CacheStats {
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      maxEntries: this.maxEntries
    };
  }
}

export class PersistentSubtitleCache extends TTLCache<string> {
  private readonly diskDir: string | null;
  private readonly diskTtlMs: number;
  private diskFiles = 0;
  private diskBytes = 0;

  constructor(
    ramTtlMs: number = 24 * 60 * 60 * 1000,
    ramMaxEntries: number = 2000,
    diskDir?: string | null,
    diskTtlMs: number = 30 * 24 * 60 * 60 * 1000
  ) {
    super(ramTtlMs, ramMaxEntries);
    this.diskTtlMs = diskTtlMs;

    const isRenderEdge = Boolean(process.env.REDIRECT_TO_URL || process.env.RENDER === 'true');
    if (diskDir !== undefined) {
      this.diskDir = diskDir;
    } else if (process.env.NODE_ENV === 'test' || isRenderEdge) {
      this.diskDir = null;
    } else {
      this.diskDir = process.env.SUBTITLE_CACHE_DIR || '/data/cache/subtitles';
    }

    if (this.diskDir) {
      this.initDiskDirectory();
    }
  }

  private initDiskDirectory(): void {
    if (!this.diskDir) return;
    try {
      fs.mkdirSync(this.diskDir, { recursive: true });
      let files = 0;
      let bytes = 0;
      const now = Date.now();
      const shards = fs.readdirSync(this.diskDir, { withFileTypes: true });
      for (const shard of shards) {
        if (!shard.isDirectory()) continue;
        const shardPath = path.join(this.diskDir, shard.name);
        const entries = fs.readdirSync(shardPath, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isFile() || !entry.name.endsWith('.srt.gz')) continue;
          const fullPath = path.join(shardPath, entry.name);
          try {
            const st = fs.statSync(fullPath);
            if (now - st.mtimeMs > this.diskTtlMs) {
              fs.unlinkSync(fullPath);
            } else {
              files++;
              bytes += st.size;
            }
          } catch {
            // ignore race condition
          }
        }
      }
      this.diskFiles = files;
      this.diskBytes = bytes;
    } catch {
      // ignore disk init errors if volume is read-only
    }
  }

  private getFilePath(key: string): { dir: string; file: string } | null {
    if (!this.diskDir) return null;
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    const shard = hash.slice(0, 2);
    const dir = path.join(this.diskDir, shard);
    return { dir, file: path.join(dir, `${hash}.srt.gz`) };
  }

  override get(key: string): string | undefined {
    const entry = this.store.get(key);
    if (entry) {
      if (Date.now() <= entry.expiresAt) {
        this.store.delete(key);
        this.store.set(key, entry);
        this.hits++;
        return entry.value;
      }
      this.store.delete(key);
    }

    const loc = this.getFilePath(key);
    if (loc) {
      try {
        if (fs.existsSync(loc.file)) {
          const st = fs.statSync(loc.file);
          if (Date.now() - st.mtimeMs <= this.diskTtlMs) {
            const compressed = fs.readFileSync(loc.file);
            const value = zlib.gunzipSync(compressed).toString('utf8');
            super.set(key, value, this.defaultTtlMs);
            this.hits++;
            return value;
          }
          fs.unlinkSync(loc.file);
          this.diskFiles = Math.max(0, this.diskFiles - 1);
          this.diskBytes = Math.max(0, this.diskBytes - st.size);
        }
      } catch {
        // fall through to miss
      }
    }

    this.misses++;
    return undefined;
  }

  override set(key: string, value: string, ttlMs: number = this.defaultTtlMs): void {
    super.set(key, value, ttlMs);

    const loc = this.getFilePath(key);
    if (!loc || !value) return;

    try {
      fs.mkdirSync(loc.dir, { recursive: true });
      let prevSize = 0;
      const existed = fs.existsSync(loc.file);
      if (existed) {
        try {
          prevSize = fs.statSync(loc.file).size;
        } catch {
          prevSize = 0;
        }
      }
      const gz = zlib.gzipSync(Buffer.from(value, 'utf8'), { level: 1 });
      const tmpFile = `${loc.file}.${process.pid}.tmp`;
      fs.writeFileSync(tmpFile, gz);
      fs.renameSync(tmpFile, loc.file);
      if (!existed) {
        this.diskFiles++;
      }
      this.diskBytes = Math.max(0, this.diskBytes - prevSize + gz.length);
    } catch {
      // ignore disk write error
    }
  }

  override clear(): void {
    super.clear();
    if (!this.diskDir) return;
    try {
      fs.rmSync(this.diskDir, { recursive: true, force: true });
      fs.mkdirSync(this.diskDir, { recursive: true });
      this.diskFiles = 0;
      this.diskBytes = 0;
    } catch {
      // ignore
    }
  }

  override stats(): CacheStats {
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      maxEntries: this.maxEntries,
      diskFiles: this.diskFiles,
      diskBytes: this.diskBytes
    };
  }
}

export class PersistentSearchCache extends TTLCache<unknown> {
  private readonly persistFile: string | null;
  private dirty = false;

  constructor(defaultTtlMs: number, maxEntries: number, persistFile?: string | null) {
    super(defaultTtlMs, maxEntries);
    const isRenderEdge = Boolean(process.env.REDIRECT_TO_URL || process.env.RENDER === 'true');
    if (persistFile !== undefined) {
      this.persistFile = persistFile;
    } else if (process.env.NODE_ENV === 'test' || isRenderEdge) {
      this.persistFile = null;
    } else {
      this.persistFile = process.env.SEARCH_CACHE_FILE || '/data/cache/search-cache.json.gz';
    }

    if (this.persistFile) {
      this.loadFromDisk();
      const timer = setInterval(() => this.flushToDisk(), 30_000);
      timer.unref();
    }
  }

  override get(key: string): unknown {
    const val = super.get(key);
    this.dirty = true;
    return val;
  }

  override set(key: string, value: unknown, ttlMs: number = this.defaultTtlMs): void {
    super.set(key, value, ttlMs);
    this.dirty = true;
  }

  private loadFromDisk(): void {
    if (!this.persistFile) return;
    try {
      if (!fs.existsSync(this.persistFile)) return;
      const gz = fs.readFileSync(this.persistFile);
      const raw = zlib.gunzipSync(gz).toString('utf8');
      const data = JSON.parse(raw) as {
        hits?: number;
        misses?: number;
        entries?: Array<[string, CacheEntry<unknown>]>;
      };
      if (typeof data.hits === 'number') this.hits = data.hits;
      if (typeof data.misses === 'number') this.misses = data.misses;
      const now = Date.now();
      if (Array.isArray(data.entries)) {
        for (const [k, entry] of data.entries) {
          if (entry && typeof entry.expiresAt === 'number' && entry.expiresAt > now) {
            this.store.set(k, entry);
          }
        }
      }
    } catch {
      // ignore corrupt cache file
    }
  }

  public flushToDisk(): void {
    if (!this.persistFile || !this.dirty) return;
    try {
      const dir = path.dirname(this.persistFile);
      fs.mkdirSync(dir, { recursive: true });
      const now = Date.now();
      const validEntries: Array<[string, CacheEntry<unknown>]> = [];
      for (const [k, v] of this.store.entries()) {
        if (v.expiresAt > now) {
          validEntries.push([k, v]);
        }
      }
      const payload = JSON.stringify({
        hits: this.hits,
        misses: this.misses,
        entries: validEntries.slice(-this.maxEntries)
      });
      const gz = zlib.gzipSync(Buffer.from(payload, 'utf8'), { level: 1 });
      const tmp = `${this.persistFile}.tmp`;
      fs.writeFileSync(tmp, gz);
      fs.renameSync(tmp, this.persistFile);
      this.dirty = false;
    } catch {
      // ignore write error
    }
  }
}

const defaultTtl = Number(process.env.CACHE_TTL_MS) || 6 * 60 * 60 * 1000;
const searchCacheMax = Number(process.env.SEARCH_CACHE_MAX) || 10000;
const subtitleCacheMax = Number(process.env.SUBTITLE_CACHE_MAX) || 2000;
export const searchCache = new PersistentSearchCache(defaultTtl, searchCacheMax);
export const subtitleContentCache = new PersistentSubtitleCache(
  24 * 60 * 60 * 1000,
  subtitleCacheMax
);
