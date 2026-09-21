# SWAP Portal — System Review & Improvement Prompt

> Copy everything between the `---PROMPT START---` and `---PROMPT END---` markers and paste it
> into any capable AI agent (Claude, ChatGPT, Gemini, Cursor, etc.) to get an actionable,
> prioritized improvement plan for this codebase.

---

---PROMPT START---

You are a senior system analyst and staff-level software engineer reviewing the **SWAP Portal**
(Student Welfare Assistantship Program) at MSU–Marawi, a Laravel + Next.js system that manages
student applications, interviews, office assignments, geofenced GPS attendance, supervisor
verification, and stipend payouts.

## Your mission

Audit the whole system and produce a **prioritized improvement plan** — not a code dump. Every
suggestion must be concrete, mapped to real files, and ordered by business impact. Separate the
"must fix" (correctness/security/data-loss) from "should do" (performance, reliability, DX) from
"nice to have" (UI, refactors, a11y).

## Ground truth to read first (do not skip)

These already exist and are accurate — read them before touching code:

- `docs/SYSTEM_OVERVIEW.md` — the system context document. Includes a "Traps" section (§9) of
  non-obvious footguns (timezone rules in UTC vs Manila, THREE clock-in entry points, soft-delete
  vs unique constraints, `QUEUE_CONNECTION=sync` footgun, split frontend/backend commits §9.10).
  Read the Traps before changing anything.
- `docs/IMPROVEMENT_PLAN.md` — previous roadmap. Phases 1–4 are marked DONE; treat them as
  implemented and verified. Do NOT re-propose them unless you find they regressed.
- `DEPLOYMENT.md` and `render.yaml` — production setup (Render free tier: ephemeral disk, inline
  queue, no mail).
- `.gitignore` — note `swap-backend-broken/` is intentionally ignored (abandoned attempt; never
  reference it). It was recently removed from git tracking but the removal is not yet committed.

## Way to work

1. Read the ground-truth docs above first. They will save you from rediscovering known issues.
2. Then explore the code proper:
   - Backend: `swap-backend/routes/api.php` (107 route definitions), `app/Http/Controllers/`
     (thin controllers), `app/Services/` (11 services — the real logic), `app/Repositories/`
     (interface-bound data access), `app/Resources/` (JSON shaping), `app/Support/` (shared rules:
     `InterviewWindow`, `TokenAuth`), `app/Policies/`, `app/Models/` (21), `database/migrations/`
     (41). Scheduler lives in `routes/console.php`.
   - Frontend: `swap-frontend/app/` (App Router; huge page files under `(dashboard)/admin/` and
     `(dashboard)/supervisor/`), `components/`, `lib/api/*.ts` (one file per domain, axios via
     `lib/api/axios.ts`), `lib/hooks/*.ts` (8 hooks), `types/*.ts` (hand-mirrored from backend
     Resources), `__tests__/`.
3. Verify before claiming: run the backend suite (`php artisan test`, needs local Postgres
   `swap_db_test`) and frontend checks (`npx tsc --noEmit`, `npx next build`, `npx vitest run`).
   Report honestly — **5 frontend tests are known pre-existing failures** (§9.9) and are not
   regressions.
4. Do not modify anything. This is analysis only.

## Focus areas (in order of importance)

1. **Security** — any endpoint that lacks authz/policy checks or throttle; secrets in URLs or query
   strings (known smell: document `file_url` uses `?token=`); info leaks in 500 responses; mass
   assignment; token/QR handling; file upload validation; password/reset flows; SQL injection in
   any raw queries.
2. **Data integrity** — "do not edit a past migration" rule; check stored corrupt data (e.g.
   `ApplicationDocument.file_url` literally containing `{DOC_ID}`, a known workaround in
   `DocumentFileController`); one-open-log-per-user; soft-delete uniqueness; audit-log coverage of
   mutations.
3. **Reliability / production-readiness** — the free-tier gaps: ephemeral upload disk
   (S3/R2 is the fix; `league/flysystem-aws-s3-v3` is already a dependency), `QUEUE_CONNECTION=sync`
   so job failures become 500s and emails block requests, `MAIL_MAILER=log` so prod sends no email,
   no CI pipeline (nothing guards the split-commit trap of §9.10), no scheduled cleanup for
   expired tokens/stale data.
4. **Performance** — N+1 queries with and without eager loading; `AnalyticsService` heavy queries;
   frontend bundle/import weight; GPS system battery behaviour (polling cadence); large React pages
   (`admin/offices/page.tsx` ~39 KB, `admin/applications/page.tsx` ~37 KB).
5. **Maintainability / drift** — duplicated rule sets across backend PHP and frontend TS
   (`InterviewWindow.php` vs `lib/utils/interviewWindow.ts`, attendance constants) that can silently
   drift; hand-mirrored `types/` vs `app/Resources/`; inline hex colours with no theme tokens;
   dead folders/files; orphaned npm/composer packages.
6. **Accessibility & UX** — the many custom modals (focus traps, escape handling), colour contrast
   against the maroon `#7C1B26` / gold `#F3D9A0` palette, keyboard navigation, mobile camera flows.

## Constraints

- Never propose editing an existing migration — new migrations only.
- Backend is the enforcement boundary; UI validation is convenience only.
- Keep frontend and backend messages identical for the same rule.
- Match existing style: thin controllers, logic in Services, FormRequests for validation,
  resources in `app/Resources/` (NOT `app/Http/Resources/`), audit-log every important mutation.
- Respect the timezone trap: `config('app.timezone')` is UTC and must stay UTC; Asia/Manila is
  applied explicitly at decision points only.
- A fix to the clock-in flow must touch ALL THREE entry points (`app/scan/page.tsx`,
  `app/(dashboard)/recipient/attendance/scan/page.tsx`,
  `app/(dashboard)/recipient/attendance/page.tsx`) — not just one.
- Assume the frontend and backend ship independently (separate repos/deploys); single-sided changes
  routinely break production in confusing ways.

## Output format

Return a prioritized improvement plan organised as a markdown report with these sections,
placeholder-free and ready to hand to a developer:

1. **Executive summary** — 3–5 bullets: the state of the system and the single highest-leverage
   improvement.
2. **Critical / must fix** — correctness, security and data-integrity issues with a reproduction or
   evidence (file + line) for each.
3. **Recommended / should do** — reliability, production-readiness, performance.
4. **Optional / nice to have** — maintainability, UX, a11y, DX.
5. **Quick wins** — small items with outsized impact, each doable in half a day or less.

For EVERY item include: **why it matters · approach · files involved · effort (S/M/L) · done-when**
(a testable definition of done). Order each section by impact-effort ratio, not by how easy it is
to find. Do not propose gold-plating. If something conflicts with an existing documented decision
(e.g. staying UTC, Render free tier), flag the conflict explicitly instead of silently changing it.

---PROMPT END---

---

## Tips for using this prompt

- The prompt assumes the agent can read the repository from disk (`docs/`, `swap-backend/`,
  `swap-frontend/`). If your target agent needs raw context instead, first paste
  `docs/SYSTEM_OVERVIEW.md` and `docs/IMPROVEMENT_PLAN.md` after the prompt.
- If you only want a sub-part (e.g. "security only", "deployment only"), append one line to the
  prompt: e.g. *"Only cover the Security and Reliability sections; skip everything else."*
- To get an even sharper plan, add: *"Be specific: cite file:line for every claim; if you can't
  verify a suspicion, say so instead of guessing."*
- After the agent returns, the plan can be merged into `docs/IMPROVEMENT_PLAN.md` (which already
  tracks DONE status per phase) — keep that file's format: `why / approach / files / effort /
  done-when` per item.