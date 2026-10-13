# Wallet assessment QA — 13 October 2026

## Automated result

37 integration tests passed, 0 failed, 0 skipped after the concurrent duplicate fix. Tests exercise real Express/Mongoose operations in the separate local `veloop_wallet_test` replica-set database.

| Assignment condition | Result |
| --- | --- |
| Normal authorized credit and matching ledger | PASS |
| Normal withdrawal using database VE cost | PASS |
| Insufficient balance without mutation | PASS |
| Duplicate/double-click protection | PASS |
| Concurrent distinct withdrawals without overspending | PASS |
| Invalid payout option | PASS |
| Cross-user wallet/withdrawal protection | PASS |
| Rejection and one-time reversal | PASS |
| Frontend amount/currency/payout manipulation | PASS |

Additional verified cases include all five currency credits/debits and audit logs; transaction rollback; expired/invalid/missing JWT; password login; registration role escalation prevention; terminal status transitions; cancellation; idempotency-key fingerprint conflicts; user-scoped ledger pagination; local HTTP 429 rate limiting; encrypted payout details; streak repeat/concurrency/milestone behavior; safe one-time assessment seeding.

## Defect found and fixed

Two simultaneous identical requests could return one successful withdrawal and one insufficient-balance error when the first request spent all remaining VEs. The balance and ledger stayed safe, but the duplicate response was incorrect. After an aborted transaction with a balance-validation error, the service now resolves a committed withdrawal using the same user-scoped idempotency key and request fingerprint. The new regression test verifies one withdrawal ID, one debit and zero remaining VEs for both responses.

## Payout button

The live account had 0 VEs while the selected database option required 2,400 VEs for INR 10. Disabling submission is correct. Changes add a refresh action directly on the payout page, exact VE shortfall text, a safe disabled state after balance-load errors, and explicit on-page review/confirmation.

No client balance override or fabricated live credit was added. Normal new members start at zero until an authorized reward is credited.

## UI verification

The final production React build passed. A separate loopback-only QA server uses `veloop_ui_qa_test` and assessment ledger fixtures. Password login navigated to dashboard; all five seeded balances and eight opening ledger rows loaded; the INR 10 redemption button enabled for the 25,000 VE account. Completion of the updated on-page confirmation flow is recorded after browser verification.

## Limits

- Google provider sign-in remains unverified and hidden by default. Invalid Google tokens are rejected by the backend test.
- Optional provider tests use mocked sandbox responses. They do not verify a real Razorpay payout or bank settlement.
- Seeded QA values exist only in isolated assessment databases and are not income or bank funds.
- No claim of real UPI settlement is made; the required workflow creates a pending request and ledger debit for internal review.
