# Test plan and execution

## Integration database

Tests exercise the real Express routes and Mongoose models. They require a dedicated MongoDB replica set, not the development or production database. Start the local replica set from the repository root:

```powershell
docker compose -f database/docker-compose.yml up -d
```

Run the test suite from the backend directory. It defaults to a local database named `veloop_wallet_test`, and never uses the development database. To run seeding and tests from Command Prompt in one step, run `database\start-and-test.cmd` from the repository root. Docker Desktop must be installed and running.

You can also set an alternate dedicated test URI. The command depends on whether you use PowerShell or Command Prompt:

PowerShell:

```powershell
$env:MONGO_TEST_URI = "mongodb://127.0.0.1:27017/veloop_wallet_test?replicaSet=rs0"
npm test
```

Command Prompt (`cmd.exe`):

```bat
set MONGO_TEST_URI=mongodb://127.0.0.1:27017/veloop_wallet_test?replicaSet=rs0
npm test
```

The suite refuses a database name without `test`, clears only its collections, and leaves the regular `veloop_wallet` demo data alone. If MongoDB is not running, the integration tests fail with a connection error; start the local replica set first.

## Required scenarios covered

1. Admin credit changes wallet and creates matching before/after ledger data.
2. Normal withdrawal uses the server-configured VE amount and records the debit.
3. Insufficient balance returns an error and creates no withdrawal.
4. Repeated request with the same idempotency key creates one debit/request.
5. Two concurrent withdrawals cannot both spend the same balance.
6. Unknown payout option is rejected.
7. Wallet identity comes from JWT even if a different `userId` is supplied; another user cannot read a withdrawal.
8. Rejected withdrawal restores VEs with one reversal ledger entry and keeps history.
9. Client supplied amount, currency, and payout value do not override database configuration.

## Manual UI check

Run backend and frontend, sign in as the demo user, inspect the backend-loaded balances and transactions, choose a UPI denomination, confirm a request, and verify the pending state and refreshed balance. Use the admin account and Postman to move a withdrawal through PROCESSING and REJECTED, then confirm the reversal.

## Current environment note

The integration suite cannot run until a MongoDB replica set is available. Docker/MongoDB is not preinstalled in the development environment. The Compose file supplies a local replica set for a machine with Docker Desktop; do not point tests at production or at the ordinary demo database.
