# Manuscript Revision Guide (Chapters 1–3 vs. the built SWAP Portal)

Compares *MANUSCRIPT (CHAPTER 1-3)*, December 2025, with the system in this repository
(`swap-backend/` + `swap-frontend/`, checked 2026-10-06). Use it to revise Chapters 1–3 before
you write Chapters 4–5, so the results chapters describe the same system the methodology promised.

**Priority tags**
- 🔴 **Must fix**: the paper contradicts the system, or a panel member would catch it.
- 🟡 **Should update**: the system does more or works differently; the paper is incomplete.
- 🟢 **Polish**: typos, captions, numbering, formatting.

---

## 0. Decisions to make first (they affect every chapter)

### 0.1 🔴 Pick one set of role names and use it everywhere
The manuscript uses six names for four roles. The system has exactly four:

| System role | Names the manuscript currently uses | Suggested name in the paper |
|---|---|---|
| `applicant` | Student Applicant | **Student Applicant** |
| `recipient` | SWAP Recipient / Beneficiary | **SWAP Recipient** |
| `supervisor` | Immediate Supervisor, Mentor/Coordinator, Faculty and Office Heads | **Office Supervisor (SWAP Mentor)**. The stipend stub prints "SWAP Mentor" |
| `admin` | DSA Staff | **DSA Administrator (DSA Staff)** |

Also mention that an approved applicant **becomes a Recipient as soon as they are approved**, before
an office is assigned, and that staff accounts are created **by invitation** (only students
self-register).

### 0.2 🔴 Update the technology stack throughout
| Manuscript says | System actually uses |
|---|---|
| JavaScript, PHP | **PHP 8.2 (Laravel 12)** REST API + **TypeScript (Next.js 15 / React 19)** front end |
| MySQL | **PostgreSQL** (17 locally, Render Postgres in production) |
| "Web hosting" + "Web API" (generic) | Front end on **Vercel**, API + database + scheduler on **Render** (Docker), files on **Cloudflare R2**, email through **Brevo** |
| Chatbot (unspecified) | **Google Gemini** AI answering from a FAQ knowledge base; falls back to keyword matching if Gemini is unavailable |
| Notifications via SMS | **Email + in-app notifications (bell)**. There is **no SMS** in the system |

### 0.3 🔴 Settle the stipend question (scope contradiction)
Section 1.4 says the project **excludes financial disbursements and payroll**, and HIPO 5.3 says
"Generate Payroll/Report". The system **does** handle stipend release: the admin releases the stipend
(default ₱5,000, can be changed per release) once the recipient is eligible. That creates a final
**stipend stub** with a control number and a PDF signed by the supervisor, the director and the
recipient (saved e-signatures). A release can be voided with a reason.

**Suggested wording:** "The system determines stipend eligibility, records the stipend release, and
generates the signed stipend stub. The actual cash or bank disbursement and payroll processing remain
outside the system."

### 0.4 🔴 Fix the project timeline
The paper says development would run January to June 2026. The git history shows development
**started 14 June 2026** (first commit) and continued through October 2026 (155 commits). Update
§1.1 and the Gantt chart (§3.1.3) to the real timeline, or label the chart "planned" and add an
"actual" chart.

---

## Chapter 1: Introduction

| # | Location | Issue | What to change | Priority |
|---|---|---|---|---|
| 1.1 | Intro, para 2 | "financial aid for **handicapped** students" | Check this with the DSA. The system does not restrict eligibility to students with disabilities (requirements are COR, grades, letter of intent, 2×2 photo). It may be "financially disadvantaged". | 🔴 |
| 1.2 | §1.1 | "conceptualized first semester AY 2025… completed second semester 2025-2026" | Match the real timeline (see 0.4). | 🔴 |
| 1.3 | §1.2 para 2 | Recipients "monitor… monthly report" | The recipient actually sees rendered/remaining hours, a **pace forecast**, **weekly duty slips**, a **semester service report**, stipend status and a stipend checklist. | 🟡 |
| 1.4 | §1.2 para 2 | Staff "verify, approve, and assign" | Hour verification is done by the **office supervisor**, not DSA staff. DSA staff review/interview/approve applications, assign offices and release stipends. | 🔴 |
| 1.5 | §1.3 Obj. 2 | Roles listed: Applicants, Recipients, Office Staff | Add **Office Supervisors** as a fourth role. | 🟡 |
| 1.6 | §1.3 Obj. 4 | Promises **Alpha and Beta testing** | §3.4 only describes SUS. Either describe both phases in §3.4 (see Ch. 3 below) or reword the objective. | 🔴 |
| 1.7 | §1.4 Scope | Too narrow | Add what the system covers: interview scheduling (face-to-face/online), office assignment with a supervisor, **QR + GPS geofence + selfie attendance**, Task Description at clock-out, supervisor verification, **end-of-term report**, **semester calendar and term results (Qualified/Deficient)**, **promissory notes**, **renewal**, stipend release with e-signatures, announcements, chatbot, "Ask the DSA" concerns, reports and analytics, audit logs. | 🔴 |
| 1.8 | §1.4 Limitations | Missing real limitations | Add: requires internet; clock-in needs a **smartphone with camera and GPS**; only **@s.msumain.edu.ph** emails can register; clock-in is **Mon–Sat 6:00 AM–5:30 PM** inside the office geofence; notifications are email/in-app only (no SMS); actual disbursement is outside the system (see 0.3). | 🔴 |
| 1.9 | §1.5 Faculty & Office Heads | "eliminating the need to sign physical DTRs" | Supervisors verify digitally; duty slips are still **printable from verified records**. Reword to "replacing manual signing of DTRs with digital verification". | 🟡 |
| 1.10 | §1.6 Definitions | Some terms are outdated or missing | See the list below. | 🟡 |

### 1.6 Definitions: revise / add
- **Revise "Mentor/Coordinator"** → "Office Supervisor (SWAP Mentor)" per 0.1.
- **Revise "Verification"**: done by the office supervisor; statuses: Open → Pending Verification → Verified / Rejected.
- **Revise "Time Log"**: includes GPS location, location accuracy, flag status, optional selfie, Task Description.
- **Revise "Monthly/Semestral Report"** → "Analytics & Reports": on-demand, filterable reports per role (admin: applications, recipients & hours, term results, stipend, offices; supervisor: my students, term results; recipient: my time logs, my terms), downloadable as PDF or CSV, plus duty slips and the semester service report.
- **Add:** Geofence, Office QR Code, Proof-of-Presence Selfie, Task Description, End-of-Term Narrative Report, Required Service Hours (default 200 per term), Semester Period, Term Result (Qualified / Deficient), Promissory Note, Renewal, Stipend Stub / Control Number, E-Signature (signature specimen), Announcement, Concern ("Ask the DSA"), Audit Log.

---

## Chapter 2: Review of Related Literature

| # | Location | Issue | What to change | Priority |
|---|---|---|---|---|
| 2.1 | Ref. **[7]** (used in §2.1.5 Student Assistantship) | The cited paper is about **microplastic pollution and soil-water dynamics**, which has nothing to do with assistantships | Replace with a real source on student assistantship / work-study programs. | 🔴 |
| 2.2 | Refs [9] and [20] | Same OIMMS paper cited twice | Merge into one reference and renumber. | 🟢 |
| 2.3 | Ref [11] | "University of thr Philippines" | Should be Lyceum of the Philippines University–Cavite; fix the typo and the full title. | 🟢 |
| 2.4 | Refs [13]–[19] | Listed but not cited in Ch. 1–3 | Cite them or remove them (some panels flag uncited references). | 🟢 |
| 2.5 | §2.1.4 DBMS | Generic | Name **PostgreSQL** as the DBMS used. | 🟡 |
| 2.6 | §2.1 Related Concepts | Missing concepts the system relies on | Consider adding short sections on **Geofencing / location-based attendance**, **QR-code attendance**, **AI chatbots (LLM / Gemini)** and **electronic signatures**. These are your main differentiators. | 🟡 |
| 2.7 | §2.4 Table 2.1 | "Advanced Verification" is vague; matrix misses your strongest features | Define it (GPS geofence + selfie + supervisor verification). Add rows: **GPS Geofencing**, **Selfie Proof of Presence**, **E-Signature Stipend Stub**, **Renewal & Promissory Notes**, **Email + In-app Notifications**. | 🟡 |
| 2.8 | §2.5 Technical Background | "Student **Weflare**", "Student Welfare **and** Assistantship Program", "Division of Student **Affair**" | Use one exact program name everywhere. | 🟢 |
| 2.9 | §2.5 last para | "submit and track their **swap requests**… staff… **make requests**" | Reads as if SWAP means swapping. Rewrite: "submit and track their SWAP applications online… staff review applications, schedule interviews, and assign recipients…" Notifications = email + in-app. | 🔴 |
| 2.10 | Figure captions 2.9–2.11 | Captions are shifted: Fig 2.9 shows an *Internship Application Record*, Fig 2.10 shows *Internship Hours*, **Fig 2.11 (DSA org chart) is captioned "Classlist Management module"** | Fix each caption and the List of Figures. | 🔴 |
| 2.11 | §2.6.2 Proposed Workflow (Fig 2.13) | The diagram doesn't match the system | Redraw. See the list below. | 🔴 |

### 2.6.2 Proposed Workflow: what the redrawn diagram needs
Use **four swimlanes** (Applicant, Recipient, Office Supervisor, DSA Admin), not three.

1. **Applicant:** register with institutional email + 9-digit student ID → verify email → fill the form → upload COR, grades, letter of intent, 2×2 photo → submit.
2. **DSA Admin:** review → **schedule interview** (face-to-face or online; missing from the current diagram) → approve/reject → on approval the student **becomes a Recipient** → assign office + supervisor + required hours.
3. **Recipient:** scan the office QR → **GPS geofence check (+ selfie)** → on duty → write the **Task Description** → clock out (auto clock-out if they leave the geofence or after 12 hours) → log becomes *Pending Verification*.
4. **Office Supervisor:** verify/reject logs. *(The current diagram puts this in the DSA Staff lane, which is wrong.)*
5. **End of term:** recipient submits the **end-of-term report** → supervisor **accepts it and marks the student eligible / not eligible for renewal** → the system records **Qualified / Deficient**.
6. **Short on hours:** recipient may file a **promissory note** → supervisor approves/rejects; lacking hours carry over to the next term.
7. **Stipend:** admin releases it when the hours are met (or covered by a note), the e-signature is saved and the report is in. Payment does **not** wait for the end of the semester.
8. **Renewal:** recipient applies for the next term → admin approves only if the previous term is paid/covered and the report is accepted.

Also fix the text: change "via SMS" to "email and in-app notification". Change "weekly hours are automatically summarized" to "weekly duty slips and the semester service report are generated from verified logs". Remove the `&amp;` artifacts in the diagram labels.

---

## Chapter 3: Methodology

### 3.1 Requirements gathering
| # | Location | Issue | What to change | Priority |
|---|---|---|---|---|
| 3.1 | §3.1.1 | The second empathy-map paragraph says "Figure **3.2** shows… staff and mentors" | Should be **Figure 3.3**. Also fix "student applicants **a,**". | 🟢 |
| 3.2 | Table 3.1 | Notifications appear twice with **different priorities** (Optional and Mandatory); there is an **empty row** | Merge into one Mandatory row: "email and in-app notifications". Delete the blank row. | 🔴 |
| 3.3 | Table 3.1 | Many built features are missing | Add rows for the features below. | 🟡 |
| 3.4 | Table 3.1 NFRs | Security row is thin | Add: token authentication (Laravel Sanctum), role-based route protection, **audit logging** of key actions, **password re-entry before stipend release**, rate limiting on login/public endpoints, Asia/Manila time rules. | 🟡 |

**Functional requirements to add to Table 3.1:**
email verification and institutional-email registration; password recovery; staff invitation;
interview scheduling; office management (QR code, geofence, capacity); assignment to office +
supervisor; GPS geofence and selfie check at clock-in; required Task Description at clock-out;
automatic clock-out; end-of-term report and supervisor acceptance; semester calendar and term results;
promissory notes; renewal applications; stipend release with e-signatures and a PDF stub (+ void);
printable duty slips; announcements; "Ask the DSA" concerns; reports (6 types) and analytics; audit log.

| # | Location | Issue | What to change | Priority |
|---|---|---|---|---|
| 3.5 | §3.1.3 Gantt chart | Wrong dates and missing modules | Use the real dates (from June 2026). Add rows: QR/Geofence attendance, Supervisor verification, Stipend release, Renewal & promissory notes, Chatbot, Reports & analytics, Deployment (Render/Vercel). Rename "Assess Testing" to "Alpha & Beta Testing". | 🔴 |

### 3.2 Design
| # | Location | Issue | What to change | Priority |
|---|---|---|---|---|
| 3.6 | §3.2.1 HIPO text | Says "Figure **3.5** presents the HIPO"; "five high-level modules" | Should be **Figure 3.4**. Recount the modules after updating. | 🟢 |
| 3.7 | HIPO diagram | Outdated modules | **2.0** add Email Verification, Staff Invitation. **3.0** add Interview Scheduling, Renewal. **4.0** change 4.2/4.3 to "Scan QR + Geofence/Selfie" and "Time-Out + Task Description"; add Auto Clock-out, End-of-Term Report, Promissory Note. **5.0** change "Generate **Payroll**/Report" to "Release Stipend / Generate Reports"; add Manage Offices, Semester Periods, Announcements, Audit Logs. Consider a **7.0 Communication** module (Notifications, Announcements, Chatbot, Concerns). | 🔴 |
| 3.8 | IPO Account Creation (Fig 3.5) | "username or email"; "mobile number" as contact | Login is by **institutional email only** (@s.msumain.edu.ph). Inputs also include a 9-digit student ID, first/middle/last name + full name (must match), college, program, year level; contact number is **optional**. Processes: **email verification link activates the account**; default role = Applicant. | 🔴 |
| 3.9 | IPO Time Computation (Fig 3.6) | No location/QR/selfie; verification sent to "DSA staff" | Inputs: office QR token, GPS coordinates + accuracy, selfie. Processes: geofence check, flag accuracy worse than 100 m or implausible travel, compute duration, send to the **office supervisor** for verification. | 🔴 |
| 3.10 | IPO Report (Fig 3.7) | Says reports are stored/archived with metadata | Reports are **generated on demand** and **not archived** (an audit-log entry records who exported what). Since 2026-10-06 they live in one **Analytics & Reports** feature per role: inputs = term + filters (college, office, verdict, status…) + sort + grouping; processes = filter, sort, group/total, compile; outputs = interactive table and charts, **PDF and CSV of exactly the filtered view** (with the filters printed), and an admin Overview PDF. Report types: Admin — Applications, Recipients & Hours, Term Results, Stipend, Offices; Supervisor — My Students, Term Results; Recipient — My Time Logs, My Terms. | 🔴 |
| 3.11 | Use Case (Fig 3.8) | Title says "…APPLICATION **PROGRAM**…"; DSA Staff linked to "Verify Service Hour" | Title should say **SYSTEM**. Verification belongs to the Supervisor. Add missing use cases: Schedule Interview, Manage Offices/QR, Manage Semester Periods, Release Stipend, Send Announcement, View Audit Log (Admin); Accept End-of-Term Report, Review Promissory Note, Mark Deficient (Supervisor); Submit End-of-Term Report, File Promissory Note, Apply for Renewal, Save E-Signature, Print Duty Slip, Ask the DSA (Recipient). | 🔴 |
| 3.12 | ERD (Fig 3.9) | Does not match the database | Redraw from the real tables (mapping below). The text also mentions "Weekly Report" and "staff evaluations", but the diagram shows MONTHLY_REPORT, and the evaluations were retired. | 🔴 |
| 3.13 | Architecture (Fig 3.10) | Generic boxes | Redraw: Browser/phone → HTTPS → **Next.js on Vercel** → REST/JSON → **Laravel API on Render** → **PostgreSQL**; side services: **Cloudflare R2** (files), **Brevo** (email), **Google Gemini** (chatbot), **scheduler cron** (auto clock-out, semester close, reminders). | 🔴 |

#### ERD mapping (manuscript entity → real table)
| Manuscript | System |
|---|---|
| STUDENT + DSA_STAFF | One **users** table with a `role` column + **student_profiles** (1:1) |
| ASSIGNMENT_AREA (supervisor as text) | **offices** (latitude, longitude, radius, QR secret, max recipients). The supervisor is a **user**, not a text field |
| RECIPIENT_PLACEMENT | **assignments** (recipient, office, supervisor, semester, required_hours, term_status, deficient_hours) |
| APPLICATION / REQUIREMENT | **applications** (type new/renewal, status) / **application_documents** |
| *(missing)* | **interviews** (1:1 with application) |
| TIME_LOG (narrative + verification inside it) | **time_logs** (GPS, accuracy, flagged, selfie) + separate **narrative_reports** and **verifications** |
| MONTHLY_REPORT | **weekly_reports / monthly_reports / semester_reports** |
| *(missing)* | **term_reports**, **promissory_notes**, **semester_periods**, **stipend_histories**, **stipend_signatures**, **notifications**, **announcements**, **concerns**, **faq_knowledge_base**, **audit_logs**, **staff_invitations**, **settings** |

Tip: the full ERD is large. Show the **core ~12 entities** in Figure 3.9 and put the full schema in
the appendix.

### 3.3 Development
| # | Location | Issue | What to change | Priority |
|---|---|---|---|---|
| 3.14 | Table 3.3 Developer software | MySQL, "JavaScript, PHP" | PHP 8.2 / Laravel 12; TypeScript / Next.js 15 / React 19 / Tailwind CSS 4; **PostgreSQL 17**; Composer, Node.js/npm, Git/GitHub; VS Code; hosting Render + Vercel. | 🔴 |
| 3.15 | Tables 3.3–3.6 | "Windows 10, **OS**" | Probably meant "macOS". Write "Windows 10 / macOS or later". | 🟢 |
| 3.16 | Table 3.4 User software | Desktop-only | Add: **Android/iOS smartphone** with an up-to-date browser, **camera and location permission**, internet connection. | 🔴 |
| 3.17 | Tables 3.5–3.6 | "**ROM** (Read-Only Memory) 8GB" and "RAM (**Read-Access** Memory)" | ROM → **Storage**; RAM = **Random Access Memory**. Add for users: smartphone with camera and GPS. | 🔴 |
| 3.18 | §3.2 numbering / TOC | TOC skips 3.2.1, 3.2.3, 3.3, 3.3.1 | Regenerate the Table of Contents and the Lists of Figures/Tables. | 🟢 |

### 3.4 Testing
| # | Location | Issue | What to change | Priority |
|---|---|---|---|---|
| 3.19 | §3.4 intro | Only SUS (usability) is described, but Objective 4 promises Alpha and Beta | Add **Alpha testing**: functional test cases by the developers (you already have `docs/TEST_CASES.md`) and automated tests (backend PHPUnit feature tests, frontend Vitest). Add **Beta testing**: user testing with real users followed by SUS. | 🔴 |
| 3.20 | §3.4.1 Respondents | Supervisors are lumped in with DSA staff | List **office supervisors** as their own group, since they have their own role and tasks (verify logs, accept reports, review promissory notes). | 🟡 |
| 3.21 | §3.4.2 Task scenarios | Missing core tasks | Add: scan the office QR at the actual office (geofence), write a Task Description, supervisor verifies logs, admin schedules an interview and releases a stipend. | 🟡 |
| 3.22 | §3.4.3 | No scoring method given | Add the SUS formula (odd items: score − 1; even items: 5 − score; sum × 2.5 = 0–100) and the interpretation (68 = average; adjective scale). Ch. 4 will need it. | 🟡 |
| 3.23 | Headings | "3.4.2 procedure", "3.4.3 tools (questionnaire)" | Capitalize: "Procedure", "Tools (Questionnaire)". | 🟢 |

---

## Suggested order of work
1. Make the four decisions in **Section 0** (roles, stack, stipend scope, timeline).
2. Fix the 🔴 items in Chapter 1 (scope and limitations especially), since Ch. 4–5 will be judged against them.
3. Redraw the five diagrams: **Proposed Workflow, HIPO, Use Case, ERD, Architecture**.
4. Update Tables 3.1 (requirements), 3.2 (Gantt) and 3.3–3.6 (specs).
5. Fix references ([7] first), captions, TOC and the 🟢 polish items last.
