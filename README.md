# BarRestaurantTicketing

Restaurant/bar POS for table management, menu ordering, kitchen workflow, paid ticket history, simplified receipts, PDF ticket copies, and Xprinter cash drawer/receipt printing.

Before moving an existing database to another computer or applying a release to production information, read [CHANGESET_PRODUCTION_REVIEW.md](./CHANGESET_PRODUCTION_REVIEW.md) and follow [PRODUCTION_FIRST_RUN.md](./PRODUCTION_FIRST_RUN.md). The production migration path requires a verified external backup and tests pending migrations against a restored temporary copy before changing the live SQLite file.

This is a monorepo with two application workspaces:

- `packages/backend`: Express API, Prisma, SQLite database, printer bridge.
- `packages/frontend`: Expo React Native app for desktop web and phone/tablet.

The frontend has separate main screens for computer and mobile:

- Computer: `packages/frontend/src/native/app/DesktopMainScreen.tsx`
- Computer styles: `packages/frontend/src/native/app/DesktopMain.styles.ts`
- Mobile: `packages/frontend/src/native/app/MobileMainScreen.tsx`
- Mobile styles: `packages/frontend/src/native/app/MobileMain.styles.ts`

Shared state and API wiring stay in `packages/frontend/App.tsx`.

## Requirements

- Node.js 20.19.4 through 22.x.
- npm 10 or newer.
- A computer on the same network as any phone/tablet using the POS.
- For database persistence: Prisma with the included SQLite setup.
- For receipt printing: one of these printer paths:
  - Xprinter or ESC/POS printer reachable by LAN, usually port `9100`.
  - System printer configured with `lp`.
  - USB device path exposed by the OS.

Optional:

- Expo Go on a phone/tablet for the mobile POS.
- A browser for the desktop POS.

When using `nvm`, activate the project's preferred Node.js line with:

```bash
nvm install
nvm use
```

The desktop installer and start launcher also activate this `.nvmrc` version automatically when `nvm` is installed.

## Login

The POS requires a login code on both computer and mobile screens. The backend also protects `/api/*` routes, so people on the same network cannot use the API without logging in. The installer and launcher generate a random six-digit access code and a long random API token in the private root `.env` file when either value is missing or blank. The generated access code is printed in the startup terminal.

You can instead set your own values in `.env` before starting:

```env
POS_ACCESS_CODE=ChangeThisCode
POS_AUTH_TOKEN=ReplaceWithAtLeast32RandomCharacters
```

Do not use the example values for service. The launcher enforces private file permissions on Linux and never prints the API token. A newly generated access code is shown once; set `BAR_TICKETING_SHOW_ACCESS_CODE=1` for an explicit later display.

## Quick Start

Install the exact dependencies committed in `package-lock.json` and generate the Prisma client from the repo root:

```bash
npm run bootstrap
```

Apply all committed migrations to a new/empty local SQLite database:

```bash
npm run db:migrate:deploy
```

For an existing database with pending migrations, use the external-backup command in `PRODUCTION_FIRST_RUN.md`; a plain command intentionally stops before changing data. A populated database is never seeded. For a genuinely new standalone database only, explicitly initialize the bundled menu once with `npm run db:initialize:new`.

Run backend, desktop web POS, and phone Expo server together for development only:

```bash
npm run dev
```

The development helper prints URLs similar to:

```text
Backend API shared by both screens: http://192.168.1.50:3000/api
Computer web TPV: http://localhost:8081
Phone Expo TPV: scan the QR code from the Expo server on port 8082
```

Use the computer URL for the desktop POS. Scan the Expo QR code for the mobile POS.

The root helper forces separate screen modes:

- Desktop port `8081` runs with `EXPO_PUBLIC_TPV_SCREEN=desktop`.
- Phone port `8082` runs with `EXPO_PUBLIC_TPV_SCREEN=mobile`.

The combined POS launcher disables the optional standalone React Native DevTools application so ordinary Linux launches do not try to install an Electron/Chromium debugging binary. It still prints an Expo Go QR code for the phone POS. To enable native DevTools while developing, start it explicitly:

```bash
BAR_TICKETING_ENABLE_NATIVE_DEVTOOLS=1 npm run dev
```

On Linux, the downloaded React Native DevTools Electron application may require system-admin configuration of its Chromium sandbox helper before it can open. The web desktop POS remains available through normal browser developer tools.

## Clickable Local Launcher

For a normal user, run the installer once from the repository folder:

```bash
bash Install_BarRestaurantTicketing.sh
```

It installs the exact npm libraries from `package-lock.json`, generates private runtime credentials, builds the compiled operational application, validates production settings, applies committed database migrations without automatic seeding, and creates two path-correct desktop buttons in the current user's Desktop folder. An existing database with pending migrations requires the explicit external-backup procedure in `PRODUCTION_FIRST_RUN.md` before installation can complete:

```text
Start BarRestaurantTicketing
Stop BarRestaurantTicketing
```

Double-click the generated `Start BarRestaurantTicketing` button and choose to run it if your file manager asks. It verifies the installed dependency lock, refreshes dependencies only when needed, rebuilds and validates the operational app, checks the database migration state, opens a terminal window, starts the compiled backend and exported frontend, waits for both to pass readiness checks, then opens the configured desktop POS (port `8081` by default). It does not run Expo or TypeScript watchers in operational mode.

```text
http://localhost:8081
```

Keep the terminal window open while using the app. Press `Ctrl+C` in that window to stop it.

The desktop start icon does not start the phone Expo QR server. Use `npm run dev` from a terminal when you want the development servers and phone Expo pairing.

If the POS is already running, double-clicking the same start icon again only opens or focuses the existing POS screen. It does not start a second copy. If someone accidentally closes only the POS browser window, double-click the start icon again to reopen it.

If the app keeps running or you closed the terminal window, double-click the generated stop button:

```text
Stop BarRestaurantTicketing
```

You can also stop it from the repo root with:

```bash
npm run stop
```

## Single-File Linux Package

You can also create one movable executable file:

```bash
npm run package:linux
```

This creates the generated, Git-ignored artifact:

```text
.dist/BarRestaurantTicketing-linux.run
```

Move that one `.run` file to another Linux computer and double-click it, or run:

```bash
./BarRestaurantTicketing-linux.run
```

The package build uses an explicit release allowlist and fails if its payload contains a runtime `.env`, SQLite database, journal/WAL file, database backup, cache, generated project build, or escaping symlink. Runtime credentials and restaurant data are never intentionally distributed. Verify this safety message appears whenever creating a package.

On first launch it unpacks the app into `~/.local/share/BarRestaurantTicketing`, selects Node 22 through nvm when available, checks Node.js 20.19.4 through 22.x and npm 10+, installs the exact libraries from `package-lock.json`, generates private local credentials, builds and validates the production-mode app, creates/migrates a new destination database, and opens the desktop POS after readiness checks. Before importing or upgrading an existing database, follow `PRODUCTION_FIRST_RUN.md`; pending migrations intentionally stop until a separate verified backup path is supplied.

If the portable app is already running, opening the `.run` file again only opens or focuses the POS screen. It will not start a duplicate backend/frontend server.

To upgrade an installed portable copy, stop it first, make an external backup of its data, and run the newer `.run` file. The updater prepares code and dependencies in a unique staging directory, preserves the destination `.env`, database (including any rollback-journal/WAL state), and database-backup directory, recovers/checkpoints and validates SQLite before copying or migrating it, and only then publishes the prepared directory with a rename. An interrupted publish is restored from the previous-directory rollback copy on the next launch. Obsolete code/dependency directories are replaced instead of merged indefinitely.

To stop a portable app started from the `.run` file, run:

```bash
./BarRestaurantTicketing-linux.run --stop
```

After the first launch, the installed folder also contains `Stop_BarRestaurantTicketing.desktop`.

If you want the package to include the already-installed `node_modules` folder for a more offline-friendly bundle, run:

```bash
npm run package:linux:offline
```

That file will be much larger. Its dependency tree is verified against the package lock and retains required nested `build`/`dist` directories. Because native npm/Prisma binaries are platform-specific, use it only on a similar Linux system with the same CPU architecture. For different systems or architectures, use `npm run package:linux` so dependencies install cleanly on the destination computer.

## Run Separately

Backend only:

```bash
set -a
. ./.env
set +a
npm run -w backend dev
```

The backend workspace command does not load the root `.env` by itself; source the trusted local file as shown or export the required variables explicitly. The combined launcher handles this automatically.

Backend only without hot reload:

```bash
set -a
. ./.env
set +a
npm run -w backend serve
```

Both backend-only commands require the trusted root `.env` to be sourced or the required variables to be exported explicitly. The combined launcher handles this automatically.

Frontend web only:

```bash
npm run -w frontend web
```

Frontend Expo/mobile only:

```bash
npm run -w frontend dev:phone
```

If using a physical phone, the phone must reach the backend. Set the API URL to your computer LAN IP:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.50:3000/api npm run -w frontend dev:phone
```

## Install Android App

You can build a local Android APK so the phone opens the POS as a normal installed app instead of scanning the Expo QR code.

Prerequisites:

- Java 17.
- Android Studio or Android SDK command-line tools.
- Android SDK Platform/Build Tools for API 36.
- Android NDK `27.1.12297006`.
- Accepted Android SDK licenses.
- `adb` for USB installation.

If Android Studio is installed, open `Settings > Languages & Frameworks > Android SDK > SDK Tools`, install the Android SDK Command-line Tools and NDK, then accept licenses. On Ubuntu/Debian, install the command-line tools first if `sdkmanager` is not available:

```bash
sudo apt install google-android-cmdline-tools-13.0-installer
sudo env JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 /usr/lib/android-sdk/cmdline-tools/13.0/bin/sdkmanager --licenses
sudo env JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 /usr/lib/android-sdk/cmdline-tools/13.0/bin/sdkmanager "platforms;android-36" "build-tools;36.0.0" "cmake;3.22.1" "ndk;27.1.12297006"
```

The Android app still needs the backend running on the computer:

```bash
npm run -w backend dev
```

Build the APK from the repo root:

```bash
npm run android:apk
```

This command activates the Node.js version from `.nvmrc` automatically when `nvm` is installed, even if your terminal currently opens with Node.js 24.

The build script uses your computer LAN IP as the first connection address:

```text
http://YOUR_COMPUTER_LAN_IP:3000/api
```

If the phone will connect through a computer-created hotspot, build with the hotspot IP instead:

```bash
BAR_TICKETING_HOST_IP=10.42.0.1 npm run android:apk
```

The installed Android app can later be paired with a different computer address without rebuilding it. After installing an APK that includes this pairing feature once, start the computer TPV normally, tap `Conectar` in the Android app, and scan the pairing QR shown in the computer startup terminal. Pairing stores only the local server address; the POS login code is still required.

If you want to force the initial backend URL, set it before building:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.50:3000/api npm run android:apk
```

The generated APK is a release-mode bundle signed with the generated debug key for trusted local sideloading:

```text
packages/frontend/android/app/build/outputs/apk/release/app-local.apk
```

It is not a production-signed release and must not be uploaded to an app store. A store/managed deployment needs a protected release keystore, controlled versionCode/version updates, and a separate signed release workflow.

Install it on a connected Android phone with USB debugging enabled:

```bash
adb install -r packages/frontend/android/app/build/outputs/apk/release/app-local.apk
```

The phone and computer must stay on the same trusted network, and the computer firewall must allow the backend port, usually `3000`. A computer-created hotspot counts as the same network when the phone is connected to that hotspot. The local APK currently enables cleartext HTTP so it can reach a LAN-only backend; login tokens and POS traffic are therefore not protected from an untrusted or hostile network. Do not expose the backend port to the public internet. Use TLS or a trusted private network for any broader deployment.

## Environment

The root `npm run dev` script reads a root `.env` file if present.

Example `.env`:

```env
PORT=3000
DESKTOP_EXPO_PORT=8081
PHONE_EXPO_PORT=8082

POS_ACCESS_CODE=ChangeThisCode
POS_AUTH_TOKEN=ReplaceWithAtLeast32RandomCharacters

EXPO_PUBLIC_TICKET_TRADE_NAME=Your Restaurant Name
EXPO_PUBLIC_TICKET_BUSINESS_NAME=Your Legal Business Name
EXPO_PUBLIC_TICKET_BUSINESS_NIF=Your Tax ID
EXPO_PUBLIC_TICKET_BUSINESS_ADDRESS=Your Business Address
EXPO_PUBLIC_TICKET_BUSINESS_CITY=Your City
EXPO_PUBLIC_TICKET_BUSINESS_PHONE=Your Phone Number
EXPO_PUBLIC_TICKET_VAT_RATE=10

# Optional printer mode for frontend-triggered customer tickets.
EXPO_PUBLIC_TICKET_PRINT_MODE=xprinter-lan

# Backend printer bridge settings.
XPRINTER_HOST=192.168.1.80
XPRINTER_PORT=9100
```

The local database path is fixed by the included Prisma schema at `packages/backend/prisma/dev.db`; `DATABASE_URL` is not a supported relocation setting. Keep custom backend, desktop, and phone ports distinct. The combined launcher derives localhost CORS origins from `DESKTOP_EXPO_PORT`; set `CORS_ORIGINS` explicitly only when serving the web POS from additional trusted origins.

The backend listens on LAN interfaces so phones can connect. Authentication is still required, but CORS is not a firewall and the default LAN transport is HTTP. Restrict the backend port to the trusted restaurant LAN/hotspot, use strong generated credentials, do not forward it from the router, and add TLS before using it across an untrusted network.

Printer alternatives:

```env
XPRINTER_PRINTER_NAME=YourSystemPrinterName
```

or:

```env
XPRINTER_USB_DEVICE=/dev/usb/lp0
```

## How To Use

### 1. Open The POS

From the home screen:

- `TPV`: table ordering and payments.
- `Historial de tickets`: paid ticket history, reprint simplified receipts, PDF copies, session totals.
- `Productos`: add/edit menu products, prices, categories, cost, and images.

### 2. Select A Table

In `TPV`, choose a table from `Terraza`, `Planta 1`, or `Planta 2`.

You can:

- Add a table with `+ Añadir mesa`.
- Select a table by pressing it.
- Drag a table to reposition it inside a zone.
- Remove the selected table with the red delete button.

### 3. Add Products

Use the menu categories and search field. Press products to add them to the table preorder.

In the preorder area you can:

- Increase/decrease quantity.
- Edit item price.
- Use quick price buttons.
- Clear the preorder.

### 4. Send To Kitchen

Press `Enviar a cocina` to confirm the preorder. Confirmed items move to the confirmed order section.

### 5. Print Or Pay

For confirmed orders:

- `Imprimir ticket`: print/generate the customer ticket.
- `AA`: choose individual items for separate payment or individual ticket.
- `Pagar efectivo`: register cash payment.
- `Pagar tarjeta`: register card payment.
- `Comensales` + `Imprimir dividido`: print a split ticket by number of people.

Paid orders create records in the ticket history.

### 6. Ticket History

Open `Historial de tickets`.

The top summary panel shows the current session totals:

- Total sales.
- Cash/card totals.
- Taxable base.
- VAT.
- Products sold.

Use:

- `Actualizar totales`: refresh only the session summary.
- Search box: filter paid tickets by number, table, payment method, or product.
- `Actualizar tickets`: refresh only the ticket list.
- `Imprimir`: reprint a simplified receipt through the configured printer bridge.
- `PDF`: create/open a clearer detailed ticket copy. On web, use the browser print dialog and choose `Save as PDF`.

The current session window is controlled by the backend: it runs continuously from 06:00 until 06:00 the next day, so early-morning sales are never omitted from every session.

### 7. Manage Products

Open `Productos`.

You can:

- Add products manually.
- Set category/type.
- Set sale price and internal cost.
- Add/change/remove product images.
- Import CSV.

CSV import expects columns like:

```csv
name,priceCents,sku,category,description,available
Classic Burger,1299,FOOD-001,Main Course,Juicy beef patty,true
```

There is a template at:

```text
packages/backend/data/menu-import-template.csv
```

## Printing Notes

Normal customer ticket printing can work in two ways:

- If `EXPO_PUBLIC_TICKET_PRINT_MODE` is `xprinter-lan` or `xprinter-usb`, the frontend sends the print payload to the backend printer bridge.
- Otherwise, web opens the browser print flow and native opens the platform print flow.

History reprint uses the backend Xprinter endpoint directly. Make sure backend printer variables are configured:

```env
XPRINTER_HOST=192.168.1.80
XPRINTER_PORT=9100
```

For system printer:

```env
XPRINTER_PRINTER_NAME=PrinterName
```

For USB device:

```env
XPRINTER_USB_DEVICE=/dev/usb/lp0
```

Cash drawer opening is a separate, explicit action through the backend printer bridge. Normal ticket printing and history reprints do not request a drawer pulse.

## Useful Commands

Run all dev services:

```bash
npm run dev
```

Run backend tests:

```bash
npm run -w backend test
```

Run all script, backend, and frontend tests, backend/frontend typechecks, the web export, and an isolated compiled-backend auth/health smoke test:

```bash
npm run check
```

Typecheck frontend:

```bash
npm run -w frontend typecheck
```

Build everything:

```bash
npm run build
```

Apply production-style committed migrations without seeding:

```bash
npm run db:migrate:deploy
```

Explicitly load the bundled initial menu into a genuinely new and otherwise empty database:

```bash
npm run db:initialize:new
```

Prisma Studio:

```bash
cd packages/backend
npm run prisma:studio
```

## Database Backup, Upgrade, And Recovery

The working SQLite file contains operational and ticket/accounting history. It is runtime state, is ignored by Git, and is never supposed to be included in a Linux package. Do not use Git or a generated `.run` artifact as a data backup. The complete production procedure is in `PRODUCTION_FIRST_RUN.md`.

Before an application or operating-system upgrade:

1. Stop the POS and verify the stop command reports that all processes stopped.
2. Copy `packages/backend/prisma/dev.db` to protected storage outside the application directory.
3. Keep multiple dated copies and periodically test restoring one on a separate machine.
4. Start/install the new version. If migrations are pending, run `npm run db:migrate:deploy -- --backup-output=/absolute/external/path.db`. The preparer recovers/checkpoints and integrity-checks SQLite, creates a guarded local copy plus a verified non-overwriting external copy, tests the migration on a temporary restore, and only then applies `prisma migrate deploy`. Guarded backups are not automatically deleted.
5. Confirm `/health`, tables, open orders, ticket history, totals, and printing before resuming service.

If migration preparation fails, the launcher restores the guarded copy (or removes an incomplete brand-new database) and does not start the application. Do not repeatedly seed or replace a populated database. To restore manually, stop the POS, preserve the failed database for investigation, copy a known-good backup to `packages/backend/prisma/dev.db`, and start again. If the `sqlite3` command is installed, `sqlite3 packages/backend/prisma/dev.db 'PRAGMA integrity_check;'` should return `ok` before a restored database is put back into service.

## Troubleshooting

### Use Without A Wi-Fi Router

The computer cannot make the phone use `localhost`: on the phone, `localhost` always means the phone itself. For no-router service, create a Wi-Fi hotspot on the computer, connect the phone to that hotspot, and pair with the computer hotspot IP.

Typical setup:

1. Start the computer hotspot from the operating system network settings.
2. Connect the phone to that hotspot.
3. Start BarRestaurantTicketing on the computer.
4. In the phone app, tap `Conectar`.
5. Scan the pairing QR shown by the computer, or type the pairing address manually.

On many Linux systems the hotspot address is `10.42.0.1`; on Windows Internet Connection Sharing it is often `192.168.137.1`. If the QR shows a different network address than the hotspot, start the app with an explicit hotspot address:

```bash
BAR_TICKETING_HOST_IP=10.42.0.1 npm run dev
```

Use the same override when building an APK whose first address should point at the hotspot:

```bash
BAR_TICKETING_HOST_IP=10.42.0.1 npm run android:apk
```

The backend already listens on all network interfaces, so the hotspot path does not need a separate server mode. The computer firewall still needs to allow port `3000`.

### Phone Cannot Connect To Backend

The Android phone connects to the computer through its local network IP address. That address can change when you move to a different Wi-Fi network, restart a router, use a hotspot, or receive a new DHCP lease. An APK built with an old address cannot reach the computer until it is paired again.

For the installed Android app:

1. Start BarRestaurantTicketing on the computer.
2. Keep phone and computer on the same Wi-Fi network, or connect the phone to the computer hotspot.
3. In the phone app, tap `Conectar`.
4. Scan the `Installed Android app` QR code printed in the computer startup terminal.
5. Log in with the POS access code.

You can also type the pairing address manually in the phone app, for example:

```text
http://192.168.1.50:3000/api
```

For Expo Go development, use the computer LAN IP, not `localhost`, for `EXPO_PUBLIC_API_BASE_URL`.

Example:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.50:3000/api npm run -w frontend dev:phone
```

Make sure the phone and computer are on the same Wi-Fi or hotspot network and the backend is running.

### Printer Does Not Print

Check:

- Backend is running.
- Printer IP/port is correct.
- Printer is on the same network.
- `XPRINTER_HOST` or `XPRINTER_PRINTER_NAME` or `XPRINTER_USB_DEVICE` is set.
- Firewalls allow connection to printer port `9100` if using LAN.

### PDF Button Opens Print Dialog On Web

That is expected. Browser apps cannot silently save a PDF without extra PDF generation infrastructure. Choose `Save as PDF` in the print dialog.

### Database Is Empty

For a genuinely new or zero-byte database, run the guarded preparation command:

```bash
npm run db:migrate:deploy
```

If this is a brand-new installation with no transferred data and you want the bundled initial menu, run `npm run db:initialize:new` once after schema creation.

If a previously populated database appears empty, stop and restore a known-good backup instead of seeding it.

### Port Already In Use

If a previous BarRestaurantTicketing terminal was closed without stopping its services, stop the leftover local servers and start again:

```bash
npm run stop
npm run dev
```

The desktop start icon now detects an incomplete previous start and restarts it automatically. If another program uses one of the required ports, it stops with a clear message instead of opening only part of the POS.

Override ports:

```bash
PORT=3001 DESKTOP_EXPO_PORT=8091 PHONE_EXPO_PORT=8092 npm run dev
```

## Project Structure

```text
packages/
  backend/
    prisma/          Database schema and migrations
    src/routes/      Express API routes
    src/services/    Printer and menu services
    data/            CSV menu data/templates
  frontend/
    App.tsx          Main app shell
    src/native/      Controllers, components, styles, services
```
