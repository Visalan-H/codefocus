const ENABLED_KEY = 'cfr_enabled';

chrome.runtime.onMessage.addListener(msg => {
  if (msg.type !== 'cfr:toggle') return;

  const wrapper = document.getElementById('cfr-wrapper');
  if (!msg.enabled && wrapper) {
    wrapper.classList.replace('cfr-in', 'cfr-out');
    setTimeout(() => window.location.reload(), 200);
    return;
  }

  window.location.reload();
});

chrome.storage.local.get(ENABLED_KEY, result => {
  if (result?.[ENABLED_KEY] !== false) initRunner();
});

async function initRunner() {
  const script = document.createElement('script');
  script.src                   = chrome.runtime.getURL('monaco-bootstrap.js');
  script.dataset.vsBase        = chrome.runtime.getURL('vs');
  script.dataset.workerUrl     = chrome.runtime.getURL('vs/assets/editor.worker-Be8ye1pW.js');
  document.head.appendChild(script);

  window.addEventListener('message', handlePageMessage);

  try {
    const [
      { buildLayout, initEditor },
      { wireSplitter, wireConsoleResizer },
      { wireRun },
      { wireSubmit },
      { waitFor, scrapeSamples },
    ] = await Promise.all([
      import(chrome.runtime.getURL('src/layout.js')),
      import(chrome.runtime.getURL('src/splitter.js')),
      import(chrome.runtime.getURL('src/runner.js')),
      import(chrome.runtime.getURL('src/submit.js')),
      import(chrome.runtime.getURL('src/utils.js')),
    ]);

    const statementEl = await waitFor('.problem-statement');
    const samples     = scrapeSamples();

    await buildLayout(statementEl, samples);
    wireSplitter();
    wireConsoleResizer();
    wireRun();
    wireSubmit();
    await initEditor();
    wireShortcuts();
  } catch (err) {
    console.error('[CF-Runner] init failed:', err);
  }
}

function handlePageMessage(event) {
  if (event.source !== window || !event.data?.__cfr) return;

  const { type, requestId } = event.data;

  function respond(payload) {
    try { window.postMessage({ __cfr: true, requestId, ...payload }, window.location.origin); } catch (_) {}
  }

  if (type === 'cfr:run-request') {
    try {
      chrome.runtime.sendMessage(
        { type: 'cfr:run', compiler: event.data.compiler, code: event.data.code, input: event.data.input },
        reply => {
          const err = chrome.runtime.lastError;
          respond({ type: 'cfr:run-response', ok: !err && reply.ok, data: reply?.data, error: err?.message ?? reply?.error });
        }
      );
    } catch (_) {
      respond({ type: 'cfr:run-response', ok: false, error: 'Extension context invalidated' });
    }
    return;
  }

  if (type === 'cfr:storage-set') {
    try {
      chrome.storage.local.set({ [event.data.key]: event.data.value }, () => {
        respond({ type: 'cfr:storage-response', ok: !chrome.runtime.lastError });
      });
    } catch (_) {
      respond({ type: 'cfr:storage-response', ok: false });
    }
    return;
  }

  if (type === 'cfr:storage-get') {
    try {
      chrome.storage.local.get(event.data.key, result => {
        respond({ type: 'cfr:storage-response', ok: true, value: result?.[event.data.key] });
      });
    } catch (_) {
      respond({ type: 'cfr:storage-response', ok: true, value: undefined });
    }
  }
}

function wireShortcuts() {
  window.addEventListener('keydown', e => {
    if (!e.ctrlKey) return;
    if (e.key === "'")     { e.preventDefault(); e.stopPropagation(); document.getElementById('cfr-run')?.click(); }
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); document.getElementById('cfr-submit')?.click(); }
  }, true);
}
