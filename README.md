# OpenRouter Usage Proxy

A transparent middleware proxy that intercepts all API calls to OpenRouter, logs detailed usage information including model, token counts, and costs, and displays this data through a React/Vite web dashboard.

## Overview

This tool acts as a **transparent proxy** between clients and OpenRouter's API. It passes through client requests (including their own API keys) unchanged while capturing request/response data for usage tracking. The proxy itself does NOT require or inject any API key - clients must provide their own OpenRouter API keys.

### Features

- Proxy API calls to OpenRouter with transparent passthrough
- Log usage data: model, prompt tokens, completion tokens, and cost
- Extract cost information from OpenRouter API responses
- SQLite database for persistent storage
- React web dashboard for viewing logs and statistics
- Summary statistics: total tokens, total cost, request count
- **CLI executable** with configurable ports for easy deployment
- Pre-built binaries available for Linux, macOS, and Windows

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

## Project Structure

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

## Quick Start

### Prerequisites

- Node.js 18+
- npm
- OpenRouter API key for your clients ([Get one here](https://openrouter.ai/keys))

### Installation

1. Clone the repository and navigate to the project directory

2. (Optional) Set up environment variables if you need to customize ports:
   ```bash
   cp .env.example .env
   # Edit .env to customize PORT or VITE_API_URL if needed
   ```

3. Install and start the backend server:
   ```bash
   cd server
   npm install
   npm run dev
   ```

4. In a new terminal, install and start the frontend:
   ```bash
   cd client
   npm install
   npm run dev
   ```

5. Open the dashboard at http://localhost:5173

## CLI Usage

The OpenRouter Usage Proxy can also be run as a standalone CLI executable that launches both the API server and web dashboard with a single command.

### Pre-built Binaries

Download pre-built binaries from the [GitHub Releases](https://github.com/your-username/openrouter-usage-proxy/releases) page:

| Platform | Architecture | Binary |
|----------|--------------|--------|
| Linux | x64 | `openrouter-proxy-linux-x64` |
| Linux | arm64 | `openrouter-proxy-linux-arm64` |
| macOS | x64 | `openrouter-proxy-darwin-x64` |
| macOS | arm64 (Apple Silicon) | `openrouter-proxy-darwin-arm64` |
| Windows | x64 | `openrouter-proxy-win32-x64.exe` |

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
./openrouter-proxy
```

**Start on a custom port:**
```bash
./openrouter-proxy --server-port 8080
```

**Run API server and dashboard on different ports:**
```bash
./openrouter-proxy --server-port 3000 --client-port 5173
```

**Display help:**
```bash
./openrouter-proxy --help
```

### Unified vs Separate Port Modes

- **Unified mode** (default): When `--client-port` is not specified or equals `--server-port`, the dashboard is served by the API server on the same port. Access everything at `http://localhost:<server-port>/`.

- **Separate port mode**: When `--client-port` differs from `--server-port`, the dashboard runs on its own port with API requests proxied to the server port.

### Building from Source

To build the CLI executable from source:

```bash
# Install dependencies
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..

# Build everything
npm run build

# Run the bundled CLI
node dist/bundle.cjs --help
```

### Using the Proxy

Send API requests to the proxy instead of directly to OpenRouter. **You must include your own OpenRouter API key** in the Authorization header:

```bash
# Instead of: https://openrouter.ai/api/v1/chat/completions
# Use: http://localhost:3000/v1/chat/completions

curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_OPENROUTER_API_KEY" \
  -d '{
    "model": "openai/gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

The proxy will:
1. Pass through your request to OpenRouter (with your Authorization header unchanged)
2. Return the response to your client
3. Log the usage data (model, tokens, cost) to the database
4. Display the log in the web dashboard

**Note**: This is a transparent proxy - it does NOT inject its own API key. Each client must provide their own OpenRouter API key.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | Backend server port |
| `VITE_API_URL` | No | `http://localhost:3000` | Backend URL for frontend |

**Transparent Proxy:** This proxy does NOT require or use a server-side API key. Clients must provide their own OpenRouter API keys in the `Authorization` header of each request. The proxy passes through all headers unchanged.

## Service URLs

| Service | URL | Description |
|---------|-----|-------------|
| Web Dashboard | http://localhost:5173 | View usage logs and statistics |
| Proxy API | http://localhost:3000/v1/* | Forward requests to OpenRouter |
| Logs API | http://localhost:3000/api/logs | Query logged usage data |
| Stats API | http://localhost:3000/api/logs/stats | Get summary statistics |

## API Endpoints

### Proxy Endpoint

`POST /v1/chat/completions` - Proxy to OpenRouter chat completions API

### Logs API

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

## Database Schema

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

## Development

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

### Scripts

**Server:**
```bash
cd server
npm run dev      # Start development server with hot reload
npm run build    # Build for production
npm start        # Run production build
```

**Client:**
```bash
cd client
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
```

## Limitations

- Streaming responses are not supported (responses are buffered for logging)
- No authentication/authorization for the proxy
- No rate limiting or caching
- Single-user design (no multi-tenancy)

## License

MIT
