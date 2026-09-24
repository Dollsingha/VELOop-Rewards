# VELOop Rewards Wallet & Payout System

A backend-focused MERN demonstration of a server-authoritative wallet, append-only transaction ledger, payout configuration, and safe withdrawal review. It is an independent development project; it must not connect to VELOop production credentials or databases.

## Technology

- Node.js, Express.js, MongoDB, and Mongoose
- React and Vite
- JWT authentication
- Helmet, CORS allowlisting, request validation, and rate limits

## Run locally

### 1. Start the development database

The app requires a MongoDB replica set because wallet debit, ledger creation, withdrawal creation, and audit logging use MongoDB transactions. From the project root:

```powershell
docker compose -f database/docker-compose.yml up -d
```

This Compose service binds only to `127.0.0.1`, stores data in a named Docker volume, and initializes a single-node replica set for local development. Stop it from the project root with `docker compose -f database/docker-compose.yml down`; the named volume keeps data. It is not a production deployment. Docker Desktop must be installed and running.

### 2. Configure and seed the backend

```powershell
cd backend
Copy-Item .env.example .env
```

Replace `JWT_SECRET` and `PAYOUT_DETAILS_ENCRYPTION_KEY` in `backend/.env`. Generate the encryption key with:

```powershell
node -p "require('node:crypto').randomBytes(32).toString('hex')"
```

Use its 64-character hex output. The example `MONGO_URI` points only to the local `veloop_wallet` development database.

```powershell
npm install
npm run seed
npm run dev
```

The API listens on `http://localhost:5000`. Demo credentials:

```text
User:  demo@veloop.test / Demo@12345
Admin: admin@veloop.test / Demo@12345
```

These are local demonstration accounts only. Do not reuse their password in a deployed environment.

### 3. Run the frontend

Open another terminal:

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`.

## Wallet and payout design

MongoDB stores the current wallet and all ledger rows. Credits and debits are performed by backend services; each ledger row records currency, direction, amount, balance before/after, source, reference, and timestamp. Debit updates use a conditional balance check. Multi-document financial operations run inside a replica-set transaction.

Withdrawal requests use immediate VEs deduction. Requests require an `Idempotency-Key`; a unique `(userId, idempotencyKey)` index plus a request fingerprint prevents duplicate charges and rejects reuse of a key with different details. If a user cancels a pending withdrawal or an administrator rejects one, a reversal credit and ledger row are written in the same transaction. Approval is a recorded manual state change; no external payout provider is integrated.

The seed enables only the eight UPI denominations and VE requirements listed in the assessment. PayPal and gift-card denominations are not seeded because the task document does not provide their actual values. Configuration and required payout fields are stored in `PayoutOption` documents and can be extended later.

## Security and privacy

- JWT identity is read from the bearer token; client-supplied user IDs do not select wallet ownership.
- Wallet values and payout calculations never come from frontend storage or request amounts.
- Payout details are encrypted at rest with AES-256-GCM; the development encryption key is stored only in the ignored local `.env`.
- Admin-only wallet adjustments and withdrawal review are authenticated, role checked, and audited.
- Payout fields are validated against the selected database option. Withdrawal APIs do not return stored payout details to ordinary users.
- `.env`, `.env.test`, and local configuration must not be committed. Use `.env.example` as a template only.
- Use a development database only. Never paste VELOop production credentials into this repository.

## API and architecture

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) and [ARCHITECTURE.md](./ARCHITECTURE.md). The Postman collection is `postman/VELOop-Wallet.postman_collection.json`.

## Tests

The integration tests cover credit, withdrawal, insufficient balance, duplicate and concurrent requests, invalid options, cross-user access, rejection reversal, and client amount manipulation. They require a separate MongoDB replica-set database with `test` in its database name. Instructions and limitations are in [TESTING.md](./TESTING.md).

## Growth to one million users

Keep wallet mutations atomic and the ledger append-only. Preserve idempotency keys and unique indexes for financial operations. Add queue-backed payout processing with retries and dead-letter handling, per-user risk limits, fraud signals, and automated balance-to-ledger reconciliation. Add structured metrics, tracing, alerts, and operational audit review. Scale reads with indexes and carefully invalidated caches; never cache the authoritative spendable balance as the source of truth. Archive old ledger records only after retention and reconciliation procedures are established.

## Deployment and submission

A deployment should use a separate development/demo MongoDB Atlas replica set and fresh secrets in the hosting provider. The app has no real payout-provider integration. Deploying publicly or pushing to GitHub requires explicit access to the destination project/account and a review of the demo credentials and environment settings first.




