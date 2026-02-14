// Inject into page context so home.js can call window.__abbaPrintReceipt(html)
var script = document.createElement('script');
script.textContent = [
  'window.__abbaPrintReceipt = function(html) {',
  '  if (typeof html !== "string") return;',
  '  window.postMessage({ type: "ABBA_EXTENSION_PRINT", html: html }, "*");',
  '};'
].join('\n');
(document.head || document.documentElement).appendChild(script);
script.remove();

// Content script: receive postMessage from page and send to background
window.addEventListener('message', function (event) {
  if (event.source !== window || !event.data || event.data.type !== 'ABBA_EXTENSION_PRINT') return;
  chrome.runtime.sendMessage({ type: 'PRINT_RECEIPT', html: event.data.html });
});
