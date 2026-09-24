# Architecture

## Components

```text
React pages -> Express routes -> JWT / role middleware -> controllers -> services -> Mongoose -> MongoDB replica set
                                                        |                 |
                                                        +---- audit ------+
```

The React app stores only an authentication token in browser storage. It does not store or calculate wallet balances, payout denominations, or required VE values.

## Collections

- `User`: normalized email, password hash, account status, and role.
- `Wallet`: one per user, with VEs, SVEs, Gems, Tokens, and Spins integer balances.
- `WalletTransaction`: immutable-style signed direction plus amount and before/after balances.
- `PayoutOption`: active method/option, payout value, VE requirement, eligibility, and required detail fields.
- `Withdrawal`: pending/review state, idempotency key, request fingerprint, debit reference, and private payout details.
- `AuditLog`: actor, target, action, reference, request IP, and event metadata.

## Money mutation and consistency

`walletService.js` is the only balance mutation path. A debit uses a conditional `$gte` filter and `$inc`, so an update cannot spend below zero. The ledger row is created in the same session. Withdrawal creation additionally inserts its request and audit record in that transaction. MongoDB retries transient transaction conflicts; the unique idempotency index protects requests across retries and duplicate HTTP submissions.

Wallet values are whole-number units to avoid floating-point currency arithmetic. The ledger's `balanceBefore` and `balanceAfter` can be reconciled against the current wallet balance.

## Withdrawal lifecycle

```text
PENDING -> PROCESSING -> APPROVED
    |           |
    +-> REJECTED <-+
    |
    +-> CANCELLED (user cancellation while pending)
```

VEs are deducted when a request is created. Rejection or pending cancellation credits the same VE amount back and writes a reversal ledger entry. Approval records review status only; no external payout is sent in this demo.

## Payout configuration

The backend returns enabled methods and options from `PayoutOption`. The client submits a method, option ID, payout details, and an idempotency header. It cannot choose `payoutAmount`, `currencyAmount`, or currency. The service retrieves configured values and validates detail fields against the chosen option. Only assessment-specified UPI amounts are enabled by the seed.

## Development database

`database/docker-compose.yml` starts an isolated, local-only MongoDB replica set with a persistent named volume. Replica-set mode is required for multi-document transaction support. `MONGO_URI` in `.env.example` points to `veloop_wallet` on localhost. Integration tests use a distinct database whose name includes `test` and clear only their own collections.

No VELOop production account, credentials, payout provider, or database is used.

## Scaling notes

For higher volume, retain atomic wallet writes and idempotency; add durable payout queues, bounded retry policy, risk review, automated reconciliation, and operational monitoring. Index user/time ledger reads and withdrawal review queues. Cache only non-authoritative configuration or summaries, and use explicit cache invalidation after commits. Consider ledger archival/partitioning only with a retained reconciliation trail.

