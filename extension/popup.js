document.getElementById('side-panel').addEventListener('click', function () {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    chrome.sidePanel.open({ tabId: tabs[0].id });
    window.close();
  });
});

document.getElementById('popup-window').addEventListener('click', function () {
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
