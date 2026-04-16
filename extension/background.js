// Side panel behavior — don't auto-open on click since we use a popup menu
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });

const SERVER_URL = 'http://localhost:3456';
const NATIVE_HOST = 'com.hemingweight.server';

// Ensure the server is running, starting it via native messaging if needed.
// Returns { ok: true } or { ok: false, error: string }.
async function ensureServer() {
  // First, check if it's already running
  try {
    const res = await fetch(`${SERVER_URL}/api/health`, { signal: AbortSignal.timeout(2000) });
    const data = await res.json();
    if (data.status === 'ok') return { ok: true };
  } catch {
    // Server not running — try to start it
  }

  // Launch via native messaging
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendNativeMessage(NATIVE_HOST, { type: 'start' }, (response) => {
        if (chrome.runtime.lastError) {
          const detail = chrome.runtime.lastError.message;
          resolve({
            ok: false,
            error: `Native messaging error: ${detail}`,
            detail,
          });
          return;
        }
        if (response && response.status === 'ok') {
          resolve({ ok: true });
        } else {
          resolve({
            ok: false,
            error: response ? response.message : 'No response from native host',
          });
        }
      });
    } catch (err) {
      resolve({ ok: false, error: err.message });
    }
  });
}

// Handle messages from sidepanel
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'ensure-server') {
    ensureServer().then(sendResponse);
    return true; // async response
  }
});

// Click extension icon → ensure server → open window
chrome.action.onClicked.addListener(async () => {
  const result = await ensureServer();
  if (result.ok) {
    chrome.windows.create({
      url: 'http://localhost:3456',
      type: 'popup',
      width: 1400,
      height: 900,
      left: 100,
      top: 100,
    });
  }
});
