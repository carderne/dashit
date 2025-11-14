# Dashit

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
