# Canny Benchmark: PainSolver (Canny-Competitor Scope)

Date: February 18, 2026

Sources:
- https://developers.canny.io/install
- https://developers.canny.io/api-reference

## Customer Portal Parity

| Capability | PainSolver | Status |
|---|---|---|
| Boards list + board-scoped feedback | `/portal` board sidebar + board feeds | Complete |
| Feedback search / sort / filter | Sort (`Trending`, `Top`, `New`), status filters, search | Complete |
| Upvote + create post when logged in | Login-gated upvote/create actions in customer portal | Complete |
| Read/request access modes | Read-only mode + access request flow | Complete |
| Roadmap view | Planned / In Progress / Complete columns | Complete |
| Changelog view | Changelog tab with search | Complete |
| Support-captured signal | "Captured via Support" badge on posts | Complete (PainSolver+) |

## Company Dashboard Parity

| Capability | PainSolver | Status |
|---|---|---|
| Write access moderation UI | `/company` with member-write access model | Complete |
| 3-pane feedback workflow | Boards pane, feedback list pane, details pane | Complete |
| Post status management | Status update action in details panel | Complete |
| Feedback creation | Inline company-side post composer | Complete |
| Access request approval | Approve/reject queue for customer access requests | Complete |
| Changelog publishing | Create changelog entries from company dashboard | Complete |
| Reporting summary | Board/post/triage/MRR metrics panel | Complete |
| AI triage queue handling | Merge queue events into roadmap posts | Complete (PainSolver+) |

## API Parity vs Canny API Reference Sections

| Canny Section | PainSolver Coverage | Status |
|---|---|---|
| Boards | `/api/v1/boards/*` | Complete |
| Categories | `/api/v1/categories/*` | Complete |
| Changelogs | `/api/v1/changelog/*` | Complete |
| Comments | `/api/v1/comments/*` | Complete |
| Companies | `/api/v1/companies/*` | Complete |
| Posts | `/api/v1/posts/*` | Complete |
| Users | `/api/v1/users/*` | Complete |
| Votes | `/api/v1/votes/*` | Complete |
| Roadmaps | Customer/company roadmap APIs exist (`/api/portal/.../roadmap`) | Partial |
| Status Changes | Status updates supported via post update/change-status | Partial |
| Webhooks | Incoming Freshdesk webhook + queueing | Partial |
| Groups | Not implemented yet | Gap |
| Ideas | Uses `posts` as idea entity; no separate `ideas` namespace | Gap |
| Insights | Not implemented yet | Gap |
| Opportunities | Not implemented yet | Gap |
| Tags | Not implemented as first-class API model | Gap |
| Autopilot Endpoint | Not implemented as Canny endpoint; replaced by AI triage worker model | Gap |

## PainSolver Superset (Beyond Canny)

| Capability | Implementation | Status |
|---|---|---|
| Passive VoC ingestion | `POST /api/webhooks/freshdesk` | Complete |
| PII scrubbing before persistence | Email/phone/key redaction in ingestion flow | Complete |
| Queue-based AI processing | BullMQ queue + worker architecture | Complete |
| LLM intent extraction | Mock/OpenAI structured extraction service | Complete |
| Semantic post mapping | Embedding + similarity matching flow | Complete |
| Auto implicit vote + MRR attach | Transactional merge logic | Complete |
| Manual triage override | Company triage merge workflow | Complete |
| Stripe MRR normalization | `calculateNormalizedMRR(email)` utility | Complete |

## Current Verdict

- Canny-style **customer + company product surfaces** required for PainSolver are complete for the competitor scope.
- PainSolver-specific AI-native workflows (ingest, queue, AI mapping, MRR-weighted prioritization) are integrated.
- Remaining parity gaps are in advanced Canny API namespaces (`groups`, `insights`, `opportunities`, `tags`, etc.) and can be added as the next phase.
