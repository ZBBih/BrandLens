/**
 * PDF Report Generator using @react-pdf/renderer
 */

import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Link,
} from '@react-pdf/renderer'
import { BrandReport } from '../extractors/types'

// Register fonts
Font.register({
  family: 'Inter',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff2',
      fontWeight: 400,
    },
    {
      src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hjp-Ek-_EeA.woff2',
      fontWeight: 600,
    },
    {
      src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hjp-Ek-_EeA.woff2',
      fontWeight: 700,
    },
  ],
})

// Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Inter',
    fontSize: 10,
    color: '#1a1a1a',
  },
  coverPage: {
    padding: 60,
    fontFamily: 'Inter',
    backgroundColor: '#f8fafc',
    height: '100%',
    justifyContent: 'center',
  },
  coverTitle: {
    fontSize: 36,
    fontWeight: 700,
    marginBottom: 16,
    color: '#0f172a',
  },
  coverSubtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 8,
  },
  coverDate: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 12,
    color: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 6,
  },
  sectionContent: {
    fontSize: 10,
    lineHeight: 1.6,
  },
  subsection: {
    marginBottom: 12,
  },
  subsectionTitle: {
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 6,
    color: '#334155',
  },
  paragraph: {
    marginBottom: 8,
    lineHeight: 1.6,
  },
  list: {
    marginLeft: 12,
    marginBottom: 8,
  },
  listItem: {
    marginBottom: 4,
    lineHeight: 1.5,
  },
  badge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 8,
    color: '#475569',
    marginRight: 4,
  },
  confidenceBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 8,
    color: '#166534',
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 4,
    marginRight: 8,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  fontRow: {
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
  },
  table: {
    marginBottom: 12,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 6,
  },
  tableHeader: {
    backgroundColor: '#f1f5f9',
    fontWeight: 600,
  },
  tableCell: {
    flex: 1,
    paddingHorizontal: 4,
  },
  link: {
    color: '#2563eb',
    textDecoration: 'underline',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#94a3b8',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tocItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  evidenceBox: {
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 4,
    marginTop: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#cbd5e1',
  },
  evidenceText: {
    fontSize: 8,
    color: '#64748b',
    fontStyle: 'italic',
  },
})

// Helper Components
const ConfidenceBadge: React.FC<{ confidence: number; source: string }> = ({
  confidence,
  source,
}) => {
  const color = confidence >= 80 ? '#166534' : confidence >= 60 ? '#ca8a04' : '#dc2626'
  const bgColor = confidence >= 80 ? '#dcfce7' : confidence >= 60 ? '#fef9c3' : '#fee2e2'

  return (
    <View style={{ flexDirection: 'row', marginBottom: 4 }}>
      <Text style={[styles.badge, { backgroundColor: bgColor, color }]}>
        {confidence}% confidence
      </Text>
      <Text style={styles.badge}>{source}</Text>
    </View>
  )
}

// Cover Page
const CoverPage: React.FC<{ report: BrandReport }> = ({ report }) => (
  <Page size="A4" style={styles.coverPage}>
    <Text style={styles.coverTitle}>{report.brandName}</Text>
    <Text style={styles.coverSubtitle}>Brand Guidelines Report</Text>
    <Text style={styles.coverSubtitle}>{report.domain}</Text>
    <Text style={styles.coverDate}>
      Generated: {new Date(report.generatedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}
    </Text>
    {report.cached && (
      <Text style={[styles.coverDate, { color: '#f59e0b' }]}>
        (Cached report)
      </Text>
    )}
  </Page>
)

// Table of Contents
const TableOfContents: React.FC = () => (
  <Page size="A4" style={styles.page}>
    <Text style={styles.sectionTitle}>Table of Contents</Text>
    {[
      'Brand Summary',
      'Tone & Voice',
      'Typography',
      'Color Palette',
      'SEO Snapshot',
      'GEO Snapshot',
      'Marketing Examples',
      'Brand Channels',
      'Evidence Appendix',
    ].map((item, index) => (
      <View key={item} style={styles.tocItem}>
        <Text>{item}</Text>
        <Text>{index + 3}</Text>
      </View>
    ))}
  </Page>
)

// Brand Summary Section
const BrandSummarySection: React.FC<{ report: BrandReport }> = ({ report }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Brand Summary</Text>
    <ConfidenceBadge confidence={report.summary.confidence} source={report.summary.source} />
    <Text style={styles.paragraph}>{report.summary.description}</Text>
    {report.summary.missionStatement && (
      <View style={styles.subsection}>
        <Text style={styles.subsectionTitle}>Mission Statement</Text>
        <Text style={styles.paragraph}>{report.summary.missionStatement}</Text>
      </View>
    )}
    {report.summary.valueProposition && (
      <View style={styles.subsection}>
        <Text style={styles.subsectionTitle}>Value Proposition</Text>
        <Text style={styles.paragraph}>{report.summary.valueProposition}</Text>
      </View>
    )}
    {report.summary.targetAudience && (
      <View style={styles.subsection}>
        <Text style={styles.subsectionTitle}>Target Audience</Text>
        <Text style={styles.paragraph}>{report.summary.targetAudience}</Text>
      </View>
    )}
    {report.summary.industry && (
      <View style={styles.subsection}>
        <Text style={styles.subsectionTitle}>Industry</Text>
        <Text style={styles.paragraph}>{report.summary.industry}</Text>
      </View>
    )}
  </View>
)

// Tone & Voice Section
const ToneVoiceSection: React.FC<{ report: BrandReport }> = ({ report }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Tone & Voice</Text>
    <ConfidenceBadge confidence={report.tone.confidence} source={report.tone.source} />

    <View style={styles.subsection}>
      <Text style={styles.subsectionTitle}>Tone Traits</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
        {report.tone.traits.map((trait) => (
          <Text key={trait} style={[styles.badge, { marginBottom: 4 }]}>
            {trait}
          </Text>
        ))}
      </View>
    </View>

    <View style={styles.subsection}>
      <Text style={styles.subsectionTitle}>Do&apos;s</Text>
      <View style={styles.list}>
        {report.tone.doList.map((item, i) => (
          <Text key={i} style={styles.listItem}>• {item}</Text>
        ))}
      </View>
    </View>

    <View style={styles.subsection}>
      <Text style={styles.subsectionTitle}>Don&apos;ts</Text>
      <View style={styles.list}>
        {report.tone.dontList.map((item, i) => (
          <Text key={i} style={styles.listItem}>• {item}</Text>
        ))}
      </View>
    </View>

    {report.tone.sampleHeadlines.length > 0 && (
      <View style={styles.subsection}>
        <Text style={styles.subsectionTitle}>Sample Headlines</Text>
        <View style={styles.list}>
          {report.tone.sampleHeadlines.map((headline, i) => (
            <Text key={i} style={styles.listItem}>{i + 1}. {headline}</Text>
          ))}
        </View>
      </View>
    )}

    {report.tone.sampleCtas.length > 0 && (
      <View style={styles.subsection}>
        <Text style={styles.subsectionTitle}>Sample CTAs</Text>
        <View style={styles.list}>
          {report.tone.sampleCtas.map((cta, i) => (
            <Text key={i} style={styles.listItem}>• {cta}</Text>
          ))}
        </View>
      </View>
    )}
  </View>
)

// Typography Section
const TypographySection: React.FC<{ report: BrandReport }> = ({ report }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Typography</Text>

    {report.typography.googleFontsDetected && (
      <Text style={[styles.badge, { marginBottom: 8 }]}>Google Fonts Detected</Text>
    )}

    {report.typography.fonts.map((font) => (
      <View key={font.name} style={styles.fontRow}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ fontWeight: 600 }}>{font.name}</Text>
          <Text style={styles.badge}>{font.role}</Text>
        </View>
        <ConfidenceBadge confidence={font.confidence} source={font.source} />
        {font.variants && font.variants.length > 0 && (
          <Text style={{ fontSize: 8, color: '#64748b' }}>
            Variants: {font.variants.join(', ')}
          </Text>
        )}
      </View>
    ))}

    {report.typography.fonts.length === 0 && (
      <Text style={styles.paragraph}>No custom fonts detected.</Text>
    )}
  </View>
)

// Color Palette Section
const ColorPaletteSection: React.FC<{ report: BrandReport }> = ({ report }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Color Palette</Text>

    {report.colors.colors.map((color) => (
      <View key={color.hex} style={styles.colorRow}>
        <View style={[styles.colorSwatch, { backgroundColor: color.hex }]} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
            <Text style={{ fontWeight: 600, marginRight: 8 }}>{color.hex.toUpperCase()}</Text>
            <Text style={styles.badge}>{color.role}</Text>
          </View>
          <Text style={{ fontSize: 8, color: '#64748b' }}>
            RGB: {color.rgb.r}, {color.rgb.g}, {color.rgb.b}
          </Text>
          {color.cssVariable && (
            <Text style={{ fontSize: 8, color: '#64748b' }}>{color.cssVariable}</Text>
          )}
        </View>
        <Text style={[styles.badge, { backgroundColor: color.source === 'verified' ? '#dcfce7' : '#f1f5f9' }]}>
          {color.source}
        </Text>
      </View>
    ))}

    {report.colors.colors.length === 0 && (
      <Text style={styles.paragraph}>No colors extracted.</Text>
    )}
  </View>
)

// SEO Snapshot Section
const SeoSection: React.FC<{ report: BrandReport }> = ({ report }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>SEO Snapshot</Text>
    <ConfidenceBadge confidence={report.seo.confidence} source={report.seo.source} />

    <View style={styles.subsection}>
      <Text style={styles.subsectionTitle}>Title Patterns</Text>
      <View style={styles.list}>
        {report.seo.titlePatterns.map((pattern, i) => (
          <Text key={i} style={styles.listItem}>• {pattern}</Text>
        ))}
      </View>
    </View>

    <View style={styles.subsection}>
      <Text style={styles.subsectionTitle}>Description Patterns</Text>
      <View style={styles.list}>
        {report.seo.descriptionPatterns.map((pattern, i) => (
          <Text key={i} style={styles.listItem}>• {pattern}</Text>
        ))}
      </View>
    </View>

    <View style={styles.subsection}>
      <Text style={styles.subsectionTitle}>H1 Usage</Text>
      <View style={styles.list}>
        {report.seo.h1Patterns.map((pattern, i) => (
          <Text key={i} style={styles.listItem}>• {pattern}</Text>
        ))}
      </View>
    </View>

    <View style={styles.subsection}>
      <Text style={styles.subsectionTitle}>Technical SEO</Text>
      <Text style={styles.listItem}>
        • Canonical tags: {report.seo.hasCanonical ? 'Present' : 'Not found'}
      </Text>
      {report.seo.schemaTypes.length > 0 && (
        <Text style={styles.listItem}>
          • Schema types: {report.seo.schemaTypes.join(', ')}
        </Text>
      )}
    </View>
  </View>
)

// GEO Snapshot Section
const GeoSection: React.FC<{ report: BrandReport }> = ({ report }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>GEO Snapshot</Text>
    <ConfidenceBadge confidence={report.geo.confidence} source={report.geo.source} />

    {report.geo.addresses.length > 0 && (
      <View style={styles.subsection}>
        <Text style={styles.subsectionTitle}>Addresses</Text>
        <View style={styles.list}>
          {report.geo.addresses.map((addr, i) => (
            <Text key={i} style={styles.listItem}>• {addr}</Text>
          ))}
        </View>
      </View>
    )}

    {report.geo.phoneNumbers.length > 0 && (
      <View style={styles.subsection}>
        <Text style={styles.subsectionTitle}>Phone Numbers</Text>
        <View style={styles.list}>
          {report.geo.phoneNumbers.map((phone, i) => (
            <Text key={i} style={styles.listItem}>• {phone}</Text>
          ))}
        </View>
      </View>
    )}

    <View style={styles.subsection}>
      <Text style={styles.subsectionTitle}>Local SEO Signals</Text>
      <Text style={styles.listItem}>
        • Google Maps embed: {report.geo.hasGoogleMaps ? 'Yes' : 'No'}
      </Text>
      <Text style={styles.listItem}>
        • LocalBusiness schema: {report.geo.hasLocalBusinessSchema ? 'Yes' : 'No'}
      </Text>
      {report.geo.locationPages.length > 0 && (
        <Text style={styles.listItem}>
          • Location pages found: {report.geo.locationPages.length}
        </Text>
      )}
    </View>
  </View>
)

// Marketing Section
const MarketingSection: React.FC<{ report: BrandReport }> = ({ report }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Marketing Examples</Text>

    {report.marketing.ctaPatterns.length > 0 && (
      <View style={styles.subsection}>
        <Text style={styles.subsectionTitle}>CTA Patterns</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {report.marketing.ctaPatterns.slice(0, 10).map((cta, i) => (
            <Text key={i} style={[styles.badge, { marginBottom: 4 }]}>{cta}</Text>
          ))}
        </View>
      </View>
    )}

    {report.marketing.newsletterSignupLanguage.length > 0 && (
      <View style={styles.subsection}>
        <Text style={styles.subsectionTitle}>Newsletter Signup Language</Text>
        <View style={styles.list}>
          {report.marketing.newsletterSignupLanguage.map((text, i) => (
            <Text key={i} style={styles.listItem}>• {text}</Text>
          ))}
        </View>
      </View>
    )}

    {report.marketing.elements.filter(e => e.type === 'trust_badge').length > 0 && (
      <View style={styles.subsection}>
        <Text style={styles.subsectionTitle}>Trust Signals</Text>
        <View style={styles.list}>
          {report.marketing.elements
            .filter(e => e.type === 'trust_badge')
            .slice(0, 5)
            .map((el, i) => (
              <Text key={i} style={styles.listItem}>• {el.content}</Text>
            ))}
        </View>
      </View>
    )}
  </View>
)

// Social/Brand Channels Section
const SocialSection: React.FC<{ report: BrandReport }> = ({ report }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Brand Channels</Text>

    {report.social.links.map((link) => (
      <View key={link.url} style={{ flexDirection: 'row', marginBottom: 6, alignItems: 'center' }}>
        <Text style={[styles.badge, { textTransform: 'capitalize' }]}>{link.platform}</Text>
        <Link src={link.url} style={styles.link}>
          <Text>{link.handle || link.url}</Text>
        </Link>
        {link.source === 'verified' && (
          <Text style={[styles.badge, { backgroundColor: '#dcfce7', marginLeft: 8 }]}>
            Verified
          </Text>
        )}
      </View>
    ))}

    {report.social.links.length === 0 && (
      <Text style={styles.paragraph}>No social media links found.</Text>
    )}
  </View>
)

// Evidence Appendix
const EvidenceAppendix: React.FC<{ report: BrandReport }> = ({ report }) => {
  const allEvidence = [
    ...report.summary.evidence,
    ...report.tone.evidence,
    ...report.typography.fonts.flatMap(f => f.evidence),
    ...report.colors.colors.flatMap(c => c.evidence),
    ...report.seo.evidence,
    ...report.geo.evidence,
    ...report.social.links.flatMap(l => l.evidence),
  ].slice(0, 30)

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Evidence Appendix</Text>
      <Text style={styles.paragraph}>
        Sources and snippets supporting the analysis in this report.
      </Text>

      {allEvidence.map((evidence, i) => (
        <View key={i} style={styles.evidenceBox}>
          <Link src={evidence.url} style={[styles.link, { fontSize: 8 }]}>
            <Text>{evidence.url}</Text>
          </Link>
          <Text style={styles.evidenceText}>{evidence.snippet}</Text>
          {evidence.context && (
            <Text style={[styles.evidenceText, { marginTop: 2 }]}>
              Context: {evidence.context}
            </Text>
          )}
        </View>
      ))}

      <View style={{ marginTop: 16 }}>
        <Text style={styles.subsectionTitle}>Crawl Statistics</Text>
        <Text style={styles.listItem}>
          • Pages processed: {report.crawlStats.pagesProcessed}
        </Text>
        <Text style={styles.listItem}>
          • Duration: {report.crawlStats.duration.toFixed(1)} seconds
        </Text>
        {report.crawlStats.errors.length > 0 && (
          <Text style={styles.listItem}>
            • Errors: {report.crawlStats.errors.length}
          </Text>
        )}
      </View>
    </View>
  )
}

// Footer Component
const Footer: React.FC<{ pageNumber: number }> = ({ pageNumber }) => (
  <View style={styles.footer}>
    <Text>Generated by BrandLens</Text>
    <Text>Page {pageNumber}</Text>
  </View>
)

// Main Document Component
export const BrandReportDocument: React.FC<{ report: BrandReport }> = ({ report }) => (
  <Document>
    <CoverPage report={report} />
    <TableOfContents />

    <Page size="A4" style={styles.page}>
      <BrandSummarySection report={report} />
      <ToneVoiceSection report={report} />
      <Footer pageNumber={3} />
    </Page>

    <Page size="A4" style={styles.page}>
      <TypographySection report={report} />
      <ColorPaletteSection report={report} />
      <Footer pageNumber={4} />
    </Page>

    <Page size="A4" style={styles.page}>
      <SeoSection report={report} />
      <GeoSection report={report} />
      <Footer pageNumber={5} />
    </Page>

    <Page size="A4" style={styles.page}>
      <MarketingSection report={report} />
      <SocialSection report={report} />
      <Footer pageNumber={6} />
    </Page>

    <Page size="A4" style={styles.page}>
      <EvidenceAppendix report={report} />
      <Footer pageNumber={7} />
    </Page>
  </Document>
)

export default BrandReportDocument
