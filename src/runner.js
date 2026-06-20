import { LANGUAGES }                        from './config.js';
import { isEditorReady, getValue }          from './bridge.js';
import { normalize, escapeHtml, showToast } from './utils.js';

let _nextId = 0;
const _pending = new Map();

window.addEventListener('message', function (event) {
  if (event.source !== window)           return;
  if (!event.data || !event.data.__cfr) return;
  if (event.data.type !== 'cfr:run-response') return;

  const handler = _pending.get(event.data.requestId);
  if (!handler) return;
  _pending.delete(event.data.requestId);
  handler.resolve({ ok: event.data.ok, data: event.data.data, error: event.data.error });
});

function requestRun(compiler, code, input) {
  return new Promise(function (resolve, reject) {
    const requestId = _nextId++;
    _pending.set(requestId, { resolve, reject });
    window.postMessage({
      __cfr: true,
      type:  'cfr:run-request',
      requestId,
      compiler,
      code,
      input,
    }, window.location.origin);
  });
}

export function wireRun(samples) {
  async function onRunClick() {
    if (!isEditorReady) {
      showToast('Editor is still loading — try again in a moment.');
      return;
    }

    const code    = await getValue();
    const langKey = document.getElementById('cfr-lang').value;
    const lang    = LANGUAGES[langKey];

    if (!code.trim()) {
      showToast('Write some code first.');
      return;
    }
    if (!samples.length) {
      showToast('No samples found on this page.');
      return;
    }

    const btn   = document.getElementById('cfr-run');
    const label = btn.querySelector('.cfr-btn-label');

    btn.disabled = true;
    btn.classList.add('cfr-busy');
    label.textContent = 'Running';

    document.getElementById('cfr-diffs').innerHTML = '';
    resetVerdicts(samples.length);

    try {
      for (let i = 0; i < samples.length; i++) {
        await runSample(i, samples[i], code, lang);
      }
    } catch (err) {
      showToast('Run failed: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.classList.remove('cfr-busy');
      label.textContent = 'Run';
    }
  }

  document.getElementById('cfr-run').addEventListener('click', onRunClick);
}

function resetVerdicts(count) {
  for (let i = 0; i < count; i++) {
    const item  = document.getElementById('cfr-v-' + i);
    if (!item) continue;
    const badge = item.querySelector('.cfr-badge');
    badge.className   = 'cfr-badge cfr-badge-idle';
    badge.textContent = '—';
  }
}

async function runSample(index, sample, code, lang) {
  showPending(index);

  const reply = await requestRun(lang.compiler, code, sample.input);

  if (!reply.ok) {
    showFail(index, sample.expected, reply.error);
    return;
  }

  const result = reply.data;

  if (result.status === 'success' && result.exit_code === 0) {
    const passed = normalize(result.output || '') === normalize(sample.expected);
    if (passed) {
      showPass(index);
    } else {
      showFail(index, sample.expected, (result.output || '').trim());
    }
  } else {
    const errText = (result.error || result.output || 'Error (exit ' + result.exit_code + ')').trim();
    showFail(index, sample.expected, errText);
  }
}

function setBadge(index, cls, text) {
  const item = document.getElementById('cfr-v-' + index);
  if (!item) return;
  const badge = item.querySelector('.cfr-badge');
  badge.className   = 'cfr-badge ' + cls;
  badge.textContent = text;
}

function showPending(index) { setBadge(index, 'cfr-badge-pending', '···'); }
function showPass(index)    { setBadge(index, 'cfr-badge-pass',    '✓');  }

function showFail(index, expected, actual) {
  setBadge(index, 'cfr-badge-fail', '✗');

  const diffs = document.getElementById('cfr-diffs');
  let section = document.getElementById('cfr-diff-' + index);
  if (!section) {
    section = document.createElement('div');
    section.id        = 'cfr-diff-' + index;
    section.className = 'cfr-diff-section';
    diffs.appendChild(section);
  }

  section.innerHTML =
    '<div class="cfr-diff-head">Sample ' + (index + 1) + '</div>' +
    '<div class="cfr-diff">' +
      '<div class="cfr-diff-col">' +
        '<div class="cfr-diff-label">Expected</div>' +
        '<pre>' + escapeHtml(expected) + '</pre>' +
      '</div>' +
      '<div class="cfr-diff-col">' +
        '<div class="cfr-diff-label">Got</div>' +
        '<pre>' + escapeHtml(actual) + '</pre>' +
      '</div>' +
    '</div>';
}
