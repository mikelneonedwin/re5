const monitorToggle = document.getElementById('monitorToggle');
const activeCountEl = document.getElementById('activeCount');
const failedCountEl = document.getElementById('failedCount');
const concurrencyTargetEl = document.getElementById('concurrencyTarget');
const rescueNowBtn = document.getElementById('rescueNowBtn');

const NETWORK_ERROR_CODES = new Set([
  'NETWORK_FAILED',
  'NETWORK_TIMEOUT',
  'NETWORK_DISCONNECTED',
  'NETWORK_SERVER_DOWN',
  'NETWORK_INVALID_REQUEST'
]);

async function refreshStats() {
  const { monitoringEnabled = true, targetConcurrency = 5 } = await chrome.storage.local.get([
    'monitoringEnabled',
    'targetConcurrency'
  ]);

  monitorToggle.checked = Boolean(monitoringEnabled);
  concurrencyTargetEl.textContent = String(targetConcurrency);

  const items = await chrome.downloads.search({});
  const activeItems = items.filter(item => item.state === 'in_progress' && !item.paused);
  const interruptedItems = items.filter(item => item.state === 'interrupted' && item.error && NETWORK_ERROR_CODES.has(item.error));

  activeCountEl.textContent = String(activeItems.length);
  failedCountEl.textContent = String(interruptedItems.length);
}

monitorToggle.addEventListener('change', async (event) => {
  const enabled = event.target.checked;
  await chrome.storage.local.set({ monitoringEnabled: enabled });
  await refreshStats();
});

rescueNowBtn.addEventListener('click', async () => {
  await chrome.storage.local.set({ lastTrigger: Date.now() });
  await refreshStats();
});

document.addEventListener('DOMContentLoaded', refreshStats);
