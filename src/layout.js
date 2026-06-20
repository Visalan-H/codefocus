import { LANGUAGES, EDITOR_ID }                   from './config.js';
import { monacoReady, mountEditor, isEditorReady,
         setLanguage, setValue }                  from './bridge.js';
import { storageGet, storageSet }                 from './storage.js';

const STORAGE_KEY = 'cfr_lang';

const ICON_RUN    = '<svg class="cfr-icon" viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
const ICON_SUBMIT = '<svg class="cfr-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V6M5 12l7-7 7 7"/></svg>';

export async function buildLayout(statementEl, samples) {
  document.body.style.overflow = 'hidden';

  const savedLang  = await storageGet(STORAGE_KEY);
  const initialKey = (savedLang && LANGUAGES[savedLang]) ? savedLang : Object.keys(LANGUAGES)[0];

  const wrapper = document.createElement('div');
  wrapper.id = 'cfr-wrapper';
  wrapper.innerHTML = `
    <div id="cfr-left"></div>
    <div id="cfr-splitter"><span></span><span></span><span></span></div>
    <div id="cfr-right">
      <div id="cfr-toolbar">
        <span id="cfr-brand">Code // Focus</span>
        <div id="cfr-toolbar-spacer"></div>
        <select id="cfr-lang">${buildLangOptions(initialKey)}</select>
        <button id="cfr-run" type="button">${ICON_RUN}<span class="cfr-btn-label">Run</span></button>
        <button id="cfr-submit" type="button">${ICON_SUBMIT}<span class="cfr-btn-label">Submit</span></button>
      </div>
      <div id="${EDITOR_ID}"><div id="cfr-editor-loading">Loading editor</div></div>
      <div id="cfr-results"></div>
    </div>
  `;

  wrapper.querySelector('#cfr-left').appendChild(statementEl);
  document.body.prepend(wrapper);

  renderResults(samples.length);
  wireLanguageSwitch();
}

function buildLangOptions(selectedKey) {
  return Object.entries(LANGUAGES)
    .map(function ([key, lang]) {
      const sel = key === selectedKey ? ' selected' : '';
      return '<option value="' + key + '"' + sel + '>' + lang.label + '</option>';
    })
    .join('');
}

export function renderResults(count) {
  const container = document.getElementById('cfr-results');

  if (count === 0) {
    container.innerHTML = '<div class="cfr-empty">No samples found.</div>';
    return;
  }

  const pills = [];
  for (let i = 0; i < count; i++) {
    pills.push(
      '<span class="cfr-v-item" id="cfr-v-' + i + '">' +
        '<span class="cfr-v-num">' + (i + 1) + '</span>' +
        '<span class="cfr-badge cfr-badge-idle">—</span>' +
      '</span>'
    );
  }

  container.innerHTML =
    '<div id="cfr-verdicts">' + pills.join('') + '</div>' +
    '<div id="cfr-diffs"></div>';
}

export async function initEditor() {
  await monacoReady;

  const langKey  = document.getElementById('cfr-lang').value;
  const lang     = LANGUAGES[langKey];
  const editorEl = document.getElementById(EDITOR_ID);

  editorEl.innerHTML = '';
  mountEditor(lang.monaco, lang.template);
}

function onLanguageChange(event) {
  const key  = event.target.value;
  const lang = LANGUAGES[key];

  storageSet(STORAGE_KEY, key);

  if (!isEditorReady) return;
  setLanguage(lang.monaco);
  setValue(lang.template);
}

function wireLanguageSwitch() {
  document.getElementById('cfr-lang').addEventListener('change', onLanguageChange);
}
