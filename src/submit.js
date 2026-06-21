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
  const url          = contestId ? `/contest/${contestId}/submit` : '/problemset/submit';

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
  });
}
