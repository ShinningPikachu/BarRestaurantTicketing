#!/usr/bin/env bash
set -u

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$APP_DIR" || exit 1

clear
echo "Stopping BarRestaurantTicketing..."
echo

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed or is not available in PATH."
  echo "Install Node.js 20.19.4 through 22.x, then run this stop launcher again."
  echo
  read -r -p "Press Enter to close this window..."
  exit 1
fi

node scripts/stop-local.mjs

echo
read -r -p "Press Enter to close this window..."
