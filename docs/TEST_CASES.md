# SWAP Portal — System Test Cases

**System:** SWAP (Student Welfare Assistantship Program) Portal — MSU Main Campus
**Architecture:** Laravel (REST API) backend + Next.js frontend
**Document purpose:** Complete catalogue of test cases for capstone documentation and system testing (functional, negative, boundary, security, and non-functional).

---

## 1. How to use this document

Each test case has a stable **ID** (e.g. `TC-AUTH-001`). Columns:

- **Test Scenario** — what is being checked.
- **Preconditions** — state the system must be in before the steps.
- **Test Steps** — the actions the tester performs.
- **Test Data** — concrete inputs (sample values you can reuse).
- **Expected Result** — the correct system behaviour.
- **Actual Result** — *(fill in during execution)*.
- **Status** — *(fill in: ✅ Pass / ❌ Fail / ⛔ Blocked)*.

For your defense, keep the last two columns blank in the master copy and fill a dated execution copy per test round. A summary/traceability matrix is in [Section 20](#20-traceability--coverage-summary).

### Priority key
`P1` critical (money, integrity, security, auth) · `P2` core workflow · `P3` supporting/UX.

---

## 2. Test environment & prerequisites

| Item | Value / Notes |
|---|---|
| Backend | Laravel API (PHP), PostgreSQL, Sanctum tokens |
| Frontend | Next.js, runs against the API base URL |
| Timezone for attendance rules | Asia/Manila (PHT) |
| Roles under test | `applicant`, `recipient`, `supervisor`, `admin` |
| Seed data needed | ≥1 admin, ≥1 supervisor (with `office_id`), ≥1 geofenced office, ≥1 assignment, sample applicants |
| Institutional email domain | `@s.msumain.edu.ph` (registration is restricted to this) |
| Default required service hours | 200 (assignment default) |
| Default monthly stipend | ₱1,500 (suggested, admin can override) |
| Clock-in window | Monday–Saturday, 06:00–17:30 PHT |
| Max attendance session | 12 hours (stale logs auto-closed & capped) |
| GPS accuracy threshold | > 100 m is flagged as untrustworthy |
| Auto clock-out grace | 10 minutes outside the premises |

### Test accounts (suggested)
| Role | Purpose |
|---|---|
| `admin@…` | DSA staff — full admin module |
| `supervisor.a@…` (office A) | Verifies logs for office A students |
| `supervisor.b@…` (office B) | Cross-office authorization tests |
| `recipient1@…` | Active assignment, attendance flows |
| `applicant1@…` | Application pipeline |

---

## 3. Module: Registration (`TC-REG`)

| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-REG-001 | P1 | Successful registration with institutional email | Application period **open** | POST `/auth/register` with all valid fields | email `juan.delacruz@s.msumain.edu.ph`, student ID `200912345`, valid password, program `BS Computer Science`, year 3 | HTTP 201, `verification_required: true`, account created **inactive/unverified**, verification email sent |  |  |
| TC-REG-002 | P1 | Reject non-institutional email | Period open | Register with a gmail/other domain | email `juan@gmail.com` | HTTP 422, message "Use your institutional email to register" |  |  |
| TC-REG-003 | P1 | Student ID must be exactly 9 digits | Period open | Register with 8-digit / 10-digit / non-numeric ID | `20091234` / `2009123456` / `20091234A` | HTTP 422, "Student ID must be exactly 9 digits." |  |  |
| TC-REG-004 | P2 | Duplicate email rejected | An account with that email exists | Register with the same email | existing email | HTTP 422, email unique validation error |  |  |
| TC-REG-005 | P2 | Duplicate student ID rejected | A profile with that student ID exists | Register with the same student ID | existing student ID | HTTP 422, student_id_number unique error |  |  |
| TC-REG-006 | P2 | Password complexity enforced | Period open | Register with weak passwords | `pass`, `password`, `12345678`, `alllower1` | HTTP 422 (min 8, mixed case, numbers required) |  |  |
| TC-REG-007 | P2 | Password confirmation mismatch | Period open | Register with mismatched confirmation | password `Abcd1234`, confirm `Abcd9999` | HTTP 422, confirmed validation error |  |  |
| TC-REG-008 | P2 | 5th year only for 5-year programs | Period open | Register year_level 5 with a 4-year program | year 5, program `BS Computer Science` | HTTP 422, "A 5th year applies only to Engineering and BS Accountancy programs." |  |  |
| TC-REG-009 | P3 | 5th year allowed for Engineering / BS Accountancy | Period open | Register year 5 with 5-year program | year 5, program `BS Civil Engineering` | HTTP 201 accepted |  |  |
| TC-REG-010 | P1 | Registration blocked when applications closed | Application period **closed** | POST `/auth/register` | any valid payload | HTTP 403 with the configured "applications closed" message |  |  |
| TC-REG-011 | P3 | Missing required fields | Period open | Omit name / last_name / college / program | partial payload | HTTP 422 listing each missing field |  |  |
| TC-REG-012 | P3 | Year level out of range | Period open | Register year 0 or 6 | year 0 / 6 | HTTP 422 (min 1, max 5) |  |  |
| TC-REG-013 | P1 | Rate limiting on register | — | Send >5 register requests within 1 minute | 6 rapid requests | 6th returns HTTP 429 Too Many Requests |  |  |

---

## 4. Module: Email Verification (`TC-EV`)

| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-EV-001 | P1 | Verify via valid signed link | Unverified account exists | Open GET `/email/verify/{id}/{hash}` from the email | valid signed URL | Email marked verified, account **activated**, redirect/confirmation |  |  |
| TC-EV-002 | P1 | Tampered/invalid signature rejected | Unverified account | Alter the signature/hash in the URL | modified hash | HTTP 403 (invalid signature) |  |  |
| TC-EV-003 | P2 | Already-verified link is idempotent | Account already verified | Re-open the same link | same URL | Handled gracefully (no error/no double-activation) |  |  |
| TC-EV-004 | P2 | Resend verification email | Unverified account | POST `/auth/resend-verification` | account email | New verification email sent |  |  |
| TC-EV-005 | P2 | Resend rate limited | — | Send >3 resend requests in 1 minute | 4 rapid requests | 4th returns HTTP 429 |  |  |

---

## 5. Module: Login / Logout (`TC-AUTH`)

| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-AUTH-001 | P1 | Successful login (verified + active) | Verified, active account | POST `/auth/login` | correct email + password | HTTP 200, returns user + Sanctum token |  |  |
| TC-AUTH-002 | P1 | Wrong password rejected | Account exists | Login with wrong password | valid email, wrong password | HTTP 422, "The provided credentials are incorrect." |  |  |
| TC-AUTH-003 | P1 | Unknown email rejected | — | Login with non-existent email | random email | HTTP 422, credentials error (no user enumeration) |  |  |
| TC-AUTH-004 | P1 | Unverified email blocks login | Account not yet verified | Login | valid but unverified account | HTTP 422, prompt to verify email first (not "deactivated") |  |  |
| TC-AUTH-005 | P1 | Deactivated account blocked | `is_active = false`, verified | Login | deactivated account | HTTP 422, "Your account has been deactivated. Please contact the DSA Office." |  |  |
| TC-AUTH-006 | P1 | Login rate limiting | — | >6 login attempts in 1 minute | 7 rapid attempts | 7th returns HTTP 429 |  |  |
| TC-AUTH-007 | P2 | Logout invalidates token | Logged in | POST `/auth/logout` then reuse token | valid token | Token deleted; subsequent authed request → 401 |  |  |
| TC-AUTH-008 | P2 | Session persists via valid token | Logged in | Call `/profile` with token | valid token | HTTP 200 profile returned |  |  |

---

## 6. Module: Password Reset (`TC-PWD`)

| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-PWD-001 | P2 | Request reset for existing email | Account exists | POST `/auth/forgot-password` | valid email | Reset link emailed; generic success message |  |  |
| TC-PWD-002 | P2 | Request reset for unknown email | — | POST `/auth/forgot-password` | non-existent email | Generic success message (no user enumeration) |  |  |
| TC-PWD-003 | P1 | Reset with valid token | Reset token issued | POST `/auth/reset-password` | valid token + new compliant password | Password updated; can log in with new password |  |  |
| TC-PWD-004 | P1 | Reset with invalid/expired token | — | POST `/auth/reset-password` | bad/expired token | HTTP 422, invalid token error |  |  |
| TC-PWD-005 | P2 | Reset enforces password complexity | Valid token | Reset with weak password | `weak` | HTTP 422 complexity error |  |  |
| TC-PWD-006 | P1 | Forgot-password rate limiting | — | >3 requests in 1 minute | 4 rapid requests | 4th returns HTTP 429 |  |  |

---

## 7. Module: Profile & Account (`TC-PROF`)

| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-PROF-001 | P2 | View own profile | Logged in | GET `/profile` | — | HTTP 200 with user + profile data |  |  |
| TC-PROF-002 | P2 | Update profile fields | Logged in | PUT `/profile` | new contact number, program | HTTP 200, fields updated |  |  |
| TC-PROF-003 | P3 | Upload valid profile photo | Logged in | POST `/profile/photo` | JPG/PNG within size limit | HTTP 200, avatar path stored, served via `/users/{id}/avatar` |  |  |
| TC-PROF-004 | P3 | Reject invalid photo type/size | Logged in | POST `/profile/photo` | .exe / oversized file | HTTP 422 validation error |  |  |
| TC-PROF-005 | P3 | Delete profile photo | Photo exists | DELETE `/profile/photo` | — | HTTP 200, avatar removed |  |  |
| TC-PROF-006 | P1 | Change password with correct current | Logged in | PUT `/profile/password` | correct current + valid new | HTTP 200, password changed |  |  |
| TC-PROF-007 | P1 | Change password with wrong current | Logged in | PUT `/profile/password` | wrong current password | HTTP 422 error, password unchanged |  |  |

---

## 8. Module: Staff Invitations (`TC-INV`)

| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-INV-001 | P2 | Admin creates staff invitation | Logged in as admin | POST `/admin/invitations` | supervisor email + role | Invitation created, email with token sent |  |  |
| TC-INV-002 | P2 | Invitee opens valid token | Invitation exists | GET `/invitations/{token}` | valid token | HTTP 200, invitation details shown |  |  |
| TC-INV-003 | P2 | Invitee accepts and sets password | Valid token | POST `/invitations/{token}/accept` | name + compliant password | Account created with invited role, can log in |  |  |
| TC-INV-004 | P2 | Invalid/expired/used token | Token used or expired | GET/POST with that token | consumed token | HTTP 4xx, invitation not valid |  |  |
| TC-INV-005 | P3 | Non-admin cannot create invitation | Logged in as non-admin | POST `/admin/invitations` | any | HTTP 403 |  |  |
| TC-INV-006 | P3 | Invitation endpoints rate limited | — | Flood `/invitations/{token}` (>10/min) or accept (>6/min) | rapid requests | HTTP 429 after limit |  |  |

---

## 9. Module: Applicant — Applications (`TC-APP`)

| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-APP-001 | P1 | Submit a valid application | Logged in as applicant, no in-progress app | POST `/applicant/applications` | `academic_year` `2024-2025`, `semester` `1st Semester` | HTTP 201, status `submitted`, audit log created |  |  |
| TC-APP-002 | P2 | Reject bad academic year format | Applicant | Submit | `2024/2025` or `24-25` | HTTP 422 (regex `YYYY-YYYY`) |  |  |
| TC-APP-003 | P2 | Reject invalid semester | Applicant | Submit | `3rd Semester` | HTTP 422 (must be 1st/2nd/Summer) |  |  |
| TC-APP-004 | P1 | Block second application while one in progress | Has a `submitted`/`under_review`/`interview_scheduled` app | Submit another | different period | HTTP 409, "already have an application in progress" |  |  |
| TC-APP-005 | P1 | Block new application after approval | Has an `approved` application | Submit another | any | HTTP 409, "already been approved…wait for the office assignment" |  |  |
| TC-APP-006 | P2 | Block duplicate application for same period | App exists for that AY+semester | Submit same period | same AY + semester | HTTP 409, duplicate-period message |  |  |
| TC-APP-007 | P2 | Upload document to application | Application exists | POST `/applicant/applications/{id}/documents` | valid COR PDF | Document stored & linked, served via `/documents/{id}/file` |  |  |
| TC-APP-008 | P3 | Reject invalid document file | Application exists | Upload | .exe / oversized | HTTP 422 |  |  |
| TC-APP-009 | P2 | View own application status | Application exists | GET `/applicant/applications/{id}/status` | own id | HTTP 200 with status + interview info |  |  |
| TC-APP-010 | P2 | Delete a freshly-submitted application | Own submitted app | DELETE `/applicant/applications/{id}` | own id | HTTP 200, application + documents removed, audit logged |  |  |
| TC-APP-011 | P1 | Cannot view/delete another user's application | Applicant B owns app | GET/DELETE app id of another user | other user's id | HTTP 403/404 (ownership enforced) |  |  |
| TC-APP-012 | P2 | List only own applications | Multiple applicants | GET `/applicant/applications` | — | Returns only the caller's applications |  |  |

---

## 10. Module: Recipient — Renewal (`TC-REN`)

| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-REN-001 | P1 | Successful renewal | Renewal **open** + year/semester configured, recipient has a prior assignment | POST `/recipient/renewals` with updated COR | valid COR file | HTTP 201, `type=renewal`, status `submitted`, COR attached |  |  |
| TC-REN-002 | P2 | Renewal blocked when window closed | Renewal **closed** | POST renewal | any | HTTP 422, "renewal period is not open yet" |  |  |
| TC-REN-003 | P2 | Renewal not configured | `renewal_open` true but year/semester unset | POST renewal | any | HTTP 422, "not fully configured" |  |  |
| TC-REN-004 | P2 | Renewal requires prior assignment | User with no previous assignment | POST renewal | any | HTTP 422, "only available to recipients with an existing assignment" |  |  |
| TC-REN-005 | P2 | Duplicate renewal for the term | Already submitted for that term | POST renewal again | same term | HTTP 409, duplicate-submission message |  |  |
| TC-REN-006 | P2 | Broken COR upload rolls back | Renewal open/configured | Simulate storage failure on upload | corrupt/failing upload | HTTP 422, no document-less renewal left in queue |  |  |
| TC-REN-007 | P1 | Approving renewal rolls over assignment | Renewal app pending, admin | Admin approves renewal | approve | Old assignment `completed`, new assignment created (same office/supervisor), hours reset |  |  |

---

## 11. Module: Admin — Application Review & Interviews (`TC-ADMR`)

| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-ADMR-001 | P2 | List & filter applications | Admin, apps exist | GET `/admin/applications?status=submitted` | status filter | HTTP 200, filtered/paginated list |  |  |
| TC-ADMR-002 | P2 | Mark application under review | Submitted app | PUT `/admin/applications/{id}/review` | — | Status → `under_review`, applicant notified |  |  |
| TC-ADMR-003 | P2 | Schedule an interview (future) | App under review/submitted | POST `/admin/applications/{id}/interview` | `scheduled_at` future, `mode=online` | Status → `interview_scheduled`, applicant notified, interview created |  |  |
| TC-ADMR-004 | P2 | Reject interview in the past | App | Schedule interview | `scheduled_at` yesterday | HTTP 422 (`after:now`) |  |  |
| TC-ADMR-005 | P3 | In-person interview defaults venue | App | Schedule in-person without location | `mode=in_person`, no location | Location defaults to the DSA office |  |  |
| TC-ADMR-006 | P2 | Reschedule an interview | Interview scheduled | PUT `/admin/applications/{id}/interview` | new future time | Interview moved, old time kept in audit trail, applicant re-notified, no-show flag cleared |  |  |
| TC-ADMR-007 | P3 | Reschedule when no interview exists | No interview | PUT interview | any | HTTP 409, "no interview to reschedule" |  |  |
| TC-ADMR-008 | P2 | Mark interview no-show | Interview `scheduled` | POST `/admin/applications/{id}/interview/no-show` | — | Interview status → `no_show`, audit logged |  |  |
| TC-ADMR-009 | P3 | No-show only from scheduled state | Interview already `no_show`/other | POST no-show | — | HTTP 409, only a scheduled interview can be no-show |  |  |
| TC-ADMR-010 | P1 | Cannot approve fresh app before interview | Fresh app not interview_scheduled | PUT `/admin/applications/{id}/decide` | `decision=approved` | HTTP 409, "An interview must be scheduled before…approved" |  |  |
| TC-ADMR-011 | P1 | Approve after interview scheduled | `interview_scheduled` | Decide approved | approve + remarks | Status → `approved`, ApplicationApproved event, applicant notified |  |  |
| TC-ADMR-012 | P2 | Reject an application anytime | Any decidable app | Decide rejected | `decision=rejected`, remarks | Status → `rejected`, applicant notified |  |  |
| TC-ADMR-013 | P2 | Invalid decision value rejected | App | Decide | `decision=maybe` | HTTP 422 (`in:approved,rejected`) |  |  |
| TC-ADMR-014 | P1 | Renewal approval skips interview requirement | Renewal app (no interview) | Decide approved | approve | HTTP 200 approved (interview not required) |  |  |
| TC-ADMR-015 | P3 | Non-admin blocked from review endpoints | Non-admin | Call any `/admin/applications/*` | — | HTTP 403 |  |  |

---

## 12. Module: Admin — Assignments & QR (`TC-ASSIGN`)

| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-ASSIGN-001 | P1 | Create assignment promotes applicant → recipient | Approved applicant, office, supervisor | POST `/admin/assignments` | user, office, supervisor, `required_hours=200`, start_date | HTTP 201, user role becomes `recipient`, assignment QR generated, recipient notified of placement |  |  |
| TC-ASSIGN-002 | P2 | Required hours boundaries | Admin | Create with out-of-range hours | `0`, `501` | HTTP 422 (min 1, max 500) |  |  |
| TC-ASSIGN-003 | P2 | end_date must be after start_date | Admin | Create with bad dates | end before start | HTTP 422 (`after:start_date`) |  |  |
| TC-ASSIGN-004 | P2 | Non-existent user/office/supervisor | Admin | Create referencing missing ids | invalid ids | HTTP 422 (`exists`) |  |  |
| TC-ASSIGN-005 | P2 | Update assignment office notifies recipient | Assignment exists | PUT `/admin/assignments/{id}` | new office_id | Assignment updated, recipient notified with `changed=true` |  |  |
| TC-ASSIGN-006 | P2 | Update supervisor notifies recipient | Assignment exists | PUT assignment | new supervisor_id | Updated + change notification sent |  |  |
| TC-ASSIGN-007 | P3 | No-op update sends no notification | Assignment exists | PUT with same office/supervisor | unchanged values | No spurious "changed" notification |  |  |
| TC-ASSIGN-008 | P1 | Regenerate QR invalidates old QR | Assignment with QR | POST `/admin/assignments/{id}/regenerate-qr` | — | New QR issued; the previous QR token no longer validates |  |  |
| TC-ASSIGN-009 | P2 | Admin manual hours are pending verification | Assignment exists | POST `/admin/assignments/{id}/manual-hours` | hours, date, reason | TimeLog created with status `pending_verification` (needs supervisor approval) |  |  |
| TC-ASSIGN-010 | P2 | Admin requests required-hours change | Assignment exists | POST `/admin/assignments/{id}/required-hours` | proposed hours | Pending required-hours request recorded for supervisor decision |  |  |

---

## 13. Module: Recipient — Attendance / Geofenced Clock-In (`TC-ATT`)

| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-ATT-001 | P1 | Successful geofenced clock-in | Recipient with active assignment; office geofenced & configured; within window & radius | POST `/recipient/attendance/time-in-geofence` | valid office QR, GPS inside radius, accuracy 20 m | HTTP 200/201, open log created, `AttendanceStarted` broadcast |  |  |
| TC-ATT-002 | P1 | Clock-in outside geofence rejected | As above but GPS outside radius | Clock-in | GPS 500 m away | HTTP 422 with distance message (~500 m from office, allowed radius, GPS accuracy) |  |  |
| TC-ATT-003 | P1 | Tampered/invalid office QR rejected | Recipient | Clock-in | QR with altered signature | HTTP 422, "Invalid or tampered office QR code." |  |  |
| TC-ATT-004 | P1 | QR from a different office than assignment | Recipient assigned to office A | Clock-in with office B QR | office B QR | HTTP 422, "QR code belongs to a different office than your assignment." |  |  |
| TC-ATT-005 | P1 | No GPS provided | Geofenced office | Clock-in without lat/lng | office QR, no coords | HTTP 422, "Location access is required…" |  |  |
| TC-ATT-006 | P2 | Office with no location configured | Assigned office lacks geofence/coords | Clock-in | office QR | HTTP 422, "office has no location configured yet…contact administrator" |  |  |
| TC-ATT-007 | P1 | No active assignment | Recipient without active assignment | Clock-in | any office QR | HTTP 422, "You have no active assignment." |  |  |
| TC-ATT-008 | P1 | Clock-in blocked on Sunday | Current PHT day = Sunday | Clock-in | valid otherwise | HTTP 422, "Clock-in is only available Monday to Saturday." |  |  |
| TC-ATT-009 | P1 | Clock-in outside 06:00–17:30 window | Current PHT time 05:30 or 18:00 | Clock-in | valid otherwise | HTTP 422, "only available between 6:00 AM and 5:30 PM." |  |  |
| TC-ATT-010 | P2 | Boundary of clock-in window | PHT time exactly 06:00 and 17:30 | Clock-in at each edge | edge times | Both accepted (inclusive boundaries) |  |  |
| TC-ATT-011 | P1 | Block second clock-in while one open | Recipient already has an open log | Clock-in again | valid QR | HTTP 409, "already clocked in. Please clock out…" |  |  |
| TC-ATT-012 | P1 | Concurrent double clock-in (race) | No open log | Fire two simultaneous clock-ins | two parallel requests | Exactly one open log; the other → HTTP 409 (unique index guard) |  |  |
| TC-ATT-013 | P1 | Clock-in blocked after required hours met | `verified_hours >= required_hours` | Clock-in | valid QR | HTTP 409, "already completed your required service hours." |  |  |
| TC-ATT-014 | P2 | Poor GPS accuracy flags the log | Within radius but accuracy > 100 m | Clock-in | accuracy 150 m | Log created but `location_flagged=true`, reason "weak GPS signal" |  |  |
| TC-ATT-015 | P2 | Reused identical coordinates flagged | Prior log with identical lat/lng | Clock-in | exact same coords as a past log | Log flagged, reason "identical GPS coordinates reused" |  |  |
| TC-ATT-016 | P2 | Improbable travel speed flagged | Recent prior clock-in far away | Clock-in | coords implying > 130 km/h | Log flagged, reason "improbable travel speed" |  |  |
| TC-ATT-017 | P2 | GPS accuracy buffer allows a coarse-but-correct fix | Just outside strict radius, coarse accuracy | Clock-in | distance within radius + min(accuracy,100 m) | Accepted (tolerance applied, capped at 100 m) |  |  |
| TC-ATT-018 | P3 | Clock-in selfie is stored | Geofenced clock-in | Clock-in with a photo | image file | Log created, `time_in_photo_path` set, viewable via `/attendance/{logId}/photo` |  |  |
| TC-ATT-019 | P3 | Clock-in still succeeds if selfie upload fails | Geofenced clock-in | Clock-in with a failing photo upload | broken image | Clock-in succeeds (photo is best-effort, not fatal) |  |  |

---

## 14. Module: Recipient — Clock-Out & Auto Clock-Out (`TC-OUT`)

| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-OUT-001 | P1 | Manual clock-out with narrative | Open log with a submitted narrative | POST `/recipient/attendance/time-out` | valid own office/assignment QR | Log → `pending_verification`, duration computed, supervisors notified, `AttendanceCompleted` broadcast |  |  |
| TC-OUT-002 | P1 | Clock-out blocked without narrative | Open log, no narrative | Clock-out | valid QR | HTTP 422, "submit your narrative report before clocking out." |  |  |
| TC-OUT-003 | P1 | Clock-out with wrong office QR | Open log | Clock-out with a different office's QR | other office QR | HTTP 422, "QR code is for a different office…" |  |  |
| TC-OUT-004 | P2 | Clock-out with tampered QR | Open log | Clock-out | altered QR | HTTP 422, "Invalid or tampered QR code." |  |  |
| TC-OUT-005 | P1 | Clock-out with no open log | No open log | Clock-out | valid QR + random logId | HTTP 422, "No open attendance log found…" |  |  |
| TC-OUT-006 | P1 | Cannot clock out another user's log | Log belongs to another recipient | Clock-out that log id | other user's logId | HTTP 422 (ownership enforced) |  |  |
| TC-OUT-007 | P1 | Auto clock-out on leaving geofence | Open log, recipient leaves premises 10+ min | POST `/recipient/attendance/auto-clock-out` | GPS outside geofence | Log finalized with reason `auto`, **no narrative required** |  |  |
| TC-OUT-008 | P1 | Stale log auto-closed & capped at 12h | Open log older than 12h (forgotten clock-out) | Run `attendance:close-stale` (scheduler) | log open 20h | Log closed with reason `auto_stale`, duration capped at `time_in + 12h` (not full elapsed) |  |  |
| TC-OUT-009 | P2 | Duplicate open logs voided | User somehow has 2 open logs | Run dedup routine | 2 open logs | Earliest kept; extras set `rejected`/`auto_dedup`, zero duration |  |  |
| TC-OUT-010 | P2 | Poor time-out GPS accuracy flags log | Clock-out accuracy > 100 m | Clock-out | accuracy 150 m | Existing flag preserved and a poor time-out fix also flags the log |  |  |

---

## 15. Module: Recipient — Narrative Reports (`TC-NARR`)

| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-NARR-001 | P2 | Submit a valid narrative | Open log for the recipient | POST `/recipient/narratives` | `content` ≥10 chars, `activities_done` ≥10 chars | HTTP 201, narrative linked to the log |  |  |
| TC-NARR-002 | P2 | Content too short | Open log | Submit | content `hi` | HTTP 422 (min 10) |  |  |
| TC-NARR-003 | P2 | Missing activities_done | Open log | Submit without it | omit field | HTTP 422 (required) |  |  |
| TC-NARR-004 | P3 | Content/activities over max length | Open log | Submit | content > 5000 / activities > 3000 chars | HTTP 422 (max) |  |  |
| TC-NARR-005 | P2 | Narrative for a non-existent log | — | Submit | `time_log_id` invalid | HTTP 422 (`exists`) |  |  |
| TC-NARR-006 | P3 | View narrative for a log | Narrative exists | GET `/recipient/narratives/{logId}` | own logId | HTTP 200 with narrative |  |  |

---

## 16. Module: Supervisor — Verification & Students (`TC-VERIF`)

| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-VERIF-001 | P1 | Verify a pending log | Supervisor owns the assignment; log `pending_verification` | PUT `/supervisor/verifications/{logId}` | `action=verified` | Log → `verified`, Verification recorded, hours count toward required, `HoursVerified` event |  |  |
| TC-VERIF-002 | P1 | Reject a log with feedback | Pending log | PUT verification | `action=rejected`, feedback text | Log → `rejected`, `rejection_reason` set, recipient notified |  |  |
| TC-VERIF-003 | P2 | Reject requires feedback | Pending log | PUT verification | `action=rejected`, no feedback | HTTP 422 (`required_if:action,rejected`) |  |  |
| TC-VERIF-004 | P2 | Cannot verify a non-pending log | Log already `verified`/`open` | PUT verification | verified | HTTP 422, "Only logs…pending_verification…" |  |  |
| TC-VERIF-005 | P1 | Cannot verify another office's student | Log's assignment not owned & different office | PUT verification | log of unrelated student | HTTP 403, "not authorized to verify…" |  |  |
| TC-VERIF-006 | P2 | Co-supervisor of same office can verify | Supervisor shares the assignment's `office_id` | PUT verification | pending log in same office | HTTP 200, verification allowed |  |  |
| TC-VERIF-007 | P2 | Bulk verify approves many logs | Several own pending logs | POST `/supervisor/verifications/bulk` | array of logIds | Returns `{verified: N, skipped: M}`; all approvable logs verified |  |  |
| TC-VERIF-008 | P1 | Bulk verify skips location-flagged logs | Mix of normal + flagged logs | POST bulk | ids incl. flagged | Flagged logs skipped (must be reviewed individually), counted in `skipped` |  |  |
| TC-VERIF-009 | P2 | Bulk verify skips not-owned/not-pending | Mixed valid/invalid ids | POST bulk | incl. others' & non-pending ids | Those skipped; batch still succeeds for the rest |  |  |
| TC-VERIF-010 | P2 | Pending & reviewed queues | Logs in various states | GET `/supervisor/verifications/pending` and `/reviewed` | — | Correct partitioning of pending vs. reviewed logs |  |  |
| TC-VERIF-011 | P2 | List supervised students | Supervisor with students | GET `/supervisor/students` | — | Only the supervisor's students returned |  |  |
| TC-VERIF-012 | P2 | Currently clocked-in live view | A student has an open log < 12h | GET `/supervisor/students/clocked-in` | — | Student appears with live timer; stale (>12h) logs excluded |  |  |
| TC-VERIF-013 | P2 | Student summary & logs | Supervisor + student | GET `/supervisor/students/{id}/summary` and `/logs` | student id | HTTP 200 with hours summary / log history |  |  |
| TC-VERIF-014 | P2 | Supervisor grants manual hours (auto-verified) | Supervisor + student | POST `/supervisor/students/{id}/manual-hours` | hours, date, reason | TimeLog created `verified` immediately (supervisor is the verifier) |  |  |
| TC-VERIF-015 | P2 | Update required hours | Supervisor + student | PUT `/supervisor/students/{id}/required-hours` | new hours | Required hours updated on the assignment |  |  |
| TC-VERIF-016 | P2 | Decide admin's required-hours request | Pending required-hours request | POST `/supervisor/students/{id}/required-hours/decision` | approve/deny | Request resolved accordingly |  |  |
| TC-VERIF-017 | P3 | View student documents | Supervisor + student | GET `/supervisor/students/{id}/documents` | student id | HTTP 200 with document list |  |  |

---

## 17. Module: Hours, Stipend & Reports (`TC-HRS`, `TC-STIP`, `TC-RPT`)

### 17.1 Hours summary
| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-HRS-001 | P2 | Recipient hours summary | Recipient with verified logs | GET `/recipient/hours/summary` | — | Verified/pending totals and progress toward required hours |  |  |
| TC-HRS-002 | P2 | Only verified hours count toward requirement | Mix of pending/verified/rejected | View summary | mixed logs | Only `verified` duration counts; rejected excluded |  |  |

### 17.2 Stipend
| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-STIP-001 | P1 | Eligible list surfaces recipients who met hours | Active assignment, verified hours ≥ required, not yet paid | GET `/admin/stipend/eligible` | — | Recipient appears with verified/required hours + suggested ₱1,500 |  |  |
| TC-STIP-002 | P1 | Recipient below required hours not eligible | Verified hours < required | GET eligible | — | Recipient **not** listed |  |  |
| TC-STIP-003 | P1 | Already-paid period excluded | Stipend already released for that AY+semester | GET eligible | — | Recipient excluded (no double payout) |  |  |
| TC-STIP-004 | P1 | Release a stipend | Admin, eligible recipient | POST `/admin/stipend/release` | user, amount, AY, semester | StipendHistory `released`, audit logged, `StipendReleased` event |  |  |
| TC-STIP-005 | P2 | Recipient views own stipend history | Recipient with releases | GET `/recipient/stipend/history` | — | Only the recipient's own stipend records |  |  |
| TC-STIP-006 | P2 | Admin stipend list & filters | Releases exist | GET `/admin/stipend?status=released` | filter | Filtered/paginated stipend history |  |  |
| TC-STIP-007 | P3 | Non-admin blocked from release | Non-admin | POST release | any | HTTP 403 |  |  |

### 17.3 Reports & Duty Slip
| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-RPT-001 | P2 | Weekly report | Recipient with logs | GET `/recipient/reports/weekly` | — | HTTP 200, hours grouped by the week |  |  |
| TC-RPT-002 | P2 | Monthly report | Recipient with logs | GET `/recipient/reports/monthly` | — | HTTP 200, monthly totals |  |  |
| TC-RPT-003 | P2 | Semester report / duty slip data | Recipient with logs | GET `/recipient/reports/semester` | — | HTTP 200, full-semester breakdown |  |  |
| TC-RPT-004 | P1 | Duty slip control-no verify (valid) | Duty slip generated | GET `/admin/duty-slip/verify?control_no=…` | valid control no | `valid:true`, recipient resolved, recorded hours for encoded range returned |  |  |
| TC-RPT-005 | P2 | Duty slip invalid format | — | Verify | garbage string | `valid:false`, "not a valid SWAP control number format." |  |  |
| TC-RPT-006 | P2 | Duty slip checksum tamper | Altered control no | Verify | valid format, wrong checksum | `valid:false` (checksum mismatch) |  |  |
| TC-RPT-007 | P3 | Duty slip for unknown student | Control no with unknown SID | Verify | unknown student id | `recipient_found:false`, hours null |  |  |
| TC-RPT-008 | P2 | Supervisor roster + CSV export | Supervisor with students | GET `/supervisor/reports/roster` and `/roster/export` | — | Roster JSON + downloadable CSV export |  |  |
| TC-RPT-009 | P2 | Admin report preview & generate | Admin | GET `/admin/reports/preview` and `/generate` | period params | Preview data + generated report/file |  |  |

---

## 18. Module: Supporting Features (`TC-QR`, `TC-BOT`, `TC-CON`, `TC-SET`, `TC-NOTIF`, `TC-ANL`)

### 18.1 QR codes
| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-QR-001 | P2 | Office QR generation & validation | Office exists | Generate QR, then validate token | office | Valid signed token resolves back to the office |  |  |
| TC-QR-002 | P1 | Tampered QR signature rejected | Valid token | Alter payload/signature and validate | modified token | Returns null / invalid (HMAC mismatch) |  |  |
| TC-QR-003 | P2 | Malformed token rejected | — | Validate | `random.string`, no-dot string | Returns null gracefully (no crash) |  |  |
| TC-QR-004 | P2 | Supervisor fetches office QR | Supervisor with office | GET `/supervisor/office-qr` | — | HTTP 200 with the office QR |  |  |
| TC-QR-005 | P2 | Public QR render/view endpoints | Assignment QR exists | GET `/qr-codes/{assignmentId}` and `/view` | assignment id | QR payload / rendered image returned |  |  |

### 18.2 Chatbot / FAQ
| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-BOT-001 | P3 | FAQ query returns a match | FAQ knowledge base seeded | GET `/chatbot/query?...` | keyword like "how to apply" | Relevant FAQ answer returned |  |  |
| TC-BOT-002 | P3 | No-match returns a fallback | KB seeded | Query | gibberish | Graceful fallback message |  |  |
| TC-BOT-003 | P3 | Chatbot is publicly accessible | Not logged in | Query | keyword | HTTP 200 (no auth required) |  |  |

### 18.3 Concerns / Help desk
| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-CON-001 | P3 | Submit a concern | Logged in | POST `/concerns` | subject + message ≥10 chars | HTTP 201, confirmation message |  |  |
| TC-CON-002 | P3 | Message too short / missing subject | Logged in | POST | message `too` / no subject | HTTP 422 |  |  |

### 18.4 Settings (application/renewal period)
| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-SET-001 | P2 | Public application-status reflects toggle | — | GET `/settings/application-status` | — | Returns `open`, closed message, and renewal window info |  |  |
| TC-SET-002 | P2 | Admin opens/closes application period | Admin | PUT `/admin/settings` | `applications_open=true/false` | Setting persisted; registration allowed/blocked accordingly |  |  |
| TC-SET-003 | P2 | Admin configures renewal window | Admin | PUT `/admin/settings` | `renewal_open`, year, semester | Renewal window persisted and enforced on renewal submit |  |  |
| TC-SET-004 | P3 | Non-admin cannot change settings | Non-admin | PUT `/admin/settings` | any | HTTP 403 |  |  |

### 18.5 Notifications
| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-NOTIF-001 | P2 | List notifications | Logged in with notifications | GET `/notifications` | — | HTTP 200 with unread/read items |  |  |
| TC-NOTIF-002 | P2 | Mark one as read | Unread notification | PUT `/notifications/{id}/read` | id | Marked read |  |  |
| TC-NOTIF-003 | P3 | Mark all as read | Several unread | PUT `/notifications/read-all` | — | All marked read |  |  |
| TC-NOTIF-004 | P2 | Event-driven notifications fire | Trigger events (submit app, approve, interview, hours verified, placement, stipend) | Perform each action | — | Correct recipient(s) receive the matching notification (and email where configured) |  |  |
| TC-NOTIF-005 | P2 | Time-out notifies all eligible verifiers | Clock-out on a multi-supervisor office | Clock out | — | Assigned supervisor **and** co-supervisors of the office are notified |  |  |

### 18.6 Analytics & Audit logs
| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-ANL-001 | P2 | Admin analytics overview | Admin, data present | GET `/admin/analytics/overview` | — | HTTP 200 with aggregate counts/metrics |  |  |
| TC-ANL-002 | P3 | Analytics periods | Admin | GET `/admin/analytics/periods` | — | Available AY/semester periods |  |  |
| TC-ANL-003 | P2 | Audit logs recorded & listed | Actions performed | GET `/admin/audit-logs` | — | Create/update/decision actions appear with before/after values |  |  |

---

## 19. Module: RBAC & Cross-Cutting Security (`TC-SEC`)

| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-SEC-001 | P1 | Unauthenticated access blocked | No token | Call any authed endpoint | no Authorization header | HTTP 401 |  |  |
| TC-SEC-002 | P1 | Applicant cannot reach recipient/supervisor/admin routes | Logged in as applicant | Call `/recipient/*`, `/supervisor/*`, `/admin/*` | applicant token | HTTP 403 for each |  |  |
| TC-SEC-003 | P1 | Recipient cannot reach supervisor/admin routes | Recipient | Call `/supervisor/*`, `/admin/*` | recipient token | HTTP 403 |  |  |
| TC-SEC-004 | P1 | Supervisor cannot reach admin routes | Supervisor | Call `/admin/*` | supervisor token | HTTP 403 |  |  |
| TC-SEC-005 | P1 | Cannot access another user's document | Doc belongs to user B | GET `/documents/{id}/file` as user A | A's token, B's doc | Access denied (ownership/role enforced) |  |  |
| TC-SEC-006 | P1 | Cannot access another user's attendance photo | Photo of user B's log | GET `/attendance/{logId}/photo` as user A | A's token | Access denied unless authorized |  |  |
| TC-SEC-007 | P2 | Document/avatar link works via `?token=` in new tab | Valid token | Open file URL with `?token=` query param | file URL + token | Served correctly (in-controller auth) |  |  |
| TC-SEC-008 | P2 | Expired/invalid token rejected | Token deleted/expired | Call authed endpoint | stale token | HTTP 401 |  |  |
| TC-SEC-009 | P1 | Role escalation via direct ID manipulation | Recipient | Attempt admin/supervisor actions by guessing ids | crafted requests | Blocked by role middleware + ownership checks |  |  |
| TC-SEC-010 | P2 | SQL injection / XSS payloads in inputs | — | Submit payloads in text fields (name, remarks, narrative, concern) | `' OR 1=1 --`, `<script>alert(1)</script>` | Stored/escaped safely, no injection or script execution |  |  |
| TC-SEC-011 | P2 | Mass-assignment protection | — | Send extra fields (e.g. `role`, `status`, `is_active`) in profile/app updates | forbidden fields | Ignored; privileged fields not writable by the user |  |  |
| TC-SEC-012 | P2 | Auth throttling holds under burst | — | Burst login/register/forgot beyond limits | rapid requests | HTTP 429 enforced consistently |  |  |

---

## 20. Non-Functional Test Cases (`TC-NFR`)

| ID | Category | Test Scenario | How to Test | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|
| TC-NFR-001 | Performance | Dashboard/list load time | Load admin applications & analytics with realistic data | Loads within an acceptable time (e.g. ≤ 3 s) |  |  |
| TC-NFR-002 | Performance | Attendance clock-in latency | Time the clock-in round trip on mobile network | Responds within an acceptable time (e.g. ≤ 2 s) |  |  |
| TC-NFR-003 | Scalability | Pagination under many records | Seed hundreds of logs/applications | Pagination works; no timeout / memory blow-up |  |  |
| TC-NFR-004 | Usability | Mobile responsiveness | Open recipient attendance/scan on a phone | Layout usable; QR scanner & GPS prompts work |  |  |
| TC-NFR-005 | Compatibility | Cross-browser | Test on Chrome, Edge, Firefox, mobile Safari | Consistent behaviour |  |  |
| TC-NFR-006 | Reliability | Scheduler runs | Confirm `attendance:close-stale` runs hourly via cron | Stale logs closed automatically |  |  |
| TC-NFR-007 | Reliability | Queue/email worker | Trigger notifications with a running worker | Emails/notifications delivered out-of-band |  |  |
| TC-NFR-008 | Availability | GPS/permission denied handling | Deny location permission in the browser | Clear, friendly error; no crash |  |  |
| TC-NFR-009 | Security | HTTPS & token storage | Inspect transport & token handling | Traffic over HTTPS; tokens not leaked in logs/URLs |  |  |
| TC-NFR-010 | Data integrity | Duration is DB-computed | Create logs and inspect `duration_hours` | Always derived from time_in/time_out (not client-writable) |  |  |
| TC-NFR-011 | Recoverability | Failed upload rollback | Force a document/COR upload failure | No orphaned/blocking records left behind |  |  |
| TC-NFR-012 | Accessibility | Keyboard & contrast | Navigate key forms with keyboard; check contrast | Meets basic accessibility expectations |  |  |

---

## 21. Traceability & Coverage Summary

| Module | Test Case Range | Count | Priority focus |
|---|---|---|---|
| Registration | TC-REG-001..013 | 13 | Auth integrity, validation |
| Email Verification | TC-EV-001..005 | 5 | Account activation |
| Login / Logout | TC-AUTH-001..008 | 8 | Auth |
| Password Reset | TC-PWD-001..006 | 6 | Auth |
| Profile & Account | TC-PROF-001..007 | 7 | Account mgmt |
| Staff Invitations | TC-INV-001..006 | 6 | Onboarding |
| Applications | TC-APP-001..012 | 12 | Core workflow |
| Renewal | TC-REN-001..007 | 7 | Core workflow |
| Admin Review & Interviews | TC-ADMR-001..015 | 15 | Core workflow |
| Assignments & QR | TC-ASSIGN-001..010 | 10 | Core workflow |
| Attendance / Clock-In | TC-ATT-001..019 | 19 | Integrity, geofence |
| Clock-Out / Auto | TC-OUT-001..010 | 10 | Integrity |
| Narrative Reports | TC-NARR-001..006 | 6 | Workflow |
| Verification & Students | TC-VERIF-001..017 | 17 | Integrity, hours |
| Hours | TC-HRS-001..002 | 2 | Hours |
| Stipend | TC-STIP-001..007 | 7 | Money integrity |
| Reports & Duty Slip | TC-RPT-001..009 | 9 | Reporting |
| QR codes | TC-QR-001..005 | 5 | Security |
| Chatbot / FAQ | TC-BOT-001..003 | 3 | Support |
| Concerns | TC-CON-001..002 | 2 | Support |
| Settings | TC-SET-001..004 | 4 | Config |
| Notifications | TC-NOTIF-001..005 | 5 | Comms |
| Analytics & Audit | TC-ANL-001..003 | 3 | Admin |
| RBAC & Security | TC-SEC-001..012 | 12 | Security |
| Non-Functional | TC-NFR-001..012 | 12 | Quality attributes |
| **TOTAL** | — | **~205** | — |

---

## 22. Suggested test execution rounds

1. **Smoke round (P1 only):** auth, application submit → approve → assign, clock-in/out, verify, stipend release. Confirms the money-and-integrity happy path end-to-end.
2. **Full functional round (P1+P2):** every module, positive + negative + boundary.
3. **Security round:** all `TC-SEC-*`, QR tamper, rate limits, RBAC matrix.
4. **Non-functional round:** performance, mobile, scheduler/queue, recoverability.
5. **Regression round:** re-run the failed + fixed cases each build.

> **Tip for defense:** map each capstone objective/feature to its `TC-*` IDs in an appendix so panelists can see every claimed feature has explicit test coverage.
