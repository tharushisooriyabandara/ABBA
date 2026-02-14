chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.type !== 'PRINT_RECEIPT' || !message.html) return;
  var html = message.html;
  var dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
  chrome.tabs.create({ url: dataUrl, active: false }, function (tab) {
    var tabId = tab.id;
    function doPrint() {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: function () { window.print(); }
      }, function () {
        chrome.tabs.remove(tabId);
      });
    }
    chrome.tabs.onUpdated.addListener(function listener(id, info) {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(doPrint, 300);
      }
    });
  });
});
