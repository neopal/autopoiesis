export const MEMORY_LIMIT = 4;
export const STAGES = 9;
export const PANEL_COUNT = 9;
export const HANDLE_THRESHOLD = 0.34;

const SEED = 0x42523435;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value) => Number(value.toFixed(5));
const clampIndex = (value, count) => ((Math.floor(Number(value) || 0) % count) + count) % count;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function hash(value) {
  let state = (value >>> 0) + 0x9e3779b9;
  state = Math.imul(state ^ (state >>> 16), 0x85ebca6b);
  state = Math.imul(state ^ (state >>> 13), 0xc2b2ae35);
  return (state ^ (state >>> 16)) >>> 0;
}

const seeded = (index, salt) => (hash(SEED + index * 977 + salt * 389) >>> 0) / 4294967296;

function normalizePoint(point = {}) {
  return {
    x: round(clamp(Number(point.x) || 0, 0.02, 0.98)),
    y: round(clamp(Number(point.y) || 0, 0.04, 0.96))
  };
}

function normalizeEvent(event = {}) {
  const left = normalizePoint(event.left);
  const right = normalizePoint(event.right);
  return {
    source: event.source || 'unknown',
    type: 'opposing-compression',
    left,
    right,
    pressure: round(clamp(Number(event.pressure) || 0.72, 0.36, 1)),
    remotePanel: clampIndex(event.remotePanel, PANEL_COUNT),
    phase: round(clamp(Number(event.phase) || 0.58, 0.34, 1.3)),
    field: Number.isFinite(event.field) ? event.field >>> 0 : hash(SEED + 101)
  };
}

function pointAt(cx, cy, radiusX, radiusY, angle, wobble = 0) {
  return {
    x: round(cx + Math.cos(angle) * radiusX + Math.sin(angle * 3.1) * wobble),
    y: round(cy + Math.sin(angle) * radiusY + Math.cos(angle * 2.7) * wobble)
  };
}

function basePanels() {
  const panels = [];
  const cx = 0.5;
  const cy = 0.5;
  const innerX = 0.18;
  const innerY = 0.22;
  const outerX = 0.39;
  const outerY = 0.42;
  for (let index = 0; index < PANEL_COUNT; index += 1) {
    const angle = -2.72 + index * (5.44 / (PANEL_COUNT - 1));
    const span = 0.26 + (index % 3) * 0.025;
    const innerA = angle - span;
    const outerA = angle - span * 0.78;
    const outerB = angle + span * 0.82;
    const innerB = angle + span;
    const wobble = 0.012 + (index % 2) * 0.008;
    const vertices = [
      pointAt(cx, cy, innerX, innerY, innerA, wobble),
      pointAt(cx, cy, outerX + (seeded(index, 3) - 0.5) * 0.03, outerY, outerA, wobble),
      pointAt(cx, cy, outerX, outerY + (seeded(index, 4) - 0.5) * 0.03, outerB, wobble),
      pointAt(cx, cy, innerX, innerY, innerB, wobble)
    ];
    panels.push({
      id: index,
      vertices,
      tone: round(0.22 + index * 0.051),
      memory: 0
    });
  }
  return panels;
}

function baseSeams() {
  return Array.from({ length: PANEL_COUNT - 1 }, (_, index) => ({
    id: index,
    a: round(0.21 + index * 0.036),
    b: round(0.78 - index * 0.031),
    bend: round((index % 2 ? -1 : 1) * (0.014 + (index % 3) * 0.006)),
    weight: round(0.7 + seeded(index, 12) * 0.25)
  }));
}

function baseOpenings() {
  return [
    { id: 0, x: 0.47, y: 0.32, rx: 0.045, ry: 0.078, tilt: -0.22, open: 0.16 },
    { id: 1, x: 0.58, y: 0.43, rx: 0.038, ry: 0.064, tilt: 0.38, open: 0.12 },
    { id: 2, x: 0.42, y: 0.59, rx: 0.052, ry: 0.068, tilt: 0.17, open: 0.14 },
    { id: 3, x: 0.57, y: 0.69, rx: 0.041, ry: 0.071, tilt: -0.33, open: 0.1 }
  ];
}

function baseBody() {
  return {
    panels: basePanels(),
    seams: baseSeams(),
    openings: baseOpenings(),
    clasp: { x: 0.5, y: 0.5, tension: 0.18, jawGap: 0.24 },
    creases: []
  };
}

function buildBody(memory) {
  const body = baseBody();
  for (const [eventIndex, rawEvent] of memory.entries()) {
    const event = normalizeEvent(rawEvent);
    const remote = event.remotePanel;
    const pressure = event.pressure;
    const phase = event.phase;
    body.clasp.tension = round(body.clasp.tension + pressure * 0.16);
    body.clasp.jawGap = round(clamp(body.clasp.jawGap - pressure * 0.025, 0.08, 0.28));
    for (const panel of body.panels) {
      const distanceFromRemote = Math.abs(panel.id - remote);
      const influence = Math.max(0.06, 1 - distanceFromRemote * 0.17);
      panel.memory = round(panel.memory + influence * pressure);
      panel.vertices = panel.vertices.map((vertex, vertexIndex) => {
        const side = vertexIndex < 2 ? -1 : 1;
        const curl = Math.sin((panel.id + 1) * 1.3 + vertexIndex * 1.7 + eventIndex) * 0.006;
        return {
          x: round(clamp(vertex.x + (side * influence * pressure * 0.009) + curl * phase, 0.04, 0.96)),
          y: round(clamp(vertex.y + (panel.id <= remote ? -1 : 1) * influence * pressure * 0.012 + curl * 0.7, 0.04, 0.96))
        };
      });
    }
    for (const seam of body.seams) {
      const proximity = Math.max(0.06, 1 - Math.abs(seam.id - remote) * 0.16);
      seam.bend = round(seam.bend + (eventIndex % 2 ? -1 : 1) * proximity * pressure * 0.05);
      seam.weight = round(clamp(seam.weight + proximity * pressure * 0.08, 0.5, 1.5));
    }
    const opening = body.openings[(remote + eventIndex) % body.openings.length];
    opening.open = round(clamp(opening.open + 0.22 + pressure * 0.16, 0.1, 0.96));
    opening.rx = round(clamp(opening.rx + pressure * 0.009, 0.025, 0.12));
    opening.ry = round(clamp(opening.ry + phase * 0.011, 0.03, 0.14));
    opening.tilt = round(opening.tilt + (eventIndex % 2 ? -1 : 1) * pressure * 0.12);
    body.creases.push({
      id: eventIndex,
      panel: remote,
      x: round(0.32 + ((event.field % 1000) / 1000) * 0.36),
      y: round(0.22 + (((event.field >>> 8) % 1000) / 1000) * 0.56),
      length: round(0.08 + pressure * 0.08),
      depth: round(0.32 + phase * 0.42),
      twist: round((eventIndex % 2 ? -1 : 1) * (0.2 + pressure * 0.24))
    });
  }
  return body;
}

function cloneHandles(handles = {}) {
  return {
    left: handles.left ? normalizePoint(handles.left) : null,
    right: handles.right ? normalizePoint(handles.right) : null
  };
}

function buildFrameFrom(stage, memory, interaction = 'baseline', pending = {}) {
  const boundedMemory = memory.slice(-MEMORY_LIMIT).map(normalizeEvent);
  return {
    grammar: 'opposing-jaw-clasp',
    renderer: 'deterministic p5.js Canvas 2D compressed pigment clasp',
    stage,
    memory: boundedMemory,
    memoryLimit: MEMORY_LIMIT,
    body: buildBody(boundedMemory),
    event: boundedMemory.length ? { ...boundedMemory.at(-1), committed: true, index: boundedMemory.length - 1 } : null,
    pending: {
      active: pending.active === true,
      side: pending.side || null,
      path: (pending.path || []).map(normalizePoint).slice(0, 24),
      handles: cloneHandles(pending.handles),
      leftReady: Boolean(pending.handles?.left),
      rightReady: Boolean(pending.handles?.right),
      compression: round(Number(pending.compression) || 0)
    },
    state: {
      compressionCount: boundedMemory.length,
      materialTension: round(boundedMemory.reduce((sum, event) => sum + event.pressure, 0))
    },
    interaction
  };
}

export function buildFrame(stage = 0, memory = []) {
  return buildFrameFrom(stage, memory);
}

function handleSide(point) {
  if (point.x <= 0.2) return 'left';
  if (point.x >= 0.8) return 'right';
  return null;
}

function pendingWith(frame, patch, interaction) {
  return buildFrameFrom(frame.stage, frame.memory, interaction, {
    ...frame.pending,
    ...patch,
    handles: patch.handles || frame.pending.handles
  });
}

export function beginCompression(frame, point) {
  const normalized = normalizePoint(point);
  const side = handleSide(normalized);
  if (!side) return buildFrameFrom(frame.stage, frame.memory, 'compression-refused-interior', frame.pending);
  return pendingWith(frame, {
    active: true,
    side,
    path: [normalized]
  }, `compression-armed-${side}`);
}

export function continueCompression(frame, point) {
  if (!frame.pending.active) return frame;
  const normalized = normalizePoint(point);
  const path = [...frame.pending.path, normalized].slice(-24);
  return pendingWith(frame, { path }, 'compression-preview');
}

export function previewCompression(frame, point) {
  return continueCompression(frame, point);
}

function compressionReady(side, point) {
  return side === 'left' ? point.x >= HANDLE_THRESHOLD : point.x <= 1 - HANDLE_THRESHOLD;
}

function createEvent(frame, handles, source) {
  const left = handles.left;
  const right = handles.right;
  const gap = Math.max(0, right.x - left.x);
  const pressure = clamp(0.48 + (0.42 - gap) * 1.4 + frame.memory.length * 0.035, 0.36, 1);
  const remotePanel = clampIndex(frame.memory.length * 2 + Math.floor((left.y + right.y) * PANEL_COUNT), PANEL_COUNT);
  return {
    source,
    type: 'opposing-compression',
    left,
    right,
    pressure,
    remotePanel,
    phase: 0.48 + pressure * 0.48,
    field: hash(SEED + frame.memory.length * 7919 + remotePanel * 83 + Math.floor(pressure * 100))
  };
}

export function commitCompression(frame, point, source = 'visitor-compression') {
  if (!frame.pending.active || !frame.pending.side) {
    return buildFrameFrom(frame.stage, frame.memory, 'compression-refused-no-handle', frame.pending);
  }
  const normalized = normalizePoint(point);
  const side = frame.pending.side;
  if (!compressionReady(side, normalized)) {
    return pendingWith(frame, { active: false, path: [...frame.pending.path, normalized] }, 'compression-refused-incomplete');
  }
  const handles = cloneHandles(frame.pending.handles);
  handles[side] = normalized;
  const otherSide = side === 'left' ? 'right' : 'left';
  if (!handles[otherSide]) {
    return pendingWith(frame, { active: false, side: null, path: [], handles, compression: 0.5 }, `compression-${side}-set`);
  }
  return applyCompression(frame, handles.left, handles.right, source);
}

export function applyCompression(frame, left, right, source = 'control-compression') {
  const handles = cloneHandles({ left, right });
  if (!handles.left || !handles.right || handles.left.x < HANDLE_THRESHOLD || handles.right.x > 1 - HANDLE_THRESHOLD || handles.left.x >= handles.right.x) {
    return buildFrameFrom(frame.stage, frame.memory, 'compression-refused-order', frame.pending);
  }
  const event = createEvent(frame, handles, source);
  return buildFrameFrom(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], 'compression-committed');
}

export function liftLatest(frame) {
  if (!frame.memory.length) return buildFrameFrom(frame.stage, frame.memory, 'lift-refused', frame.pending);
  return buildFrameFrom(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), 'lifted');
}

export function releaseField(frame) {
  return buildFrameFrom(0, [], 'released');
}

export function buildTimeline(stageCount = STAGES) {
  const pairs = [
    [{ x: 0.44, y: 0.3 }, { x: 0.56, y: 0.68 }],
    [{ x: 0.42, y: 0.42 }, { x: 0.58, y: 0.56 }],
    [{ x: 0.43, y: 0.58 }, { x: 0.57, y: 0.42 }],
    [{ x: 0.45, y: 0.7 }, { x: 0.55, y: 0.3 }]
  ];
  let frame = buildFrame();
  const timeline = [frame];
  for (let stage = 1; stage < stageCount; stage += 1) {
    if (stage % 2 === 1) frame = applyCompression(frame, pairs[(stage - 1) / 2][0], pairs[(stage - 1) / 2][1], 'timeline-compression');
    else frame = buildFrameFrom(stage, frame.memory, 'timeline');
    frame = { ...frame, stage };
    timeline.push(frame);
  }
  return timeline;
}

export function geometrySignature(frame) {
  return JSON.stringify(frame.body);
}
