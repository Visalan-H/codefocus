import { LANGUAGES, EDITOR_ID, STORAGE_KEYS }          from './config.js';
import { monacoReady, mountEditor, isEditorReady,
         setLanguage, setValue, watchChanges,
         onEditorChange }                               from './bridge.js';
import { storageGet, storageSet }                       from './storage.js';
import { initConsole, wireConsoleTabs }                 from './console.js';
import { initSketch, setTool, undo, clearSketch }       from './sketch.js';

const ICON_RUN    = '<svg class="cfr-icon" viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
const ICON_SUBMIT = '<svg class="cfr-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V6M5 12l7-7 7 7"/></svg>';
const ICON_DRAW   = '<svg class="cfr-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';

const SI = (inner) => `<svg class="cfr-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const ICON_SELECT   = SI('<path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51z"/>');
const ICON_TEXT     = SI('<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>');
const ICON_PEN      = ICON_DRAW;
const ICON_LINE     = SI('<line x1="5" y1="19" x2="19" y2="5"/>');
const ICON_ARROW    = SI('<line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>');
const ICON_RECT     = SI('<rect x="3" y="5" width="18" height="14" rx="2"/>');
const ICON_ELLIPSE  = SI('<circle cx="12" cy="12" r="8"/>');
const ICON_DIAMOND  = SI('<path d="M12 3l9 9-9 9-9-9z"/>');
const ICON_TRIANGLE = SI('<path d="M12 4l9 16H3z"/>');
const ICON_UNDO     = SI('<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>');
const ICON_TRASH    = SI('<path d="M3 6h18"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>');
const ICON_CLOSE    = SI('<path d="M18 6L6 18"/><path d="M6 6l12 12"/>');

/**
 * Extracts a stable problem ID from the current Codeforces URL.
 * Handles:
 *   /contest/1234/problem/A  -> "1234A"
 *   /problemset/problem/1234/A -> "1234A"
 *   /gym/123456/problem/B   -> "gym123456B"
 * Falls back to the full pathname if none match.
 */
function getProblemId() {
  const { pathname } = window.location;
  let m;
  m = pathname.match(/\/(?:contest|c)\/(\d+)\/problem\/([A-Z0-9]+)/i);
  if (m) return m[1] + m[2].toUpperCase();
  m = pathname.match(/\/problemset\/problem\/(\d+)\/([A-Z0-9]+)/i);
  if (m) return m[1] + m[2].toUpperCase();
  m = pathname.match(/\/gym\/(\d+)\/problem\/([A-Z0-9]+)/i);
  if (m) return 'gym' + m[1] + m[2].toUpperCase();
  return pathname.replace(/\//g, '_');
}

function codeKey(langKey) {
  return `${STORAGE_KEYS.CODE}_${getProblemId()}_${langKey}`;
}

function sketchKey() {
  return `cfr_sketch_${getProblemId()}`;
}

export async function buildLayout(statementEl, samples) {
  document.body.style.overflow = 'hidden';

  const savedLang  = await storageGet(STORAGE_KEYS.LANG);
  const initialKey = (savedLang && LANGUAGES[savedLang]) ? savedLang : Object.keys(LANGUAGES)[0];

  const wrapper = document.createElement('div');
  wrapper.id        = 'cfr-wrapper';
  wrapper.innerHTML = `
    <div id="cfr-left">
      <div id="cfr-left-scroll"></div>
      <div id="cfr-sketch-resizer"></div>
      <div id="cfr-sketch-panel">
        <div id="cfr-sketch-toolbar">
          <button type="button" class="cfr-sketch-tool active" data-tool="select" title="Select / Move">${ICON_SELECT}</button>
          <button type="button" class="cfr-sketch-tool" data-tool="text" title="Text">${ICON_TEXT}</button>
          <button type="button" class="cfr-sketch-tool" data-tool="pen" title="Pen">${ICON_PEN}</button>
          <button type="button" class="cfr-sketch-tool" data-tool="line" title="Line">${ICON_LINE}</button>
          <button type="button" class="cfr-sketch-tool" data-tool="arrow" title="Arrow">${ICON_ARROW}</button>
          <button type="button" class="cfr-sketch-tool" data-tool="rect" title="Rectangle">${ICON_RECT}</button>
          <button type="button" class="cfr-sketch-tool" data-tool="ellipse" title="Ellipse">${ICON_ELLIPSE}</button>
          <button type="button" class="cfr-sketch-tool" data-tool="diamond" title="Diamond">${ICON_DIAMOND}</button>
          <button type="button" class="cfr-sketch-tool" data-tool="triangle" title="Triangle">${ICON_TRIANGLE}</button>
          <div id="cfr-sketch-toolbar-spacer"></div>
          <button type="button" id="cfr-sketch-undo" title="Undo">${ICON_UNDO}</button>
          <button type="button" id="cfr-sketch-clear" title="Clear">${ICON_TRASH}</button>
          <button type="button" id="cfr-sketch-close" title="Close">${ICON_CLOSE}</button>
        </div>
        <canvas id="cfr-sketch-canvas"></canvas>
      </div>
    </div>
    <div id="cfr-splitter"><span></span><span></span><span></span></div>
    <div id="cfr-right">
      <div id="cfr-toolbar">
        <span id="cfr-brand">CodeFocus</span>
        <span id="cfr-save-status"></span>
        <div id="cfr-toolbar-spacer"></div>
        <select id="cfr-lang">${buildLangOptions(initialKey)}</select>
        <button id="cfr-run"    type="button">${ICON_RUN}<span class="cfr-btn-label">Run</span></button>
        <button id="cfr-submit" type="button">${ICON_SUBMIT}<span class="cfr-btn-label">Submit</span></button>
        <button id="cfr-draw"   type="button">${ICON_DRAW}<span class="cfr-btn-label">Draw</span></button>
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

  wrapper.querySelector('#cfr-left-scroll').appendChild(statementEl);
  document.body.prepend(wrapper);

  const [savedSplitW, savedConsoleH, savedSketchH] = await Promise.all([
    storageGet(STORAGE_KEYS.SPLIT_W),
    storageGet(STORAGE_KEYS.CONSOLE_H),
    storageGet(STORAGE_KEYS.SKETCH_H),
  ]);

  if (savedSplitW != null) {
    const left  = wrapper.querySelector('#cfr-left');
    const right = wrapper.querySelector('#cfr-right');
    left.style.width  = savedSplitW + '%';
    right.style.width = (100 - savedSplitW) + '%';
  }

  if (savedConsoleH != null) {
    wrapper.querySelector('#cfr-console').style.height = savedConsoleH + 'px';
  }

  if (savedSketchH != null) {
    wrapper.querySelector('#cfr-sketch-panel').style.height = savedSketchH + 'px';
  }

  requestAnimationFrame(() => requestAnimationFrame(() => wrapper.classList.add('cfr-in')));

  initConsole(samples);
  wireConsoleTabs();
  wireLanguageSwitch();
  wireSketchPanel();
}

export async function initEditor() {
  await monacoReady;

  const langKey  = document.getElementById('cfr-lang').value;
  const lang     = LANGUAGES[langKey];
  const editorEl = document.getElementById(EDITOR_ID);

  const savedCode = await storageGet(codeKey(langKey));

  editorEl.innerHTML = '';
  mountEditor(lang.monaco, savedCode ?? lang.template);

  // After mount, register the change watcher and auto-save (debounced 1s)
  await monacoReady; // already resolved, but ensures mount message has been processed
  watchChanges();

  let saveTimer = null;
  const statusEl = document.getElementById('cfr-save-status');

  function setSaveStatus(state) {
    statusEl.className = '';
    statusEl.removeAttribute('data-saved-timer');
    if (state === 'saving') {
      statusEl.textContent = 'Saving…';
      statusEl.classList.add('cfr-save-saving');
    } else if (state === 'saved') {
      statusEl.textContent = 'Saved';
      statusEl.classList.add('cfr-save-saved');
      const t = setTimeout(() => statusEl.classList.add('cfr-save-fade'), 1400);
      statusEl.dataset.savedTimer = t;
    }
  }

  onEditorChange(value => {
    clearTimeout(saveTimer);
    setSaveStatus('saving');
    saveTimer = setTimeout(() => {
      const currentLang = document.getElementById('cfr-lang').value;
      storageSet(codeKey(currentLang), value).then(() => setSaveStatus('saved'));
    }, 1000);
  });
}

function buildLangOptions(selectedKey) {
  return Object.entries(LANGUAGES)
    .map(([key, lang]) => `<option value="${key}"${key === selectedKey ? ' selected' : ''}>${lang.label}</option>`)
    .join('');
}

function wireLanguageSwitch() {
  document.getElementById('cfr-lang').addEventListener('change', async ({ target }) => {
    const newLangKey = target.value;
    const lang       = LANGUAGES[newLangKey];
    storageSet(STORAGE_KEYS.LANG, newLangKey);
    if (!isEditorReady) return;
    const savedCode = await storageGet(codeKey(newLangKey));
    setLanguage(lang.monaco);
    setValue(savedCode ?? lang.template);
  });
}

function wireSketchPanel() {
  const drawBtn  = document.getElementById('cfr-draw');
  const panel    = document.getElementById('cfr-sketch-panel');
  const resizer  = document.getElementById('cfr-sketch-resizer');
  const canvasEl = document.getElementById('cfr-sketch-canvas');
  const toolBtns = panel.querySelectorAll('.cfr-sketch-tool');

  let ready = false;

  async function open() {
    if (!panel.style.height) panel.style.height = '320px';
    panel.classList.add('cfr-sketch-open');
    resizer.classList.add('cfr-sketch-open');
    drawBtn.classList.add('cfr-draw-active');
    if (!ready) {
      ready = true;
      await initSketch(canvasEl, sketchKey());
    }
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }

  function close() {
    panel.classList.remove('cfr-sketch-open');
    resizer.classList.remove('cfr-sketch-open');
    drawBtn.classList.remove('cfr-draw-active');
  }

  drawBtn.addEventListener('click', () => {
    panel.classList.contains('cfr-sketch-open') ? close() : open();
  });

  document.getElementById('cfr-sketch-close').addEventListener('click', close);

  toolBtns.forEach(btn => btn.addEventListener('click', () => {
    toolBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    setTool(btn.dataset.tool);
  }));

  document.getElementById('cfr-sketch-undo').addEventListener('click', () => undo());
  document.getElementById('cfr-sketch-clear').addEventListener('click', () => clearSketch());
}
