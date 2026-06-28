import { EDITOR_ID } from './config.js';

export let isEditorReady = false;

// NOTE: pendingValueResolve is a single slot — concurrent getValue() calls would race (the
// second call overwrites the first resolve, leaving the first caller hanging forever).
// In practice this is safe because all callers await getValue() before continuing,
// but if you ever add parallel getValue() usage, replace this with a pending Map keyed
// by requestId (see storage.js for the pattern).
let resolveReady;
let pendingValueResolve = null;
const changeListeners = [];

export const monacoReady = new Promise(resolve => { resolveReady = resolve; });

function post(msg) {
  window.postMessage({ __cfr: true, ...msg }, window.location.origin);
}

window.addEventListener('message', ({ origin, data }) => {
  if (origin !== window.location.origin || !data?.__cfr) return;

  if (data.type === 'cfr:ready')   resolveReady();
  if (data.type === 'cfr:mounted') isEditorReady = true;

  if (data.type === 'cfr:changed') {
    changeListeners.forEach(fn => fn(data.value));
  }

  if (data.type === 'cfr:value' && pendingValueResolve) {
    pendingValueResolve(data.value);
    pendingValueResolve = null;
  }
});

export const mountEditor  = (language, value) => post({ type: 'cfr:mount',        containerId: EDITOR_ID, language, value });
export const setLanguage  = (language)        => post({ type: 'cfr:set-language', containerId: EDITOR_ID, language });
export const setValue     = (value)           => post({ type: 'cfr:set-value',    containerId: EDITOR_ID, value });
export const watchChanges = ()                => post({ type: 'cfr:watch-changes', containerId: EDITOR_ID });
export const onEditorChange = (fn)            => { changeListeners.push(fn); };

export function getValue() {
  return new Promise(resolve => {
    pendingValueResolve = resolve;
    post({ type: 'cfr:get-value', containerId: EDITOR_ID });
  });
}
