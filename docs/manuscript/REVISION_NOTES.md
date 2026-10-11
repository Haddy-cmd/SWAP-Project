# Revision Notes: Chapters 1–3 (revised October 2026)

What changed between the December 2025 draft of *Digital Monitoring and Application System for
Student Welfare Assistantship Program in MSU Marawi* (Ch. 1–3) and the revised version in this folder.
The revised chapters were checked against the built system (`swap-backend/`, `swap-frontend/`) on
11 October 2026. This completes the checklist in `docs/MANUSCRIPT_REVISION_GUIDE.md`.

## Files

| File | What it is |
|---|---|
| `MANUSCRIPT_CH1-3_REVISED.docx` | The revised Chapters 1–3, ready to edit: A4, Times New Roman 12, 1.5 spacing, title page, Table of Contents, List of Figures and List of Tables with page numbers, and references. |
| `MANUSCRIPT_CH1-3_REVISED.md` | The same text in Markdown, for reading or comparing. |
| `figures/*.png` | The five redrawn figures, ready to insert (2.13, 3.4, 3.8, 3.9, 3.10). |
| `figures/*.mmd` | Their Mermaid sources. Edit one and paste it into https://mermaid.live to export a new PNG or SVG. |

**Using the Word file**
- If Word asks to update fields when it opens, click **Yes**. That refreshes the page numbers in the Table of Contents and the lists.
- After you insert the figures, refresh again: right-click each list, then **Update Field → Update entire table**.
- Each figure has a dashed box saying what goes there. Paste the image into the box's place and delete the box.
- The screenshots of the related systems, the organizational chart, the existing workflow, the Agile diagram and the empathy maps are unchanged. Copy them from the December 2025 draft.
- Make further edits in Word. The Markdown copy will not update itself.

## Decisions applied

- **Who SWAP serves.** The draft said "handicapped students". The system has no such restriction, so the text now says "students in financial need".
- **Timeline.** The planned dates were kept (September 2025 – June 2026). The Gantt chart gained rows for the modules that were built.
- **Four roles everywhere.** Student Applicant, SWAP Recipient, Office Supervisor (SWAP Mentor) and DSA Administrator. Office supervisors, not DSA staff, verify the hours.
- **Stipend scope.** The system determines eligibility, records the release and produces the signed stub. Cash or bank disbursement and payroll remain outside it. This replaces the draft's contradiction between §1.4 and HIPO 5.3, "Generate Payroll".
- **Technology.** Laravel 12 (PHP 8.2), Next.js 15 / React 19 (TypeScript) and PostgreSQL 17, replacing "MySQL" and "JavaScript, PHP". Hosting is Vercel and Render, files are on Cloudflare R2, email goes through Brevo, and the chatbot uses Google Gemini.
- **Notifications.** Email and in-app only. All mentions of SMS were removed.

## Changes by section

### Chapter 1
- **Intro:** "students in financial need". The paragraph now describes the full digital cycle the system covers.
- **§1.1:** describes what each user group does in the system; the planned timeline is kept.
- **§1.2:** describes the four roles correctly; supervisors verify hours.
- **§1.3:** Objective 2 names the four roles. Objective 3 lists the modules that were built. Objective 4 states Alpha testing (test cases + automated tests) and Beta testing (SUS), and §3.4 now describes both.
- **§1.4 Scope:** rewritten as the full feature list.
- **§1.4 Limitations:** new: internet required, smartphone with camera and GPS, Monday–Saturday 6:00 AM–5:30 PM inside the geofence, institutional email only, no SMS, disbursement outside the system.
- **§1.5:** adds Office Supervisors and Future Researchers; "digital verification replaces manual signing".
- **§1.6:** alphabetical, with about 35 terms. Added: geofence, office QR code, selfie, Task Description, end-of-term report, term result, promissory note, renewal, stipend stub, e-signature, email verification code, trusted browser, audit log and others. Removed: "Monthly/Semestral Report", replaced by "Reports and Analytics" and "Duty Slip".

### Chapter 2
- **§2.1:** new sections 2.1.3 Geofencing, 2.1.4 QR Code-Based Attendance, 2.1.7 AI Chatbots and 2.1.8 Electronic Signatures. §2.1.6 (DBMS) names PostgreSQL. §2.1.9 (Student Assistantship) now cites a real source; see References.
- **§2.2:** texts lightly edited. Figure captions fixed:
  - 2.9 is the WEB-IMS Internship Application Record;
  - 2.10 is the WEB-IMS Internship Hours Configuration;
  - 2.11 is the DSA Organizational Structure (it was wrongly captioned "Classlist Management module").
- **§2.4 Table 2.1:**
  - "Advanced Verification" is defined in a note under the table.
  - New rows: GPS Geofencing, Selfie Proof of Presence, Email Verification Codes, E-Signed Stipend Stub, Renewal and Promissory Notes.
- **§2.5:**
  - Program name fixed ("Weflare" / "Welfare and Assistantship" / "Affair").
  - The "swap requests" paragraph was rewritten.
  - The "population of about 10,000" figure was removed (see *You must verify*).
- **§2.6.2:** the proposed workflow is rewritten for four lanes: interview scheduling, QR + geofence + selfie, supervisor verification, end-of-term report, promissory note, stipend release and renewal.

### Chapter 3
- **Intro:** the Agile/Scrum text is kept; the sprint wording is clarified.
- **§3.1.1:** figure references fixed (the second map is Figure 3.3); the "student applicants a," typo removed.
- **Table 3.1:** rebuilt.
  - The two conflicting notification rows are now one Mandatory row, and the blank row is gone.
  - Requirements added: email codes, staff invitations, interviews, offices/QR/geofence, auto clock-out, the Task Description, the end-of-term report, term results, promissory notes, renewal, stipend release, announcements, concerns, reports and the audit log.
  - The security, integrity, file-upload and time-zone non-functional requirements are more specific.
- **Table 3.2 (Gantt):** planned dates kept; rows added for the built modules; "Assess Testing" renamed "Alpha and Beta Testing".
- **§3.2.1 HIPO:** now seven modules, as in the new Figure 3.4. "Payroll" was removed.
- **§3.2.2 IPO:** Figures 3.5–3.7 are now drawn as Input/Process/Output tables inside the Word file:
  - account creation with the email code;
  - time computation with QR, GPS, selfie and supervisor verification;
  - on-demand reports with PDF and CSV, which are not archived.
- **§3.2.3:** use cases per role; verification is moved to the Supervisor.
- **§3.2.4:** the ERD now uses the real tables (`users`, `student_profiles`, `assignments`, `time_logs` and so on).
- **§3.2.5:** the actual architecture.
- **Tables 3.3–3.6:**
  - the real software stack;
  - "ROM" changed to Storage, and RAM is spelled out as Random Access Memory;
  - smartphone requirements and minimum browser versions added (Chrome/Edge 111, Safari 16.4, Firefox 128);
  - the developer minimum raised to 8 GB RAM for running Laravel and Next.js together.
- **§3.4:**
  - split into 3.4.1 Alpha Testing (608 documented test cases, 419 back-end and 81 front-end automated tests at the time of writing) and 3.4.2 Beta Testing;
  - office supervisors are a separate respondent group;
  - task scenarios are given per group;
  - new Table 3.7 lists the ten SUS statements, with the scoring formula and interpretation.
- **Front matter:** the Table of Contents and both lists are regenerated with correct numbering (the draft skipped 3.2.1, 3.2.3, 3.3 and 3.3.1).

## References

The reference list is renumbered in order of first citation (IEEE style); every entry is now cited in the text.

- **Replaced the old [7]** (Jazaei et al., about microplastics and soil-water dynamics, which is unrelated). The new source:
  - R. P. Daroy, "Student Assistance Program (SAP) among private higher education institutions (HEIs)," *JPAIR Multidisciplinary Research*, vol. 17, no. 1, pp. 31–45, 2014, doi:10.7719/jpair.v17i1.279.
- **Merged** the duplicate OIMMS entries (old [9] and [20]).
- **Fixed old [11]:** "University of thr Philippines" changed to Lyceum of the Philippines University–Cavite.
- **Corrected formatting:**
  - article titles and journal names were swapped in several entries;
  - typos fixed ("ournal", "Jouranl", "vol. volume 3, no. issue 1", "toMeasure");
  - "A. d. Plessis" changed to "A. du Plessis";
  - Sommerville's edition added.
- **Added:**
  - A. A. Che Fauzi et al., TECH-CLASS geofencing attendance (2025), doi:10.24191/jmcs.v11i2.9707;
  - ISO/IEC 18004:2015 (QR codes);
  - Republic Act No. 8792, Electronic Commerce Act of 2000 (e-signatures);
  - Brooke (1996), *SUS*;
  - Sauro (2011), *A Practical Guide to the SUS*;
  - Bangor, Kortum & Miller (2009), SUS adjective ratings.

## You must verify

1. **Reference for §2.1.9.**
   - Read Daroy (2014) and confirm it supports the sentence in §2.1.9, which comes from the paper's abstract.
   - Read Che Fauzi et al. (2025) for §2.1.3 the same way.
2. **Sources already in your draft, now cited for specific claims.** Confirm each source says what the sentence attributes to it:
   - [Future Systems] and [Omoniyi] in §2.1.2;
   - [Marantika] in §2.1.1;
   - [Obenza et al.] in §2.1.7;
   - [Bayaga] and [Wahyuningsih] in §3.4.4.
3. **Reference details you supplied.**
   - Some entries lack a volume or issue (Richtmann, Owolabi, Nasution, Marantika, Orjiakor, Rinawiyanti, Netinant, Rahaman); complete them if you can.
   - "A. O. B. and O. Omoniyi" looks like a garbled author list.
   - Confirm the year (2024) for Bayaga & du Plessis.
4. **SWAP's purpose.** Confirm with the DSA that "students in financial need" matches the program's official description.
5. **§2.5:** the yearly intake ("hundreds of students") and any population figure you want to keep.
6. **Table 2.1:**
   - the ✗ marks for the other four systems in the new rows are based on how your draft describes them; check them against each paper;
   - the original rows were kept as you had them.
7. **Gantt chart (Table 3.2):** the planned dates are kept as decided. The added modules were fitted into that window, so adjust the bars if your adviser wants the actual development dates instead.
8. **Title page:** the date still reads December 2025 and "A Capstone Project 1". Update both for the next submission if needed.
9. **Test counts in §3.4.1** (608 test cases, 419 + 81 automated tests). These change as the system changes, so update them before submitting.
