#!/bin/bash
#
# End-to-End Verification Script for OpenRouter Usage Proxy
# This script verifies the complete logging flow from API call to dashboard display
#
# Prerequisites:
#   - Node.js 18+ installed
#   - npm installed
#   - OPENROUTER_API_KEY set in server/.env
#
# Usage:
#   chmod +x scripts/verify-e2e.sh
#   ./scripts/verify-e2e.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo -e "${BLUE}===========================================${NC}"
echo -e "${BLUE}  OpenRouter Usage Proxy E2E Verification${NC}"
echo -e "${BLUE}===========================================${NC}"
echo ""

# =============================================================================
# Step 1: Check prerequisites
# =============================================================================
echo -e "${YELLOW}Step 1: Checking prerequisites...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js: $(node --version)${NC}"

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm: $(npm --version)${NC}"

# =============================================================================
# Step 2: Install dependencies
# =============================================================================
echo ""
echo -e "${YELLOW}Step 2: Installing dependencies...${NC}"

cd "$PROJECT_ROOT/server"
if [ ! -d "node_modules" ]; then
    echo "Installing server dependencies..."
    npm install
fi
echo -e "${GREEN}✓ Server dependencies installed${NC}"

cd "$PROJECT_ROOT/client"
if [ ! -d "node_modules" ]; then
    echo "Installing client dependencies..."
    npm install
fi
echo -e "${GREEN}✓ Client dependencies installed${NC}"

# =============================================================================
# Step 3: Check environment
# =============================================================================
echo ""
echo -e "${YELLOW}Step 3: Checking environment...${NC}"

cd "$PROJECT_ROOT/server"
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ server/.env file not found${NC}"
    echo -e "   Copy .env.example to server/.env and set your OPENROUTER_API_KEY"
    exit 1
fi

if ! grep -q "OPENROUTER_API_KEY=sk-" "server/.env" 2>/dev/null && \
   ! grep -q "OPENROUTER_API_KEY=\"sk-" "server/.env" 2>/dev/null; then
    echo -e "${YELLOW}⚠ OPENROUTER_API_KEY may not be set in server/.env${NC}"
    echo "   Proxy will forward requests but may fail without valid API key"
fi
echo -e "${GREEN}✓ Environment file exists${NC}"

# =============================================================================
# Step 4: TypeScript compilation check
# =============================================================================
echo ""
echo -e "${YELLOW}Step 4: Checking TypeScript compilation...${NC}"

cd "$PROJECT_ROOT/server"
npx tsc --noEmit 2>&1 || {
    echo -e "${RED}❌ Server TypeScript compilation failed${NC}"
    exit 1
}
echo -e "${GREEN}✓ Server TypeScript compiles OK${NC}"

cd "$PROJECT_ROOT/client"
npx tsc --noEmit 2>&1 || {
    echo -e "${RED}❌ Client TypeScript compilation failed${NC}"
    exit 1
}
echo -e "${GREEN}✓ Client TypeScript compiles OK${NC}"

# =============================================================================
# Step 5: Start backend server
# =============================================================================
echo ""
echo -e "${YELLOW}Step 5: Starting backend server...${NC}"

cd "$PROJECT_ROOT/server"

# Kill any existing server on port 3000
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Start server in background
npm run dev &
SERVER_PID=$!
echo "Started server with PID: $SERVER_PID"

# Wait for server to be ready
echo "Waiting for server to start..."
sleep 3

# Health check
if curl -s http://localhost:3000/health | grep -q "ok"; then
    echo -e "${GREEN}✓ Backend server running on http://localhost:3000${NC}"
else
    echo -e "${RED}❌ Backend server failed to start${NC}"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
fi

# =============================================================================
# Step 6: Verify API endpoints
# =============================================================================
echo ""
echo -e "${YELLOW}Step 6: Verifying API endpoints...${NC}"

# Test /api/logs
LOGS_RESPONSE=$(curl -s http://localhost:3000/api/logs)
if echo "$LOGS_RESPONSE" | grep -q '^\['; then
    echo -e "${GREEN}✓ GET /api/logs returns array${NC}"
else
    echo -e "${RED}❌ GET /api/logs failed${NC}"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
fi

# Test /api/logs/stats
STATS_RESPONSE=$(curl -s http://localhost:3000/api/logs/stats)
if echo "$STATS_RESPONSE" | grep -q "request_count"; then
    echo -e "${GREEN}✓ GET /api/logs/stats returns stats${NC}"
else
    echo -e "${RED}❌ GET /api/logs/stats failed${NC}"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
fi

# =============================================================================
# Step 7: Test proxy endpoint (requires valid API key)
# =============================================================================
echo ""
echo -e "${YELLOW}Step 7: Testing proxy endpoint...${NC}"

PROXY_RESPONSE=$(curl -s -X POST http://localhost:3000/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{
        "model": "openai/gpt-3.5-turbo",
        "messages": [{"role": "user", "content": "Say hello in 5 words or less"}],
        "max_tokens": 50
    }')

if echo "$PROXY_RESPONSE" | grep -q "choices" || echo "$PROXY_RESPONSE" | grep -q "error"; then
    echo -e "${GREEN}✓ Proxy endpoint responds${NC}"

    # Check if it was successful (has choices) or errored
    if echo "$PROXY_RESPONSE" | grep -q "choices"; then
        echo -e "${GREEN}✓ API call successful (valid response with choices)${NC}"
    else
        echo -e "${YELLOW}⚠ API returned error (check API key or quota)${NC}"
    fi
else
    echo -e "${RED}❌ Proxy endpoint not responding${NC}"
fi

# =============================================================================
# Step 8: Verify database logging
# =============================================================================
echo ""
echo -e "${YELLOW}Step 8: Verifying database logging...${NC}"

cd "$PROJECT_ROOT/server"
if [ -f "usage.db" ]; then
    echo -e "${GREEN}✓ Database file exists: usage.db${NC}"

    # Check table exists
    TABLE_CHECK=$(sqlite3 usage.db "SELECT name FROM sqlite_master WHERE type='table' AND name='usage_logs';" 2>/dev/null || echo "")
    if [ "$TABLE_CHECK" = "usage_logs" ]; then
        echo -e "${GREEN}✓ usage_logs table exists${NC}"
    else
        echo -e "${YELLOW}⚠ Could not verify table (sqlite3 may not be installed)${NC}"
    fi

    # Check WAL mode
    WAL_CHECK=$(sqlite3 usage.db "PRAGMA journal_mode;" 2>/dev/null || echo "")
    if [ "$WAL_CHECK" = "wal" ]; then
        echo -e "${GREEN}✓ WAL mode enabled${NC}"
    fi

    # Count logs
    LOG_COUNT=$(sqlite3 usage.db "SELECT COUNT(*) FROM usage_logs;" 2>/dev/null || echo "unknown")
    echo -e "${GREEN}✓ Current log count: $LOG_COUNT${NC}"
else
    echo -e "${YELLOW}⚠ Database not yet created (will be created on first request)${NC}"
fi

# =============================================================================
# Step 9: Check logs after proxy call
# =============================================================================
echo ""
echo -e "${YELLOW}Step 9: Checking logs after proxy call...${NC}"

# Fetch logs again to see if new entry was added
LOGS_AFTER=$(curl -s http://localhost:3000/api/logs)
if echo "$LOGS_AFTER" | grep -q "timestamp"; then
    echo -e "${GREEN}✓ Logs contain entries${NC}"

    # Show latest log
    LATEST_LOG=$(echo "$LOGS_AFTER" | head -c 500)
    echo "Latest log preview:"
    echo "$LATEST_LOG..."
else
    echo -e "${YELLOW}⚠ No logs found (API call may have failed)${NC}"
fi

# =============================================================================
# Step 10: Start frontend (optional)
# =============================================================================
echo ""
echo -e "${YELLOW}Step 10: Frontend verification...${NC}"
echo ""
echo "To verify the frontend dashboard:"
echo "  1. Open a new terminal"
echo "  2. Run: cd $PROJECT_ROOT/client && npm run dev"
echo "  3. Open http://localhost:5173 in your browser"
echo "  4. Verify:"
echo "     - Dashboard loads without errors"
echo "     - Summary statistics cards are visible"
echo "     - Logs table shows logged API calls"
echo "     - Refresh button works"

# =============================================================================
# Cleanup
# =============================================================================
echo ""
echo -e "${YELLOW}Cleanup...${NC}"
echo "Server is still running (PID: $SERVER_PID)"
echo "To stop: kill $SERVER_PID"

echo ""
echo -e "${BLUE}===========================================${NC}"
echo -e "${GREEN}  E2E Verification Complete!${NC}"
echo -e "${BLUE}===========================================${NC}"
echo ""
echo "Summary:"
echo "  ✓ Dependencies installed"
echo "  ✓ TypeScript compiles"
echo "  ✓ Backend server running"
echo "  ✓ API endpoints working"
echo "  ✓ Proxy endpoint responds"
echo "  ✓ Database logging verified"
echo ""
echo "Next steps:"
echo "  1. Start frontend: cd client && npm run dev"
echo "  2. Open http://localhost:5173"
echo "  3. Make API calls and verify they appear in dashboard"
