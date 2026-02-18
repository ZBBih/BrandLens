/**
 * Rate limiting utility
 * Stores usage data in a JSON file with in-memory fallback
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

// Configuration
const PER_IP_DAILY_LIMIT = 3
const GLOBAL_DAILY_LIMIT = 50
const DATA_FILE = join(process.cwd(), 'rate-limit-data.json')

interface RateLimitData {
  date: string // YYYY-MM-DD format
  globalCount: number
  ipCounts: Record<string, number>
}

// In-memory fallback for serverless/read-only environments
let memoryData: RateLimitData | null = null

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * Load rate limit data from file or memory
 */
function loadData(): RateLimitData {
  const today = getTodayDate()

  // Try file first
  if (existsSync(DATA_FILE)) {
    try {
      const raw = readFileSync(DATA_FILE, 'utf-8')
      const data = JSON.parse(raw) as RateLimitData

      // Reset if it's a new day
      if (data.date !== today) {
        memoryData = { date: today, globalCount: 0, ipCounts: {} }
        return memoryData
      }

      memoryData = data
      return data
    } catch {
      // Fall through to memory/default
    }
  }

  // Use memory data if available and current
  if (memoryData && memoryData.date === today) {
    return memoryData
  }

  // Return fresh data
  memoryData = { date: today, globalCount: 0, ipCounts: {} }
  return memoryData
}

/**
 * Save rate limit data to file (with memory fallback)
 */
function saveData(data: RateLimitData): void {
  // Always update memory
  memoryData = data

  // Try to save to file
  try {
    writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
  } catch (error) {
    // File save failed (read-only filesystem) - memory will be used
    console.warn('Rate limit file save failed, using memory:', error)
  }
}

/**
 * Check if a request is allowed and increment counters if so
 */
export function checkRateLimit(ip: string): {
  allowed: boolean
  reason?: 'ip_limit' | 'global_limit'
  remaining: {
    ip: number
    global: number
  }
} {
  const data = loadData()
  const ipCount = data.ipCounts[ip] || 0

  const remaining = {
    ip: Math.max(0, PER_IP_DAILY_LIMIT - ipCount),
    global: Math.max(0, GLOBAL_DAILY_LIMIT - data.globalCount),
  }

  // Check global limit first
  if (data.globalCount >= GLOBAL_DAILY_LIMIT) {
    return { allowed: false, reason: 'global_limit', remaining }
  }

  // Check per-IP limit
  if (ipCount >= PER_IP_DAILY_LIMIT) {
    return { allowed: false, reason: 'ip_limit', remaining }
  }

  return { allowed: true, remaining }
}

/**
 * Record a usage (call this after successful analysis start)
 */
export function recordUsage(ip: string): void {
  const data = loadData()

  data.globalCount += 1
  data.ipCounts[ip] = (data.ipCounts[ip] || 0) + 1

  saveData(data)
}

/**
 * Get current usage stats (for UI display)
 */
export function getUsageStats(ip?: string): {
  globalRemaining: number
  ipRemaining: number | null
  globalUsed: number
  ipUsed: number | null
} {
  const data = loadData()

  return {
    globalRemaining: Math.max(0, GLOBAL_DAILY_LIMIT - data.globalCount),
    globalUsed: data.globalCount,
    ipRemaining: ip ? Math.max(0, PER_IP_DAILY_LIMIT - (data.ipCounts[ip] || 0)) : null,
    ipUsed: ip ? (data.ipCounts[ip] || 0) : null,
  }
}

/**
 * Get the limits configuration
 */
export function getLimits() {
  return {
    perIp: PER_IP_DAILY_LIMIT,
    global: GLOBAL_DAILY_LIMIT,
  }
}
