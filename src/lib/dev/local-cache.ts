/**
 * Local file-based cache for development
 * Saves analysis results to JSON files for instant reloading
 *
 * This is only used in development mode to speed up UI testing.
 */

import fs from 'fs'
import path from 'path'
import { BrandReport } from '@/lib/extractors/types'

const CACHE_DIR = path.join(process.cwd(), '.dev-cache')
const CACHE_INDEX_FILE = path.join(CACHE_DIR, 'index.json')

interface CacheEntry {
  domain: string
  cachedAt: string
  filePath: string
}

interface CacheIndex {
  entries: CacheEntry[]
  lastUpdated: string
}

/**
 * Ensure cache directory exists
 */
function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
  }
}

/**
 * Get the cache index
 */
function getCacheIndex(): CacheIndex {
  ensureCacheDir()
  if (fs.existsSync(CACHE_INDEX_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CACHE_INDEX_FILE, 'utf-8'))
    } catch {
      return { entries: [], lastUpdated: new Date().toISOString() }
    }
  }
  return { entries: [], lastUpdated: new Date().toISOString() }
}

/**
 * Save the cache index
 */
function saveCacheIndex(index: CacheIndex): void {
  ensureCacheDir()
  fs.writeFileSync(CACHE_INDEX_FILE, JSON.stringify(index, null, 2))
}

/**
 * Generate a safe filename from domain
 */
function domainToFilename(domain: string): string {
  return domain.replace(/[^a-zA-Z0-9.-]/g, '_') + '.json'
}

/**
 * Save a report to local cache
 */
export function saveLocalCache(domain: string, report: BrandReport): void {
  if (process.env.NODE_ENV !== 'development') {
    return
  }

  try {
    ensureCacheDir()

    const filename = domainToFilename(domain)
    const filePath = path.join(CACHE_DIR, filename)
    const cachedAt = new Date().toISOString()

    // Save the report
    const cacheData = {
      domain,
      cachedAt,
      report,
    }
    fs.writeFileSync(filePath, JSON.stringify(cacheData, null, 2))

    // Update index
    const index = getCacheIndex()
    const existingIndex = index.entries.findIndex(e => e.domain === domain)

    if (existingIndex >= 0) {
      index.entries[existingIndex] = { domain, cachedAt, filePath: filename }
    } else {
      index.entries.push({ domain, cachedAt, filePath: filename })
    }

    index.lastUpdated = cachedAt
    saveCacheIndex(index)

    console.log(`[DEV CACHE] Saved report for ${domain} to ${filename}`)
  } catch (error) {
    console.error('[DEV CACHE] Failed to save:', error)
  }
}

/**
 * Get a report from local cache
 */
export function getLocalCache(domain: string): { report: BrandReport; cachedAt: string } | null {
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  try {
    const filename = domainToFilename(domain)
    const filePath = path.join(CACHE_DIR, filename)

    if (!fs.existsSync(filePath)) {
      return null
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    return {
      report: data.report,
      cachedAt: data.cachedAt,
    }
  } catch (error) {
    console.error('[DEV CACHE] Failed to read:', error)
    return null
  }
}

/**
 * List all cached reports
 */
export function listLocalCache(): CacheEntry[] {
  if (process.env.NODE_ENV !== 'development') {
    return []
  }

  const index = getCacheIndex()
  return index.entries
}

/**
 * Clear all cached reports
 */
export function clearLocalCache(): void {
  if (process.env.NODE_ENV !== 'development') {
    return
  }

  try {
    if (fs.existsSync(CACHE_DIR)) {
      const files = fs.readdirSync(CACHE_DIR)
      for (const file of files) {
        fs.unlinkSync(path.join(CACHE_DIR, file))
      }
    }
    console.log('[DEV CACHE] Cleared all cached reports')
  } catch (error) {
    console.error('[DEV CACHE] Failed to clear:', error)
  }
}

/**
 * Delete a specific cached report
 */
export function deleteLocalCache(domain: string): boolean {
  if (process.env.NODE_ENV !== 'development') {
    return false
  }

  try {
    const filename = domainToFilename(domain)
    const filePath = path.join(CACHE_DIR, filename)

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)

      // Update index
      const index = getCacheIndex()
      index.entries = index.entries.filter(e => e.domain !== domain)
      index.lastUpdated = new Date().toISOString()
      saveCacheIndex(index)

      console.log(`[DEV CACHE] Deleted cache for ${domain}`)
      return true
    }
    return false
  } catch (error) {
    console.error('[DEV CACHE] Failed to delete:', error)
    return false
  }
}
