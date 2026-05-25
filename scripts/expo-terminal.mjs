import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function printExpoGoLink(url) {
  try {
    // Headless Expo avoids Electron DevTools but hides its QR display.
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
    console.log('\nScan this QR code to open the phone POS in Expo Go:');
    printQRCode(url).print();
    console.log(`Metro: ${url}\n`);
  } catch {
    console.log(`\nOpen this link in Expo Go on your phone: ${url}\n`);
  }
}
