# Infinite Canvas Dashboard Implementation

## Overview

This implementation creates an infinite canvas experience similar to Excalidraw/tldraw, optimized for rich interactive content like SQL editors, data tables, and charts.

## Architecture Decision: CSS Transform DOM (Not Canvas API)

**Why DOM over Canvas:**

- Cannot embed rich DOM content (Monaco/TipTap, tables, charts) in Canvas
- Canvas is pixel-based - requires overlay workarounds
- DOM approach matches tools like tldraw for rich interactive content
- Full React ecosystem compatibility

## Tech Stack

### Core Libraries

- **React Flow** (`@xyflow/react`) - Pan/zoom + node management
- **TipTap** (`@tiptap/react`) - Rich text SQL editor
- **TanStack Table** (`@tanstack/react-table`) - Data table rendering
- **Convex** - Backend database and real-time sync

### How It Works

```
<Canvas>                    # React Flow wrapper
  <ToolPanel />            # Tool selector
  <ReactFlow>              # Handles pan/zoom with CSS transforms
    <QueryBox />          # TipTap editor for SQL
    <TableBox />          # TanStack Table for results
  </ReactFlow>
</Canvas>
```

All pan/zoom is handled by applying `transform: translate3d(x, y, 0) scale(zoom)` with GPU acceleration.

## Database Schema

### Tables

1. **dashboards** - User's dashboards
   - name, userId, timestamps

2. **boxes** - Canvas elements
   - dashboardId, type (query/table/chart)
   - positionX, positionY, width, height
   - content (SQL query text)
   - results (JSON query results)
   - title, timestamps

## Key Features Implemented

### 1. Infinite Canvas with React Flow

- Pan with drag
- Zoom with mouse wheel
- Minimap for navigation
- Background grid

### 2. Box Types

- **QueryBox**: TipTap rich text editor for SQL queries
  - Execute button to run queries
  - Results stored in database
  - Delete functionality

- **TableBox**: TanStack Table for displaying results
  - Sortable columns
  - Virtual scrolling ready
  - Parse JSON results
  - Delete functionality

### 3. Tool Panel

- Select tool (Query, Table, Chart)
- Click canvas to place box
- Visual feedback for active tool

### 4. Viewport Culling (Performance)

- Only render boxes visible in viewport
- 200px padding for smooth scrolling
- Tracks viewport changes on pan/zoom
- Automatically filters boxes

### 5. Real-time Sync

- React Query + Convex integration
- Position updates on drag
- Content updates on edit
- Automatic refetching

## File Structure

```
src/
├── components/
│   └── canvas/
│       ├── Canvas.tsx         # Main canvas with React Flow
│       ├── QueryBox.tsx       # SQL editor box
│       ├── TableBox.tsx       # Data table box
│       └── ToolPanel.tsx      # Tool selector
└── routes/
    ├── index.tsx              # Dashboard list
    └── dashboard.$id.tsx      # Canvas page

convex/
├── schema.ts                  # Database schema
├── dashboards.ts              # Dashboard CRUD
└── boxes.ts                   # Box CRUD with viewport query
```

## Usage

### 1. Start the application

```bash
pnpm dev
```

### 2. Create a dashboard

- Sign in with Google
- Click "Create New Dashboard"

### 3. Add boxes to canvas

- Click a tool (Query, Table, Chart)
- Click anywhere on canvas to place
- Drag to reposition
- Pan canvas with drag
- Zoom with mouse wheel

### 4. Use Query Box

- Click inside to edit SQL
- Click "Execute" to run (currently mock)
- Results will appear in connected table

## Performance Characteristics

### Expected Performance

- **50-100 boxes**: Excellent (60 FPS)
- **100-200 boxes**: Good with viewport culling
- **200+ boxes**: May need additional optimization

### Optimization Features

- GPU-accelerated CSS transforms
- Viewport culling (only render visible)
- React Query caching
- Component memoization ready

## Next Steps / Future Enhancements

1. **Real SQL Execution**
   - Connect to actual database
   - Query parser and validator
   - Error handling

2. **Chart Box Implementation**
   - Add chart library (ECharts/Recharts)
   - Connect to table data
   - Chart type selector

3. **Connections Between Boxes**
   - Visual edges showing data flow
   - Query → Table → Chart pipeline

4. **Collaborative Features**
   - Real-time multiplayer editing
   - Cursors and presence
   - Convex already supports this

5. **Advanced Features**
   - Box grouping
   - Templates
   - Export/import
   - Keyboard shortcuts
   - Undo/redo

## Technical Notes

### Why TipTap over Monaco?

User requested TipTap for rich text editing experience with SQL. Monaco could be swapped in for full IDE features.

### Viewport Culling Implementation

Client-side filtering in Canvas.tsx based on viewport bounds. For very large dashboards (1000+ boxes), consider:

- Server-side viewport query (already implemented in boxes.ts)
- Pagination
- Lazy loading

### Performance Tips

- Keep box count < 200 for best performance
- Use viewport culling (already implemented)
- Lazy load heavy content (charts, large tables)
- Consider web workers for query parsing

## Development Server

- **Web**: http://localhost:7100
- **Convex Dashboard**: http://127.0.0.1:6790
- **Convex Backend**: http://127.0.0.1:3210

All running with hot reload enabled.
