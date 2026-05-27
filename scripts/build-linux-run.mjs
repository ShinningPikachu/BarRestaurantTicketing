import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(repoRoot, '.dist');
const stagingDir = join(tmpdir(), 'bar-restaurant-ticketing-portable-staging');
const appDir = join(stagingDir, 'app');
const payloadPath = join(distDir, 'BarRestaurantTicketing-payload.tar.gz');
const outputPath = join(distDir, 'BarRestaurantTicketing-linux.run');
const includeNodeModules = process.argv.includes('--include-node-modules');
const requiredNodeVersion = '20.19.4';
const maxNodeMajor = '22';

const excludedNames = new Set([
  '.git',
  '.cache',
  '.dist',
  '.gradle',
  '.agents',
  '.codex',
  '.expo',
  '.expo-shared',
  '.expo-target',
  '.env',
  'android',
  'build',
  'dist',
]);

function shouldCopy(source) {
  const name = basename(source);
  if (excludedNames.has(name)) {
    return false;
  }
  if (!includeNodeModules && name === 'node_modules') {
    return false;
  }
  return true;
}

rmSync(stagingDir, { force: true, recursive: true });
rmSync(payloadPath, { force: true });
rmSync(outputPath, { force: true });
mkdirSync(appDir, { recursive: true });

cpSync(repoRoot, appDir, {
  recursive: true,
  filter: shouldCopy,
});

execFileSync('tar', ['-czf', payloadPath, '-C', stagingDir, 'app'], { stdio: 'inherit' });

const payload = readFileSync(payloadPath).toString('base64').match(/.{1,76}/g)?.join('\n') ?? '';
const launcher = `#!/usr/bin/env bash
set -e

APP_NAME="BarRestaurantTicketing"
INSTALL_DIR="\${BAR_TICKETING_HOME:-$HOME/.local/share/BarRestaurantTicketing}"
DESKTOP_URL="\${DESKTOP_URL:-http://localhost:8081}"

echo "Preparing $APP_NAME..."
echo

if [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh"
  nvm use --silent default >/dev/null 2>&1 || true
fi

if ! command -v tar >/dev/null 2>&1; then
  echo "tar is required to unpack this application."
  exit 1
fi

if ! command -v base64 >/dev/null 2>&1; then
  echo "base64 is required to unpack this application."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install Node.js ${requiredNodeVersion} through ${maxNodeMajor}.x, then run this file again."
  exit 1
fi

if ! node -e "const required = '${requiredNodeVersion}'.split('.').map(Number); const maxMajor = Number('${maxNodeMajor}'); const current = process.versions.node.split('.').map(Number); const highEnough = current[0] > required[0] || (current[0] === required[0] && (current[1] > required[1] || (current[1] === required[1] && current[2] >= required[2]))); process.exit(highEnough && current[0] <= maxMajor ? 0 : 1)" >/dev/null 2>&1; then
  echo "Node.js ${requiredNodeVersion} through ${maxNodeMajor}.x is required. Current version:"
  node --version
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required. Install npm, then run this file again."
  exit 1
fi

if [ "\${1:-}" = "--stop" ]; then
  if [ ! -d "$INSTALL_DIR" ]; then
    echo "$APP_NAME is not installed at $INSTALL_DIR."
    exit 0
  fi

  cd "$INSTALL_DIR"
  node scripts/stop-local.mjs
  exit $?
fi

if [ -d "$INSTALL_DIR" ]; then
  cd "$INSTALL_DIR"
  set +e
  RUNNING_MESSAGE="$(node scripts/is-running.mjs 2>&1)"
  RUNNING_STATUS=$?
  set -e

  if [ "$RUNNING_STATUS" -eq 0 ]; then
    echo "$APP_NAME is already running."
    echo "Opening the POS screen..."
    DESKTOP_URL="$DESKTOP_URL" node scripts/open-web.mjs
    exit 0
  fi

  if [ "$RUNNING_STATUS" -eq 2 ]; then
    echo "Restarting an incomplete previous application start..."
    node scripts/stop-local.mjs
    sleep 1
  fi

  if [ "$RUNNING_STATUS" -eq 3 ]; then
    echo "$RUNNING_MESSAGE"
    echo "Close the program using that port, or change the ports in .env."
    exit 1
  fi
fi

mkdir -p "$INSTALL_DIR"

PRESERVE_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$PRESERVE_DIR"
}
trap cleanup EXIT

if [ -f "$INSTALL_DIR/.env" ]; then
  cp "$INSTALL_DIR/.env" "$PRESERVE_DIR/.env"
fi

if [ -f "$INSTALL_DIR/packages/backend/prisma/dev.db" ]; then
  mkdir -p "$PRESERVE_DIR/prisma"
  cp "$INSTALL_DIR/packages/backend/prisma/dev.db" "$PRESERVE_DIR/prisma/dev.db"
fi

PAYLOAD_LINE="$(awk '/^__BAR_RESTAURANT_TICKETING_PAYLOAD_BELOW__$/ { print NR + 1; exit 0; }' "$0")"
tail -n +"$PAYLOAD_LINE" "$0" | base64 -d | tar -xzf - -C "$INSTALL_DIR" --strip-components=1

if [ -f "$PRESERVE_DIR/.env" ]; then
  cp "$PRESERVE_DIR/.env" "$INSTALL_DIR/.env"
fi

if [ -f "$PRESERVE_DIR/prisma/dev.db" ]; then
  mkdir -p "$INSTALL_DIR/packages/backend/prisma"
  cp "$PRESERVE_DIR/prisma/dev.db" "$INSTALL_DIR/packages/backend/prisma/dev.db"
fi

cd "$INSTALL_DIR"

cat > "$INSTALL_DIR/Start_BarRestaurantTicketing.desktop" <<DESKTOP
[Desktop Entry]
Version=1.0
Type=Application
Name=Start BarRestaurantTicketing
Comment=Start the local BarRestaurantTicketing POS application
Exec=$INSTALL_DIR/Start_BarRestaurantTicketing.sh
Path=$INSTALL_DIR
Terminal=true
Categories=Office;Utility;
DESKTOP

cat > "$INSTALL_DIR/Stop_BarRestaurantTicketing.desktop" <<DESKTOP
[Desktop Entry]
Version=1.0
Type=Application
Name=Stop BarRestaurantTicketing
Comment=Stop the local BarRestaurantTicketing POS application
Exec=$INSTALL_DIR/Stop_BarRestaurantTicketing.sh
Path=$INSTALL_DIR
Terminal=true
Categories=Office;Utility;
DESKTOP

chmod +x "$INSTALL_DIR/Start_BarRestaurantTicketing.sh" "$INSTALL_DIR/Stop_BarRestaurantTicketing.sh" "$INSTALL_DIR/Start_BarRestaurantTicketing.desktop" "$INSTALL_DIR/Stop_BarRestaurantTicketing.desktop"

if [ ! -d "$INSTALL_DIR/node_modules" ]; then
  echo "Installing exact application libraries from package-lock.json. This can take a few minutes..."
  npm ci
fi

node scripts/ensure-runtime-env.mjs

echo "Preparing local database tools..."
npm run -w backend prisma:generate

if [ ! -f "$INSTALL_DIR/packages/backend/prisma/dev.db" ]; then
  echo "Creating local database..."
  npm run -w backend prisma:migrate:dev
  npm run -w backend seed
fi

(
  sleep 8
  DESKTOP_URL="$DESKTOP_URL" node scripts/open-web.mjs >/dev/null 2>&1
) &

echo
echo "$APP_NAME is installed at:"
echo "  $INSTALL_DIR"
echo
echo "Opening:"
echo "  $DESKTOP_URL"
echo
echo "Keep this window open while using the application."
echo "Press Ctrl+C here to stop it."
echo

npm run dev

exit $?

__BAR_RESTAURANT_TICKETING_PAYLOAD_BELOW__
${payload}
`;

writeFileSync(outputPath, launcher, { mode: 0o755 });
rmSync(stagingDir, { force: true, recursive: true });
rmSync(payloadPath, { force: true });

console.log(`Created ${outputPath}`);
console.log('');
console.log('Move this single file to another Linux computer and run it:');
console.log(`  ${outputPath}`);
console.log('');
console.log(`First launch checks Node.js ${requiredNodeVersion} through ${maxNodeMajor}.x/npm, installs exact locked npm libraries, prepares Prisma, and starts the app.`);
