import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function printQrCode(url, heading, fallbackLabel) {
  try {
    const { printQRCode } = require(resolve(
      repoRoot,
      'node_modules',
      '@expo',
      'cli',
      'build',
      'src',
      'utils',
      'qr.js',
    ));
    console.log(`\n${heading}`);
    printQRCode(url).print();
    console.log(`${fallbackLabel}: ${url}\n`);
  } catch {
    console.log(`\n${fallbackLabel}: ${url}\n`);
  }
}

export function printExpoGoLink(url) {
  // Headless Expo avoids Electron DevTools but hides its QR display.
  printQrCode(url, 'Scan this QR code to open the phone POS in Expo Go:', 'Metro');
}

export function printInstalledAppPairingCode(url) {
  printQrCode(
    url,
    'Installed Android app: tap Conectar and scan this code to pair with this computer:',
    'Pairing address'
  );
}
