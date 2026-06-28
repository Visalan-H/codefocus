import { STORAGE_KEYS } from './src/config.js';

const OC_ENDPOINT = 'https://api.onlinecompiler.io/api/run-code-sync/';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'cfr:run') return false;

  (async () => {
    try {
      const stored = await chrome.storage.local.get(STORAGE_KEYS.API_KEY);
      const apiKey = stored[STORAGE_KEYS.API_KEY];

      if (!apiKey) {
        sendResponse({ ok: false, error: 'No API key set — open the CodeFocus popup and add your onlinecompiler.io key.' });
        return;
      }

      const res = await fetch(OC_ENDPOINT, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': apiKey },
        body:    JSON.stringify({ compiler: msg.compiler, code: msg.code, input: msg.input }),
      });

      if (res.status === 429) {
        sendResponse({ ok: false, error: 'Rate limited — wait a moment and retry.' });
        return;
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        sendResponse({ ok: false, error: `onlinecompiler.io ${res.status}${body ? ' — ' + body.slice(0, 200) : ''}` });
        return;
      }

      sendResponse({ ok: true, data: await res.json() });
    } catch (err) {
      sendResponse({ ok: false, error: 'Network error — ' + err.message });
    }
  })();

  return true;
});
