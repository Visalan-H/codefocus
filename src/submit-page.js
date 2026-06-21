(function () {
  const KEY       = 'cfr_submit';
  const FORM_WAIT = 8000;
  const BTN_WAIT  = 5000;
  const POLL_MS   = 50;

  chrome.storage.local.get(KEY, result => {
    const data = result[KEY];
    if (!data) return;

    if (Date.now() - (data.timestamp || 0) > 120_000) {
      chrome.storage.local.remove(KEY);
      return;
    }

    chrome.storage.local.remove(KEY);
    waitForTextarea(data);
  });

  function waitForTextarea(data) {
    let waited = 0;
    const poll = setInterval(() => {
      const ta = document.getElementById('sourceCodeTextarea');
      if (!ta) {
        waited += POLL_MS;
        if (waited >= FORM_WAIT) clearInterval(poll);
        return;
      }
      clearInterval(poll);
      fillAndSubmit(ta, data);
    }, POLL_MS);
  }

  function fillAndSubmit(ta, data) {
    ta.value = data.code;
    ta.dispatchEvent(new Event('input',  { bubbles: true }));
    ta.dispatchEvent(new Event('change', { bubbles: true }));

    const langSel = document.querySelector("select[name='programTypeId']");
    if (langSel) {
      langSel.value = data.cfId;
      langSel.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (data.contestId) {
      const idxSel = document.querySelector("select[name='submittedProblemIndex']");
      if (idxSel) {
        for (const opt of idxSel.options) {
          if (opt.value === data.problemIndex) { opt.selected = true; break; }
        }
        idxSel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    waitForSubmitButton();
  }

  function waitForSubmitButton() {
    const btn = document.getElementById('singlePageSubmitButton');
    if (!btn) return;

    if (!btn.disabled) { btn.click(); return; }

    const giveUp = setTimeout(() => { observer.disconnect(); btn.click(); }, BTN_WAIT);

    const observer = new MutationObserver(() => {
      if (btn.disabled) return;
      observer.disconnect();
      clearTimeout(giveUp);
      btn.click();
    });

    observer.observe(btn, { attributes: true, subtree: true, childList: true });

    const form = btn.closest('form');
    if (form) observer.observe(form, { childList: true });
  }
})();
