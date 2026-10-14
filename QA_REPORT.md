# Wallet assessment QA — 14 October 2026

## Automated result

38 integration tests passed, 0 failed, 0 skipped after the final index/startup review. Tests exercise real Express/Mongoose operations in the separate local `veloop_wallet_test` replica-set database.

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

The final production React build passed. A separate loopback-only QA server uses `veloop_ui_qa_test` and assessment ledger fixtures. Password login navigated to dashboard; all five seeded balances and eight opening ledger rows loaded; the INR 10 redemption button enabled for the 25,000 VE account. The updated on-page review step displayed the database payout and VE cost before confirmation. Two independently confirmed local QA requests produced two PENDING withdrawals, each with a matching 2,400 VE debit: 25,000 → 22,600 and 22,600 → 20,200. The UI refreshed the wallet and ledger, displayed the thank-you/pending receipt, and disabled repeat submission after success. These are isolated QA fixtures, not live account credits or real bank transfers.

## Limits

- Google provider sign-in remains unverified and hidden by default. Invalid Google tokens are rejected by the backend test.
- Optional provider tests use mocked sandbox responses. They do not verify a real Razorpay payout or bank settlement.
- Seeded QA values exist only in isolated assessment databases and are not income or bank funds.
- No claim of real UPI settlement is made; the required workflow creates a pending request and ledger debit for internal review.

## Deployment
Code revision 8d364450a6d2c2803f978934848ea40b7e627b29 deployed successfully to Render. Hosted frontend/backend installs each reported zero vulnerabilities, MongoDB connected to the independent development database, and the API started successfully. Live verification passed: the zero-balance account shows “Need 2,400 more VEs”; Refresh available balance enters the loading state and then restores the authoritative balance/shortfall. The stale home-page 502 recovered after reloading the deployed site. Backend and frontend npm audits also reported 0 vulnerabilities.

## Functional access review
- Fixed the dashboard sidebar Redeem link to navigate to /payout#payout; it previously pointed at a section not rendered on /dashboard.
- Added Wallet to desktop/mobile navigation.
- Added user-owned PENDING cancellation with on-page confirmation, an in-flight guard, refreshed status and wallet/ledger refresh.
- UI QA confirmed cancellation changed PENDING to CANCELLED, credited 2,400 VEs (20,200 to 22,600), and displayed a reversal ledger row.
- Daily check-in updated the server-derived streak to one day and disabled a second same-day claim.
- Signup rejected mismatched passwords, then registered successfully with all five balances at zero.
- Logout returned to login. Visiting wallet afterward showed a sign-in gate with no balances or transaction data.
- Removed two body minimum-width rules responsible for overflow at a 320px viewport. Dashboard/payout DOM measurements passed at viewport widths 320, 768 and 1366; scrollWidth equaled clientWidth.
- Protected admin operations remain role-gated APIs; ordinary members cannot access admin credits or approval.


## Final review — 14 October 2026
The functional-access fixes were reviewed again. Production startup now explicitly creates required user, wallet, ledger, withdrawal, payout, audit, streak and daily-check-in indexes without dropping indexes or modifying records. A regression case verifies repeat initialization, unique constraints and unchanged user/balance data. Final results and deployment evidence follow the last run.


Final verification: all 38 tests passed; production frontend build passed. Revision 9df422a89170f76a0d92fbec653cade215ddb96f is Live on Render. Both hosted package installs reported 0 vulnerabilities; startup connected to the development database and served the API after required index creation. Public health returned 200; unauthenticated wallet/payout methods returned 401. Live dashboard sidebar Redeem navigated to /payout#payout; live Wallet navigation is present. At a 320px live viewport the full eight-option payout page measured scrollWidth=clientWidth=305, without horizontal overflow. Google provider sign-in and real bank settlement remain outside the verified flow.

## 14 October 2026: wallet administration without a payment gateway

- Added `/admin/wallet`, backed by existing admin-only Express endpoints. No account roles or live balances were changed.
- Production React build passed; all 38 backend integration tests passed again.
- Actual browser QA used a separate loopback-only database `veloop_admin_ui_test`. Admin credit: 0 → 3,000 VEs, with matching ledger. Member withdrawal: 3,000 → 600 VEs and PENDING request for 2,400 VEs. Admin rejection: REJECTED and one reversal, 600 → 3,000 VEs. Database read confirmed all three ledger rows.
- Ordinary member access to the admin page was rejected by the backend. Review confirmations appeared within the page. Rejected history displayed the reason and no further terminal actions.
- Admin page at 320px viewport: document clientWidth and scrollWidth both 305px (no horizontal overflow).
- Clarified member copy: internal approval is not bank settlement; buying VEs/automatic UPI transfer is not enabled.
- No real bank transaction or Google authentication was verified by this pass.

## Wallet and payout UI refinement — 14 October 2026

- Added an external, scoped `wallet-polish.css` stylesheet: readable dark cards, larger balance and transaction typography, unified actions, clear request status badges, and responsive sidebar/card layouts.
- Added prominent Redeem/Refresh actions and a native expandable wallet guide. No financial values were moved to client storage.
- Fixed section positioning after asynchronous wallet loads: direct payout navigation now places the payout heading below the sticky navigation (verified local heading top 120px, navigation bottom 76px).
- Actual browser layout measurements passed for both dashboard and payout at 320, 768 and 1366 viewport widths: clientWidth matched scrollWidth at 305, 753 and 1351 pixels.
- Visual review caught dark Pending review text in the existing summary card; the new stylesheet explicitly supplies a light foreground. Production frontend build passed. This UI pass does not verify external payment settlement or Google sign-in.

## Full regression review — 15 October 2026

- Re-ran all 38 integration tests: 38 passed, 0 failed, 0 skipped, using `veloop_wallet_test`. Intentional injected persistence failure remained a passing rollback test.
- Production frontend build passed. npm registry audit returned zero reported vulnerabilities for backend production dependencies and for the frontend dependency tree.
- Live read-only checks: health 200; unauthenticated wallet, payout methods and admin stats each 401. Owner wallet retained its explicitly requested 5,000 development VEs and labeled ledger credit; this QA did not submit a live withdrawal or alter that balance.
- Live payout UI: INR 25 / 5,800 VEs correctly disabled submission with an 800 VE shortfall; INR 10 / 2,400 VEs enabled review. Invalid UPI input prevented confirmation. All eight database-configured options appeared.
- Isolated browser checks: wrong password rejected; correct password signed in; signed-in `/login` redirected to dashboard; logout followed by wallet navigation showed the sign-in gate with no balances/history.
- Actual isolated double-click withdrawal: 22,600 → 20,200 VEs, one PENDING request/receipt. Cancellation returned 2,400 VEs.
- Found and fixed a stale receipt defect: after cancellation the wallet history changed but the receipt still displayed PENDING. Receipt status/messages now follow refreshed server withdrawal records, including processing, approval, rejection and cancellation. Retest created and cancelled another isolated request: balance returned to 22,600; both history and receipt displayed CANCELLED and the returned-rewards message.
- Active isolated payout layout checks at 320, 768 and 1366 viewport widths returned scrollWidth=clientWidth at 305, 753 and 1351 pixels. Viewport override reset afterward.
- Limits: Google provider sign-in remains unverified/hidden by default. Real UPI collection and bank settlement are not configured. Provider adapter integration tests are mocked, not real transfers. Manual bank settlement, games/exchanges without supplied rules, and a universal claim that all external services work are not part of this verified result.
