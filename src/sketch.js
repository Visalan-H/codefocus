/**
 * sketch.js — Excalidraw-style scratch pad
 *
 * Tools: select, text, pen, line, arrow, rect, ellipse, diamond, triangle
 * Rough.js rendering, undo stack, per-problem persistence.
 */

import { storageGet, storageSet } from './storage.js';
import { rough } from '../lib/rough.js';

// constants

const STROKE     = '#cccccc';
const ACCENT     = '#0078d4';
const FONT       = '15px ui-monospace, "JetBrains Mono", Consolas, monospace';
const LINE_H     = 20;
const ARROW_SIZE = 14;
const HIT_PAD    = 8;
const ROUGH_BASE = { stroke: STROKE, strokeWidth: 1.5, roughness: 1.3, bowing: 1 };

// state

let rc         = null;
let canvas     = null;
let ctx        = null;
let storKey    = null;

let tool       = 'select';
let elements   = [];
let undoStack  = [];

let isDrawing  = false;
let liveEl     = null;
let selectedId = null;
let dragState  = null;   // { beforeSnap, beforeNextId, snap, mx, my, moved }
let penPts     = null;
let textEl     = null;   // active <textarea> overlay
let saveTimer  = null;
let nextId     = 1;

// public API

export async function initSketch(canvasEl, sketchStorageKey) {
  canvas  = canvasEl;
  ctx     = canvas.getContext('2d');
  storKey = sketchStorageKey;
  rc      = rough.canvas(canvas);

  await loadState();
  // Don't call resizeCanvas()/render() here — the panel is display:none at
  // this point so getBoundingClientRect() returns 0×0. The 'resize' event
  // dispatched by open() will trigger the first real paint.

  canvas.addEventListener('mousedown',  onDown);
  canvas.addEventListener('mousemove',  onMove);
  canvas.addEventListener('mouseup',    onUp);
  canvas.addEventListener('mouseleave', onLeave);

  window.addEventListener('resize', () => { resizeCanvas(); render(); });
}

export function setTool(t) {
  commitText();
  tool       = t;
  isDrawing  = false;
  liveEl     = null;
  penPts     = null;
  dragState  = null;
  selectedId = null;
  canvas.style.cursor = t === 'select' ? 'default' : t === 'text' ? 'text' : 'crosshair';
  render();
}

export function undo() {
  commitText();
  if (!undoStack.length) return;
  const snap = undoStack.pop();
  elements   = snap.elements;
  nextId     = snap.nextId;
  selectedId = null;
  render();
  scheduleSave();
}

export function clearSketch() {
  commitText();
  snapshot();
  elements   = [];
  nextId     = 1;
  selectedId = null;
  render();
  scheduleSave();
}

// canvas sizing

function resizeCanvas() {
  const { width, height } = canvas.getBoundingClientRect();
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width  = width;
    canvas.height = height;
  }
}

// snapshot / persistence

function snapshot() {
  undoStack.push({ elements: JSON.parse(JSON.stringify(elements)), nextId });
  if (undoStack.length > 50) undoStack.shift();
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    storageSet(storKey, JSON.stringify({ elements, nextId }));
  }, 800);
}

async function loadState() {
  try {
    const raw = await storageGet(storKey);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!Array.isArray(data.elements)) return; // old format → start fresh
    elements = data.elements;
    nextId   = data.nextId ?? (elements.length + 1);
  } catch (_) { /* fresh start */ }
}

// geometry helpers

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function getBounds(el) {
  if (el.type === 'pen') {
    if (!el.pts?.length) return { x: 0, y: 0, w: 0, h: 0 };
    const xs = el.pts.map(p => p[0]);
    const ys = el.pts.map(p => p[1]);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }
  if (el.type === 'text') {
    ctx.font = FONT;
    const lines = (el.text || '').split('\n');
    const w = Math.max(...lines.map(l => ctx.measureText(l).width), 40);
    return { x: el.x1, y: el.y1, w, h: lines.length * LINE_H };
  }
  return {
    x: Math.min(el.x1, el.x2),
    y: Math.min(el.y1, el.y2),
    w: Math.abs(el.x2 - el.x1),
    h: Math.abs(el.y2 - el.y1),
  };
}

function hitTest(el, x, y) {
  if (el.type === 'pen') {
    for (let i = 1; i < el.pts.length; i++) {
      if (distToSegment(x, y, el.pts[i-1][0], el.pts[i-1][1], el.pts[i][0], el.pts[i][1]) < HIT_PAD)
        return true;
    }
    return false;
  }
  if (el.type === 'line' || el.type === 'arrow') {
    return distToSegment(x, y, el.x1, el.y1, el.x2, el.y2) < HIT_PAD;
  }
  const b = getBounds(el);
  return x >= b.x - HIT_PAD && x <= b.x + b.w + HIT_PAD &&
         y >= b.y - HIT_PAD && y <= b.y + b.h + HIT_PAD;
}

function elementAt(x, y) {
  for (let i = elements.length - 1; i >= 0; i--) {
    if (hitTest(elements[i], x, y)) return elements[i];
  }
  return null;
}

// render

function render() {
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  for (const el of elements) drawElement(el);
  if (liveEl) drawElement(liveEl);
  if (selectedId != null) {
    const sel = elements.find(e => e.id === selectedId);
    if (sel) drawSelection(sel);
  }
}

function drawElement(el) {
  const opts = { ...ROUGH_BASE, seed: el.seed ?? 1 };

  switch (el.type) {
    case 'pen': {
      if (!el.pts || el.pts.length < 2) return;
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = STROKE;
      ctx.lineWidth   = 1.5;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.moveTo(el.pts[0][0], el.pts[0][1]);
      for (let i = 1; i < el.pts.length; i++) ctx.lineTo(el.pts[i][0], el.pts[i][1]);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'rect': {
      const x = Math.min(el.x1, el.x2), y = Math.min(el.y1, el.y2);
      const w = Math.abs(el.x2 - el.x1),  h = Math.abs(el.y2 - el.y1);
      if (w < 2 || h < 2) return;
      rc.rectangle(x, y, w, h, opts);
      break;
    }
    case 'ellipse': {
      const cx = (el.x1 + el.x2) / 2, cy = (el.y1 + el.y2) / 2;
      const w  = Math.abs(el.x2 - el.x1),  h = Math.abs(el.y2 - el.y1);
      if (w < 2 || h < 2) return;
      rc.ellipse(cx, cy, w, h, opts);
      break;
    }
    case 'diamond': {
      const x1 = Math.min(el.x1, el.x2), y1 = Math.min(el.y1, el.y2);
      const x2 = Math.max(el.x1, el.x2), y2 = Math.max(el.y1, el.y2);
      if (x2 - x1 < 2 || y2 - y1 < 2) return;
      rc.polygon([[(x1+x2)/2, y1], [x2, (y1+y2)/2], [(x1+x2)/2, y2], [x1, (y1+y2)/2]], opts);
      break;
    }
    case 'triangle': {
      const x1 = Math.min(el.x1, el.x2), y1 = Math.min(el.y1, el.y2);
      const x2 = Math.max(el.x1, el.x2), y2 = Math.max(el.y1, el.y2);
      if (x2 - x1 < 2 || y2 - y1 < 2) return;
      rc.polygon([[(x1+x2)/2, y1], [x2, y2], [x1, y2]], opts);
      break;
    }
    case 'line': {
      if (Math.hypot(el.x2 - el.x1, el.y2 - el.y1) < 2) return;
      rc.line(el.x1, el.y1, el.x2, el.y2, opts);
      break;
    }
    case 'arrow': {
      if (Math.hypot(el.x2 - el.x1, el.y2 - el.y1) < 2) return;
      rc.line(el.x1, el.y1, el.x2, el.y2, opts);
      drawArrowHead(el.x1, el.y1, el.x2, el.y2);
      break;
    }
    case 'text': {
      if (!el.text) return;
      ctx.save();
      ctx.font         = FONT;
      ctx.fillStyle    = STROKE;
      ctx.textBaseline = 'top';
      el.text.split('\n').forEach((line, i) => ctx.fillText(line, el.x1, el.y1 + i * LINE_H));
      ctx.restore();
      break;
    }
  }
}

function drawArrowHead(x1, y1, x2, y2) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const s     = ARROW_SIZE;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - s * Math.cos(angle - 0.42), y2 - s * Math.sin(angle - 0.42));
  ctx.lineTo(x2 - s * Math.cos(angle + 0.42), y2 - s * Math.sin(angle + 0.42));
  ctx.closePath();
  ctx.fillStyle = STROKE;
  ctx.fill();
  ctx.restore();
}

function drawSelection(el) {
  const b   = getBounds(el);
  const pad = 6;
  ctx.save();
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.strokeRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2);
  ctx.restore();
}

// text input overlay

function openTextInput(x, y) {
  const r = canvas.getBoundingClientRect();

  textEl = document.createElement('textarea');
  Object.assign(textEl.style, {
    position:     'fixed',
    left:         `${r.left + x}px`,
    top:          `${r.top  + y - 2}px`,
    minWidth:     '120px',
    height:       `${LINE_H + 4}px`,
    background:   'rgba(30,30,30,0.92)',
    border:       `1.5px dashed ${ACCENT}`,
    borderRadius: '2px',
    color:        STROKE,
    font:         FONT,
    padding:      '1px 4px',
    outline:      'none',
    resize:       'none',
    overflow:     'hidden',
    zIndex:       '9999999',
    caretColor:   STROKE,
    lineHeight:   `${LINE_H}px`,
    whiteSpace:   'pre',
  });
  textEl.dataset.tx = x;
  textEl.dataset.ty = y;

  textEl.addEventListener('input', () => {
    textEl.style.height = 'auto';
    textEl.style.height = `${textEl.scrollHeight}px`;
  });

  textEl.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); commitText(); }
  });
  // Commit on blur, but only after a tick so programmatic focus-shifts
  // (e.g. the canvas regaining focus momentarily) don't fire it immediately.
  textEl.addEventListener('blur', () => setTimeout(() => commitText(), 0));

  // Prevent the canvas mousedown (which fires openTextInput) from immediately
  // stealing focus back from the textarea on some browsers.
  textEl.addEventListener('mousedown', e => e.stopPropagation());

  // Append inside cfr-wrapper so it's in the same fixed stacking context and
  // isn't clipped by any Codeforces body/html transforms or overflow rules.
  const host = document.getElementById('cfr-wrapper') ?? document.body;
  host.appendChild(textEl);
  // requestAnimationFrame ensures the element is painted before we focus,
  // which avoids a race where blur fires synchronously on some Chromium builds.
  requestAnimationFrame(() => textEl?.focus());
}

function commitText() {
  if (!textEl) return;
  const text = textEl.value;
  const x    = Number(textEl.dataset.tx);
  const y    = Number(textEl.dataset.ty);
  textEl.remove();
  textEl = null;

  if (text.trim()) {
    snapshot();
    elements.push({ id: nextId++, type: 'text', x1: x, y1: y, text, seed: 0 });
    scheduleSave();
  }
  render();
}

// mouse handlers

function getPos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function onDown(e) {
  if (e.button !== 0) return;
  const { x, y } = getPos(e);

  if (tool === 'text') {
    openTextInput(x, y);
    return;
  }

  if (tool === 'select') {
    const hit = elementAt(x, y);
    if (hit) {
      selectedId = hit.id;
      dragState  = {
        beforeSnap:   JSON.parse(JSON.stringify(elements)),
        beforeNextId: nextId,
        snap:         JSON.parse(JSON.stringify(hit)),
        mx: x, my: y,
        moved: false,
      };
    } else {
      selectedId = null;
    }
    render();
    return;
  }

  if (tool === 'pen') {
    penPts    = [[x, y]];
    isDrawing = true;
    return;
  }

  isDrawing = true;
  liveEl    = { id: -1, type: tool, x1: x, y1: y, x2: x, y2: y, seed: Math.floor(Math.random() * 65536) };
}

function onMove(e) {
  const { x, y } = getPos(e);

  if (dragState) {
    dragState.moved = true;
    const { snap, mx, my } = dragState;
    const dx = x - mx, dy = y - my;
    const el = elements.find(el => el.id === selectedId);
    if (!el) return;

    if (el.type === 'pen') {
      el.pts = snap.pts.map(p => [p[0] + dx, p[1] + dy]);
    } else if (el.type === 'text') {
      el.x1 = snap.x1 + dx;
      el.y1 = snap.y1 + dy;
    } else {
      el.x1 = snap.x1 + dx; el.y1 = snap.y1 + dy;
      el.x2 = snap.x2 + dx; el.y2 = snap.y2 + dy;
    }
    render();
    return;
  }

  if (tool === 'pen' && penPts) {
    penPts.push([x, y]);
    if (penPts.length > 1) {
      const prev = penPts[penPts.length - 2];
      ctx.beginPath();
      ctx.strokeStyle = STROKE;
      ctx.lineWidth   = 1.5;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.moveTo(prev[0], prev[1]);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    return;
  }

  if (isDrawing && liveEl) {
    liveEl.x2 = x;
    liveEl.y2 = y;
    render();
  }
}

function onUp(e) {
  const { x, y } = getPos(e);

  if (dragState) {
    if (dragState.moved) {
      undoStack.push({ elements: dragState.beforeSnap, nextId: dragState.beforeNextId });
      if (undoStack.length > 50) undoStack.shift();
      scheduleSave();
    }
    dragState = null;
    render();
    return;
  }

  if (tool === 'pen' && penPts && penPts.length > 1) {
    snapshot();
    elements.push({ id: nextId++, type: 'pen', pts: penPts, seed: 0 });
    penPts    = null;
    isDrawing = false;
    render();
    scheduleSave();
    return;
  }

  if (isDrawing && liveEl) {
    liveEl.x2 = x;
    liveEl.y2 = y;
    if (Math.hypot(liveEl.x2 - liveEl.x1, liveEl.y2 - liveEl.y1) > 4) {
      snapshot();
      liveEl.id = nextId++;
      elements.push(liveEl);
      scheduleSave();
    }
    liveEl    = null;
    isDrawing = false;
    render();
  }

  penPts = null;
}

function onLeave() {
  if (tool === 'pen' && penPts && penPts.length > 1) {
    snapshot();
    elements.push({ id: nextId++, type: 'pen', pts: penPts, seed: 0 });
    scheduleSave();
  }
  if (dragState?.moved) {
    undoStack.push({ elements: dragState.beforeSnap, nextId: dragState.beforeNextId });
    if (undoStack.length > 50) undoStack.shift();
    scheduleSave();
  }
  penPts    = null;
  isDrawing = false;
  liveEl    = null;
  dragState = null;
  render();
}
