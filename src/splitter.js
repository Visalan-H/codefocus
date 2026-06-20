export function wireSplitter() {
  const wrapper  = document.getElementById('cfr-wrapper');
  const splitter = document.getElementById('cfr-splitter');
  const left     = document.getElementById('cfr-left');
  const right    = document.getElementById('cfr-right');
  let dragging   = false;

  function onDragStart() {
    dragging = true;
    document.body.style.cursor = 'col-resize';
    splitter.classList.add('cfr-dragging');
  }

  function onDrag(event) {
    if (!dragging) return;
    const bounds  = wrapper.getBoundingClientRect();
    const pct     = ((event.clientX - bounds.left) / bounds.width) * 100;
    const clamped = Math.min(80, Math.max(20, pct));
    left.style.width  = clamped + '%';
    right.style.width = (100 - clamped) + '%';
  }

  function onDragEnd() {
    dragging = false;
    document.body.style.cursor = '';
    splitter.classList.remove('cfr-dragging');
  }

  splitter.addEventListener('mousedown', onDragStart);
  window.addEventListener('mousemove',   onDrag);
  window.addEventListener('mouseup',     onDragEnd);
}
