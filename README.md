# BarRestaurantTicketing

Restaurant/bar POS for table management, menu ordering, kitchen workflow, paid ticket history, simplified receipts, PDF ticket copies, and Xprinter cash drawer/receipt printing.

This is a monorepo with three workspaces:

- `packages/backend`: Express API, Prisma, SQLite database, printer bridge.
- `packages/frontend`: Expo React Native app for desktop web and phone/tablet.
- `packages/shared`: Shared TypeScript types/constants.

## Requirements

- Node.js 18 or newer.
- npm 9 or newer.
- A computer on the same network as any phone/tablet using the POS.
- For database persistence: Prisma with the included SQLite setup.
- For receipt printing: one of these printer paths:
  - Xprinter or ESC/POS printer reachable by LAN, usually port `9100`.
  - System printer configured with `lp`.
  - USB device path exposed by the OS.

Optional:

- Expo Go on a phone/tablet for the mobile POS.
- A browser for the desktop POS.

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

Install dependencies from the repo root:

```bash
npm install
```

Create and prepare the local SQLite database:

```bash
cd packages/backend
npm run prisma:generate
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

Use the computer LAN IP, not `localhost`, for `EXPO_PUBLIC_API_BASE_URL`.

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
