import { LANGUAGES, STORAGE_KEYS }  from './config.js';
import { isEditorReady, getValue }  from './bridge.js';
import { storageSet }               from './storage.js';
import { showToast }                from './utils.js';

function parseSubmitDest() {
  const m = window.location.pathname.match(
    /^\/(?:problemset\/problem\/(\d+)|contest\/(\d+)|gym\/(\d+))\/([A-Z0-9]+)/
  );
  if (!m) return null;

  const contestId    = m[1] || m[2] || m[3];
  const problemIndex = m[4];
  // contestId is always defined when the regex matches (m[1] for problemset, m[2] for contest, m[3] for gym).
  // CF accepts /contest/CONTESTID/submit for all problem types, so we always route there.
  const url = `/contest/${contestId}/submit`;

  return { url, contestId, problemIndex };
}

export function wireSubmit() {
  const btn   = document.getElementById('cfr-submit');
  const label = btn.querySelector('.cfr-btn-label');

  btn.addEventListener('click', async () => {
    if (!isEditorReady) { showToast('Editor is still loading — try again in a moment.'); return; }

    const dest = parseSubmitDest();
    if (!dest) { showToast('Could not determine problem — submit from the problem page.', 'error'); return; }

    btn.disabled = true;
    btn.classList.add('cfr-busy');
    label.textContent = 'Opening';

    try {
      const code = await getValue();
      const lang = LANGUAGES[document.getElementById('cfr-lang').value];

      await storageSet(STORAGE_KEYS.SUBMIT, {
        code,
        cfId:         lang.cfId,
        contestId:    dest.contestId,
        problemIndex: dest.problemIndex,
        timestamp:    Date.now(),
      });

      window.location.href = dest.url;
    } catch (err) {
      showToast('Submit failed: ' + err.message, 'error');
      btn.disabled = false;
      btn.classList.remove('cfr-busy');
      label.textContent = 'Submit';
    }
  });
}
