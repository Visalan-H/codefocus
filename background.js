import { API_KEY } from './src/api-key.js';

const OC_SYNC = 'https://api.onlinecompiler.io/api/run-code-sync/';

chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
  if (msg.type !== 'cfr:run') return false;

  (async function () {
    try {
      const response = await fetch(OC_SYNC, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': API_KEY,
        },
        body: JSON.stringify({
          compiler: msg.compiler,
          code:     msg.code,
          input:    msg.input,
        }),
      });

      if (response.status === 429) {
        sendResponse({ ok: false, error: 'onlinecompiler.io is at capacity — wait a moment and retry.' });
        return;
      }
      if (!response.ok) {
        const text = await response.text().catch(function () { return ''; });
        sendResponse({ ok: false, error: 'onlinecompiler.io ' + response.status + (text ? ' — ' + text.slice(0, 200) : '') });
        return;
      }

      const data = await response.json();
      sendResponse({ ok: true, data });
    } catch (err) {
      sendResponse({ ok: false, error: 'Network error — ' + err.message });
    }
  })();

  return true; // required: keeps the message channel open for async sendResponse
});
