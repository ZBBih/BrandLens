# BrandLens

Generate comprehensive brand guidelines from any website URL. BrandLens crawls websites to extract typography, colors, tone of voice, SEO signals, and more, then compiles everything into a downloadable PDF report.

## Features

- **Typography Extraction**: Detect fonts from CSS, Google Fonts links, and @font-face declarations
- **Color Palette**: Extract colors from CSS variables and property values, ranked by usage
- **Tone & Voice Analysis**: AI-powered analysis using Claude to identify brand voice traits
- **SEO Snapshot**: Title patterns, meta descriptions, H1 usage, schema.org types
- **GEO Signals**: Address, phone numbers, Google Maps embeds, LocalBusiness schema
- **Social Links**: Instagram, Twitter/X, LinkedIn, YouTube, TikTok, Facebook
- **Marketing Elements**: CTAs, lead magnets, newsletter signups, trust badges
- **Brandfetch Integration**: Optional verified brand data (colors, fonts, logos)
- **PDF Export**: Professional brand guidelines document
- **24-Hour Caching**: Cached reports for faster repeat analysis

## Tech Stack

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: SQLite via Prisma
- **Crawler**: Playwright (JS-rendered) + Cheerio (static)
- **PDF**: @react-pdf/renderer
- **LLM**: Claude API (claude-sonnet-4-20250514)

## Setup

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
# Install dependencies
pnpm install

# Install Playwright browsers
pnpm exec playwright install chromium

# Setup database
npx prisma migrate dev

# Create environment file
cp .env.example .env
```

### Environment Variables

Edit `.env` and add your API keys:

```env
# Database
DATABASE_URL="file:./dev.db"

# Required - Claude API for tone/voice analysis
ANTHROPIC_API_KEY=sk-ant-...

# Optional - Enables verified brand data from Brandfetch
BRANDFETCH_API_KEY=
```

### Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Enter a company URL (e.g., `stripe.com`)
2. Click "Analyze Brand"
3. Wait 1-3 minutes for analysis to complete
4. View results on the dashboard
5. Download PDF report

## Project Structure

```
brandlens/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Home/input page
│   │   ├── analyze/[id]/page.tsx       # Results dashboard
│   │   ├── api/
│   │   │   ├── analyze/route.ts        # Start analysis
│   │   │   ├── status/[id]/route.ts    # Poll status
│   │   │   └── pdf/[id]/route.ts       # Download PDF
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                         # shadcn components
│   │   ├── progress-tracker.tsx
│   │   ├── results-dashboard.tsx
│   │   └── section-card.tsx
│   ├── lib/
│   │   ├── crawler/
│   │   │   ├── index.ts                # Orchestrator
│   │   │   ├── playwright.ts
│   │   │   ├── cheerio.ts
│   │   │   └── robots.ts
│   │   ├── extractors/
│   │   │   ├── typography.ts
│   │   │   ├── colors.ts
│   │   │   ├── seo.ts
│   │   │   ├── geo.ts
│   │   │   ├── social.ts
│   │   │   └── marketing.ts
│   │   ├── analysis/
│   │   │   └── tone-voice.ts           # Claude API
│   │   ├── enrichment/
│   │   │   └── brandfetch.ts
│   │   ├── pdf/
│   │   │   └── generator.tsx
│   │   ├── jobs/
│   │   │   └── analyze.ts
│   │   ├── utils/
│   │   │   └── url.ts
│   │   └── db.ts
├── prisma/
│   └── schema.prisma
├── .env.example
└── README.md
```

## Crawler Specifications

- **Depth limit**: 2 levels
- **Page limit**: 25 pages
- **Rate limiting**: 1 request/second
- **Timeout**: 30s per page, 5 minutes total
- **robots.txt**: Respected
- **SSRF protection**: Private IPs and localhost blocked

### Priority Pages

The crawler prioritizes these paths:
- `/` (homepage)
- `/about`, `/about-us`
- `/brand`, `/brand-guidelines`
- `/press`, `/media`, `/media-kit`
- `/careers`, `/jobs`
- `/contact`
- `/blog`

## Data Labels

Each extracted data point includes:
- **Confidence Score**: 0-100%
- **Source Label**:
  - `Verified`: From Brandfetch API or verbatim quote
  - `Extracted`: From CSS/HTML parsing
  - `Inferred`: From Claude AI analysis
  - `Not Found`: Data could not be determined

## Security

- URL validation with SSRF protection
- Private IP ranges blocked (10.x, 172.16-31.x, 192.168.x, 127.x)
- Localhost and internal hostnames blocked
- HTTPS enforced
- Content sanitization before rendering

## Caching

- Reports cached for 24 hours by domain
- Cached reports returned instantly
- Cache indicator shown on dashboard

## API Endpoints

### POST /api/analyze
Start a new analysis job.

**Request:**
```json
{
  "url": "example.com"
}
```

**Response:**
```json
{
  "id": "uuid",
  "cached": false,
  "status": "queued"
}
```

### GET /api/status/[id]
Get analysis status and results.

**Response:**
```json
{
  "status": "completed",
  "report": { ... }
}
```

### GET /api/pdf/[id]
Download PDF report (returns binary PDF).

## License

MIT
