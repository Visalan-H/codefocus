import { escapeHtml, showToast } from './utils.js';

let cases      = [];
let activeCase = 0;
let resultCase = 0;
let runtimeMs  = null;

export function initConsole(samples) {
  cases      = samples.map(s => ({ ...s, custom: false, status: 'idle', actual: undefined }));
  activeCase = 0;
  resultCase = 0;
  runtimeMs  = null;
  renderPills();
  renderDetail();
  renderResultPane();
  switchTab('testcase');
}

export const getCases = () => cases;

export function resetAllStatuses() {
  cases.forEach(c => { c.status = 'idle'; c.actual = undefined; });
  resultCase = 0;
  runtimeMs  = null;
  renderPills();
  renderResultPane();
}

export function setCaseStatus(index, status, actual) {
  const c = cases[index];
  if (!c) return;
  c.status = status;
  if (actual !== undefined) c.actual = actual;
  renderPills();
  renderResultPane();
}

export function finishRun(ms) {
  runtimeMs  = ms;
  const fail = cases.findIndex(c => c.status === 'fail');
  resultCase = fail !== -1 ? fail : 0;
  renderResultPane();
}

export function switchTab(tab) {
  document.getElementById('cfr-tab-testcase').classList.toggle('active', tab === 'testcase');
  document.getElementById('cfr-tab-result').classList.toggle('active',   tab === 'result');
  document.getElementById('cfr-pane-testcase').classList.toggle('active', tab === 'testcase');
  document.getElementById('cfr-pane-result').classList.toggle('active',   tab === 'result');
}

export const showResultTab = () => switchTab('result');

export function wireConsoleTabs() {
  document.getElementById('cfr-tab-testcase').addEventListener('click', () => switchTab('testcase'));
  document.getElementById('cfr-tab-result').addEventListener('click',   () => switchTab('result'));
}

// ─── private ────────────────────────────────────────────────────────────────

function dotClass(status) {
  return { pass: 'cfr-pill-dot cfr-pill-dot-pass', fail: 'cfr-pill-dot cfr-pill-dot-fail', done: 'cfr-pill-dot cfr-pill-dot-done' }[status] || '';
}

function renderPills() {
  const host = document.getElementById('cfr-case-pills');
  if (!host) return;

  host.innerHTML = cases.map((c, i) => {
    const dot = dotClass(c.status);
    return `<button type="button" class="cfr-pill${i === activeCase ? ' active' : ''}" data-idx="${i}">
      ${dot ? `<span class="${dot}"></span>` : ''}Case ${i + 1}
      ${c.custom ? `<span class="cfr-pill-x" data-idx="${i}" title="Remove">&times;</span>` : ''}
    </button>`;
  }).join('') + '<button type="button" id="cfr-case-add" title="Add case">+</button>';

  host.querySelectorAll('.cfr-pill').forEach(btn => {
    btn.addEventListener('click', e => {
      if (e.target.classList.contains('cfr-pill-x')) {
        e.stopPropagation();
        removeCase(Number(e.target.dataset.idx));
        return;
      }
      activeCase = Number(btn.dataset.idx);
      renderPills();
      renderDetail();
    });
  });

  document.getElementById('cfr-case-add')?.addEventListener('click', addCase);
}

function renderDetail() {
  const wrap = document.getElementById('cfr-case-detail');
  if (!wrap) return;

  const c = cases[activeCase];
  if (!c) {
    wrap.innerHTML = '<div class="cfr-empty">No test cases — add one with the + button.</div>';
    return;
  }

  wrap.innerHTML = `
    <div class="cfr-case-field">
      <div class="cfr-case-label">Input</div>
      <textarea class="cfr-case-textarea" id="cfr-case-input" spellcheck="false">${escapeHtml(c.input)}</textarea>
    </div>
    <div class="cfr-case-field">
      <div class="cfr-case-label">Expected Output</div>
      <textarea class="cfr-case-textarea" id="cfr-case-expected" spellcheck="false">${escapeHtml(c.expected ?? '')}</textarea>
    </div>`;

  document.getElementById('cfr-case-input').addEventListener('input',    e => { cases[activeCase].input    = e.target.value; });
  document.getElementById('cfr-case-expected').addEventListener('input', e => { cases[activeCase].expected = e.target.value; });
}

function addCase() {
  if (cases.filter(c => c.custom).length >= 1) {
    showToast('Only one custom test case is supported at a time.');
    return;
  }
  cases.push({ input: '', expected: undefined, custom: true, status: 'idle', actual: undefined });
  activeCase = cases.length - 1;
  renderPills();
  renderDetail();
}

function removeCase(index) {
  cases.splice(index, 1);
  if (activeCase >= cases.length) activeCase = Math.max(0, cases.length - 1);
  if (resultCase >= cases.length) resultCase = Math.max(0, cases.length - 1);
  renderPills();
  renderDetail();
  renderResultPane();
}

function computeVerdict() {
  const judged = cases.filter(c => c.expected?.trim());
  if (!judged.length) return null;
  if (judged.some(c => c.status === 'pending')) return { label: 'Running\u2026', cls: 'pending' };
  if (judged.some(c => c.status === 'fail'))    return { label: 'Wrong Answer', cls: 'fail' };
  if (judged.every(c => c.status === 'pass'))   return { label: 'Accepted',     cls: 'pass' };
  return null;
}

function diffLines(expected, actual) {
  const a      = (expected || '').split('\n');
  const b      = (actual   || '').split('\n');
  const result = [];
  const len    = Math.max(a.length, b.length);

  for (let i = 0; i < len; i++) {
    if      (i >= a.length) result.push({ type: 'add',    value: b[i] });
    else if (i >= b.length) result.push({ type: 'remove', value: a[i] });
    else if (a[i] !== b[i]) { result.push({ type: 'remove', value: a[i] }); result.push({ type: 'add', value: b[i] }); }
    else                    result.push({ type: 'equal',  value: a[i] });
  }

  return result;
}

function renderDiff(expected, actual) {
  return diffLines(expected, actual).map(({ type, value }) => {
    if (type === 'equal')  return `<div class="cfr-diff-line">${escapeHtml(value)}</div>`;
    if (type === 'remove') return `<div class="cfr-diff-line cfr-diff-remove"><span class="cfr-diff-sign">\u2212</span>${escapeHtml(value)}</div>`;
    if (type === 'add')    return `<div class="cfr-diff-line cfr-diff-add"><span class="cfr-diff-sign">+</span>${escapeHtml(value)}</div>`;
  }).join('');
}

function renderResultDetail(c) {
  if (!c || c.status === 'idle')    return '<div class="cfr-empty">This case hasn\u2019t been run yet.</div>';
  if (c.status === 'pending')       return '<div class="cfr-empty">Running\u2026</div>';

  const inputBlock = `
    <div class="cfr-result-field">
      <div class="cfr-case-label">Input</div>
      <pre class="cfr-result-box">${escapeHtml(c.input)}</pre>
    </div>`;

  if (c.status === 'fail' && c.expected?.trim()) {
    return inputBlock + `
      <div class="cfr-result-field">
        <div class="cfr-case-label">Diff &mdash; <span class="cfr-diff-remove-label">expected</span> / <span class="cfr-diff-add-label">got</span></div>
        <div class="cfr-diff-box">${renderDiff(c.expected, c.actual || '')}</div>
      </div>`;
  }

  return inputBlock + `
    <div class="cfr-result-field">
      <div class="cfr-case-label">Output</div>
      <pre class="cfr-result-box${c.status === 'fail' ? ' cfr-result-box-fail' : ''}">${escapeHtml(c.actual || '')}</pre>
    </div>
    ${c.expected?.trim() ? `
    <div class="cfr-result-field">
      <div class="cfr-case-label">Expected</div>
      <pre class="cfr-result-box">${escapeHtml(c.expected)}</pre>
    </div>` : ''}`;
}

function renderResultPane() {
  const host = document.getElementById('cfr-pane-result');
  if (!host) return;

  if (!cases.length) {
    host.innerHTML = '<div class="cfr-empty">No test cases to run.</div>';
    return;
  }

  const everRun = cases.some(c => c.status !== 'idle');
  if (!everRun) {
    host.innerHTML = '<div class="cfr-empty">Hit Run to see results here.</div>';
    return;
  }

  if (resultCase >= cases.length) resultCase = 0;

  const verdict = computeVerdict();
  const summary = verdict ? `
    <div class="cfr-result-summary">
      <span class="cfr-result-verdict cfr-result-${verdict.cls}">${verdict.label}</span>
      ${runtimeMs !== null ? `<span class="cfr-result-runtime">Runtime: ${runtimeMs} ms</span>` : ''}
    </div>` : '';

  const pills = cases.map((c, i) => {
    const dot = dotClass(c.status);
    return `<button type="button" class="cfr-pill${i === resultCase ? ' active' : ''}" data-idx="${i}">
      ${dot ? `<span class="${dot}"></span>` : ''}Case ${i + 1}
    </button>`;
  }).join('');

  host.innerHTML = summary +
    `<div id="cfr-result-pills" class="cfr-pill-row">${pills}</div>` +
    `<div id="cfr-result-detail">${renderResultDetail(cases[resultCase])}</div>`;

  host.querySelectorAll('#cfr-result-pills .cfr-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      resultCase = Number(btn.dataset.idx);
      renderResultPane();
    });
  });
}
