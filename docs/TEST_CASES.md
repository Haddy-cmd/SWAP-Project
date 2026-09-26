# SWAP Portal — System Test Cases

**System:** SWAP (Student Welfare Assistantship Program) Portal — MSU Main Campus
**Architecture:** Laravel 12 (REST API) backend + Next.js 15 frontend, PostgreSQL
**Document purpose:** Complete catalogue of test cases for capstone documentation and system testing (functional, negative, boundary, security, and non-functional).
**Last aligned with the code:** 2026-09-26 (commit `58959a07` — systems-audit fixes). The backend is the source of truth: every expected message below is the exact text the API returns.

---

## 1. How to use this document

Each test case has a stable **ID** (e.g. `TC-AUTH-001`). Columns:

- **Test Scenario** — what is being checked, prefixed with its **type** tag (below).
- **Preconditions** — state the system must be in before the steps.
- **Test Steps** — the actions the tester performs.
- **Test Data** — concrete inputs (sample values you can reuse).
- **Expected Result** — the correct system behaviour (quoted messages are verbatim).
- **Actual Result** — *(fill in during execution)*.
- **Status** — *(fill in: ✅ Pass / ❌ Fail / ⛔ Blocked)*.

For your defense, keep the last two columns blank in the master copy and fill a dated execution copy per test round. The summary/traceability matrix is in [Section 26](#26-traceability--coverage-summary).

### Priority key
`P1` critical (money, integrity, security, auth) · `P2` core workflow · `P3` supporting/UX.

### Type tags
`[H]` happy path · `[N]` negative (invalid input / wrong state) · `[B]` boundary (edges of a limit or window) · `[S]` security (access control, abuse, tampering).

### Markers
- **OBSOLETE** — the feature was removed; the case is kept (same ID) and now checks that the old endpoint is really gone.
- **[KNOWN GAP]** — the expected result is the *correct* behaviour, but the current build does something else. Expect ❌ until it is fixed.
- **[NEEDS-CLARIFICATION]** — the rule is undecided or the behaviour may be intended; see [Section 25](#25-open-questions-needs-clarification).

### Personas (the order modules are tested in)
Visitor → Applicant → Admin (review & placement) → Recipient → Supervisor → Admin (stipends & reports) → Attacker.

---

## 2. Test environment & prerequisites

| Item | Value / Notes |
|---|---|
| Backend | Laravel 12 API (PHP 8.2), PostgreSQL, Sanctum bearer tokens |
| Frontend | Next.js 15, runs against the API base URL |
| Timezone | Stored in UTC; every business rule is applied in Asia/Manila (PHT) |
| Roles under test | `applicant`, `recipient`, `supervisor`, `admin` |
| Seed data needed | ≥1 admin **with a position title**, ≥2 supervisors (one sharing an office), ≥2 geofenced offices, ≥1 assignment, sample applicants |
| Institutional email domain | `@s.msumain.edu.ph` (registration is restricted to this) |
| Student ID | exactly 9 digits |
| Default required service hours | 200 per assignment (admin range 1–500) |
| Default stipend | ₱5,000 per semester (admin can override per release) |
| Login tokens | Expire after **7 days**; deactivating an account revokes all of its sessions |
| Interview windows (PHT) | Face-to-face: Mon–Fri, start **and** end within 7:00 AM–5:00 PM · Online: any day, within 8:00 AM–11:00 PM · default length 30 min |
| Clock-in window | Monday–Saturday, 06:00–17:30 PHT (both edges inclusive) |
| Max attendance session | 12 hours (stale logs auto-closed hourly, credit capped at 12 h) |
| Location flags | GPS accuracy worse than 100 m, identical coordinates reused, or travel faster than 130 km/h |
| Auto clock-out | Page watches the fence; after 10 minutes outside it asks the server, which re-checks the GPS fix |
| Upload limits | Application documents: PDF/JPG/PNG ≤ 5 MB · profile photo: JPG/PNG/WEBP ≤ 4 MB · signature: JPG/PNG/WEBP ≤ 2 MB · promissory file: PDF/JPG/PNG ≤ 5 MB |

### Rate limits (requests per minute; the next one returns HTTP 429)
| Endpoint | Limit |
|---|---|
| `POST /auth/login` | 6 |
| `POST /auth/register` | 5 |
| `POST /auth/forgot-password`, `POST /auth/resend-verification` | 3 |
| `POST /auth/reset-password` | 6 |
| `GET /invitations/{token}` / `POST /invitations/{token}/accept` | 10 / 6 |
| `GET /chatbot/query` | 20 |
| `GET /stipend/verify/{claimToken}` | 30 |
| `PUT /profile/password` | 6 |
| `POST /admin/stipend/unlock`, `/release`, `/release-bulk`, `/{id}/void` | 6 each |

### Test accounts (suggested)
| Role | Purpose |
|---|---|
| `admin@…` (with position title) | DSA staff — full admin module, stipend release |
| `supervisor.a@…` (office A, has a signature specimen) | Verifies logs for office A students |
| `supervisor.a2@…` (also office A) | Co-supervisor tests |
| `supervisor.b@…` (office B) | Cross-office authorization tests |
| `recipient1@…` (has a signature specimen) | Active assignment, attendance and stipend flows |
| `applicant1@…` | Application pipeline |

---

## 3. Module: Registration (`TC-REG`) — Visitor

| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-REG-001 | P1 | [H] Successful registration with institutional email | Application period **open** | POST `/auth/register` with all valid fields | email `juan.delacruz@s.msumain.edu.ph`, student ID `200912345`, password `Abcd1234`, program `BS Computer Science`, year 3 | HTTP 201, `verification_required: true`, account created **inactive/unverified**, verification email sent |  |  |
| TC-REG-002 | P1 | [N] Reject non-institutional email | Period open | Register with a gmail/other domain | `juan@gmail.com`, `juan@msumain.edu.ph` | HTTP 422, "Please use your MSU-Main student email (@s.msumain.edu.ph)." |  |  |
| TC-REG-003 | P1 | [B] Student ID must be exactly 9 digits | Period open | Register with 8-digit / 10-digit / non-numeric ID | `20091234` / `2009123456` / `20091234A` | HTTP 422, "Student ID must be exactly 9 digits." |  |  |
| TC-REG-004 | P2 | [N] Duplicate email rejected | An account with that email exists | Register with the same email | existing email | HTTP 422, email unique validation error |  |  |
| TC-REG-005 | P2 | [N] Duplicate student ID rejected | A profile with that student ID exists | Register with the same student ID | existing student ID | HTTP 422, student_id_number unique error |  |  |
| TC-REG-006 | P2 | [N] Password complexity enforced | Period open | Register with weak passwords | `pass`, `password`, `12345678`, `alllower1` | HTTP 422 (min 8, mixed case, numbers required) |  |  |
| TC-REG-007 | P2 | [N] Password confirmation mismatch | Period open | Register with mismatched confirmation | password `Abcd1234`, confirm `Abcd9999` | HTTP 422, confirmed validation error |  |  |
| TC-REG-008 | P2 | [N] 5th year only for 5-year programs | Period open | Register year_level 5 with a 4-year program | year 5, program `BS Computer Science` | HTTP 422, "A 5th year applies only to Engineering and BS Accountancy programs." |  |  |
| TC-REG-009 | P3 | [H] 5th year allowed for Engineering / BS Accountancy | Period open | Register year 5 with 5-year program | year 5, program `BS Civil Engineering` | HTTP 201 accepted |  |  |
| TC-REG-010 | P1 | [N] Registration blocked when applications closed | Application period **closed** | POST `/auth/register` | any valid payload | HTTP 403 with the configured closed message (default "The application period has not started yet. Please check back later.") |  |  |
| TC-REG-011 | P3 | [N] Missing required fields | Period open | Omit name / last_name / college / program | partial payload | HTTP 422 listing each missing field |  |  |
| TC-REG-012 | P3 | [B] Year level out of range | Period open | Register year 0 or 6 | year 0 / 6 | HTTP 422 (min 1, max 5) |  |  |
| TC-REG-013 | P1 | [S] Rate limiting on register | — | Send >5 register requests within 1 minute | 6 rapid requests | 6th returns HTTP 429 Too Many Requests |  |  |
| TC-REG-014 | P2 | [N] Names accept letters only | Period open | Register with digits/symbols in a name | first name `J0hn!` | HTTP 422, "Use letters, spaces, hyphens, apostrophes and periods only." |  |  |
| TC-REG-015 | P1 | [S] Cannot self-register as staff | Period open | Add `role` and `is_active` to a valid payload | `role=admin`, `is_active=true` | HTTP 201; account is `applicant` and **inactive** (extra fields ignored) |  |  |

---

## 4. Module: Email Verification (`TC-EV`) — Visitor

| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-EV-001 | P1 | [H] Verify via valid signed link | Unverified account exists | Open GET `/email/verify/{id}/{hash}` from the email | valid signed URL | Email marked verified, account **activated**, redirect to `/login?verified=1` |  |  |
| TC-EV-002 | P1 | [S] Tampered/invalid signature rejected | Unverified account | Alter the signature or expiry in the URL | modified `signature` | HTTP 403 (invalid signature) |  |  |
| TC-EV-003 | P2 | [H] Already-verified link is idempotent | Account already verified | Re-open the same link | same URL | Redirect to login, no error, no second activation |  |  |
| TC-EV-004 | P2 | [H] Resend verification email | Unverified account | POST `/auth/resend-verification` | account email | HTTP 200, "If your account still needs verification, a new link has been sent to your email." |  |  |
| TC-EV-005 | P2 | [S] Resend rate limited | — | Send >3 resend requests in 1 minute | 4 rapid requests | 4th returns HTTP 429 |  |  |
| TC-EV-006 | P2 | [S] Resend does not reveal which emails exist | — | Resend for an unknown email, and for an existing one | `nobody@s.msumain.edu.ph` | Same HTTP 200 and same message in both cases |  |  |
| TC-EV-007 | P2 | [N] Resend survives a mail outage | Mail server down / misconfigured | Resend for an unverified account | valid email | HTTP 200 (failure is logged, not shown as a server error) |  |  |
| TC-EV-008 | P3 | [N] Valid signature, wrong hash | Account exists | Open a signed link whose hash doesn't match the email | mismatched hash | Redirect to `/login?verify_error=1`; account stays unverified |  |  |

---

## 5. Module: Login / Logout / Sessions (`TC-AUTH`) — Visitor

| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-AUTH-001 | P1 | [H] Successful login (verified + active) | Verified, active account | POST `/auth/login` | correct email + password | HTTP 200, "Login successful.", returns user + bearer token |  |  |
| TC-AUTH-002 | P1 | [N] Wrong password rejected | Account exists | Login with wrong password | valid email, wrong password | HTTP 422, "The provided credentials are incorrect." |  |  |
| TC-AUTH-003 | P1 | [S] Unknown email rejected | — | Login with non-existent email | random email | HTTP 422, same credentials message (no user enumeration) |  |  |
| TC-AUTH-004 | P1 | [N] Unverified email blocks login | Account not yet verified | Login | valid but unverified account | HTTP 422, "Please verify your email first. Check your inbox for the verification link, or resend it below." |  |  |
| TC-AUTH-005 | P1 | [N] Deactivated account blocked at login | `is_active = false`, verified | Login | deactivated account | HTTP 422, "Your account has been deactivated. Please contact the DSA Office." |  |  |
| TC-AUTH-006 | P1 | [S] Login rate limiting | — | >6 login attempts in 1 minute | 7 rapid attempts | 7th returns HTTP 429 |  |  |
| TC-AUTH-007 | P2 | [H] Logout invalidates token | Logged in | POST `/auth/logout` then reuse token | valid token | "Logged out successfully."; reused token → HTTP 401 |  |  |
| TC-AUTH-008 | P2 | [H] Session persists via valid token | Logged in | Call `/profile` with token | valid token | HTTP 200 profile returned |  |  |
| TC-AUTH-009 | P1 | [S] A deactivated user's open session is refused | User logged in; then deactivated directly in the DB | Call any authenticated endpoint with the old token | old token | HTTP 403, "Your account has been deactivated. Please contact the DSA Office." |  |  |
| TC-AUTH-010 | P1 | [S] Deactivation by an admin signs the user out everywhere | User logged in on two devices | Admin: PUT `/admin/users/{id}` `is_active=false`; user retries | both tokens | Both tokens deleted → HTTP 401; audit log records `tokens_revoked` |  |  |
| TC-AUTH-011 | P1 | [B] Login tokens expire after 7 days | Logged in | Call `/profile` after the token's `expires_at` (or set it to the past in the DB) | 8-day-old token | HTTP 401; a fresh login issues a token expiring in 7 days |  |  |
| TC-AUTH-012 | P3 | [S] Logout closes the stipend step-up window | Admin unlocked Stipend Management | Log out, log in again, reuse the old `unlock_token` | old unlock token | HTTP 422, "The stipend gate has expired. Re-enter your password to unlock it again." |  |  |

---

## 6. Module: Password Reset (`TC-PWD`) — Visitor

| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-PWD-001 | P2 | [H] Request reset for existing email | Account exists | POST `/auth/forgot-password` | valid email | HTTP 200, reset link emailed ("We have emailed your password reset link.") |  |  |
| TC-PWD-002 | P2 | [S] Request reset for unknown email **[KNOWN GAP]** | — | POST `/auth/forgot-password` | non-existent email | Generic success message, same as TC-PWD-001 (no user enumeration). *Current build returns HTTP 422 "We can't find a user with that email address." — a way to test which emails are registered.* |  |  |
| TC-PWD-003 | P1 | [H] Reset with valid token | Reset token issued | POST `/auth/reset-password` | valid token + new compliant password | Password updated; can log in with new password |  |  |
| TC-PWD-004 | P1 | [N] Reset with invalid/expired token | — | POST `/auth/reset-password` | bad/expired token | HTTP 422, "This password reset token is invalid." |  |  |
| TC-PWD-005 | P2 | [N] Reset enforces password complexity | Valid token | Reset with weak password | `weak` | HTTP 422 complexity error |  |  |
| TC-PWD-006 | P1 | [S] Forgot-password rate limiting | — | >3 requests in 1 minute | 4 rapid requests | 4th returns HTTP 429 |  |  |
| TC-PWD-007 | P2 | [S] Reset-password rate limiting | — | >6 reset attempts in 1 minute | 7 rapid requests | 7th returns HTTP 429 |  |  |

---

## 7. Module: Staff Invitations (`TC-INV`) — Admin → Visitor (invitee)

| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-INV-001 | P2 | [H] Admin creates staff invitation | Logged in as admin | POST `/admin/invitations` | supervisor email + role | "Invitation sent to {email}.", email with a 3-day link sent, audit logged |  |  |
| TC-INV-002 | P2 | [H] Invitee opens valid token | Invitation exists | GET `/invitations/{token}` | valid token | HTTP 200, invitation details shown |  |  |
| TC-INV-003 | P2 | [H] Invitee accepts and sets password | Valid token | POST `/invitations/{token}/accept` | name + compliant password | "Account created. Welcome to the SWAP Portal!"; account has the invited role, is active, can log in |  |  |
| TC-INV-004 | P2 | [N] Invalid/expired/used token | Token used or expired | GET/POST with that token | consumed token | HTTP 404, "This invitation link is invalid or has expired." |  |  |
| TC-INV-005 | P3 | [S] Non-admin cannot create invitation | Logged in as non-admin | POST `/admin/invitations` | any | HTTP 403, "Forbidden. Insufficient permissions." |  |  |
| TC-INV-006 | P3 | [S] Invitation endpoints rate limited | — | Flood `/invitations/{token}` (>10/min) or accept (>6/min) | rapid requests | HTTP 429 after limit |  |  |
| TC-INV-007 | P2 | [N] Invite for an email that already has an account | Account exists for the invited email | Accept the invitation | existing email | HTTP 422, "An account with this email already exists. Please sign in instead." |  |  |
| TC-INV-008 | P2 | [S] **OBSOLETE** — direct staff creation removed | — | POST `/admin/users` as admin | name, email, password, role | HTTP 405 (route removed; staff accounts only come through invitations) |  |  |

---

## 8. Module: Applicant — Applications (`TC-APP`) — Applicant

| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-APP-001 | P1 | [H] Submit a valid application | Logged in as applicant, period open, no in-progress app | POST `/applicant/applications` | `academic_year` `2024-2025`, `semester` `1st Semester` | HTTP 201, "Application submitted successfully.", status `submitted`, admins notified, audit logged |  |  |
| TC-APP-002 | P2 | [N] Reject bad academic year format | Applicant | Submit | `2024/2025` or `24-25` | HTTP 422 (format `YYYY-YYYY`) |  |  |
| TC-APP-003 | P2 | [N] Reject invalid semester | Applicant | Submit | `3rd Semester` | HTTP 422 (must be 1st Semester / 2nd Semester / Summer) |  |  |
| TC-APP-004 | P1 | [N] Block second application while one in progress | Has a `submitted`/`under_review`/`interview_scheduled` app | Submit another | different period | HTTP 409, "You already have an application in progress. Please wait for it to be reviewed before submitting another." |  |  |
| TC-APP-005 | P1 | [N] Block new application after approval | Has an `approved` application | Submit another | any | HTTP 409, "Your application has already been approved. Please wait for the office assignment announcement." |  |  |
| TC-APP-006 | P2 | [N] Block duplicate application for same period | App (e.g. rejected) exists for that AY+semester | Submit same period | same AY + semester | HTTP 409, "You already have an application for 2024-2025 1st Semester." |  |  |
| TC-APP-007 | P2 | [H] Upload document to application | Application exists | POST `/applicant/applications/{id}/documents` | `document_type=cor`, PDF ≤ 5 MB | HTTP 201, "Document uploaded successfully.", served via `/documents/{id}/file` |  |  |
| TC-APP-008 | P3 | [B] Reject invalid document file | Application exists | Upload | `.exe`, `.docx`, PDF of 5.1 MB, unknown `document_type` | HTTP 422 |  |  |
| TC-APP-009 | P2 | [S] **OBSOLETE** — separate status endpoint removed | Application exists | GET `/applicant/applications/{id}/status` | own id | HTTP 404 (use TC-APP-013 instead) |  |  |
| TC-APP-010 | P2 | [H] Cancel a freshly-submitted application | Own app, status `submitted` | DELETE `/applicant/applications/{id}` | own id | HTTP 200, "Application cancelled.", documents removed, audit logged |  |  |
| TC-APP-011 | P1 | [S] Cannot view/delete another user's application | Applicant B owns app | GET/DELETE app id of another user | other user's id | HTTP 404, "Application not found." (ownership enforced) |  |  |
| TC-APP-012 | P2 | [H] List only own applications | Multiple applicants | GET `/applicant/applications` | — | Returns only the caller's applications |  |  |
| TC-APP-013 | P2 | [H] View own application detail and status | Application exists | GET `/applicant/applications/{id}` | own id | HTTP 200 with status, remarks, documents and interview (time, venue, meeting link) |  |  |
| TC-APP-014 | P2 | [N] Cannot cancel once review has started | Own app `under_review` or later | DELETE `/applicant/applications/{id}` | own id | HTTP 422, "This application can no longer be cancelled." |  |  |
| TC-APP-015 | P1 | [N] Submission blocked when applications closed | Period **closed** | POST `/applicant/applications` | valid payload | HTTP 403 with the configured closed message |  |  |
| TC-APP-016 | P2 | [S] Cannot upload to someone else's application | Application of user B | POST `/applicant/applications/{B's id}/documents` as A | valid PDF | HTTP 404, "Application not found." |  |  |

---

## 9. Module: Recipient — Renewal (`TC-REN`) — Recipient

| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-REN-001 | P1 | [H] Successful renewal | Renewal **open** + year/semester configured, recipient has a prior assignment | POST `/recipient/renewals` with updated COR | valid COR file | HTTP 201, `type=renewal`, status `submitted`, COR attached, admins notified |  |  |
| TC-REN-002 | P2 | [N] Renewal blocked when window closed | Renewal **closed** | POST renewal | any | HTTP 422, "The renewal period is not open yet. Please wait for the DSA announcement." |  |  |
| TC-REN-003 | P2 | [N] Renewal not configured | `renewal_open` true but year/semester unset | POST renewal | any | HTTP 422, "The renewal period is not fully configured. Please contact the DSA office." |  |  |
| TC-REN-004 | P2 | [N] Renewal requires prior assignment | User with no previous assignment | POST renewal | any | HTTP 422, "Renewal is only available to recipients with an existing assignment." |  |  |
| TC-REN-005 | P2 | [N] Duplicate renewal for the term | Already submitted for that term | POST renewal again | same term | HTTP 409, "You already have a submission for {year} — {semester}." |  |  |
| TC-REN-006 | P2 | [N] Broken COR upload rolls back | Renewal open/configured | Simulate storage failure on upload | failing upload | HTTP 422, "Could not upload your COR. Please try again."; no document-less renewal left in the queue |  |  |
| TC-REN-007 | P1 | [H] Approving renewal rolls over assignment | Renewal app `submitted`, admin | Admin approves renewal (no interview needed) | approve | Old assignment `completed`, new assignment created (same office/supervisor), hours reset |  |  |
| TC-REN-008 | P2 | [N] A decided renewal can't be approved again | Renewal already approved | Admin approves again | approve | HTTP 409, "This application has already been decided."; no second assignment or email |  |  |

---

## 10. Module: Admin — Application Review & Interviews (`TC-ADMR`) — Admin

Allowed transitions: `submitted` → `under_review` / `interview_scheduled` / `rejected` · `under_review` → `interview_scheduled` / `rejected` · `interview_scheduled` → rescheduled / `approved` / `rejected` · renewals may be approved from `submitted` or `under_review` · `approved` and `rejected` are final.

| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-ADMR-001 | P2 | [H] List & filter applications | Admin, apps exist | GET `/admin/applications?status=submitted` | status filter | HTTP 200, filtered/paginated list |  |  |
| TC-ADMR-002 | P2 | [H] Mark application under review | `submitted` app | PUT `/admin/applications/{id}/review` | — | Status → `under_review`, applicant notified in-app |  |  |
| TC-ADMR-003 | P2 | [H] Schedule an interview (future, in window) | App `submitted`/`under_review` | POST `/admin/applications/{id}/interview` | Tuesday 10:00 PHT, `mode=in_person` | Status → `interview_scheduled`, interview created, applicant notified |  |  |
| TC-ADMR-004 | P2 | [N] Reject interview in the past | App | Schedule interview | yesterday 10:00 | HTTP 422, "The interview cannot be scheduled in the past. Pick a later date or time." |  |  |
| TC-ADMR-005 | P3 | [H] In-person interview defaults venue | App | Schedule in-person without location | `mode=in_person`, no location | Location saved as "Office of the Dean of Student Affairs (DSA)" |  |  |
| TC-ADMR-006 | P2 | [H] Reschedule an interview | Interview scheduled | PUT `/admin/applications/{id}/interview` | new valid time | Interview moved, old time kept in the history (audit `rescheduled`), applicant re-notified, no-show flag cleared |  |  |
| TC-ADMR-007 | P3 | [N] Reschedule when no interview exists | No interview | PUT interview | any | HTTP 409, "This application has no interview to reschedule." |  |  |
| TC-ADMR-008 | P2 | [H] Mark interview no-show | Interview `scheduled` | POST `/admin/applications/{id}/interview/no-show` | — | Interview status → `no_show`, audit logged |  |  |
| TC-ADMR-009 | P3 | [N] No-show only from scheduled state | Interview already `no_show` | POST no-show | — | HTTP 409, "Only a scheduled interview can be marked as a no-show." |  |  |
| TC-ADMR-010 | P1 | [N] Cannot approve fresh app before interview | Fresh app `under_review` | PUT `/admin/applications/{id}/decide` | `decision=approved` | HTTP 409, "An interview must be scheduled before this application can be approved." |  |  |
| TC-ADMR-011 | P1 | [H] Approve after the interview | `interview_scheduled`, interview not a no-show | Decide approved | approve + remarks | Status → `approved`, applicant notified, moves to the Assignments queue |  |  |
| TC-ADMR-012 | P2 | [H] Reject an open application | App at any open stage | Decide rejected | `decision=rejected`, remarks | Status → `rejected`, applicant notified |  |  |
| TC-ADMR-013 | P2 | [N] Invalid decision value rejected | App | Decide | `decision=maybe` | HTTP 422 (`in:approved,rejected`) |  |  |
| TC-ADMR-014 | P1 | [H] Renewal approval skips interview requirement | Renewal app (no interview) | Decide approved | approve | HTTP 200 approved (interview not required) |  |  |
| TC-ADMR-015 | P3 | [S] Non-admin blocked from review endpoints | Non-admin | Call any `/admin/applications/*` | — | HTTP 403 |  |  |
| TC-ADMR-016 | P2 | [N] Review only moves a new submission | App `interview_scheduled` | PUT `/admin/applications/{id}/review` | — | HTTP 409, "This application is already past the review step."; status unchanged |  |  |
| TC-ADMR-017 | P2 | [N] Schedule twice | Interview already scheduled | POST `/admin/applications/{id}/interview` again | valid time | HTTP 409, "An interview is already scheduled. Reschedule it instead." |  |  |
| TC-ADMR-018 | P1 | [S] A decided application is final | App `approved` (or `rejected`) | Decide rejected / review / schedule / reschedule / no-show | any | HTTP 409, "This application has already been decided."; status unchanged, recipient role and assignment untouched |  |  |
| TC-ADMR-019 | P1 | [N] Approval refused after a no-show | Interview `no_show` | Decide approved | approve | HTTP 409, "The applicant missed the interview. Reschedule it before approving."; Approve button hidden on both admin pages; reject still allowed |  |  |
| TC-ADMR-020 | P2 | [B] Face-to-face window edges | App `under_review` | Schedule F2F, 30 min | Tue 06:59 / 07:00 / 16:30 / 16:31 PHT | 07:00 and 16:30 accepted; 06:59 and 16:31 → HTTP 422, "Face-to-face interviews must start and end between 7:00 AM and 5:00 PM." |  |  |
| TC-ADMR-021 | P2 | [N] Face-to-face on a weekend | App `under_review` | Schedule F2F | Saturday 10:00 PHT | HTTP 422, "Face-to-face interviews run Monday to Friday only. Pick a weekday, or switch to Online." |  |  |
| TC-ADMR-022 | P2 | [B] Online window edges (any day) | App `under_review` | Schedule online, 30 min, with a link | Sunday 07:59 / 08:00 / 22:30 / 22:31 PHT | 08:00 and 22:30 accepted; 07:59 and 22:31 → HTTP 422, "Online interviews must start and end between 8:00 AM and 11:00 PM." |  |  |
| TC-ADMR-023 | P2 | [N] Online interview needs a valid link | App `under_review` | Schedule online | no link / `meet.google.com/abc` | HTTP 422, "An online interview needs a meeting link." / "Enter a valid meeting link, including https://." |  |  |
| TC-ADMR-024 | P2 | [H] Online interview from the Applications list page | Admin on `/admin/applications` (list view) | Choose Online, enter the link in "Meeting Link", schedule | `https://meet.google.com/abc-defg-hij` | Scheduled; any backend refusal is shown in a red toast with the exact message (no silent failure) |  |  |
| TC-ADMR-025 | P3 | [H] Time without a zone is read as Manila time | App `under_review` | POST interview with `scheduled_at` lacking an offset | `2026-10-06T10:00` | Stored as 10:00 PHT (02:00 UTC) |  |  |
| TC-ADMR-026 | P2 | [N] Decision still saves if the email fails | Mail server down | Approve an application | approve | HTTP 200 approved (mail failure logged, not a 500) |  |  |

---

## 11. Module: Admin — Assignments & QR (`TC-ASSIGN`) — Admin

| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-ASSIGN-001 | P1 | [H] Create assignment promotes applicant → recipient | Approved applicant, office, supervisor | POST `/admin/assignments` | user, office, supervisor, `required_hours=200`, start_date | HTTP 201, role becomes `recipient`, assignment QR generated, recipient notified of placement, audit logged |  |  |
| TC-ASSIGN-002 | P2 | [B] Required hours boundaries | Admin | Create with out-of-range hours | `0`, `501` (and `1`, `500` accepted) | HTTP 422 for 0 and 501 (min 1, max 500) |  |  |
| TC-ASSIGN-003 | P2 | [N] end_date must be after start_date | Admin | Create with bad dates | end before start | HTTP 422 (`after:start_date`) |  |  |
| TC-ASSIGN-004 | P2 | [N] Non-existent user/office/supervisor | Admin | Create referencing missing ids | invalid ids | HTTP 422 (`exists`) |  |  |
| TC-ASSIGN-005 | P2 | [H] Update assignment office notifies recipient | Assignment exists | PUT `/admin/assignments/{id}` | new office_id | Assignment updated, recipient notified with `changed=true` |  |  |
| TC-ASSIGN-006 | P2 | [H] Update supervisor notifies recipient | Assignment exists | PUT assignment | new supervisor_id | Updated + change notification sent |  |  |
| TC-ASSIGN-007 | P3 | [N] No-op update sends no notification | Assignment exists | PUT with same office/supervisor | unchanged values | No spurious "changed" notification |  |  |
| TC-ASSIGN-008 | P1 | [S] Regenerate QR invalidates old QR | Assignment with QR | POST `/admin/assignments/{id}/regenerate-qr` | — | "QR code regenerated. All previous tokens are now invalid."; old token no longer validates; audit `qr_regenerated` |  |  |
| TC-ASSIGN-009 | P2 | [H] Admin manual hours are pending verification | Assignment exists | POST `/admin/assignments/{id}/manual-hours` | hours 2, today, reason | "Bonus hours submitted for supervisor approval."; log `pending_verification`; supervisor notified; audit `manual_hours_added` |  |  |
| TC-ASSIGN-010 | P2 | [H] Admin requests required-hours change | Assignment exists | POST `/admin/assignments/{id}/required-hours` | proposed 250 | "Required-hours change submitted for supervisor approval."; pending value stored; audit `required_hours_requested` |  |  |
| TC-ASSIGN-011 | P1 | [N] One active assignment per term | Recipient already has an active assignment for 2024-2025 1st Semester | POST `/admin/assignments` again for the same term | same user, AY, semester | HTTP 422, `user_id`: "This recipient already has an active assignment for this term."; only one row exists |  |  |
| TC-ASSIGN-012 | P2 | [S] Database backstop for duplicate placement | — | Insert a second `active` assignment for the same user + term directly (or fire two creates at once) | duplicate row | Rejected by the unique index; the API answers with the same 422 message |  |  |
| TC-ASSIGN-013 | P2 | [S] Admin can't change required hours directly | Assignment exists | PUT `/admin/assignments/{id}` with `required_hours` | `required_hours=10` | Field ignored; required hours only change through supervisor approval (TC-VERIF-016) |  |  |
| TC-ASSIGN-014 | P2 | [N] Placement still saves if the email fails | Mail server down | Create an assignment | valid payload | HTTP 201; notification failure logged, not a 500 |  |  |

---

## 12. Module: Profile & Account (`TC-PROF`) — any signed-in user

| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-PROF-001 | P2 | [H] View own profile | Logged in | GET `/profile` | — | HTTP 200 with user + profile data |  |  |
| TC-PROF-002 | P2 | [H] Update profile fields | Logged in | PUT `/profile` | new contact number, program | HTTP 200, "Profile updated."; audit `profile_updated` with before/after |  |  |
| TC-PROF-003 | P3 | [H] Upload valid profile photo | Logged in | POST `/profile/photo` | JPG/PNG/WEBP ≤ 4 MB | HTTP 200, "Profile photo updated.", served via `/users/{id}/avatar`, old photo deleted, audit `photo_updated` |  |  |
| TC-PROF-004 | P3 | [B] Reject invalid photo type/size | Logged in | POST `/profile/photo` | `.exe` / `.gif` / 4.1 MB JPG | HTTP 422 validation error |  |  |
| TC-PROF-005 | P3 | [H] Delete profile photo | Photo exists | DELETE `/profile/photo` | — | HTTP 200, "Profile photo removed.", audit `photo_removed` |  |  |
| TC-PROF-006 | P1 | [H] Change password with correct current | Logged in | PUT `/profile/password` | correct current + compliant new | HTTP 200, "Password updated successfully."; audit `password_changed` (no password in the log) |  |  |
| TC-PROF-007 | P1 | [N] Change password with wrong current | Logged in | PUT `/profile/password` | wrong current password | HTTP 422, "The current password is incorrect."; password unchanged |  |  |
| TC-PROF-008 | P1 | [S] Password change signs out other sessions | Logged in on two devices | Change password on device 1, then use device 2 | two tokens | Device 2 → HTTP 401; device 1 stays signed in |  |  |
| TC-PROF-009 | P2 | [S] Password change is rate limited | Logged in | >6 password-change attempts in 1 minute | 7 rapid wrong attempts | 7th returns HTTP 429 |  |  |
| TC-PROF-010 | P2 | [H] Admin position title saved and cleared | Admin | PUT `/profile` with `position_title`, then with empty | `Director, Division of Student Affairs` | Saved and returned; clearing it blocks stipend release (TC-STIP-010) |  |  |

---

## 13. Module: Signature Specimen (`TC-SIG`) — all staff and recipients

| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-SIG-001 | P1 | [H] Save a drawn or uploaded specimen | Logged in | POST `/profile/signature` | transparent PNG from the signature pad | HTTP 200, "Digital signature saved. It will appear on newly released claim stubs.", `signature_url` returned, audit `signature_updated` |  |  |
| TC-SIG-002 | P2 | [N] Non-image specimen rejected | Logged in | POST `/profile/signature` | `sig.pdf` | HTTP 422 on `signature` |  |  |
| TC-SIG-003 | P3 | [B] Specimen size limit | Logged in | POST `/profile/signature` | PNG of 2.1 MB | HTTP 422 (max 2 MB) |  |  |
| TC-SIG-004 | P2 | [H] Remove the specimen | Specimen saved | DELETE `/profile/signature` | — | HTTP 200, "Digital signature removed. New stubs will show your printed name instead.", `signature_url` null, audit `signature_removed` |  |  |
| TC-SIG-005 | P1 | [N] Clock-in requires a specimen | Recipient without a specimen | Clock in (any entry point) | valid office QR + GPS | HTTP 422, "A digital signature is required before clocking in. Draw or upload one on your Profile page."; the recipient banner shows the same sentence |  |  |
| TC-SIG-006 | P1 | [S] Who may view a specimen | Supervisor A supervises recipient R | GET `/users/{R}/signature` as R, admin, supervisor A, supervisor B, no token | tokens | R, admin, A → 200 image; B → 403 "You are not authorized to view this signature."; no token → 401 |  |  |
| TC-SIG-007 | P2 | [S] A recipient may view only their own supervisor's specimen | R supervised by A, not by B | GET `/users/{A}/signature` and `/users/{B}/signature` as R | R's token | A → 200 (needed for the duty slip); B → 403 |  |  |
| TC-SIG-008 | P2 | [H] Weekly reminder only to recipients without a specimen | Some active recipients lack a specimen | Run `php artisan remind:missing-signatures` twice | — | Each specimen-less recipient gets one email + in-app nudge; the second run sends no duplicate while the first is unread |  |  |
| TC-SIG-009 | P1 | [S] Replacing a specimen never changes signed stubs | Stub released + receipt confirmed with specimens | Supervisor and recipient save new specimens; delete the archived PDF; download the stub | new drawings | The stub still shows the **original** ink (each signature is copied into the stub at signing) |  |  |

---

## 14. Module: Recipient — Attendance / Geofenced Clock-In (`TC-ATT`) — Recipient

Entry points that must behave identically: **(a)** `/scan` (phone camera deep link), **(b)** `/recipient/attendance/scan`, **(c)** `/recipient/attendance` (manual code paste).

| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-ATT-001 | P1 | [H] Successful geofenced clock-in | Recipient with active assignment and specimen; office geofenced; within window & radius | POST `/recipient/attendance/time-in-geofence` | valid office QR, GPS inside radius, accuracy 20 m, selfie | HTTP 201, open log created, audit `clocked_in` |  |  |
| TC-ATT-002 | P1 | [N] Clock-in outside geofence rejected | As above but GPS outside radius | Clock-in | GPS 500 m away | HTTP 422, "You must be on the office premises to clock in. Your phone's location reads ~500m from {office} …" (distance, allowed radius and GPS accuracy) |  |  |
| TC-ATT-003 | P1 | [S] Tampered/invalid office QR rejected | Recipient | Clock-in | QR with altered signature | HTTP 422, "Invalid or tampered office QR code." |  |  |
| TC-ATT-004 | P1 | [S] QR from a different office than assignment | Recipient assigned to office A | Clock-in with office B QR | office B QR | HTTP 422, "This QR code belongs to a different office than your assignment." |  |  |
| TC-ATT-005 | P1 | [N] No GPS provided | Geofenced office | Clock-in without lat/lng | office QR, no coords | HTTP 422, "Location access is required to clock in at this office." |  |  |
| TC-ATT-006 | P2 | [N] Office with no location configured | Assigned office lacks geofence/coords | Clock-in | office QR | HTTP 422, "This office has no location configured yet. Please contact your administrator before clocking in." |  |  |
| TC-ATT-007 | P1 | [N] No active assignment | Recipient without active assignment | Clock-in | any office QR | HTTP 422, "You have no active assignment." |  |  |
| TC-ATT-008 | P1 | [N] Clock-in blocked on Sunday | Current PHT day = Sunday | Clock-in | valid otherwise | HTTP 422, "Clock-in is only available Monday to Saturday." |  |  |
| TC-ATT-009 | P1 | [N] Clock-in outside 06:00–17:30 window | Current PHT time 05:30 or 18:00 | Clock-in | valid otherwise | HTTP 422, "Clock-in is only available between 6:00 AM and 5:30 PM." |  |  |
| TC-ATT-010 | P2 | [B] Edges of the clock-in window | PHT time 05:59, 06:00, 17:30, 17:31 | Clock-in at each | edge times | 06:00 and 17:30 accepted; 05:59 and 17:31 rejected with the TC-ATT-009 message |  |  |
| TC-ATT-011 | P1 | [N] Block second clock-in while one open | Recipient already has an open log | Clock-in again | valid QR | HTTP 409, "You are already clocked in. Please clock out before clocking in again." |  |  |
| TC-ATT-012 | P1 | [S] Concurrent double clock-in (race) | No open log | Fire two simultaneous clock-ins | two parallel requests | Exactly one open log; the other → HTTP 409 (unique index guard) |  |  |
| TC-ATT-013 | P1 | [N] Clock-in blocked after required hours met | `verified_hours >= required_hours` | Clock-in | valid QR | HTTP 409, "You have already completed your required service hours." |  |  |
| TC-ATT-014 | P2 | [B] Poor GPS accuracy flags the log | Within radius but accuracy > 100 m | Clock-in | accuracy 150 m | Log created, `location_flagged=true` (weak GPS signal) |  |  |
| TC-ATT-015 | P2 | [S] Reused identical coordinates flagged | Prior log with identical lat/lng | Clock-in | exact same coords as a past log | Log flagged (identical GPS coordinates reused) |  |  |
| TC-ATT-016 | P2 | [S] Improbable travel speed flagged | Recent prior clock-in far away | Clock-in | coords implying > 130 km/h | Log flagged (improbable travel speed) |  |  |
| TC-ATT-017 | P2 | [B] GPS accuracy buffer allows a coarse-but-correct fix | Just outside strict radius, coarse accuracy | Clock-in | distance within radius + min(accuracy, 100 m) | Accepted (tolerance applied, capped at 100 m) |  |  |
| TC-ATT-018 | P3 | [H] Clock-in selfie is stored | Selfie required | Clock-in with a photo | image file | `time_in_photo_path` set; viewable via `/attendance/{logId}/photo` by the recipient, their supervisor and admin only |  |  |
| TC-ATT-019 | P3 | [N] Clock-in still succeeds if selfie storage fails | Selfie sent; storage failing | Clock-in | valid image | Clock-in succeeds (photo storage is best-effort) |  |  |
| TC-ATT-020 | P1 | [N] Selfie required and missing | A governing supervisor requires the selfie | Clock-in without a photo | no photo | HTTP 422, "A selfie is required to clock in at this office. Please allow camera access and take a photo." |  |  |
| TC-ATT-021 | P2 | [H] Selfie turned off by any governing supervisor | A supervisor of the office (not necessarily the assigned one) turned the selfie off | Clock-in without a photo | no photo | HTTP 201 (selfie not required) |  |  |
| TC-ATT-022 | P1 | [H] All three entry points show the backend's exact message | Recipient already clocked in | Clock in again via (a), (b) and (c) | valid QR | Each page shows "You are already clocked in. Please clock out before clocking in again." — never "Request failed with status code 409" |  |  |
| TC-ATT-023 | P2 | [N] Yesterday's open log blocks a new clock-in | Open log dated yesterday | Clock-in today | valid QR | HTTP 409 (same message as TC-ATT-011) until the stale sweep closes it |  |  |
| TC-ATT-024 | P1 | [S] A deactivated recipient can't clock in | Recipient deactivated while logged in | Clock-in with the old token | valid QR | HTTP 401 or 403 (see TC-AUTH-009/010); no log created |  |  |

---

## 15. Module: Recipient — Clock-Out & Auto Clock-Out (`TC-OUT`) — Recipient

| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-OUT-001 | P1 | [H] Manual clock-out with narrative | Open log with a submitted narrative | POST `/recipient/attendance/time-out` | own office or assignment QR | Log → `pending_verification`, duration computed, supervisors notified, audit `clocked_out` |  |  |
| TC-OUT-002 | P1 | [N] Clock-out blocked without narrative | Open log, no narrative | Clock-out | valid QR | HTTP 422, "Please submit your narrative report before clocking out." |  |  |
| TC-OUT-003 | P1 | [S] Clock-out with wrong office QR | Open log | Clock-out with a different office's QR | other office QR | HTTP 422, "This QR code is for a different office. Please scan your assigned office QR to clock out." |  |  |
| TC-OUT-004 | P2 | [S] Clock-out with tampered QR | Open log | Clock-out | altered QR | HTTP 422, "Invalid or tampered QR code." |  |  |
| TC-OUT-005 | P1 | [N] Clock-out with no open log | No open log | Clock-out | valid QR + random logId | HTTP 422, "No open attendance log found with this ID." |  |  |
| TC-OUT-006 | P1 | [S] Cannot clock out another user's log | Log belongs to another recipient | Clock-out that log id | other user's logId | HTTP 422, same message (ownership enforced) |  |  |
| TC-OUT-007 | P1 | [H] Auto clock-out after leaving the premises | Open log; recipient ≥ 10 min outside the fence | Page calls POST `/recipient/attendance/auto-clock-out` | GPS ~1.1 km away, accuracy 10 m | HTTP 200, "You left the office premises and were automatically clocked out.", reason `auto`, **no narrative required** |  |  |
| TC-OUT-008 | P1 | [B] Stale log auto-closed & capped at 12 h | Open log older than 12 h | Run `attendance:close-stale` (hourly scheduler) | log open 20 h | Closed with reason `auto_stale`, duration capped at 12 h; audit `clocked_out` with no user (system) |  |  |
| TC-OUT-009 | P2 | [H] Duplicate open logs voided | User somehow has 2 open logs | Run the dedup routine | 2 open logs | Earliest kept; extras set `rejected` / `auto_dedup`, zero duration |  |  |
| TC-OUT-010 | P2 | [B] Poor time-out GPS accuracy flags log | Clock-out accuracy > 100 m | Clock-out | accuracy 150 m | Existing flag preserved and the poor time-out fix also flags the log |  |  |
| TC-OUT-011 | P1 | [S] Auto clock-out refused inside the fence | Open log; recipient still at the office | POST `/recipient/attendance/auto-clock-out` directly | office coordinates | HTTP 422, "You are still within the office premises. Scan your office QR to clock out."; log stays open (the narrative rule can't be skipped) |  |  |
| TC-OUT-012 | P1 | [N] Auto clock-out without a location | Open log | POST auto-clock-out with only `log_id` | no lat/lng | HTTP 422 on `latitude` and `longitude` |  |  |
| TC-OUT-013 | P2 | [N] Auto clock-out at an office without a geofence | Open log at a non-geofenced office | POST auto-clock-out | any coordinates | HTTP 422, "Automatic clock-out only applies to geofenced offices. Scan your office QR to clock out." |  |  |
| TC-OUT-014 | P2 | [N] Stale sweep survives a deleted recipient | Recipient soft-deleted with an open log > 12 h | Run `attendance:close-stale` | — | Log closed and capped; no crash |  |  |

---

## 16. Module: Recipient — Narrative Reports (`TC-NARR`) — Recipient

| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-NARR-001 | P2 | [H] Submit a valid narrative | Open log for the recipient | POST `/recipient/narratives` | `content` ≥ 10 chars, `activities_done` ≥ 10 chars | HTTP 201, "Narrative report submitted successfully.", linked to the log, audit logged |  |  |
| TC-NARR-002 | P2 | [B] Content too short | Open log | Submit | content `hi` (9 chars fails, 10 passes) | HTTP 422 (min 10) |  |  |
| TC-NARR-003 | P2 | [N] Missing activities_done | Open log | Submit without it | omit field | HTTP 422 (required) |  |  |
| TC-NARR-004 | P3 | [B] Content/activities over max length | Open log | Submit | content > 5000 / activities > 3000 / challenges > 2000 chars | HTTP 422 (max) |  |  |
| TC-NARR-005 | P2 | [N] Narrative for a non-existent log | — | Submit | `time_log_id` 999999 | HTTP 422 (`exists`) |  |  |
| TC-NARR-006 | P3 | [H] View narrative for a log | Narrative exists | GET `/recipient/narratives/{logId}` | own logId | HTTP 200 with narrative |  |  |
| TC-NARR-007 | P2 | [N] Only one narrative per log | Narrative already submitted | Submit again for the same log | same `time_log_id` | HTTP 409, "Narrative report already submitted for this log." |  |  |
| TC-NARR-008 | P1 | [S] Can't write a narrative on someone else's log | Log belongs to another recipient | Submit with their `time_log_id` | other user's log | HTTP 404, "Time log not found." |  |  |

---

## 17. Module: Recipient — Hours (`TC-HRS`) — Recipient

| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-HRS-001 | P2 | [H] Recipient hours summary | Recipient with verified logs | GET `/recipient/hours/summary` | — | Verified/pending totals and progress toward required hours |  |  |
| TC-HRS-002 | P1 | [H] Only verified hours count toward requirement | Mix of pending/verified/rejected | View summary | mixed logs | Only `verified` duration counts; pending shown separately; rejected excluded |  |  |
| TC-HRS-003 | P2 | [B] Log history page size for duty slips | Recipient with many logs | GET `/recipient/attendance/logs?per_page=300`, then `500`, then `501` | per_page values | 300 and 500 → HTTP 200 (one page covers a semester); 501 → HTTP 422 |  |  |

---

## 18. Module: Recipient — Promissory Notes (`TC-PROM`) — Recipient → Supervisor

A recipient who ends the semester short on verified hours may file a promissory note; a supervisor who governs the assignment (assigned supervisor or any supervisor of the office) reviews it. Semester end = the assignment's end date, else the `semester_end_date` setting (Manila time).

| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-PROM-001 | P1 | [H] Submit after the semester ends | Active assignment, semester ended, verified < required | POST `/recipient/promissory` | `assignment_id`, PDF ≤ 5 MB, reason | HTTP 201, note `pending`, governing supervisors notified, audit logged |  |  |
| TC-PROM-002 | P1 | [N] Too early | Semester end is today or later (Manila) | Submit | valid file | HTTP 422, "Promissory notes can only be submitted after the semester ends." |  |  |
| TC-PROM-003 | P2 | [N] Semester end not set | No end date on the assignment and no `semester_end_date` setting | Submit | valid file | HTTP 422, "Semester end date is not set. Ask the admin to set it first." |  |  |
| TC-PROM-004 | P1 | [N] Hours already complete | verified ≥ required | Submit | valid file | HTTP 422, "No lacking hours — a promissory note is not needed." |  |  |
| TC-PROM-005 | P2 | [N] One pending note per assignment | A pending note exists | Submit another | valid file | HTTP 422, "There is already a pending promissory note for this assignment." |  |  |
| TC-PROM-006 | P2 | [B] File type and size | Semester ended, short on hours | Submit | `.docx`; PDF 5.1 MB; missing reason | HTTP 422 on `file` / `reason` |  |  |
| TC-PROM-007 | P1 | [S] Can't file for someone else's assignment | Assignment of another recipient | Submit with their `assignment_id` | valid file | HTTP 404, "Assignment not found." |  |  |
| TC-PROM-008 | P1 | [H] Governing supervisor approves | Pending note | POST `/supervisor/promissory/{id}/review` | `action=approve`, `lacking_hours=12` | Note `approved`, makeup deadline = semester end + 7 days, student notified, recipient appears in the stipend eligible list "via promissory" |  |  |
| TC-PROM-009 | P2 | [N] Rejection needs remarks | Pending note | Review | `action=reject`, no remarks | HTTP 422 on `review_remarks` |  |  |
| TC-PROM-010 | P1 | [S] Non-governing supervisor can't review | Supervisor of another office | Review the note | approve | HTTP 404, "Student not found or not assigned to you." |  |  |
| TC-PROM-011 | P2 | [N] Can't review twice | Note already approved/rejected | Review again | approve | HTTP 422, "This promissory note has already been reviewed." |  |  |
| TC-PROM-012 | P2 | [S] Who may open the attached file | Note with file | GET the file as the owner, governing supervisor, admin, and an unrelated recipient | tokens | Owner, supervisor, admin → file; unrelated user → denied |  |  |
| TC-PROM-013 | P3 | [H] Admin sees all notes | Notes exist | GET `/admin/promissory` | — | HTTP 200, all notes with status [NEEDS-CLARIFICATION: there is no admin page for this list yet] |  |  |
| TC-PROM-014 | P2 | [B] Zero verified hours | Semester ended, verified = 0 | Submit | valid file | Accepted (code allows 0 < required) [NEEDS-CLARIFICATION: the pasted QA rule says 0 < verified] |  |  |
| TC-PROM-015 | P2 | [N] Makeup deadline is not enforced [NEEDS-CLARIFICATION] | Approved note, deadline passed, hours still short | Check the stipend eligible list | — | Current rule: still eligible (approval alone makes the student payable). Record the observed result; the rule is a DSA decision |  |  |

---

## 19. Module: Supervisor — Verification & Students (`TC-VERIF`) — Supervisor

| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-VERIF-001 | P1 | [H] Verify a pending log | Supervisor governs the assignment; log `pending_verification` | PUT `/supervisor/verifications/{logId}` | `action=verified` | Log → `verified`, verification recorded, hours count toward required, recipient notified |  |  |
| TC-VERIF-002 | P1 | [H] Reject a log with feedback | Pending log | PUT verification | `action=rejected`, feedback text | Log → `rejected`, reason stored, recipient notified |  |  |
| TC-VERIF-003 | P2 | [N] Reject requires feedback | Pending log | PUT verification | `action=rejected`, no feedback | HTTP 422 (`feedback` required when rejecting) |  |  |
| TC-VERIF-004 | P2 | [N] Cannot verify a non-pending log | Log already `verified` or still `open` | PUT verification | verified | HTTP 422, "Only logs with status pending_verification can be verified or rejected." |  |  |
| TC-VERIF-005 | P1 | [S] Cannot verify another office's student | Log's assignment neither assigned to nor hosted by the supervisor's office | PUT verification | log of unrelated student | HTTP 403, "You are not authorized to verify logs for this student." |  |  |
| TC-VERIF-006 | P2 | [H] Co-supervisor of same office can verify | Supervisor shares the assignment's `office_id` | PUT verification | pending log in same office | HTTP 200; the reviewed list names the co-supervisor who acted |  |  |
| TC-VERIF-007 | P2 | [H] Bulk verify approves many logs | Several own pending logs | POST `/supervisor/verifications/bulk` | array of logIds | "Verified N log(s)." with `{verified, skipped}` counts |  |  |
| TC-VERIF-008 | P1 | [S] Bulk verify skips location-flagged logs | Mix of normal + flagged logs | POST bulk | ids incl. flagged | Flagged logs skipped (must be reviewed one by one), counted in `skipped` |  |  |
| TC-VERIF-009 | P2 | [N] Bulk verify skips not-owned/not-pending | Mixed valid/invalid ids | POST bulk | incl. others' & non-pending ids | Those skipped; batch still succeeds for the rest |  |  |
| TC-VERIF-010 | P2 | [H] Pending & reviewed queues | Logs in various states | GET `/supervisor/verifications/pending` and `/reviewed` | — | Correct partitioning of pending vs. reviewed logs |  |  |
| TC-VERIF-011 | P2 | [S] List supervised students | Supervisor with students | GET `/supervisor/students` | — | Only students the supervisor governs (assigned or same office) |  |  |
| TC-VERIF-012 | P2 | [H] Currently clocked-in live view | A student has an open log < 12 h | GET `/supervisor/students/clocked-in` | — | Student appears with live timer; stale (> 12 h) logs excluded |  |  |
| TC-VERIF-013 | P2 | [H] Student summary & logs | Supervisor + student | GET `/supervisor/students/{id}/summary` and `/logs?per_page=300` | student id | HTTP 200 with hours summary, both signature URLs (for the duty slip) and log history; `per_page` 501 → 422 |  |  |
| TC-VERIF-014 | P2 | [H] Supervisor grants bonus hours (auto-verified) | Supervisor + student | POST `/supervisor/students/{id}/manual-hours` | 2 h, today, reason | "Bonus hours added."; log `verified` immediately; audit `manual_hours_added` |  |  |
| TC-VERIF-015 | P2 | [H] Update required hours | Supervisor + student | PUT `/supervisor/students/{id}/required-hours` | 180 | "Required hours updated."; audit `updated` with old/new values |  |  |
| TC-VERIF-016 | P2 | [H] Decide admin's required-hours request | Pending required-hours request | POST `/supervisor/students/{id}/required-hours/decision` | `action=approve` / `reject` | "Required-hours change approved." / "…rejected."; audit `required_hours_approved` / `required_hours_rejected` |  |  |
| TC-VERIF-017 | P3 | [S] View student documents | Supervisor + student | GET `/supervisor/students/{id}/documents` | student id | HTTP 200 with document list; another office's student → 404 "Student not found or not assigned to you." |  |  |
| TC-VERIF-018 | P2 | [N] No pending required-hours change | No pending request | POST decision | approve | HTTP 422, "There is no pending required-hours change." |  |  |
| TC-VERIF-019 | P2 | [B] Bonus hours limits | Supervisor + student | POST manual-hours | 0.2 h; 24.5 h; tomorrow's date | HTTP 422 (0.25–24 h, date not in the future) |  |  |

---

## 20. Module: Admin — Stipend Claim Stubs (`TC-STIP`) — Admin → Recipient → Banking Office

Lifecycle (Option C): releasing a stub **is** certifying it — `certified` → `claimed` (receipt confirmed) or `void` (before claim). Legacy rows may say `released`. Release, void and unlock need the admin's password (step-up) or the short-lived unlock token; bulk release accepts only the unlock token.

| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-STIP-001 | P1 | [H] Eligible list surfaces recipients who met hours | Active assignment, verified ≥ required, no live stub for the period | GET `/admin/stipend/eligible` | — | Recipient listed with verified/required hours and suggested ₱5,000 |  |  |
| TC-STIP-002 | P1 | [N] Recipient below required hours not eligible | Verified < required, no approved promissory note | GET eligible | — | Recipient **not** listed |  |  |
| TC-STIP-003 | P1 | [N] Period with a live stub excluded | Stub `certified`/`claimed` (or legacy `released`/`pending`) for that AY+semester | GET eligible | — | Recipient excluded (no double payout) |  |  |
| TC-STIP-004 | P1 | [H] Release (certify) a claim stub | Admin with position title, eligible recipient | POST `/admin/stipend/release` | user, AY, semester, admin password | HTTP 201, "Claim stub released. The recipient has been notified that it is ready to claim."; status `certified`; control number `SWAP-STP-YYYYMM-#####`; supervisor + director signatures; PDF archived; audit `released`; claim token **not** in the response |  |  |
| TC-STIP-005 | P2 | [H] Recipient views own stipend history | Recipient with stubs | GET `/recipient/stipend/history?per_page=100` | — | All of the recipient's own stubs (not just the first 15) |  |  |
| TC-STIP-006 | P2 | [H] Admin stipend list & filters | Stubs exist | GET `/admin/stipend?status=certified` (then `claimed`, `void`) | filter | Filtered, paginated list |  |  |
| TC-STIP-007 | P3 | [S] Non-admin blocked from release | Non-admin | POST release | any | HTTP 403 |  |  |
| TC-STIP-008 | P1 | [N] Ineligible recipient can't be released | Recipient short on hours, no approved note | POST release | valid step-up | HTTP 422, "This recipient is not eligible for a stipend for this period."; nothing created |  |  |
| TC-STIP-009 | P1 | [S] No second live stub for the same period | Recipient already has a certified stub | POST release again for the same AY+semester | valid step-up | HTTP 422, "This recipient already has a live stipend for this period."; a direct duplicate insert is also rejected by the database |  |  |
| TC-STIP-010 | P1 | [N] Admin without a position title | Admin's position title empty | POST release (single and bulk) | valid step-up | HTTP 422, "Set your position title on your Profile page before releasing stipends."; the page shows the same sentence |  |  |
| TC-STIP-011 | P1 | [S] Wrong step-up password | Admin | POST release | wrong password | HTTP 422 on `password`, "The password you entered is incorrect."; nothing created |  |  |
| TC-STIP-012 | P1 | [S] Step-up password guessing is throttled | Admin | 7 release (or void, or unlock) attempts in a minute | wrong passwords | 7th → HTTP 429 |  |  |
| TC-STIP-013 | P1 | [H] Unlock Stipend Management once | Admin | POST `/admin/stipend/unlock` with password, then release with `unlock_token` | correct password | "Stipend Management unlocked."; token valid 15 min (sliding); release succeeds without a password |  |  |
| TC-STIP-014 | P2 | [N] Bad or expired unlock token | Admin | Release/void with a bogus token | `unlock_token=bogus` | HTTP 422, "The stipend gate has expired. Re-enter your password to unlock it again." |  |  |
| TC-STIP-015 | P1 | [H] Bulk release from the checklist | Unlocked; 2 eligible + 1 ineligible + 1 duplicate item | POST `/admin/stipend/release-bulk` | items + `unlock_token` | "Released 2 stub(s). 2 skipped."; skipped reasons "Not eligible for this period." / "Already has a live stipend for this period." |  |  |
| TC-STIP-016 | P2 | [B] Bulk size limits | Unlocked | POST release-bulk | 0 items; 101 items | HTTP 422 (1–100 items) |  |  |
| TC-STIP-017 | P1 | [H] Recipient downloads the stub | Certified stub | GET `/recipient/stipend/{id}/slip` | — | PDF with control number, amount, period, supervisor and director signatures (ink when specimens exist) |  |  |
| TC-STIP-018 | P2 | [N] Stub can't be rendered | PDF engine failing (e.g. GD missing) | Download the stub | — | HTTP 503, "Your claim stub could not be generated right now. Please try again in a few minutes or contact the DSA office." |  |  |
| TC-STIP-019 | P1 | [H] Recipient confirms receipt at the Banking Office | Certified stub, owner | POST `/recipient/stipend/{id}/confirm-receipt` | `releasing_officer_name=Cashier Jane Doe` | "Receipt confirmed. Your Receiving Slip has been recorded."; status `claimed`; beneficiary + releasing-officer signatures added; claim token cleared; PDF re-rendered; "received" notification |  |  |
| TC-STIP-020 | P1 | [S] Can't confirm someone else's stub | Stub of recipient B | Confirm as recipient A | officer name | HTTP 422, "This stipend does not belong to you."; still `certified` |  |  |
| TC-STIP-021 | P1 | [N] Can't confirm twice or after void | Stub `claimed` or `void` | Confirm | officer name | HTTP 422, "This stipend is not available to claim." |  |  |
| TC-STIP-022 | P1 | [H] Banking Office verifies a claim token | Certified stub | GET `/stipend/verify/{claimToken}` (no login) | the stub's token | HTTP 200, `valid:true` with control number, recipient name, amount, period, status only |  |  |
| TC-STIP-023 | P1 | [S] Used, void or unknown token is refused | Stub claimed or voided, or random token | GET verify | token | HTTP 404, `valid:false`, "This claim slip is invalid, already claimed, or has been voided." |  |  |
| TC-STIP-024 | P2 | [S] Verify endpoint throttled | — | 31 verify calls in a minute | random tokens | 31st → HTTP 429 |  |  |
| TC-STIP-025 | P1 | [H] Void before claim | Certified stub | POST `/admin/stipend/{id}/void` | reason + step-up | "Stipend voided."; token cleared (verify → 404); audit `voided`; the period becomes releasable again |  |  |
| TC-STIP-026 | P1 | [N] A claimed stub can't be voided | Claimed stub | POST void | reason + step-up | HTTP 422, "A claimed stipend cannot be voided. Post a reversing entry instead." |  |  |
| TC-STIP-027 | P1 | [N] Receipt still saves if the notification fails | Mail server down | Confirm receipt | officer name | HTTP 200, status `claimed` (no 500; a retry would otherwise hit TC-STIP-021) |  |  |
| TC-STIP-028 | P2 | [H] Totals follow the claim lifecycle | One claimed (₱5,000), one legacy released (₱4,000), one certified (₱3,000), one void | Admin analytics overview and Stipend report preview | period | Paid/"Total Claimed" = ₱9,000; "Awaiting Claim" = ₱3,000; void excluded; chart series "Claimed" / "Awaiting claim" |  |  |
| TC-STIP-029 | P3 | [B] History page size | Recipient | GET history with `per_page` 100 and 101 | — | 100 → HTTP 200; 101 → HTTP 422 |  |  |
| TC-STIP-030 | P2 | [H] Amount override | Eligible recipient | Release with a custom amount | `amount=4500` | Stub amount ₱4,500 (default ₱5,000 when omitted) |  |  |
| TC-STIP-031 | P2 | [H] Promissory-approved recipient is releasable | Short on hours, approved promissory note | GET eligible, then release | — | Listed "via promissory"; release succeeds and the stub remarks cite the note |  |  |

---

## 21. Module: Reports & Duty Slips (`TC-RPT`) — Recipient / Supervisor / Admin

Duty slips are built in the browser from the attendance logs and carry a Control No. `SWAP-{SID}-{YY}{YY}{S1/S2/SM}-{SEM or W<yyyymmdd>}-{checksum}` that the admin can verify.

| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-RPT-001 | P2 | [S] **OBSOLETE** — weekly report endpoint removed | Recipient | GET `/recipient/reports/weekly` | — | HTTP 404 (weekly duty slip replaces it — TC-RPT-010) |  |  |
| TC-RPT-002 | P2 | [S] **OBSOLETE** — monthly report endpoint removed | Recipient | GET `/recipient/reports/monthly` | — | HTTP 404 |  |  |
| TC-RPT-003 | P2 | [S] **OBSOLETE** — semester report endpoint removed | Recipient | GET `/recipient/reports/semester` | — | HTTP 404 (semester service report replaces it — TC-RPT-011) |  |  |
| TC-RPT-004 | P1 | [H] Duty slip control-no verify (valid) | Duty slip printed | GET `/admin/duty-slip/verify?control_no=…` | valid control no | `valid:true`, recipient resolved, recorded hours for the encoded range; audit `duty_slip_verified` |  |  |
| TC-RPT-005 | P2 | [N] Duty slip invalid format | — | Verify | `hello-world` | `valid:false`, "This is not a valid SWAP control number format." |  |  |
| TC-RPT-006 | P1 | [S] Duty slip checksum tamper | Altered control no | Verify | valid format, last character changed | `valid:false` (checksum mismatch) |  |  |
| TC-RPT-007 | P3 | [N] Duty slip for unknown student | Control no with unknown SID | Verify | unknown student id | `recipient_found:false`, hours null |  |  |
| TC-RPT-008 | P2 | [H] Supervisor roster + CSV export | Supervisor with students | GET `/supervisor/reports/roster` and `/roster/export` | — | Roster JSON + CSV download; export audit-logged |  |  |
| TC-RPT-009 | P2 | [H] Admin report preview & generate | Admin | GET `/admin/reports/preview` and `/generate` | `type=stipend`, AY, semester | Preview + CSV; stipend stats "Total Claimed", "Recipients", "Awaiting Claim", "Claimed"; export audit `report_exported` |  |  |
| TC-RPT-010 | P1 | [H] Weekly duty slip prints | Recipient with a week of logs | Recipient → Reports → Duty slip → Weekly → Print | a Mon–Sun week | One A4 portrait page: AM/PM in-out, BONUS then TOTAL (= regular + bonus), control number; supervisor + beneficiary ink only when every day is verified |  |  |
| TC-RPT-011 | P2 | [H] Semester service report prints | Recipient with a semester of logs | Duty slip → Semester → Print | whole term | Summary, weekly breakdown, certification and signatures on A4 portrait; control number with range `SEM` |  |  |
| TC-RPT-012 | P1 | [H] Semester verify counts only its term | Logs in two terms incl. rejected and bonus | Verify a `SEM` control number | `…-2425S1-SEM-…` | Hours = that term only, rejected excluded, bonus included; range "Whole semester — 1st Semester, AY 2024-2025" |  |  |
| TC-RPT-013 | P1 | [S] Unknown coverage range is not a slip | — | Verify a well-formed, correctly checksummed control number with a made-up range | range `X123` or `W20241399` | `valid:false`, "This control number has an unrecognised coverage range."; no hours returned |  |  |
| TC-RPT-014 | P2 | [B] Semester slip with no academic year | — | Verify a `SEM` control number with AY `0000` | `…-0000S1-SEM-…` | `valid:true`, `recorded_hours` null, range "Whole semester — 1st Semester, AY unknown"; page shows "AY unknown" |  |  |
| TC-RPT-015 | P2 | [H] Slip times print in Manila time | Device clock set to UTC (or another zone) | Print a weekly slip | logs at 09:30 and 13:00 PHT | Slip shows 9:30 AM in the AM column and 1:00 PM in the PM column |  |  |
| TC-RPT-016 | P1 | [S] CSV formula injection neutralised | Recipient named `=HYPERLINK("http://evil.example","Click")` | Export the roster / admin report CSV | — | Cell starts with an apostrophe (`'=HYPERLINK(…`) so the spreadsheet shows text, not a formula |  |  |

---

## 22. Module: Supporting Features (`TC-QR`, `TC-BOT`, `TC-CON`, `TC-SET`, `TC-NOTIF`, `TC-ANL`)

### 22.1 QR codes
| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-QR-001 | P2 | [H] Office QR generation & validation | Office exists | Generate QR, then validate token | office | Valid signed token resolves back to the office |  |  |
| TC-QR-002 | P1 | [S] Tampered QR signature rejected | Valid token | Alter payload/signature and validate | modified token | Returns null / invalid (HMAC mismatch) |  |  |
| TC-QR-003 | P2 | [N] Malformed token rejected | — | Validate | empty string, `random.string`, no-dot string | Returns null gracefully (no crash) |  |  |
| TC-QR-004 | P2 | [H] Supervisor fetches office QR | Supervisor with office | GET `/supervisor/office-qr` | — | HTTP 200 with the office QR |  |  |
| TC-QR-005 | P1 | [S] **OBSOLETE** — public QR endpoints removed | Assignment exists | GET `/qr-codes/{assignmentId}` and `/qr-codes/{assignmentId}/view` without a token | ids 1, 2, 3 | HTTP 404 for every id (they used to leak names and clock-out QR tokens) |  |  |
| TC-QR-006 | P2 | [S] A token only works for its own assignment | Two assignments | Validate assignment A's token as B | A's token | Rejected |  |  |

### 22.2 Chatbot / FAQ
| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-BOT-001 | P3 | [H] FAQ query returns a match | FAQ knowledge base seeded | GET `/chatbot/query?message=how long does the application review take` | question | HTTP 200 with `answer`, `faq_id`, `confidence`, `category` |  |  |
| TC-BOT-002 | P3 | [N] No-match returns a fallback | KB seeded | Query | `zxqwv plplpl` | Graceful fallback answer, `faq_id` null |  |  |
| TC-BOT-003 | P3 | [H] Chatbot is publicly accessible | Not logged in | Query | question | HTTP 200 (no auth required) |  |  |
| TC-BOT-004 | P3 | [B] Message length | — | Query | 1 character; 501 characters | HTTP 422 (2–500 characters) |  |  |
| TC-BOT-005 | P2 | [S] Chatbot is rate limited | — | 21 queries in a minute | any question | 21st → HTTP 429 (protects the paid AI quota) |  |  |
| TC-BOT-006 | P3 | [N] AI service slow or down | `GEMINI_API_KEY` set; AI unreachable or > 8 s | Query | FAQ question | FAQ answer returned within ~10 s (no hang, no error) |  |  |

### 22.3 Concerns / Help desk
| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-CON-001 | P3 | [H] Submit a concern | Logged in | POST `/concerns` | subject + message ≥ 10 chars | HTTP 201, "Your concern has been submitted. The DSA Office will respond shortly." |  |  |
| TC-CON-002 | P3 | [N] Message too short / missing subject | Logged in | POST | message `too` / no subject / message > 2000 chars | HTTP 422 |  |  |
| TC-CON-003 | P3 | [S] Concerns need a login | Not logged in | POST `/concerns` | valid payload | HTTP 401 |  |  |
| TC-CON-004 | P3 | [N] Nobody can read submitted concerns [NEEDS-CLARIFICATION] | A concern submitted | Look for it as admin | — | No admin page or endpoint lists concerns yet; record what the DSA expects |  |  |

### 22.4 Settings (application/renewal period)
| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-SET-001 | P2 | [H] Public application-status reflects toggle | — | GET `/settings/application-status` | — | Returns `open`, closed message, and renewal window info |  |  |
| TC-SET-002 | P2 | [H] Admin opens/closes application period | Admin | PUT `/admin/settings` | `applications_open=true/false`, closed message | "Settings updated."; registration and submission allowed/blocked accordingly |  |  |
| TC-SET-003 | P2 | [H] Admin configures renewal window | Admin | PUT `/admin/settings` | `renewal_open`, year, semester | Renewal window persisted and enforced on renewal submit |  |  |
| TC-SET-004 | P3 | [S] Non-admin cannot change settings | Non-admin | PUT `/admin/settings` | any | HTTP 403 |  |  |
| TC-SET-005 | P3 | [N] Semester end fallback can't be set [NEEDS-CLARIFICATION] | Assignment without an end date | Try to set a semester end date as admin | — | No setting exists for `semester_end_date` in the API/UI; promissory notes then fail with TC-PROM-003 |  |  |

### 22.5 Notifications
| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-NOTIF-001 | P2 | [H] List notifications | Logged in with notifications | GET `/notifications` | — | HTTP 200 with the caller's own items only |  |  |
| TC-NOTIF-002 | P2 | [H] Mark one as read | Unread notification | PUT `/notifications/{id}/read` | id | "Notification marked as read." |  |  |
| TC-NOTIF-003 | P3 | [H] Mark all as read | Several unread | PUT `/notifications/read-all` | — | "All notifications marked as read." |  |  |
| TC-NOTIF-004 | P2 | [H] Event-driven notifications fire | Trigger events | Submit app, review, schedule interview, approve/reject, place, verify hours, release stub, confirm receipt, promissory review | — | The right person receives the matching notification (and email where configured) |  |  |
| TC-NOTIF-005 | P2 | [H] Time-out notifies all eligible verifiers | Office with two supervisors | Clock out | — | Assigned supervisor **and** co-supervisors of the office are notified |  |  |
| TC-NOTIF-006 | P3 | [N] Notifications don't arrive live [NEEDS-CLARIFICATION] | Page open | Trigger an event from another account | — | Bell updates only on refresh/refetch; real-time push is not functional |  |  |

### 22.6 Analytics & Audit logs
| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-ANL-001 | P2 | [H] Admin analytics overview | Admin, data present | GET `/admin/analytics/overview?academic_year=…&semester=…` | period | HTTP 200 with aggregates; stipend summary per TC-STIP-028 |  |  |
| TC-ANL-002 | P3 | [H] Analytics periods | Admin | GET `/admin/analytics/periods` | — | Available AY/semester periods |  |  |
| TC-ANL-003 | P1 | [H] Audit trail covers every change | Actions performed | GET `/admin/audit-logs` | — | Entries with before/after values and actor for: application steps, interviews, assignments, clock-in/out, narratives, verifications, bonus/required hours, QR regeneration, profile/photo/signature/password changes, deactivation (`tokens_revoked`), stub release/claim/void, promissory review, exports, duty-slip verification |  |  |
| TC-ANL-004 | P2 | [H] Admin lists load quickly with many rows | ≥ 50 applications and assignments | Load Admin → Applications and Admin → Assignments | — | Query count stays flat as rows grow (no per-row queries) |  |  |

---

## 23. Module: RBAC & Cross-Cutting Security (`TC-SEC`) — Attacker

| ID | Pri | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| TC-SEC-001 | P1 | [S] Unauthenticated access blocked | No token | Call any authed endpoint | no Authorization header | HTTP 401, "Unauthenticated." |  |  |
| TC-SEC-002 | P1 | [S] Applicant cannot reach recipient/supervisor/admin routes | Logged in as applicant | Call `/recipient/*`, `/supervisor/*`, `/admin/*` | applicant token | HTTP 403, "Forbidden. Insufficient permissions." for each |  |  |
| TC-SEC-003 | P1 | [S] Recipient cannot reach supervisor/admin routes | Recipient | Call `/supervisor/*`, `/admin/*` | recipient token | HTTP 403 |  |  |
| TC-SEC-004 | P1 | [S] Supervisor cannot reach admin routes | Supervisor | Call `/admin/*` | supervisor token | HTTP 403 |  |  |
| TC-SEC-005 | P1 | [S] Cannot access another user's document | Doc belongs to user B | GET `/documents/{id}/file` as user A | A's token, B's doc | HTTP 403, "You are not authorized to view this document." (owner, their supervisor and admin only) |  |  |
| TC-SEC-006 | P1 | [S] Cannot access another user's attendance photo or avatar | Photo of user B | GET `/attendance/{logId}/photo`, `/users/{B}/avatar` as user A | A's token | HTTP 403, "You are not authorized to view this photo." |  |  |
| TC-SEC-007 | P2 | [H] File links work via `?token=` in a new tab | Active user | Open a file URL with `?token=` | file URL + token | Served (policy still checked) |  |  |
| TC-SEC-008 | P1 | [S] Expired/invalid token rejected | Token deleted or older than 7 days | Call authed endpoint | stale token | HTTP 401 |  |  |
| TC-SEC-009 | P1 | [S] Role escalation via direct ID manipulation | Recipient | Attempt admin/supervisor actions by guessing ids | crafted requests | Blocked by role middleware + ownership checks |  |  |
| TC-SEC-010 | P2 | [S] SQL injection / XSS payloads in inputs | — | Put payloads in name, remarks, narrative, concern, officer name | `' OR 1=1 --`, `<script>alert(1)</script>`, `<img src=x onerror=alert(1)>` | Stored as text; shown escaped in the web app, the stub PDF and emails; no script runs, no SQL error |  |  |
| TC-SEC-011 | P1 | [S] Mass-assignment protection | Logged in | Send extra fields in register, profile and application requests | `role=admin`, `is_active=true`, `status=approved`, `email_verified_at` | Ignored; privileged fields not writable by the user |  |  |
| TC-SEC-012 | P2 | [S] Throttles hold under burst | — | Burst each endpoint in the Section 2 rate-limit table | rapid requests | HTTP 429 at each documented limit |  |  |
| TC-SEC-013 | P1 | [S] Deactivated user's file links stop working | User deactivated | Open `/users/{id}/avatar?token=…` with their old token | old token | HTTP 401 |  |  |
| TC-SEC-014 | P1 | [S] Removed endpoints stay removed | — | Call `/qr-codes/1`, `/qr-codes/1/view`, `POST /admin/users`, `/applicant/applications/1/status`, `/recipient/reports/weekly` | — | HTTP 404 (or 405 for `POST /admin/users`) |  |  |
| TC-SEC-015 | P1 | [S] Admin accounts are protected | Two admins | Deactivate an admin; delete an admin; delete yourself | — | HTTP 422: "Admin accounts cannot be deactivated." / "Admin accounts cannot be deleted. Deactivate the account instead." / "You cannot delete your own account." |  |  |
| TC-SEC-016 | P1 | [S] Admin protection via role change [NEEDS-CLARIFICATION] | Two admins | PUT `/admin/users/{other admin}` with `role=supervisor`, then DELETE | — | Current build allows the demotion and then the delete. Decide whether demoting an admin should be blocked or restricted |  |  |
| TC-SEC-017 | P1 | [S] Claim token never leaks | Stub released | Inspect release, list, history and slip API responses | — | `claim_token` absent from every response; only the stub PDF owner flow uses it |  |  |
| TC-SEC-018 | P2 | [S] Existence of files is not revealed [NEEDS-CLARIFICATION] | User without a signature/photo | Request `/users/{id}/signature` as an unrelated user | — | Current build answers 404 "No signature on file." before checking permission, which reveals who has no specimen |  |  |
| TC-SEC-019 | P2 | [S] Tampered step-up / unlock token | Admin | Void with another admin's unlock token | foreign token | HTTP 422 (tokens are bound to the admin who unlocked) |  |  |

---

## 24. Non-Functional Test Cases (`TC-NFR`)

| ID | Category | Test Scenario | How to Test | Expected Result | Actual | Status |
|---|---|---|---|---|---|---|
| TC-NFR-001 | Performance | Dashboard/list load time | Load admin applications & analytics with realistic data | Loads within ≤ 3 s |  |  |
| TC-NFR-002 | Performance | Attendance clock-in latency | Time the clock-in round trip on mobile data | Responds within ≤ 2 s |  |  |
| TC-NFR-003 | Scalability | Pagination under many records | Seed hundreds of logs/applications | Pagination works; no timeout / memory blow-up; per-page caps enforced |  |  |
| TC-NFR-004 | Usability | Mobile responsiveness | Open recipient attendance/scan on a phone | Layout usable; QR scanner & GPS prompts work |  |  |
| TC-NFR-005 | Compatibility | Cross-browser | Test on Chrome, Edge, Firefox, mobile Safari | Consistent behaviour |  |  |
| TC-NFR-006 | Reliability | Scheduler runs exactly once per slot | Run the web container's `schedule:work` and the cron `schedule:run` together; check `schedule:list` | `attendance:close-stale` hourly, signature reminder weekly, token pruning daily — each job fires once per slot (database lock) |  |  |
| TC-NFR-007 | Reliability | Mail outage doesn't break saves | Point MAIL at a dead server; approve, place, confirm receipt, resend verification | Every action saves and returns success; failures are logged |  |  |
| TC-NFR-008 | Availability | GPS/permission denied handling | Deny location permission in the browser | Clear, friendly error; no crash |  |  |
| TC-NFR-009 | Security | HTTPS & token handling | Inspect transport, logs and mail | HTTPS only; reset/verification/invitation links not written to production logs (mailer not `log`) |  |  |
| TC-NFR-010 | Data integrity | Duration is DB-computed | Create logs and inspect `duration_hours` | Always derived from time_in/time_out (not client-writable) |  |  |
| TC-NFR-011 | Recoverability | Failed upload rollback | Force a document/COR upload failure | No orphaned/blocking records left behind |  |  |
| TC-NFR-012 | Accessibility | Keyboard & contrast | Navigate key forms with keyboard; check contrast | Meets basic accessibility expectations |  |  |
| TC-NFR-013 | Maintainability | Automated checks on every push | Push to GitHub | GitHub Actions CI runs backend tests, type-check, build and audits; failures block the change |  |  |
| TC-NFR-014 | Data durability [NEEDS-CLARIFICATION] | Uploads survive a redeploy | Upload a document/specimen, redeploy the backend, open it | On the current free-tier disk, uploads are lost on redeploy (known); passes once storage moves to object storage |  |  |
| TC-NFR-015 | Deployment | Migrations guard data | Deploy with duplicate live stubs or active assignments in the DB | Boot stops with a message listing the duplicates; the previous version keeps serving |  |  |

---

## 25. Open Questions (NEEDS-CLARIFICATION)

| # | Topic | What the build does now | Decision needed | Cases |
|---|---|---|---|---|
| 1 | Promissory makeup deadline | Approval makes the student payable immediately; the deadline is display-only; several approved notes per assignment are possible; `lacking_hours` isn't checked against the real shortfall | Should payment wait for the makeup hours or the deadline? | TC-PROM-015 |
| 2 | Promissory with zero hours | Allowed when verified = 0 | Is a note acceptable with no hours at all? | TC-PROM-014 |
| 3 | Bank verification from the paper stub | The stub prints only the control number; the claim-token verify link/QR is never shown to anyone | Print a QR of the verify link, or retire the token? | TC-STIP-022/023 |
| 4 | Concerns inbox | Concerns are saved but nobody can read them | Build an admin inbox, or remove the feature? | TC-CON-004 |
| 5 | Semester end fallback | `semester_end_date` can only be set in the database | Add it to Settings? | TC-SET-005 |
| 6 | Admin demotion | Any admin can demote another admin, then delete them | Block or restrict demoting admins? | TC-SEC-016 |
| 7 | File existence leak | Signature/avatar return 404 before the permission check | Check permission first? | TC-SEC-018 |
| 8 | Real-time notifications | Live push is not functional | Fix or remove the real-time stack? | TC-NOTIF-006 |
| 9 | Upload durability | Free-tier disk loses uploads on redeploy | Move to object storage (R2)? | TC-NFR-014 |
| 10 | Pasted QA rule "chatbot unthrottled" | Chatbot is throttled at 20/min | None — the catalogue follows the code | TC-BOT-005 |

---

## 26. Traceability & Coverage Summary

| Module | Test Case Range | Count | Priority focus | Automated by (PHPUnit / Vitest) |
|---|---|---|---|---|
| Registration | TC-REG-001..015 | 15 | Auth integrity, validation | AuthTest |
| Email Verification | TC-EV-001..008 | 8 | Account activation | AuthTest |
| Login / Sessions | TC-AUTH-001..012 | 12 | Auth, session revocation | AuthTest, AccountStatusTest |
| Password Reset | TC-PWD-001..007 | 7 | Auth | — (manual) |
| Staff Invitations | TC-INV-001..008 | 8 | Onboarding | — (manual) |
| Applications | TC-APP-001..016 | 16 | Core workflow | DocumentTest, ResourceAccessTest, NotificationTest |
| Renewal | TC-REN-001..008 | 8 | Core workflow | — (manual) |
| Admin Review & Interviews | TC-ADMR-001..026 | 26 | State machine, interview rules | AdminTest, InterviewLifecycleTest |
| Assignments & QR | TC-ASSIGN-001..014 | 14 | Placement integrity | AdminTest, QrCodeServiceTest, AuditTrailTest |
| Profile & Account | TC-PROF-001..010 | 10 | Account mgmt | AuditTrailTest, SignatureTest |
| Signature Specimen | TC-SIG-001..009 | 9 | Clock-in gate, receipts | SignatureTest, StipendClaimTest, AttendanceTest |
| Attendance / Clock-In | TC-ATT-001..024 | 24 | Integrity, geofence | AttendanceTest, AuditTrailTest; axiosInterceptors (Vitest) |
| Clock-Out / Auto | TC-OUT-001..014 | 14 | Integrity | AttendanceTest, AuditTrailTest |
| Narrative Reports | TC-NARR-001..008 | 8 | Workflow | AttendanceTest |
| Hours | TC-HRS-001..003 | 3 | Hours | AttendanceTest |
| Promissory Notes | TC-PROM-001..015 | 15 | Money eligibility | PromissoryNoteTest |
| Verification & Students | TC-VERIF-001..019 | 19 | Integrity, hours | VerificationTest, SupervisorReportTest, AuditTrailTest |
| Stipend Claim Stubs | TC-STIP-001..031 | 31 | Money integrity | StipendClaimTest, StipendTotalsTest, SignatureTest |
| Reports & Duty Slips | TC-RPT-001..016 | 16 | Reporting, tamper-evidence | DutySlipVerifyTest, SupervisorReportTest, StipendTotalsTest; DutySlip (Vitest) |
| QR codes | TC-QR-001..006 | 6 | Security | QrCodeServiceTest |
| Chatbot / FAQ | TC-BOT-001..006 | 6 | Support, cost | ChatbotTest |
| Concerns | TC-CON-001..004 | 4 | Support | — (manual) |
| Settings | TC-SET-001..005 | 5 | Config | — (manual) |
| Notifications | TC-NOTIF-001..006 | 6 | Comms | NotificationTest |
| Analytics & Audit | TC-ANL-001..004 | 4 | Admin, traceability | StipendTotalsTest, AuditTrailTest, ListQueryCountTest |
| RBAC & Security | TC-SEC-001..019 | 19 | Security | RbacTest, ResourceAccessTest, AccountStatusTest |
| Non-Functional | TC-NFR-001..015 | 15 | Quality attributes | CI workflow (TC-NFR-013) |
| **TOTAL** | — | **328** | — | — |

---

## 27. P1 Smoke List (run first, in order)

One end-to-end pass through the money-and-integrity path. Every step must pass before the full round.

| Step | Persona | Action | Case |
|---|---|---|---|
| 1 | Visitor | Register with a `@s.msumain.edu.ph` email | TC-REG-001 |
| 2 | Visitor | Open the verification link | TC-EV-001 |
| 3 | Applicant | Log in | TC-AUTH-001 |
| 4 | Applicant | Submit an application and upload the COR | TC-APP-001, TC-APP-007 |
| 5 | Admin | Move to review, schedule an in-window interview | TC-ADMR-002, TC-ADMR-003 |
| 6 | Admin | Approve after the interview | TC-ADMR-011 |
| 7 | Admin | Assign office + supervisor | TC-ASSIGN-001 |
| 8 | Recipient | Save a signature specimen | TC-SIG-001 |
| 9 | Recipient | Clock in inside the geofence (Mon–Sat, 06:00–17:30) | TC-ATT-001 |
| 10 | Recipient | Submit the narrative, clock out with the office QR | TC-NARR-001, TC-OUT-001 |
| 11 | Supervisor | Verify the log | TC-VERIF-001 |
| 12 | Admin | Release the claim stub (step-up) once hours are met | TC-STIP-004 |
| 13 | Recipient | Download the stub PDF | TC-STIP-017 |
| 14 | Banking Office | Verify the claim token | TC-STIP-022 |
| 15 | Recipient | Confirm receipt | TC-STIP-019 |
| 16 | Banking Office | Re-check the same token → 404 | TC-STIP-023 |
| 17 | Attacker | Deactivated token refused; tampered QR refused; removed endpoints 404 | TC-AUTH-009, TC-ATT-003, TC-SEC-014 |

---

## 28. Suggested test execution rounds

1. **Smoke round (P1 only):** the list in Section 27.
2. **Full functional round (P1+P2):** every module, `[H]` + `[N]` + `[B]`.
3. **Security round:** every `[S]` case, all `TC-SEC-*`, QR tamper, rate limits, the RBAC matrix.
4. **Non-functional round:** performance, mobile, scheduler, mail outage, recoverability.
5. **Regression round:** re-run the failed + fixed cases each build (CI covers the automated ones on every push).

> **Tip for defense:** map each capstone objective/feature to its `TC-*` IDs in an appendix so panelists can see every claimed feature has explicit test coverage. Cases marked **[KNOWN GAP]** or **[NEEDS-CLARIFICATION]** are honest findings — present them as such.
