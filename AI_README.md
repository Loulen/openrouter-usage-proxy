# AI_README.md

> Auto-generated project context for AI agents. Do not edit manually.

## Project Overview

**Type:** API Proxy with Web Dashboard (CLI Tool + Server + Client)
**Purpose:** Transparent middleware proxy that intercepts OpenRouter API calls, logs usage data (model, tokens, costs), and displays analytics through a React web dashboard.

## Technologies

| Category | Technology |
|----------|------------|
| Language | TypeScript (ES2022) |
| Runtime | Node.js 20+ |
| Backend Framework | Express.js 4.x |
| Frontend Framework | React 18 |
| Build Tool (Client) | Vite 6 |
| Database | SQLite (better-sqlite3) |
| Proxy Library | http-proxy-middleware |
| Charts | Recharts |
| CLI Parser | Commander.js |
| Module System | ESM (ES Modules) |

## Code Structure

```
openrouter-usage-proxy/
├── cli/                          # CLI entry point
│   ├── index.ts                  # Main CLI with Commander.js
│   ├── server-runner.ts          # Express server configuration
│   └── static-server.ts          # Static file server for dashboard
├── server/                       # Backend proxy server (separate package)
│   ├── src/
│   │   ├── index.ts              # Express app entry point
│   │   ├── middleware/
│   │   │   └── proxy.ts          # OpenRouter proxy middleware
│   │   ├── routes/
│   │   │   ├── logs.ts           # Logs API endpoints
│   │   │   ├── settings.ts       # Settings API endpoints
│   │   │   └── api-keys.ts       # API keys management endpoints
│   │   ├── db/
│   │   │   ├── index.ts          # Database connection & operations
│   │   │   ├── schema.ts         # SQL table definitions
│   │   │   └── settings.ts       # Settings storage
│   │   └── types/
│   │       ├── index.ts          # Shared TypeScript types
│   │       └── settings.ts       # Settings-related types
│   ├── package.json
│   └── tsconfig.json
├── client/                       # React web dashboard (separate package)
│   ├── src/
│   │   ├── main.tsx              # React entry point
│   │   ├── App.tsx               # Root component with routing
│   │   ├── components/
│   │   │   ├── Dashboard.tsx     # Stats cards display
│   │   │   ├── LogsTable.tsx     # Usage logs table
│   │   │   ├── StatsPage.tsx     # Charts and analytics
│   │   │   ├── SettingsPage.tsx  # Settings management
│   │   │   ├── Filters.tsx       # Filter controls
│   │   │   ├── NavBar.tsx        # Navigation component
│   │   │   ├── PieChartCard.tsx  # Pie chart visualization
│   │   │   ├── LineChartCard.tsx # Line chart visualization
│   │   │   ├── BarChartCard.tsx  # Bar chart visualization
│   │   │   └── ApiKeyTable.tsx   # API key management table
│   │   ├── hooks/
│   │   │   ├── useLogs.ts        # Logs data fetching hook
│   │   │   ├── useModels.ts      # Models list hook
│   │   │   ├── useSettings.ts    # Settings hook
│   │   │   └── useApiKeys.ts     # API keys hook
│   │   └── types/
│   │       └── index.ts          # Client-side TypeScript types
│   ├── vite.config.ts
│   └── package.json
├── dist/                         # Compiled output
├── package.json                  # Root package (CLI distribution)
├── tsconfig.cli.json             # CLI TypeScript config
└── .github/workflows/            # CI/CD workflows
```

### Key Directories
- `cli/` - CLI entry point, starts server and serves dashboard
- `server/src/` - Express backend with proxy, routes, and database
- `client/src/` - React dashboard with components and hooks

## Conventions

### Naming
- Files: `kebab-case.ts` (e.g., `server-runner.ts`, `api-keys.ts`)
- Functions: `camelCase` (e.g., `startServer`, `buildFilteredLogsQuery`)
- Classes/Interfaces: `PascalCase` (e.g., `UsageLog`, `ServerInstance`)
- Constants: `UPPER_SNAKE_CASE` for SQL (e.g., `SELECT_ALL_LOGS`), `camelCase` for other constants
- React Components: `PascalCase` (e.g., `Dashboard.tsx`, `LogsTable.tsx`)
- Custom Hooks: `useCamelCase` prefix (e.g., `useLogs`, `useSettings`)

### Imports
```typescript
// 1. External packages first (alphabetically)
import { Router, Request, Response, NextFunction } from 'express';
import Database from 'better-sqlite3';

// 2. Internal modules with .js extension (ESM requirement)
import { insertLog } from '../db/index.js';
import type { UsageLog } from '../types/index.js';

// 3. Type-only imports use `import type`
import type { Server } from 'http';
```

### Error Handling
- Use `try/catch` blocks in route handlers with `next(err)` for Express error middleware
- Log errors to `process.stderr.write()` (not console.log)
- Return typed `ApiErrorResponse` objects: `{ error: true, message: string, code?: string }`
- Graceful shutdown handlers for SIGTERM/SIGINT signals
- Database errors are caught and logged without crashing

### File Documentation
- Every file starts with a JSDoc block describing its purpose
- Functions have JSDoc with `@param` and `@returns` annotations
- Interfaces have JSDoc comments on each property
- Critical sections have inline comments explaining "why" not "what"

### Testing
- No automated tests currently in the codebase
- Manual testing via curl commands documented in README.md
- Verification script at `scripts/verify-e2e.sh`

## Important Patterns

### Express Middleware Order (Critical)
Middleware must be registered in this exact order:
1. CORS middleware
2. JSON body parser (`express.json()`)
3. API routes (`/api/*`)
4. Proxy middleware (`/openrouter/api/v1/*`)
5. Static file serving (if unified mode)
6. Error handler (MUST be last)

### Proxy Pattern
```typescript
// Transparent proxy - passes through client Authorization header unchanged
// Injects `usage: { include: true }` for cost data in responses
export const proxyMiddleware = createProxyMiddleware<Request, Response>({
  target: OPENROUTER_TARGET,
  changeOrigin: true,
  selfHandleResponse: false, // IMPORTANT: false for streaming support
  pathRewrite: { '^/': '/api/v1/' },
  on: {
    proxyReq: (proxyReq, req, res) => { /* modify request */ },
    proxyRes: (proxyRes, req, res) => { /* log response */ },
    error: (err, req, res) => { /* handle errors */ },
  },
});
```

### Database Access Pattern
```typescript
// Use prepared statements for repeated operations
const insertStatement = db.prepare(INSERT_USAGE_LOG);

// Named parameters for clarity
insertStatement.run({
  timestamp: logInput.timestamp,
  model: logInput.model,
  // ...
});

// Dynamic query building for filters
const { sql, params } = buildFilteredLogsQuery(filters);
const statement = db.prepare(sql);
return statement.all(...params) as UsageLog[];
```

### React Data Fetching Pattern
```typescript
// Custom hooks encapsulate fetch logic
export function useLogs(filters?: FilterParams): UseLogsState & { refetch: () => void } {
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    // Parallel fetch for performance
    const [logsResponse, statsResponse] = await Promise.all([
      fetch(`/api/logs${queryString}`),
      fetch(`/api/logs/stats${queryString}`),
    ]);
    // ...
  }, [filters?.model, filters?.from, filters?.to]);

  useEffect(() => { fetchData(); }, [fetchData]);
  return { logs, stats, loading, error, refetch: fetchData };
}
```

### Type Sharing Pattern
- Backend types defined in `server/src/types/index.ts`
- Client mirrors needed types in `client/src/types/index.ts`
- Use `interface` for object shapes, `type` for unions/aliases
- All interface properties have JSDoc comments

## Files to Know

| File | Purpose |
|------|---------|
| `/cli/index.ts` | CLI entry point with Commander.js, graceful shutdown handling |
| `/cli/server-runner.ts` | Express app configuration, middleware setup |
| `/server/src/middleware/proxy.ts` | Core proxy logic, request/response interception |
| `/server/src/db/index.ts` | Database operations, CRUD functions |
| `/server/src/db/schema.ts` | SQL statements, dynamic query builders |
| `/server/src/types/index.ts` | All backend TypeScript interfaces |
| `/client/src/App.tsx` | Root React component, page routing, filter state |
| `/client/src/hooks/useLogs.ts` | Main data fetching hook pattern |
| `/client/src/types/index.ts` | All frontend TypeScript interfaces |
| `/package.json` | Root package for npm distribution (CLI binary) |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/openrouter/api/v1/*` | * | Proxy to OpenRouter API |
| `/api/logs` | GET | Get all usage logs (supports filters) |
| `/api/logs/stats` | GET | Get aggregated statistics |
| `/api/logs/models` | GET | Get distinct model names |
| `/api/logs/model-stats` | GET | Get per-model statistics |
| `/api/logs/time-series` | GET | Get time-series data |
| `/api/settings` | GET/PUT | Manage application settings |
| `/api/api-keys` | CRUD | Manage API keys |
| `/health` | GET | Health check endpoint |

## Database

- **Location:** `~/.openrouter-proxy/usage.db`
- **Engine:** SQLite with WAL mode enabled
- **Tables:** `usage_logs` (main data), settings stored in JSON file
- **Indexes:** `idx_usage_logs_timestamp`, `idx_usage_logs_model`

## Build Commands

```bash
# Development
npm run dev              # Run CLI in development mode

# Build all
npm run build            # Build client, server, and CLI

# Individual builds
npm run build:client     # Build React dashboard
npm run build:server     # Build Express server
npm run build:cli        # Build CLI entry point
```

---
*Generated by AI Overview Generator*
