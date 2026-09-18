# Server generation

Commercial clients use LA-02 HTTPS port 8443 for login, balance, generation and history. Local Electron HTTP serves assets/health only. MiMo credentials stay in the server's mode-600 environment file.

Build `npm ci && npm run build:api` from the repository root. Install API dependencies with `npm ci --prefix la02-api`. Deploy `server.mjs`, `generation.mjs`, `pricing.mjs` and the generated `engine.cjs` together to `/opt/tk-platform-api`. Back up the existing files and environment first. Restart only `tk-platform-api`; do not change Xray, x-ui, port 443 or firewall settings.

The API requires its existing PostgreSQL account/order tables, PG connection variables and `MIMO_API_KEY`. Startup creates `generation_jobs` if absent. API port defaults to 38127 on loopback. `MIMO_MAX_CONCURRENCY` controls the number of simultaneous MiMo requests and defaults to 4.

`POST /api/generate` accepts product, region, targetAudience, features, duration, optional image and a unique requestId. The server computes the price. An account lock and a unique account/requestId pair prevent duplicate charges; requests are charged once, placed in a FIFO queue by submission time, and dispatched as soon as one of the configured MiMo slots is free. Clients poll the returned jobId; queued jobs expose `queuePosition`/`queueAhead`, and `/api/generation-jobs/latest` resumes the last task on relaunch.

The transaction reserves the fee before calling MiMo. Success writes content and the charged amount in one transaction. Failure returns the reservation exactly once. Startup refunds unfinished previous-process jobs; a watchdog refunds abandoned jobs older than five minutes. Normal provider calls have a three-minute deadline. Do not run multiple API instances against these jobs without replacing the single-worker recovery policy with leases and a queue.

Legacy client-driven debit, refund, history writes and mock payment endpoints return 410. Users must upgrade to 1.0.16. Model calls are fixed to MiMo-V2.5; existing fixed retail prices remain unchanged. Provider token usage is stored separately with the job, not represented as the user's retail charge.

Verification: run `node --test generation.test.mjs` with PG variables, using an isolated temporary schema. `test-cloud-e2e.mjs` is an explicit paid live check; it creates a disposable account, tests login/generation/idempotency/balance/history over public HTTPS, and deletes only that fixture after completion. Do not run live checks in CI. `npm test`, typecheck, commercial build, cloud UI acceptance and packaged smoke checks validate desktop changes.
