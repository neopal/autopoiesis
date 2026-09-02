import { STAGES, buildTimeline } from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const timeline = buildTimeline(STAGES);
const STAGE_MS = 4200;
const started = performance.now();
const staticPreview = new URLSearchParams(location.search).get('static') === '1';

function pointString(points) {
  return points.map((point) => `${(point.x * 1000).toFixed(1)},${(point.y * 700).toFixed(1)}`).join(' ');
}

function circle(point, radius, className) {
  return `<circle class="${className}" cx="${(point.x * 1000).toFixed(1)}" cy="${(point.y * 700).toFixed(1)}" r="${radius}"/>`;
}

function render(frame, progress) {
  const draft = pointString(frame.draft);
  const accepted = pointString(frame.points);
  const cut = frame.draft[frame.cutIndex];
  const memoryMarks = frame.memory.map((point) => circle(point, 7, 'memory-mark')).join('');
  const dust = Array.from({ length: 6 }, (_, index) => {
    const x = 130 + index * 145;
    const y = 108 + ((frame.stage * 37 + index * 53) % 470);
    return `<line class="dust" x1="${x}" y1="${y}" x2="${x + 42}" y2="${y - 18}"/>`;
  }).join('');
  field.innerHTML = `
    <rect class="paper" x="0" y="0" width="1000" height="700"/>
    <g aria-hidden="true">${dust}</g>
    <polyline class="draft" points="${draft}"/>
    <polyline class="accepted" points="${accepted}" style="stroke-dashoffset:${Math.max(0, 620 - progress * 620)}"/>
    ${memoryMarks}
    ${circle(cut, 12, 'cut-mark')}
    <line class="cut-line" x1="${(cut.x * 1000 - 22).toFixed(1)}" y1="${(cut.y * 700 - 22).toFixed(1)}" x2="${(cut.x * 1000 + 22).toFixed(1)}" y2="${(cut.y * 700 + 22).toFixed(1)}"/>
    <text class="stage-mark" x="54" y="635">stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}</text>
  `;
  stageReadout.textContent = `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} inherited cuts`;
}

function frame(now) {
  const cycle = STAGE_MS * timeline.length;
  const elapsed = (now - started) % cycle;
  const stage = Math.max(0, Math.min(timeline.length - 1, Math.floor(elapsed / STAGE_MS)));
  const progress = (elapsed % STAGE_MS) / STAGE_MS;
  render(timeline[stage], progress);
  if (!staticPreview) requestAnimationFrame(frame);
}

render(staticPreview ? timeline[timeline.length - 1] : timeline[0], staticPreview ? 1 : 0);
if (!staticPreview) requestAnimationFrame(frame);
