import { STORAGE_KEYS } from './config.js';
import { storageSet }   from './storage.js';

export function wireSplitter() {
  const wrapper  = document.getElementById('cfr-wrapper');
  const splitter = document.getElementById('cfr-splitter');
  const left     = document.getElementById('cfr-left');
  const right    = document.getElementById('cfr-right');
  let dragging   = false;

  splitter.addEventListener('mousedown', () => {
    dragging = true;
    document.body.style.cursor = 'col-resize';
    splitter.classList.add('cfr-dragging');
  });

  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const { left: wLeft, width } = wrapper.getBoundingClientRect();
    const pct = Math.min(80, Math.max(20, ((e.clientX - wLeft) / width) * 100));
    left.style.width  = pct + '%';
    right.style.width = (100 - pct) + '%';
  });

  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = '';
    splitter.classList.remove('cfr-dragging');
    const pct = parseFloat(left.style.width);
    if (!isNaN(pct)) storageSet(STORAGE_KEYS.SPLIT_W, pct);
  });
}

export function wireConsoleResizer() {
  const right   = document.getElementById('cfr-right');
  const resizer = document.getElementById('cfr-console-resizer');
  const panel   = document.getElementById('cfr-console');
  let dragging    = false;
  let startY      = 0;
  let startHeight = 0;

  resizer.addEventListener('mousedown', e => {
    dragging    = true;
    startY      = e.clientY;
    startHeight = panel.getBoundingClientRect().height;
    document.body.style.cursor = 'row-resize';
    resizer.classList.add('cfr-dragging');
  });

  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const maxH = right.getBoundingClientRect().height - 160;
    panel.style.height = Math.min(maxH, Math.max(120, startHeight + (startY - e.clientY))) + 'px';
  });

  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = '';
    resizer.classList.remove('cfr-dragging');
    const h = parseFloat(panel.style.height);
    if (!isNaN(h)) storageSet(STORAGE_KEYS.CONSOLE_H, h);
  });
}

export function wireSketchResizer() {
  const left    = document.getElementById('cfr-left');
  const resizer = document.getElementById('cfr-sketch-resizer');
  const panel   = document.getElementById('cfr-sketch-panel');
  let dragging    = false;
  let startY      = 0;
  let startHeight = 0;

  resizer.addEventListener('mousedown', e => {
    dragging    = true;
    startY      = e.clientY;
    startHeight = panel.getBoundingClientRect().height;
    document.body.style.cursor = 'row-resize';
    resizer.classList.add('cfr-dragging');
  });

  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const maxH = left.getBoundingClientRect().height - 160;
    panel.style.height = Math.min(maxH, Math.max(120, startHeight + (startY - e.clientY))) + 'px';
    window.dispatchEvent(new Event('resize'));
  });

  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = '';
    resizer.classList.remove('cfr-dragging');
    const h = parseFloat(panel.style.height);
    if (!isNaN(h)) storageSet(STORAGE_KEYS.SKETCH_H, h);
  });
}
