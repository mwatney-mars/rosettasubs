interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class TTLCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private hits = 0;
  private misses = 0;

  constructor(
    private readonly defaultTtlMs: number = 15 * 60 * 1000,
    private readonly maxEntries: number = 1000
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

  stats(): { size: number; hits: number; misses: number; maxEntries: number } {
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      maxEntries: this.maxEntries
    };
  }
}

const defaultTtl = Number(process.env.CACHE_TTL_MS) || 15 * 60 * 1000;
export const searchCache = new TTLCache<unknown>(defaultTtl, 1000);
export const subtitleContentCache = new TTLCache<string>(60 * 60 * 1000, 500);
