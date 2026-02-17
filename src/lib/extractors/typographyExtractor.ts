/**
 * Typography Extractor - Comprehensive font detection from ALL visible text elements
 *
 * This module scans all visible text-bearing elements and aggregates font usage
 * by category (headings vs body) to determine primary fonts with confidence scores.
 */

/**
 * Result from scanning all text elements
 */
export interface TypographyExtractionResult {
  primaryBodyFont: string | null
  primaryHeadingFont: string | null
  fontWeights: Record<string, Set<string>>  // font name -> weights seen
  confidence: number  // 0-100 based on coverage
  availableFonts: AvailableFont[]  // fonts from CSS sources
  flags: {
    canvasTextPossible: boolean
    textInImagesPossible: boolean
  }
  stats: {
    totalElementsScanned: number
    headingElementsCount: number
    bodyElementsCount: number
  }
  rawFontCounts: {
    headings: Record<string, number>
    body: Record<string, number>
  }
}

/**
 * Font available in CSS but not necessarily used
 */
export interface AvailableFont {
  name: string
  source: 'google' | 'adobe' | 'fontface' | 'css-import'
  weights?: string[]
  url?: string
}

/**
 * Element font data collected during scan
 */
interface ElementFontData {
  fontFamily: string
  fontWeight: string
  fontSize: string
  tagName: string
}

/**
 * The extraction script to run inside page.evaluate()
 * This scans ALL visible text elements and collects font data
 */
export function getTypographyExtractionScript(): string {
  return `
(async () => {
  // Wait for fonts to be ready
  await document.fonts.ready;

  // Text-bearing tags to scan
  const TEXT_TAGS = ['P', 'SPAN', 'A', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
                     'BUTTON', 'LABEL', 'INPUT', 'TEXTAREA', 'DIV', 'TD', 'TH',
                     'BLOCKQUOTE', 'FIGCAPTION', 'STRONG', 'EM', 'B', 'I', 'SMALL'];

  // Heading tags for categorization
  const HEADING_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

  // System fonts to filter out when determining "custom" fonts
  const SYSTEM_FONTS = new Set([
    'arial', 'helvetica', 'verdana', 'georgia', 'times', 'times new roman',
    'courier', 'courier new', 'sans-serif', 'serif', 'monospace', 'cursive',
    'fantasy', 'system-ui', '-apple-system', 'blinkmacsystemfont', 'segoe ui',
    'roboto', 'oxygen', 'ubuntu', 'cantarell', 'fira sans', 'droid sans',
    'helvetica neue', 'inherit', 'initial', 'unset', 'ui-sans-serif',
    'ui-serif', 'ui-monospace', 'sf pro', 'sf pro display', 'sf pro text'
  ]);

  /**
   * Check if element is visible
   */
  function isVisible(el) {
    if (!el.getClientRects || el.getClientRects().length === 0) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;
    if (parseFloat(style.opacity) === 0) return false;
    return true;
  }

  /**
   * Check if element has meaningful text
   */
  function hasText(el) {
    const text = el.innerText || el.textContent || '';
    return text.trim().length > 0;
  }

  /**
   * Normalize font family - strip quotes, take first family
   */
  function normalizeFont(fontStack) {
    if (!fontStack) return '';
    // Get first font in stack
    const first = fontStack.split(',')[0].trim();
    // Remove quotes
    return first.replace(/['"]/g, '').trim();
  }

  /**
   * Check if font is a system font
   */
  function isSystemFont(fontName) {
    return SYSTEM_FONTS.has(fontName.toLowerCase());
  }

  // Collect font data from all visible text elements
  const headingFonts = {};  // font -> count
  const bodyFonts = {};     // font -> count
  const fontWeights = {};   // font -> Set of weights
  let totalScanned = 0;
  let headingCount = 0;
  let bodyCount = 0;

  // Get all text-bearing elements
  const selector = TEXT_TAGS.join(',');
  const elements = document.querySelectorAll(selector);

  for (const el of elements) {
    // Skip invisible elements
    if (!isVisible(el)) continue;
    // Skip elements without text
    if (!hasText(el)) continue;

    totalScanned++;

    const computed = window.getComputedStyle(el);
    const rawFont = computed.fontFamily;
    const fontName = normalizeFont(rawFont);
    const weight = computed.fontWeight;
    const tagName = el.tagName;

    if (!fontName) continue;

    // Track weights per font
    if (!fontWeights[fontName]) {
      fontWeights[fontName] = new Set();
    }
    fontWeights[fontName].add(weight);

    // Categorize by tag type
    if (HEADING_TAGS.has(tagName)) {
      headingCount++;
      headingFonts[fontName] = (headingFonts[fontName] || 0) + 1;
    } else {
      bodyCount++;
      bodyFonts[fontName] = (bodyFonts[fontName] || 0) + 1;
    }
  }

  // Find primary fonts (most common in each category)
  function findPrimary(fontCounts) {
    let maxCount = 0;
    let primary = null;

    for (const [font, count] of Object.entries(fontCounts)) {
      if (count > maxCount) {
        maxCount = count;
        primary = font;
      }
    }
    return primary;
  }

  const primaryBodyFont = findPrimary(bodyFonts);
  const primaryHeadingFont = findPrimary(headingFonts);

  // Calculate confidence based on coverage
  const totalElements = document.querySelectorAll(selector).length;
  const coverage = totalElements > 0 ? (totalScanned / totalElements) * 100 : 0;
  const confidence = Math.min(100, Math.round(coverage));

  // --- Extract available fonts from CSS sources ---
  const availableFonts = [];

  // 1. Parse Google Fonts from link tags
  document.querySelectorAll('link[href*="fonts.googleapis.com"]').forEach(link => {
    const href = link.getAttribute('href') || '';

    // Parse family parameters
    const familyMatches = href.match(/family=([^&]+)/g);
    if (familyMatches) {
      familyMatches.forEach(match => {
        const familyStr = match.replace('family=', '');
        // Handle multiple families separated by |
        const families = familyStr.split('|');

        families.forEach(family => {
          const parts = family.split(':');
          const name = parts[0].replace(/\\+/g, ' ').trim();

          // Extract weights
          let weights = ['400'];
          if (parts[1]) {
            const weightMatch = parts[1].match(/wght@([\\d;,]+)/);
            if (weightMatch) {
              weights = weightMatch[1].split(/[;,]/).filter(w => /^\\d+$/.test(w));
            } else {
              const simpleWeights = parts[1].split(/[;,]/).filter(w => /^\\d+$/.test(w));
              if (simpleWeights.length > 0) weights = simpleWeights;
            }
          }

          if (name) {
            availableFonts.push({
              name,
              source: 'google',
              weights,
              url: href
            });
          }
        });
      });
    }
  });

  // 2. Parse Google Fonts from @import in style tags
  document.querySelectorAll('style').forEach(style => {
    const text = style.textContent || '';
    const importMatches = text.match(/@import[^;]*fonts\\.googleapis\\.com[^;]*/g);
    if (importMatches) {
      importMatches.forEach(imp => {
        const familyMatch = imp.match(/family=([^&:'"\\)]+)/);
        if (familyMatch) {
          const name = familyMatch[1].replace(/\\+/g, ' ').trim();
          availableFonts.push({
            name,
            source: 'google',
            weights: ['400']
          });
        }
      });
    }
  });

  // 3. Parse @font-face declarations from stylesheets
  try {
    Array.from(document.styleSheets).forEach(sheet => {
      try {
        Array.from(sheet.cssRules || []).forEach(rule => {
          if (rule instanceof CSSFontFaceRule) {
            const fontFamily = rule.style.getPropertyValue('font-family').replace(/['"]/g, '').trim();
            const fontWeight = rule.style.getPropertyValue('font-weight') || '400';

            if (fontFamily) {
              // Check if we already have this font
              const existing = availableFonts.find(f =>
                f.name.toLowerCase() === fontFamily.toLowerCase() && f.source === 'fontface'
              );

              if (existing) {
                if (!existing.weights.includes(fontWeight)) {
                  existing.weights.push(fontWeight);
                }
              } else {
                availableFonts.push({
                  name: fontFamily,
                  source: 'fontface',
                  weights: [fontWeight]
                });
              }
            }
          }
        });
      } catch (e) {
        // Cross-origin stylesheet
      }
    });
  } catch (e) {
    // Error accessing stylesheets
  }

  // 4. Detect Adobe Fonts (Typekit)
  const hasAdobeFonts = !!document.querySelector('link[href*="use.typekit.net"]') ||
                        !!document.querySelector('script[src*="use.typekit.net"]');
  if (hasAdobeFonts) {
    const typekitLink = document.querySelector('link[href*="use.typekit.net"]');
    availableFonts.push({
      name: 'Adobe Fonts (Typekit)',
      source: 'adobe',
      url: typekitLink?.getAttribute('href') || 'use.typekit.net'
    });
  }

  // --- Detect non-inspectable text sources ---
  const flags = {
    canvasTextPossible: false,
    textInImagesPossible: false
  };

  // Check for canvas elements
  const canvasElements = document.querySelectorAll('canvas');
  if (canvasElements.length > 0) {
    flags.canvasTextPossible = true;
  }

  // Check for images that might contain text (heuristic: large images in hero areas)
  const heroImages = document.querySelectorAll(
    '[class*="hero"] img, [class*="banner"] img, [class*="header"] img:not([class*="logo"]), ' +
    'section:first-of-type img, .jumbotron img'
  );

  for (const img of heroImages) {
    const rect = img.getBoundingClientRect();
    // Large images (> 400px width, > 200px height) in prominent positions may contain text
    if (rect.width > 400 && rect.height > 200) {
      flags.textInImagesPossible = true;
      break;
    }
  }

  // Convert fontWeights Sets to arrays for JSON serialization
  const fontWeightsArray = {};
  for (const [font, weights] of Object.entries(fontWeights)) {
    fontWeightsArray[font] = Array.from(weights);
  }

  return {
    primaryBodyFont,
    primaryHeadingFont,
    fontWeights: fontWeightsArray,
    confidence,
    availableFonts,
    flags,
    stats: {
      totalElementsScanned: totalScanned,
      headingElementsCount: headingCount,
      bodyElementsCount: bodyCount
    },
    rawFontCounts: {
      headings: headingFonts,
      body: bodyFonts
    }
  };
})()
`;
}

/**
 * Process raw extraction result and clean up data
 */
export function processExtractionResult(raw: any): TypographyExtractionResult {
  // Convert fontWeights arrays back to Sets
  const fontWeights: Record<string, Set<string>> = {};
  if (raw.fontWeights) {
    for (const [font, weights] of Object.entries(raw.fontWeights)) {
      fontWeights[font] = new Set(weights as string[]);
    }
  }

  return {
    primaryBodyFont: raw.primaryBodyFont || null,
    primaryHeadingFont: raw.primaryHeadingFont || null,
    fontWeights,
    confidence: raw.confidence || 0,
    availableFonts: raw.availableFonts || [],
    flags: raw.flags || { canvasTextPossible: false, textInImagesPossible: false },
    stats: raw.stats || { totalElementsScanned: 0, headingElementsCount: 0, bodyElementsCount: 0 },
    rawFontCounts: raw.rawFontCounts || { headings: {}, body: {} }
  };
}

/**
 * Generate warning message for non-inspectable text
 */
export function getNonInspectableTextWarning(flags: TypographyExtractionResult['flags']): string | null {
  const warnings: string[] = [];

  if (flags.canvasTextPossible) {
    warnings.push('canvas elements');
  }
  if (flags.textInImagesPossible) {
    warnings.push('images');
  }

  if (warnings.length === 0) return null;

  return `Some text may be embedded in ${warnings.join(' and ')} and cannot be reliably identified.`;
}
