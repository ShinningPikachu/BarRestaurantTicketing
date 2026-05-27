#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$APP_DIR"

if [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh"
  nvm use --silent >/dev/null 2>&1 || true
fi

echo "Using Node.js $(node --version) for Android build."
exec node scripts/build-android-apk.mjs "$@"
