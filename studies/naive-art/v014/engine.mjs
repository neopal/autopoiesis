export const SEED = 0x4e413134;
export const STAGES = 16;
export const PRIMITIVE_BUDGET = 48;
export const MEMORY_WINDOW = 5;

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

function copyTear(tear) {
  return { ...tear, point: tear.point ? copyPoint(tear.point) : null };
}

function tearForStage(stage) {
  const random = rng(SEED + stage * 7919);
  const x = 0.17 + random() * 0.66;
  const y = 0.20 + random() * 0.58;
  return {
    stage,
    source: 'autonomous-tear',
    point: { x, y },
    polarity: random() < 0.5 ? -1 : 1,
    radius: 0.028 + random() * 0.026,
    depth: 0.08 + random() * 0.10,
    lift: 0.018 + random() * 0.036,
    tilt: (random() - 0.5) * 0.9,
    wedge: 0.45 + random() * 0.55,
    reason: 'the paper forgot a piece'
  };
}

function tearsForMemory(memory) {
  return memory.slice(-MEMORY_WINDOW).map((tear, order) => ({
    ...copyTear(tear),
    source: tear.source ?? 'autonomous-tear',
    polarity: Number(tear.polarity) < 0 ? -1 : 1,
    radius: clamp(Number(tear.radius) || 0.04, 0.024, 0.078),
    depth: clamp(Number(tear.depth) || 0.12, 0.06, 0.24),
    lift: clamp(Number(tear.lift) || 0.03, 0.012, 0.072),
    tilt: clamp(Number(tear.tilt) || 0, -1, 1),
    wedge: clamp(Number(tear.wedge) || 0.7, 0.25, 1.2),
    order
  }));
}

function polygonForTear(tear, depthScale = 1) {
  const { x, y } = tear.point;
  const radius = tear.radius * depthScale;
  const depth = tear.depth * depthScale;
  const lean = tear.tilt * radius * 0.85;
  return [
    { x: clamp(x - radius * 0.82 - lean, 0.02, 0.98), y: clamp(y - depth * 0.32, 0.04, 0.94) },
    { x: clamp(x - radius * 0.12 + lean, 0.02, 0.98), y: clamp(y - depth * 0.82, 0.04, 0.94) },
    { x: clamp(x + radius * 0.92 + lean, 0.02, 0.98), y: clamp(y - depth * 0.20, 0.04, 0.94) },
    { x: clamp(x + radius * 0.58 - lean, 0.02, 0.98), y: clamp(y + depth * 0.72, 0.04, 0.94) },
    { x: clamp(x - radius * 0.48 - lean, 0.02, 0.98), y: clamp(y + depth * 0.64, 0.04, 0.94) }
  ];
}

function displacedFragment(tear, index) {
  const cutout = polygonForTear(tear, 1.03);
  const direction = tear.polarity * (index % 2 ? -1 : 1);
  const dx = direction * (tear.lift + index * 0.008) + tear.tilt * 0.012;
  const dy = -tear.lift * (0.65 + index * 0.16);
  return {
    source: tear.source,
    stage: tear.stage,
    order: tear.order,
    x: dx,
    y: dy,
    angle: tear.tilt * 0.16 + direction * 0.025,
    points: cutout.map((point) => ({ x: clamp(point.x + dx, 0.02, 0.98), y: clamp(point.y + dy, 0.04, 0.94) }))
  };
}

function plainHouse() {
  return {
    shift: { x: 0, y: 0 },
    body: [
      { x: 0.32, y: 0.43 },
      { x: 0.64, y: 0.43 },
      { x: 0.64, y: 0.70 },
      { x: 0.32, y: 0.70 }
    ],
    roof: [
      { x: 0.28, y: 0.44 },
      { x: 0.48, y: 0.24 },
      { x: 0.68, y: 0.44 }
    ],
    door: [
      { x: 0.46, y: 0.70 },
      { x: 0.46, y: 0.57 },
      { x: 0.54, y: 0.57 },
      { x: 0.54, y: 0.70 }
    ],
    window: [
      { x: 0.37, y: 0.49 },
      { x: 0.43, y: 0.49 },
      { x: 0.43, y: 0.55 },
      { x: 0.37, y: 0.55 }
    ]
  };
}

function shifted(points, shift) {
  return points.map((point) => ({
    x: clamp(point.x + shift.x, 0.02, 0.98),
    y: clamp(point.y + shift.y, 0.04, 0.94)
  }));
}

function composeScene(tears, random) {
  const aggregate = tears.reduce((sum, tear, index) => {
    const sign = tear.polarity * (index % 2 ? -1 : 1);
    return {
      x: sum.x + sign * tear.lift * 0.56,
      y: sum.y - tear.depth * 0.035
    };
  }, { x: 0, y: 0 });
  const shift = {
    x: clamp(aggregate.x, -0.10, 0.10),
    y: clamp(aggregate.y, -0.045, 0.025)
  };
  const houseBase = plainHouse();
  const cutouts = tears.map((tear) => ({
    source: tear.source,
    stage: tear.stage,
    order: tear.order,
    point: copyPoint(tear.point),
    target: tear.point.y < 0.38 ? 'roof' : tear.point.y > 0.69 ? 'ground' : 'house',
    points: polygonForTear(tear)
  }));
  const fragments = tears.flatMap((tear, index) => [displacedFragment(tear, index)]);
  const notches = tears.map((tear, index) => ({
    source: tear.source,
    stage: tear.stage,
    order: tear.order,
    x: clamp(tear.point.x + tear.polarity * tear.radius * 0.55, 0.06, 0.94),
    width: tear.radius * (1.1 + index * 0.08),
    depth: tear.depth * 0.55,
    side: tear.polarity
  }));
  const houseShift = {
    x: clamp(shift.x * 0.72 + tears.reduce((sum, tear) => sum + tear.polarity * tear.radius * 0.18, 0), -0.11, 0.11),
    y: clamp(shift.y - tears.length * 0.002, -0.06, 0.03)
  };
  const treeShift = tears.reduce((sum, tear, index) => sum + tear.polarity * tear.lift * (index % 2 ? -0.6 : 0.45), 0);
  return {
    tearRecords: tears,
    cutouts,
    fragments,
    house: {
      shift: houseShift,
      body: shifted(houseBase.body, houseShift),
      roof: shifted(houseBase.roof, houseShift),
      door: shifted(houseBase.door, houseShift),
      window: shifted(houseBase.window, houseShift)
    },
    ground: {
      left: { x: 0.06, y: clamp(0.79 + shift.y, 0.70, 0.86) },
      right: { x: 0.94, y: clamp(0.79 + shift.y, 0.70, 0.86) },
      notches
    },
    sun: {
      x: clamp(0.16 + random() * 0.08 - shift.x * 0.3, 0.10, 0.29),
      y: clamp(0.15 + random() * 0.07 + shift.y * 0.3, 0.10, 0.28),
      radius: 0.055 + random() * 0.014
    },
    tree: {
      x: clamp(0.79 + treeShift, 0.67, 0.90),
      y: clamp(0.48 - shift.y * 0.25, 0.43, 0.57)
    },
    materialTrace: {
      tearCount: tears.length,
      cutoutCount: cutouts.length,
      fragmentCount: fragments.length,
      notchCount: notches.length,
      displacedHouse: Math.abs(houseShift.x) + Math.abs(houseShift.y) > 0,
      grammar: 'puncture → missing room → lifted fragment → re-cut scene'
    }
  };
}

export function tearSignature(frame) {
  return [
    ...frame.scene.cutouts.flatMap((cutout) => cutout.points),
    ...frame.scene.fragments.flatMap((fragment) => fragment.points),
    ...frame.scene.ground.notches.map((notch) => ({ x: notch.x, y: notch.depth })),
    frame.scene.house.shift
  ].map((point) => `${Number(point.x).toFixed(4)},${Number(point.y).toFixed(4)}`).join('|');
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = clamp(Math.floor(stage), 0, STAGES - 1);
  const random = rng(SEED + safeStage * 31337);
  const inherited = Array.isArray(memory) ? memory.map(copyTear) : [];
  const tears = tearsForMemory(inherited);
  const correction = tearForStage(safeStage);
  const scene = composeScene(tears, random);
  return {
    stage: safeStage,
    memory: inherited,
    correction,
    primitiveCount: PRIMITIVE_BUDGET,
    draft: {
      house: plainHouse(),
      ground: { y: 0.79 },
      cutouts: [],
      fragments: []
    },
    scene
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

export function applyTear(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.08, 0.92),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.12, 0.84)
  };
  const tear = {
    stage: frame.stage,
    source: 'visitor-tear',
    point: bounded,
    polarity: bounded.x < 0.5 ? -1 : 1,
    radius: 0.035 + Math.abs(bounded.x - 0.5) * 0.050,
    depth: 0.095 + Math.abs(bounded.y - 0.5) * 0.16,
    lift: 0.022 + bounded.y * 0.040,
    tilt: (bounded.x - 0.5) * 1.2,
    wedge: 0.55 + bounded.y * 0.55,
    reason: bounded.y < 0.5 ? 'the visitor removed an upper room' : 'the visitor removed a lower room'
  };
  return { ...buildFrame(frame.stage, [...frame.memory, tear]), interaction: 'visitor-tear' };
}

export function deleteLatestTear(frame) {
  if (!frame.memory.length) return { ...frame, interaction: 'tear-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'tear-lifted' };
}

export function layoutForViewport(width, height) {
  return {
    mode: width < 640 ? 'portrait' : 'landscape',
    width,
    height,
    field: { x: 0.045, y: 0.045, w: 0.91, h: 0.91 }
  };
}
