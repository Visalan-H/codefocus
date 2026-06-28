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

export function setCaseStatus(index, status, actual, isError = false, errorLabel = 'Error') {
  const c = cases[index];
  if (!c) return;
  c.status     = status;
  c.isError    = isError;
  c.errorLabel = errorLabel;
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

function renderSideBySideDiff(expected, actual) {
  const a   = (expected || '').trimEnd().split('\n');
  const b   = (actual   || '').trimEnd().split('\n');
  const len = Math.max(a.length, b.length);

  let leftLines  = '';
  let rightLines = '';

  for (let i = 0; i < len; i++) {
    const exp = i < a.length ? a[i] : '';
    const got = i < b.length ? b[i] : '';
    const cls = exp === got ? ' cfr-diff-side-match' : ' cfr-diff-side-mismatch';
    leftLines  += `<div class="cfr-diff-side-line${cls}">${escapeHtml(exp)}</div>`;
    rightLines += `<div class="cfr-diff-side-line${cls}">${escapeHtml(got)}</div>`;
  }

  return `<div class="cfr-diff-side">
    <div class="cfr-diff-side-col cfr-diff-side-col-exp">
      <div class="cfr-diff-side-header cfr-diff-add-label">Expected</div>
      <div class="cfr-diff-side-body">${leftLines}</div>
    </div>
    <div class="cfr-diff-side-divider"></div>
    <div class="cfr-diff-side-col cfr-diff-side-col-got">
      <div class="cfr-diff-side-header cfr-diff-remove-label">Got</div>
      <div class="cfr-diff-side-body">${rightLines}</div>
    </div>
  </div>`;
}

function renderResultDetail(c) {
  if (!c || c.status === 'idle')    return '<div class="cfr-empty">This case hasn\u2019t been run yet.</div>';
  if (c.status === 'pending')       return '<div class="cfr-empty">Running\u2026</div>';

  const inputBlock = `
    <div class="cfr-result-field">
      <div class="cfr-case-label">Input</div>
      <pre class="cfr-result-box">${escapeHtml(c.input)}</pre>
    </div>`;

  // Compiler/runtime error — show a dedicated error block, skip diff
  if (c.isError) {
    return inputBlock + `
      <div class="cfr-result-field">
        <div class="cfr-case-label cfr-label-error">${escapeHtml(c.errorLabel)}</div>
        <pre class="cfr-result-box cfr-result-box-error">${escapeHtml(c.actual || '')}</pre>
      </div>`;
  }

  const gotBlock = `
    <div class="cfr-result-field">
      <div class="cfr-case-label">Output</div>
      <pre class="cfr-result-box${c.status === 'fail' ? ' cfr-result-box-fail' : ''}">${escapeHtml(c.actual || '')}</pre>
    </div>`;

  if (c.status === 'fail' && c.expected?.trim()) {
    return inputBlock + gotBlock + `
      <div class="cfr-result-field">
        <div class="cfr-case-label">Diff</div>
        ${renderSideBySideDiff(c.expected, c.actual || '')}
      </div>`;
  }

  return inputBlock + gotBlock +
    (c.expected?.trim() ? `
    <div class="cfr-result-field">
      <div class="cfr-case-label">Expected</div>
      <pre class="cfr-result-box">${escapeHtml(c.expected)}</pre>
    </div>` : '');
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
