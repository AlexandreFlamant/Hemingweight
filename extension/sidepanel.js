// Listen for close message from the iframe
window.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'clawable-close') {
    window.close();
  }
});
