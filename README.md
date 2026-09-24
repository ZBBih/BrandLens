# BrandLens

Paste a website address and get its brand guidelines: colour palette, typography, logo, tone of voice, SEO snapshot, social channels, AI-written marketing copy and strategic insights. Every extracted value shows where it was found, the owner can correct anything the analysis got wrong, and the result exports as a PDF, PNG brand board, design tokens, CSS, Tailwind config, Markdown or JSON.

## How it works

1. **Crawl.** Up to 25 public pages are fetched, starting with the homepage, About and Contact pages. Pages that need JavaScript are rendered in headless Chromium; three pages are read in parallel while respecting the site's `robots.txt` crawl delay.
2. **Extract.** Colours (ranked by how much of the rendered page they cover), fonts, logo, SEO signals, contact details and social links are read from the HTML, CSS and computed styles. Optional [Brandfetch](https://brandfetch.com) data is merged in and labelled as such.
3. **Analyse.** Claude describes the brand's voice and summary, then writes marketing copy and insights. Page text is passed to the model as untrusted data, and every response is schema-validated.
4. **Review.** Colours and fonts appear as soon as extraction finishes, while the AI sections are still being written. The owner can edit values, share a public link, and regenerate the copy.

## Stack

- Next.js 16 (App Router, React 19), TypeScript, Tailwind CSS 4, Radix UI
- PostgreSQL via Prisma 5, with committed migrations
- Playwright (Chromium; `@sparticuz/chromium` on Vercel) and Cheerio for crawling; undici with DNS-pinned connections for all outbound requests
- Anthropic Claude API (`claude-sonnet-5` by default) with structured outputs
- @react-pdf/renderer (Noto Sans, so non-Latin text renders correctly)
- Vitest for unit, database and accuracy tests

## Running locally

Requirements: Node.js 22 LTS, pnpm, and Docker (for Postgres).

```bash
pnpm install                     # also downloads Playwright's Chromium
cp .env.example .env             # then set ANTHROPIC_API_KEY
docker run -d --name brandlens-pg -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=brandlens -p 5432:5432 postgres:16
pnpm db:migrate                  # applies prisma/migrations
pnpm dev                         # http://localhost:3000
```

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | yes | Claude API key. Without it, reports are produced without AI sections and say so. |
| `ANTHROPIC_MODEL` | no | Override the model (default `claude-sonnet-5`) |
| `BRANDFETCH_API_KEY` | no | Enables Brandfetch enrichment |
| `DATABASE_URL_UNPOOLED` | no | Direct (unpooled) connection used only for migrations when `DATABASE_URL` goes through a pooler; Neon's Vercel integration sets it automatically (`POSTGRES_URL_NON_POOLING` and `DIRECT_URL` also work) |
| `CRON_SECRET` | on Vercel | Protects the daily retention cron; Vercel sends it automatically |
| `TRUSTED_PROXY_HOPS` | no | Reverse proxies in front of the app, used to find the client IP for rate limiting (default `1`, correct for Vercel) |
| `NEXT_PUBLIC_SITE_URL` | no | Absolute site URL for share-link previews (defaults to Vercel's production domain) |
| `NEXT_PUBLIC_CONTACT_EMAIL` | no | Shown on `/privacy` for report removal requests |

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Develop, build, and run a self-hosted server (`start` applies pending migrations first) |
| `pnpm vercel-build` | What Vercel runs: generate, migrate (production only), build |
| `pnpm lint` / `pnpm typecheck` | ESLint and TypeScript |
| `pnpm test` | Unit tests. Set `TEST_DATABASE_URL` to a disposable database to include the database tests. |
| `pnpm eval:accuracy` | Scores colour, font and logo extraction against a golden set of real brands |
| `pnpm eval:capture` | Re-captures the golden-set snapshots (crawls the real sites) |
| `pnpm db:migrate` | Create/apply migrations in development |

## Deployment (Vercel)

The app runs on Vercel Functions (Fluid Compute, Node 22+). `vercel.json` sets the build command to `pnpm vercel-build` and schedules the daily retention cron.

- **Build.** `vercel-build` runs `prisma generate`, then `scripts/migrate-deploy.mjs`, then `next build`. Migrations run on **production builds only**; preview builds skip them so a preview can never change a shared database's schema.
- **Analyses.** `POST /api/analyze` responds immediately and keeps working in the same invocation via `after()`, with `maxDuration = 300` (the maximum on every plan). Each job has a 4-minute deadline, and a heartbeat marks it failed if the instance dies.
- **Headless browser.** Playwright's downloaded browsers never reach the function bundle, so on Vercel the crawler launches `@sparticuz/chromium`, a Chromium build packaged for serverless (about 67 MB; version pinned to match Playwright). Locally, `postinstall` downloads Playwright's Chromium as usual.
- **Cron.** `/api/cron/retention` runs daily at 04:00 UTC and requires `CRON_SECRET`.

**One-time upgrade note.** Databases created by the old `prisma db push` flow have tables but no migration history. On the first production build, the migration script checks that the live schema exactly matches `scripts/baseline.prisma`, marks the baseline migration as applied, then applies the newer migrations. If the schema has drifted, the build stops and prints the differences instead of changing anything. **Take a database backup before the first production deploy of this version.**

To run it self-hosted instead, `pnpm build && pnpm start`; `start` applies migrations first and a timer runs the retention sweep.

## Security model

- **Outbound requests.** Every request the crawler makes, including redirects, stylesheets, sitemaps and each subresource the headless browser loads, goes through one guarded client. It resolves DNS, rejects private, loopback, link-local and metadata addresses, pins the connection to the vetted IP, and caps response size and time.
- **Ownership.** Whoever runs an analysis receives a random capability token in an httpOnly cookie; only its hash is stored. Editing, sharing and regenerating require it. Reports are otherwise viewable by their unguessable link.
- **Abuse limits.** Atomic daily quotas in Postgres (3 analyses per IP, 50 overall; PDF downloads are limited too). Mutations must be same-origin JSON requests.
- **Browser hardening.** Nonce-based Content Security Policy, `frame-ancestors 'none'`, HSTS, and no `innerHTML` for third-party data.
- **Data retention.** Reports are deleted after 30 days (180 if shared); rate-limit counters after 7. See `/privacy`.

## Project layout

```
src/
  app/                   routes: home, analyze/[id], report/[slug] (public share), compare, demo, privacy, api/*
  components/report/     report sections, export menu, share and edit controls
  lib/
    crawler/             orchestrator, Playwright and Cheerio fetchers, robots.txt
    net/                 guarded outbound HTTP client
    extractors/          colours, typography, logo, SEO, geo, social, marketing
    analysis/            Claude calls, consistency score
    jobs/analyze.ts      the analysis pipeline
    report/              ownership, persistence, overrides, request guards
    pdf/, export/        PDF and export formats
scripts/                 deploy-time migrations, accuracy eval
prisma/                  schema and migrations
docs/audits/             security and quality audit reports
```

## License

MIT
