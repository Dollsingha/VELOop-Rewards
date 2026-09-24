# API Documentation

Base URL: `http://localhost:5000/api`. Protected endpoints require `Authorization: Bearer <JWT>`. All successful responses include `success: true`. Public errors do not contain database error details.

## Authentication

### `POST /auth/register`
Request: `{ "name": "Demo", "email": "user@example.test", "password": "AtLeast10Chars" }`

Creates a USER account and zero-balance wallet in one transaction; returns a JWT and public user fields. Password must be at least 10 characters.

### `POST /auth/login`
Request: `{ "email": "demo@veloop.test", "password": "Demo@12345" }`

Returns `{ success, token, user }`. Repeated auth attempts are rate limited.

## Wallet (JWT required)

### `GET /wallet`
Returns the signed-in user's wallet. Any `userId` query parameter is ignored.

### `GET /wallet/summary`
Returns current balances only.

### `GET /wallet/transactions?page=1&limit=20`
Returns `{ items, page, limit, total, pages }`, newest first. Page size is capped at 100.

Wallet credit/debit operations are admin-only (`POST /admin/wallet/credit`, `POST /admin/wallet/debit`), not available to ordinary users.

## Payout configuration (JWT required)

### `GET /payout/methods`
Returns active methods and their required detail fields from MongoDB.

### `GET /payout/options/:method`
Example: `GET /payout/options/upi`. Returns active options, configured payout amount, required currency/VE amount, and detail schema.

Stored payout details are encrypted with AES-256-GCM using `PAYOUT_DETAILS_ENCRYPTION_KEY`; only admin review responses decrypt them. The seed configures UPI: ₹10 / 2,400 VEs; ₹25 / 5,800; ₹50 / 10,000; ₹100 / 19,500; ₹150 / 28,500; ₹300 / 52,500; ₹500 / 80,500; ₹1,000 / 150,000. No other payout denominations are enabled without verified configuration.

## Withdrawals (JWT required)

### `POST /withdrawals`
Required header: `Idempotency-Key: <unique value>` (8-100 characters).

Request:
```json
{
  "method": "upi",
  "optionId": "upi_100",
  "payoutDetails": { "upiId": "name@bank" }
}
```

Do not send an amount. The backend looks up the active option, validates payout details, checks/deducts the current VE balance, and creates its ledger, withdrawal, and audit rows atomically. On a repeated matching key, the same request is returned with `duplicate: true`; reusing a key with different request content returns HTTP 409.

Success returns a withdrawal in `PENDING`. User payout details are excluded from withdrawal responses.

### `GET /withdrawals?page=1&limit=20`
Returns the authenticated user's paginated history.

### `GET /withdrawals/:id`
Returns one of the authenticated user's withdrawals; another user's ID returns 404.

### `POST /withdrawals/:id/cancel`
Cancels a `PENDING` withdrawal only. The original VE amount is credited back and recorded as a reversal. Other transitions return HTTP 409.

## Admin (JWT plus ADMIN role required)

### `PATCH /admin/payout-options/:methodId`
Updates an option name, active flag, payout value, or required VE amount; writes a `PAYOUT_CONFIGURATION_CHANGED` audit event. Only enabled options are returned to users.

### `GET /admin/stats`
Returns user/wallet counts and pending withdrawal count.

### `POST /admin/wallet/credit` and `POST /admin/wallet/debit`
Request: `{ "userId": "<MongoDB id>", "currency": "VES", "amount": 500, "description": "Manual adjustment" }`.

Amounts must be positive whole-number units. The wallet update, ledger entry, and audit entry are transactional.

### `GET /admin/withdrawals?status=PENDING&page=1&limit=20`
Returns withdrawal review queue, including payout details for authorized admins.

### `GET /admin/withdrawals/:id`
Returns one withdrawal and its payout details for an administrator.

### `POST /admin/withdrawals/:id/process`
Moves a pending withdrawal to `PROCESSING`. Optional body: `{ "note": "Review started" }`.

### `POST /admin/withdrawals/:id/approve`
Moves a processing withdrawal to `APPROVED`. This demonstration records approval but does not send a payout.

### `POST /admin/withdrawals/:id/reject`
Moves a pending or processing withdrawal to `REJECTED` and reverses the VE debit. Optional body: `{ "reason": "Unable to verify details", "note": "Reviewed manually" }`.

## Common errors

- `400`: validation failure, invalid or unavailable payout option, insufficient VE balance.
- `401`: authentication required or invalid token.
- `403`: account/admin access denied.
- `404`: resource not found or owned by a different user.
- `409`: duplicate key with changed content or invalid withdrawal state transition.
- `429`: rate limit exceeded.
- `500`: generic internal error; database details are logged server-side only.



