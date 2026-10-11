(() => {
  'use strict';

  // Включи после развёртывания Cloudflare Worker:
  // 1) вставь URL /heartbeat;
  // 2) поменяй enabled на true.
  window.ODIUM_STATS_CONFIG = Object.freeze({
    enabled: false,
    endpoint: 'https://REPLACE-WITH-YOUR-WORKER.workers.dev/heartbeat',
    heartbeatMs: 60000,
    minSendIntervalMs: 15000
  });
})();
