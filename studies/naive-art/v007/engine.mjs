export const SEED = 0x4e413037;
export const STAGES = 12;
export const PRIMITIVE_BUDGET = 38;
export const MEMORY_WINDOW = 7;

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

function copyShadow(shadow) {
  return { ...shadow, point: shadow.point ? copyPoint(shadow.point) : null };
}

function shadowForStage(stage) {
  const random = rng(SEED + stage * 7793);
  const side = random() < 0.5 ? -1 : 1;
  return {
    stage,
    side,
    reach: 0.026 + random() * 0.024,
    lift: 0.028 + random() * 0.022,
    reason: side < 0 ? 'the line cast its shadow too far left' : 'the line cast its shadow too far right'
  };
}

function shadowsForMemory(memory) {
  return memory.slice(-MEMORY_WINDOW).map((shadow, index) => ({
    stage: shadow.stage,
    source: shadow.source ?? 'autonomous-shadow',
    side: Number(shadow.side) < 0 ? -1 : 1,
    reach: clamp(Number(shadow.reach) || 0.036, 0.018, 0.068),
    lift: clamp(Number(shadow.lift) || 0.036, 0.020, 0.064),
    point: shadow.point ? copyPoint(shadow.point) : null,
    order: index
  }));
}

function traceShadows(origin, shadows, scale = 1) {
  let cursor = copyPoint(origin);
  const points = [];
  for (const shadow of shadows) {
    const direction = shadow.side < 0 ? -1 : 1;
    const drift = (shadow.point?.y ?? 0.5) - 0.5;
    const depart = {
      x: clamp(cursor.x + direction * shadow.reach * scale, 0.06, 0.94),
      y: clamp(cursor.y - shadow.lift * 0.26 * scale, 0.08, 0.90)
    };
    const parallel = {
      x: clamp(depart.x + direction * shadow.reach * 0.82 * scale, 0.06, 0.94),
      y: clamp(depart.y + shadow.lift * (0.42 + Math.abs(drift) * 0.5) * scale, 0.08, 0.90)
    };
    const fused = {
      x: clamp(parallel.x - direction * shadow.reach * 0.66 * scale, 0.06, 0.94),
      y: clamp(parallel.y + shadow.lift * (0.78 + drift * 0.18) * scale, 0.08, 0.90)
    };
    points.push({ ...depart, phase: 'depart', stage: shadow.stage, source: shadow.source });
    points.push({ ...parallel, phase: 'parallel', stage: shadow.stage, source: shadow.source });
    points.push({ ...fused, phase: 'fuse', stage: shadow.stage, source: shadow.source });
    cursor = fused;
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
    shadows: [],
    shadowDriven: false,
    door: { top: { x: 0.48, y: 0.56 }, bottom: { x: 0.48, y: 0.69 } }
  };
}

function houseForShadows(shadows) {
  const front = {
    left: { x: 0.34, y: 0.43 },
    right: { x: 0.63, y: 0.43 },
    bottomLeft: { x: 0.34, y: 0.69 },
    bottomRight: { x: 0.63, y: 0.69 }
  };
  const traced = traceShadows({ x: front.right.x, y: front.right.y }, shadows, 0.96);
  const last = traced.at(-1) ?? front.right;
  return {
    front,
    roof: {
      peak: { x: 0.485, y: 0.30 },
      shadowPeak: { x: clamp(last.x - 0.04, 0.14, 0.84), y: clamp(last.y - 0.13, 0.14, 0.66) }
    },
    shadows: traced,
    shadowDriven: shadows.length > 0,
    door: { top: { x: 0.48, y: 0.56 }, bottom: { x: 0.48, y: 0.69 } }
  };
}

function routeForShadows(house, shadows) {
  const door = { ...house.door.bottom, inside: true };
  const traced = traceShadows({ x: door.x, y: door.y - 0.01 }, shadows, 1.16);
  const exit = traced.at(-1) ?? { x: house.door.top.x, y: house.door.top.y - 0.12 };
  return [
    { x: 0.46, y: 0.95 },
    { x: 0.46, y: 0.81 },
    { ...house.door.bottom, inside: true },
    { ...house.door.top, inside: true },
    ...traced,
    { x: clamp(exit.x + 0.06, 0.06, 0.94), y: clamp(exit.y - 0.02, 0.08, 0.88), phase: 'leave', source: 'exit' }
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
  const inherited = Array.isArray(memory) ? memory.map(copyShadow) : [];
  const correction = shadowForStage(safeStage);
  const shadows = shadowsForMemory(inherited);
  const draftHouse = plainHouse();
  const sceneHouse = houseForShadows(shadows);

  return {
    stage: safeStage,
    memory: inherited,
    correction,
    primitiveCount: PRIMITIVE_BUDGET,
    draft: {
      house: draftHouse,
      route: plainRoute(draftHouse),
      ground: { y: 0.79 }
    },
    scene: {
      shadows: sceneHouse.shadows,
      shadowRecords: shadows,
      house: sceneHouse,
      route: routeForShadows(sceneHouse, shadows),
      ground: {
        left: { x: 0.08, y: 0.83 },
        right: { x: 0.92, y: 0.83 },
        shadows: traceShadows({ x: 0.08, y: 0.83 }, shadows, 0.78)
      },
      sun: {
        x: clamp(0.14 + random() * 0.08, 0.10, 0.28),
        y: clamp(0.14 + random() * 0.06, 0.10, 0.27),
        radius: 0.055 + random() * 0.013
      },
      tree: {
        x: clamp(0.79 - (shadows.at(-1)?.point?.x ?? 0.63) * 0.08, 0.68, 0.90),
        y: clamp(0.49 + (shadows.length % 3) * 0.012, 0.44, 0.58)
      },
      decisionTrace: {
        shadowCount: shadows.length,
        parallelCount: shadows.filter((point) => point.phase === 'parallel').length,
        fuseCount: shadows.filter((point) => point.phase === 'fuse').length,
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

export function applyShadow(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.06, 0.94),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.10, 0.88)
  };
  const shadow = {
    stage: frame.stage,
    source: 'visitor-shadow',
    point: bounded,
    side: bounded.x < 0.5 ? -1 : 1,
    reach: 0.028 + Math.abs(bounded.x - 0.5) * 0.058,
    lift: 0.024 + bounded.y * 0.034,
    reason: bounded.x < 0.5 ? 'the visitor left a shadow on the left' : 'the visitor left a shadow on the right'
  };
  return { ...buildFrame(frame.stage, [...frame.memory, shadow]), interaction: 'visitor-shadow' };
}

export function deleteLatestShadow(frame) {
  if (!frame.memory.length) return { ...frame, interaction: 'shadow-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'shadow-lifted' };
}

export function layoutForViewport(width, height) {
  const stacked = width < 640;
  return stacked
    ? {
      mode: 'stacked',
      panels: [
        { x: 0.08, y: 0.05, w: 0.84, h: 0.39, label: 'before' },
        { x: 0.08, y: 0.55, w: 0.84, h: 0.39, label: 'after' }
      ],
      bridge: { x1: 0.50, y1: 0.44, x2: 0.50, y2: 0.55 },
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
