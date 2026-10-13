# Submission readiness — 13 October 2026

## Scope verified against the official 37-page wallet task

This submission implements a backend-driven wallet and withdrawal workflow on the intern's own development database. It is not connected to VELOop production or a real payout bank account.

The live application exposes login/register, wallet/dashboard and payout. Simulated payment/reward sections, Buy VEs navigation, mining and staking previews are removed. Simulation endpoints are no longer registered. Historical isolated simulation records are not promoted to spendable balances.

## Required functionality

| Requirement | Implementation |
| --- | --- |
| JWT authentication and own-wallet access | Authentication middleware, database user status and role checks |
| Five wallet currencies | Wallet model and protected admin credit/debit for VES, SVES, GEMS, TOKENS, SPINS |
| Ledger for every mutation | WalletTransaction with balanceBefore/balanceAfter, direction, source and reference |
| Atomicity | Conditional debit plus MongoDB transaction for wallet, ledger, withdrawal and audit |
| Payout configuration | PayoutOption records; eight assignment UPI denominations stored in database |
| Withdrawal lifecycle | PENDING, PROCESSING, APPROVED, REJECTED, CANCELLED; reversal on rejection/cancellation |
| Duplicate/concurrent protection | Unique user/idempotency key, request fingerprint and conditional balance mutation |
| Validation, rate limiting, errors | Protected routes, bounded inputs, role checks, safe errors |
| Admin/internal operations | Protected credit/debit and withdrawal process/approve/reject APIs; full admin UI is not required |
| Frontend | Backend balances/transactions/options, confirmation, pending receipt, loading/error states, refresh |
| Deliverables | README, API/architecture/test documents, Postman collection and env examples |

## Evaluator account

The PDF requires seeded assessment data. Optional ASSESSMENT_REVIEW_* configuration creates a USER-only evaluator account in the explicitly named development database. It does not modify existing accounts or reset balances on restarts. It uses the wallet service in a transaction to create eight ledger rows and audit records.

Opening balances: 25,000 VEs; 5,000 SVEs; 100 Gems; 500 Tokens; 3 Spins. These are clearly recorded as assessment seed data, not actual ad/referral income or bank money. The seed password is supplied privately through environment variables and is never committed.

## Current limits

- External bank settlement is not part of the verified workflow. A UPI request creates a persisted pending withdrawal and wallet deduction; processing/approval/rejection is administered through protected APIs.
- Google login remains an optional integration requiring successful provider-side verification. It is hidden by default with VITE_GOOGLE_SIGN_IN_ENABLED=false. Email/password JWT login is the submission authentication flow.
- Only UPI denominations are provided by the assignment. Other payout types must be configured from confirmed platform values before enabling them.
- The PDF does not define exchange rates, mining yield, spin rewards or staking rules. No production earning rules have been invented.
- Seeded values are exclusively for the independent assessment database. New ordinary users start at zero until a legitimate internal/admin reward is credited.

## Verification

- Required wallet scenarios and additional tests execute against veloop_wallet_test.
- Frontend production build passed after simulation removal.
- Frontend and backend npm audits reported zero vulnerabilities after dependency fixes.
- Backend lockfile repaired for reproducible installation.
- Node built-in watch mode replaces the development-only vulnerable nodemon dependency.

Final local integration result: 30 passed, 0 failed, 0 skipped.

Final local result: 30 tests passed, 0 failed, 0 skipped. Both package audits reported 0 vulnerabilities. Production frontend build passed. Hosted verification follows the deployment.


## Hosted verification
Commit 7634f203d80a963f91d26ae323b619e891557117 deployed successfully on Render. Verified MongoDB development connection, healthy API, authenticated wallet loading, all eight UPI options, no simulator sections or mining/staking previews, and zero-balance withdrawal guard. Unauthenticated wallet and payout endpoints return 401. No bank settlement or Google login is claimed. The optional evaluator initializer is implemented and locally tested; it is not enabled on the hosted service. A later build uses an explicit package-prefix script, Node 24 and a pinned patched source-map-js override. The clean npm ci variant failed on the host; that variant is not the active build configuration.


## Final live checks
Render deployment of d8b73484751accb2dc9d40e1066e12804c3aad26 succeeded and is Live. Hosted frontend and backend installs both reported 0 vulnerabilities. Verified signup and password login using dedicated zero-balance QA users, JWT own-wallet access, all eight database-backed UPI options, invalid-option rejection, and rejection of insufficient balance even with forged client amounts/currency/balance. Both rejected requests left all wallet currencies unchanged. Authenticated simulation endpoint returns 404. Existing signed-in users visiting /login are redirected to /dashboard. Normal funded withdrawal, duplicate/concurrent requests and rejection/cancellation reversal are covered by the local integration suite; no external bank payout has been executed. The evaluator initializer is optional and remains disabled on the host.
