const statusEl = document.getElementById('status');
const sidePanelBtn = document.getElementById('side-panel');
const popupWindowBtn = document.getElementById('popup-window');

function setStatus(text, isError) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? '#f87171' : '#a1a1aa';
  statusEl.style.display = 'block';
}

function setButtons(enabled) {
  sidePanelBtn.disabled = !enabled;
  popupWindowBtn.disabled = !enabled;
}

// On popup open, ensure server is running
setButtons(false);
setStatus('Starting server...', false);

chrome.runtime.sendMessage({ type: 'ensure-server' }, (result) => {
  if (result && result.ok) {
    statusEl.style.display = 'none';
    setButtons(true);
  } else {
    const msg = result ? result.error : 'Could not reach server';
    setStatus(msg, true);
    setButtons(false);
  }
});

sidePanelBtn.addEventListener('click', function () {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    chrome.sidePanel.open({ tabId: tabs[0].id });
    window.close();
  });
});

popupWindowBtn.addEventListener('click', function () {
  chrome.windows.create({
    url: 'http://localhost:3456',
    type: 'popup',
    width: 1400,
    height: 900,
    left: 100,
    top: 100,
  });
  window.close();
});
