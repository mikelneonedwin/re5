const ALARM_NAME = 'check_downloads_backup';
const BACKUP_INTERVAL_MINUTES = 40 / 60; // 40 seconds (~0.6667 minutes)
const TARGET_CONCURRENCY = 5;
const RESUME_COOLDOWN_MS = 5000;

const NETWORK_ERROR_CODES = new Set([
  'NETWORK_FAILED',
  'NETWORK_TIMEOUT',
  'NETWORK_DISCONNECTED',
  'NETWORK_SERVER_DOWN',
  'NETWORK_INVALID_REQUEST'
]);

const lastAttemptTimestamps = new Map();
let isReconciling = false;

async function getSettings() {
  const localData = await chrome.storage.local.get({
    monitoringEnabled: true,
    targetConcurrency: TARGET_CONCURRENCY
  });
  const sessionData = await chrome.storage.session.get({
    clearCompletedHistory: false
  });
  return {
    ...localData,
    ...sessionData
  };
}

function updateBadge(enabled, activeCount = 0, queuedCount = 0) {
  if (!enabled) {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#64748B' });
    chrome.action.setTitle({ title: 're5: Monitoring paused' });
    return;
  }

  let badgeText = '';
  if (activeCount > 0) {
    badgeText = String(activeCount);
  } else if (queuedCount > 0) {
    badgeText = queuedCount > 99 ? '99+' : `!${queuedCount}`;
  }

  chrome.action.setBadgeText({ text: badgeText });
  chrome.action.setBadgeBackgroundColor({
    color: activeCount > 0 ? '#2563EB' : (queuedCount > 0 ? '#E11D48' : '#10B981')
  });
  chrome.action.setTitle({
    title: `re5: ${activeCount} active, ${queuedCount} awaiting retry`
  });
}

async function resumeCandidate(item, now) {
  lastAttemptTimestamps.set(item.id, now);
  if (item.canResume) {
    try {
      await chrome.downloads.resume(item.id);
    } catch (error) {
      console.warn(`Failed to resume download ${item.id}:`, error);
    }
  } else {
    try {
      await chrome.downloads.download({
        url: item.url,
        conflictAction: 'uniquify'
      });
      await chrome.downloads.erase({ id: item.id });
      lastAttemptTimestamps.delete(item.id);
    } catch (error) {
      console.warn(`Failed to restart non-resumable download ${item.id}:`, error);
    }
  }
}

async function reconcileDownloads(forceCooldownBypass = false) {
  if (isReconciling) {
    return;
  }
  isReconciling = true;

  try {
    const settings = await getSettings();
    if (!settings.monitoringEnabled) {
      updateBadge(false);
      return;
    }

    const allItems = await chrome.downloads.search({});

    const activeItems = allItems.filter(item => item.state === 'in_progress' && !item.paused);
    const interruptedCandidates = allItems
      .filter(item => {
        if (item.state !== 'interrupted') {
          return false;
        }
        return item.error && NETWORK_ERROR_CODES.has(item.error);
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    updateBadge(true, activeItems.length, interruptedCandidates.length);

    let activeCount = activeItems.length;
    const capacityNeeded = (settings.targetConcurrency || TARGET_CONCURRENCY) - activeCount;

    if (capacityNeeded <= 0) {
      return;
    }

    const now = Date.now();
    const readyCandidates = interruptedCandidates.filter(item => {
      if (forceCooldownBypass) {
        return true;
      }
      const lastAttempt = lastAttemptTimestamps.get(item.id) || 0;
      return (now - lastAttempt) >= RESUME_COOLDOWN_MS;
    });

    const toResume = readyCandidates.slice(0, capacityNeeded);
    await Promise.allSettled(toResume.map(item => resumeCandidate(item, now)));
  } catch (error) {
    console.error('Error during reconciliation loop:', error);
  } finally {
    isReconciling = false;
  }
}

chrome.downloads.onCreated.addListener(() => {
  reconcileDownloads();
});

chrome.downloads.onChanged.addListener(async (delta) => {
  if (delta.state && delta.state.current === 'complete') {
    const settings = await getSettings();
    if (settings.clearCompletedHistory) {
      try {
        await chrome.downloads.erase({ id: delta.id });
      } catch (error) {
        console.warn(`Failed to erase download history for item ${delta.id}:`, error);
      }
    }
  }

  if (delta.state || delta.error || delta.paused) {
    reconcileDownloads();
  }
});

chrome.downloads.onErased.addListener(downloadId => {
  lastAttemptTimestamps.delete(downloadId);
});

async function clearAllCompletedHistory() {
  try {
    const erasedIds = await chrome.downloads.erase({ state: 'complete' });
    console.log(`Erased ${erasedIds?.length || 0} completed downloads from history.`);
  } catch (error) {
    console.warn('Failed to erase completed downloads history:', error);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'RECONCILE_NOW') {
    reconcileDownloads(true).then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (message && message.type === 'CLEAR_COMPLETED_NOW') {
    clearAllCompletedHistory().then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === ALARM_NAME) {
    reconcileDownloads();
  }
});

function setupAlarm() {
  chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: BACKUP_INTERVAL_MINUTES
  });
}

chrome.runtime.onInstalled.addListener(() => {
  setupAlarm();
  reconcileDownloads();
});

chrome.runtime.onStartup.addListener(() => {
  setupAlarm();
  reconcileDownloads();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' || areaName === 'session') {
    reconcileDownloads();
  }
});

setupAlarm();
reconcileDownloads();
