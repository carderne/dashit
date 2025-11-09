# Dashit

```bash
pnpm install
pnpm exec convex dev --once
pnpm run dev
```

If you're making changes to the component, open a separate terminal
and run the build watch task

```bash
npm run build:watch
```

Re-generate Better-Auth schema:

```bash
cd convex/betterAuth
pnpm dlx @better-auth/cli generate -y
```

## Ideas

- BigQuery public datasets

this is a convex app, please check CLAUDE.md. In convex/tsconfig.json I have the @app alias pointing at ../src/\*. Then in convex/auth.ts I tried to import @app/lib/invariant but it's not working. Try running this in the current director
