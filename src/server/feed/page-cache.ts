import type { ProviderPage } from '../providers/types.js'

interface Entry {
  page: ProviderPage
  expiresAt: number
}

/**
 * Bounded in-memory cache for successful provider pages. Entries expire after
 * the TTL; when full, the least recently written entry is evicted. On Vercel
 * it is per instance and short-lived, so it reduces but never prevents quota use.
 */
export class PageCache {
  private readonly entries = new Map<string, Entry>()

  private readonly maxEntries: number
  private readonly ttlMs: number
  private readonly now: () => number

  constructor(maxEntries = 200, ttlMs = 5 * 60 * 1000, now = Date.now) {
    this.maxEntries = maxEntries
    this.ttlMs = ttlMs
    this.now = now
  }

  get size() {
    return this.entries.size
  }

  get(key: string): ProviderPage | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key)
      return undefined
    }
    return entry.page
  }

  set(key: string, page: ProviderPage) {
    this.entries.delete(key)
    this.entries.set(key, { page, expiresAt: this.now() + this.ttlMs })
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value as string
      this.entries.delete(oldest)
    }
  }
}
