# Digital Stipend Claim — Design Proposal

> Feature design for digitizing the 3-part paper claim stub (Acknowledgment Receipt →
> Banking Office, Return Slip → DSA, Receiving Slip → student), built to plug into the
> existing SWAP Portal conventions.
>
> **Date:** 2026-09-21. Written for the developer who will implement this and the product
> owner who will approve scope. References to `docs/SYSTEM_OVERVIEW.md` use its section
> numbers (§4, §11.3, …).

## Verified starting point (read from the code)

- `stipend_history.status` is a plain **`varchar(20)`**, not a Postgres enum — new status
  values need **no enum migration**.
- `StipendService::release()` jumps **straight to `released`** and fires the notification;
  there is **no claim lifecycle**.
- Eligibility is deduped **per semester** (`user_id|academic_year|semester`), while the paper
  stub is **monthly** ("month of February").
- Code default amount is **₱1,500** (`DEFAULT_STIPEND_AMOUNT`); the stub says **₱1,000**.
- `StipendService` accesses models **directly** (no repository), which is looser than the
  interface-binding convention in §4 — flagged below.

---

## Gaps: what exists vs. what this adds

| Already covered | Where | This feature adds |
|---|---|---|
| Eligibility (verified ≥ required) | `StipendService::eligibleRecipients()` | A **claim lifecycle** (certify → available → claimed) replacing one-shot `released` |
| A stipend record (amount, period, released_by/at, remarks) | `stipend_history`, `StipendHistory` | A **control number + claim token (QR)**, certification & receipt timestamps, slip PDF path |
| Admin release + audit + mail/db/broadcast | `release()`, `StipendReleased`, `StipendReleasedNotification` | An **"allowance available" email** distinct from "released/received" |
| Recipient stipend history view | `ReportController::stipendHistory`, `/recipient/stipend` | The **3-part digital stub** (Acknowledgment / Return / Receiving) as artifacts |
| Client-side print (duty slips) | `components/attendance/DutySlip.tsx` | **Server-side PDF** generation + archival for the slip |
| — | — | **Receipt confirmation** (student + releasing officer) with **signatures** |
| — | — | **Banking Office hand-off** (no such role today) via tokenized verification |

---

## 1. End-to-end flow

```
STEP  ACTOR      TRIGGER                          ACTION
────  ─────      ───────                          ──────
 1    system     supervisor verifies a log        verified hours accrue (existing)
 2    admin      opens release cycle (period)     GET /admin/stipend/eligible → eligible list
 3    admin      certifies a beneficiary          POST /admin/stipend/{id}/certify
      (DSA)                                        → status pending→CERTIFIED
                                                   → mint control_number + claim_token(QR)
                                                   → capture DSA signature(s)
                                                   → render + archive slip PDF (object storage)
                                                   → audit-log; fire StipendAvailable
      ─────────────────────────────────────────────────────────────────────────────────
 4    system     certification committed          Gmail + in-app to student:
                                                   "Allowance ready to claim — control no. ####"
 5    recipient  opens portal / email             GET /recipient/stipend/{id}/slip (view/download)
 6    recipient  presents QR/control no. at UBO    Banking Office verifies:
      + UBO                                        GET /stipend/verify/{claim_token}
                                                   → certified? unclaimed? whose? amount?
 7    UBO        pays the student                  (external disbursement)
 8    recipient  confirms receipt                  POST /recipient/stipend/{id}/confirm-receipt
      (+officer)                                   → beneficiary + releasing-officer signatures
                                                   → status CERTIFIED→CLAIMED
                                                   → claim_token consumed (single-use)
                                                   → audit-log; fire StipendReleased (=received)
 9    system     receipt committed                Gmail: "Stipend received — Receiving Slip attached"
                                                   DSA dashboard shows claim closed
```

**Void path** (any time before claim): `POST /admin/stipend/{id}/void` → status `VOID`, token
invalidated, audit-logged.

**Status state machine (varchar — no enum migration):**
`pending → certified → claimed`, with `void` terminal. Keep the string `released` only as a
read-time legacy value for pre-existing rows; new code uses `certified` / `claimed`.

---

## 2. Where it fits in the code

**Services**
- New `StipendClaimService` (keep `StipendService` for eligibility/history). Methods:
  `certify(StipendHistory, array, User $admin)`, `confirmReceipt(StipendHistory, array, User)`,
  `void(StipendHistory, string $reason, User)`. Each audit-logs via `AuditLog::record(...)`
  like `release()` does.
- New `StipendClaimRepositoryInterface` → `StipendClaimRepository`, bound in
  `AppServiceProvider::register()` (per the §4 interface-binding convention). *Note:
  `StipendService` hits models directly, so this is stricter than local style — decide whether
  to match global (repository) or local (direct) convention.*
- New `SlipPdfService` (a.k.a. `StipendSlipRenderer`) — renders the 3-copy PDF. Needs a PDF lib
  (`barryvdh/laravel-dompdf`, new composer dep); only client-side print exists today.

**Controllers (thin, FormRequest → Service)**
- Extend `Admin\StipendController`: `certify()`, `void()`. *(While here, migrate the existing
  inline `validate()` in `release()` to a `ReleaseStipendRequest` to match the FormRequest
  convention.)*
- New `Recipient\StipendClaimController`: `slip()` (download), `confirmReceipt()`.
- Banking-Office verify: `Shared\StipendVerifyController::show()` (token-gated).

**FormRequests:** `CertifyStipendRequest`, `ConfirmStipendReceiptRequest`,
`ReleaseStipendRequest`, `VoidStipendRequest`.

**Routes (`routes/api.php`)**
```
admin:      POST /admin/stipend/{id}/certify
            POST /admin/stipend/{id}/void
recipient:  GET  /recipient/stipend/{id}/slip
            POST /recipient/stipend/{id}/confirm-receipt
public:     GET  /stipend/verify/{claim_token}   // token-gated, like DocumentFileController ?token=
```
Keep existing `/admin/stipend`, `/eligible`, `/release` (or repoint `/release` → certify).

**Resources / types**
- Extend `StipendResource` with `control_number`, `status`, `certified_at`, `claimed_at`,
  `slip_url`, `signatures[]`.
- Mirror in `swap-frontend/types/stipend.types.ts` (hand-mirror rule, §4 / §11.3).

---

## 3. The 3-part stub, digitally

**One record, three renderings — not three records.** A single `stipend_history` row is the
claim; the three "parts" are role-scoped views plus one archived PDF:

- **Acknowledgment Receipt** → the *authorization-to-pay*. Banking Office does **not** hold
  paper; they confirm the **control number / QR** via `GET /stipend/verify/{claim_token}`.
  Carries the DSA certification signatures.
- **Return Slip** → the *DSA copy*: the system record + archived PDF (object storage) is the
  DSA's authoritative retention.
- **Receiving Slip** → the *student copy*: the same receipt data, emailed as PDF and
  downloadable from `/recipient/stipend/{id}/slip`.

Return Slip and Receiving Slip are the **same event** (money received) rendered for two parties
→ one record, two copies. Acknowledgment is the **earlier** event (certification).

**Banking Office — recommendation:** **do NOT add a full role yet.** Ship a **tokenized verify
artifact** (QR/control-number → token-gated verify page, reusing the existing `?token=` serving
pattern) and have the **DSA/admin record receipt** when the signed slip returns. Add a minimal
`banking_officer` role **later** only if UBO adopts the portal. Rationale: an org-facing role is
a change-management cost that shouldn't block digitizing the DSA side; the verify token already
closes the forgery gap.

---

## 4. Signing mechanism

**Options**
- **(a) Authenticated confirmation + audit log** — a logged-in user clicks "Certify" /
  "Confirm receipt"; identity from Sanctum, attribution + non-repudiation from `AuditLog`.
- **(b) Drawn/uploaded signature image** — familiar, but the image binds to nothing on its own.
- **(c) 3rd-party e-signature provider** — vendor cost + dependency; overkill for an internal
  flow and against the free-tier / self-hosted posture.

**Recommendation: (a) as the source of truth, + (b) as a rendered image on the PDF for human
familiarity, + step-up auth on the two money-critical actions** (Director certify, student
receipt) — re-enter password or an emailed OTP. In this stack an authenticated, audit-logged
action is stronger and cheaper than an ink scrawl, and it is already how the app establishes
identity.

- **Storage:** signature images and slip PDFs → **object storage (R2/S3)**, path recorded on
  the signatures row. Same ephemeral-disk problem as audit item R1 — receipts you legally cannot
  lose must not sit on Render's disposable disk.
- **Re-sign / revoke:** before claim → `void` (status `void`, reason, audit) and **re-certify**
  issues a *new* control number + token (old token invalidated, single-use). After claim → never
  mutate a paid record; post a **reversing entry** (accounting practice), audit-linked.

New table `stipend_signatures`: `id, stipend_history_id (FK), signatory_role
(chairperson|director|beneficiary|releasing_officer), user_id (nullable FK), printed_name,
method (authenticated|drawn), signature_image_path (nullable), signed_at, remarks, timestamps`.

---

## 5. Data-model + notification changes

**New migration** `..._add_claim_lifecycle_to_stipend_history` (never edit the existing one):
`control_number (string, unique, nullable)`, `claim_token (string, unique, nullable)`,
`certified_by (FK users, nullable)`, `certified_at`, `claimed_at`, `receipt_signed_at`,
`releasing_officer_name (string, nullable)`, `slip_path (string, nullable)`, `voided_at`,
`void_reason (string, nullable)`. Unique indexes on `control_number`, `claim_token`.

**New migration** `..._create_stipend_signatures_table` (schema above).

**Statuses (varchar, no enum change):** add `certified`, `claimed`, `void`; retain `pending`;
treat legacy `released` as read-only.

**Notifications**
- **NEW `StipendAvailableNotification`** (fires on `certify`), via `mail` + `database`:
  - **Subject:** Your SWAP Stipend Is Ready to Claim
  - Dear {name}, your SWAP allowance of ₱{amount} for {period_label} has been **approved and is
    available for release**. Present your digital claim slip (**Control No. {control_number}**)
    at the University Banking Office to claim it. — *Action:* "View / Download Claim Slip" →
    `/recipient/stipend/{id}`.
- **Repurpose `StipendReleasedNotification`** to fire on `claimed` (receipt confirmed), reworded
  from "has been released / coordinate with DSA" to:
  - **Subject:** SWAP Stipend Received
  - Your SWAP stipend of ₱{amount} for {period_label} has been **released and received**. Your
    Receiving Slip is attached for your records.

The distinction the PO asked for: **"available" = certified, claimable** (new email at step 4);
**"released" = actually received** (confirmation email at step 9).

---

## Assumptions
1. **Cadence is moving to monthly** (stub says "month of February"), even though code dedupes
   per-semester today — `period_label` carries the month.
2. **Amount is admin-set at certify** (stub ₱1,000 vs code default ₱1,500 — treated as a display
   default; admin overrides).
3. **Banking Office stays external** initially; student physically claims; receipt recorded via
   token verify + admin/student confirmation.
4. **Students authenticate with the existing portal login** for receipt confirmation (own phone
   or a DSA/UBO device).
5. **Server-side PDF** via a new dep (`laravel-dompdf`) and **object storage** for slips /
   signatures (depends on the R2 migration from the audit, item R1).

## Follow-up questions for the product owner
1. **Cadence & amount:** monthly ₱1,000 (per the stub) or per-semester (per current code)?
   Fixed amount or per-student?
2. **Banking Office:** will UBO log into the system (needs a role) or remain fully external (pay
   against a presented slip, DSA records receipt afterward)? Decides whether the role is built
   now or just the verify token.
3. **Signature legality:** does the university / **COA** accept an authenticated, audit-logged
   in-system confirmation as a valid disbursement signature, or is a wet signature / specific
   e-sign standard still required — i.e., does digital *replace* paper, or run *parallel* to it
   initially?
