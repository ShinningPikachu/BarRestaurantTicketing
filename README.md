# BarRestaurantTicketing

Restaurant/bar POS for table management, menu ordering, kitchen workflow, paid ticket history, simplified receipts, PDF ticket copies, and Xprinter cash drawer/receipt printing.

This is a monorepo with three workspaces:

- `packages/backend`: Express API, Prisma, SQLite database, printer bridge.
- `packages/frontend`: Expo React Native app for desktop web and phone/tablet.
- `packages/shared`: Shared TypeScript types/constants.

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

The POS requires a login code on both computer and mobile screens. The backend also protects `/api/*` routes, so people on the same network cannot use the API without logging in.

Default development access code:

```text
1234
```

For real use, set your own code in `.env`:

```env
POS_ACCESS_CODE=ChangeThisCode
POS_AUTH_TOKEN=ChangeThisLongRandomToken
```

Use the same `.env` when running `npm run dev`, because the backend reads these values.

## Quick Start

Install the exact dependencies committed in `package-lock.json` and generate the Prisma client from the repo root:

```bash
npm run bootstrap
```

Create and seed the local SQLite database:

```bash
cd packages/backend
npm run prisma:migrate:dev
npm run seed
cd ../..
```

Run backend, desktop web POS, and phone Expo server together:

```bash
npm run dev
```

The helper prints URLs similar to:

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

For a normal user, run the installer once:

```text
Install_BarRestaurantTicketing.desktop
```

It prepares the app, installs the exact npm libraries from `package-lock.json`, prepares Prisma/database files, and creates two desktop buttons:

```text
Start BarRestaurantTicketing
Stop BarRestaurantTicketing
```

On Linux desktops, you can start the local POS without typing terminal commands:

```text
Start_BarRestaurantTicketing.desktop
```

Double-click it from the repository folder and choose to run it if your file manager asks. It installs missing locked npm libraries when needed, opens a terminal window, starts the backend and frontend, then opens the desktop POS at:

```text
http://localhost:8081
```

Keep the terminal window open while using the app. Press `Ctrl+C` in that window to stop it.

If the POS is already running, double-clicking the same start icon again only opens or focuses the existing POS screen. It does not start a second copy. If someone accidentally closes only the POS browser window, double-click the start icon again to reopen it.

If the app keeps running or you closed the terminal window, double-click:

```text
Stop_BarRestaurantTicketing.desktop
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

This creates:

```text
.dist/BarRestaurantTicketing-linux.run
```

Move that one `.run` file to another Linux computer and double-click it, or run:

```bash
./BarRestaurantTicketing-linux.run
```

On first launch it unpacks the app into `~/.local/share/BarRestaurantTicketing`, checks for Node.js 20.19.4 through 22.x and npm, installs the exact libraries from `package-lock.json`, prepares Prisma, and opens the desktop POS at `http://localhost:8081`. Local `.env` credentials are not included in the portable package; configure them on the destination computer.

If the portable app is already running, opening the `.run` file again only opens or focuses the POS screen. It will not start a duplicate backend/frontend server.

To stop a portable app started from the `.run` file, run:

```bash
./BarRestaurantTicketing-linux.run --stop
```

After the first launch, the installed folder also contains `Stop_BarRestaurantTicketing.desktop`.

If you want the package to include the already-installed `node_modules` folder for a more offline-friendly bundle, run:

```bash
npm run package:linux:offline
```

That file will be much larger and is best used on a similar Linux system with the same CPU architecture. For different computers or architectures, use `npm run package:linux` so dependencies install cleanly on the destination computer.

## Run Separately

Backend only:

```bash
npm run -w backend dev
```

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

The installed Android app can later be paired with a different computer address without rebuilding it. After installing an APK that includes this pairing feature once, start the computer TPV normally, tap `Conectar` in the Android app, and scan the pairing QR shown in the computer startup terminal. Pairing stores only the local server address; the POS login code is still required.

If you want to force the initial backend URL, set it before building:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.50:3000/api npm run android:apk
```

The generated APK is:

```text
packages/frontend/android/app/build/outputs/apk/release/app-release.apk
```

Install it on a connected Android phone with USB debugging enabled:

```bash
adb install -r packages/frontend/android/app/build/outputs/apk/release/app-release.apk
```

The phone and computer must stay on the same network, and the computer firewall must allow the backend port, usually `3000`.

## Environment

The root `npm run dev` script reads a root `.env` file if present.

Example `.env`:

```env
PORT=3000
DATABASE_URL=file:./dev.db

POS_ACCESS_CODE=ChangeThisCode
POS_AUTH_TOKEN=ChangeThisLongRandomToken

EXPO_PUBLIC_TICKET_TRADE_NAME=Your Restaurant Name
EXPO_PUBLIC_TICKET_BUSINESS_NAME=Your Legal Business Name
EXPO_PUBLIC_TICKET_BUSINESS_NIF=Your Tax ID
EXPO_PUBLIC_TICKET_BUSINESS_ADDRESS=Your Business Address
EXPO_PUBLIC_TICKET_BUSINESS_CITY=Your City
EXPO_PUBLIC_TICKET_BUSINESS_PHONE=Your Phone Number
EXPO_PUBLIC_TICKET_SERIES=FS
EXPO_PUBLIC_TICKET_VAT_RATE=10

# Optional printer mode for frontend-triggered customer tickets.
EXPO_PUBLIC_TICKET_PRINT_MODE=xprinter-lan
EXPO_PUBLIC_XPRINTER_HOST=192.168.1.80
EXPO_PUBLIC_XPRINTER_PORT=9100
EXPO_PUBLIC_XPRINTER_OPEN_DRAWER=false

# Backend printer bridge settings.
XPRINTER_HOST=192.168.1.80
XPRINTER_PORT=9100
XPRINTER_OPEN_DRAWER=false
```

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

The current session window is controlled by the backend: it starts at 06:00 and ends at 04:00 the next day.

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

Cash drawer opening uses the same printer bridge and sends an ESC/POS drawer pulse.

## Useful Commands

Run all dev services:

```bash
npm run dev
```

Run backend tests:

```bash
npm run -w backend test
```

Typecheck frontend:

```bash
npm run -w frontend typecheck
```

Build everything:

```bash
npm run build
```

Prisma Studio:

```bash
cd packages/backend
npm run prisma:studio
```

## Troubleshooting

### Phone Cannot Connect To Backend

The Android phone connects to the computer through its local network IP address. That address can change when you move to a different Wi-Fi network, restart a router, use a hotspot, or receive a new DHCP lease. An APK built with an old address cannot reach the computer until it is paired again.

For the installed Android app:

1. Start BarRestaurantTicketing on the computer.
2. Keep phone and computer on the same Wi-Fi network.
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

Make sure the phone and computer are on the same Wi-Fi and the backend is running.

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

Run migrations and seed:

```bash
cd packages/backend
npm run prisma:migrate:dev
npm run seed
```

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
  shared/
    src/             Shared types/constants
```
