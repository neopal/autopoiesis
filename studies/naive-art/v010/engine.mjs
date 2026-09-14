export const SEED = 0x4e413130;
export const STAGES = 15;
export const PRIMITIVE_BUDGET = 48;
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

function copyBypass(bypass) {
  return { ...bypass, point: bypass.point ? copyPoint(bypass.point) : null };
}

function bypassForStage(stage) {
  const random = rng(SEED + stage * 6839);
  const x = 0.18 + random() * 0.64;
  return {
    stage,
    source: 'autonomous-bypass',
    point: { x, y: 0.20 + random() * 0.60 },
    side: x < 0.5 ? -1 : 1,
    width: 0.026 + random() * 0.030,
    duration: 0.15 + random() * 0.12,
    depth: 0.038 + random() * 0.030,
    tilt: random() < 0.5 ? -1 : 1,
    reason: 'the line found a longer way around'
  };
}

function bypassesForMemory(memory) {
  return memory.slice(-MEMORY_WINDOW).map((bypass, order) => ({
    ...copyBypass(bypass),
    source: bypass.source ?? 'autonomous-bypass',
    side: Number(bypass.side) < 0 ? -1 : 1,
    width: clamp(Number(bypass.width) || 0.040, 0.022, 0.11),
    duration: clamp(Number(bypass.duration) || 0.20, 0.12, 0.34),
    depth: clamp(Number(bypass.depth) || 0.050, 0.028, 0.092),
    tilt: Number(bypass.tilt) < 0 ? -1 : 1,
    order
  }));
}

function traceBypasses(origin, bypasses, scale = 1, lateral = 0) {
  let cursor = copyPoint(origin);
  const points = [];
  for (const bypass of bypasses) {
    const direction = bypass.side;
    const width = bypass.width * scale;
    const duration = bypass.duration * scale;
    const depth = bypass.depth * scale;
    const drift = ((bypass.point?.y ?? 0.5) - 0.5) * 0.11 + lateral;
    const approach = {
      x: clamp(cursor.x + direction * width * 0.30, 0.04, 0.96),
      y: clamp(cursor.y - depth * 0.28 + drift, 0.06, 0.94),
      phase: 'approach', stage: bypass.stage, source: bypass.source
    };
    const sidestep = {
      x: clamp(cursor.x + direction * width * 1.22, 0.04, 0.96),
      y: clamp(cursor.y + depth * (0.18 + bypass.tilt * 0.06) + drift, 0.06, 0.94),
      phase: 'sidestep', stage: bypass.stage, source: bypass.source
    };
    const alongside = {
      x: clamp(sidestep.x + direction * duration, 0.04, 0.96),
      y: clamp(sidestep.y + depth * (0.34 - bypass.tilt * 0.08), 0.06, 0.94),
      phase: 'alongside', stage: bypass.stage, source: bypass.source
    };
    const returnPoint = {
      x: clamp(alongside.x - direction * (width * 1.02 + duration * 0.10), 0.04, 0.96),
      y: clamp(cursor.y + depth * 0.13 + drift * 0.30, 0.06, 0.94),
      phase: 'return', stage: bypass.stage, source: bypass.source
    };
    points.push(approach, sidestep, alongside, returnPoint);
    cursor = {
      x: clamp(returnPoint.x + 0.050, 0.04, 0.96),
      y: clamp(returnPoint.y, 0.06, 0.94)
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
    bypassLine: [],
    bypassDriven: false,
    door: { top: { x: 0.48, y: 0.56 }, bottom: { x: 0.48, y: 0.69 } }
  };
}

function houseForBypasses(bypasses) {
  const plain = plainHouse();
  const bypassLine = traceBypasses({ x: plain.front.right.x, y: plain.front.right.y }, bypasses, 0.88, -0.002);
  const last = bypassLine.at(-1) ?? plain.front.right;
  return {
    ...plain,
    roof: {
      peak: plain.roof.peak,
      returnPeak: { x: clamp(last.x - 0.040, 0.16, 0.84), y: clamp(last.y - 0.12, 0.14, 0.62) }
    },
    bypassLine,
    bypassDriven: bypasses.length > 0
  };
}

function routeForBypasses(house, bypasses) {
  const base = [
    { x: 0.46, y: 0.95 },
    { x: 0.46, y: 0.81 },
    { ...house.door.bottom, inside: true },
    { ...house.door.top, inside: true }
  ];
  const bypassLine = traceBypasses({ x: house.door.top.x, y: house.door.top.y - 0.01 }, bypasses, 1.16, 0.004);
  const exit = bypassLine.at(-1) ?? base.at(-1);
  return [
    ...base,
    ...bypassLine,
    { x: clamp(exit.x + 0.075, 0.04, 0.96), y: clamp(exit.y - 0.045, 0.06, 0.92), phase: 'leave', source: 'exit' }
  ];
}

export function bypassSignature(frame) {
  return [
    ...frame.scene.house.bypassLine,
    ...frame.scene.ground.bypassLine,
    ...frame.scene.route
  ].map((point) => `${point.x.toFixed(4)},${point.y.toFixed(4)},${point.phase ?? 'base'}`).join('|');
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = clamp(Math.floor(stage), 0, STAGES - 1);
  const random = rng(SEED + safeStage * 31337);
  const inherited = Array.isArray(memory) ? memory.map(copyBypass) : [];
  const bypasses = bypassesForMemory(inherited);
  const correction = bypassForStage(safeStage);
  const draftHouse = plainHouse();
  const sceneHouse = houseForBypasses(bypasses);
  const groundBypassLine = traceBypasses({ x: 0.10, y: 0.83 }, bypasses, 0.64, 0);
  const route = routeForBypasses(sceneHouse, bypasses);

  return {
    stage: safeStage,
    memory: inherited,
    correction,
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
      bypassRecords: bypasses,
      house: sceneHouse,
      route,
      ground: {
        left: { x: 0.08, y: 0.83 },
        right: { x: 0.92, y: 0.83 },
        bypassLine: groundBypassLine
      },
      sun: {
        x: clamp(0.14 + random() * 0.08, 0.10, 0.28),
        y: clamp(0.14 + random() * 0.06, 0.10, 0.27),
        radius: 0.055 + random() * 0.013
      },
      tree: {
        x: clamp(0.79 - (bypasses.at(-1)?.point?.x ?? 0.63) * 0.08, 0.68, 0.90),
        y: clamp(0.49 + (bypasses.length % 3) * 0.012, 0.44, 0.58)
      },
      decisionTrace: {
        bypassCount: bypasses.length,
        approachCount: bypasses.length * 3,
        sidestepCount: bypasses.length * 3,
        alongsideCount: bypasses.length * 3,
        returnCount: bypasses.length * 3,
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

export function applyBypass(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.06, 0.94),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.10, 0.88)
  };
  const bypass = {
    stage: frame.stage,
    source: 'visitor-bypass',
    point: bounded,
    side: bounded.x < 0.5 ? -1 : 1,
    width: 0.032 + Math.abs(bounded.x - 0.5) * 0.078,
    duration: 0.14 + bounded.y * 0.16,
    depth: 0.032 + bounded.y * 0.046,
    tilt: bounded.y < 0.5 ? -1 : 1,
    reason: bounded.x < 0.5 ? 'the visitor kept the left-hand bypass' : 'the visitor kept the right-hand bypass'
  };
  return { ...buildFrame(frame.stage, [...frame.memory, bypass]), interaction: 'visitor-bypass' };
}

export function deleteLatestBypass(frame) {
  if (!frame.memory.length) return { ...frame, interaction: 'bypass-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'bypass-lifted' };
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
