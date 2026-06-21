let nextId = 0;
const pending = new Map();

window.addEventListener('message', ({ source, data }) => {
  if (source !== window || !data?.__cfr || data.type !== 'cfr:storage-response') return;
  const resolve = pending.get(data.requestId);
  if (!resolve) return;
  pending.delete(data.requestId);
  resolve(data);
});

function post(msg) {
  return new Promise(resolve => {
    const requestId = nextId++;
    pending.set(requestId, resolve);
    window.postMessage({ __cfr: true, requestId, ...msg }, window.location.origin);
  });
}

export const storageGet = key        => post({ type: 'cfr:storage-get', key }).then(r => r.value);
export const storageSet = (key, val) => post({ type: 'cfr:storage-set', key, value: val });
