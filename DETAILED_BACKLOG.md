# Project: API Key Association for Usage Logs

## Overview
Implement a SHA-256 hash-based system to associate API calls with API keys, enabling users to track usage per key without storing sensitive key data.

## Shared Context
- **AI_README.md**: Project context, conventions, and patterns
- **SOLUTION_DESIGN_REPORT.md**: Approved design with client-side label resolution
- API Key column position: After Timestamp column

## Tasks

### TASK-001: Database Schema Migration
**Objective:** Add `api_key_hash` column to the `usage_logs` table with a safe migration strategy.

**Context:**
- Database is SQLite with WAL mode at `~/.openrouter-proxy/usage.db`
- Schema defined in `/server/src/db/schema.ts`
- Migration must check if column exists before adding (idempotent)
- Column must be nullable for backward compatibility with existing logs

**Constraints:**
- Must not break existing data
- Must create index on new column for efficient filtering
- Must update `INSERT_USAGE_LOG` statement to include new column

**Acceptance Criteria:**
- [ ] `api_key_hash TEXT` column added to `usage_logs` table
- [ ] Index `idx_usage_logs_api_key_hash` created on new column
- [ ] Migration function checks column existence before adding
- [ ] `INSERT_USAGE_LOG` statement includes `api_key_hash` parameter
- [ ] Migration is called during database initialization

---

### TASK-002: Backend Type Definitions Update
**Objective:** Add `api_key_hash` to TypeScript interfaces for type safety.

**Context:**
- Backend types in `/server/src/types/index.ts`
- `UsageLog` interface represents stored log records
- `UsageLogInput` interface represents data to insert

**Constraints:**
- Follow existing naming conventions (snake_case for DB fields)
- Add JSDoc comments for new properties

**Acceptance Criteria:**
- [ ] `api_key_hash: string | null` added to `UsageLog` interface with JSDoc
- [ ] `api_key_hash?: string | null` added to `UsageLogInput` interface with JSDoc
- [ ] TypeScript compilation succeeds with new types

---

### TASK-003: Hash Computation Utility
**Objective:** Create a utility function to compute SHA-256 hash of API keys.

**Context:**
- Use Node.js built-in `crypto` module
- Function will be used in proxy middleware
- Hash must be deterministic (same input = same output)

**Constraints:**
- No external dependencies
- Return hex-encoded string
- Add JSDoc documentation

**Acceptance Criteria:**
- [ ] `hashApiKey(apiKey: string): string` function created
- [ ] Uses SHA-256 algorithm from Node.js crypto module
- [ ] Returns lowercase hex-encoded hash string
- [ ] Function has JSDoc documentation
- [ ] Function exported for use in proxy middleware

---

### TASK-004: Proxy Middleware Enhancement
**Objective:** Extract API key from Authorization header and compute hash during request interception.

**Context:**
- Proxy middleware in `/server/src/middleware/proxy.ts`
- Authorization header format: `Bearer sk-or-...`
- Hash must be available when logging in `proxyRes` handler
- Store hash in request context (e.g., `res.locals`)

**Constraints:**
- Handle missing Authorization header gracefully (store null)
- Handle malformed Authorization header gracefully (store null)
- Minimal performance impact

**Acceptance Criteria:**
- [ ] API key extracted from `Authorization` header in `proxyReq` handler
- [ ] Hash computed using `hashApiKey()` utility
- [ ] Hash stored in `res.locals.apiKeyHash` for access in `proxyRes`
- [ ] Null stored when Authorization header missing or malformed
- [ ] Hash passed to `insertLog()` call with usage data

---

### TASK-005: Database Insert Function Update
**Objective:** Update `insertLog` function to accept and store the API key hash.

**Context:**
- Database operations in `/server/src/db/index.ts`
- `insertLog` function uses prepared statements
- Must work with the updated schema from TASK-001

**Constraints:**
- Maintain backward compatibility (hash parameter should be optional)
- Follow existing coding patterns

**Acceptance Criteria:**
- [ ] `insertLog` function accepts `api_key_hash` in input parameter
- [ ] Hash value bound to INSERT statement
- [ ] Works with null values (for requests without Authorization)
- [ ] Existing functionality unchanged

---

### TASK-006: API Key Hash Map Endpoint
**Objective:** Create endpoint to return a map of API key hashes to labels for client-side resolution.

**Context:**
- API keys stored in settings (`/server/src/db/settings.ts`)
- Client needs to resolve hashes to display friendly labels
- Endpoint should return `{ hash: label }` mapping

**Constraints:**
- Hash computation done on backend (don't expose raw keys)
- Return only hash-to-label mapping (no sensitive data)
- Follow existing route patterns

**Acceptance Criteria:**
- [ ] New endpoint `GET /api/api-keys/hash-map` created
- [ ] Returns JSON object `{ [hash: string]: string }` mapping hash to label
- [ ] Uses `hashApiKey()` utility to compute hashes
- [ ] Returns empty object if no API keys configured
- [ ] Route added to Express app

---

### TASK-007: Client Type Definitions Update
**Objective:** Add `api_key_hash` and `api_key_label` to client-side TypeScript types.

**Context:**
- Client types in `/client/src/types/index.ts`
- Types mirror backend types where needed
- `api_key_label` will be added by client after resolution

**Constraints:**
- Follow existing type conventions
- Both fields should be optional for backward compatibility

**Acceptance Criteria:**
- [ ] `api_key_hash?: string | null` added to client `UsageLog` interface
- [ ] `api_key_label?: string` added to client `UsageLog` interface
- [ ] TypeScript compilation succeeds

---

### TASK-008: Client-Side Label Resolution Hook
**Objective:** Fetch hash map and resolve API key labels in the logs data fetching hook.

**Context:**
- Data fetching in `/client/src/hooks/useLogs.ts`
- Need to fetch hash map from new endpoint (TASK-006)
- Merge labels into log objects before returning

**Constraints:**
- Fetch hash map in parallel with logs for performance
- Handle errors gracefully (show "unknown" on failure)
- Default to "unknown" for unmatched hashes

**Acceptance Criteria:**
- [ ] Fetches `/api/api-keys/hash-map` endpoint
- [ ] Hash map fetched in parallel with logs
- [ ] Each log enriched with `api_key_label` based on hash lookup
- [ ] "unknown" used for null hashes or unmatched hashes
- [ ] Error handling doesn't break logs display

---

### TASK-009: Dashboard Table Display Update
**Objective:** Add "API Key" column to the logs table in the dashboard.

**Context:**
- Logs table in `/client/src/components/LogsTable.tsx`
- Column should appear after Timestamp column
- Display `api_key_label` or "unknown" if not available

**Constraints:**
- Consistent styling with existing columns
- Handle missing label gracefully

**Acceptance Criteria:**
- [ ] New "API Key" column header added after Timestamp
- [ ] Table rows display `api_key_label` value
- [ ] "unknown" displayed when label is missing or null
- [ ] Column width appropriate for typical API key names
- [ ] Visual styling consistent with other columns

---

### TASK-010: Integration Testing
**Objective:** Verify the complete feature works end-to-end.

**Context:**
- Test the full flow: API request → hash stored → logs display label
- Manual testing via curl and browser

**Constraints:**
- Test with actual API key stored in settings
- Test edge cases (no auth, deleted key)

**Acceptance Criteria:**
- [ ] API request with known key stores correct hash in database
- [ ] Dashboard displays correct API key label
- [ ] Request without Authorization header shows "unknown"
- [ ] Deleted API key causes logs to show "unknown"
- [ ] Historical logs (before migration) show "unknown"

---

## Task Dependencies

```
TASK-001 (Schema) ──┬──> TASK-002 (Backend Types) ──> TASK-003 (Hash Util) ──> TASK-004 (Proxy)
                    │                                                              │
                    └──> TASK-005 (DB Insert) <────────────────────────────────────┘
                                │
                                v
                         TASK-006 (Hash Map API)
                                │
                                v
                         TASK-007 (Client Types) ──> TASK-008 (Hook) ──> TASK-009 (Table)
                                                                              │
                                                                              v
                                                                      TASK-010 (Testing)
```
