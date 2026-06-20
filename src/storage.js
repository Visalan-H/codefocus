let _nextId = 0;
const _pending = new Map();

window.addEventListener('message', function (event) {
  if (event.source !== window)           return;
  if (!event.data || !event.data.__cfr) return;
  if (event.data.type !== 'cfr:storage-response') return;

  const handler = _pending.get(event.data.requestId);
  if (!handler) return;
  _pending.delete(event.data.requestId);
  handler(event.data);
});

function post(msg) {
  return new Promise(function (resolve) {
    const requestId = _nextId++;
    _pending.set(requestId, resolve);
    window.postMessage({ __cfr: true, requestId, ...msg }, window.location.origin);
  });
}

export function storageGet(key) {
  return post({ type: 'cfr:storage-get', key }).then(function (r) { return r.value; });
}

export function storageSet(key, value) {
  return post({ type: 'cfr:storage-set', key, value });
}
