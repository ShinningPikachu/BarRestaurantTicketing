export function getReadinessConfig(env = process.env) {
  const backendPort = env.PORT || '3000';
  const desktopPort = env.DESKTOP_EXPO_PORT || '8081';
  const parsedTimeout = Number(env.BAR_TICKETING_STARTUP_TIMEOUT_MS || '60000');
  return {
    backendHealthUrl: env.BACKEND_HEALTH_URL || `http://127.0.0.1:${backendPort}/health`,
    desktopUrl: env.DESKTOP_URL || `http://127.0.0.1:${desktopPort}`,
    timeoutMs: Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 60000,
  };
}
