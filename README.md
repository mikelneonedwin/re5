# Download Rescue & Queue Manager

A Chromium browser extension that monitors download queues and automatically rescues downloads interrupted by network drops while enforcing a controlled concurrency threshold.

## Features

- **Hook-Driven Reactivity**: Hooks directly into `chrome.downloads.onCreated` and `chrome.downloads.onChanged` to react immediately to connection drops and completions.
- **40-Second Periodic Backup**: Registers a `chrome.alarms` periodic check every 40 seconds (`40 / 60` minutes) to catch any edge cases or missed wakeups comfortably beyond Chromium's 30-second throttling clamp.
- **Always-On Efficiency**: Runs automatically in the background by default while sleeping whenever no download events are active. It consumes negligible CPU and memory.
- **Rapid Retry Prevention**: Features a 5-second per-item debounce cooldown so sustained internet outages cannot trigger a runaway CPU loop.
- **Strict Error Filtering**: Specifically targets `NETWORK_DISCONNECTED` errors (which surface in the Chromium UI as "Failed - Network disconnected"), ignoring user cancellations, 403 Forbidden, 404 Not Found, or server issues.
- **On-Demand Activation**: Controlled via a toggle in the extension popup. When toggled on, it marks the session start time so it only rescues current batch downloads rather than historical failures from days prior.

## Installation

1. Open Chromium, Chrome, Brave, or Edge and navigate to `chrome://extensions`.
2. Enable **Developer mode** via the toggle in the top right.
3. Click **Load unpacked** and select this directory (`re5`).
4. Pin the extension to your toolbar to toggle monitoring and track download counts.
