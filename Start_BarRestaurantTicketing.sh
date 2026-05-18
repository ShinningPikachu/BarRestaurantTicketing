#!/usr/bin/env bash
set -u

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_URL="${DESKTOP_URL:-http://localhost:8081}"
REQUIRED_NODE_VERSION="20.19.4"

cd "$APP_DIR" || exit 1

clear
echo "Starting BarRestaurantTicketing..."
echo

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed or is not available in PATH."
  echo "Install Node.js $REQUIRED_NODE_VERSION or newer, then run this launcher again."
  echo
  read -r -p "Press Enter to close this window..."
  exit 1
fi

if ! node -e "const required = '$REQUIRED_NODE_VERSION'.split('.').map(Number); const current = process.versions.node.split('.').map(Number); process.exit(current[0] > required[0] || (current[0] === required[0] && (current[1] > required[1] || (current[1] === required[1] && current[2] >= required[2]))) ? 0 : 1)" >/dev/null 2>&1; then
  echo "Node.js $REQUIRED_NODE_VERSION or newer is required. Current version:"
  node --version
  echo
  read -r -p "Press Enter to close this window..."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is not installed or is not available in PATH."
  echo "Install npm, then run this launcher again."
  echo
  read -r -p "Press Enter to close this window..."
  exit 1
fi

if [ ! -d "$APP_DIR/node_modules" ]; then
  echo "Installing application libraries. This can take a few minutes..."
  npm install
  if [ "$?" -ne 0 ]; then
    echo
    echo "Library installation failed. Check the messages above."
    read -r -p "Press Enter to close this window..."
    exit 1
  fi
fi

if node scripts/is-running.mjs >/dev/null 2>&1; then
  echo
  echo "The application is already running."
  echo "Opening the POS screen..."
  node scripts/open-web.mjs
  echo
  sleep 2
  exit 0
fi

if [ ! -f "$APP_DIR/packages/backend/prisma/dev.db" ]; then
  echo "Creating local database..."
  npm run -w backend prisma:migrate:dev
  if [ "$?" -ne 0 ]; then
    echo
    echo "Database setup failed. Check the messages above."
    read -r -p "Press Enter to close this window..."
    exit 1
  fi
  npm run -w backend seed
  if [ "$?" -ne 0 ]; then
    echo
    echo "Database seed failed. Check the messages above."
    read -r -p "Press Enter to close this window..."
    exit 1
  fi
fi

if [ ! -d "$APP_DIR/packages/backend/node_modules/.prisma/client" ]; then
  echo "Preparing Prisma client..."
  npm run -w backend prisma:generate
  if [ "$?" -ne 0 ]; then
    echo
    echo "Prisma setup failed. Check the messages above."
    read -r -p "Press Enter to close this window..."
    exit 1
  fi
fi

(
  sleep 8
  DESKTOP_URL="$DESKTOP_URL" node scripts/open-web.mjs >/dev/null 2>&1
) &

echo "Opening the desktop POS at $DESKTOP_URL"
echo "Keep this window open while using the application."
echo "Press Ctrl+C here to stop the application."
echo

npm run dev

echo
echo "Application stopped."
read -r -p "Press Enter to close this window..."
