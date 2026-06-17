# SWAP Portal — System Improvement Plan

A prioritized roadmap for improving the SWAP (Student Welfare Assistantship Program) portal.
Items are ordered by impact. Each has: **why it matters**, **approach**, **files**, **effort**, and **done-when**.

Effort key: 🟢 small (≤½ day) · 🟡 medium (1–2 days) · 🔴 large (3+ days)

---

## Phase 1 — Integrity & Security (do first) — ✅ DONE

> Status: all four items implemented, migrated, and verified (2026-06-17).
> - 1.1 `attendance:close-stale` command + hourly schedule (`routes/console.php`) — verified it caps time-out at `time_in + maxHours` and swept real stale logs.
> - 1.2 `throttle:` on login/register/forgot/reset (`routes/api.php`).
> - 1.3 `supervisors:backfill-office` command (`--dry-run` / `--force`) — surfaces the Sittie-Hadja-spans-4-offices conflict for manual fix. **Action left to you:** run `php artisan supervisors:backfill-office --force` to apply once the org structure is decided.
> - 1.4 GPS accuracy stored (`time_in/out_accuracy`) + `location_flagged` (>100 m) shown as a "Location unverified" badge on the supervisor log view.

### 1.1 Server-side attendance safety net 🟡 — TOP PRIORITY ✅
**Why:** Auto clock-out runs only in the recipient's browser tab. There is no scheduler
(`routes/console.php` is empty). If a recipient closes the tab or locks their phone, the open
log never closes — they look "clocked in" forever or get blocked the next day. Hours drive
stipends, so this is a correctness hole, not just UX.

**Approach:**
- Add a scheduled command `attendance:close-stale` that finds logs with `status='open'` older than a
  max session length (e.g. 12h, or past end-of-day) and finalizes them with
  `clocked_out_reason='auto'` (reuse `AttendanceService::finalizeClockOut`).
- Register it in the scheduler (Laravel 11: `routes/console.php` via `Schedule::command(...)->hourly()`).
- Document the cron entry: `* * * * * php artisan schedule:run`.

**Files:** `app/Console/Commands/CloseStaleAttendance.php` (new), `routes/console.php`,
`app/Services/AttendanceService.php` (expose a helper if needed).
**Done when:** an open log past the threshold is auto-closed by the scheduler with reason `auto`,
verified by a test.

### 1.2 Auth rate limiting 🟢
**Why:** `/auth/login` and `/auth/register` have no `throttle` middleware — open to brute force.
**Approach:** Add `->middleware('throttle:6,1')` (or a named limiter) to the public auth routes.
**Files:** `routes/api.php`.
**Done when:** repeated failed logins return HTTP 429.

### 1.3 Reconcile supervisor ↔ office data 🟡
**Why:** Data is inconsistent — a supervisor is tied to one office via `users.office_id` but
supervises several offices' students through assignments. The assign-flow auto-select can't work
correctly until this is decided.
**Approach:**
- Decide the real rule (1 supervisor → 1 office, confirmed). Create enough supervisor accounts so
  each office has one.
- One-time backfill: set each supervisor's `office_id` from their most common active assignment, OR
  assign manually via the Offices page. Flag/΄split supervisors spanning multiple offices.
**Files:** a one-off command or the existing Offices UI.
**Done when:** every active office has ≥1 supervisor and no supervisor spans multiple offices.

### 1.4 Anti-spoofing hardening for geofence 🟡
**Why:** GPS can be spoofed; attendance pays out.
**Approach (defense in depth, not perfection):**
- Record GPS `accuracy`; reject/flag clock-ins with poor accuracy (e.g. > 100 m).
- Flag logs whose time-in/out coordinates are implausibly far apart for the elapsed time.
- Lean on the existing supervisor verification step as the human check.
**Files:** `AttendanceService`, `GeofenceService`, `time_logs` (already stores lat/lng).
**Done when:** low-accuracy clock-ins are flagged for supervisor attention.

---

## Phase 2 — Robustness & Cleanup — ✅ DONE

> Status: all three items done and verified (2026-06-17). Full backend suite green (45 passed).
> - 2.1 Geofence monitor refactored to a ref-based interval — set up once per session, no more per-second GPS churn.
> - 2.2 Legacy `timeIn` removed (route, controller, service, frontend API + dead `useTimeIn` hook); obsolete tests rewritten to the geofence flow, plus new outside-geofence and GPS-accuracy-flag tests.
> - 2.3 Queue tables migrated (`jobs`/`job_batches`/`failed_jobs`); `DEPLOYMENT.md` documents async worker (`--queue=notifications,default`), scheduler cron, and SMTP. Dev stays on `sync`.

### 2.1 Fix GPS polling churn 🟢 ✅
**Why:** The geofence monitor effect depends on the `autoClockOut` mutation object (new identity
each render) and the 1-second timer re-renders, so the 15s interval resets constantly and GPS is
polled far more than intended — battery drain on phones.
**Approach:** Stabilize `checkLocation`/`autoClockOut` via a `ref`, or move the mutation call out of
the effect deps. Confirm GPS is read on the intended cadence only.
**Files:** `app/(dashboard)/recipient/attendance/page.tsx`.
**Done when:** GPS reads happen ~once per poll interval, not every second.

### 2.2 Remove dead `timeIn` path 🟢
**Why:** The legacy location-less `timeIn` now always throws (mandatory geofencing).
**Approach:** Remove the service method body usage, the route, and the unused frontend API method.
**Files:** `AttendanceService::timeIn`, `routes/api.php`, `lib/api/attendance.api.ts`.
**Done when:** no dead endpoint remains; nothing references it.

### 2.3 Async queue + email in production 🟡
**Why:** `QUEUE_CONNECTION=sync` runs jobs inline (emails block requests). Many notifications are
`database`-only.
**Approach:** Switch to `database`/`redis` queue in production with a worker
(`php artisan queue:work --queue=notifications,default`). Add `mail` channel to the notifications
that should email (approval, interview scheduled, hours verified). Configure SMTP.
**Files:** `.env`, notification classes, deployment docs.
**Done when:** emails send out-of-band; a worker processes the `notifications` queue.

---

## Phase 3 — Features that fit the workflow — ✅ DONE

> Status: all three items done and verified (2026-06-17). Full backend suite green (46 passed).
> - 3.1 `GET /supervisor/students/clocked-in` + a live "Currently Clocked In" panel on the supervisor dashboard (LiveTimerChip, 20s refresh, location-unverified flag).
> - 3.2 `POST /supervisor/verifications/bulk` + multi-select checkboxes and a "Verify selected (N)" bar on the student logs page (approve-only; reject stays per-log). Covered by a new test.
> - 3.3 `GET /admin/stipend/eligible` + an "Eligible for Release" section that prefills the release form for recipients who met required verified hours and haven't been paid for the period.

### 3.1 Supervisor "currently clocked in" live view 🟡 ✅
**Why:** Supervisors can't see who's on-site right now. Events already broadcast
(`AttendanceStarted` / `AttendanceCompleted`).
**Approach:** A supervisor panel listing students with an open log + live timer (reuse
`LiveTimerChip`), updated via the broadcast or a short poll.
**Files:** supervisor dashboard, a new endpoint listing open logs for the supervisor's students.
**Done when:** supervisor sees real-time on-site students.

### 3.2 Bulk verification 🟢
**Why:** Verifying logs one-by-one is slow.
**Approach:** Multi-select pending logs → approve in one action.
**Files:** `supervisor/students/[studentId]/logs`, verification endpoint (accept array).
**Done when:** a supervisor can verify multiple logs in one request.

### 3.3 Stipend automation 🟡
**Why:** Stipend release is fully manual.
**Approach:** Surface recipients who hit required verified hours; one-click release tied to that
threshold (keep an admin confirm step).
**Files:** stipend controller/service, admin stipend page.
**Done when:** eligible recipients are auto-surfaced for release.

---

## Phase 4 — Quality & Confidence — ✅ DONE

> Status: done and verified (2026-06-17). Backend 49 passed (142 assertions); frontend 36 passed; `tsc --noEmit` reports **0 errors**.
> - 4.1 Added tests: geofence clock-in (inside/outside/tampered/poor-accuracy), bulk verify, stale-log auto-close (caps duration), supervisor verification notification, admin new-application notification.
> - 4.2 Fixed the `axiosInterceptors.test.ts` type errors (typed accessors for axios's internal `handlers`) — whole frontend now type-clean.

### 4.1 Tests for the new critical paths 🟡 ✅
**Why:** Geofencing, auto clock-out, and the two notification bugs we fixed aren't covered.
**Approach:** Feature tests for: geofenced clock-in (inside/outside/no-config), auto clock-out,
`supervisor_time_out` + `application_submitted` notifications, stale-log closer (1.1).
**Files:** `tests/Feature/AttendanceTest.php`, `tests/Feature/NotificationTest.php`.
**Done when:** the flows are covered and green.

### 4.2 Clear frontend test type errors 🟢
**Why:** `__tests__` has pre-existing TS errors (the only ones in the codebase).
**Approach:** Fix the test fixtures/types so `tsc --noEmit` is clean.
**Files:** `__tests__/**`.
**Done when:** `tsc --noEmit` reports zero errors.

---

## Suggested sequencing
1. **1.1** server-side auto-close  ← biggest integrity win
2. **1.2** auth throttle  (quick, high value)
3. **2.1 / 2.2** GPS churn + dead code  (quick robustness)
4. **1.3** supervisor↔office backfill  (unblocks assign flow)
5. **4.1** tests for the above
6. Then Phase 2.3 / Phase 3 features as priorities allow.

---
_Generated as a living document — update statuses as you go._
