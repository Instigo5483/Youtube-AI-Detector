// popup.js

document.addEventListener('DOMContentLoaded', () => {
  const toggleComments = document.getElementById('toggle-comments');
  const rescanBtn      = document.getElementById('rescan-btn');

  // ── Load persisted settings ─────────────────────────────────────────────────
  chrome.storage.local.get(['moduleState'], (result) => {
    const ms = result.moduleState || {};
    if (ms.comments !== undefined) toggleComments.checked = ms.comments;
  });

  // ── Module toggle ───────────────────────────────────────────────────────────
  toggleComments.addEventListener('change', () => {
    chrome.storage.local.set({
      moduleState: { comments: toggleComments.checked },
    });
  });

  // ── Re-scan current tab ─────────────────────────────────────────────────────
  rescanBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab) return;

      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          document.querySelectorAll('[data-ytabd]').forEach(el => el.removeAttribute('data-ytabd'));
          document.querySelectorAll('.ytabd-badge').forEach(el => el.remove());
          window.dispatchEvent(new CustomEvent('yt-navigate-finish'));
        },
      });

      rescanBtn.textContent = 'Scanning…';
      setTimeout(() => { rescanBtn.textContent = 'Re-scan Comments'; }, 1500);
    });
  });
});
