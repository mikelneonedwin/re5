const monitorToggle = document.getElementById('monitorToggle');
const clearHistoryToggle = document.getElementById('clearHistoryToggle');
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
  const { monitoringEnabled = true, clearCompletedHistory = false, targetConcurrency = 5 } = await chrome.storage.local.get([
    'monitoringEnabled',
    'clearCompletedHistory',
    'targetConcurrency'
  ]);

  monitorToggle.checked = Boolean(monitoringEnabled);
  clearHistoryToggle.checked = Boolean(clearCompletedHistory);
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

clearHistoryToggle.addEventListener('change', async (event) => {
  const enabled = event.target.checked;
  await chrome.storage.local.set({ clearCompletedHistory: enabled });
  if (enabled) {
    try {
      await chrome.runtime.sendMessage({ type: 'CLEAR_COMPLETED_NOW' });
    } catch (error) {
      console.warn('Failed to send CLEAR_COMPLETED_NOW message:', error);
      await chrome.downloads.erase({ state: 'complete' });
    }
  }
  await refreshStats();
});

rescueNowBtn.addEventListener('click', async () => {
  rescueNowBtn.disabled = true;
  rescueNowBtn.textContent = 'Checking...';
  try {
    await chrome.runtime.sendMessage({ type: 'RECONCILE_NOW' });
  } catch (error) {
    console.warn('Direct message failed, triggering storage change instead:', error);
    await chrome.storage.local.set({ lastTrigger: Date.now() });
  } finally {
    await refreshStats();
    rescueNowBtn.disabled = false;
    rescueNowBtn.textContent = 'Run Check Now';
  }
});

document.addEventListener('DOMContentLoaded', refreshStats);
