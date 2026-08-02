import os from 'node:os';
import { config } from '../config/index.js';

const PREFERRED_INTERFACE_PATTERN = /^(en|eth|wl|wlan|wifi)/i;

function getLanAddress(): string | null {
  const candidates: Array<{ name: string; address: string; score: number }> = [];
  let interfaces: ReturnType<typeof os.networkInterfaces>;

  try {
    interfaces = os.networkInterfaces();
  } catch {
    return null;
  }

  for (const [name, addresses] of Object.entries(interfaces)) {
    for (const address of addresses ?? []) {
      if (address.family !== 'IPv4' || address.internal) {
        continue;
      }
      candidates.push({
        name,
        address: address.address,
        score: PREFERRED_INTERFACE_PATTERN.test(name) ? 0 : 1,
      });
    }
  }

  return candidates
    .sort((left, right) => left.score - right.score || left.name.localeCompare(right.name) || left.address.localeCompare(right.address))[0]
    ?.address ?? null;
}

export function getPairingApiBaseUrl(): string | null {
  const configuredHost = process.env.BAR_TICKETING_HOST_IP?.trim();
  const host = configuredHost || getLanAddress();
  if (!host) {
    return null;
  }
  return `http://${host}:${config.port}/api`;
}
