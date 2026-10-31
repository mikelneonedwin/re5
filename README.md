# re5

A Chromium browser extension that monitors download queues and automatically rescues downloads interrupted by network drops while enforcing a controlled concurrency threshold.

## Features

- **Hook-Driven Reactivity**: Hooks directly into `chrome.downloads.onCreated` and `chrome.downloads.onChanged` to react immediately to connection drops and completions.
- **40-Second Periodic Backup**: Registers a `chrome.alarms` periodic check every 40 seconds (`40 / 60` minutes) to catch any edge cases or missed wakeups comfortably beyond Chromium's 30-second throttling clamp.
- **Always-On Efficiency**: Runs automatically in the background by default while sleeping whenever no download events are active. It consumes negligible CPU and memory.
- **Rapid Retry Prevention**: Features a 5-second per-item debounce cooldown so sustained internet outages cannot trigger a runaway CPU loop.
- **Clear Completed from History**: Optional toggle (session-only, off by default) that removes finished download records from `helium://downloads/` via `chrome.downloads.erase({ id })` immediately upon completion, leaving the downloaded file intact on your disk without cluttering the browser history. Because it is backed by `chrome.storage.session`, it automatically resets to off whenever the browser is closed.
- **On-Demand Activation**: Controlled via a toggle in the extension popup. When toggled on, it marks the session start time so it only rescues current batch downloads rather than historical failures from days prior.

## Installation & Usage (Load Unpacked)

Because this extension is not published on the Chrome Web Store, you can load and run it directly in any Chromium browser (Google Chrome, Brave, Microsoft Edge, Helium, Opera) as an unpacked extension:

### 1. Clone the repository

```bash
git clone https://github.com/mikelneonedwin/re5.git
cd re5
```

### 2. Load into your browser

1. Open your browser and navigate to the extensions management page:
   - Chrome / Brave: `chrome://extensions` or `brave://extensions`
   - Edge: `edge://extensions`
   - Helium: `helium://extensions`
2. Turn on **Developer mode** via the toggle switch in the top-right corner.
3. Click the **Load unpacked** button in the top toolbar.
4. In the directory selection dialog, pick the cloned `re5` folder.

### 3. Using the extension

1. Pin `re5` to your browser toolbar using the extensions puzzle icon.
2. The extension badge tracks active downloads in blue or queued network failures awaiting retry in red (`!count`).
3. Click the extension icon to view the popup interface:
   - **Monitoring Active**: Toggles background queue monitoring on or off.
   - **Clear Completed from History**: Session-only toggle. When turned on, finished downloads are immediately removed from your browser's download shelf (`chrome://downloads` or `helium://downloads`) without deleting the files from disk. It automatically turns off whenever the browser closes.
   - **Run Check Now**: Immediately triggers a check and resumes up to 5 interrupted downloads in parallel.
4. Whenever you pull updates from Git (`git pull`), return to the extensions page and click the reload icon on the `re5` card.
