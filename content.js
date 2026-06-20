const STORAGE_KEY_ENABLED = 'cfr_enabled';

chrome.runtime.onMessage.addListener(function (msg) {
  if (msg.type !== 'cfr:toggle') return;
  window.location.reload();
});

chrome.storage.local.get(STORAGE_KEY_ENABLED, function (result) {
  if (result[STORAGE_KEY_ENABLED] !== false) initRunner();
});

async function initRunner() {
  const script = document.createElement('script');
  script.src               = chrome.runtime.getURL('monaco-bootstrap.js');
  script.dataset.vsBase    = chrome.runtime.getURL('vs');
  script.dataset.workerUrl = chrome.runtime.getURL('vs/assets/editor.worker-Be8ye1pW.js');
  document.head.appendChild(script);

  window.addEventListener('message', function (event) {
    if (event.source !== window)           return;
    if (!event.data || !event.data.__cfr) return;

    const { type, requestId } = event.data;

    if (type === 'cfr:run-request') {
      chrome.runtime.sendMessage(
        { type: 'cfr:run', compiler: event.data.compiler, code: event.data.code, input: event.data.input },
        function (reply) {
          const err = chrome.runtime.lastError;
          window.postMessage({
            __cfr:     true,
            type:      'cfr:run-response',
            requestId,
            ok:        err ? false : reply.ok,
            data:      err ? undefined : reply.data,
            error:     err ? err.message : reply.error,
          }, window.location.origin);
        }
      );
      return;
    }

    if (type === 'cfr:storage-set') {
      chrome.storage.local.set({ [event.data.key]: event.data.value }, function () {
        window.postMessage({
          __cfr: true,
          type:  'cfr:storage-response',
          requestId,
          ok:    !chrome.runtime.lastError,
        }, window.location.origin);
      });
      return;
    }

    if (type === 'cfr:storage-get') {
      chrome.storage.local.get(event.data.key, function (result) {
        window.postMessage({
          __cfr:  true,
          type:   'cfr:storage-response',
          requestId,
          ok:     true,
          value:  result[event.data.key],
        }, window.location.origin);
      });
      return;
    }
  });

  try {
    const [
      { buildLayout, initEditor },
      { wireSplitter },
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
    wireRun(samples);
    wireSubmit();
    await initEditor();
    wireShortcuts();
  } catch (e) {
    console.error('CF-Runner init failed:', e);
  }
}

function wireShortcuts() {
  window.addEventListener('keydown', function (event) {
    if (!event.ctrlKey) return;
    if (event.key === "'") {
      event.preventDefault();
      event.stopPropagation();
      document.getElementById('cfr-run')?.click();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      document.getElementById('cfr-submit')?.click();
    }
  }, true);
}
