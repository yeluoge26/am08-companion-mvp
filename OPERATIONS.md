# Operations and chat release

## Operator controls

The Administration page configures companion chat, streaming, memory and the trial limit, plus the model, output budget, context window and companion style prompt. Settings persist in SQLite, use optimistic version checks and write an audit record. The API key stays in server environment configuration and is not editable or returned through the website.

The default trial is **5 successful replies per account across all conversations**. It is not a daily allowance. Completed replies consume one trial use; a pending request reserves one use; provider errors, interrupted streams and process restarts release reservations. Only one generation per account can run at once. Idempotency keys prevent a repeated HTTP request from generating or charging twice. Failed messages can be retried without creating another user message. Previous messages created before this release are retained and are not retroactively charged against the new trial counter.

## Streaming and memory

The browser requests `Accept: text/event-stream` on the existing messages POST endpoint. Events are `message`, `delta`, `reply`, `done` or `error`. Nginx must not buffer responses. `reply` means the assistant response is saved; `done` follows the memory update. Interrupted partial output is not saved as a completed reply. Reloading retrieves durable messages and failed-message retry controls.

Memory is a bounded account-level factual summary shared across the user's characters. It is persisted in SQLite separately from recent conversation history and is updated from the latest user message after a successful reply. It is not a vector database or unlimited archival memory. Model extraction can make mistakes; users can review, edit, clear or disable it in Settings. Memory updates use revision checks so they cannot overwrite a concurrent user edit or deletion. Disabled memory is neither injected nor updated. Administrators receive aggregate statistics, not a memory-browsing endpoint.

Recent messages, character information and enabled memory are sent to OpenAI. Provider response storage is disabled with `store:false`. A separate memory extraction request adds API usage. The dashboard input/output token figures currently cover chat replies only, not memory extraction, and are not an invoice or cost estimate.

## Billing boundary

A subscription grants text access only while its expiry is in the future and its state is `active` or `non-renewing`. Cancelling renewal keeps access until expiry. A pending order grants neither access nor token credits. Verified payment or explicitly enabled local manual settlement atomically records paid status, membership and one token allocation; repeat callbacks/settlement do not double-credit. Text replies do not spend wallet tokens.

No live merchant payment provider has been supplied. Production therefore uses `ALLOW_MANUAL_SETTLEMENT=false`, blocks order creation and shows payments as unavailable until a real checkout and signed webhook adapter are configured. Local simulated settlement remains available for testing. This release does not implement automatic recurring billing, refunds or token-package purchases.

## API additions

- `GET /api/admin/config`: operator configuration, aggregate metrics, provider-configured flag.
- `PUT /api/admin/config`: complete validated configuration plus current `version`; administrator and CSRF required.
- `GET /api/chat/access`: membership, trial usage, remaining quota and feature state.
- `GET /api/me/memory`: current user's memory and global switch.
- `PATCH /api/me/memory`: `{summary, enabled, revision}`; users can clear with an empty summary.
- Message POST accepts `Idempotency-Key` and optional `retryMessageId`. HTTP 402 signals an exhausted trial before saving a new message or calling OpenAI.

## Deployment

Source: `C:/Users/lulan/Downloads/usdt/candy-mvp`.
Domain: `am08.one`. SSH target: `139.180.222.17`.

The deployment script accepts the root SSH password only through `DEPLOY_SSH_PASSWORD`; it does not contain credentials. Releases live under `/opt/candy-mvp/releases/`, with `/opt/candy-mvp/current` pointing to the active release. systemd runs as `candy-mvp`, listening only on loopback port 4180. Persistent SQLite files live in `/var/lib/candy-mvp`; private environment settings are in root-only `/etc/candy-mvp.env`. Nginx serves HTTPS and disables upstream response buffering. No local account database, test conversations or private `.env` is included in the uploaded archive.

Operator credentials are saved separately in the gitignored local `data/deployment-access.json` and are never included in release archives. Service restart: `systemctl restart candy-mvp`. Inspect logs: `journalctl -u candy-mvp`. A consistent backup can be created by running `scripts/operator.mjs backup` with the production DATA_DIR.

## Verification

Automated coverage includes config permissions/version conflicts, split UTF-8 streaming, concurrency, idempotency, cross-account isolation, restart persistence, memory reuse in a different conversation, opt-out/deletion, provider-failure refunds, trial paywall, pending-order access denial, settlement idempotency, cancellation and expiry.

Real local OpenAI/browser verification observed 15 incremental text changes in one reply, learned a name and astronomy preference, recalled them in a different character's fresh conversation, displayed the paywall, and unlocked unlimited text plus 100 wallet tokens after one local simulated monthly settlement. The local trial setting was restored to 5 after testing.


Production acceptance: HTTPS admin login and a real OpenAI reply were verified through Cloudflare, with 10 incremental DOM text updates and persistence after reload. 26 automated tests passed. The default trial is 5 replies. Daily database backups and certificate renewal are enabled; the issued certificate expires 2027-02-22. Cloudflare injects an optional analytics beacon which the application self-only CSP blocks; application functionality is unaffected.
