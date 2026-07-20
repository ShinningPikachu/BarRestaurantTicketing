# Change-Set Production Review

Review date: 2026-07-19. Scope: the complete staged/uncommitted change set against `main` (`76d8398`), including 100 changed paths, four new Prisma migrations, dependency/workspace changes, backend/frontend modules, launchers, packaging scripts, environment examples, local storage behavior, and documentation.

## Outcome

The code and migration path are ready for a controlled staging/production migration only when the gates in `PRODUCTION_FIRST_RUN.md` are followed. They are not authorization to treat the current local SQLite file as production-ready.

Safeguards added during review:

- Pending migrations cannot touch an existing database without a new, non-overwriting external backup outside the application directory.
- The external backup is compared byte-for-byte by size and SHA-256 and must pass SQLite integrity and foreign-key checks.
- Pending migrations run first against a temporary restored copy. Existing table row counts and protected quantity/financial aggregates must remain unchanged in staging and live execution.
- Ambiguous table zones/numbers, normalized table collisions, concurrent draft sessions, duplicate SKUs, and unfinished migrations stop deployment for manual reconciliation.
- Migrations no longer delete non-draft preorder rows, merge/delete draft sessions, drop legacy kitchen/user tables, clear duplicate SKU values, or silently renumber invalid tables.
- Initial menu seeding no longer calls `deleteMany`; it requires the explicit `npm run db:initialize:new` command plus an internal one-time flag and refuses any database with application data. Migration and startup never seed automatically.
- Operational startup compiles first, validates production identity/credentials, runs the compiled backend plus exported web app, and excludes `tsx watch`, Expo Go, native DevTools, fixtures, and test database overrides.
- The portable release allowlist excludes runtime databases, sidecars, backups, private environment files, caches, and generated build artifacts.
- Known example credentials and restaurant identity placeholders are rejected in production.

## Local database warning

The current ignored `packages/backend/prisma/dev.db` has all four reviewed migrations marked as applied from an earlier version of this work. That earlier SQL was destructive. The guarded pre-migration copy is:

```text
packages/backend/prisma/backups/dev-before-migrate-2026-07-19T13-48-32-912Z.db
```

Read-only audit of a temporary copy found:

- 44 non-draft `PreOrderSession` rows and 74 related `PreOrderItem` rows.
- 21 `KitchenTicket` rows and 37 `KitchenTicketItem` rows.
- No `User` rows.
- No duplicate SKU or concurrent-draft conflicts.
- Five tables with development/test zones: `err_test`, `final_test`, `fix_verify`, and `test_final`.

The current migrated file no longer contains those historical preorder/kitchen rows because the earlier staged migration deleted/dropped them. The backup is inside the repository and is not a sufficient external production backup. Do not move either file to the new production computer until the owner identifies the authoritative source, decides whether those legacy rows are operational history or fixtures, reconciles invalid zones explicitly, and restore-tests an external copy. No automatic restore was performed during this review.

## Compatibility and configuration review

- Database: SQLite remains fixed at `packages/backend/prisma/dev.db`. `DATABASE_URL` is intentionally unsupported for operational runtime; only tests can select an isolated database under `NODE_ENV=test`.
- Migration tracking: Prisma `_prisma_migrations` prevents completed migrations from running twice. Failed/unfinished state blocks the wrapper.
- Schema: new payment/mutation idempotency keys, durable ticket sequence, indexes, non-null normalized table zones, one-draft-per-table index, and unique SKU identity match current service queries.
- Historical data: paid-ticket issuer/item snapshots remain immutable for reprints. Legacy kitchen/user tables are retained but deliberately absent from current application models.
- Dependencies: the lockfile resolves cleanly under Node 22; the removed `shared` workspace has no remaining source import. Workspace-owned TypeScript/tsx/type packages replace root-only accidental dependencies.
- Environment: credentials have no runtime fallback outside tests; production issuer identity is required; CORS defaults to local desktop origins; backend printer targets can only come from server-side environment settings.
- Secrets: no private `.env`, database, key, or credential artifact is included in the portable payload. Smoke/test credentials are confined to `NODE_ENV=test` scripts. The access token remains memory-only on clients.
- Local storage: API pairing URL and per-layout/per-zone table positions remain persisted. The former local invoice sequence is retired and no longer read/written; an old key can remain inert. No migration deletes client storage.
- Startup: operational start uses compiled/exported assets. `npm run dev` remains available and is explicitly development-only.
- Network: the LAN API still uses cleartext HTTP. Authentication is required, but this is safe only on a trusted private restaurant LAN/hotspot with no router port forwarding; TLS is required for an untrusted network.
- Paths: source launchers derive the repository path; the portable installer uses `~/.local/share/BarRestaurantTicketing` or explicit `BAR_TICKETING_HOME`. Desktop files are generated for the destination path rather than shipped with stale paths.

## Verification completed

Using Node `22.22.2` and the committed lockfile:

- 11 script/migration/package tests passed.
- 21 backend unit/integration/security tests passed.
- 8 frontend identity/race/idempotency tests passed.
- Backend build and frontend typecheck passed.
- Expo web production export passed.
- Compiled backend authentication/health smoke test passed.
- Production environment validation passed for the current private environment without printing its API token.
- Compiled production launcher was smoke-tested on alternate ports: backend `/health` and exported desktop `/` both returned HTTP 200, and shutdown was clean.
- `npm ls --depth=0` reported a consistent installed workspace tree.
- `npm audit` reported zero known vulnerabilities in both the production-only and complete locked dependency trees.
- `git diff --check` reported no whitespace errors.

The default port `3000` was already occupied during the launcher check, so the smoke test used `39001`/`39002`; the normal production build was restored afterward. The process using port `3000` was not stopped or modified.

## Manual acceptance still required

Automated checks cannot prove printer hardware, Android network reachability, restaurant-specific accounting identity, or visual drag behavior. Follow the post-launch checklist in `PRODUCTION_FIRST_RUN.md` on a restored staging database and then during the controlled first launch.

There are no scheduled-task, unscheduled-task, task-template, or task-scheduler modules in this repository. The relevant operational equivalents are menu definitions, pending unsent items, confirmed orders, sync refresh timers, and persisted table drag positions; these are covered by automated state/race tests and the documented manual acceptance steps.
