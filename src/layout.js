import { LANGUAGES, EDITOR_ID, STORAGE_KEYS }          from './config.js';
import { monacoReady, mountEditor, isEditorReady,
         setLanguage, setValue }                        from './bridge.js';
import { storageGet, storageSet }                       from './storage.js';
import { initConsole, wireConsoleTabs }                 from './console.js';

const ICON_RUN    = '<svg class="cfr-icon" viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
const ICON_SUBMIT = '<svg class="cfr-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V6M5 12l7-7 7 7"/></svg>';

export async function buildLayout(statementEl, samples) {
  document.body.style.overflow = 'hidden';

  const savedLang  = await storageGet(STORAGE_KEYS.LANG);
  const initialKey = (savedLang && LANGUAGES[savedLang]) ? savedLang : Object.keys(LANGUAGES)[0];

  const wrapper = document.createElement('div');
  wrapper.id        = 'cfr-wrapper';
  wrapper.innerHTML = `
    <div id="cfr-left"></div>
    <div id="cfr-splitter"><span></span><span></span><span></span></div>
    <div id="cfr-right">
      <div id="cfr-toolbar">
        <span id="cfr-brand">Code Focus</span>
        <div id="cfr-toolbar-spacer"></div>
        <select id="cfr-lang">${buildLangOptions(initialKey)}</select>
        <button id="cfr-run"    type="button">${ICON_RUN}<span class="cfr-btn-label">Run</span></button>
        <button id="cfr-submit" type="button">${ICON_SUBMIT}<span class="cfr-btn-label">Submit</span></button>
      </div>
      <div id="${EDITOR_ID}"><div id="cfr-editor-loading">Loading editor</div></div>
      <div id="cfr-console-resizer"></div>
      <div id="cfr-console">
        <div id="cfr-console-tabs">
          <button type="button" class="cfr-console-tab active" id="cfr-tab-testcase">Testcase</button>
          <button type="button" class="cfr-console-tab"        id="cfr-tab-result">Test Result</button>
        </div>
        <div id="cfr-console-body">
          <div class="cfr-console-pane active" id="cfr-pane-testcase">
            <div id="cfr-case-pills"></div>
            <div id="cfr-case-detail"></div>
          </div>
          <div class="cfr-console-pane" id="cfr-pane-result"></div>
        </div>
      </div>
    </div>`;

  wrapper.querySelector('#cfr-left').appendChild(statementEl);
  wrapper.querySelector('#cfr-left .sample-tests')?.remove();
  document.body.prepend(wrapper);

  requestAnimationFrame(() => requestAnimationFrame(() => wrapper.classList.add('cfr-in')));

  initConsole(samples);
  wireConsoleTabs();
  wireLanguageSwitch();
}

export async function initEditor() {
  await monacoReady;

  const langKey  = document.getElementById('cfr-lang').value;
  const lang     = LANGUAGES[langKey];
  const editorEl = document.getElementById(EDITOR_ID);

  editorEl.innerHTML = '';
  mountEditor(lang.monaco, lang.template);
}

function buildLangOptions(selectedKey) {
  return Object.entries(LANGUAGES)
    .map(([key, lang]) => `<option value="${key}"${key === selectedKey ? ' selected' : ''}>${lang.label}</option>`)
    .join('');
}

function wireLanguageSwitch() {
  document.getElementById('cfr-lang').addEventListener('change', ({ target }) => {
    const lang = LANGUAGES[target.value];
    storageSet(STORAGE_KEYS.LANG, target.value);
    if (!isEditorReady) return;
    setLanguage(lang.monaco);
    setValue(lang.template);
  });
}
