# Demo payment simulation

Open /buy-ves after signing in. Set DEMO_PAYMENTS_ENABLED=true on the backend to enable this feature.

This is a simulation, not Razorpay or a real UPI payment. No bank details, UPI PIN, account credentials or money are involved.

Illustrative server-side demo packages: simulated ₹10 for 2,400 demo VEs; simulated ₹50 for 10,000 demo VEs. These are not real purchase prices or official assignment payout configuration. Edit backend/src/config/demoPackages.js to change them.

- DemoWallet stores the isolated demo balance, capped at 100,000 demo VEs.
- DemoPayment stores receipts with before/after balances and a unique per-user idempotency key.
- Success credits only DemoWallet. Failure records a receipt without credit.
- Demo credits cannot reach the real Wallet or Withdrawal collections.
- Demo history is displayed in the Buy VEs page and loads from the backend.
- JWT authentication and the existing payments rate limiter protect both endpoints.
- GET /api/payments/demo: configuration, demo balance, latest 20 receipts.
- POST /api/payments/demo: packageId and SUCCESS/FAILURE outcome, with Idempotency-Key header. Prices and amounts are server-derived.
- Same key with different payload is rejected; same key with same payload returns the existing receipt.
- Credits, receipts and audit logs commit together in a MongoDB transaction.
- The demo collections initialize their own unique indexes before simulation; the core wallet service and server startup are unchanged.

Frontend compilation and backend syntax checks passed. Live success/failure and duplicate-request verification are recorded separately after deployment.
