# VELOop Rewards Wallet & Payout System

Backend-focused MERN implementation for the official Wallet & Payout assessment. The deployed frontend reads MongoDB-backed wallet balances, transaction history, payout configuration and withdrawal status through JWT-protected Express APIs.

**Submission scope:** wallet, ledger, payout selection and withdrawal review. Payment simulations, demo reward claiming, Buy VEs navigation and unrelated mining/staking previews are not part of the submission UI. See [SUBMISSION_READINESS.md](SUBMISSION_READINESS.md).

- [Live application](https://veloop-rewards-dollsingha.onrender.com/login)
- [Backend health endpoint](https://veloop-rewards-dollsingha.onrender.com/api/health)
- [API documentation](API_DOCUMENTATION.md)
- [Architecture](ARCHITECTURE.md)
- [Test results](TESTING.md)

This project uses the intern's own development database. Internal reward credits are not bank money. Withdrawal creation persists a pending request and safely deducts VEs; external UPI settlement is not configured or required by the specified final backend workflow.

## Technology

Requires Node.js 24.x (the validated deployment runtime). Development reload uses Node’s built-in `--watch` mode.

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

### Optional: enable Google sign-up

Google sign-up is optional and hidden by default until provider-side QA is complete. Set `VITE_GOOGLE_SIGN_IN_ENABLED=true` only after verifying the exact authorized origin and successful sign-in. Google sign-up uses Google Identity Services in the browser and verifies the returned ID token on the API before creating or signing in to an account. Create an OAuth 2.0 **Web application** client in Google Cloud Console and add `http://localhost:5173` (and `http://127.0.0.1:5173` if you use that address) as an authorized JavaScript origin. Put the same web client ID in `GOOGLE_CLIENT_ID` in `backend/.env` and `VITE_GOOGLE_CLIENT_ID` in `frontend/.env`, then restart both development servers. No client secret is needed or should be added to this app. Without those values, the normal email/password sign-in remains available and the Google button shows a setup note.

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

The wallet-specific data-quality controls, evidence, and clearly separated future governance proposals are documented in [DATA_QUALITY_GOVERNANCE.md](./DATA_QUALITY_GOVERNANCE.md).

## Tests

The integration tests cover credit, withdrawal, insufficient balance, duplicate and concurrent requests, invalid options, cross-user access, rejection reversal, and client amount manipulation. They require a separate MongoDB replica-set database with `test` in its database name. Instructions and limitations are in [TESTING.md](./TESTING.md).

## Growth to one million users

Keep wallet mutations atomic and the ledger append-only. Preserve idempotency keys and unique indexes for financial operations. Add queue-backed payout processing with retries and dead-letter handling, per-user risk limits, fraud signals, and automated balance-to-ledger reconciliation. Add structured metrics, tracing, alerts, and operational audit review. Scale reads with indexes and carefully invalidated caches; never cache the authoritative spendable balance as the source of truth. Archive old ledger records only after retention and reconciliation procedures are established.

## Deployment and submission

A deployment should use a separate development/demo MongoDB Atlas replica set and fresh secrets in the hosting provider. The app has no real payout-provider integration. Deploying publicly or pushing to GitHub requires explicit access to the destination project/account and a review of the demo credentials and environment settings first.

For a stable hosted demo URL, see [DEPLOYMENT.md](DEPLOYMENT.md). The Render Blueprint is in `render.yaml`; it does not contain database credentials or application secrets.






## Hosted evaluator account

The official task requires seeded assessment data. Configure `ASSESSMENT_REVIEW_ENABLED=true`, `ASSESSMENT_DB_NAME` matching the independent development database, and private `ASSESSMENT_REVIEW_EMAIL`/`ASSESSMENT_REVIEW_PASSWORD` in Render. A dedicated USER account is created transactionally with 25,000 VEs, 5,000 SVEs, 100 Gems, 500 Tokens and 3 Spins, each accounted for in the ledger. Credentials are shared privately with the evaluator, never committed. Existing accounts are not overwritten and restarts do not reset balances. Disable the seed flag after provisioning.

## Evaluation walkthrough

1. Sign in with the private evaluator credentials.
2. Open wallet and inspect backend balances and opening/reward ledger rows.
3. Select Redeem, choose UPI ₹10 (2,400 VEs), enter a format-valid assessment UPI ID and confirm.
4. Verify PENDING status, balance deduction and the corresponding debit row.
5. Use the protected admin API/Postman in the development environment to review, reject or approve; rejection/cancellation records a reversal.
6. Run `npm test` to reproduce the required security and concurrency scenarios.

## Wallet workflow without a payment gateway

- Members sign in, view their server balances and ledger, and select a database-configured redemption option. New accounts start at zero; no automatic top-up or cash purchase is implied.
- An existing authorized administrator can open `/admin/wallet`, enter the member user ID shown in their wallet, select one of the five currencies, and review and confirm a reward credit/debit. Every change uses the existing transactional backend and ledger/audit APIs.
- Admin access is checked on the server. Registration cannot create an admin. Provision an administrator only through your existing controlled development setup; never promote a user from the browser.
- Withdrawal creation deducts rewards atomically and records PENDING. Admins can move PENDING to PROCESSING and then APPROVED, or reject PENDING/PROCESSING with a reason. Members can cancel PENDING requests. Rejection/cancellation return the deducted rewards once.
- APPROVED means internal approval only. No UPI collection or bank settlement occurs. No payment-provider credentials are needed for this internal workflow.
- Admin forms require on-page confirmation and prevent simultaneous submissions. Wallet credits/debits are separate intentional operations, not idempotent retries: if a response is lost, check the member ledger before repeating a change.

### One-time development withdrawal test credit

An operator with existing server/database access can run `backend/scripts/grant-development-credit.mjs` with `--database`, `--user-id`, `--amount`, `--reference` and the explicit `--allow-development-credit` flag. It uses the server MONGO_URI, requires an exact database-name match, an active existing member, and a positive whole amount capped at 25,000 VEs. It never creates/promotes accounts, resets balances, or exposes a member credit endpoint.

The credit and audit marker commit together in a MongoDB transaction. A deterministic unique audit ID prevents repeats of the same reference, including concurrent execution; changed member/amount with the same reference fails. The ledger labels these as development test credits, not cash purchases. This utility is not part of the default start command. Remove any temporary operator invocation after running it.
