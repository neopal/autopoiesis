export const SEED = 0x4e413039;
export const STAGES = 14;
export const PRIMITIVE_BUDGET = 44;
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

function copyDoorway(doorway) {
  return { ...doorway, point: doorway.point ? copyPoint(doorway.point) : null };
}

function doorwayForStage(stage) {
  const random = rng(SEED + stage * 6839);
  const x = 0.18 + random() * 0.64;
  return {
    stage,
    source: 'autonomous-doorway',
    point: { x, y: 0.20 + random() * 0.60 },
    side: x < 0.5 ? -1 : 1,
    width: 0.025 + random() * 0.028,
    depth: 0.032 + random() * 0.026,
    tilt: random() < 0.5 ? -1 : 1,
    reason: 'the line left a small way through'
  };
}

function doorwaysForMemory(memory) {
  return memory.slice(-MEMORY_WINDOW).map((doorway, order) => ({
    ...copyDoorway(doorway),
    source: doorway.source ?? 'autonomous-doorway',
    side: Number(doorway.side) < 0 ? -1 : 1,
    width: clamp(Number(doorway.width) || 0.038, 0.020, 0.082),
    depth: clamp(Number(doorway.depth) || 0.044, 0.024, 0.084),
    tilt: Number(doorway.tilt) < 0 ? -1 : 1,
    order
  }));
}

function traceDoorways(origin, doorways, scale = 1, lateral = 0) {
  let cursor = copyPoint(origin);
  const points = [];
  for (const doorway of doorways) {
    const direction = doorway.side;
    const width = doorway.width * scale;
    const depth = doorway.depth * scale;
    const drift = ((doorway.point?.y ?? 0.5) - 0.5) * 0.11 + lateral;
    const approach = {
      x: clamp(cursor.x + direction * width * 0.34, 0.04, 0.96),
      y: clamp(cursor.y - depth * 0.30 + drift, 0.06, 0.94),
      phase: 'approach', stage: doorway.stage, source: doorway.source
    };
    const threshold = {
      x: clamp(cursor.x + direction * width * 0.92, 0.04, 0.96),
      y: clamp(cursor.y - depth * 0.06 + drift, 0.06, 0.94),
      phase: 'threshold', stage: doorway.stage, source: doorway.source
    };
    const inside = {
      x: clamp(cursor.x + direction * width * 0.22, 0.04, 0.96),
      y: clamp(cursor.y + depth * (0.72 + doorway.tilt * 0.08) + drift, 0.06, 0.94),
      phase: 'inside', stage: doorway.stage, source: doorway.source
    };
    const exit = {
      x: clamp(cursor.x + direction * width * 0.98 + 0.032, 0.04, 0.96),
      y: clamp(cursor.y + depth * 0.18 + drift * 0.35, 0.06, 0.94),
      phase: 'exit', stage: doorway.stage, source: doorway.source
    };
    points.push(approach, threshold, inside, exit);
    cursor = {
      x: clamp(exit.x + 0.050, 0.04, 0.96),
      y: clamp(exit.y, 0.06, 0.94)
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
    doorLine: [],
    doorDriven: false,
    door: { top: { x: 0.48, y: 0.56 }, bottom: { x: 0.48, y: 0.69 } }
  };
}

function houseForDoorways(doorways) {
  const plain = plainHouse();
  const doorLine = traceDoorways({ x: plain.front.right.x, y: plain.front.right.y }, doorways, 0.88, -0.002);
  const last = doorLine.at(-1) ?? plain.front.right;
  return {
    ...plain,
    roof: {
      peak: plain.roof.peak,
      returnPeak: { x: clamp(last.x - 0.040, 0.16, 0.84), y: clamp(last.y - 0.12, 0.14, 0.62) }
    },
    doorLine,
    doorDriven: doorways.length > 0
  };
}

function routeForDoorways(house, doorways) {
  const base = [
    { x: 0.46, y: 0.95 },
    { x: 0.46, y: 0.81 },
    { ...house.door.bottom, inside: true },
    { ...house.door.top, inside: true }
  ];
  const doorLine = traceDoorways({ x: house.door.top.x, y: house.door.top.y - 0.01 }, doorways, 1.16, 0.004);
  const exit = doorLine.at(-1) ?? base.at(-1);
  return [
    ...base,
    ...doorLine,
    { x: clamp(exit.x + 0.075, 0.04, 0.96), y: clamp(exit.y - 0.045, 0.06, 0.92), phase: 'leave', source: 'exit' }
  ];
}

export function doorwaySignature(frame) {
  return [
    ...frame.scene.house.doorLine,
    ...frame.scene.ground.doorLine,
    ...frame.scene.route
  ].map((point) => `${point.x.toFixed(4)},${point.y.toFixed(4)},${point.phase ?? 'base'}`).join('|');
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = clamp(Math.floor(stage), 0, STAGES - 1);
  const random = rng(SEED + safeStage * 31337);
  const inherited = Array.isArray(memory) ? memory.map(copyDoorway) : [];
  const doorways = doorwaysForMemory(inherited);
  const correction = doorwayForStage(safeStage);
  const draftHouse = plainHouse();
  const sceneHouse = houseForDoorways(doorways);
  const groundDoorLine = traceDoorways({ x: 0.10, y: 0.83 }, doorways, 0.64, 0);
  const route = routeForDoorways(sceneHouse, doorways);

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
      doorRecords: doorways,
      house: sceneHouse,
      route,
      ground: {
        left: { x: 0.08, y: 0.83 },
        right: { x: 0.92, y: 0.83 },
        doorLine: groundDoorLine
      },
      sun: {
        x: clamp(0.14 + random() * 0.08, 0.10, 0.28),
        y: clamp(0.14 + random() * 0.06, 0.10, 0.27),
        radius: 0.055 + random() * 0.013
      },
      tree: {
        x: clamp(0.79 - (doorways.at(-1)?.point?.x ?? 0.63) * 0.08, 0.68, 0.90),
        y: clamp(0.49 + (doorways.length % 3) * 0.012, 0.44, 0.58)
      },
      decisionTrace: {
        doorwayCount: doorways.length,
        approachCount: doorways.length * 3,
        thresholdCount: doorways.length * 3,
        insideCount: doorways.length * 3,
        exitCount: doorways.length * 3,
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

export function applyDoorway(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.06, 0.94),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.10, 0.88)
  };
  const doorway = {
    stage: frame.stage,
    source: 'visitor-doorway',
    point: bounded,
    side: bounded.x < 0.5 ? -1 : 1,
    width: 0.030 + Math.abs(bounded.x - 0.5) * 0.072,
    depth: 0.026 + bounded.y * 0.040,
    tilt: bounded.y < 0.5 ? -1 : 1,
    reason: bounded.x < 0.5 ? 'the visitor kept the left-hand opening' : 'the visitor kept the right-hand opening'
  };
  return { ...buildFrame(frame.stage, [...frame.memory, doorway]), interaction: 'visitor-doorway' };
}

export function deleteLatestDoorway(frame) {
  if (!frame.memory.length) return { ...frame, interaction: 'doorway-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'doorway-lifted' };
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
