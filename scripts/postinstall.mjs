#!/usr/bin/env node
/**
 * Download Playwright's Chromium for local development and tests.
 *
 * Skipped on Vercel: the browser in ~/.cache would never reach the function
 * bundle, and production uses @sparticuz/chromium instead.
 */
import { spawnSync } from 'node:child_process'

if (process.env.VERCEL) {
  console.log('[postinstall] Vercel build: skipping Playwright browser download (using @sparticuz/chromium)')
  process.exit(0)
}

const result = spawnSync('npx', ['--no-install', 'playwright', 'install', 'chromium'], { stdio: 'inherit' })
process.exit(result.status ?? 1)
