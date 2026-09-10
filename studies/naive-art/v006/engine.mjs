export const SEED = 0x4e413036;
export const STAGES = 11;
export const PRIMITIVE_BUDGET = 34;

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

function copyReversal(reversal) {
  return { ...reversal, point: reversal.point ? copyPoint(reversal.point) : null };
}

function reversalForStage(stage) {
  const random = rng(SEED + stage * 9176);
  const side = random() < 0.5 ? -1 : 1;
  return {
    stage,
    side,
    reach: 0.026 + random() * 0.026,
    rise: 0.027 + random() * 0.020,
    reason: side < 0 ? 'the line came back too soon on the left' : 'the line came back too soon on the right'
  };
}

function reversalsForMemory(memory) {
  return memory.slice(-8).map((reversal, index) => ({
    stage: reversal.stage,
    source: reversal.source ?? 'autonomous-reversal',
    side: Number(reversal.side) < 0 ? -1 : 1,
    reach: clamp(Number(reversal.reach) || 0.034, 0.018, 0.065),
    rise: clamp(Number(reversal.rise) || 0.034, 0.020, 0.060),
    order: index
  }));
}

function traceReversals(origin, reversals, scale = 1) {
  let cursor = copyPoint(origin);
  const points = [];
  for (const reversal of reversals) {
    const direction = reversal.side < 0 ? -1 : 1;
    const advance = {
      x: clamp(cursor.x + direction * reversal.reach * scale, 0.08, 0.92),
      y: cursor.y
    };
    const returning = {
      x: clamp(advance.x - direction * reversal.reach * 0.72 * scale, 0.08, 0.92),
      y: clamp(advance.y + reversal.rise * 0.42 * scale, 0.10, 0.88)
    };
    const continuing = {
      x: clamp(advance.x + direction * reversal.reach * 0.18 * scale, 0.08, 0.92),
      y: clamp(advance.y + reversal.rise * scale, 0.10, 0.88)
    };
    points.push({ ...advance, phase: 'advance', stage: reversal.stage, source: reversal.source });
    points.push({ ...returning, phase: 'return', stage: reversal.stage, source: reversal.source });
    points.push({ ...continuing, phase: 'continue', stage: reversal.stage, source: reversal.source });
    cursor = continuing;
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
    reversals: [],
    reversalDriven: false,
    door: { top: { x: 0.48, y: 0.56 }, bottom: { x: 0.48, y: 0.69 } }
  };
}

function houseForReversals(reversals) {
  const front = {
    left: { x: 0.34, y: 0.43 },
    right: { x: 0.63, y: 0.43 },
    bottomLeft: { x: 0.34, y: 0.69 },
    bottomRight: { x: 0.63, y: 0.69 }
  };
  const traced = traceReversals({ x: front.right.x, y: front.right.y }, reversals, 0.92);
  const last = traced.at(-1) ?? front.right;
  return {
    front,
    roof: {
      peak: { x: 0.485, y: 0.30 },
      end: { x: clamp(last.x, 0.16, 0.86), y: clamp(last.y - 0.08, 0.16, 0.68) }
    },
    reversals: traced,
    reversalDriven: reversals.length > 0,
    door: { top: { x: 0.48, y: 0.56 }, bottom: { x: 0.48, y: 0.69 } }
  };
}

function routeForReversals(house, reversals) {
  const start = { x: 0.46, y: 0.95 };
  const knee = { x: 0.46, y: 0.81 };
  const door = { ...house.door.bottom, inside: true };
  const traced = traceReversals({ x: door.x, y: door.y - 0.01 }, reversals, 1.14);
  const exit = traced.at(-1) ?? { x: door.x, y: door.y - 0.12 };
  return [
    start,
    knee,
    door,
    ...traced,
    { x: clamp(exit.x + 0.055, 0.08, 0.92), y: clamp(exit.y - 0.018, 0.10, 0.86), phase: reversals.length ? 'exit' : 'plain', source: 'exit' }
  ];
}

function plainRoute(house) {
  return [
    { x: 0.46, y: 0.95 },
    { x: 0.46, y: 0.81 },
    { ...house.door.bottom },
    { ...house.door.top }
  ];
}

export function routeSignature(frame) {
  return frame.scene.route.map((point) => `${point.x.toFixed(4)},${point.y.toFixed(4)}`).join('|');
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = clamp(Math.floor(stage), 0, STAGES - 1);
  const random = rng(SEED + safeStage * 31337);
  const inherited = Array.isArray(memory) ? memory.map(copyReversal) : [];
  const reversal = reversalForStage(safeStage);
  const reversals = reversalsForMemory(inherited);
  const draftHouse = plainHouse();
  const sceneHouse = houseForReversals(reversals);

  return {
    stage: safeStage,
    memory: inherited,
    correction: reversal,
    primitiveCount: PRIMITIVE_BUDGET,
    draft: {
      house: draftHouse,
      route: plainRoute(draftHouse),
      ground: { y: 0.79 }
    },
    scene: {
      reversals: sceneHouse.reversals,
      reversalRecords: reversals,
      house: sceneHouse,
      route: routeForReversals(sceneHouse, reversals),
      ground: {
        left: { x: 0.08, y: 0.83 },
        right: { x: 0.92, y: 0.83 },
        reversals: traceReversals({ x: 0.08, y: 0.83 }, reversals, 0.72)
      },
      sun: {
        x: clamp(0.14 + random() * 0.08, 0.10, 0.28),
        y: clamp(0.14 + random() * 0.06, 0.10, 0.27),
        radius: 0.055 + random() * 0.013
      },
      tree: {
        x: clamp(0.79 - (reversals.at(-1)?.x ?? 0.63) * 0.08, 0.68, 0.90),
        y: clamp(0.49 + (reversals.length % 3) * 0.012, 0.44, 0.58)
      },
      decisionTrace: {
        reversalCount: reversals.length,
        returnCount: reversals.filter((point) => point.phase === 'return').length,
        houseReturnCount: sceneHouse.reversals.filter((point) => point.phase === 'return').length,
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

export function applyReversal(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.08, 0.92),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.12, 0.86)
  };
  const reversal = {
    stage: frame.stage,
    source: 'visitor-reversal',
    point: bounded,
    side: bounded.x < 0.5 ? -1 : 1,
    reach: 0.026 + Math.abs(bounded.x - 0.5) * 0.060,
    rise: 0.024 + bounded.y * 0.030,
    reason: bounded.x < 0.5 ? 'the visitor brought the line back from the left' : 'the visitor brought the line back from the right'
  };
  return { ...buildFrame(frame.stage, [...frame.memory, reversal]), interaction: 'visitor-reversal' };
}

export function deleteLatestReversal(frame) {
  if (!frame.memory.length) return { ...frame, interaction: 'reversal-deleted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'reversal-deleted' };
}

export function layoutForViewport(width, height) {
  const stacked = width < 640;
  return stacked
    ? {
      mode: 'stacked',
      panels: [
        { x: 0.08, y: 0.06, w: 0.84, h: 0.38, label: 'before' },
        { x: 0.08, y: 0.56, w: 0.84, h: 0.38, label: 'after' }
      ],
      bridge: { x1: 0.50, y1: 0.44, x2: 0.50, y2: 0.56 },
      height
    }
    : {
      mode: 'diptych',
      panels: [
        { x: 0.04, y: 0.10, w: 0.41, h: 0.78, label: 'before' },
        { x: 0.55, y: 0.10, w: 0.41, h: 0.78, label: 'after' }
      ],
      bridge: { x1: 0.45, y1: 0.50, x2: 0.55, y2: 0.50 },
      height
    };
}
