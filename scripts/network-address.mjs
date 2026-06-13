import os from 'node:os';

const PREFERRED_INTERFACE_PATTERN = /^(en|eth|wl|wlan|wifi)/i;

export function getLocalNetworkAddresses() {
  let interfaces;
  try {
    interfaces = os.networkInterfaces();
  } catch (error) {
    console.warn(`Could not inspect network interfaces: ${error.message}`);
    return [];
  }

  const candidates = [];

  for (const [name, addresses] of Object.entries(interfaces)) {
    for (const address of addresses ?? []) {
      if (address.family !== 'IPv4' || address.internal) {
        continue;
      }

      const score = PREFERRED_INTERFACE_PATTERN.test(name) ? 0 : 1;
      candidates.push({ name, address: address.address, score });
    }
  }

  return candidates.sort((left, right) => (
    left.score - right.score
    || left.name.localeCompare(right.name)
    || left.address.localeCompare(right.address)
  ));
}

export function getHostIp(options = {}) {
  const envVarName = options.envVarName ?? 'BAR_TICKETING_HOST_IP';
  const fallback = options.fallback;
  const configuredHostIp = process.env[envVarName]?.trim();

  if (configuredHostIp) {
    return configuredHostIp;
  }

  return getLocalNetworkAddresses()[0]?.address ?? fallback;
}
