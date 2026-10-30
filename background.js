const ALARM_NAME = 'check_downloads_backup';
const BACKUP_INTERVAL_MINUTES = 40 / 60; // 40 seconds (~0.6667 minutes)
const TARGET_CONCURRENCY = 5;
const RESUME_COOLDOWN_MS = 5000;

const NETWORK_ERROR_CODES = new Set([
  'NETWORK_DISCONNECTED'
]);

const lastAttemptTimestamps = new Map();
let isReconciling = false;

async function getSettings() {
  const data = await chrome.storage.local.get({
    monitoringEnabled: true,
    sessionStartTime: null,
    targetConcurrency: TARGET_CONCURRENCY
  });
  return data;
}

function updateBadge(enabled, activeCount = 0, queuedCount = 0) {
  if (!enabled) {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#777777' });
    return;
  }
  const badgeText = queuedCount > 0 ? `${activeCount}/${queuedCount}` : `${activeCount}`;
  chrome.action.setBadgeText({ text: badgeText });
  chrome.action.setBadgeBackgroundColor({ color: '#2563EB' });
}

async function reconcileDownloads() {
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

    const searchQuery = {};
    if (settings.sessionStartTime) {
      searchQuery.startedAfter = settings.sessionStartTime;
    }

    const allItems = await chrome.downloads.search(searchQuery);

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
      const lastAttempt = lastAttemptTimestamps.get(item.id) || 0;
      return (now - lastAttempt) >= RESUME_COOLDOWN_MS;
    });

    const toResume = readyCandidates.slice(0, capacityNeeded);
    for (const item of toResume) {
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
  } catch (error) {
    console.error('Error during reconciliation loop:', error);
  } finally {
    isReconciling = false;
  }
}

chrome.downloads.onCreated.addListener(() => {
  reconcileDownloads();
});

chrome.downloads.onChanged.addListener(delta => {
  if (delta.state || delta.error || delta.paused) {
    reconcileDownloads();
  }
});

chrome.downloads.onErased.addListener(downloadId => {
  lastAttemptTimestamps.delete(downloadId);
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
  if (areaName === 'local') {
    reconcileDownloads();
  }
});

setupAlarm();
reconcileDownloads();
