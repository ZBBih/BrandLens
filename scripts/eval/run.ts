/**
 * Accuracy eval CLI.
 *
 *   npx tsx scripts/eval/run.ts [--snapshots <dir>] [--expected <file>] [--threshold <file>]
 *
 * Prints a per-brand table and totals, and exits non-zero when the total
 * falls below scripts/eval/threshold.json (1) or when no snapshot exists (2).
 */

import path from 'node:path'
import { cliMain } from './harness'

process.exitCode = cliMain(process.argv.slice(2), path.resolve(__dirname))
