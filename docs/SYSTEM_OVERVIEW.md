# SWAP Portal — System Context Document

> **Purpose of this file.** A complete, self-contained briefing on the SWAP Portal codebase,
> written to be pasted into an AI coding agent as context. It describes what the system is, how
> it is built, the rules it enforces, the conventions to follow, and the traps that have already
> caught people. Read the "Traps" section before changing anything — several of them are
> non-obvious and have each cost a debugging session.

> Last verified against the repository: **2026-09-25** (HEAD `fda695a5`).

---

## 1. What the system is

The **SWAP Portal** (Student Work Assistantship Program) is the management system for MSU –
Marawi's student assistantship programme, run by the **Division / Office of Student Affairs
(DSA)**. It covers the full lifecycle:

1. A student **applies** and uploads requirements (COR, grades, letter of intent, 2×2 photo).
2. DSA staff **review** the application, **schedule an interview**, and **approve or reject**.
3. An approved student becomes a **recipient**, is **assigned** to a host office with a
   **supervisor** and a required number of service hours.
4. The recipient **clocks in and out** by scanning their office's QR code, with **GPS geofence
   verification** and an optional **proof-of-presence selfie**.
5. Before clocking out they submit a **narrative report** of what they worked on.
6. The supervisor **verifies** the logged hours.
7. Verified hours drive **stipend release** and progress reporting (duty slips, weekly/monthly/
   semester reports).
8. An admin **releases (certifies) a digital claim stub** for an eligible recipient — control
   number + single-use QR token + server-rendered PDF, co-signed by the supervisor (SWAP Mentor)
   and the director. The recipient **confirms receipt** with the releasing officer, closing the
   claim. See `docs/STIPEND_CLAIM_DESIGN.md` and §6.
9. A recipient short on hours after semester end may file a **promissory note** (with supporting
   document); a governing supervisor approves (with a makeup deadline) or rejects, which can
   restore stipend eligibility.

Roles: `applicant`, `recipient`, `supervisor`, `admin`. There is no Banking Office role — an
external officer verifies via the token-gated `GET /stipend/verify/{claimToken}` link.

---

## 2. Repository layout

```
SWAP-Project/
├── swap-backend/          Laravel 12 REST API (PHP 8.2)
├── swap-frontend/         Next.js 15 App Router (React 19, TypeScript)
├── swap-backend-broken/   DEAD — an abandoned earlier attempt. Never touch or reference it.
├── docs/                  Test cases + this document + STIPEND_CLAIM_DESIGN + AUDIT_2026-09
├── render.yaml            Render Blueprint: Postgres + API + scheduler cron
├── DEPLOYMENT.md          Production notes (queue worker, scheduler, SMTP)
└── IMPROVEMENT_PLAN.md    Older planning notes
```

The two apps are deployed **separately**: backend on **Render** (Docker), frontend on **Vercel**.
They are not a monorepo with shared tooling — each has its own dependency tree and build.

---

## 3. Stack

### Backend (`swap-backend/`)

| Thing | Value |
|---|---|
| Framework | Laravel **12** |
| PHP | **8.2** |
| Database | **PostgreSQL** (17 locally, Render Postgres in prod). Postgres-specific SQL is used (enums, partial indexes, `UPDATE … FROM`) — do not assume portability to MySQL/SQLite. |
| Auth | **Laravel Sanctum** (bearer tokens, not session cookies) |
| Realtime | **Laravel Reverb** (websockets) — `BROADCAST_CONNECTION=log` in dev, so broadcasts are inert locally |
| Queue | `QUEUE_CONNECTION=sync` in dev *and* in the default Render config — **jobs run inline and their exceptions propagate into the HTTP response** |
| Mail | Pluggable. `log` by default; **Brevo HTTP API** transport registered in `AppServiceProvider` |
| PDF | **barryvdh/laravel-dompdf** for stipend claim stubs; requires PHP **GD with JPEG/FreeType/WebP** (see §8). Slip re-render is non-fatal — a render failure surfaces as a readable `503`, not a 500 |
| Tests | PHPUnit via `php artisan test`, against a real Postgres database `swap_db_test` |

### Frontend (`swap-frontend/`)

| Thing | Value |
|---|---|
| Framework | **Next.js 15**, App Router, `'use client'` components throughout |
| React | **19** |
| Language | TypeScript (strict) |
| Server state | **TanStack Query v5** (`@tanstack/react-query`) |
| Client state | **Zustand** (`lib/store/authStore`) |
| Forms | **react-hook-form** + **Zod** (`@hookform/resolvers/zod`) |
| HTTP | **axios** (`lib/api/axios.ts` — attaches the bearer token) |
| Styling | **Tailwind CSS v4** with `@theme` design tokens in `app/globals.css` (seal-green `brand` primary, `maroon` secondary, `gold` highlights, green-tinted `ink` neutrals + `success/warning/danger/info/violet` status colours) |
| Icons | **lucide-react** |
| Charts | **recharts** |
| Maps | **leaflet** / **react-leaflet** (office geofence picker) |
| QR scanning | **html5-qrcode** |
| Tests | **Vitest** + Testing Library |

---

## 4. Architecture and conventions

### Backend layering

```
routes/api.php
  └── app/Http/Controllers/{Admin,Supervisor,Recipient,Applicant,Auth,Shared}/…
        ├── app/Http/Requests/…            FormRequest validation
        ├── app/Services/…                 business logic (the real work lives here)
        │     └── app/Repositories/…       data access behind Contracts/ interfaces
        ├── app/Resources/…                JSON shaping (note: NOT app/Http/Resources)
        ├── app/Policies/…                 per-record authorization
        └── app/Models/…                   Eloquent
```

Conventions that are consistently followed and should be preserved:

- **Controllers are thin.** They validate (via a FormRequest), call a Service, and return JSON.
  Business rules belong in `app/Services/`.
- **Repositories are bound by interface** in `AppServiceProvider::register()`
  (`UserRepositoryInterface → UserRepository`, etc.). Inject the interface.
- **Resources live in `app/Resources/`**, not the Laravel-default `app/Http/Resources/`.
- **Shared rule sets get a `app/Support/` class** so the FormRequest, the service and the tests
  all read one definition. Example: `App\Support\InterviewWindow`.
- **Every mutation that matters is audit-logged** via `AuditLog::record($action, $model, $old,
  $new, $userId)`.
- **Comments explain *why*, not *what*.** The codebase has a distinctive commenting style: short
  paragraphs above non-obvious logic explaining the reasoning or the bug being prevented. Match it.

### Frontend structure

```
app/
├── (auth)/          login, register, forgot/reset password, verify-email, accept-invitation
├── (dashboard)/     role-scoped areas: admin/, supervisor/, recipient/, applicant/, profile, notifications
│                    + recipient/layout.tsx, recipient/stipend/ (claim stubs + promissory section),
│                    + admin/stipend/ (step-up unlock + bulk release), supervisor/promissory/,
│                    + admin/duty-slip-verify/ (control-number verification)
├── scan/            STANDALONE QR deep-link target (see Traps §9.2)
└── chatbot/
components/
├── attendance/  admin/  application/  auth/  charts/  chatbot/  landing/  layout/  notifications/  shared/  ui/  recipient/
│                + attendance/SemesterServiceReport.tsx (semester mode), shared/SignaturePad.tsx (canvas specimen
│                capture), recipient/MissingSignatureBanner.tsx (clock-in/receipt nudge), landing/HeroSlideshow.tsx,
│                landing/FaqAccordion.tsx
lib/
├── api/         one file per domain; all call apiClient from axios.ts (+ promissory.api.ts)
├── hooks/       useCameraStream, useApplications, useReverb, …
├── store/       Zustand
└── utils/       formatDate (Asia/Manila), geolocation, interviewWindow, pace, formatHours,
│                + duty-slip helpers (mondayOf/iso/buildRow/makeControlNo/stepTerm) and avatarSrc(url,token)
types/           *.types.ts — hand-written, must be kept in sync with app/Resources/ output (+ promissory.types.ts;
│                new drift surface: signature_url / supervisor_signature_url / position_title / recorded_hours)
public/          + dsa-seal-watermark.webp (ambient dashboard backdrop), dsa-logo.png, default-avatar.svg
```

Conventions:

- API calls **never** appear inline in components — they go through `lib/api/*.api.ts`.
- Server data is fetched with `useQuery`; mutations with `useMutation` + `invalidateQueries`.
- Types in `types/` mirror the backend Resources **by hand**. Changing a Resource means editing
  the matching `.types.ts`.
- Colours come from the `@theme` tokens in `app/globals.css` (`bg-brand-700`, `text-ink-900`,
  `bg-success/warning/danger/info/violet-*`). Do not reintroduce inline hex for brand surfaces —
  maroon (`#8E1B1E`) is accents only; the primary is seal-green (`#1F5B3A` buttons/links,
  `#16452B` header band, `themeColor #10331F`).
- Duty slips have two modes in `DutySlip.tsx` + `SemesterServiceReport.tsx`: weekly grid
  (Mon–Sun) vs. semester service report (summary + weekly breakdown + certification). The control
  number must stay bit-identical to `App\Support\DutySlipControl` (see Traps §9.11). Full-semester
  views fetch `per_page=300` (backend max `500`); printing relies on `SlipPrintStyles` + the
  dashboard shell's `print:hidden` chrome.

---

## 5. Domain model

Core tables (46 migrations total; the first 37 are the original `2024_01_01_*` series, plus
four `2026_09_20_*` and five `2026_09_21_*` / `2026_09_23_*` additions).

| Model | Notes |
|---|---|
| `User` | **SoftDeletes.** Holds `role`, `is_active`, `office_id` (supervisors), `avatar_path`, `require_clock_in_selfie`, plus `signature_image_path` (drawn e-signature specimen, served via `GET /users/{id}/signature`) and `position_title` (required on the releasing admin — prints on every claim stub) |
| `StudentProfile` | 1:1 with User. **SoftDeletes.** `student_id_number` (9 digits, unique among live rows), first/middle/last name, college, program, year_level |
| `Office` | Host office. Geofence (`latitude`, `longitude`, `radius_meters`, `geofence_enabled`), `qr_code`/`qr_secret`, `max_recipients`, `logo_path` (+ `logo_url` accessor) |
| `Application` | Status enum (Postgres type `application_status`): `submitted → under_review → interview_scheduled → approved \| rejected`. Has `type` (new/renewal) |
| `ApplicationDocument` | Uploaded requirements; served through a controller, not public URLs |
| `Interview` | 1:1 with Application. `scheduled_at`, `mode` (`in_person`\|`online`), `location`, `meeting_link`, `duration_minutes`, `status` |
| `Assignment` | Recipient ↔ Office ↔ Supervisor for an academic year/semester. `required_hours` (default 200), `status` (`active`\|`completed`\|`suspended`) |
| `TimeLog` | One attendance session. `status`: `open → pending_verification → verified \| rejected`. GPS + accuracy + `location_flagged` + selfie path |
| `NarrativeReport` | Required before manual clock-out |
| `Verification` | Supervisor's accept/reject of logged hours |
| `StipendHistory` | Claim stub lifecycle (plain `varchar(20)`, **not** a Postgres enum): `pending → certified → claimed`, with `void` terminal (pre-claim only). New rows are created already `certified` (release == certify, Option C). `released` survives only as a legacy read value for pre-2026-09-21 rows. Columns: `control_number` (`SWAP-STP-YYYYMM-#####`, unique), `claim_token` (64-char, single-use, nulled on receipt/void), `certified_by/at`, `claimed_at`, `receipt_signed_at`, `releasing_officer_name`, `slip_path`, `voided_at`, `void_reason` |
| `StipendSignature` | One row per signatory on a stub: `supervisor` (SWAP Mentor) + `director` at release, `beneficiary` + `releasing_officer` at receipt. `method`: `drawn` (specimen image) vs `authenticated` (typed/action fallback) |
| `PromissoryNote` | Post-semester shortfall pledge: `assignment_id`, `user_id`, `verified_hours_snapshot`, `lacking_hours`, document (`file_path/name/mime/file_size`), `reason`, `status` (`pending → approved \| rejected`), `reviewed_by/at`, `review_remarks`, `makeup_deadline` (= semester end + 7 days, server-computed). One pending note per assignment enforced in the service |
| `StaffInvitation` | Token-based invite flow for supervisor/admin accounts (students self-register) |
| `Setting` | Key/value app settings, e.g. `applications_open`, `semester_end_date` (promissory fallback when an assignment has no `end_date`) |
| `AuditLog` | Polymorphic change trail |
| `Concern`, `FaqKnowledgeBase` | Chatbot / help desk |
| `WeeklyReport`, `MonthlyReport`, `SemesterReport` | Generated by scheduled jobs |

**Key relationship subtlety:** a supervisor's students are defined by
`Assignment::scopeVisibleToSupervisor()` as *"assigned to them directly **OR** hosted at their
office"*. Co-supervisors of one office share the same students. `Assignment::governingSupervisors()`
returns that same set from the assignment's side. **Any new per-supervisor setting must use this
definition, not `assignment.supervisor_id` alone.** The promissory review gate and the
`UserPolicy::viewSignature` rule reuse it (a recipient may view their own active supervisor's ink;
co-supervisors otherwise get a typed-name fallback, not the image).

---

## 6. Business rules currently enforced

### Registration (`RegisterRequest`)
- Email must end with `@s.msumain.edu.ph` (case-insensitive, lowercased before validation).
- Student ID: exactly 9 digits, unique among **non-soft-deleted** profiles.
- Names: letters (incl. ñ/Ñ, accents), spaces, hyphens, apostrophes, periods. Max 100 (255 for
  the full name). Trimmed and whitespace-collapsed before validation.
- "Full Name (as per records)" must equal one of: `First Middle Last`, `First M. Last`,
  `First M Last`, or `First Last`. Case- and whitespace-insensitive. Multi-word middle names
  initialise per word (`Dela Cruz` → `D. C.`).
- New accounts are created `is_active = false` and unverified; clicking the emailed verification
  link activates them.

### Interview scheduling (`App\Support\InterviewWindow`)
All comparisons in **Asia/Manila**.
- Never in the past.
- **Face-to-face:** Monday–Friday, must start **and end** between **7:00 AM and 5:00 PM**.
- **Online:** any day, must start **and end** between **8:00 AM and 11:00 PM**.
- Online requires a valid `meeting_link` URL.
- `duration_minutes` (default 30) is what makes "must end within" checkable.
- Mirrored client-side in `lib/utils/interviewWindow.ts` — **change both or they drift.**

### Attendance (`AttendanceService`)
- Clock-in allowed **Mon–Sat, 06:00–17:30 Asia/Manila** (`CLOCK_IN_START_MINUTE` /
  `CLOCK_IN_END_MINUTE`).
- Office must have geofencing configured; recipient must be inside `radius_meters`.
- GPS accuracy worse than **100 m** → log is `location_flagged`, not rejected.
- Travel faster than **130 km/h** between two fixes → flagged as implausible.
- Max session **12 hours**; `attendance:close-stale` (hourly cron) force-closes longer ones.
- Auto clock-out has a **10-minute grace period** outside the premises.
- A **narrative report is required** before a manual clock-out.
- **Selfie:** required unless *any* supervisor governing the assignment has
  `require_clock_in_selfie = false`. Enforced server-side in `timeInGeofence()`.
- One open log per user (DB-enforced, migration `…034_enforce_one_open_log_per_user`).
- **Signature specimen gate:** clock-in is rejected server-side (`AttendanceService`) when the
  user has no `signature_image_path` — the specimen signs the stub at release and the receipt at
  payout. The UI nudges via `MissingSignatureBanner` → Profile; a weekly `remind:missing-signatures`
  cron sends the mail + in-app ping.

### Stipend claim stub (`StipendClaimService`, Option C — release == certify)
- Eligibility (`StipendService`): active assignment with `verified_sum >= required_hours`, **or** a
  shortfall covered by an **approved** promissory note for the same user/year/semester; minus any
  live (`pending|certified|claimed|released`) row. `void` frees the period. Default amount
  `₱5,000` (`DEFAULT_STIPEND_AMOUNT`, admin-overridable per release).
- Release creates the row already `certified` with `control_number SWAP-STP-YYYYMM-#####`
  (Manila month, `-R2…` suffix on collision) + 64-char `claim_token`; auto co-signs `supervisor`
  (assignment's supervisor, `drawn` if they saved a specimen else `authenticated`) and `director`
  (per-release image wins, else the admin's specimen); refuses with 422 when the admin has no
  `position_title`. Renders the PDF (non-fatal), audit-logs `released`, notifies `StipendAvailable`.
  Bulk release takes up to 100 items and reports `{released[], skipped[{user_id, reason}]}`.
- Step-up: `password` XOR `unlock_token`. The token is opaque (sha256-cached), sliding 900 s,
  from `POST /admin/stipend/unlock` (throttled `6,1`).
- Receipt (`POST /recipient/stipend/{id}/confirm-receipt`, owner only, `certified` only): sets
  `claimed/claimed_at/receipt_signed_at`, stores `releasing_officer_name`, adds `beneficiary`
  (specimen, uploaded image, or typed fallback) + `releasing_officer` rows, re-renders the PDF,
  audit-logs `claimed`, fires `StipendReleased` (= received). **Consumes the token
  (`claim_token=null`)** — the verify link is single-use and 404s afterwards.
- Verify (`GET /stipend/verify/{claimToken}`, throttled `30,1`) returns only
  `control_number/recipient_name/amount/year/semester/period/certified_at/status` + `valid:true`;
  unknown/claimed/void → `404 {valid:false}`.
- Void is pre-claim only; claimed → 422 ("post a reversing entry instead"). Token nulled,
  audit-logged.
- `claim_token`/`slip_path`/`file_path` are never in list JSON (`has_slip` flag instead); the slip
  download regenerates a missing PDF (ephemeral-disk caveat, §8/§11.1).

### Promissory notes (`PromissoryService`)
- Submit (recipient, Asia/Manila) only after semester end (`assignment.end_date`, else
  `Setting semester_end_date` end-of-day), only when `0 < verified < required`, one pending note
  per assignment. File: pdf/jpg/jpeg/png ≤ 5 MB on the `documents` disk. `lacking_hours` is
  snapshotted server-side (`required − verified`).
- Review by a **governing supervisor** only (else 404). Approve requires `lacking_hours` and sets
  `makeup_deadline = semester_end + 7 days`; reject requires `review_remarks`. Single review —
  re-review → 422. Notifications: `promissory_submitted → supervisors`,
  `promissory_reviewed → student`.

### Duty-slip verification (`DutySlipControl` + `DutySlipController::verify`)
- Control No. `SWAP-{SID}-{YY}{YY}{SEM}-{RANGE}-{checksum}` (`SEM` or `W+YYYYMMDD` Monday,
  6-char base36 djb2 of `sid|ay|sem|range`). The PHP and TS generators must stay **bit-identical**.
- Verify recomputes the checksum, resolves the student (non-alphanumerics stripped), and returns
  `recorded_hours` (rejected logs excluded, manual bonus included; `SEM` scoped to the assignment
  term, `W…` to the Mon–Sun range) so the admin compares it against the printed total. Checksum
  proves format-authenticity only — the hour comparison is manual.

---

## 7. API surface

Base path `/api`. Auth via `Authorization: Bearer <sanctum token>`.

| Prefix | Middleware | Routes | Purpose |
|---|---|---|---|
| `auth/*` | public | 6 | register, login, logout, forgot/reset password, resend verification |
| `invitations/*` | public | 2 | show + accept a staff invitation |
| `email/verify/{id}/{hash}` | signed | 1 | email verification |
| `stipend/verify/{claimToken}` | public, token-gated + `throttle:30,1` | 1 | Banking Office claim check (single-use; 404 `{valid:false}` after claim/void) |
| `documents/*/file`, `users/*/avatar`, `users/*/signature`, `attendance/*/photo` | in-controller auth | 4 | file serving that works in new tabs / `<img src>` (signature: self, admin, governing supervisor) |
| `qr-codes/*` | **none (public)** | 2 | Legacy dead endpoints — see §13 security note |
| `chatbot/query` | public, **unthrottled** | 1 | gap — see AUDIT R4 |
| `applicant/*` | `role:applicant` | 6 | submit application, upload documents |
| `recipient/*` | `role:recipient` | 20 | attendance, hours, narratives, stipend history + claim-slip download + receipt confirmation, promissory index/store/file, renewal, duty slip |
| `supervisor/*` | `role:supervisor` | 20 | students, verifications, roster reports, office QR, **settings**, promissory index/review/file |
| `admin/*` | `role:admin` | 46 | applications, interviews, offices, assignments, users, stipend (index/eligible/**unlock/release/release-bulk/void**), promissory index/file, duty-slip verify, analytics, audit logs |
| `profile/*`, `notifications/*`, `concerns`, `chatbot`, `settings` | authenticated | ~14 | shared + signature specimen upload/delete (`POST/DELETE /profile/signature`) |

Response shape is consistently `{ "data": …, "message": … }`, with Laravel's standard
`{ "message": …, "errors": { field: [msg] } }` on 422. Sensitive paths (`claim_token`,
`slip_path`, promissory `file_path`) are never in list JSON — clients use `has_slip` /
dedicated download endpoints. `POST /admin/stipend/release*` and `/void` accept
`password` XOR `unlock_token` (bulk: `unlock_token` only).

---

## 8. Environment and deployment

### Local development

Two terminals:

```powershell
# Terminal 1 — API on :8000
cd swap-backend
php artisan serve

# Terminal 2 — UI on :3000
cd swap-frontend
npm run dev
```

Requires local PostgreSQL running (`swap_db`). Seeded demo accounts:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@msu-marawi.edu.ph` | `Admin@12345` |
| Supervisor | `supervisor1@msu-marawi.edu.ph` | `Super@12345` |
| Applicant | `ali@student.msu-marawi.edu.ph` | `Student@12345` |
| Recipient | `norhana@student.msu-marawi.edu.ph` | `Student@12345` |

Reset: `php artisan migrate:fresh --seed`. `AnalyticsTestSeeder` adds ~100 `*@test.swap` users and
is **not** part of `DatabaseSeeder` — run it explicitly.

Key `.env` values in dev: `DB_CONNECTION=pgsql`, `APP_URL=http://localhost:8000`,
`FRONTEND_URL=http://localhost:3000`, `QUEUE_CONNECTION=sync`, `BROADCAST_CONNECTION=log`,
`MAIL_MAILER=log`. Requires the PHP **GD extension** locally (claim stubs with drawn signatures
fail to render without it). Frontend `.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:8000/api`.

### Production

- **Backend → Render** via `render.yaml`: a Postgres database, a Docker web service (runs
  migrations on boot through `start.sh`, **GD with JPEG/FreeType/WebP baked into the image**,
  `ext-gd` pinned in `composer.json` so the build fails instead of runtime), and a cron service
  running `php artisan schedule:run` every minute.
- Scheduled jobs: `attendance:close-stale` (hourly) + `remind:missing-signatures` (weekly —
  mail + in-app nudge to recipients without a specimen).
- **Frontend → Vercel** (`themeColor #10331F`, ambient `dsa-seal-watermark.webp` backdrop,
  print CSS for duty slips; note the larger `dsa-logo.png` ~310 kB).
- `render.yaml` hardcodes `MAIL_MAILER=log`; real mail requires dashboard env overrides.
- Uploads use Laravel's **public disk** (`config('filesystems.documents_disk', 'public')`) and
  need `php artisan storage:link`. **On Render's free tier the filesystem is ephemeral** — uploaded
  documents, avatars, office logos, **signature specimens, promissory documents and rendered
  claim-stub PDFs** do not survive a redeploy (a missing stub is regenerated on download, but
  specimens and promissory files are lost — and clock-in is gated on the specimen). Moving to
  S3-compatible storage is a known outstanding improvement (§11.1).

### Mail (Brevo)

The Brevo HTTP-API transport is registered in `AppServiceProvider::boot()` and selected with
`MAIL_MAILER=brevo`. It reads **`BREVO_API_KEY`** (via `config('services.brevo.key')`). Brevo also
enforces an **IP allowlist** for API keys, which blocks Render's rotating egress IPs; either
allowlist the address or disable the allowlist under Brevo → Security → Authorised IPs.
Mail chrome is seal-green (`#1F5B3A` buttons/links, `#16452B` header band — see
`EmailBrandingTest`). Two stipend mails: `StipendAvailable` ("ready to claim", control no. + slip
link) at certify, and the repurposed `StipendReleased` ("received", Receiving Slip) at receipt.

---

## 9. Traps — read before editing

These are real defects or footguns that have already been hit in this codebase.

### 9.1 Timezone: the app runs in UTC, the rules are in Manila
`config('app.timezone')` is **`UTC`** and must stay that way — flipping it would reinterpret every
stored timestamp. Asia/Manila is applied **explicitly** at each decision point
(`AttendanceService::CLOCK_IN_TIMEZONE`, `InterviewWindow::TIMEZONE`, the frontend's
`formatDate.ts` and `interviewWindow.ts`).

**The subtle part:** Laravel stores a datetime string using whatever wall clock it carries, so
posting `2026-09-28T14:00:00+08:00` saves as `14:00 UTC`, not `06:00 UTC`. `StoreInterviewRequest`
fixes this in `prepareForValidation()` by parsing with Manila as the fallback zone and converting
to UTC before anything else sees it. **Any new endpoint accepting a datetime needs the same
treatment.**

### 9.2 There are THREE clock-in entry points
Any change to the clock-in flow must be applied to all of them:

1. `app/scan/page.tsx` — standalone deep link encoded in the printed office QR. **This is the one
   students actually use**; the camera app opens it in a fresh tab where the Zustand store is
   empty, so it falls back to the `swap_token` cookie.
2. `app/(dashboard)/recipient/attendance/scan/page.tsx` — in-portal scanner.
3. `app/(dashboard)/recipient/attendance/page.tsx` — manual token paste.

A fix applied to only one of these looks correct in testing and is broken in production.

### 9.3 Soft deletes vs. unique constraints
`User` and `StudentProfile` both use `SoftDeletes`. A soft-deleted row still occupies unique
indexes. Two mitigations exist and must be preserved:
- `UserRepository::softDelete()` renames the email to `…_deleted_<timestamp>` and soft-deletes the
  profile.
- `student_profiles.student_id_number` uses a **partial unique index**
  (`WHERE deleted_at IS NULL`), not a unique constraint, because constraints cannot be partial.

Validation rules must use `Rule::unique(...)->whereNull('deleted_at')`. Forgetting this makes a
deleted student unable to ever re-register.

### 9.4 `QUEUE_CONNECTION=sync` means job failures become 500s
Dispatching a job does **not** decouple it. A mail outage used to 500 the registration endpoint
*after* the user row had committed, leaving an orphan that made the retry fail with "email already
taken". `AuthController::register()` now wraps creation in `DB::transaction()` and catches mail
errors. Apply the same pattern to any new side effect after a write.

### 9.5 Zod object-level `.refine()` does not run if any field fails
In a multi-step form, fields on later steps are still empty, so the object parse aborts and
`.refine()` never executes. The registration form therefore performs its cross-field check
(full name vs. name parts) **explicitly in `next()`** with `setError`, and keeps the schema-level
refine only as a submit-time backstop. Field-level `.refine()` on a single `z.string()` is fine.

### 9.6 Next.js route files cannot export extra symbols
`app/**/page.tsx` may only export the default component and the known Next.js exports. Adding
`export function helper()` to a page fails the typecheck with a cryptic `OmitWithTag` error. Keep
helpers unexported or move them to `lib/`.

### 9.7 `enumerateDevices()` is unreliable before permission
Camera labels (and sometimes the count) are hidden until `getUserMedia` succeeds. `useCameraStream`
re-runs the enumeration keyed on `ready` for this reason. The flip-camera button is intentionally
hidden when only one camera exists — **it will not appear on a typical laptop.**

### 9.8 Releasing a camera before acquiring the next one
Mobile Safari returns a frozen frame or refuses outright if two `MediaStream`s are open at once.
`useCameraStream` stops all tracks before every `getUserMedia` call. Use `{ ideal: facing }`, not
`{ exact: facing }`, or single-camera devices throw `OverconstrainedError`.

### 9.9 Pre-existing failing frontend tests
`npx vitest run` reports **5 failures** in `__tests__/components/LoginForm.test.tsx` (3) and
`__tests__/pages/dashboards.test.tsx` (2). These predate current work and are **unrelated to any
recent change** — verified by stashing. Do not treat them as a regression; fixing them is a
legitimate standalone task.

### 9.10 Frontend and backend are committed separately — and repeatedly weren't
Several past commits staged only `swap-backend/`, deploying a new API against an old UI and
producing confusing half-broken states (a form rejecting a field that wasn't rendered, a missing
camera button, a toggle with no effect). **Always `git add -A` from the repo root and check
`git status` before pushing.**

### 9.11 Duty-slip control numbers must stay bit-identical on both stacks
`App\Support\DutySlipControl` (djb2 mod 2³² → 6-char base36 of `sid|ay|sem|range`) and the
frontend `makeControlNo` are maintained in parallel by hand. A one-character drift makes every
printed slip fail admin verification. Change both, and keep the `DutySlipVerifyTest` +
`DutySlip.test.tsx` pair green.

### 9.12 Full-semester slips need the raised pagination caps
`AttendanceController` and `StudentController` allow `per_page` up to `500`, and the recipient /
supervisor duty-slip pages fetch `per_page=300`. Dropping either side back to the old default
renders a silently truncated (wrong-total) slip instead of an error.

### 9.13 Claim stubs with drawn signatures need GD
DomPDF embeds specimen PNG/WebP ink via GD. Without `ext-gd` (Dockerfile + `composer.json`)
every stub carrying a drawn signature fails; the download endpoint converts this to a readable
`503` (logged) and the recipient page surfaces the backend message from the blob — do not
"fix" the 503 by swallowing it.

### 9.14 Claim tokens are single-use
`confirmReceipt` nulls `claim_token`; `void` does the same. The public verify link 404s
(`{valid:false}`) afterwards by design — a "broken" verify link on a claimed stub is the
replay protection working.

---

## 10. Testing

```powershell
# Backend — must all pass (16 feature files including the four below)
cd swap-backend
php artisan test

# Frontend
cd swap-frontend
npx tsc --noEmit -p tsconfig.json    # must be clean
npx next build                        # must compile
npx vitest run                        # 5 known pre-existing failures (§9.9) + DutySlip/StatusBadge updates — re-baseline before treating red as regression
```

Backend tests run against a real Postgres database (`swap_db_test`) configured in `phpunit.xml`,
with `RefreshDatabase`. Shared fixtures live in `tests/Concerns/MakesSwapData.php`
(`makeUser`, `makeOffice`, `makeGeofencedOffice`, `makeAssignment`, `makeSupervisorWithoutSelfie`,
`qrForOffice`, `makeOpenLog`, `travelToValidClockIn`) plus `tests/Concerns/InspectsPdfImages.php`
for stub-PDF assertions (transparent-ink / smask / draw counts).

Feature test files: `AdminTest`, `AttendanceTest`, `AuthTest`, `ChatbotTest`, `DocumentTest`,
`DutySlipVerifyTest` (semester-scoped counts, rejected excluded, tampered checksum invalid),
`EmailBrandingTest` (asserts seal-green `#1F5B3A`/`#16452B`), `InterviewLifecycleTest`,
`NotificationTest`, `PromissoryNoteTest` (submit window, single-pending, governing-only review,
`+7d` deadline, `via_promissory` eligibility), `RbacTest`, `ResourceAccessTest`,
`SignatureTest` (specimen upload/serve policy, drawn-vs-typed stub), `StipendClaimTest`
(certify co-sign, step-up/unlock, single-use verify, receipt + notifications, `503` GD path,
bulk skip-duplicates), `SupervisorReportTest`, `VerificationTest`.

**Time-sensitive tests must build times in Manila and send ISO-8601 with an offset**, and zero the
microseconds (`setTime($h, 0, 0, 0)`) or comparisons against DB-truncated timestamps fail.

---

## 11. Known weaknesses / candidate improvements

Offered as starting points, not as instructions. Each is real and currently unaddressed.

1. **Ephemeral uploads in production — worse than documented.** Render's free tier loses the
   public disk on redeploy. Beyond documents/avatars/logos this now covers **signature
   specimens (clock-in gate breaks), promissory documents, and rendered claim stubs**.
   Move to S3/R2 via a configured filesystem disk.
2. **No async queue.** `QUEUE_CONNECTION=sync` puts email and notification latency on the request
   path and turns provider outages into 500s. `DEPLOYMENT.md §1` describes the worker setup.
3. **Frontend types are hand-mirrored** from `app/Resources/`. They drift silently
   (`signature_url`, `supervisor_signature_url`, `position_title`, promissory shapes,
   `recorded_hours` verify shape, blob error handling). Generating
   them from the backend (or at least a contract test) would remove a whole class of bug.
4. **Page components are very large.** `admin/offices/page.tsx` (~800 lines) plus the new
   `recipient/stipend`, `admin/stipend`, `supervisor/promissory`, `DutySlip.tsx` (~490 lines)
   and `SemesterServiceReport.tsx` (~260 lines) mix multiple modals/views inline. Extraction
   would improve reviewability.
5. **Duplicated rule definitions across the stack.** `InterviewWindow.php` and
   `interviewWindow.ts` are maintained in parallel by hand, as are the attendance constants —
   and now critically `DutySlipControl` ↔ `makeControlNo` (checksum parity) plus the
   `per_page 500` / `300` pair. A generated or served rules payload would prevent drift.
   (`SignatoryTitles` is the counter-example — it centralised one such mapping.)
6. **Frontend test baseline is stale** (§9.9, §10): the 5 old failures plus new/updated
   `DutySlip.test.tsx` and `StatusBadge` token classes need a fresh `vitest` baselining pass,
   and coverage is still thin generally.
7. **Weekend exclusion is validated, not disabled** in the interview date picker — `<input
   type="date">` supports `min` but cannot grey out weekdays. A custom calendar would close the
   gap between what the UI offers and what the server accepts.
8. **No CI.** Nothing runs `php artisan test` or `next build` on push; the split-commit problem in
   §9.10 — and the GD / `per_page` / swallowed-download-error class of issues — would have been
   caught by a pipeline.
9. **`swap-backend-broken/` is still in the repository** and pollutes searches.
10. **Accessibility has not been audited** — colour contrast (new green/gold/ink palette
    unvalidated), focus states, keyboard traps in the many custom modals, the canvas-only
    `SignaturePad` (upload fallback exists but is unverified with AT), and print-only duty slips.
11. **Control-number trust model.** The checksum proves a slip is well-formed, not that its hours
    are true — the admin must still compare `recorded_hours`. The verify page makes this manual
    step explicit, but nothing enforces it.

---

## 12. Working agreement for an agent picking this up

- **Read before editing.** Locate the controller, FormRequest, service, model, migration and React
  component for a task before changing any of them.
- **Never edit an existing migration.** Always add a new one.
- **Enforce every rule on the backend**, even when the UI also enforces it. The UI is a
  convenience; the API is the boundary.
- **Keep frontend and backend messages identical** for the same rule.
- **Match the surrounding code's style** — comment density, naming, `@theme` token colours, layering.
- **Run the full verification set** (§10) before declaring anything done, and report failures
  honestly, distinguishing new breakage from the known pre-existing failures.
- **Touch neither the admin accounts nor existing attendance data** when testing.

---

## 13. Security notes (pointers — see `docs/AUDIT_2026-09.md` for the full audit)

- **Open enumerable QR endpoints (Audit C1, still present):** `GET /qr-codes/{assignmentId}`
  and `/qr-codes/{assignmentId}/view` (`routes/api.php:57-58`) sit outside any auth group and the
  controller is dead (no frontend reference; real QR generation lives in `QrCodeService`).
  Recommended fix is deletion of the controller + routes + import.
- **Default production admin password in git (Audit C2, still present):**
  `database/seeders/ProductionAdminSeeder.php:18-22` defaults to `SwapAdmin2024` when
  `ADMIN_EMAIL` / `ADMIN_PASSWORD` are unset, and `start.sh` runs it on every deploy. Set the
  real secrets as `sync: false` vars in `render.yaml` / the Render dashboard.
- **Public `chatbot/query` is unthrottled** (`routes/api.php:52`) while every other public
  endpoint is throttled (Audit R4).
