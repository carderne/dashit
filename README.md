# Dashit

![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/carderne/dashit?utm_source=oss&utm_medium=github&utm_campaign=carderne%2Fdashit&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

An infinite canvas for analytics. Query multiple cloud-hosted parquet files, visualize data, and collaborate in real-time with your team.

## Features

- Infinite canvas interface for flexible data visualization
- Query against multiple parquet files stored in Cloudflare
- Real-time collaboration with presence cursors
- AI-powered SQL generation
- Share dashboards with your team

## Tech Stack

- **Tanstack Start** - Full-stack React framework
- **Convex** - Real-time sync backend, multi-user collaboration, and presence cursors
- **Cloudflare** - Parquet data storage
- **DuckDB** - Analytics querying against Cloudflare-hosted data
- **React Flow** - Infinite canvas
- **Better Auth** - Authentication
- **Anthropic** - AI SQL generation
- **UseAutumn** - Billing and subscription management (metered for AI generation and file uploads)
- **Netlify** - Build and hosting
- **Sentry** - Error tracking and performance monitoring
- **Posthog** - User analytics
- **CodeRabbit** - AI code review

## Getting Started

Install dependencies:

```bash
pnpm install
pnpm exec convex dev --once
```

Run the dev servers (in separate terminals):

```bash
pnpm dev:db   # convex
pnpm dev:web  # tanstack
```

## Development

If you make changes to better-auth config, you may need to re-generate the schema:

```bash
cd convex/betterAuth
pnpm dlx @better-auth/cli generate -y
```

Linting etc:

```bash
pnpm run fmt
         lint
         check
         test

# or
pnpm run ci
```
