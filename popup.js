const KEY_ENABLED = 'cfr_enabled';
const KEY_LANG    = 'cfr_lang';

const LANG_LABELS = { cpp: 'C++17', python: 'Python 3', java: 'Java' };

const stage     = document.getElementById('stage');
const btnEnable = document.getElementById('btn-enable');
const btnDisable = document.getElementById('btn-disable');
const onBody    = document.getElementById('on-body');

let currentEnabled = false;
let currentOnCF    = false;
let currentLang    = 'cpp';

function isCFProblemTab(url) {
  return /codeforces\.com\/(problemset\/problem\/|(contest|gym)\/\d+\/problem\/)/.test(url || '');
}

function renderOnBody(onCF, lang) {
  onBody.innerHTML = '';

  if (!onCF) {
    const msg = document.createElement('div');
    msg.className   = 'not-cf';
    msg.textContent = 'Open a Codeforces problem page and the split view will load automatically.';
    onBody.appendChild(msg);
    return;
  }

  onBody.innerHTML = `
    <div class="info-row">
      <span class="info-k">Language</span>
      <span class="info-v">${LANG_LABELS[lang] ?? 'C++17'}</span>
    </div>
    <div class="sc-block">
      <div class="sc-row">
        <span class="sc-name">Run samples</span>
        <div class="keys"><kbd>Ctrl</kbd><kbd>'</kbd></div>
      </div>
      <div class="sc-row">
        <span class="sc-name">Submit</span>
        <div class="keys"><kbd>Ctrl</kbd><kbd>Enter</kbd></div>
      </div>
    </div>`;
}

function applyState(enabled, onCF, lang) {
  stage.classList.toggle('show-on', enabled);
  if (enabled) renderOnBody(onCF, lang);
}

function notifyActiveTab(enabled) {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab || !isCFProblemTab(tab.url)) return;
    chrome.tabs.sendMessage(tab.id, { type: 'cfr:toggle', enabled }, () => void chrome.runtime.lastError);
  });
}

btnEnable.addEventListener('click', () => {
  currentEnabled = true;
  chrome.storage.local.set({ [KEY_ENABLED]: true }, () => {
    applyState(true, currentOnCF, currentLang);
    notifyActiveTab(true);
  });
});

btnDisable.addEventListener('click', () => {
  currentEnabled = false;
  chrome.storage.local.set({ [KEY_ENABLED]: false }, () => {
    applyState(false, currentOnCF, currentLang);
    notifyActiveTab(false);
  });
});

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  currentOnCF = isCFProblemTab(tab?.url);
  chrome.storage.local.get([KEY_ENABLED, KEY_LANG], result => {
    currentEnabled = result[KEY_ENABLED] !== false;
    currentLang    = result[KEY_LANG] || 'cpp';
    applyState(currentEnabled, currentOnCF, currentLang);
  });
});
