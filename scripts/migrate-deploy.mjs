#!/usr/bin/env node
/**
 * Apply Prisma migrations at startup, safely.
 *
 * Production was originally managed with `prisma db push`, so its database has
 * tables but no migration history. `prisma migrate deploy` refuses to run
 * against such a database (P3005). In that one case, and only when the live
 * schema exactly matches the committed baseline (scripts/baseline.prisma), the
 * baseline migration is marked as applied and deploy is retried. Any drift
 * aborts startup instead of guessing - nothing is ever pushed or reset.
 */
import { spawnSync } from 'node:child_process'

const BASELINE_MIGRATION = '0000_init'
const BASELINE_SCHEMA = 'scripts/baseline.prisma'

function prisma(args, { capture = false } = {}) {
  const result = spawnSync('npx', ['--no-install', 'prisma', ...args], {
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    env: process.env,
  })
  return { status: result.status ?? 1, output: `${result.stdout ?? ''}${result.stderr ?? ''}` }
}

function deploy() {
  const result = prisma(['migrate', 'deploy'], { capture: true })
  process.stdout.write(result.output)
  return result
}

if (!process.env.DATABASE_URL) {
  console.error('[migrate] DATABASE_URL is not set; refusing to start.')
  process.exit(1)
}

let result = deploy()

if (result.status !== 0 && result.output.includes('P3005')) {
  console.log('[migrate] Database has tables but no migration history (created by `db push`).')
  console.log(`[migrate] Checking the live schema against ${BASELINE_SCHEMA} before baselining...`)

  const drift = prisma(
    ['migrate', 'diff', '--from-url', process.env.DATABASE_URL, '--to-schema-datamodel', BASELINE_SCHEMA, '--exit-code'],
    { capture: true }
  )

  if (drift.status !== 0) {
    console.error('[migrate] The live schema does not match the baseline. Refusing to mark it as applied.')
    console.error('[migrate] Differences (live -> baseline):')
    console.error(drift.output)
    process.exit(1)
  }

  console.log(`[migrate] Schema matches. Marking ${BASELINE_MIGRATION} as applied.`)
  const resolve = prisma(['migrate', 'resolve', '--applied', BASELINE_MIGRATION])
  if (resolve.status !== 0) process.exit(resolve.status)

  result = deploy()
}

process.exit(result.status)
