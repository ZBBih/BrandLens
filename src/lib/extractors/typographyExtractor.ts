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
    hasUnresolvedVariables?: boolean
  }
  cssVariables: Record<string, string>  // resolved CSS variables
  unresolvedVars: string[]  // CSS variables that couldn't be resolved
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
  // Wait for fonts to be fully loaded
  await document.fonts.ready;

  // Additional wait for any JS-loaded fonts (e.g., Typekit)
  await new Promise(resolve => setTimeout(resolve, 500));

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

  // Icon font patterns to filter out
  const ICON_FONT_PATTERNS = [
    'fontawesome', 'font awesome', 'fa-', 'fa solid', 'fa brands', 'fa regular',
    'material', 'icon', 'awb-icons', 'revicons', 'icomoon', 'glyphicon',
    'dashicons', 'eleganticons', 'feather', 'ionicons', 'star', 'etmodules'
  ];

  function isIconFont(name) {
    const lower = name.toLowerCase();
    return ICON_FONT_PATTERNS.some(p => lower.includes(p));
  }

  // --- Step 1: Extract ALL CSS variables from :root and html ---
  const cssVariables = {};
  const rootStyles = getComputedStyle(document.documentElement);

  // Common font variable names to check
  const commonVarNames = [
    '--font-family', '--font-family-heading', '--font-family-body',
    '--font-heading', '--font-body', '--font-sans', '--font-serif',
    '--heading-font', '--body-font', '--primary-font', '--secondary-font',
    '--font-primary', '--font-secondary', '--ff-heading', '--ff-body',
    '--typography-heading', '--typography-body', '--font-display',
    '--font-main', '--font-text', '--font-title', '--base-font',
    '--heading-font-family', '--body-font-family', '--text-font-family'
  ];

  // Get values for common variable names
  commonVarNames.forEach(varName => {
    const value = rootStyles.getPropertyValue(varName).trim();
    if (value) {
      cssVariables[varName] = value;
    }
  });

  // Scan all stylesheets for :root and html font variable declarations
  try {
    Array.from(document.styleSheets).forEach(sheet => {
      try {
        Array.from(sheet.cssRules || []).forEach(rule => {
          if (rule instanceof CSSStyleRule &&
              (rule.selectorText === ':root' || rule.selectorText === 'html')) {
            const style = rule.style;
            for (let i = 0; i < style.length; i++) {
              const prop = style[i];
              if (prop.startsWith('--') && prop.toLowerCase().includes('font')) {
                const value = rootStyles.getPropertyValue(prop).trim();
                if (value) {
                  cssVariables[prop] = value;
                }
              }
            }
          }
        });
      } catch (e) {
        // Cross-origin stylesheet
      }
    });
  } catch (e) {}

  /**
   * Resolve CSS variable to actual font name
   * Handles nested variables like var(--font-heading, var(--font-sans))
   */
  function resolveCssVariable(value, depth = 0) {
    if (depth > 5) return value; // Prevent infinite recursion
    if (!value || !value.includes('var(')) return value;

    // Match var(--name) or var(--name, fallback)
    const varMatch = value.match(/var\\(([^,)]+)(?:,\\s*([^)]+))?\\)/);
    if (!varMatch) return value;

    const varName = varMatch[1].trim();
    const fallback = varMatch[2]?.trim();

    // Try to resolve from our collected variables
    let resolved = cssVariables[varName];
    if (!resolved) {
      // Try getting from computed style
      resolved = rootStyles.getPropertyValue(varName).trim();
    }

    if (resolved) {
      // Recursively resolve if the resolved value also contains var()
      return resolveCssVariable(resolved, depth + 1);
    }

    // Use fallback if available
    if (fallback) {
      return resolveCssVariable(fallback, depth + 1);
    }

    return value;
  }

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
   * Normalize font family - strip quotes, resolve variables, take first family
   */
  function normalizeFont(fontStack) {
    if (!fontStack) return '';

    // Resolve CSS variables first
    let resolved = resolveCssVariable(fontStack);

    // Get first font in stack
    const first = resolved.split(',')[0].trim();
    // Remove quotes
    return first.replace(/['"]/g, '').trim();
  }

  /**
   * Check if font is a system font
   */
  function isSystemFont(fontName) {
    return SYSTEM_FONTS.has(fontName.toLowerCase());
  }

  /**
   * Check if font name is unresolved (still has var() or --)
   */
  function isUnresolved(fontName) {
    return fontName.includes('var(') || fontName.startsWith('--');
  }

  // Collect font data from all visible text elements
  const headingFonts = {};  // font -> count
  const bodyFonts = {};     // font -> count
  const fontWeights = {};   // font -> Set of weights
  let totalScanned = 0;
  let headingCount = 0;
  let bodyCount = 0;

  // Track unresolved variable names for fallback handling
  const unresolvedVars = new Set();

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
    let fontName = normalizeFont(rawFont);
    const weight = computed.fontWeight;
    const tagName = el.tagName;

    if (!fontName) continue;

    // Track unresolved variables
    if (isUnresolved(fontName)) {
      unresolvedVars.add(fontName);
      continue; // Skip counting unresolved fonts
    }

    // Skip icon fonts
    if (isIconFont(fontName)) {
      continue;
    }

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

    // Parse family parameters - handles multiple formats:
    // fonts.googleapis.com/css?family=Roboto:400,700
    // fonts.googleapis.com/css2?family=Roboto:wght@400;700
    // fonts.googleapis.com/css2?family=Roboto&family=Open+Sans
    const familyMatches = href.match(/family=([^&]+)/g);
    if (familyMatches) {
      familyMatches.forEach(match => {
        const familyStr = match.replace('family=', '');
        // Handle multiple families separated by |
        const families = familyStr.split('|');

        families.forEach(family => {
          const parts = family.split(':');
          const name = decodeURIComponent(parts[0]).replace(/\\+/g, ' ').trim();

          // Extract weights
          let weights = ['400'];
          if (parts[1]) {
            // Handle wght@400;500;700 format
            const weightMatch = parts[1].match(/wght@([\\d;,]+)/);
            if (weightMatch) {
              weights = weightMatch[1].split(/[;,]/).filter(w => /^\\d+$/.test(w));
            } else {
              // Handle simple 400,700 format
              const simpleWeights = parts[1].split(/[;,]/).filter(w => /^\\d+$/.test(w));
              if (simpleWeights.length > 0) weights = simpleWeights;
            }
          }

          if (name && !SYSTEM_FONTS.has(name.toLowerCase()) && !isIconFont(name)) {
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
          const name = decodeURIComponent(familyMatch[1]).replace(/\\+/g, ' ').trim();
          if (!availableFonts.some(f => f.name.toLowerCase() === name.toLowerCase()) && !isIconFont(name)) {
            availableFonts.push({
              name,
              source: 'google',
              weights: ['400']
            });
          }
        }
      });
    }
  });

  // 3. Parse @font-face declarations from stylesheets
  // Also extract font names from src URLs (.woff, .woff2, .ttf, .otf)
  try {
    Array.from(document.styleSheets).forEach(sheet => {
      try {
        Array.from(sheet.cssRules || []).forEach(rule => {
          if (rule instanceof CSSFontFaceRule) {
            let fontFamily = rule.style.getPropertyValue('font-family').replace(/['"]/g, '').trim();
            const fontWeight = rule.style.getPropertyValue('font-weight') || '400';
            const src = rule.style.getPropertyValue('src') || '';

            // If font-family is empty or generic, try to extract from src URL
            if (!fontFamily || SYSTEM_FONTS.has(fontFamily.toLowerCase())) {
              // Try to extract font name from file path
              // e.g., url('/fonts/Montserrat-Bold.woff2') -> Montserrat
              const urlMatch = src.match(/url\\(['"]*([^'"\\)]+)['"]*\\)/);
              if (urlMatch) {
                const filePath = urlMatch[1];
                const fileName = filePath.split('/').pop()?.split('.')[0] || '';
                // Remove weight/style suffixes like -Bold, -Regular, -Italic
                const cleanName = fileName.replace(/[-_](Bold|Regular|Italic|Light|Medium|SemiBold|ExtraBold|Thin|Black|Heavy|Book|Normal|\\d+)/gi, '');
                if (cleanName && cleanName.length > 2) {
                  fontFamily = cleanName.replace(/[-_]/g, ' ').trim();
                }
              }
            }

            if (fontFamily && !isIconFont(fontFamily)) {
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

  // 4. Detect Adobe Fonts (Typekit) and try to extract font names
  const typekitLink = document.querySelector('link[href*="use.typekit.net"]');
  const typekitScript = document.querySelector('script[src*="use.typekit.net"]');
  const hasAdobeFonts = !!typekitLink || !!typekitScript;

  if (hasAdobeFonts) {
    const typekitUrl = typekitLink?.getAttribute('href') ||
                       typekitScript?.getAttribute('src') ||
                       'use.typekit.net';

    // Extract kit ID from URL (e.g., use.typekit.net/abc1def.css -> abc1def)
    const kitIdMatch = typekitUrl.match(/use\\.typekit\\.net\\/([a-z0-9]+)/i);
    const kitId = kitIdMatch ? kitIdMatch[1] : null;

    // Try to find Adobe font names from loaded document.fonts
    const adobeFontNames = [];
    try {
      document.fonts.forEach(font => {
        if (font.status === 'loaded') {
          const name = font.family.replace(/['"]/g, '');
          // Adobe Fonts often have specific naming patterns
          // Check if this font isn't from Google or our @font-face
          const isFromGoogle = availableFonts.some(f =>
            f.source === 'google' && f.name.toLowerCase() === name.toLowerCase()
          );
          const isFromFontFace = availableFonts.some(f =>
            f.source === 'fontface' && f.name.toLowerCase() === name.toLowerCase()
          );
          if (!isFromGoogle && !isFromFontFace && !SYSTEM_FONTS.has(name.toLowerCase()) && !isIconFont(name)) {
            if (!adobeFontNames.includes(name)) {
              adobeFontNames.push(name);
            }
          }
        }
      });
    } catch (e) {}

    // Add Adobe Fonts with extracted names
    if (adobeFontNames.length > 0) {
      adobeFontNames.forEach(name => {
        availableFonts.push({
          name,
          source: 'adobe',
          url: typekitUrl,
          weights: ['400'] // Adobe Fonts weights are dynamic
        });
      });
    } else {
      // Fallback: add generic Adobe Fonts entry with kit ID
      availableFonts.push({
        name: kitId ? 'Adobe Fonts (Kit: ' + kitId + ')' : 'Adobe Fonts (Typekit)',
        source: 'adobe',
        url: typekitUrl
      });
    }
  }

  // 5. Get all loaded fonts from document.fonts API that we haven't captured
  // This is the most reliable source - these fonts are actually loaded and rendering
  try {
    const fontWeightsFromAPI = {};
    document.fonts.forEach(font => {
      if (font.status === 'loaded') {
        const fontName = font.family.replace(/['"]/g, '');
        if (!fontWeightsFromAPI[fontName]) {
          fontWeightsFromAPI[fontName] = [];
        }
        fontWeightsFromAPI[fontName].push(font.weight);
      }
    });

    Object.entries(fontWeightsFromAPI).forEach(([fontName, weights]) => {
      const alreadyHave = availableFonts.some(f =>
        f.name.toLowerCase() === fontName.toLowerCase()
      );
      if (!alreadyHave && !SYSTEM_FONTS.has(fontName.toLowerCase()) && !isIconFont(fontName)) {
        availableFonts.push({
          name: fontName,
          source: 'fontface', // Loaded but unknown source - likely self-hosted
          weights: [...new Set(weights)]
        });
      }
    });
  } catch (e) {}

  // --- Detect non-inspectable text sources ---
  const flags = {
    canvasTextPossible: false,
    textInImagesPossible: false,
    hasUnresolvedVariables: unresolvedVars.size > 0
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
    cssVariables,
    unresolvedVars: Array.from(unresolvedVars),
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
    flags: raw.flags || { canvasTextPossible: false, textInImagesPossible: false, hasUnresolvedVariables: false },
    cssVariables: raw.cssVariables || {},
    unresolvedVars: raw.unresolvedVars || [],
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
  if (flags.hasUnresolvedVariables) {
    warnings.push('CSS variables that could not be resolved');
  }

  if (warnings.length === 0) return null;

  return `Some fonts may be embedded in ${warnings.join(' and ')} and cannot be reliably identified.`;
}

/**
 * Clean font name for display - handles unresolved variables
 * Returns "Custom Font (unidentified)" for truly unidentifiable fonts
 */
export function cleanFontNameForDisplay(fontName: string): string {
  if (!fontName) return 'Custom Font (unidentified)';

  // Check if it's an unresolved CSS variable
  if (fontName.includes('var(') || fontName.startsWith('--')) {
    return 'Custom Font (unidentified)';
  }

  // Remove any remaining quotes
  return fontName.replace(/['"]/g, '').trim() || 'Custom Font (unidentified)';
}
