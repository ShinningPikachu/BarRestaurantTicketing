#!/usr/bin/env bash
set -u

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="BarRestaurantTicketing"
REQUIRED_NODE_VERSION="20.19.4"

cd "$APP_DIR" || exit 1

clear
echo "Installing $APP_NAME..."
echo

pause_before_close() {
  if [ "${BAR_TICKETING_NONINTERACTIVE:-}" = "1" ]; then
    return
  fi

  echo
  read -r -p "Press Enter to close this window..."
}

fail() {
  echo "$1"
  pause_before_close
  exit 1
}

if ! command -v node >/dev/null 2>&1; then
  fail "Node.js is required. Install Node.js $REQUIRED_NODE_VERSION or newer, then run this installer again."
fi

if ! node -e "const required = '$REQUIRED_NODE_VERSION'.split('.').map(Number); const current = process.versions.node.split('.').map(Number); process.exit(current[0] > required[0] || (current[0] === required[0] && (current[1] > required[1] || (current[1] === required[1] && current[2] >= required[2]))) ? 0 : 1)" >/dev/null 2>&1; then
  node --version
  fail "Node.js $REQUIRED_NODE_VERSION or newer is required."
fi

if ! command -v npm >/dev/null 2>&1; then
  fail "npm is required. Install npm, then run this installer again."
fi

if command -v xdg-user-dir >/dev/null 2>&1; then
  DESKTOP_DIR="$(xdg-user-dir DESKTOP)"
else
  DESKTOP_DIR="$HOME/Desktop"
fi

if [ -z "$DESKTOP_DIR" ] || [ "$DESKTOP_DIR" = "$HOME" ]; then
  DESKTOP_DIR="$HOME/Desktop"
fi

mkdir -p "$DESKTOP_DIR" || fail "Could not create Desktop folder: $DESKTOP_DIR"

echo "Preparing desktop buttons..."
cat > "$DESKTOP_DIR/Start BarRestaurantTicketing.desktop" <<DESKTOP
[Desktop Entry]
Version=1.0
Type=Application
Name=Start BarRestaurantTicketing
Comment=Start the local BarRestaurantTicketing POS application
Exec=$APP_DIR/Start_BarRestaurantTicketing.sh
Path=$APP_DIR
Terminal=true
Categories=Office;Utility;
DESKTOP

cat > "$DESKTOP_DIR/Stop BarRestaurantTicketing.desktop" <<DESKTOP
[Desktop Entry]
Version=1.0
Type=Application
Name=Stop BarRestaurantTicketing
Comment=Stop the local BarRestaurantTicketing POS application
Exec=$APP_DIR/Stop_BarRestaurantTicketing.sh
Path=$APP_DIR
Terminal=true
Categories=Office;Utility;
DESKTOP

chmod +x \
  "$APP_DIR/Start_BarRestaurantTicketing.sh" \
  "$APP_DIR/Stop_BarRestaurantTicketing.sh" \
  "$DESKTOP_DIR/Start BarRestaurantTicketing.desktop" \
  "$DESKTOP_DIR/Stop BarRestaurantTicketing.desktop"

if command -v gio >/dev/null 2>&1; then
  gio set "$DESKTOP_DIR/Start BarRestaurantTicketing.desktop" metadata::trusted true >/dev/null 2>&1 || true
  gio set "$DESKTOP_DIR/Stop BarRestaurantTicketing.desktop" metadata::trusted true >/dev/null 2>&1 || true
fi

echo "Installing application libraries..."
npm install || fail "Library installation failed. Check the messages above."

echo "Preparing Prisma client..."
npm run -w backend prisma:generate || fail "Prisma setup failed. Check the messages above."

node scripts/ensure-runtime-env.mjs || fail "Runtime settings setup failed."

if [ ! -f "$APP_DIR/packages/backend/prisma/dev.db" ]; then
  echo "Creating local database..."
  npm run -w backend prisma:migrate:dev || fail "Database setup failed. Check the messages above."
  npm run -w backend seed || fail "Database seed failed. Check the messages above."
else
  echo "Local database already exists."
fi

echo
echo "$APP_NAME is ready."
echo
echo "Desktop buttons created:"
echo "  $DESKTOP_DIR/Start BarRestaurantTicketing.desktop"
echo "  $DESKTOP_DIR/Stop BarRestaurantTicketing.desktop"
echo
echo "Use Start BarRestaurantTicketing to open the POS."
echo "Use Stop BarRestaurantTicketing to close it."

pause_before_close
