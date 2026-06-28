import { LANGUAGES }                              from './config.js';
import { isEditorReady, getValue }               from './bridge.js';
import { normalize, showToast }                  from './utils.js';
import { getCases, setCaseStatus, resetAllStatuses,
         finishRun, showResultTab }              from './console.js';

let nextId = 0;
const pending = new Map();

window.addEventListener('message', ({ source, data }) => {
  if (source !== window || !data?.__cfr || data.type !== 'cfr:run-response') return;
  const handler = pending.get(data.requestId);
  if (!handler) return;
  pending.delete(data.requestId);
  handler({ ok: data.ok, data: data.data, error: data.error });
});

function requestRun(compiler, code, input) {
  return new Promise(resolve => {
    const requestId = nextId++;
    pending.set(requestId, resolve);
    window.postMessage({ __cfr: true, type: 'cfr:run-request', requestId, compiler, code, input }, window.location.origin);
  });
}

async function runCase(index, testCase, code, lang) {
  setCaseStatus(index, 'pending');

  const reply = await requestRun(lang.compiler, code, testCase.input);
  if (!reply.ok) { setCaseStatus(index, 'fail', reply.error); return; }

  const { status, exit_code, output, error } = reply.data;

  if (status === 'success' && exit_code === 0) {
    const got         = (output || '').trim();
    const hasExpected = testCase.expected?.trim();
    let verdict;
    if (!hasExpected)                                          verdict = 'done';
    else if (normalize(got) === normalize(testCase.expected)) verdict = 'pass';
    else                                                       verdict = 'fail';
    setCaseStatus(index, verdict, got, false);
  } else {
    const errText = (error || output || `Exit code ${exit_code}`).trim();
    let label;
    if (status === 'compilation_error')        label = 'Compilation Error';
    else if (status === 'time_limit_exceeded') label = 'Time Limit Exceeded';
    else if (status === 'memory_limit_exceeded') label = 'Memory Limit Exceeded';
    else if (status === 'error')               label = 'Execution Error';
    else                                       label = 'Runtime Error';
    setCaseStatus(index, 'fail', errText, true, label);
  }
}

export function wireRun() {
  document.getElementById('cfr-run').addEventListener('click', async () => {
    if (!isEditorReady) { showToast('Editor is still loading — try again in a moment.'); return; }

    const code  = await getValue();
    const lang  = LANGUAGES[document.getElementById('cfr-lang').value];
    const cases = getCases();

    if (!code.trim())   { showToast('Write some code first.');    return; }
    if (!cases.length)  { showToast('No test cases to run.');     return; }

    const btn   = document.getElementById('cfr-run');
    const label = btn.querySelector('.cfr-btn-label');

    btn.disabled = true;
    btn.classList.add('cfr-busy');
    label.textContent = 'Running';
    resetAllStatuses();
    showResultTab();

    const start = Date.now();
    try {
      for (let i = 0; i < cases.length; i++) {
        await runCase(i, cases[i], code, lang);
        if (i < cases.length - 1) await new Promise(r => setTimeout(r, 800)); // brief pause to avoid hitting onlinecompiler.io rate limits
      }
    } catch (err) {
      showToast('Run failed: ' + err.message, 'error');
    } finally {
      finishRun(Date.now() - start);
      btn.disabled = false;
      btn.classList.remove('cfr-busy');
      label.textContent = 'Run';
    }
  });
}
