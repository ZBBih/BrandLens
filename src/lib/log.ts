/**
 * Structured JSON-line logging (G17)
 *
 * One line per event with a stable `event` name and fields such as reportId,
 * so Vercel's runtime log search can filter and count them.
 */

type Level = 'info' | 'warn' | 'error'
type Fields = Record<string, unknown>

function serializeError(error: unknown): Fields {
  if (error instanceof Error) {
    return { error: error.message, errorName: error.name, stack: error.stack?.split('\n').slice(0, 6).join('\n') }
  }
  return { error: String(error) }
}

function write(level: Level, event: string, fields: Fields = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields })
  if (level === 'error') process.stderr.write(line + '\n')
  else process.stdout.write(line + '\n')
}

export const log = {
  info: (event: string, fields?: Fields) => write('info', event, fields),
  warn: (event: string, fields?: Fields) => write('warn', event, fields),
  error: (event: string, error: unknown, fields?: Fields) => write('error', event, { ...fields, ...serializeError(error) }),
}
