// Service Worker — handles install-time defaults only

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.storage.local.set({
      flaggedChannels: [],
      moduleState: {
        comments: true,
        videos: true,
        shorts: true,
      },
    });
  }
});
