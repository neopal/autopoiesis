export const SEED = 0x53504637;
export const STAGES = 13;
export const MEMORY_LIMIT = 5;
export const BLADE_COUNT = 11;
export const GAZE_THRESHOLD = 0.65;
export const PRIMITIVE_BUDGET = 58;

const TAU = Math.PI * 2;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const clone = (value) => JSON.parse(JSON.stringify(value));

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state ^ (state >>> 16), 2246822519);
    state = Math.imul(state ^ (state >>> 13), 3266489917);
    return ((state ^ (state >>> 16)) >>> 0) / 4294967296;
  };
}

function safeStage(stage) {
  return clamp(Math.floor(Number(stage) || 0), 0, STAGES - 1);
}

function boundedPoint(point = {}) {
  const x = Number(point.x);
  const y = Number(point.y);
  return {
    x: clamp(Number.isFinite(x) ? x : 0.72, 0.08, 0.92),
    y: clamp(Number.isFinite(y) ? y : 0.35, 0.12, 0.88)
  };
}

function boundedDwell(value) {
  const dwell = Number(value);
  return clamp(Number.isFinite(dwell) ? dwell : 0.86, GAZE_THRESHOLD, 1);
}

function makeBlade(stage, index, random) {
  const center = (index + 0.5) / BLADE_COUNT;
  const sway = Math.sin(stage * 0.23 + index * 0.71) * 0.018;
  const height = 0.54 + Math.sin(index * 0.83 + stage * 0.11) * 0.08 + random() * 0.035;
  const width = 0.055 + (index % 3) * 0.008;
  const angle = (center - 0.5) * 0.72 + Math.sin(index * 1.4 + stage * 0.17) * 0.025;
  const opening = 0.58 + Math.cos(index * 0.67 + stage * 0.18) * 0.12;
  const depth = index + 0.2 + Math.sin(index * 0.43 + stage * 0.3) * 0.18;
  return {
    id: `blade-${index + 1}`,
    x: clamp(center + sway, 0.07, 0.93),
    top: clamp(0.19 + (random() - 0.5) * 0.035, 0.08, 0.36),
    height,
    width,
    angle,
    opening,
    depth,
    hinge: index % 2 ? 'left' : 'right',
    tone: (index * 0.17 + stage * 0.025) % 1,
    state: 'watching'
  };
}

function makeBase(stage) {
  const random = rng(SEED + stage * 7919);
  const blades = Array.from({ length: BLADE_COUNT }, (_, index) => makeBlade(stage, index, random));
  return {
    stage,
    blades,
    depthOrder: blades.slice().sort((a, b) => a.depth - b.depth).map((blade) => Number(blade.id.slice(6)) - 1),
    aperture: {
      gap: 0.095 + Math.sin(stage * 0.31) * 0.008,
      occlusion: 0.24 + Math.cos(stage * 0.27) * 0.015,
      iris: 0.17 + Math.sin(stage * 0.19) * 0.012
    },
    memory: [],
    refusals: [],
    redirects: [],
    refusalDebt: Array.from({ length: BLADE_COUNT }, () => 0),
    armedBlade: null,
    interaction: 'sequence'
  };
}

function refreshDerived(frame) {
  frame.refusals = frame.memory.filter((event) => event.kind === 'aperture-refusal');
  frame.redirects = frame.memory.map((event) => ({
    from: event.selectedBlade,
    to: event.redirectedBlade,
    stage: event.stage
  }));
  frame.depthOrder = frame.blades
    .slice()
    .sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id))
    .map((blade) => Number(blade.id.slice(6)) - 1);
  frame.signature = geometrySignature(frame);
  return frame;
}

function nearestBlade(frame, point) {
  return frame.blades.reduce((best, blade, index) => {
    const centerY = blade.top + blade.height * 0.5;
    const distance = Math.hypot((blade.x - point.x) * 1.8, centerY - point.y);
    return distance < best.distance ? { index, distance } : best;
  }, { index: 0, distance: Infinity }).index;
}

function chooseRedirect(frame, selectedBlade, repetition) {
  const candidates = frame.blades
    .map((blade, index) => ({ index, score: frame.refusalDebt[index] + Math.abs(index - selectedBlade) * 0.012 }))
    .filter(({ index }) => index !== selectedBlade)
    .sort((a, b) => a.score - b.score || a.index - b.index);
  const first = candidates[(repetition * 2) % candidates.length]?.index ?? ((selectedBlade + 4) % BLADE_COUNT);
  if (frame.memory.length && first === frame.memory.at(-1).redirectedBlade) {
    return candidates.find(({ index }) => index !== first)?.index ?? ((first + 3) % BLADE_COUNT);
  }
  return first;
}

function applyRefusal(frame, event) {
  const next = clone(frame);
  const selected = next.blades[event.selectedBlade];
  const redirected = next.blades[event.redirectedBlade];
  const debt = next.refusalDebt[event.selectedBlade] ?? 0;
  const yieldAmount = 0.12 + event.dwell * 0.11 / (1 + debt * 1.4);
  const broadcast = 0.012 + event.dwell * 0.012;

  selected.opening = clamp(selected.opening - yieldAmount, 0.06, 1);
  selected.angle += (selected.hinge === 'left' ? -1 : 1) * (0.14 + event.dwell * 0.08);
  selected.depth = Math.max(0.02, selected.depth - 1.65 - debt * 0.18);
  selected.width = clamp(selected.width * (0.92 - debt * 0.025), 0.035, 0.09);
  selected.state = 'refusing';

  redirected.opening = clamp(redirected.opening + 0.16 + event.dwell * 0.06, 0.06, 1);
  redirected.angle -= (redirected.hinge === 'left' ? -1 : 1) * 0.09;
  redirected.depth = Math.max(0.05, redirected.depth - 0.58);
  redirected.state = 'answering';

  next.blades.forEach((blade, index) => {
    if (index === event.selectedBlade || index === event.redirectedBlade) return;
    const distance = Math.abs(index - event.selectedBlade);
    blade.x = clamp(blade.x + (index < event.selectedBlade ? -1 : 1) * broadcast * Math.max(0, 1 - distance / 5), 0.05, 0.95);
    blade.angle += (index % 2 ? 1 : -1) * broadcast * Math.max(0, 1 - distance / 6);
  });

  next.aperture.gap = clamp(next.aperture.gap + 0.045 + event.dwell * 0.025, 0.04, 0.48);
  next.aperture.occlusion = clamp(next.aperture.occlusion + 0.06 + debt * 0.012, 0.08, 0.86);
  next.aperture.iris = clamp(next.aperture.iris + 0.012 - event.dwell * 0.008, 0.08, 0.42);
  next.refusalDebt[event.selectedBlade] = clamp(debt + 0.42 + event.dwell * 0.28, 0, 2.5);
  next.interaction = 'gaze-committed';
  return refreshDerived(next);
}

function normalizeEvent(event, frame) {
  const point = boundedPoint(event.point ?? event);
  const selectedBlade = Number.isInteger(event.selectedBlade) ? event.selectedBlade : nearestBlade(frame, point);
  const repetition = frame.memory.filter((item) => item.selectedBlade === selectedBlade).length;
  const redirectedBlade = Number.isInteger(event.redirectedBlade)
    ? event.redirectedBlade
    : chooseRedirect(frame, selectedBlade, repetition);
  return {
    id: event.id ?? `visitor-gaze-${frame.stage}-${frame.memory.length + 1}`,
    stage: frame.stage,
    point,
    dwell: boundedDwell(event.dwell),
    source: 'visitor-gaze',
    kind: 'aperture-refusal',
    selectedBlade,
    redirectedBlade,
    refusalDebtBefore: frame.refusalDebt[selectedBlade] ?? 0,
    reason: 'the nearest aperture agent refuses the visitor and redirects the shared opening'
  };
}

export function buildFrame(stage = 0, memory = []) {
  let frame = makeBase(safeStage(stage));
  for (const event of memory.slice(-MEMORY_LIMIT)) {
    const normalized = normalizeEvent(event, frame);
    frame = applyRefusal(frame, { ...normalized, ...event });
    frame.memory = [...frame.memory, { ...normalized, ...event }].slice(-MEMORY_LIMIT);
    frame = refreshDerived(frame);
  }
  frame.stage = safeStage(stage);
  return refreshDerived(frame);
}

export function armGaze(frame, point = {}) {
  const next = clone(frame);
  const bounded = boundedPoint(point);
  next.armedBlade = nearestBlade(next, bounded);
  next.armedPoint = bounded;
  next.interaction = 'gaze-armed';
  return refreshDerived(next);
}

export function registerGaze(frame, point = {}) {
  const armed = armGaze(frame, point);
  const event = normalizeEvent({ ...point, point: boundedPoint(point), selectedBlade: armed.armedBlade }, armed);
  const changed = applyRefusal(armed, event);
  changed.memory = [...frame.memory, { ...event, refusalDebtAfter: changed.refusalDebt[event.selectedBlade] }].slice(-MEMORY_LIMIT);
  return refreshDerived(changed);
}

export function liftLatestGaze(frame) {
  if (!frame.memory.length) return refreshDerived(clone(frame));
  return buildFrame(frame.stage, frame.memory.slice(0, -1));
}

export function releaseGazes(stage = 0) {
  return buildFrame(stage, []);
}

export function defaultCue(index = 0) {
  const cues = [
    { x: 0.72, y: 0.34, dwell: 0.86 },
    { x: 0.24, y: 0.59, dwell: 0.78 },
    { x: 0.58, y: 0.25, dwell: 0.9 },
    { x: 0.38, y: 0.7, dwell: 0.82 },
    { x: 0.82, y: 0.55, dwell: 0.88 }
  ];
  return { ...cues[index % cues.length] };
}

export function buildTimeline() {
  const timeline = [];
  let memory = [];
  const eventStages = new Map([[2, 0], [4, 1], [6, 2], [8, 3], [10, 4]]);
  for (let stage = 0; stage < STAGES; stage += 1) {
    let frame = buildFrame(stage, memory);
    if (eventStages.has(stage)) {
      frame = registerGaze(frame, defaultCue(eventStages.get(stage)));
      memory = frame.memory;
    }
    frame.stage = stage;
    timeline.push(refreshDerived(frame));
  }
  return timeline;
}

export function geometrySignature(frame) {
  return JSON.stringify({
    stage: frame.stage,
    blades: frame.blades.map((blade) => [
      Number(blade.x.toFixed(5)), Number(blade.top.toFixed(5)), Number(blade.height.toFixed(5)),
      Number(blade.width.toFixed(5)), Number(blade.angle.toFixed(5)), Number(blade.opening.toFixed(5)),
      Number(blade.depth.toFixed(5)), blade.state
    ]),
    depthOrder: frame.depthOrder,
    aperture: Object.fromEntries(Object.entries(frame.aperture).map(([key, value]) => [key, Number(value.toFixed(5))]))
  });
}
