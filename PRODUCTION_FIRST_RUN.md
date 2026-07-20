# Production First-Run and Migration Guide

Use this procedure when moving BarRestaurantTicketing to another computer with an existing operational SQLite database. Do not migrate during service hours. The migration command intentionally refuses to change an existing database with pending migrations unless it can create and verify a separate external backup first.

## 1. Deployment gates

Do not continue unless all of these are true:

- The old POS is stopped and no backend, Expo, browser development server, or database tool is using the database.
- A dated backup exists on storage outside the application directory and outside the computer being replaced where possible.
- The backup has been restored or opened on another computer/staging location and passed an integrity check.
- The new computer has enough free space for the application, the live database, an internal guarded backup, an external backup, and a temporary migration-test copy.
- The private production `.env` has real restaurant identity values and newly generated or deliberately transferred POS credentials.
- A rollback window and the previous working application version are available.

The guarded migration command performs another byte-for-byte verified external backup and automatically tests all pending migrations against a temporary restored copy before touching the live file. It also compares table row counts and protected quantity/financial aggregates before and after both the test migration and the live migration.

## 2. Required software

- Linux for the supplied desktop launchers and portable `.run` package.
- Node.js `20.19.4` through `22.x`. Node 22 LTS is recommended; Node 23/24 is rejected for operational builds.
- npm `10` or newer.
- `tar` for the portable package.
- A trusted local network for phones/tablets. Do not expose port `3000` to the public internet.
- Optional: CUPS and `lp` for a system printer queue; Java 17, Android SDK API 36, Build Tools 36, and NDK `27.1.12297006` to build the Android APK.

With nvm:

```bash
nvm install 22
nvm use 22
node --version
npm --version
```

## 3. Stop and back up the old computer

From the old application directory:

```bash
npm run stop
node scripts/is-running.mjs
```

`node scripts/is-running.mjs` must report that the application is not running. Close Prisma Studio and any SQLite viewer too.

The production data file is fixed at:

```text
packages/backend/prisma/dev.db
```

Copy that file to protected external storage while the application is stopped. If `dev.db-journal`, `dev.db-wal`, or `dev.db-shm` exists, do not copy only the main file while a process is active. Stop the process first and use the guarded preparation command to recover/checkpoint the database, or copy the complete set for forensic recovery.

Record the source file size and SHA-256:

```bash
sha256sum packages/backend/prisma/dev.db
```

Keep the previous application code/package and `.env` with the backup. Protect the `.env` separately because it contains authentication secrets.

## 4. Transfer code and data

Choose one supported method:

1. Copy/clone the source tree, then copy the stopped database into `packages/backend/prisma/dev.db`.
2. Build `npm run package:linux` on a supported Node version, move the `.run` file, launch it once to install, stop it, and place the stopped production database in `~/.local/share/BarRestaurantTicketing/packages/backend/prisma/dev.db` before migration.

Never transfer `.cache`, `node_modules`, generated `dist` directories, SQLite sidecars from a running database, or an old generated `.run` artifact as if it were a data backup. The portable package deliberately excludes `.env`, databases, journals, backups, caches, and build output.

After placing the database, set private permissions:

```bash
chmod 600 packages/backend/prisma/dev.db
```

## 5. Install locked dependencies

From the new application directory:

```bash
npm ci
node scripts/ensure-dependencies.mjs --record-only
npm run -w backend prisma:generate
```

Or use the equivalent wrapper:

```bash
npm run bootstrap
```

Do not use `npm update`, `prisma migrate dev`, `prisma db push`, or `prisma migrate reset` on production.

## 6. Configure the private environment

Create `.env` in the repository/application root; do not put secrets in either workspace `.env.example`. Then run `chmod 600 .env`.

Required for operational startup:

```env
POS_ACCESS_CODE=use-a-private-code
POS_AUTH_TOKEN=use-at-least-32-random-characters

TICKET_TRADE_NAME=Your Trading Name
TICKET_BUSINESS_NAME=Your Legal Business Name
TICKET_BUSINESS_NIF=Your Tax Identifier
TICKET_BUSINESS_ADDRESS=Your Legal Address
TICKET_BUSINESS_CITY=Your City
TICKET_BUSINESS_PHONE=Your Phone
TICKET_VAT_RATE=10
```

The `EXPO_PUBLIC_TICKET_*` equivalents remain accepted for backward compatibility, but secrets must never use an `EXPO_PUBLIC_` name. The launcher generates `POS_ACCESS_CODE` and `POS_AUTH_TOKEN` when absent; transfer the old values only if existing devices/users must keep the same login.

Common optional settings:

```env
PORT=3000
DESKTOP_EXPO_PORT=8081
PHONE_EXPO_PORT=8082
CORS_ORIGINS=http://localhost:8081,http://127.0.0.1:8081
POS_TERMINAL_ID=TPV-1
POS_CASHIER_NAME=
LOG_LEVEL=info

XPRINTER_PRINTER_NAME=POS80_RAW
XPRINTER_TIMEOUT_MS=10000
# Or XPRINTER_USB_DEVICE=/dev/usb/lp0
# Or XPRINTER_HOST=192.168.1.50 and XPRINTER_PORT=9100
```

Do not set `DATABASE_URL`; the operational path is intentionally fixed. Do not put `BAR_TICKETING_ALLOW_INITIAL_SEED`, `BAR_TICKETING_TEST_DATABASE_URL`, smoke-test credentials, or development fixtures in `.env`.

Validate before any migration:

```bash
npm run build:production
node scripts/validate-production-env.mjs
```

Production validation rejects missing identity data and known example credentials/placeholders.

## 7. Apply migrations safely

Create an existing directory on external storage for the verified backup. The output file itself must not already exist and must be outside the application directory:

```bash
npm run db:migrate:deploy -- --backup-output=/media/backup/BarRestaurantTicketing-before-2026-07-19.db
```

For an existing database with pending migrations, this command runs in this order:

1. Generate the Prisma client.
2. Recover/checkpoint SQLite and require `integrity_check` plus `foreign_key_check` to pass.
3. Detect pending migrations from `_prisma_migrations`; completed migrations are not run twice.
4. Stop on invalid table zones/numbers, table identity collisions, concurrent draft sessions, duplicate SKUs, or an unfinished prior migration. It never guesses how to repair these records.
5. Create a guarded internal backup and a non-overwriting external backup, compare size/SHA-256, and integrity-check the external copy.
6. Restore the guarded copy into a temporary staging directory, apply migrations there, re-check integrity/foreign keys, row counts, quantities, and financial totals.
7. Apply tracked migrations to the live database only after the restored-copy test passes.
8. Repeat the preservation checks. On failure, restore the guarded internal backup and refuse startup.

No migration resets, truncates, seeds, recreates the production database, deletes historical workflow tables, clears duplicate SKUs, or renumbers ambiguous tables. Legacy `KitchenTicket`, `KitchenTicketItem`, and `User` tables are retained even though current application code no longer reads them.

If no migration is pending, the command validates the database and Prisma state without demanding another backup. If the database is genuinely new, it creates only the schema; it does not seed automatically. For a brand-new installation with no transferred production information, `npm run db:initialize:new` is the explicit one-time menu initialization. Never run it for a transferred database. The initializer refuses any database that already contains application data.

## 8. Build and start in operational mode

Build, validate, migrate, then start—in that order:

```bash
npm run build:production
node scripts/validate-production-env.mjs
npm run db:migrate:deploy
npm run start:production
```

After the first verified migration, the third command needs no backup argument while no additional migration is pending.

The clickable Start launcher performs dependency verification, environment generation, a fresh production build, environment validation, safe database preparation, readiness waiting, and operational startup. Operational mode runs the compiled backend and exported desktop web app. It does not run `tsx watch`, Expo Go, React Native DevTools, fixtures, or test databases. `npm run dev` is development-only and must not be used with production data. Use the installed Android APK for the production phone/tablet client.

Startup order is backend API on port `3000`, exported desktop POS on `127.0.0.1:8081`, readiness checks, then the browser. The backend binds to LAN interfaces for the installed mobile app; restrict that port to the trusted restaurant LAN/hotspot.

## 9. Health and data validation

Before taking orders:

```bash
curl --fail http://127.0.0.1:3000/health
curl --fail http://127.0.0.1:8081/
node scripts/is-running.mjs
```

The backend health response must contain `"status":"ok"`; the desktop URL must return the exported app. Then log in and verify:

- All three table zones and every existing table number/name are present.
- Existing open/confirmed orders, pending unsent items, quantities, prices, totals, and printed-ticket state match the pre-migration record.
- Menu products/categories—the application's predefined operational templates—retain names, secondary names, prices, costs, SKU, availability, descriptions, and images.
- Adding an unsent item, changing quantity/price, clearing a draft, sending it to the kitchen, moving a confirmed item back, and deleting only an unpaid order behave correctly.
- Full, split, and selected-item payment create one paid ticket per action; retrying the same request cannot duplicate a payment or destructive removal.
- Paid ticket history, session totals, VAT/accounting snapshots, PDF output, customer pre-ticket, fiscal reprint, printer queue, and explicit cash-drawer action work.
- Table add/delete safeguards work, and a table with payment history cannot be deleted.
- Drag a table, release it, reload the app, and verify its position remains. Also drag across the visible area and confirm taps still select the intended table. Table drag-and-drop is the only drag-and-drop feature in this repository.
- On a second client, modify menu/table/order data and verify synchronization refreshes without overwriting an in-progress mutation.
- Restart once and repeat table/menu/order/ticket spot checks. The Android app should require login again. Its paired API base URL and the desktop/mobile table drag positions are retained in AsyncStorage; authentication tokens are memory-only. The retired local invoice-sequence key may remain on upgraded clients but is no longer read or written and must not be treated as an accounting sequence.

This repository has no scheduled-task module, unscheduled-task module, task scheduler, or task-template schema. Those requested checks are therefore not applicable by those names; menu definitions, pending unsent order items, confirmed orders, synchronization timers, and table drag positions are the corresponding operational areas validated above.

## 10. Rollback

If any health or data check fails:

1. Stop the new application immediately with `npm run stop`.
2. Preserve the failed database and logs for investigation; do not seed, reset, or retry destructive commands.
3. Move any `dev.db-journal`, `dev.db-wal`, and `dev.db-shm` beside the failed copy rather than mixing them with the backup.
4. Restore the verified external pre-migration database as `packages/backend/prisma/dev.db` and set mode `600`.
5. Restore the matching previous application version and private `.env`.
6. Run the previous version's health and data checks before resuming service.

Prisma migrations do not provide an automatic down migration. Do not run SQL copied from a forward migration in reverse. A file-level restore plus the matching old code is the supported rollback.

## Concise deployment checklist

- [ ] Old POS and database tools stopped.
- [ ] External pre-transfer backup recorded, hashed, and restore-tested.
- [ ] Supported Node/npm versions confirmed.
- [ ] Locked dependencies installed with `npm ci`/`npm run bootstrap`.
- [ ] Private `.env` configured and mode `600`; no example values or missing identity/secrets.
- [ ] `npm run check` passes on Node 20.19.4–22.x.
- [ ] Production build and environment validation pass before migration.
- [ ] Guarded migration receives a new absolute external backup path.
- [ ] Restored-copy migration test and live preservation checks pass.
- [ ] Operational launcher—not `npm run dev`—is used.
- [ ] Health, existing-data, menu, unsent/confirmed order, payment, ticket, printer, synchronization, and drag-position checks pass.
- [ ] Previous code, verified backup, `.env`, and rollback window remain available.
