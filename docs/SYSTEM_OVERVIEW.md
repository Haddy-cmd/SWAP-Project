# SWAP Portal — System Context Document

> **Purpose of this file.** A complete, self-contained briefing on the SWAP Portal codebase,
> written to be pasted into an AI coding agent as context. It describes what the system is, how
> it is built, the rules it enforces, the conventions to follow, and the traps that have already
> caught people. Read the "Traps" section before changing anything — several of them are
> non-obvious and have each cost a debugging session.

> Last verified against the repository: **2026-10-05** (approval makes the student a recipient before the office assignment; a renewal marked not eligible is rejected by the admin; stipend release is final — no claim QR, Banking Office scan/PIN or releasing officer; reports & analytics per role; Task Description required at clock-out, report reminders, floating shift timer, office map confirmation; 2026-10-03: end-of-term report acceptance replaces the evaluation, promissory window tied to the next renewal, one renewal at a time; earlier: semester periods, term verdicts, renewal gate).

---

## 1. What the system is

The **SWAP Portal** (Student Work Assistantship Program) is the management system for MSU –
Marawi's student assistantship programme, run by the **Division / Office of Student Affairs
(DSA)**. It covers the full lifecycle:

1. A student **applies** and uploads requirements (COR, grades, letter of intent, 2×2 photo).
2. DSA staff **review** the application, **schedule an interview**, and **approve or reject**.
3. An approved applicant (approval itself tells them they passed the interview) becomes a
   **recipient** right away (since 2026-10-05, so DSA announcements reach them while they wait),
   then is **assigned** to a host office with a **supervisor** and a required number of service hours.
4. The recipient **clocks in and out** by scanning their office's QR code, with **GPS geofence
   verification** and an optional **proof-of-presence selfie**.
5. At clock-out they write the session's **Task Description** (required; it prints on the duty
   slip and the semester report); once per term they submit an **end-of-term narrative report**
   (required for payout), with email/bell/dashboard reminders when the hours are met or the term ends.
6. The supervisor **verifies** the logged hours.
7. Verified hours drive **stipend release** and progress reporting (duty slips, weekly/monthly/
   semester reports).
8. An admin **releases the stipend** for an eligible recipient (hours met, signature saved,
   end-of-term report submitted). A release is **final** (since 2026-10-05): the stub is created
   `released` with a control number and a server-rendered PDF signed by the supervisor (SWAP
   Mentor), the director and the beneficiary (their saved signature). There is no QR, Banking
   Office scan/PIN or releasing officer any more; a mistake is undone by voiding with a reason. See
   §6 (`docs/STIPEND_CLAIM_DESIGN.md` is the superseded original design).
9. A recipient short on hours after semester end may file a **promissory note** (with supporting
   document) until renewal for the next semester closes; a governing supervisor approves or
   rejects, which can restore stipend eligibility. There is no makeup deadline: the lacking hours
   are added to the next term if the student renews. A stub released through a note records and
   prints the shortfall.
10. The DSA keeps a **semester calendar** (Admin → Semesters). When a semester ends, a daily job
    records each placement as **Qualified** or **Deficient** (with the hours short). The supervisor
    **accepts each end-of-term report** and marks the student **eligible / not eligible for
    renewal**. An admin can only **approve a renewal** once the previous term is paid (or covered by
    an approved note) with its report in; a student who met the hours also needs the report
    accepted as eligible, and a "not eligible" mark blocks anyone. Only one semester can have
    renewal open at a time.
    Hours are strictly per term; earlier terms are kept as history.

Roles: `applicant`, `recipient`, `supervisor`, `admin`. There is no Banking Office role (the
public `/claim/{claimToken}` scan page and its PIN were removed on 2026-10-05).

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
| Realtime | None. The Reverb/Echo stack was removed (2026-09-28): it never delivered. Notifications are in-app (the bell refreshes every 60 s) + email |
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
│                capture), recipient/MissingSignatureBanner.tsx (stipend-release nudge), landing/HeroSlideshow.tsx,
│                landing/FaqAccordion.tsx
lib/
├── api/         one file per domain; all call apiClient from axios.ts (+ promissory.api.ts)
├── hooks/       useCameraStream, useApplications, useNotifications, …
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
  number is generated in the browser and printed for reference only (no verify endpoint). Full-semester
  views fetch `per_page=300` (backend max `500`); printing relies on `SlipPrintStyles` + the
  dashboard shell's `print:hidden` chrome.

---

**Feedback & confirmations** (`components/feedback/FeedbackProvider.tsx`, mounted once in
`app/layout.tsx`, rendered into `<body>`): `useFeedback()` gives `notify({ tone, title, detail })`
(a centered pop-out; success/info close after 3 s, errors stay until OK), `notifyError(err, title)`
(the backend's message via `lib/utils/apiError.ts` `errorText`) and `confirm({ title, body, details,
confirmLabel, tone }) → Promise<boolean>` (the shared "Are you sure?" dialog). Rule: every important
mutation reports through `notify` / `notifyError`; risky ones (money, status, access, irreversible)
`confirm` first. Field validation errors stay inline. `lib/utils/rejectConfirm.ts` builds the
application/renewal reject dialog (renewal warnings from `renewal_readiness`). Without the provider
(a component rendered alone in a test) `confirm` resolves true and `notify` is a no-op.

## 5. Domain model

Core tables (46 migrations total; the first 37 are the original `2024_01_01_*` series, plus
four `2026_09_20_*` and five `2026_09_21_*` / `2026_09_23_*` additions).

| Model | Notes |
|---|---|
| `User` | **SoftDeletes.** Holds `role`, `is_active`, `office_id` (supervisors), `avatar_path`, `require_clock_in_selfie`, plus `signature_image_path` (drawn e-signature specimen, served via `GET /users/{id}/signature`) and `position_title` (required on the releasing admin — prints on every claim stub), plus `employee_id` (supervisors/admins: digits, unique; entered when accepting the invitation or on Profile, shown and searchable in admin lists — the staff counterpart of the student ID) |
| `StudentProfile` | 1:1 with User. **SoftDeletes.** `student_id_number` (9 digits, unique among live rows), first/middle/last name, college, program, year_level |
| `Office` | Host office. Geofence (`latitude`, `longitude`, `radius_meters`, `geofence_enabled`), `qr_code`/`qr_secret`, `max_recipients`, `logo_path` (+ `logo_url` accessor) |
| `Application` | Status enum (Postgres type `application_status`): `submitted → under_review → interview_scheduled → approved \| rejected`. Has `type` (new/renewal) |
| `ApplicationDocument` | Uploaded requirements; served through a controller, not public URLs |
| `Interview` | 1:1 with Application. `scheduled_at`, `mode` (`in_person`\|`online`), `location`, `meeting_link`, `duration_minutes`, `status` |
| `Assignment` | Recipient ↔ Office ↔ Supervisor for an academic year/semester. `required_hours` (default 200), `status` (`active`\|`completed`\|`suspended`). `end_date` is an optional per-placement override; `effectiveEndDate()` returns `end_date`, else its `SemesterPeriod`'s end. Term verdict: `term_status` (null = in progress \| `qualified` \| `deficient`), `deficient_hours`, `term_status_at/by/reason` (`by` null = the `semester:close` job). `termBadge()` adds the promissory states for the UI |
| `SemesterPeriod` | The DSA calendar: one row per `academic_year` + `semester` (unique), `start_date`/`end_date` (no two periods overlap — checked in `SaveSemesterPeriodRequest`), `renewal_open` (at most one row — opening a second is refused; `SemesterPeriodService::renewalTarget()`), `renewal_closed_at` (stamped when renewal is closed; it also closes the term before's promissory window), `closed_at` (stamped by `semester:close`). `SemesterPeriodService::forTerm()` loads the whole calendar once per request |
| `TermEvaluation` | **Retired** (2026-10-03): the old 1–5 evaluations stay in `term_evaluations` (and in System Testing's snapshots) but nothing reads or writes them; the report acceptance replaced them |
| `TimeLog` | One attendance session. `status`: `open → pending_verification → verified \| rejected`. GPS + accuracy + `location_flagged` + selfie path |
| `NarrativeReport` | The per-session note: `content` = **Task Description** (required at the recipient's own clock-out, printed on the duty slips), `activities_done` and `challenges` optional |
| `TermReport` | End-of-term narrative report, one per assignment; required before the stipend is released. The supervisor accepts it with `renewal_eligible` (+ `reviewed_at/by`, `review_remarks`); editable until accepted or the stipend is released |
| `Verification` | Supervisor's accept/reject of logged hours |
| `StipendHistory` | Stub status (plain `varchar(20)`, **not** a Postgres enum): new rows are `released` (final), `void` with a reason undoes one. Legacy, read-only: `claimed` (paid at the Banking Office before 2026-10-05; never voidable) and `certified`/`pending` (ready to claim; migrated to `released` by `2026_10_05_000004`). `StipendHistory::LIVE_STATUSES` = `pending, certified, claimed, released`. Columns: `control_number` (`SWAP-STP-{studentID}-{YYYY}{SEM}`, e.g. `SWAP-STP-202512345-2627S2`, `-R2`… on re-issue, unique; built with `DutySlipControl::studentRef/termCode` like the duty slip), `certified_by/at` and `released_by/at` (both the releasing admin / time), `slip_path`, `voided_at`, `void_reason`; history only, no longer written: `claim_token`, `claimed_at`, `receipt_signed_at`, `releasing_officer_name`; plus the promissory record set at release: `via_promissory`, `promissory_note_id`, `required_hours`, `deficient_hours`, `lacking_hours` (`makeup_deadline` only on stubs released before 2026-10-03) |
| `StipendSignature` | One row per signatory on a stub: `supervisor` (SWAP Mentor) + `director` at release, `beneficiary` + `releasing_officer` at receipt. `method`: `drawn` (specimen image) vs `authenticated` (typed/action fallback) |
| `PromissoryNote` | Post-semester shortfall pledge: `assignment_id`, `user_id`, `verified_hours_snapshot`, `deficient_hours` (required − verified at submit), `lacking_hours` (the makeup the supervisor approved), document (`file_path/name/mime/file_size`), `reason`, `status` (`pending → approved \| rejected`), `reviewed_by/at`, `review_remarks`, `makeup_deadline` (old rows only — no longer set; lacking hours carry into the next term on renewal). One pending note per assignment enforced in the service |
| `StaffInvitation` | Token-based invite flow for supervisor/admin accounts (students self-register) |
| `Setting` | Key/value app settings, e.g. `applications_open`. The Banking Office PIN + officer name rows (`ubo_release_*`) are no longer read (2026-10-05). The old `semester_end_date` and `renewal_*` rows are no longer read (semester periods replaced them) |
| `AuditLog` | Polymorphic change trail |
| `Concern`, `FaqKnowledgeBase` | Chatbot / help desk |
| `Announcement` | Admin → Announcements history. Sending one creates a `database` notification for every active recipient (approved students still waiting for an office included) and emails them in Bcc batches of 50 (`AnnouncementService`); `emailed_count` shows how many the email reached |
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
- Auto clock-out has a **10-minute grace period** outside the premises, and can be switched off
  per office (`offices.auto_clock_out`; the endpoint then refuses with 422 "Automatic clock-out is
  turned off for this office.").
- The recipient's own QR clock-out (`AttendanceService::timeOut`) needs the session's Task
  Description: 422 `MSG_TASK_REQUIRED` "Write your task description before clocking out." (no
  Skip on any entry point). Automatic clock-outs (leaving the geofence, the 12-hour sweep, System
  Testing) don't, and the note can be added to such a log later from the Hours page. While clocked
  in, a draggable `FloatingShiftTimer` (recipient layout) shows the running time on every recipient
  page but Attendance; its position is kept in `localStorage`.
- **Selfie:** required unless *any* supervisor governing the assignment has
  `require_clock_in_selfie = false`. Enforced server-side in `timeInGeofence()`.
- One open log per user (DB-enforced, migration `…034_enforce_one_open_log_per_user`).
- **Signature specimen:** no longer a clock-in gate. The release refuses a recipient without a
  `signature_image_path` (it signs the stub and receipt), and one whose file is gone from storage
  (`App\Support\StoredFile::missing`, checked once per release: `MSG_SIGNATURE_LOST` "This
  recipient's saved signature can't be found in storage. Ask them to draw it again on their
  Profile."). `GET /profile` adds `signature_missing` for the signed-in user, so the Profile page
  asks for a new drawing instead of showing a broken image. Saving a new specimen runs
  `StipendClaimService::restoreLostInk`: this user's `drawn` rows on released (or legacy certified/claimed) stubs whose
  copy is gone take the new drawing, the stored PDF is dropped (re-rendered on download), audit
  `stipend_signature_restored`. The UI nudges via `MissingSignatureBanner` → Profile; a weekly
  `remind:missing-signatures` cron sends the mail + in-app ping. `SessionSync` re-reads
  `GET /profile` on load and when the tab is returned to (at most once a minute).

### Stipend release (`StipendClaimService` — a release is final, since 2026-10-05)
- Eligibility (`StipendService`): an `active` or `completed` (rolled over by a renewal; `suspended`
  is never paid) assignment with `verified_sum >= required_hours`, **or** a shortfall covered by an
  **approved** promissory note for the same user/year/semester; minus any live
  (`StipendHistory::LIVE_STATUSES`) row. Payable as soon as the hours are met — the end of the
  semester is not awaited. `void` frees the period. Default amount
  `₱5,000` (`DEFAULT_STIPEND_AMOUNT`, admin-overridable per release). Each eligible row also
  carries `has_signature` and `narrative_submitted`; release (single and bulk) refuses when either
  is false ("This recipient has not saved a digital signature yet." / "…has not submitted their
  end-of-term narrative report yet.").
- Release (`createReleasedStub`) creates the row `released` (`released_by/at` = `certified_by/at` =
  the admin, now) with `control_number SWAP-STP-{studentID}-{YYYY}{SEM}` (`-R2…` suffix when a voided
  stub is re-issued; `U{userId}` when no student ID); no claim token. It signs three rows:
  `supervisor` (assignment's supervisor, `drawn` if they saved a specimen else `authenticated`),
  `director` (per-release image wins, else the admin's specimen) and `beneficiary` (the recipient's
  specimen copied to `stipend-signatures/{id}/beneficiary.{ext}`, remarks "Released by the DSA.").
  Refuses with 422 when the admin has no `position_title`. Renders the PDF (non-fatal), audit-logs
  `released`, and after commit fires `StipendReleased` → `StipendReleasedNotification` ("SWAP
  Stipend Released", mail + bell; a mail failure never fails the release). Bulk release takes up to
  100 items and reports `{released[], skipped[{user_id, reason}]}`.
- Step-up: `password` XOR `unlock_token`. The token is opaque (sha256-cached), sliding 900 s,
  from `POST /admin/stipend/unlock` (throttled `6,1`).
- No Banking Office step: the QR, the public `/stipend/verify/{claimToken}` (+ `/release`) routes,
  the Banking Office PIN (`/admin/stipend/banking-office-pin`), the releasing officer and the
  `stipend_available` mail were removed on 2026-10-05. The PDF prints no QR and no "Releasing
  Officer" column; Part 1 is tagged "DSA COPY", Parts 2 and 3 carry the beneficiary's ink. The old
  student `confirm-receipt` route is gone too.
- Void (`POST /admin/stipend/{id}/void`, step-up, reason required): any released stub (legacy
  `certified`/`pending` too) → `void` with `voided_at`/`void_reason`, audit `voided`, the PDF
  re-renders printing VOID, and the recipient is eligible again. A legacy `claimed` stub → 422 "This
  stub was received at the Banking Office and can't be voided."; an already void one → 422 "This
  stub is already void."
- Migration `2026_10_05_000004_release_ready_to_claim_stubs` turned every `certified`/`pending`
  stub into `released` (`released_at = certified_at`, `released_by = certified_by`, token and
  archived PDF cleared), added a `beneficiary` row (a copy of the recipient's specimen, else typed)
  and an audit `released` row `{migrated: true}` (actor null). `down()` is a no-op.
- `claim_token`/`slip_path`/`file_path` are never in list JSON (`has_slip` flag instead); the slip
  download regenerates a missing PDF (ephemeral-disk caveat, §8/§11.1).
- A release through a promissory note (the eligible row's `via_promissory`) stores the note, the
  term's deficient and lacking hours on the `stipend_history` row, appends
  "via approved promissory #N" to the remarks, and prints "…has rendered {v} of the {r} duty hours
  required for {period}, with a deficiency of {d} hours covered by approved promissory note #{n}."
  (Parts 2–3: a "Deficiency: {d} hrs · promissory note #{n}" line). `makeup_deadline` columns stay
  on old rows but are no longer set or shown. A student who met the hours
  after an approved note is released normally (no marker, normal text).

### Promissory notes (`PromissoryService`)
- Submit (recipient, Asia/Manila) only after semester end (`Assignment::effectiveEndDate()`
  end-of-day: its own `end_date`, else its semester period's; neither → 422 "The semester period
  for {term} isn't set up yet…"), and until renewal for the next semester period (the first
  period starting after the term ends) closes — open → closed with `renewal_closed_at` set (else
  422 "Promissory notes for {term} closed when renewal for {next} closed on {date}.";
  `submissionState()` gives the `window_note`). Only when `0 < verified < required` (0 → 422 "A
  promissory note needs some verified service hours…"), one pending note per assignment. File: pdf/jpg/jpeg/png
  ≤ 5 MB on the `documents` disk. `lacking_hours` and `deficient_hours` are snapshotted
  server-side (`required − verified`).
- Review by a **governing supervisor** only (else 404). Approve requires `lacking_hours` (no makeup
  deadline — the hours carry into the next term on renewal); reject requires `review_remarks`. Single review —
  re-review → 422. Notifications: `promissory_submitted → supervisors`,
  `promissory_reviewed → student`.

### Semester periods, term verdicts and report acceptance
- **Calendar** (`SemesterPeriodService`, Admin → Semesters): CRUD with audit `semester_period_*`;
  year `^\d{4}-\d{4}$` with consecutive years, semester in 1st/2nd/Summer, end after start, unique
  year+semester, **no date overlap**; opening renewal is refused while another period has it open
  ("Close renewal for {label} first — only one semester can have renewal open at a time.") and for
  an ended period; closing it stamps `renewal_closed_at` (reopening clears it); delete and renaming (school year/semester) refused while assignments/applications use the term — they link by that text; a closed period's dates are locked.
  `current()` / `next()` judge the Manila calendar day. Renewal submit
  (`ApplicationService::submitRenewal`), the recipient renewal page and
  `GET /settings/application-status` all read `renewalTarget()`; `PUT /admin/settings` no longer
  accepts `renewal_*`.
- **Verdict** (`TermStatusService`, `semester:close` daily 00:10 PHT, `onOneServer`): for each
  period whose end date has passed, every `active`/`completed` placement of that term (whose own
  end has passed) becomes `qualified` (verified ≥ required) or `deficient` with `deficient_hours`.
  Only current placements whose term ended within `CloseSemesters::NOTIFY_WITHIN_DAYS` (14) are
  notified (`term_status` notification: portal + email), so setting up an old semester never
  mails a past cohort. Idempotent; `--dry-run` prints the counts. Terms with no period are left
  alone. `refresh()` re-qualifies a deficient term the moment its hours are met (log verified,
  verified bonus hours, lowered requirement) and keeps `deficient_hours` as history. A governing
  supervisor can `markDeficient` a current placement that is short (reason ≥ 10 chars); a mark made
  during the term is re-measured when the term ends. Renewal rollover records the old term's
  verdict (no notification).
- **Report reminders** (`TermReportReminderService`): while the report isn't in, the student gets
  one email + bell `term_report_due` when the verified hours meet the requirement
  (`TermStatusService::afterHoursChanged`, run after every verification, verified bonus hours and
  required-hours change) and one when the term closes (`semester:close`, current placements, terms
  ended within 14 days); stamped in `assignments.report_due_hours_at` / `report_due_ended_at`, audit
  `term_report_reminder`. The recipient dashboard shows the same warning (`TermReportDueBanner`).
- **Report acceptance** (`TermReportReviewService`): a governing supervisor accepts the submitted
  end-of-term report and marks the student eligible / not eligible for renewal, with optional
  remarks, while the placement is `active` (`PUT /supervisor/assignments/{id}/term-report/review`;
  the mark can be changed; audit `term_report_reviewed`; the student is notified). The first save
  of a report notifies the governing supervisors (`term_report_submitted`); an accepted report is
  locked for the student. `report_to_review` on the roster = submitted, not yet accepted. My
  Students opens as a list with one actions menu per student; "End-term report" opens the review
  popup. The 1–5 evaluation and its routes were removed (2026-10-03).
- **Renewal approval gate** (`RenewalReadinessService::assertReady`, 409, checked in order):
  the renewal carries its COR document and there is an earlier placement; previous term paid, else covered by an approved note (else "Release this recipient's stipend…" when
  owed / "…is not paid and has no approved promissory note."); its end-of-term report must be in
  (else "…has not submitted their end-of-term narrative report for {term} yet."); if the hours were
  met, the report accepted (else "The supervisor hasn't accepted the end-of-term report for {term}
  yet."); and, if accepted, not marked not eligible (else "The supervisor marked this recipient not
  eligible for renewal for {term}." — this one applies to short students too). `check()` feeds `renewal_readiness` on
  `ApplicationResource` (admins only), with `term_end_date` and `stipend_status` for the reject
  confirmation. Submitting early is allowed; rejecting is never blocked.
- **Approving an application** (`ApplicationService::promoteToRecipient`, in the same DB transaction as
  the decision): role `applicant` → `recipient` before any office, audit `promoted_to_recipient`, and
  the approval email links to the recipient dashboard. The Assignments queue still lists them (it goes
  by the approved application); `AssignmentService` still promotes any applicant it places. Until
  placed, the recipient pages say there is no office assignment yet, renewal is refused ("Renewal is
  only available to recipients with an existing assignment.") and `GET /recipient/renewals` looks only
  at renewal applications. Migration `2026_10_05_000005` promoted the students approved earlier whose
  latest application is approved (audit `promoted_to_recipient`, `migrated: true`, actor null).
- **A renewal marked "not eligible"** by the supervisor stays locked for approval; the admin rejects it.
  Both review pages say so under the blocker and start the remarks with "Your supervisor marked you
  not eligible for renewal for {term}." (editable), so Reject is ready.
- **Rejecting a renewal** (`ApplicationService::returnToApplicant`, in the same DB transaction as the
  decision; the decision emails go out after commit): the recipient's active placements become
  `completed` (still payable), the role goes back to `applicant`, audit `returned_to_applicant`. The
  admin confirms first and is warned about a term still running, a stipend not released or a
  missing report (a released stipend is final and unaffected). The student may apply again while `applications_open` is on — even
  for the same semester: the one-application-per-semester rule is the partial unique index
  `applications_one_per_term_unique` (migration `2026_10_05_000003`) and
  `ApplicationRepository::findForUserAndPeriod`, both ignoring rejected renewals. The "already
  approved, wait for placement" block looks only at the latest application (`findByUser` is newest
  first, then by id), so a former recipient's first approval doesn't block them.
  On rollover, a promissory-covered term's lacking hours (`RenewalReadinessService::carryHours`)
  are added to the new assignment: `required_hours = base + carry`, recorded as `carried_over_hours` /
  `carried_from_assignment_id` (`Assignment::baseRequiredHours()` strips it again on the next rollover).
  The recipient Renewal page says "approved" only when the new term's assignment exists
  (`GET /recipient/renewals` → `meta.placed`).
- **Per-term hours:** `GET /recipient/attendance/logs` and `/supervisor/students/{id}/logs` default
  to the current placement (`scope=all` for every term — the duty slips pass it);
  `GET /recipient/assignments/history` lists earlier terms with hours, verdict and stipend state;
  the admin dashboard's average completion counts only active placements' verified hours.

### System Testing (`TestingService`, `TestTools`)
- Always in the admin sidebar; switched on and off on its own page (setting `test_tools_enabled`, off
  by default, audit-logged; `TestTools::enabled()` is memoised per request/job). While off, picking
  accounts and the shortcuts answer 409 "Switch System Testing on first."; removing still works.
- The admin picks existing active recipients/applicants (`users.testing_added_at`, never
  mass-assignable). Shortcuts on a picked recipient's current term: add hours, complete hours (the
  missing hours, verified, ≤ 8 h/day on past days), reset hours (every log of the term removed; the
  restore brings them back), clock in now (open shift without the QR), auto
  clock-out (`AttendanceService::closeStaleLog`, the 12-hour safety net, now), end term now (own end
  date → yesterday), file promissory note (real `PromissoryService::submit` with a sample PDF), close
  term now, term report, accept report (eligible / not eligible, through `TermReportReviewService` as
  the supervisor), renewal (sample COR), reset term. Other people's
  steps run through the real services as the right person: verify pending hours (VerificationService,
  as the placement's supervisor), approve/reject the note (PromissoryService::review, as the supervisor),
  release stipend (StipendClaimService::releaseClaimStub, as the admin — final, signed by the
  supervisor, director and student; the old "pay out" action was removed 2026-10-05); reset stipend
  (the term's live stub and its signatures removed, so the student is eligible again under Admin →
  Stipend).
- Restore: picking copies the student's whole record (`App\Support\AccountSnapshot` → `testing_snapshots`):
  applications (+ documents, interviews), placements (+ time logs, narratives, verifications,
  promissory notes, term reports, old evaluations, weekly/monthly/semester reports) and stipend stubs
  (+ signatures), as raw rows. "Restore and remove", "Restore all" and switching testing off delete the
  student's current rows and re-insert the copy with its own IDs, whatever changed them (the buttons or
  the normal pages — e.g. a renewal approved under Applications and its rollover); files of rows the
  test created and the bell notifications from the test go too. The user row, profile, concerns and
  audit logs aren't touched; emails already sent can't be unsent.
- Accounts tested before restore points existed have no copy: "Tested before restore points" lists
  them with a preview and cleans up from the audit log (rows created between `testing_account_added`
  and `testing_account_removed`, the replaced placement made active again, the term result put back
  from the first `term_closed`/`term_requalified`/`term_marked_deficient` in the window).
- Bypasses only for picked accounts while on (`TestTools::bypasses`): clock-in window, geofence and
  selfie in `AttendanceService`; interview window/past checks in `StoreInterviewRequest`.
- Picked accounts stay normal accounts: they sign in, get email at their real address (so
  notifications can be tested), count in analytics and reports, and are never deleted.

### Duty-slip control numbers
- Printed on every slip as `SWAP-{SID}-{YY}{YY}{SEM}-{RANGE}-{checksum}` (generated in
  `DutySlip.tsx`). Paper slips are not official records, so the admin verify page/endpoint was
  removed; `App\Support\DutySlipControl` now only holds the shared `studentRef()` / `termCode()`
  that the claim stub's control number also uses.

### Reports & analytics per role
All read from data already recorded, per term, leaving out soft-deleted users.
- **Admin → Analytics → Program insights** (`ProgramInsightsService`, `GET /admin/analytics/insights`):
  term results (verdicts, deficient hours, promissory notes, hours carried over), renewals (counts,
  why waiting ones are blocked — `RenewalReadinessService::check()` per waiting renewal — and the
  renewal rate against the previous semester period's recipients), stipend (released count and
  amount, via promissory, voided, and this term's payable recipients split into ready to release —
  signature and report in — and missing a requirement), attendance integrity per office (flagged, automatic clock-outs, rejected, logs with no
  task description), supervisor workload (pending per assigned supervisor, oldest, average verify
  time per verifier), the new-application funnel by college, and office use. **Reports → Term
  Results** (`ReportService` type `term-results`): one row per placement with verdict, promissory,
  end-of-term report, stipend and renewal.
- **Supervisor → Reports:** the roster adds Term Status, End-of-Term Report, Promissory Note, Last
  Clock-in, Days on Duty and Flagged Logs (+ a "Reports to Accept" tile); **Insights**
  (`ReportService::supervisorInsights`, `GET /supervisor/reports/insights`): the verification queue,
  their own 30-day verify time, average session, students with no clock-in for 7+ days, automatic
  clock-outs per student.
- **Recipient** (`RecipientProgressService`, `GET /recipient/progress`): pace (`paceStatus`), a forecast
  (hours/week needed to the term end, recent 28-day average, projected finish), an hours breakdown
  with rejected-log reasons, and a stipend/renewal checklist (hours or promissory, signature incl. a
  lost file, end-of-term report and its mark, stub). Past terms also show the stub amount and claim date.
- **Applicant:** `ApplicationResource.status_history` (submitted + every status change in the audit
  log; the applicant's own and single applications only) dates the timeline on the dashboard and the
  application page.

---

## 7. API surface

Base path `/api`. Auth via `Authorization: Bearer <sanctum token>`.

| Prefix | Middleware | Routes | Purpose |
|---|---|---|---|
| `auth/*` | public | 6 | register, login, logout, forgot/reset password, resend verification |
| `invitations/*` | public | 2 | show + accept a staff invitation |
| `email/verify/{id}/{hash}` | signed | 1 | email verification |
| `documents/*/file`, `users/*/avatar`, `users/*/signature`, `attendance/*/photo` | in-controller auth | 4 | file serving that works in new tabs / `<img src>` (signature: self, admin, governing supervisor) |
| `qr-codes/*` | **none (public)** | 2 | Legacy dead endpoints — see §13 security note |
| `chatbot/query` | public, **unthrottled** | 1 | gap — see AUDIT R4 |
| `applicant/*` | `role:applicant` | 5 | submit application, upload documents |
| `recipient/*` | `role:recipient` | 20 | attendance (logs default to the current term), hours, past terms (`assignments/history`, with `stipend_released_at`), session notes, end-of-term report, stipend history + stub download, promissory index/store/file, renewal, duty slip |
| `supervisor/*` | `role:supervisor` | 23 | students (+ `mark-deficient`), end-of-term report acceptance (`assignments/{id}/term-report/review`), verifications, roster reports, office QR, **settings**, promissory index/review/file |
| `admin/*` | `role:admin` | 68 | applications, interviews, offices, assignments (`?term=` verdict filter), **semester periods**, users, stipend (index/eligible/**unlock/release/release-bulk/void**), promissory index/file, duty-slip verify, **concerns inbox**, **announcements**, landing photos, analytics, audit logs |
| `profile/*`, `notifications/*`, `concerns`, `chatbot`, `settings` | authenticated | ~15 | shared + signature specimen upload/delete (`POST/DELETE /profile/signature`); `GET/POST /concerns` + `POST /concerns/{id}/messages` back the SWAP Assistant's Ask the DSA tab as a running thread (the old `/help` route just opens it); each concern's messages live in `concern_messages` |

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
- Uploads go to `config('filesystems.documents_disk')`: the local **public disk** by default, and
  Cloudflare **R2** in production (`DOCUMENTS_DISK=r2` + `R2_*`; the `r2` disk turns off the AWS
  SDK's default checksums, which R2 can reject). **Render's free filesystem is ephemeral** — anything
  on the local disk (documents, avatars, office logos, signature specimens, promissory documents,
  claim-stub PDFs) is gone after a restart or redeploy while the database still points to it.
  **Admin → System Testing → File storage** (`GET /admin/storage-check`, `StorageCheckService`)
  shows the disk in use, writes/reads/deletes a probe file, compares `APP_URL` (which builds the
  signature/photo links) with the request host, and lists accounts whose signature or photo is
  missing (up to 300 files checked).

### Mail (Brevo)

The Brevo HTTP-API transport is registered in `AppServiceProvider::boot()` and selected with
`MAIL_MAILER=brevo`. It reads **`BREVO_API_KEY`** (via `config('services.brevo.key')`). Brevo also
enforces an **IP allowlist** for API keys, which blocks Render's rotating egress IPs; either
allowlist the address or disable the allowlist under Brevo → Security → Authorised IPs.
Mail chrome is seal-green (`#1F5B3A` buttons/links, `#16452B` header band — see
`EmailBrandingTest`). One stipend mail: `StipendReleased` ("SWAP Stipend Released", amount,
period, control no., stub on the Stipend page) at release. `StipendAvailable` was removed 2026-10-05.

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

### 9.11 Control-number parts are shared
The claim stub's control number (`StipendClaimService::makeControlNumber`) and the duty slip use the
same student-ID and term encoding (`DutySlipControl::studentRef/termCode`, `makeControlNo` in the
frontend). Keep them reading the same way; `DutySlip.test.tsx` covers the slip side.

### 9.12 Full-semester slips need the raised pagination caps
`AttendanceController` and `StudentController` allow `per_page` up to `500`, and the recipient /
supervisor duty-slip pages fetch `per_page=300`. Dropping either side back to the old default
renders a silently truncated (wrong-total) slip instead of an error.

### 9.13 Claim stubs with drawn signatures need GD
DomPDF embeds specimen PNG/WebP ink via GD. Without `ext-gd` (Dockerfile + `composer.json`)
every stub carrying a drawn signature fails; the download endpoint converts this to a readable
`503` (logged) and the recipient page surfaces the backend message from the blob — do not
"fix" the 503 by swallowing it.

### 9.14 A release is final — no claim step
Since 2026-10-05 nothing flips a stub after release: no QR, no Banking Office scan/PIN, no
`claimed` transition. Old `/claim/{token}` links and `/stipend/verify/*` 404 by design. Don't
reintroduce `certified` for new stubs; legacy `certified`/`claimed` rows are read-only (count them
via `StipendHistory::LIVE_STATUSES`).

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
`EmailBrandingTest` (asserts seal-green `#1F5B3A`/`#16452B`), `InterviewLifecycleTest`,
`NotificationTest`, `PromissoryNoteTest` (submit window from the semester period, zero-hours
refusal, single-pending, governing-only review, window open until the next renewal closes, `via_promissory` eligibility,
deficiency stored and printed on the stub), `RenewalTest` (the approval gate in order, rollover
dates, hours reset), `SemesterPeriodTest`, `TermStatusTest` (`semester:close`, re-qualify,
manual mark, badges), `TermReportReviewTest`, `TermHistoryTest` (log scope, past terms, average
completion), `RbacTest`, `ResourceAccessTest`,
`SignatureTest` (specimen upload/serve policy, drawn-vs-typed stub, lost file: profile flag,
release refusal, ink restored on redraw), `StorageCheckTest`, `StipendClaimTest`
(final release signed by supervisor/director/beneficiary, no QR or releasing officer on the PDF,
Banking Office routes gone, step-up/unlock, void with a reason (legacy received stubs refused),
`503` GD path, bulk skip-duplicates), `ReleaseReadyToClaimStubsMigrationTest`,
`ApprovalMakesRecipientTest` (approval → recipient, announcements before placement, recipient pages
without an office, placement, the promotion migration),
`SupervisorReportTest`, `VerificationTest`.

**Time-sensitive tests must build times in Manila and send ISO-8601 with an offset**, and zero the
microseconds (`setTime($h, 0, 0, 0)`) or comparisons against DB-truncated timestamps fail.

---

## 11. Known weaknesses / candidate improvements

Offered as starting points, not as instructions. Each is real and currently unaddressed.

1. **Uploads saved before R2 are gone.** Production now uses R2 (`DOCUMENTS_DISK=r2`), but files
   saved while uploads still went to Render's wiped disk can't be recovered. Lost signatures are
   reported (Profile, release refusal, File storage check) and a new drawing restores stub ink;
   lost documents, photos and promissory files still have to be uploaded again by hand.
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
