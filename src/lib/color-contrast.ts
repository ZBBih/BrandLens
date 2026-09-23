/**
 * WCAG contrast helpers for rendering text on arbitrary brand colours (A14)
 */

export const INK = '#0f172a' // slate-900
export const PAPER = '#ffffff'

function parseHex(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  const value = match[1].length === 3 ? match[1].split('').map(c => c + c).join('') : match[1]
  const n = Number.parseInt(value, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map(c => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')}`
}

function channel(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex)
  if (!rgb) return 0
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2])
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** White or near-black, whichever reads better on `background` */
export function readableTextOn(background: string): string {
  return contrastRatio(PAPER, background) >= contrastRatio(INK, background) ? PAPER : INK
}

/**
 * Nudge `foreground` toward black or white until it reaches `minRatio`
 * against `background`, keeping as much of its hue as possible.
 */
export function ensureContrast(foreground: string, background: string, minRatio = 4.5): string {
  const fg = parseHex(foreground)
  if (!fg || !parseHex(background)) return readableTextOn(background)
  if (contrastRatio(foreground, background) >= minRatio) return toHex(fg)

  const target = parseHex(readableTextOn(background))!
  for (let step = 1; step <= 20; step++) {
    const t = step / 20
    const mixed = toHex([fg[0] + (target[0] - fg[0]) * t, fg[1] + (target[1] - fg[1]) * t, fg[2] + (target[2] - fg[2]) * t])
    if (contrastRatio(mixed, background) >= minRatio) return mixed
  }
  return toHex(target)
}

/** A valid 6-digit hex or the fallback */
export function safeHex(hex: string | undefined, fallback: string): string {
  const rgb = hex ? parseHex(hex) : null
  return rgb ? toHex(rgb) : fallback
}
