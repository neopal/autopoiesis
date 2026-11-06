const VIEWBOX = { width: 1000, height: 760 };

const LAYER_LAYOUT = [
  { index: 0, y: 176, width: 248, lean: -0.18, phase: 0.4 },
  { index: 1, y: 248, width: 292, lean: 0.12, phase: 1.1 },
  { index: 2, y: 322, width: 266, lean: -0.08, phase: 2.0 },
  { index: 3, y: 396, width: 314, lean: 0.16, phase: 2.8 },
  { index: 4, y: 470, width: 278, lean: -0.14, phase: 3.7 },
  { index: 5, y: 544, width: 238, lean: 0.08, phase: 4.5 }
];

export const VIEWBOX_SIZE = VIEWBOX;
export const LAYER_COUNT = LAYER_LAYOUT.length;
export const MEMORY_WINDOW = 4;
export const HOLD_THRESHOLD = 1;

const BODY_TEMPLATE = [
  [-176, -254], [-70, -296], [72, -286], [178, -206],
  [152, -76], [178, 42], [116, 238], [-24, 292],
  [-166, 224], [-150, 86], [-202, -70]
];
const VOID_TEMPLATE = [
  [-42, -194], [52, -214], [92, -128], [62, -30],
  [82, 88], [30, 188], [-54, 164], [-88, 72],
  [-68, -34], [-102, -122]
];
const JAW_TEMPLATE = [
  [-72, -36], [16, -54], [70, -18], [54, 40],
  [-12, 54], [-70, 22]
];

const round = (value) => Math.round(value * 1000) / 1000;
const pointPath = (points) => `M ${points.map(({ x, y }) => `${round(x)} ${round(y)}`).join(' L ')} Z`;
const openPath = (points) => `M ${points.map(({ x, y }) => `${round(x)} ${round(y)}`).join(' L ')}`;
const sideSign = (side) => side === 'left' ? -1 : 1;

function transformTemplate(template, transform = {}) {
  const {
    cx = 500,
    cy = 380,
    scaleX = 1,
    scaleY = 1,
    shiftX = 0,
    shiftY = 0,
    shear = 0,
    notch = 0,
    notchIndex = 0
  } = transform;
  return template.map(([baseX, baseY], index) => {
    let x = baseX * scaleX;
    let y = baseY * scaleY;
    x += y * shear;
    if (index === notchIndex) x += notch;
    if (index === (notchIndex + 1) % template.length) y -= notch * 0.42;
    return { x: cx + x + shiftX, y: cy + y + shiftY };
  });
}

function normalizeMemory(memory) {
  if (!Array.isArray(memory)) return [];
  return memory.slice(-MEMORY_WINDOW).map((event) => ({
    type: 'pressure-load',
    side: event.side === 'right' ? 'right' : 'left',
    load: Number.isInteger(event.load) ? event.load : 1,
    mode: typeof event.mode === 'string' ? event.mode : modeFor(event.load ?? 1)
  }));
}

function modeFor(load) {
  return ['crease', 'lean', 'cleave', 'settle'][Math.max(0, load - 1)] ?? 'settle';
}

function pressureState(memory) {
  const load = memory.length;
  const signed = memory.reduce((total, event) => total + sideSign(event.side), 0);
  const last = memory.at(-1)?.side ?? null;
  const mode = load ? modeFor(load) : 'quiet';
  return { load, signed, last, mode };
}

function buildBody(memory) {
  const { load, signed, mode } = pressureState(memory);
  const sign = sideSign(memory.at(-1)?.side ?? 'left');
  const scaleX = 1 - load * 0.018;
  const scaleY = 1 - load * 0.012;
  const shear = signed * 0.012 + (mode === 'lean' ? sign * 0.028 : 0);
  const notch = load ? sign * (18 + load * 5) : 0;
  return pointPath(transformTemplate(BODY_TEMPLATE, {
    scaleX,
    scaleY,
    shiftX: signed * 7,
    shiftY: load * 5,
    shear,
    notch,
    notchIndex: (load * 2 + 3) % BODY_TEMPLATE.length
  }));
}

function buildVoid(memory) {
  const { load, signed, mode } = pressureState(memory);
  const sign = sideSign(memory.at(-1)?.side ?? 'left');
  const scaleX = 1 - load * 0.045 + (mode === 'cleave' ? 0.04 : 0);
  const scaleY = 1 + load * 0.032;
  const extraShift = mode === 'lean' ? sign * 10 : 0;
  return pointPath(transformTemplate(VOID_TEMPLATE, {
    scaleX,
    scaleY,
    shiftX: -signed * 8 + extraShift,
    shiftY: load * 4,
    shear: -signed * 0.018,
    notch: load ? -sign * (10 + load * 4) : 0,
    notchIndex: (load + 4) % VOID_TEMPLATE.length
  }));
}

function buildJaw(side) {
  const sign = sideSign(side);
  const cx = side === 'left' ? 256 : 744;
  const rotation = sign * (side === 'left' ? -5 : 5);
  const radians = rotation * Math.PI / 180;
  const points = JAW_TEMPLATE.map(([x, y]) => {
    const localX = x;
    const localY = y;
    return {
      x: cx + localX * Math.cos(radians) - localY * Math.sin(radians),
      y: 380 + localX * Math.sin(radians) + localY * Math.cos(radians)
    };
  });
  return pointPath(points);
}

function buildLayer(layout, memory) {
  const { load, signed, mode } = pressureState(memory);
  const side = memory.at(-1)?.side ?? 'left';
  const sign = sideSign(side);
  const resistance = load * (layout.index % 2 ? 3.5 : 2.25);
  const center = 500 + signed * 5 + sign * (mode === 'cleave' ? 7 : 0);
  const width = layout.width + (mode === 'crease' ? resistance : mode === 'settle' ? -resistance : 0);
  const y = layout.y + load * (layout.index % 2 ? 2 : -1);
  const lean = layout.lean + signed * 0.01 + (mode === 'lean' ? sign * 0.04 : 0);
  const height = 12 + (layout.index % 3) * 3;
  const points = [
    { x: center - width * 0.5 + y * lean, y: y - height },
    { x: center - width * 0.2 + y * lean * 0.35, y: y - height * 0.45 },
    { x: center + width * 0.5 + y * lean, y: y + height * 0.72 },
    { x: center + width * 0.16 + y * lean * 0.22, y: y + height },
    { x: center - width * 0.5 + y * lean * 0.8, y: y + height * 0.24 }
  ];
  return {
    ...layout,
    path: openPath(points),
    signature: `${layout.index}:${openPath(points)}`
  };
}

function buildFrameFromMemory(memory, interaction = null, event = null) {
  const normalizedMemory = normalizeMemory(memory);
  const nextInteraction = interaction ?? (normalizedMemory.length ? 'settled' : 'quiet');
  const pressure = pressureState(normalizedMemory);
  return {
    grammar: 'alternating-pressure-block',
    bodyPath: buildBody(normalizedMemory),
    voidPath: buildVoid(normalizedMemory),
    jaws: {
      left: buildJaw('left', normalizedMemory),
      right: buildJaw('right', normalizedMemory)
    },
    layers: LAYER_LAYOUT.map((layout) => buildLayer(layout, normalizedMemory)),
    memory: normalizedMemory,
    pending: null,
    interaction: nextInteraction,
    event,
    state: {
      loadCount: pressure.load,
      lastSide: pressure.last,
      mode: pressure.mode,
      resistance: pressure.load + 1
    }
  };
}

export function buildFrame(memory = []) {
  return buildFrameFromMemory(memory);
}

export function geometrySignature(frame) {
  return [
    frame.bodyPath,
    frame.voidPath,
    frame.jaws?.left,
    frame.jaws?.right,
    ...(frame.layers ?? []).map((layer) => layer.signature)
  ].join('|');
}

export function pressureSideAtPoint(frame, point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  if (point.y < 280 || point.y > 500) return null;
  if (point.x >= 170 && point.x <= 340) return 'left';
  if (point.x >= 660 && point.x <= 830) return 'right';
  return null;
}

export function beginPressure(frame, side) {
  if (side !== 'left' && side !== 'right') return { ...frame, interaction: 'pressure-refused-miss', event: { type: 'pressure-refused-miss' } };
  return {
    ...frame,
    pending: { side },
    interaction: `pressure-held-${side}`,
    event: null
  };
}

export function releasePressure(frame, side, held = false) {
  if (!frame.pending) return { ...frame, interaction: 'pressure-refused-unarmed', event: { type: 'pressure-refused-unarmed' } };
  if (frame.pending.side !== side) return { ...frame, pending: null, interaction: 'pressure-refused-crossed', event: { type: 'pressure-refused-crossed' } };
  if (!held) return { ...frame, pending: null, interaction: 'pressure-refused-short', event: { type: 'pressure-refused-short', side } };
  const previousSide = frame.memory.at(-1)?.side;
  if (previousSide === side) return { ...frame, pending: null, interaction: 'pressure-refused-repeat', event: { type: 'pressure-refused-repeat', side } };
  const event = {
    type: 'pressure-load',
    side,
    load: frame.memory.length + 1,
    mode: modeFor(frame.memory.length + 1)
  };
  const next = buildFrameFromMemory([...frame.memory, event], 'pressure-committed', event);
  return next;
}

export function commitPressure(frame, side) {
  const started = frame.pending?.side === side ? frame : beginPressure(frame, side);
  return releasePressure(started, side, true);
}

export function buildTimeline() {
  const timeline = [buildFrame()];
  for (const side of ['left', 'right', 'left', 'right']) {
    timeline.push(commitPressure(timeline.at(-1), side));
  }
  return timeline;
}

export function liftLatestPressure(frame) {
  if (!frame.memory.length) return frame;
  return buildFrameFromMemory(frame.memory.slice(0, -1), 'pressure-lifted');
}

export function releaseBlock() {
  return buildFrame();
}
