const KEY_ENABLED = 'cfr_enabled';
const KEY_LANG    = 'cfr_lang';
const LANG_LABELS = { cpp: 'C++17', python: 'Python 3', java: 'Java' };

const stage      = document.getElementById('stage');
const btnEnable  = document.getElementById('btn-enable');
const btnDisable = document.getElementById('btn-disable');
const onBody     = document.getElementById('on-body');

let currentEnabled = false;
let currentOnCF    = false;
let currentLang    = 'cpp';

function isCFTab(url) {
  return !!(url && url.includes('codeforces.com/problemset/problem/'));
}

function buildOnBody(onCF, lang) {
  onBody.innerHTML = '';

  if (!onCF) {
    const msg = document.createElement('div');
    msg.className = 'not-cf';
    msg.textContent = 'Open a Codeforces problem page and the split view will load automatically.';
    onBody.appendChild(msg);
    return;
  }

  const langLabel = LANG_LABELS[lang] || 'C++17';
  const rows = [
    { label: 'Language',    val: `<span class="row-val">${langLabel}</span>` },
    { label: 'Run samples', val: `<div class="keys"><kbd>Ctrl</kbd><kbd>'</kbd></div>` },
    { label: 'Submit',      val: `<div class="keys"><kbd>Ctrl</kbd><kbd>Enter</kbd></div>` },
  ];

  rows.forEach(({ label, val }) => {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<span class="row-label">${label}</span>${val}`;
    onBody.appendChild(row);
  });
}

function applyState(enabled, onCF, lang) {
  if (enabled) {
    stage.classList.add('show-on');
    buildOnBody(onCF, lang);
  } else {
    stage.classList.remove('show-on');
  }
}

function notifyTab(enabled) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const tab = tabs[0];
    if (!tab || !isCFTab(tab.url)) return;
    chrome.tabs.sendMessage(tab.id, { type: 'cfr:toggle', enabled }, function () {
      void chrome.runtime.lastError;
    });
  });
}

btnEnable.addEventListener('click', function () {
  currentEnabled = true;
  chrome.storage.local.set({ [KEY_ENABLED]: true }, function () {
    applyState(true, currentOnCF, currentLang);
    notifyTab(true);
  });
});

btnDisable.addEventListener('click', function () {
  currentEnabled = false;
  chrome.storage.local.set({ [KEY_ENABLED]: false }, function () {
    applyState(false, currentOnCF, currentLang);
    notifyTab(false);
  });
});

// ── init ──────────────────────────────────────────────────────
chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  const tab = tabs[0];
  currentOnCF = isCFTab(tab && tab.url);

  chrome.storage.local.get([KEY_ENABLED, KEY_LANG], function (result) {
    currentEnabled = result[KEY_ENABLED] !== false;
    currentLang    = result[KEY_LANG] || 'cpp';
    applyState(currentEnabled, currentOnCF, currentLang);
  });
});
