export const SEED = 0x4e413038;
export const STAGES = 13;
export const PRIMITIVE_BUDGET = 42;
export const MEMORY_WINDOW = 6;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state ^ (state >>> 16), 2246822519);
    state = Math.imul(state ^ (state >>> 13), 3266489917);
    return ((state ^ (state >>> 16)) >>> 0) / 4294967296;
  };
}

function copyPoint(point) {
  return { ...point, x: Number(point.x), y: Number(point.y) };
}

function copyKnot(knot) {
  return { ...knot, point: knot.point ? copyPoint(knot.point) : null };
}

function knotForStage(stage) {
  const random = rng(SEED + stage * 6151);
  const x = 0.19 + random() * 0.62;
  const y = 0.22 + random() * 0.54;
  return {
    stage,
    source: 'autonomous-knot',
    point: { x, y },
    side: x < 0.5 ? -1 : 1,
    span: 0.023 + random() * 0.023,
    vertical: 0.030 + random() * 0.024,
    tilt: random() < 0.5 ? -1 : 1,
    reason: 'the line took the long way home'
  };
}

function knotsForMemory(memory) {
  return memory.slice(-MEMORY_WINDOW).map((knot, order) => ({
    ...copyKnot(knot),
    source: knot.source ?? 'autonomous-knot',
    side: Number(knot.side) < 0 ? -1 : 1,
    span: clamp(Number(knot.span) || 0.034, 0.018, 0.074),
    vertical: clamp(Number(knot.vertical) || 0.042, 0.024, 0.078),
    tilt: Number(knot.tilt) < 0 ? -1 : 1,
    order
  }));
}

function traceKnot(origin, knots, scale = 1, lateral = 0) {
  let cursor = copyPoint(origin);
  const points = [];
  for (const knot of knots) {
    const direction = knot.side;
    const span = knot.span * scale;
    const vertical = knot.vertical * scale;
    const drift = ((knot.point?.y ?? 0.5) - 0.5) * 0.10 + lateral;
    const depart = {
      x: clamp(cursor.x + direction * span * 0.92, 0.04, 0.96),
      y: clamp(cursor.y - vertical * 0.18 + drift, 0.06, 0.94),
      phase: 'depart', stage: knot.stage, source: knot.source
    };
    const cross = {
      x: clamp(cursor.x - direction * span * 0.52, 0.04, 0.96),
      y: clamp(cursor.y + vertical * 0.30 + drift, 0.06, 0.94),
      phase: 'cross', stage: knot.stage, source: knot.source
    };
    const loop = {
      x: clamp(cursor.x + direction * span * 0.68, 0.04, 0.96),
      y: clamp(cursor.y + vertical * (0.92 + knot.tilt * 0.10) + drift, 0.06, 0.94),
      phase: 'loop', stage: knot.stage, source: knot.source
    };
    const rejoin = {
      x: clamp(cursor.x + direction * span * 0.13 + 0.035, 0.04, 0.96),
      y: clamp(cursor.y + vertical * 0.17 + drift * 0.35, 0.06, 0.94),
      phase: 'rejoin', stage: knot.stage, source: knot.source
    };
    points.push(depart, cross, loop, rejoin);
    cursor = {
      x: clamp(rejoin.x + 0.045, 0.04, 0.96),
      y: clamp(rejoin.y, 0.06, 0.94)
    };
  }
  return points;
}

function plainHouse() {
  const front = {
    left: { x: 0.34, y: 0.43 },
    right: { x: 0.63, y: 0.43 },
    bottomLeft: { x: 0.34, y: 0.69 },
    bottomRight: { x: 0.63, y: 0.69 }
  };
  return {
    front,
    roof: { peak: { x: 0.485, y: 0.30 } },
    knotLine: [],
    knotDriven: false,
    door: { top: { x: 0.48, y: 0.56 }, bottom: { x: 0.48, y: 0.69 } }
  };
}

function houseForKnots(knots) {
  const plain = plainHouse();
  const knotLine = traceKnot({ x: plain.front.right.x, y: plain.front.right.y }, knots, 0.88, -0.002);
  const last = knotLine.at(-1) ?? plain.front.right;
  return {
    ...plain,
    roof: {
      peak: plain.roof.peak,
      // The roof's second corner is downstream of the same knot, not a label.
      returnPeak: { x: clamp(last.x - 0.045, 0.16, 0.84), y: clamp(last.y - 0.12, 0.14, 0.62) }
    },
    knotLine,
    knotDriven: knots.length > 0
  };
}

function routeForKnots(house, knots) {
  const base = [
    { x: 0.46, y: 0.95 },
    { x: 0.46, y: 0.81 },
    { ...house.door.bottom, inside: true },
    { ...house.door.top, inside: true }
  ];
  const knotLine = traceKnot({ x: house.door.top.x, y: house.door.top.y - 0.01 }, knots, 1.16, 0.004);
  const exit = knotLine.at(-1) ?? base.at(-1);
  return [
    ...base,
    ...knotLine,
    { x: clamp(exit.x + 0.075, 0.04, 0.96), y: clamp(exit.y - 0.045, 0.06, 0.92), phase: 'leave', source: 'exit' }
  ];
}

export function knotSignature(frame) {
  return [
    ...frame.scene.house.knotLine,
    ...frame.scene.ground.knotLine,
    ...frame.scene.route
  ].map((point) => `${point.x.toFixed(4)},${point.y.toFixed(4)},${point.phase ?? 'base'}`).join('|');
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = clamp(Math.floor(stage), 0, STAGES - 1);
  const random = rng(SEED + safeStage * 31337);
  const inherited = Array.isArray(memory) ? memory.map(copyKnot) : [];
  const knots = knotsForMemory(inherited);
  const draftHouse = plainHouse();
  const sceneHouse = houseForKnots(knots);
  const groundKnotLine = traceKnot({ x: 0.10, y: 0.83 }, knots, 0.64, 0);
  const route = routeForKnots(sceneHouse, knots);

  return {
    stage: safeStage,
    memory: inherited,
    correction: knotForStage(safeStage),
    primitiveCount: PRIMITIVE_BUDGET,
    draft: {
      house: draftHouse,
      route: [
        { x: 0.46, y: 0.95 },
        { x: 0.46, y: 0.81 },
        { ...draftHouse.door.bottom },
        { ...draftHouse.door.top }
      ],
      ground: { y: 0.79 }
    },
    scene: {
      knotRecords: knots,
      house: sceneHouse,
      route,
      ground: {
        left: { x: 0.08, y: 0.83 },
        right: { x: 0.92, y: 0.83 },
        knotLine: groundKnotLine
      },
      sun: {
        x: clamp(0.14 + random() * 0.08, 0.10, 0.28),
        y: clamp(0.14 + random() * 0.06, 0.10, 0.27),
        radius: 0.055 + random() * 0.013
      },
      tree: {
        x: clamp(0.79 - (knots.at(-1)?.point?.x ?? 0.63) * 0.08, 0.68, 0.90),
        y: clamp(0.49 + (knots.length % 3) * 0.012, 0.44, 0.58)
      },
      decisionTrace: {
        knotCount: knots.length,
        crossingCount: knots.length * 3,
        loopCount: knots.length * 3,
        rejoinCount: knots.length * 3,
        retained: inherited.length > 0
      }
    }
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: Math.min(Math.max(0, stageCount), STAGES) }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    memory = [...memory, frame.correction];
    return frame;
  });
}

export function applyKnot(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.06, 0.94),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.10, 0.88)
  };
  const knot = {
    stage: frame.stage,
    source: 'visitor-knot',
    point: bounded,
    side: bounded.x < 0.5 ? -1 : 1,
    span: 0.028 + Math.abs(bounded.x - 0.5) * 0.066,
    vertical: 0.025 + bounded.y * 0.036,
    tilt: bounded.y < 0.5 ? -1 : 1,
    reason: bounded.x < 0.5 ? 'the visitor kept the left-hand return' : 'the visitor kept the right-hand return'
  };
  return { ...buildFrame(frame.stage, [...frame.memory, knot]), interaction: 'visitor-knot' };
}

export function deleteLatestKnot(frame) {
  if (!frame.memory.length) return { ...frame, interaction: 'knot-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'knot-lifted' };
}

export function layoutForViewport(width, height) {
  const stacked = width < 640;
  return stacked
    ? {
      mode: 'stacked',
      panels: [
        { x: 0.08, y: 0.05, w: 0.84, h: 0.39, label: 'proposal' },
        { x: 0.08, y: 0.55, w: 0.84, h: 0.39, label: 'consequence' }
      ],
      bridge: { x1: 0.50, y1: 0.44, x2: 0.50, y2: 0.55 },
      height
    }
    : {
      mode: 'diptych',
      panels: [
        { x: 0.04, y: 0.10, w: 0.41, h: 0.78, label: 'proposal' },
        { x: 0.55, y: 0.10, w: 0.41, h: 0.78, label: 'consequence' }
      ],
      bridge: { x1: 0.45, y1: 0.50, x2: 0.55, y2: 0.50 },
      height
    };
}
