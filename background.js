// Service Worker — handles install-time defaults only

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.storage.local.set({
      moduleState: { comments: true },
      panelDock: 'right',
    });
  }
});
