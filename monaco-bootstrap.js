(function () {
  'use strict';

  const vsBase    = document.currentScript.dataset.vsBase;
  const workerUrl = document.currentScript.dataset.workerUrl;

  let editor = null;

  function post(msg) {
    window.postMessage({ __cfr: true, ...msg }, window.location.origin);
  }

  function getWorkerUrl() {
    // Blob-wrap the worker so Chrome allows it under the extension's CSP
    const script = 'importScripts(' + JSON.stringify(workerUrl) + ');';
    const blob   = new Blob([script], { type: 'text/javascript' });
    return URL.createObjectURL(blob);
  }

  function onMessage({ origin, data }) {
    if (origin !== window.location.origin) return;
    if (!data || !data.__cfr) return;

    if (data.type === 'cfr:mount') {
      const container = document.getElementById(data.containerId);
      if (!container) return;
      editor = monaco.editor.create(container, {
        value:                data.value || '',
        language:             data.language,
        theme:                'vs-dark',
        fontSize:             14,
        fontFamily:           "'JetBrains Mono', 'Fira Code', Consolas, monospace",
        minimap:              { enabled: false },
        automaticLayout:      true,
        scrollBeyondLastLine: false,
        wordWrap:             'on',
        wrappingIndent:       'same',
        padding:              { top: 12 },
      });
      post({ type: 'cfr:mounted' });
    }

    if (data.type === 'cfr:get-value') {
      post({ type: 'cfr:value', value: editor ? editor.getValue() : '' });
    }

    if (data.type === 'cfr:set-language' && editor) {
      monaco.editor.setModelLanguage(editor.getModel(), data.language);
    }

    if (data.type === 'cfr:set-value' && editor) {
      editor.setValue(data.value || '');
    }

    if (data.type === 'cfr:watch-changes' && editor) {
      editor.onDidChangeModelContent(() => {
        post({ type: 'cfr:changed', value: editor.getValue() });
      });
    }
  }

  function boot() {
    self.MonacoEnvironment = { getWorkerUrl };
    self.require.config({ paths: { vs: vsBase } });
    self.require(['vs/editor/editor.main'], function () {
      window.addEventListener('message', onMessage);
      post({ type: 'cfr:ready' });
    });
  }

  const loader = document.createElement('script');
  loader.src    = vsBase + '/loader.js';
  loader.onload = boot;
  document.head.appendChild(loader);
})();
