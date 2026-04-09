const loadingEl = document.getElementById('loading');
const appFrame = document.getElementById('app');

// Ensure server is running before loading the iframe
chrome.runtime.sendMessage({ type: 'ensure-server' }, (result) => {
  if (result && result.ok) {
    loadingEl.style.display = 'none';
    appFrame.style.display = 'block';
    appFrame.src = 'http://localhost:3456?embed=1';
  } else {
    loadingEl.classList.add('error');
    loadingEl.textContent = result ? result.error : 'Could not start server';
  }
});

// Listen for close message from the iframe
window.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'clawable-close') {
    window.close();
  }
});
