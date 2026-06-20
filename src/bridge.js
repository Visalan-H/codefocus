import { EDITOR_ID } from './config.js';

export let isEditorReady = false;

let resolveMonacoReady;
let pendingValue = null;

export const monacoReady = new Promise(function (resolve) {
  resolveMonacoReady = resolve;
});

function post(msg) {
  window.postMessage({ __cfr: true, ...msg }, window.location.origin);
}

function onMessage({ origin, data }) {
  if (origin !== window.location.origin) return;
  if (!data || !data.__cfr) return;

  if (data.type === 'cfr:ready')   resolveMonacoReady();
  if (data.type === 'cfr:mounted') isEditorReady = true;

  if (data.type === 'cfr:value' && pendingValue) {
    pendingValue(data.value);
    pendingValue = null;
  }
}

window.addEventListener('message', onMessage);

export function mountEditor(language, value) {
  post({ type: 'cfr:mount', containerId: EDITOR_ID, language, value });
}

export function setLanguage(language) {
  post({ type: 'cfr:set-language', containerId: EDITOR_ID, language });
}

export function setValue(value) {
  post({ type: 'cfr:set-value', containerId: EDITOR_ID, value });
}

export function getValue() {
  return new Promise(function (resolve) {
    pendingValue = resolve;
    post({ type: 'cfr:get-value', containerId: EDITOR_ID });
  });
}
