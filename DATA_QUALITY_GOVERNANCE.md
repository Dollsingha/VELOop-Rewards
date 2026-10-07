# Wallet Data Quality & Governance

## Scope and accuracy

This document applies to the VELOop Rewards Wallet & Payout assessment in this repository. It adapts the data-quality and governance approach to the wallet's implemented data flow. It is not a Data Analytics assignment, and this project does not contain a production analytics pipeline, raw-data layer, dashboard warehouse, or confirmed VELOop production controls. Controls marked **Implemented in this assessment** describe repository behavior only. Controls marked **Proposed** are future work.

## Wallet data flow

```text
Browser request
  → Express route and request validation
  → JWT identity and authorization
  → wallet / payout service rules
  → MongoDB transaction
      ├─ Wallet balance
      ├─ append-only WalletTransaction ledger
      ├─ Withdrawal state
      └─ AuditLog event
  → response with user-safe fields
```

MongoDB is the source of truth for balances, payout configuration, withdrawals, and ledger history. A client must not choose the wallet owner, spendable balance, currency conversion, or configured payout requirement. The backend resolves the authenticated user and reads the active payout option from MongoDB.

## Current controls and gaps

| Risk / quality dimension | Control or check | Assessment status | Failure handling |
| --- | --- | --- | --- |
| Wrong-user access | Protected routes derive identity from a verified JWT; wallet and withdrawal queries are scoped to that user. | Implemented in this assessment | Reject unauthenticated requests and return not-found for inaccessible withdrawal records. |
| Invalid or manipulated values | Request validators and service-level checks validate IDs, methods, pagination, positive integer amounts, and payout details. Withdrawal amounts/currency/value come from the active database option. | Implemented in this assessment | Return a client-safe validation response; do not apply a wallet mutation. |
| Duplicate ledger identity | Wallet transaction IDs are unique; each record stores currency, direction, amount, balance before/after, source, reference, and timestamps. | Implemented in this assessment | Database uniqueness prevents duplicate transaction IDs. |
| Negative or stale balance | Conditional MongoDB wallet updates enforce sufficient balance at mutation time; wallet and ledger are written in a transaction. | Implemented in this assessment | Abort the transaction and report insufficient balance without creating a withdrawal. |
| Duplicate withdrawal request | An idempotency key is unique per user; a canonical request fingerprint detects a key reused with different details. | Implemented in this assessment | Return the original matching request or reject conflicting key reuse. |
| Concurrent withdrawals | Atomic conditional debits and transaction handling prevent two requests from spending the same unavailable balance. | Implemented in this assessment | One transaction succeeds; the other fails or retries safely under MongoDB transaction semantics. |
| Rejection or cancellation | The status transition and compensating credit/ledger record occur in a MongoDB transaction. | Implemented in this assessment | Invalid transitions fail; a reversal is recorded exactly with the state change. |
| Sensitive payout details | Payout details are validated against the selected option, encrypted at rest, and removed from ordinary user responses. | Implemented in this assessment | Do not return secret fields to normal wallet endpoints. |
| Operational traceability | Wallet/admin and withdrawal lifecycle actions create audit records. | Implemented in this assessment | Audit writes participate in the relevant financial transaction. |
| Request abuse | Authentication, wallet, and withdrawal routes use rate limits. | Implemented in this assessment | Requests beyond the configured limit receive a rate-limit response. |
| Balance-to-ledger drift | No scheduled reconciliation job is present. | Proposed | Compare wallet balances with ledger-derived balances; flag discrepancies for investigation and pause unsafe payouts. |
| Quality monitoring and ownership | No production alerting, named operational owner, or incident runbook is defined by this development assessment. | Proposed / needs project-owner review | Define accountable owners, alert thresholds, escalation, and a documented correction process before deployment. |
| Retention and schema evolution | No production retention schedule or migration governance is defined here. | Proposed / needs project-owner review | Define retention, access review, backup/restore, migration, and audit requirements against applicable policy. |

## Validation and review plan

The test plan in [TESTING.md](./TESTING.md) exercises credits, withdrawals, insufficient balances, duplicate and concurrent requests, invalid payout options, user isolation, rejection reversal, and client-supplied value manipulation against a dedicated test database. Run integration tests against `veloop_wallet_test`, never the development or production database.

Before any production use, add a reconciliation process and operational monitoring, establish backup/restore and retention procedures, review role access and secret rotation, and validate payout rules with the system owner. This repository intentionally has no real payout-provider integration and must not be treated as production financial infrastructure.

## Remaining work register

These are proposed follow-ups, not features represented as already delivered. They require product/operations decisions before implementation. Owners are intentionally left unassigned until the team names them.

| Priority | Work item | Next action | Completion evidence | Owner / status |
| --- | --- | --- | --- | --- |
| High, before production | Wallet-to-ledger reconciliation | Agree on reconciliation frequency and define how credits, debits, reversals, and any opening balance are compared for every currency. Start with a read-only report; corrections must be reviewed and audited. | A repeatable reconciliation run reports matched totals and creates an actionable discrepancy record without silently changing balances. | Project owner to assign / Proposed |
| High, before production | Operational monitoring and incident response | Select service metrics, error thresholds, alert recipients, and escalation steps for transaction failures, database availability, idempotency conflicts, and reconciliation mismatches. | A reviewed runbook identifies the responsible role, response steps, and evidence to retain for a simulated alert. | Project owner to assign / Proposed |
| High, before enabling real payouts | Payout review procedure | Confirm who may process, approve, reject, and investigate a request; document manual payout proof and how a rejection reversal is checked. | A reviewed procedure maps each supported state transition to an authorized action and its audit evidence. | Product/operations to assign / Proposed |
| Medium | Model and API documentation consistency | Add a review step when Mongoose schemas, validators, payout configuration, or API responses change; consider an automated contract/schema check. | The API documentation and model constraints agree for each supported endpoint and payout option, with a repeatable check or review record. | Engineering owner to assign / Proposed |
| Medium | Retention, access, and recovery policy | Confirm applicable retention and privacy rules, who may read encrypted payout details, secret rotation cadence, backup scope, and recovery targets. | Approved policy and a demonstrated restore/access review exist before production data is handled. | Security/data owner to assign / Needs decision |

### Evidence boundary

The present review is based on this repository's source code, test definitions, and development configuration. It is not a profiling audit of VELOop production or a sample production dataset; no production records were supplied for checking duplicate IDs, missing values, malformed dates, invalid values, or schema-to-documentation mismatches. The integration tests validate selected behaviors against an isolated test database. They do not establish data quality across a live analytics pipeline.

Relevant implementation evidence is in `backend/src/services/walletService.js` (conditional balance mutations, ledger before/after values, and transaction wrapper), `backend/src/services/withdrawalService.js` (payout-option lookup, request idempotency, encrypted payout details, status transitions, reversals, and audit records), `backend/src/middleware/auth.js` (JWT identity and admin role checks), `backend/src/validators/requests.js` (request validation), and `backend/tests/wallet.integration.test.js` (behavioral checks). These files demonstrate assessment behavior only; they are not proof of controls deployed in VELOop production.
