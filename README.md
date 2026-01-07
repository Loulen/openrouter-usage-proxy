# OpenRouter Usage Proxy

A transparent middleware proxy that intercepts API calls to OpenRouter, logs usage information (model, tokens, costs, API keys), and displays analytics through a web dashboard.

## Overview

This tool acts as a **transparent proxy** between clients and OpenRouter's API. It passes through client requests unchanged while capturing request/response data for usage tracking, including per-API-key analytics. The proxy does NOT require or inject any API key - clients provide their own.

### Features

- Proxy API calls to OpenRouter with transparent passthrough
- Log usage data: model, prompt tokens, completion tokens, and cost
- Extract cost information from OpenRouter API responses
- **API key monitoring** - Track usage per API key with filtering and statistics
- SQLite database for persistent storage
- React web dashboard for viewing logs and statistics
- Summary statistics: total tokens, total cost, request count
- **CLI executable** with configurable ports for easy deployment
- Available as a globally installable npm package

## Use Cases

- **Track costs across tools** - Monitor spending from multiple AI coding assistants in one dashboard
- **Per-API-key analytics** - Track usage and costs for each API key separately
- **Debug API requests** - See exactly what's being sent to OpenRouter and what's returned
- **Usage analytics** - Understand which models you use most and their token consumption
- **Team visibility** - Share a dashboard showing API usage across your development team

## Architecture

```
┌─────────────┐      ┌─────────────────┐      ┌──────────────┐
│   Client    │ ───▶ │  Proxy Server   │ ───▶ │  OpenRouter  │
│  (Your App) │ ◀─── │  (localhost:3000)│ ◀─── │     API      │
│ + API Key   │      │  (transparent)   │      │              │
└─────────────┘      └────────┬────────┘      └──────────────┘
                              │
                              │ logs usage
                              ▼
                     ┌─────────────────┐
                     │  SQLite DB      │
                     └────────┬────────┘
                              │
                              │ reads
                              ▼
                     ┌─────────────────┐
                     │  Web Dashboard  │
                     │ (localhost:5173) │
                     └─────────────────┘
```

**Note:** Clients provide their own OpenRouter API keys. The proxy passes through all headers unchanged.

## Quick Start

**Prerequisites:** Node.js 20+ and an [OpenRouter API key](https://openrouter.ai/keys)

```bash
# Install
npm install -g openrouter-usage-proxy

# Run
openrouter-proxy
```

The proxy is now running at `http://localhost:3000`. Open your browser to see the dashboard.

## Integration Examples

The proxy works with any tool that supports OpenRouter. Point the tool to `http://localhost:3000` instead of `https://openrouter.ai`.

### Claude Code

Set the base URL environment variable before launching Claude Code:

```bash
export OPENROUTER_BASE_URL=http://localhost:3000/openrouter/api
claude
```

Or add it to your shell profile (`.bashrc`, `.zshrc`, etc.) for persistence:

```bash
echo 'export OPENROUTER_BASE_URL=http://localhost:3000/openrouter/api' >> ~/.bashrc
```

### Roocode (VS Code Extension)

1. Open VS Code Settings (`Ctrl+,` or `Cmd+,`)
2. Search for "Roocode" or navigate to the Roocode extension settings
3. Find the **API Provider** section
4. Check **"Use custom base URL"**
5. Enter: `http://localhost:3000/openrouter/api/v1`
6. Save and restart if prompted

### Other OpenRouter-Compatible Tools

For any tool that supports OpenRouter, look for settings like:
- "Custom base URL"
- "API endpoint"
- "OpenRouter URL"

Replace `https://openrouter.ai/api/v1` with `http://localhost:3000/openrouter/api/v1`

### Basic Usage (curl)

For testing or scripting, you can call the proxy directly:

```bash
curl -X POST http://localhost:3000/openrouter/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_OPENROUTER_API_KEY" \
  -d '{
    "model": "openai/gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### How It Works

When you route requests through the proxy, it will:
1. Pass through your request to OpenRouter (headers unchanged)
2. Return the response to your client
3. Log usage data (model, tokens, cost) to the database
4. Display the log in the web dashboard at `http://localhost:3000`

**Note**: This is a transparent proxy - each client must provide their own OpenRouter API key.

## CLI Usage

### CLI Options

```
Usage: openrouter-proxy [options]

Options:
  --server-port <port>   Port for the API server (default: 3000)
  --client-port <port>   Port for the static file server (defaults to server-port)
  --help                 Display help information
  --version              Display version number
```

### Examples

**Start with default settings (port 3000):**
```bash
openrouter-proxy
```

**Start on a custom port:**
```bash
openrouter-proxy --server-port 8080
```

**Run API server and dashboard on different ports:**
```bash
openrouter-proxy --server-port 3000 --client-port 5173
```

**Display help:**
```bash
openrouter-proxy --help
```

### Unified vs Separate Port Modes

- **Unified mode** (default): When `--client-port` is not specified or equals `--server-port`, the dashboard is served by the API server on the same port. Access everything at `http://localhost:<server-port>/`.

- **Separate port mode**: When `--client-port` differs from `--server-port`, the dashboard runs on its own port with API requests proxied to the server port.

## Development

### Building from Source

To build and test the package locally:

```bash
# Clone the repository
git clone https://github.com/Loulen/openrouter-usage-proxy.git
cd openrouter-usage-proxy

# Install dependencies
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..

# Build everything
npm run build

# Test the CLI
node dist/cli/index.js --help

# Or install locally for testing
npm link
openrouter-proxy --help
```

### Development Mode

For active development with hot reload:

```bash
# Terminal 1: Run the CLI in dev mode
npm run dev

# This will start both the server and serve the client
```

### Running Tests

The project uses Vitest for testing both server and client code.

```bash
# Run all tests (server + client)
npm run test

# Run server tests only
npm run test:server

# Run client tests only
npm run test:client

# Run tests with coverage report
npm run test:coverage
```

Tests are organized by feature:
- **Server tests** (`server/src/**/__tests__/`): Database operations, API routes, proxy middleware
- **Client tests** (`client/src/**/__tests__/`): React hooks, components

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | Backend server port |
| `VITE_API_URL` | No | `http://localhost:3000` | Backend URL for frontend |

**Transparent Proxy:** This proxy does NOT require or use a server-side API key. Clients must provide their own OpenRouter API keys in the `Authorization` header of each request. The proxy passes through all headers unchanged.

## Limitations

- Streaming responses are not supported (responses are buffered for logging)
- No authentication/authorization for the proxy
- No rate limiting or caching
- Single-user design (no multi-tenancy)

## Technical Reference

### Project Structure

```
openrouter-usage-proxy/
├── cli/                       # CLI entry point
│   ├── index.ts              # Main CLI with Commander.js
│   ├── server-runner.ts      # Express server runner
│   └── static-server.ts      # Static file server
├── server/                    # Backend proxy server
│   ├── src/
│   │   ├── index.ts          # Express app entry point
│   │   ├── middleware/
│   │   │   └── proxy.ts      # Proxy middleware
│   │   ├── routes/
│   │   │   └── logs.ts       # Log query endpoints
│   │   ├── db/
│   │   │   ├── index.ts      # Database connection
│   │   │   └── schema.ts     # Table definitions
│   │   └── types/
│   │       └── index.ts      # TypeScript types
│   ├── package.json
│   └── tsconfig.json
├── client/                    # React web dashboard
│   ├── src/
│   │   ├── main.tsx          # React entry point
│   │   ├── App.tsx           # Root component
│   │   ├── components/
│   │   │   ├── Dashboard.tsx # Summary stats
│   │   │   └── LogsTable.tsx # Logs display table
│   │   ├── hooks/
│   │   │   └── useLogs.ts    # Data fetching hook
│   │   └── types/
│   │       └── index.ts      # TypeScript types
│   ├── vite.config.ts
│   └── package.json
├── scripts/                   # Build and utility scripts
│   └── build-sea.sh          # SEA binary generation script
├── .github/workflows/         # GitHub Actions
│   ├── release.yml           # Automated release workflow
│   └── ci.yml                # CI testing workflow
├── .env.example               # Example environment variables
├── esbuild.config.mjs        # esbuild bundler configuration
├── sea-config.json           # Node.js SEA configuration
└── README.md                  # This file
```

### Service URLs

| Service | URL | Description |
|---------|-----|-------------|
| Web Dashboard | http://localhost:3000 | View usage logs and statistics |
| Proxy API | http://localhost:3000/openrouter/api/v1/* | Forward requests to OpenRouter |
| Logs API | http://localhost:3000/api/logs | Query logged usage data |
| Stats API | http://localhost:3000/api/logs/stats | Get summary statistics |

### API Endpoints

**Proxy Endpoint**

`POST /openrouter/api/v1/chat/completions` - Proxy to OpenRouter chat completions API

**Logs API**

`GET /api/logs` - Get all usage logs

Response:
```json
[
  {
    "id": 1,
    "timestamp": "2024-01-15T10:30:00.000Z",
    "model": "openai/gpt-3.5-turbo",
    "prompt_tokens": 10,
    "completion_tokens": 50,
    "total_tokens": 60,
    "cost": 0.00012,
    "request_path": "/v1/chat/completions",
    "status_code": 200,
    "created_at": "2024-01-15T10:30:00.000Z"
  }
]
```

`GET /api/logs/stats` - Get summary statistics

Response:
```json
{
  "total_tokens": 1500,
  "total_cost": 0.0045,
  "request_count": 25
}
```

### Database Schema

The SQLite database stores usage logs in the `usage_logs` table:

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Auto-incrementing primary key |
| `timestamp` | TEXT | ISO 8601 timestamp of request |
| `model` | TEXT | Model identifier (e.g., "openai/gpt-3.5-turbo") |
| `prompt_tokens` | INTEGER | Number of input tokens |
| `completion_tokens` | INTEGER | Number of output tokens |
| `total_tokens` | INTEGER | Sum of prompt + completion tokens |
| `cost` | REAL | Cost in USD (from OpenRouter response) |
| `request_path` | TEXT | API endpoint path |
| `status_code` | INTEGER | HTTP response status |
| `created_at` | TEXT | Record creation timestamp |

### Tech Stack

**Backend (Proxy Server)**
- TypeScript
- Express.js
- http-proxy-middleware
- better-sqlite3

**Frontend (Web Dashboard)**
- TypeScript
- React 18
- Vite

**Testing**
- Vitest
- Testing Library (React)
- Supertest (API)

**CLI**
- Commander.js
- Node.js native packaging

### Publishing

#### First-Time Setup

1. Publish your package manually once (requires npm account with 2FA):
   ```bash
   npm login
   npm publish --access public
   ```

2. Configure trusted publisher on npmjs.com:
   - Go to: `https://www.npmjs.com/package/openrouter-usage-proxy/access`
   - Click "Add trusted publisher"
   - Select **GitHub Actions**
   - Fill in:
     - Organization/User: `Loulen`
     - Repository: `openrouter-usage-proxy`
     - Workflow filename: `publish.yml`
     - Environment: (leave blank)

#### Publishing Updates

Once configured, simply push a version tag:

```bash
# Update version in package.json, commit, and create a tag
npm version patch  # or minor, or major
git push && git push --tags

# GitHub Actions will automatically:
# 1. Build the package
# 2. Publish to npm via OIDC (no token needed!)
# 3. Include provenance attestations
# 4. Create a GitHub release
```

## License

MIT
