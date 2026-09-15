export const SEED = 0x4e413131;
export const STAGES = 16;
export const PRIMITIVE_BUDGET = 52;
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

function copyBump(bump) {
  return { ...bump, point: bump.point ? copyPoint(bump.point) : null };
}

function bumpForStage(stage) {
  const random = rng(SEED + stage * 7919);
  const x = 0.18 + random() * 0.64;
  const y = 0.20 + random() * 0.60;
  return {
    stage,
    source: 'autonomous-bump',
    point: { x, y },
    polarity: random() < 0.5 ? -1 : 1,
    width: 0.030 + random() * 0.024,
    duration: 0.15 + random() * 0.12,
    height: 0.042 + random() * 0.040,
    tilt: random() < 0.5 ? -1 : 1,
    reason: 'the line kept a little rise'
  };
}

function bumpsForMemory(memory) {
  return memory.slice(-MEMORY_WINDOW).map((bump, order) => ({
    ...copyBump(bump),
    source: bump.source ?? 'autonomous-bump',
    polarity: Number(bump.polarity) < 0 ? -1 : 1,
    width: clamp(Number(bump.width) || 0.040, 0.026, 0.082),
    duration: clamp(Number(bump.duration) || 0.20, 0.12, 0.32),
    height: clamp(Number(bump.height) || 0.060, 0.032, 0.125),
    tilt: Number(bump.tilt) < 0 ? -1 : 1,
    order
  }));
}

function traceBumps(origin, bumps, scale = 1, verticalBias = 0) {
  let cursor = copyPoint(origin);
  const points = [];
  for (const bump of bumps) {
    const width = bump.width * scale;
    const duration = bump.duration * scale;
    const height = bump.height * scale;
    const drift = ((bump.point?.x ?? 0.5) - 0.5) * 0.035 + verticalBias;
    const anchor = clamp(cursor.x + ((bump.point?.x ?? 0.5) - 0.5) * 0.022, 0.04, 0.94);
    const signedHeight = bump.polarity * height;
    const approach = {
      x: clamp(anchor + width * 0.18, 0.04, 0.96),
      y: clamp(cursor.y + drift - signedHeight * 0.08, 0.06, 0.94),
      phase: 'approach', stage: bump.stage, source: bump.source
    };
    const lift = {
      x: clamp(anchor + width * 0.58, 0.04, 0.96),
      y: clamp(cursor.y + drift + signedHeight * 0.54, 0.06, 0.94),
      phase: 'lift', stage: bump.stage, source: bump.source
    };
    const crest = {
      x: clamp(anchor + width * 1.02 + duration * 0.18, 0.04, 0.96),
      y: clamp(cursor.y + drift + signedHeight, 0.06, 0.94),
      phase: 'crest', stage: bump.stage, source: bump.source
    };
    const descent = {
      x: clamp(anchor + width * 1.45 + duration * 0.56, 0.04, 0.96),
      y: clamp(cursor.y + drift + signedHeight * 0.48, 0.06, 0.94),
      phase: 'descent', stage: bump.stage, source: bump.source
    };
    const returnPoint = {
      x: clamp(anchor + width * 1.82 + duration * 0.90, 0.04, 0.96),
      y: clamp(cursor.y + drift + signedHeight * 0.05, 0.06, 0.94),
      phase: 'return', stage: bump.stage, source: bump.source
    };
    points.push(approach, lift, crest, descent, returnPoint);
    cursor = {
      x: clamp(returnPoint.x + 0.060, 0.04, 0.96),
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
    bumpLine: [],
    bumpDriven: false,
    door: { top: { x: 0.48, y: 0.56 }, bottom: { x: 0.48, y: 0.69 } }
  };
}

function houseForBumps(bumps) {
  const plain = plainHouse();
  const bumpLine = traceBumps({ x: plain.front.right.x, y: plain.front.right.y }, bumps, 0.88, -0.002);
  const last = bumpLine.at(-1) ?? plain.front.right;
  return {
    ...plain,
    roof: {
      peak: plain.roof.peak,
      returnPeak: { x: clamp(last.x - 0.035, 0.16, 0.84), y: clamp(last.y - 0.12, 0.14, 0.62) }
    },
    bumpLine,
    bumpDriven: bumps.length > 0
  };
}

function routeForBumps(house, bumps) {
  const base = [
    { x: 0.46, y: 0.95 },
    { x: 0.46, y: 0.81 },
    { ...house.door.bottom, inside: true },
    { ...house.door.top, inside: true }
  ];
  const bumpLine = traceBumps({ x: house.door.top.x, y: house.door.top.y - 0.01 }, bumps, 1.14, 0.004);
  const exit = bumpLine.at(-1) ?? base.at(-1);
  return [
    ...base,
    ...bumpLine,
    { x: clamp(exit.x + 0.080, 0.04, 0.96), y: clamp(exit.y - 0.045, 0.06, 0.92), phase: 'leave', source: 'exit' }
  ];
}

export function bumpSignature(frame) {
  return [
    ...frame.scene.house.bumpLine,
    ...frame.scene.ground.bumpLine,
    ...frame.scene.route
  ].map((point) => `${point.x.toFixed(4)},${point.y.toFixed(4)},${point.phase ?? 'base'}`).join('|');
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = clamp(Math.floor(stage), 0, STAGES - 1);
  const random = rng(SEED + safeStage * 31337);
  const inherited = Array.isArray(memory) ? memory.map(copyBump) : [];
  const bumps = bumpsForMemory(inherited);
  const correction = bumpForStage(safeStage);
  const draftHouse = plainHouse();
  const sceneHouse = houseForBumps(bumps);
  const groundBumpLine = traceBumps({ x: 0.10, y: 0.83 }, bumps, 0.66, 0);
  const route = routeForBumps(sceneHouse, bumps);

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
      bumpRecords: bumps,
      house: sceneHouse,
      route,
      ground: {
        left: { x: 0.08, y: 0.83 },
        right: { x: 0.92, y: 0.83 },
        bumpLine: groundBumpLine
      },
      sun: {
        x: clamp(0.14 + random() * 0.08, 0.10, 0.28),
        y: clamp(0.14 + random() * 0.06, 0.10, 0.27),
        radius: 0.055 + random() * 0.013
      },
      tree: {
        x: clamp(0.79 - (bumps.at(-1)?.point?.x ?? 0.63) * 0.08, 0.68, 0.90),
        y: clamp(0.49 + (bumps.length % 3) * 0.012, 0.44, 0.58)
      },
      decisionTrace: {
        bumpCount: bumps.length,
        approachCount: bumps.length * 3,
        liftCount: bumps.length * 3,
        crestCount: bumps.length * 3,
        descentCount: bumps.length * 3,
        returnCount: bumps.length * 3,
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

export function applyBump(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.06, 0.94),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.10, 0.88)
  };
  const bump = {
    stage: frame.stage,
    source: 'visitor-bump',
    point: bounded,
    polarity: bounded.y < 0.5 ? -1 : 1,
    width: 0.034 + Math.abs(bounded.x - 0.5) * 0.050,
    duration: 0.14 + bounded.x * 0.14,
    height: 0.040 + Math.abs(bounded.y - 0.5) * 0.108,
    tilt: bounded.x < 0.5 ? -1 : 1,
    reason: bounded.y < 0.5 ? 'the visitor kept an upward bump' : 'the visitor kept a downward bump'
  };
  return { ...buildFrame(frame.stage, [...frame.memory, bump]), interaction: 'visitor-bump' };
}

export function deleteLatestBump(frame) {
  if (!frame.memory.length) return { ...frame, interaction: 'bump-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'bump-lifted' };
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
