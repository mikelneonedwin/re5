const monitorToggle = document.getElementById('monitorToggle');
const activeCountEl = document.getElementById('activeCount');
const failedCountEl = document.getElementById('failedCount');
const concurrencyTargetEl = document.getElementById('concurrencyTarget');
const rescueNowBtn = document.getElementById('rescueNowBtn');

const NETWORK_ERROR_CODES = new Set([
  'NETWORK_DISCONNECTED'
]);

async function refreshStats() {
  const { monitoringEnabled = true, targetConcurrency = 5, sessionStartTime = null } = await chrome.storage.local.get([
    'monitoringEnabled',
    'targetConcurrency',
    'sessionStartTime'
  ]);

  monitorToggle.checked = Boolean(monitoringEnabled);
  concurrencyTargetEl.textContent = String(targetConcurrency);

  const query = {};
  if (sessionStartTime) {
    query.startedAfter = sessionStartTime;
  }

  const items = await chrome.downloads.search(query);
  const activeItems = items.filter(item => item.state === 'in_progress' && !item.paused);
  const interruptedItems = items.filter(item => item.state === 'interrupted' && item.error && NETWORK_ERROR_CODES.has(item.error));

  activeCountEl.textContent = String(activeItems.length);
  failedCountEl.textContent = String(interruptedItems.length);
}

monitorToggle.addEventListener('change', async (event) => {
  const enabled = event.target.checked;
  const updates = { monitoringEnabled: enabled };
  if (enabled) {
    updates.sessionStartTime = new Date().toISOString();
  }
  await chrome.storage.local.set(updates);
  await refreshStats();
});

rescueNowBtn.addEventListener('click', async () => {
  await chrome.storage.local.set({ lastTrigger: Date.now() });
  await refreshStats();
});

document.addEventListener('DOMContentLoaded', refreshStats);
