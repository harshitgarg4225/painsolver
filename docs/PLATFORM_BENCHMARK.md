# Platform Benchmark: PainSolver (Competitor Scope)

Date: February 18, 2026

Sources:
- External install reference documentation
- External API reference documentation

## Customer Portal Coverage

| Capability | PainSolver | Status |
|---|---|---|
| Boards list + board-scoped feedback | `/portal` board sidebar + board feeds | Complete |
| Feedback search / sort / filter | Sort (`Trending`, `Top`, `New`), status filters, search | Complete |
| Upvote + create post when logged in | Login-gated upvote/create actions in customer portal | Complete |
| Read/request access modes | Read-only mode + access request flow | Complete |
| Roadmap view | Planned / In Progress / Complete columns | Complete |
| Changelog view | Changelog tab with search | Complete |
| Support-captured signal | "Captured via Support" badge on posts | Complete (PainSolver+) |

## Company Dashboard Coverage

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

## API Coverage

| API Group | PainSolver Coverage | Status |
|---|---|---|
| Boards | `/api/v1/boards/*` | Complete |
| Categories | `/api/v1/categories/*` | Complete |
| Changelogs | `/api/v1/changelog/*` | Complete |
| Comments | `/api/v1/comments/*` | Complete |
| Companies | `/api/v1/companies/*` | Complete |
| Posts | `/api/v1/posts/*` | Complete |
| Users | `/api/v1/users/*` | Complete |
| Votes | `/api/v1/votes/*` | Complete |
| Roadmaps | Customer/company roadmap APIs exist | Partial |
| Status changes | Supported via post update/change-status | Partial |
| Webhooks | Incoming Freshdesk webhook + queueing | Partial |
| Groups | Not implemented yet | Gap |
| Ideas namespace | Uses `posts` as canonical entity | Gap |
| Insights | Not implemented yet | Gap |
| Opportunities | Not implemented yet | Gap |
| Tags model | Not implemented as first-class API model | Gap |

## PainSolver Superset

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

- PainSolver customer + company product surfaces are complete for current competitor scope.
- PainSolver AI-native workflows (ingest, queue, AI mapping, MRR-weighted prioritization) are integrated.
- Remaining parity gaps are advanced namespaces (`groups`, `insights`, `opportunities`, `tags`) and can be added next.
