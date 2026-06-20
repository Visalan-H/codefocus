import { LANGUAGES }               from './config.js';
import { isEditorReady, getValue } from './bridge.js';
import { showToast }               from './utils.js';

export function wireSubmit() {
  document.getElementById('cfr-submit').addEventListener('click', async () => {
    if (!isEditorReady) {
      showToast('Editor is still loading — try again in a moment.');
      return;
    }

    const btn   = document.getElementById('cfr-submit');
    const label = btn.querySelector('.cfr-btn-label');

    const code = await getValue();
    const lang = LANGUAGES[document.getElementById('cfr-lang').value];

    const form   = document.querySelector('form[name="submitForm"], form#formSubmit, form[action*="submit"]');
    const source = form?.querySelector('textarea[name="source"]');
    const type   = form?.querySelector('select[name="programTypeId"]');

    if (!form) {
      showToast("Couldn't find Codeforces' submit form — submit manually.", 'error');
      return;
    }
    if (!source || !type) {
      showToast('Submit form fields look different — submit manually.', 'error');
      return;
    }

    btn.disabled = true;
    btn.classList.add('cfr-busy');
    label.textContent = 'Submitting';

    source.value = code;
    type.value   = lang.cfId;
    form.submit();
  });
}
