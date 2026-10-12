# RazorpayX UPI test payouts

This optional integration sends withdrawals to RazorpayX **test mode**. It does not transfer real money and cannot be activated with `rzp_live_` keys. Razorpay Checkout accepts payments; this wallet needs RazorpayX payouts to redeem rewards.

## Setup

1. Obtain your own RazorpayX test API key ID, key secret and **test** customer/account identifier from the RazorpayX dashboard. Availability and onboarding depend on your RazorpayX account.
2. Add the following privately to `backend/.env` for local testing, or the Render service's environment variables for the hosted demo. Do not commit or paste secrets into chat.

   ```dotenv
   RAZORPAYX_TEST_ENABLED=true
   RAZORPAYX_TEST_KEY_ID=rzp_test_your_key
   RAZORPAYX_TEST_KEY_SECRET=your_test_secret
   RAZORPAYX_TEST_ACCOUNT_NUMBER=your_test_account_identifier
   RAZORPAYX_TEST_WEBHOOK_SECRET=your_unique_test_webhook_secret
   ```

3. Allowlist the server's outbound IP addresses in RazorpayX as required by the provider. Configure a test webhook at `https://your-host/api/webhooks/razorpayx-test`, using the same test webhook secret. Subscribe to payout events.
4. Restart/redeploy the backend. With an administrator JWT, call `GET /api/admin/payout-integration` to check readiness. This endpoint returns configuration names only, never secret values.

## Demo flow

1. Use a development/demo wallet with enough VEs. A new account intentionally starts at zero. A ₹10 UPI option requires 2,400 VEs from backend payout configuration. For an authorized demo, use the existing administrator credit endpoint so every credit has an audit log and a ledger entry. Do not change balances in React or directly in MongoDB.
2. Submit a normal withdrawal with `POST /api/withdrawals`, a fresh `Idempotency-Key`, `method: "upi"`, a database option ID and sandbox UPI details. A valid request reserves/debits the VEs and becomes `PENDING`.
3. An administrator submits it to RazorpayX with `POST /api/admin/withdrawals/:id/razorpay-test`. The body cannot override amount, currency or payout destination; all are taken from the stored withdrawal. The contact name sent to the test provider is `VELOop Test Recipient`; no member email or phone is transmitted.
4. The withdrawal stays `PROCESSING` until RazorpayX confirms the result. `processed` becomes `APPROVED`. A confirmed failed/rejected/cancelled/reversed payout becomes `REJECTED` and creates one ledger reversal.
5. Signed webhooks reconcile the latest authenticated provider state. Administrators may also call `POST /api/admin/withdrawals/:id/razorpay-test/reconcile` after a timeout or while troubleshooting.

## Failure and duplicate handling

- Missing configuration or a live key returns `503` before the withdrawal state is changed.
- Duplicate provider submissions cannot issue another payout. The initial provider call includes a persisted UUID `X-Payout-Idempotency` header.
- An uncertain/timeout response keeps the VEs reserved. It must be reconciled; the application does not assume failure, refund automatically, or send a replacement payout.
- Reconciliation matches the provider payout ID, withdrawal reference, amount, INR currency and UPI mode. A mismatched response cannot approve or refund the withdrawal.
- Provider-managed withdrawals cannot be manually approved/rejected through the generic review endpoints.
- Webhook HMAC SHA-256 is checked against the exact raw request body. Invalid signatures return `401`. Duplicate/delayed events cannot create duplicate reversals.
- The tests use mocks exclusively for provider HTTP responses. These are test fixtures, not a fake deployed payment integration. Real sandbox verification remains pending until your own test account credentials are configured.

## References

- [RazorpayX payouts](https://razorpay.com/docs/api/x/payouts/)
- [Composite UPI payouts](https://razorpay.com/docs/api/x/payout-composite/create/vpa/)
- [Payout idempotency](https://razorpay.com/docs/api/x/payout-idempotency/make-request/)
- [Webhook validation](https://razorpay.com/docs/webhooks/validate-test/)
