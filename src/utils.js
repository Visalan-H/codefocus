export function waitFor(selector, timeout = 8000) {
  return new Promise(function (resolve, reject) {
    const el = document.querySelector(selector);
    if (el) {
      resolve(el);
      return;
    }

    function onMutation() {
      const found = document.querySelector(selector);
      if (!found) return;
      observer.disconnect();
      resolve(found);
    }

    const observer = new MutationObserver(onMutation);
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(function () {
      observer.disconnect();
      reject(new Error('Element not found: ' + selector));
    }, timeout);
  });
}

export function scrapeSamples() {
  const inputEls  = document.querySelectorAll('.sample-tests .input pre');
  const outputEls = document.querySelectorAll('.sample-tests .output pre');
  const count     = Math.min(inputEls.length, outputEls.length);
  const samples   = [];

  for (let i = 0; i < count; i++) {
    samples.push({
      input:    (inputEls[i].innerText  || inputEls[i].textContent).trim() + '\n',
      expected: (outputEls[i].innerText || outputEls[i].textContent).trim(),
    });
  }

  return samples;
}

export function normalize(str) {
  return str
    .split('\n')
    .map(function (line) { return line.trim(); })
    .filter(function (line) { return line.length > 0; })
    .join('\n');
}

export function escapeHtml(str) {
  return str.replace(/[&<>]/g, function (char) {
    if (char === '&') return '&amp;';
    if (char === '<') return '&lt;';
    if (char === '>') return '&gt;';
  });
}

export function showToast(message, variant) {
  let host = document.getElementById('cfr-toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'cfr-toast-host';
    document.body.appendChild(host);
  }

  const toast = document.createElement('div');
  toast.className = variant === 'error' ? 'cfr-toast cfr-toast-error' : 'cfr-toast';
  toast.textContent = message;
  host.appendChild(toast);

  requestAnimationFrame(function () {
    toast.classList.add('cfr-toast-in');
  });

  setTimeout(function () {
    toast.classList.remove('cfr-toast-in');
    toast.addEventListener('transitionend', function () { toast.remove(); }, { once: true });
  }, 3200);
}
