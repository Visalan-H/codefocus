export function waitFor(selector, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);

    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector);
      if (!found) return;
      observer.disconnect();
      resolve(found);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timed out waiting for: ${selector}`));
    }, timeout);
  });
}

export function scrapeSamples() {
  const inputs  = document.querySelectorAll('.sample-tests .input pre');
  const outputs = document.querySelectorAll('.sample-tests .output pre');
  const count   = Math.min(inputs.length, outputs.length);

  return Array.from({ length: count }, (_, i) => ({
    input:    (inputs[i].innerText  || inputs[i].textContent).trim() + '\n',
    expected: (outputs[i].innerText || outputs[i].textContent).trim(),
  }));
}

export function normalize(str) {
  return str
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .join('\n');
}

export function escapeHtml(str) {
  return str.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

export function showToast(message, variant) {
  let host = document.getElementById('cfr-toast-host');
  if (!host) {
    host = Object.assign(document.createElement('div'), { id: 'cfr-toast-host' });
    document.body.appendChild(host);
  }

  const toast = Object.assign(document.createElement('div'), {
    className:   variant === 'error' ? 'cfr-toast cfr-toast-error' : 'cfr-toast',
    textContent: message,
  });

  host.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('cfr-toast-in'));

  setTimeout(() => {
    toast.classList.remove('cfr-toast-in');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 3200);
}
