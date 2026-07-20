#!/usr/bin/env bash
set -u

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REQUIRED_NODE_VERSION="20.19.4"
MAX_NODE_MAJOR="22"

cd "$APP_DIR" || exit 1

clear
echo "Starting BarRestaurantTicketing..."
echo

if [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh"
  nvm use --silent >/dev/null 2>&1 || nvm use --silent default >/dev/null 2>&1 || true
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed or is not available in PATH."
  echo "Install Node.js $REQUIRED_NODE_VERSION through $MAX_NODE_MAJOR.x, then run this launcher again."
  echo
  read -r -p "Press Enter to close this window..."
  exit 1
fi

if ! node -e "const required = '$REQUIRED_NODE_VERSION'.split('.').map(Number); const maxMajor = Number('$MAX_NODE_MAJOR'); const current = process.versions.node.split('.').map(Number); const highEnough = current[0] > required[0] || (current[0] === required[0] && (current[1] > required[1] || (current[1] === required[1] && current[2] >= required[2]))); process.exit(highEnough && current[0] <= maxMajor ? 0 : 1)" >/dev/null 2>&1; then
  echo "Node.js $REQUIRED_NODE_VERSION through $MAX_NODE_MAJOR.x is required. Current version:"
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

if ! node -e "const major = Number(process.argv[1].split('.')[0]); process.exit(major >= 10 ? 0 : 1)" "$(npm --version)"; then
  echo "npm 10 or newer is required. Current version: $(npm --version)"
  echo
  read -r -p "Press Enter to close this window..."
  exit 1
fi

RUNNING_MESSAGE="$(node scripts/is-running.mjs 2>&1)"
RUNNING_STATUS=$?

if [ "$RUNNING_STATUS" -eq 0 ]; then
  echo
  echo "The application is already running."
  echo "Opening the POS screen..."
  node scripts/wait-for-ready.mjs && node scripts/open-web.mjs
  echo
  sleep 2
  exit 0
fi

if [ "$RUNNING_STATUS" -eq 2 ]; then
  echo
  echo "Restarting an incomplete previous application start..."
  node scripts/stop-local.mjs
  sleep 1
fi

if [ "$RUNNING_STATUS" -eq 3 ]; then
  echo
  echo "$RUNNING_MESSAGE"
  echo "Close the program using that port, or change the ports in .env."
  echo
  read -r -p "Press Enter to close this window..."
  exit 1
fi

if ! node scripts/ensure-dependencies.mjs; then
  echo
  echo "Library installation failed. Check the messages above."
  read -r -p "Press Enter to close this window..."
  exit 1
fi

if ! node scripts/ensure-runtime-env.mjs; then
  echo
  echo "Runtime settings setup failed. The application was not started."
  read -r -p "Press Enter to close this window..."
  exit 1
fi

if ! npm run build:production; then
  echo
  echo "Production build failed. The database was not migrated and the application was not started."
  read -r -p "Press Enter to close this window..."
  exit 1
fi

if ! node scripts/validate-production-env.mjs; then
  echo
  echo "Production settings are incomplete or unsafe. Update the private .env file before migration."
  read -r -p "Press Enter to close this window..."
  exit 1
fi

if ! node scripts/prepare-database.mjs; then
  echo
  echo "Database setup failed. The previous database was preserved or restored."
  read -r -p "Press Enter to close this window..."
  exit 1
fi

(
  node scripts/wait-for-ready.mjs && node scripts/open-web.mjs
) &
READY_PID=$!

cleanup_ready_waiter() {
  kill "$READY_PID" >/dev/null 2>&1 || true
}
trap cleanup_ready_waiter EXIT INT TERM

echo "Opening the configured desktop POS when it is ready."
echo "Keep this window open while using the application."
echo "Press Ctrl+C here to stop the application."
echo

set +e
npm run start:production
RUN_STATUS=$?
set -e

echo
if [ "$RUN_STATUS" -eq 0 ]; then
  echo "Application stopped."
else
  echo "Application stopped after an error (exit code $RUN_STATUS)."
fi
read -r -p "Press Enter to close this window..."
exit "$RUN_STATUS"
