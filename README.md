# PainSolver

AI-native Voice of Customer platform with passive support capture, semantic feature matching, and revenue-weighted roadmap prioritization.

## Stack
- Node.js + Express + TypeScript
- PostgreSQL + Prisma (+ pgvector-ready column)
- Redis + BullMQ
- OpenAI and Stripe integrations (mock-first for local development)

## Quick Start
1. Copy `.env.example` to `.env`
2. Ensure PostgreSQL and Redis are running (using values from `.env`)
3. Install deps: `npm install`
4. Generate Prisma client: `npm run prisma:generate`
5. Run DB migrations: `npm run prisma:migrate`
6. Start API: `npm run dev`
7. Start worker: `npm run worker`

Open:
- Customer portal: `http://localhost:3000/portal`
- Company dashboard: `http://localhost:3000/company`
- SDK installer: `http://localhost:3000/install`
- Developer docs UI: `http://localhost:3000/docs`

## Deploy (Vercel + Supabase)
1. Create a Supabase project and copy the Postgres connection string.
2. In Supabase SQL editor, enable pgvector:
   - `create extension if not exists vector;`
3. Run Prisma migrations against Supabase:
   - `DATABASE_URL="<SUPABASE_DIRECT_DB_URL>" npm run prisma:deploy`
4. Create a public Supabase Storage bucket named `changelog-media` (or set `SUPABASE_STORAGE_BUCKET`).
5. Create a Redis instance (recommended: Upstash) and copy `REDIS_URL`.
6. Add Vercel env vars:
   - `DATABASE_URL`
   - `REDIS_URL`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_STORAGE_BUCKET`
   - `PAINSOLVER_CLIENT_SECRET`
   - `PAINSOLVER_MASTER_API_KEY`
   - `NODE_ENV=production`
   - `ALLOW_INSECURE_ACTOR_HEADERS=true`
7. Deploy:
   - `vercel --prod`

Notes:
- `vercel.json` routes all traffic to the Express app via `api/index.js`.
- Changelog media uploads use Supabase Storage in deployment.
- BullMQ worker is a long-running process and should run separately from Vercel functions for continuous queue processing.

## Canny-Competitor Surface

### Install / Widget
- SDK script: `GET /sdk/painsolver.js`
- Install helper page: `GET /install`
- Commands:
  - `window.PainSolver("init", { apiBaseUrl, boardToken, boardId, ssoToken, onLoadCallback })`
  - `window.PainSolver("config", { ... })`
  - `window.PainSolver("identify", { user, company, hash })`
  - `window.PainSolver("authenticate", { ssoToken })`
  - `window.PainSolver("render", { selector })`
  - `window.PainSolver("initChangelog", { selector, query, limit })`
  - `window.PainSolver("hasUnseenEntries", { callback })`
  - `window.PainSolver("closeChangelog", { selector })`
  - `window.PainSolver("registerOnChangelogOpenCallback", fn)`

### SDK Security / Tokens
- Issue board-scoped token (server-side): `POST /api/v1/sdk/board-token` (`apiKey` required)
- Issue SSO token (server-side): `POST /api/v1/sdk/sso-token` (`apiKey` required)
- Consume SSO token: `POST /api/v1/sdk/sso/consume`
- Widget posts (board-token/sso-token aware): `GET /api/v1/sdk/posts`
- SDK vote: `POST /api/v1/sdk/votes/create`
- Changelog list: `GET /api/v1/sdk/changelog`
- Changelog unseen state: `GET /api/v1/sdk/changelog/unseen`
- Mark changelog seen: `POST /api/v1/sdk/changelog/seen`

### Core API (Canny-style)
All endpoints below support `apiKey` in JSON body or `Authorization: Bearer <apiKey>` unless noted.

- Boards
  - `POST /api/v1/boards/list`
  - `POST /api/v1/boards/retrieve`
  - `POST /api/v1/boards/create`
- Categories
  - `POST /api/v1/categories/list`
  - `POST /api/v1/categories/create`
  - `POST /api/v1/categories/update`
- Posts
  - `GET /api/v1/posts/list` (widget-friendly)
  - `POST /api/v1/posts/list`
  - `POST /api/v1/posts/retrieve`
  - `POST /api/v1/posts/create`
  - `POST /api/v1/posts/update`
  - `POST /api/v1/posts/change_status`
  - `POST /api/v1/posts/delete`
- Votes
  - `POST /api/v1/votes/create`
  - `POST /api/v1/votes/list`
  - `POST /api/v1/votes/retrieve`
  - `POST /api/v1/votes/delete`
- Comments
  - `POST /api/v1/comments/list`
  - `POST /api/v1/comments/create`
  - `POST /api/v1/comments/delete`
- Users
  - `POST /api/v1/users/list`
  - `POST /api/v1/users/create_or_update`
- Companies
  - `POST /api/v1/companies/list`
  - `POST /api/v1/companies/create_or_update`
- Changelog
  - `POST /api/v1/changelog/list`
  - `POST /api/v1/changelog/create`
  - `POST /api/v1/changelog/publish`
- PainSolver AI triage/admin
  - `POST /api/v1/pain-events/list`
  - `POST /api/v1/pain-events/merge`
  - `POST /api/v1/pain-events/create_post`

### Agent-Ready Company API (Headless)
- Base path: `/api/agent/company/*`
- Auth: `Authorization: Bearer <apiKey>` (scope must include `company:write` or `*`)
- Idempotency: write requests (`POST|PUT|PATCH|DELETE`) require `Idempotency-Key` by default
- Request tracing: server returns `x-request-id` on all responses
- Actor context for agents: if no user headers are sent, backend creates a synthetic member actor from the API credential.

### API Credentials
- `POST /api/v1/api-credentials/create` (admin key required)
- `POST /api/v1/api-credentials/revoke` (admin key required)
- `GET /api/v1/api-credentials/list` (admin key required)

Create credential payload supports optional scopes:
```json
{
  "name": "roadmap-agent",
  "scopes": ["company:write"]
}
```

## Dashboard UI
- Customer side: `GET /portal`
  - Boards, Feedback, Roadmap, Changelog tabs
  - Board-level search/sort/filter
  - Read/request access flow
  - Logged-in upvote + create post
  - Post details + threaded comment replies
  - Notifications + notification preferences
- Company side: `GET /company`
  - 3-pane feedback moderation
  - Status updates + write access actions
  - Access request approvals
  - Bulk edit + merge/unmerge + saved filters
  - AI triage merge workflow
  - Changelog publishing and MRR reporting
- Theme: dark olive green, white, black (white background in customer view)

If `PAINSOLVER_MASTER_API_KEY` is set, dashboard calls require header `x-admin-key`.

## Freshdesk Webhook
- Endpoint: `POST /api/webhooks/freshdesk`
- Behavior:
  - strips HTML
  - scrubs PII (email, phone, key-like tokens)
  - creates `PainEvent` with `pending_ai`
  - pushes `painEventId` to `ai-processing-queue`

## SDK Example
```html
<script src="https://YOUR_API_HOST/sdk/painsolver.js"></script>
<div id="board"></div>
<script>
  window.PainSolver("config", { apiBaseUrl: "https://YOUR_API_HOST" });

  const identifyPayload = {
    user: { email: "pm@acme.com", name: "PM User", appUserId: "pm_1" },
    company: { name: "acme", monthlySpend: 499 },
    hash: "HMAC_SHA256_FROM_YOUR_BACKEND"
  };

  window.PainSolver("identify", identifyPayload).then(function () {
    window.PainSolver("render", { selector: "#board" });
  });
</script>
```

## Notes
- `USE_MOCK_OPENAI` and `USE_MOCK_STRIPE` default to true unless explicitly set to `false`.
- Portal and company dashboards are now Prisma/PostgreSQL-backed (no in-memory mock dependency).
- Vote and MRR mutations use serializable SQL transactions.
- First DB bootstrap seeds boards, users, posts, comments, changelog, triage events, and access requests.
- Hardening env flags:
  - `ALLOW_INSECURE_ACTOR_HEADERS=true` keeps current UI header-auth behavior for local/demo.
  - Set `ALLOW_INSECURE_ACTOR_HEADERS=false` in production to stop trusting raw actor headers unless an API key is present.
  - `AGENT_REQUIRE_IDEMPOTENCY=true` enforces idempotency keys on agent write calls.
