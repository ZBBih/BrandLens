/**
 * Apply owner edits to a report. Pure, so the server (share page, PDF, public
 * API) and the browser (live editing) produce identical results.
 */

import type { BrandReport, ColorEntry, FontEntry } from '../extractors/types'
import type { ReportOverrides } from './types'

export type EditedColorEntry = ColorEntry & { userEdited?: boolean }
export type EditedFontEntry = FontEntry & { userEdited?: boolean }

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!match) return null
  const value = Number.parseInt(match[1], 16)
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 }
}

export function colorKey(color: Pick<ColorEntry, 'hex'>): string {
  return color.hex.toLowerCase()
}

export function applyOverrides(report: BrandReport, overrides: ReportOverrides | undefined): BrandReport {
  if (!overrides) return report

  const colors: EditedColorEntry[] = []
  for (const color of report.colors.colors) {
    const edit = overrides.colors?.[colorKey(color)]
    if (edit?.hidden) continue
    if (!edit || (!edit.hex && !edit.role)) {
      colors.push(color)
      continue
    }
    const hex = edit.hex ?? color.hex
    colors.push({ ...color, hex, rgb: hexToRgb(hex) ?? color.rgb, role: edit.role ?? color.role, userEdited: true })
  }

  const fonts: EditedFontEntry[] = []
  for (const font of report.typography.fonts) {
    const edit = overrides.fonts?.[font.name]
    if (edit?.hidden) continue
    fonts.push(edit?.name ? { ...font, name: edit.name, googleFontsUrl: undefined, userEdited: true } : font)
  }

  const brandName = overrides.brandName?.trim() || report.brandName
  return {
    ...report,
    brandName,
    summary: { ...report.summary, name: brandName },
    colors: { ...report.colors, colors },
    typography: { ...report.typography, fonts },
  }
}
