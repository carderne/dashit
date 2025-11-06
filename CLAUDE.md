# Dashit - Architecture & Implementation

## Stack

- **Frontend**: TanStack Router (file-based), React 19, TypeScript strict mode
- **Canvas**: React Flow v12.9 for node-based dashboard UI
- **Backend**: Convex (real-time DB + serverless functions)
- **Auth**: Better Auth v1.3 with Google OAuth + Convex adapter
- **Storage**: Cloudflare R2 (S3-compatible) for datasets, IndexedDB for guest users
- **Query Engine**: DuckDB-WASM v1.30.0 (client-side SQL execution)
- **Editor**: Tiptap for query box text editing
- **Tables**: TanStack Table v8.21 for query results
- **UI**: Tailwind + shadcn/ui components

## Key Architecture Decisions

### Client-Side Query Execution

All SQL queries run in-browser via DuckDB-WASM. No backend query processing. Datasets are loaded into DuckDB from R2 (authenticated) or IndexedDB (guests), then queried locally.

### Canvas Implementation

- React Flow manages the canvas with custom node types: `query`, `table`, `chart`
- Nodes are persisted as "boxes" in Convex with position, size, content, and results
- Real-time sync: all users viewing a dashboard see live updates
- Boxes stored in `convex/boxes.ts` with CRUD operations

### Dataset Management

**Authenticated Users**:

1. Upload CSV via modal → auto-convert to Parquet using DuckDB-WASM
2. Get pre-signed R2 upload URL from Convex
3. Direct browser→R2 upload with XHR progress tracking
4. Metadata stored in Convex `datasets` table with `r2Key`

**Guest Users**:

1. Same CSV→Parquet conversion in browser
2. Store Parquet blob in IndexedDB (no R2)
3. Metadata in Convex with `sessionId` instead of `userId`
4. 24-hour expiration with cleanup cron job

### File Storage Pattern

```
convex/r2.ts - S3 client config + pre-signed URL generation
convex/datasets.ts - Dataset CRUD + R2 URL generation
src/utils/indexeddb.ts - Guest storage operations
src/hooks/useDuckDB.ts - Singleton DuckDB instance + query execution
```

### DuckDB-WASM Setup

**Critical**: Vite config requires special handling:

```typescript
optimizeDeps: { exclude: ['@duckdb/duckdb-wasm'] },
worker: { format: 'es' }
```

**Singleton Pattern**: Global instance with init promise prevents multiple WASM initializations. Hook provides:

- `executeQuery(sql)` - Run SQL and return columns/rows
- `convertCSVToParquet(file)` - Browser-side conversion
- `loadParquetFromURL(url, tableName)` - Load R2 dataset
- `loadParquetFromBuffer(buffer, tableName)` - Load IndexedDB dataset

### Query Execution Flow

1. User types SQL in query box (Tiptap editor)
2. Click Run → `query-box.tsx` loads all datasets into DuckDB tables
3. For each dataset: check if R2 (load from `downloadUrl`) or IndexedDB (load from buffer)
4. Execute query via `useDuckDB.executeQuery()`
5. Results stored in box record + displayed in TanStack Table

### Schema Overview

```typescript
// convex/schema.ts
dashboards: { name, userId, createdAt }
boxes: { dashboardId, type, positionX/Y, width/height, content, results, title }
datasets: { name, fileName, r2Key?, userId?, sessionId?, isPublic, expiresAt? }
```

### Auth Flow

Better Auth with Convex adapter generates JWT tokens for Convex queries. Session stored in cookies. Guest users get localStorage `sessionId` for temporary dataset ownership.

## Important Patterns

### CSV→Parquet Conversion

```typescript
// In-browser using DuckDB-WASM SQL
await db.registerFileText(csvFile.name, csvText)
await conn.query(`CREATE TABLE temp AS SELECT * FROM read_csv_auto('${csvFile.name}')`)
await conn.query(`COPY temp TO 'output.parquet' (FORMAT PARQUET)`)
const buffer = await db.copyFileToBuffer('output.parquet')
```

### Icon Import Conflicts

lucide-react exports `File` which conflicts with DOM `File` type. Always alias:

```typescript
import { File as FileIcon } from 'lucide-react'
```

### Type Safety

- No `any` types except with `// eslint-disable-next-line`
- Use `unknown` for truly unknown types
- Convex IDs: `Id<'tableName'>` from `@convex/_generated/dataModel`

## Development

```bash
pnpm install
pnpm dev  # Starts Vite (7100) + Convex dev server
```

Convex runs locally by default. R2 requires env vars:

```
CLOUDFLARE_R2_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET=
CLOUDFLARE_R2_PUBLIC_URL=
```

## Known Issues

- Dashboard loading can be slow on first Convex query
- DuckDB-WASM initialization takes ~1-2s
- Large CSV files (>50MB) may cause browser memory pressure during conversion
