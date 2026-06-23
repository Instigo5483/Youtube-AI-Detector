// popup.js

document.addEventListener('DOMContentLoaded', () => {
  const toggleComments = document.getElementById('toggle-comments');
  const toggleVideos   = document.getElementById('toggle-videos');
  const toggleShorts   = document.getElementById('toggle-shorts');
  const channelInput   = document.getElementById('channel-input');
  const addChannelBtn  = document.getElementById('add-channel');
  const channelList    = document.getElementById('channel-list');
  const noChannels     = document.getElementById('no-channels');
  const rescanBtn      = document.getElementById('rescan-btn');

  let channels = [];

  // ── Load persisted settings ─────────────────────────────────────────────────

  chrome.storage.local.get(['moduleState', 'flaggedChannels'], (result) => {
    const ms = result.moduleState || {};
    if (ms.comments !== undefined) toggleComments.checked = ms.comments;
    if (ms.videos   !== undefined) toggleVideos.checked   = ms.videos;
    if (ms.shorts   !== undefined) toggleShorts.checked   = ms.shorts;

    channels = result.flaggedChannels || [];
    renderChannels();
  });

  // ── Module toggles ──────────────────────────────────────────────────────────

  function saveModuleState() {
    chrome.storage.local.set({
      moduleState: {
        comments: toggleComments.checked,
        videos:   toggleVideos.checked,
        shorts:   toggleShorts.checked,
      },
    });
  }

  toggleComments.addEventListener('change', saveModuleState);
  toggleVideos.addEventListener('change',   saveModuleState);
  toggleShorts.addEventListener('change',   saveModuleState);

  // ── Channel list ────────────────────────────────────────────────────────────

  function renderChannels() {
    channelList.innerHTML = '';
    noChannels.style.display = channels.length === 0 ? 'block' : 'none';

    channels.forEach((ch, i) => {
      const li = document.createElement('li');

      const nameEl = document.createElement('span');
      nameEl.className = 'channel-name';
      nameEl.textContent = ch;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-btn';
      removeBtn.textContent = '×';
      removeBtn.title = `Remove "${ch}"`;
      removeBtn.addEventListener('click', () => {
        channels.splice(i, 1);
        saveChannels();
        renderChannels();
      });

      li.appendChild(nameEl);
      li.appendChild(removeBtn);
      channelList.appendChild(li);
    });
  }

  function saveChannels() {
    chrome.storage.local.set({ flaggedChannels: channels });
  }

  function addChannel() {
    const val = channelInput.value.trim().toLowerCase();
    if (!val || channels.includes(val)) {
      channelInput.focus();
      return;
    }
    channels.push(val);
    saveChannels();
    renderChannels();
    channelInput.value = '';
    channelInput.focus();
  }

  addChannelBtn.addEventListener('click', addChannel);
  channelInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addChannel();
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
      setTimeout(() => { rescanBtn.textContent = 'Re-scan Page'; }, 1500);
    });
  });
});
