import os from 'node:os';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getHostIp } from './network-address.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const frontendDir = resolve(repoRoot, 'packages/frontend');
const androidDir = resolve(frontendDir, 'android');
const gradleUserHome = resolve(repoRoot, '.gradle');
const requiredNodeVersion = '20.19.4';
const maxNodeMajor = 22;
const requiredSdkPackages = [
  ['platforms/android-36', 'platforms;android-36'],
  ['build-tools/36.0.0', 'build-tools;36.0.0'],
  ['cmake/3.22.1', 'cmake;3.22.1'],
  ['ndk/27.1.12297006', 'ndk;27.1.12297006'],
];

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function assertSupportedNodeVersion() {
  const current = process.versions.node.split('.').map(Number);
  const required = requiredNodeVersion.split('.').map(Number);
  const highEnough = current[0] > required[0]
    || (current[0] === required[0]
      && (current[1] > required[1] || (current[1] === required[1] && current[2] >= required[2])));

  if (highEnough && current[0] <= maxNodeMajor) {
    return;
  }

  console.error(`Node.js ${requiredNodeVersion} through ${maxNodeMajor}.x is required for the Android build.`);
  console.error(`Current Node.js version: ${process.version}`);
  console.error('Install/use Node 20 LTS, then reinstall dependencies and rebuild.');
  process.exit(1);
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      ...options,
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}`));
      }
    });

    child.on('error', reject);
  });
}

function ensureAndroidCleartextTraffic() {
  const manifestPath = resolve(androidDir, 'app/src/main/AndroidManifest.xml');
  if (!existsSync(manifestPath)) {
    console.warn(`Android manifest was not found at ${manifestPath}`);
    return;
  }

  const manifest = readFileSync(manifestPath, 'utf8');
  if (manifest.includes('android:usesCleartextTraffic=')) {
    return;
  }

  const updatedManifest = manifest.replace(
    /<application\b/,
    '<application android:usesCleartextTraffic="true"'
  );

  if (updatedManifest === manifest) {
    console.warn('Could not add android:usesCleartextTraffic to AndroidManifest.xml');
    return;
  }

  writeFileSync(manifestPath, updatedManifest, 'utf8');
  console.log('Enabled Android cleartext HTTP traffic for local backend access.');
}

assertSupportedNodeVersion();
loadEnvFile(resolve(repoRoot, '.env'));
loadEnvFile(resolve(frontendDir, '.env'));

const backendPort = process.env.PORT || '3000';
const detectedLanIp = getHostIp();
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || (detectedLanIp ? `http://${detectedLanIp}:${backendPort}/api` : undefined);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const gradleCommand = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const linuxJava17Homes = [
  '/usr/lib/jvm/java-17-openjdk-amd64',
  '/usr/lib/jvm/java-1.17.0-openjdk-amd64',
  '/usr/lib/jvm/openjdk-17',
];
const javaHome = linuxJava17Homes.find((path) => existsSync(path)) || process.env.JAVA_HOME;
const androidSdkHomes = [
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  resolve(os.homedir(), 'Android/Sdk'),
  resolve(os.homedir(), 'Library/Android/sdk'),
  '/usr/lib/android-sdk',
  '/opt/android-sdk',
].filter(Boolean);

function findSdkManager(sdkHome) {
  if (!sdkHome) {
    return undefined;
  }

  const candidates = [
    join(sdkHome, 'cmdline-tools/latest/bin/sdkmanager'),
    join(sdkHome, 'cmdline-tools/bin/sdkmanager'),
    join(sdkHome, 'tools/bin/sdkmanager'),
  ];

  const directMatch = candidates.find((path) => existsSync(path));
  if (directMatch) {
    return directMatch;
  }

  const cmdlineToolsDir = join(sdkHome, 'cmdline-tools');
  if (!existsSync(cmdlineToolsDir)) {
    return undefined;
  }

  return readdirSync(cmdlineToolsDir)
    .map((name) => join(cmdlineToolsDir, name, 'bin/sdkmanager'))
    .find((path) => existsSync(path));
}

function getMissingSdkPackages(sdkHome) {
  if (!sdkHome) {
    return requiredSdkPackages.map(([, packageName]) => packageName);
  }

  return requiredSdkPackages
    .filter(([relativePath]) => !existsSync(join(sdkHome, relativePath)))
    .map(([, packageName]) => packageName);
}

const androidHome = androidSdkHomes.find((path) => existsSync(path) && findSdkManager(path))
  || androidSdkHomes.find((path) => existsSync(path));
const sdkManager = findSdkManager(androidHome);

if (!apiBaseUrl) {
  console.error('Could not detect your LAN IP for the Android app backend URL.');
  console.error('Run the build with an explicit URL, for example:');
  console.error('EXPO_PUBLIC_API_BASE_URL=http://192.168.1.50:3000/api npm run android:apk');
  process.exit(1);
}

const buildEnv = {
  ...process.env,
  ...(javaHome ? { JAVA_HOME: javaHome } : {}),
  ...(androidHome ? { ANDROID_HOME: androidHome, ANDROID_SDK_ROOT: androidHome } : {}),
  GRADLE_USER_HOME: process.env.GRADLE_USER_HOME || gradleUserHome,
  EXPO_PUBLIC_API_BASE_URL: apiBaseUrl,
  EXPO_PUBLIC_TPV_SCREEN: 'mobile',
};

console.log(`Building Android APK with API URL: ${apiBaseUrl}`);
if (!process.env.EXPO_PUBLIC_API_BASE_URL && process.env.BAR_TICKETING_HOST_IP) {
  console.log(`Using BAR_TICKETING_HOST_IP: ${process.env.BAR_TICKETING_HOST_IP}`);
}
if (javaHome) {
  console.log(`Using JAVA_HOME: ${javaHome}`);
}
if (androidHome) {
  console.log(`Using ANDROID_HOME: ${androidHome}`);
} else {
  console.warn('ANDROID_HOME was not found. Install Android Studio or set ANDROID_HOME before building.');
}
console.log('Tip: set EXPO_PUBLIC_API_BASE_URL in .env if this phone should use a fixed backend URL.');

if (!sdkManager) {
  console.error(`\nAndroid SDK command-line tools were not found${androidHome ? ` in ${androidHome}` : ''}.`);
  console.error('Install Android SDK Command-line Tools, accept licenses, and install the required packages:');
  console.error('  sudo apt install google-android-cmdline-tools-13.0-installer');
  console.error('  sudo env JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 /usr/lib/android-sdk/cmdline-tools/13.0/bin/sdkmanager --licenses');
  console.error('  sudo env JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 /usr/lib/android-sdk/cmdline-tools/13.0/bin/sdkmanager "platforms;android-36" "build-tools;36.0.0" "ndk;27.1.12297006"');
  process.exit(1);
}

const missingSdkPackages = getMissingSdkPackages(androidHome);
if (missingSdkPackages.length > 0) {
  console.error(`\nAndroid SDK is missing required package${missingSdkPackages.length === 1 ? '' : 's'}:`);
  for (const packageName of missingSdkPackages) {
    console.error(`  - ${packageName}`);
  }
  console.error('Install/accept them with:');
  console.error(`  sudo env JAVA_HOME=${javaHome || '/usr/lib/jvm/java-17-openjdk-amd64'} ${sdkManager} --licenses`);
  console.error(`  sudo env JAVA_HOME=${javaHome || '/usr/lib/jvm/java-17-openjdk-amd64'} ${sdkManager} ${missingSdkPackages.map((packageName) => `"${packageName}"`).join(' ')}`);
  process.exit(1);
}

await run(npmCommand, ['run', 'android:prebuild', '-w', 'frontend', '--', '--clean'], {
  cwd: repoRoot,
  env: buildEnv,
});

ensureAndroidCleartextTraffic();

await run(gradleCommand, ['assembleRelease'], {
  cwd: androidDir,
  env: buildEnv,
});

console.log('\nAPK ready: packages/frontend/android/app/build/outputs/apk/release/app-release.apk');
console.log('Install with: adb install -r packages/frontend/android/app/build/outputs/apk/release/app-release.apk');
