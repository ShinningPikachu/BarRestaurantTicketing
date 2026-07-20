import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  createReadStream,
  createWriteStream,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { assertSafeReleaseTree, createReleaseCopyFilter } from './package-safety.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = process.env.BAR_TICKETING_LINUX_OUTPUT
  ? resolve(process.env.BAR_TICKETING_LINUX_OUTPUT)
  : join(repoRoot, '.dist', 'BarRestaurantTicketing-linux.run');
const distDir = dirname(outputPath);
const stagingDir = mkdtempSync(join(tmpdir(), 'bar-restaurant-ticketing-portable-'));
const appDir = join(stagingDir, 'app');
const payloadPath = join(stagingDir, 'BarRestaurantTicketing-payload.tar.gz');
const temporaryOutputPath = join(distDir, `.${basename(outputPath)}.${process.pid}.tmp`);
const includeNodeModules = process.argv.includes('--include-node-modules');
const requiredNodeVersion = '20.19.4';
const maxNodeMajor = '22';
const copyFilter = createReleaseCopyFilter(repoRoot, { includeNodeModules });

function assertSupportedNodeVersion() {
  const current = process.versions.node.split('.').map(Number);
  const required = requiredNodeVersion.split('.').map(Number);
  const highEnough = current[0] > required[0]
    || (current[0] === required[0]
      && (current[1] > required[1] || (current[1] === required[1] && current[2] >= required[2])));
  if (!highEnough || current[0] > Number(maxNodeMajor)) {
    throw new Error(
      `Build Linux packages with Node.js ${requiredNodeVersion} through ${maxNodeMajor}.x; current version is ${process.version}.`,
    );
  }
}

assertSupportedNodeVersion();

mkdirSync(distDir, { recursive: true });
mkdirSync(appDir, { recursive: true });

const launcher = `#!/usr/bin/env bash
set -euo pipefail

APP_NAME="BarRestaurantTicketing"
INSTALL_DIR="\${BAR_TICKETING_HOME:-$HOME/.local/share/BarRestaurantTicketing}"
INSTALL_PARENT="$(dirname "$INSTALL_DIR")"
PREVIOUS_DIR="$INSTALL_PARENT/.BarRestaurantTicketing-previous"
BUNDLED_NODE_MODULES="${includeNodeModules ? '1' : '0'}"
SELF_PATH="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
UPDATE_DIR=""
READY_PID=""
PUBLISH_COMPLETE="0"

cleanup() {
  if [ -n "$READY_PID" ]; then
    kill "$READY_PID" >/dev/null 2>&1 || true
  fi
  if [ -n "$UPDATE_DIR" ]; then
    rm -rf "$UPDATE_DIR"
  fi
  if [ -e "$PREVIOUS_DIR" ] && [ ! -e "$INSTALL_DIR" ]; then
    mv "$PREVIOUS_DIR" "$INSTALL_DIR" || true
  elif [ "$PUBLISH_COMPLETE" = "1" ] && [ -e "$PREVIOUS_DIR" ]; then
    rm -rf "$PREVIOUS_DIR"
  fi
}
trap cleanup EXIT

echo "Preparing $APP_NAME..."
echo

if [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh"
  nvm use --silent ${maxNodeMajor} >/dev/null 2>&1 || true
fi

if ! command -v tar >/dev/null 2>&1; then
  echo "tar is required to unpack this application."
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

if ! node -e "const major = Number(process.argv[1].split('.')[0]); process.exit(major >= 10 ? 0 : 1)" "$(npm --version)"; then
  echo "npm 10 or newer is required. Current version: $(npm --version)"
  exit 1
fi

mkdir -p "$INSTALL_PARENT"
if [ -e "$PREVIOUS_DIR" ] && [ ! -e "$INSTALL_DIR" ]; then
  echo "Recovering the previous installation after an interrupted update..."
  mv "$PREVIOUS_DIR" "$INSTALL_DIR"
elif [ -e "$PREVIOUS_DIR" ] && [ -e "$INSTALL_DIR" ]; then
  rm -rf "$PREVIOUS_DIR"
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
    node scripts/wait-for-ready.mjs
    node scripts/open-web.mjs
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

UPDATE_DIR="$(mktemp -d "$INSTALL_PARENT/.BarRestaurantTicketing-update.XXXXXX")"

if [ -f "$INSTALL_DIR/.env" ]; then
  cp -p "$INSTALL_DIR/.env" "$UPDATE_DIR/.env"
fi

if [ -f "$INSTALL_DIR/packages/backend/prisma/dev.db" ]; then
  mkdir -p "$UPDATE_DIR/.preserved-prisma"
  for suffix in "" "-journal" "-wal" "-shm"; do
    source_file="$INSTALL_DIR/packages/backend/prisma/dev.db$suffix"
    if [ -f "$source_file" ]; then
      cp -p "$source_file" "$UPDATE_DIR/.preserved-prisma/dev.db$suffix"
    fi
  done
fi

if [ -d "$INSTALL_DIR/packages/backend/prisma/backups" ]; then
  mkdir -p "$UPDATE_DIR/.preserved-prisma"
  cp -a "$INSTALL_DIR/packages/backend/prisma/backups" "$UPDATE_DIR/.preserved-prisma/backups"
fi

PAYLOAD_LINE="$(awk '/^__BAR_RESTAURANT_TICKETING_PAYLOAD_BELOW__$/ { print NR + 1; exit 0; }' "$SELF_PATH")"
if [ -z "$PAYLOAD_LINE" ]; then
  echo "The application payload marker is missing."
  exit 1
fi
tail -n +"$PAYLOAD_LINE" "$SELF_PATH" | tar -xzf - -C "$UPDATE_DIR" --strip-components=1

for preserved_file in "$UPDATE_DIR/.preserved-prisma"/dev.db*; do
  if [ -f "$preserved_file" ]; then
    cp -p "$preserved_file" "$UPDATE_DIR/packages/backend/prisma/$(basename "$preserved_file")"
  fi
done
if [ -d "$UPDATE_DIR/.preserved-prisma/backups" ]; then
  mkdir -p "$UPDATE_DIR/packages/backend/prisma"
  cp -a "$UPDATE_DIR/.preserved-prisma/backups" "$UPDATE_DIR/packages/backend/prisma/backups"
fi
rm -rf "$UPDATE_DIR/.preserved-prisma"

cd "$UPDATE_DIR"

if [ "$BUNDLED_NODE_MODULES" = "1" ]; then
  node scripts/ensure-dependencies.mjs --record-only
else
  node scripts/ensure-dependencies.mjs
fi
node scripts/ensure-runtime-env.mjs
node scripts/build-production.mjs
node scripts/validate-production-env.mjs
node scripts/prepare-database.mjs

cat > "$UPDATE_DIR/Start_BarRestaurantTicketing.desktop" <<DESKTOP
[Desktop Entry]
Version=1.0
Type=Application
Name=Start BarRestaurantTicketing
Comment=Start the local BarRestaurantTicketing POS application
Exec="$INSTALL_DIR/Start_BarRestaurantTicketing.sh"
Path="$INSTALL_DIR"
Terminal=true
Categories=Office;
DESKTOP

cat > "$UPDATE_DIR/Stop_BarRestaurantTicketing.desktop" <<DESKTOP
[Desktop Entry]
Version=1.0
Type=Application
Name=Stop BarRestaurantTicketing
Comment=Stop the local BarRestaurantTicketing POS application
Exec="$INSTALL_DIR/Stop_BarRestaurantTicketing.sh"
Path="$INSTALL_DIR"
Terminal=true
Categories=Office;
DESKTOP

chmod +x "$UPDATE_DIR/Start_BarRestaurantTicketing.sh" "$UPDATE_DIR/Stop_BarRestaurantTicketing.sh" "$UPDATE_DIR/Start_BarRestaurantTicketing.desktop" "$UPDATE_DIR/Stop_BarRestaurantTicketing.desktop"

if [ -e "$PREVIOUS_DIR" ]; then
  echo "A previous update backup is still present at $PREVIOUS_DIR; refusing to overwrite it."
  exit 1
fi
if [ -e "$INSTALL_DIR" ]; then
  mv "$INSTALL_DIR" "$PREVIOUS_DIR"
fi
if ! mv "$UPDATE_DIR" "$INSTALL_DIR"; then
  if [ -e "$PREVIOUS_DIR" ] && [ ! -e "$INSTALL_DIR" ]; then
    mv "$PREVIOUS_DIR" "$INSTALL_DIR"
  fi
  echo "Could not publish the prepared update; the previous installation was restored."
  exit 1
fi
UPDATE_DIR=""
PUBLISH_COMPLETE="1"
rm -rf "$PREVIOUS_DIR"
PUBLISH_COMPLETE="0"

cd "$INSTALL_DIR"

(
  node scripts/wait-for-ready.mjs && node scripts/open-web.mjs
) &
READY_PID=$!

echo
echo "$APP_NAME is installed at:"
echo "  $INSTALL_DIR"
echo
echo "The configured desktop POS will open when it is ready."
echo
echo "Keep this window open while using the application."
echo "Press Ctrl+C here to stop it."
echo

set +e
npm run start:production
RUN_STATUS=$?
set -e
READY_PID=""
exit "$RUN_STATUS"

__BAR_RESTAURANT_TICKETING_PAYLOAD_BELOW__
`;

try {
  cpSync(repoRoot, appDir, {
    recursive: true,
    filter: copyFilter,
    verbatimSymlinks: true,
  });
  assertSafeReleaseTree(appDir, { includeNodeModules });
  console.log('Verified Linux package contents: no runtime databases, journals, backups, or private environment files.');

  execFileSync('tar', ['-czf', payloadPath, '-C', stagingDir, 'app'], { stdio: 'inherit' });
  writeFileSync(temporaryOutputPath, launcher, { mode: 0o755 });
  await pipeline(
    createReadStream(payloadPath),
    createWriteStream(temporaryOutputPath, { flags: 'a' }),
  );
  chmodSync(temporaryOutputPath, 0o755);
  renameSync(temporaryOutputPath, outputPath);
} finally {
  rmSync(temporaryOutputPath, { force: true });
  rmSync(stagingDir, { force: true, recursive: true });
}

console.log(`Created ${outputPath}`);
console.log('');
console.log('Move this single file to another Linux computer and run it:');
console.log(`  ${outputPath}`);
console.log('');
console.log(`First launch checks Node.js ${requiredNodeVersion} through ${maxNodeMajor}.x/npm, installs exact locked npm libraries, prepares Prisma, and starts the app.`);
