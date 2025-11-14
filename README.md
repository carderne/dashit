# Dashit

![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/carderne/dashit?utm_source=oss&utm_medium=github&utm_campaign=carderne%2Fdashit&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

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
