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
  });
}
