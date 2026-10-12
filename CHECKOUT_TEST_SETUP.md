# Buying VEs with Razorpay Checkout — test setup

This flow is available at /buy-ves. It accepts a test payment from the user. UPI withdrawal uses separate RazorpayX credentials and does not fund this checkout.

## Required backend configuration in Render

- RAZORPAY_KEY_ID: your own Razorpay Payment Gateway test key, beginning rzp_test_.
- RAZORPAY_KEY_SECRET: corresponding private test secret, backend only.
- VES_PURCHASE_PACKAGES: JSON array with unique id, label, ves (positive whole number), and amountPaise (whole number, at least 100). Package prices and VE quantities must be chosen by the project owner; no assignment purchase pricing is assumed.

Use your own Razorpay account's Test Mode. Configure automatic capture for test payments. Do not enter real payment credentials or expect test payments to transfer real money.

## Purchase flow

1. Sign in and open /buy-ves.
2. Select a server-configured package. Buying does not require an existing VE balance.
3. Checkout opens only when valid test keys and packages are configured.
4. The server creates an INR order from package configuration.
5. After the checkout callback, the server validates its signature and fetches the payment.
6. Only a captured payment matching order, amount and currency is credited. Refunded payments are rejected.
7. Credit, purchase state and audit record commit atomically. Repeated verification cannot credit again.
8. View the wallet to see the purchase ledger.

## Interrupted verification

GET /api/payments/orders returns the signed-in user's ten most recent orders.
POST /api/payments/orders/:id/reconcile fetches the order's payments from Razorpay and applies the same verification and atomic credit rules.
Use Check payment status after a lost callback, failed verification, or page reload before starting a new payment.
The endpoint cannot read or credit another user's order.

## Status

React compilation and backend syntax checks passed. Actual provider checkout, payment capture and wallet credit still require configured test keys, package prices and live deployment. No external sandbox payment has been confirmed.

Provider reference: https://razorpay.com/docs/api/payments/fetch-payments-orders/
