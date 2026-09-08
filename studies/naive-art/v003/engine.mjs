export const SEED = 0x4e413033;
export const STAGES = 9;
export const PRIMITIVE_BUDGET = 31;
export const OPENINGS = ['front', 'right', 'roof', 'left'];

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const mod = (value, length) => ((value % length) + length) % length;

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

function copyCorrection(correction) {
  return { ...correction, point: correction.point ? copyPoint(correction.point) : null };
}

function inheritedInfluence(memory, key) {
  return memory.reduce((sum, correction, index) => {
    const age = 1 - Math.min(index, 6) * 0.07;
    return sum + Number(correction[key] ?? 0) * age;
  }, 0);
}

function correctionForStage(stage) {
  const random = rng(SEED + stage * 9176);
  return {
    stage,
    wallStep: 1,
    portalDrift: (random() - 0.5) * 0.12,
    routeBias: (random() - 0.5) * 0.16,
    reason: stage % 2 ? 'the correction crossed the wall' : 'the correction kept walking inside'
  };
}

function portalForWall(wall, house, drift, routeBias) {
  const left = house.houseX - house.houseWidth / 2;
  const right = house.houseX + house.houseWidth / 2;
  const top = house.houseY;
  const bottom = house.houseY + house.houseHeight;
  const y = clamp(house.houseY + house.houseHeight * (0.48 + drift), top + 0.07, bottom - 0.06);
  const x = clamp(house.houseX + routeBias * 0.22, left + 0.08, right - 0.08);

  if (wall === 'right') {
    return {
      wall,
      center: { x: right, y },
      from: { x: right + 0.09, y: y + 0.025 },
      to: { x: right - 0.055, y },
      crossesBody: true,
      exit: { x: left - 0.065, y: y + 0.07 }
    };
  }
  if (wall === 'roof') {
    return {
      wall,
      center: { x, y: top - 0.105 },
      from: { x: x + 0.015, y: top - 0.19 },
      to: { x, y: top + 0.035 },
      crossesBody: true,
      exit: { x: right + 0.085, y: top + 0.105 }
    };
  }
  if (wall === 'left') {
    return {
      wall,
      center: { x: left, y },
      from: { x: left - 0.09, y: y + 0.025 },
      to: { x: left + 0.055, y },
      crossesBody: true,
      exit: { x: right + 0.065, y: y + 0.07 }
    };
  }
  return {
    wall: 'front',
    center: { x, y: bottom - 0.065 },
    from: { x, y: bottom + 0.12 },
    to: { x, y: bottom - 0.065 },
    crossesBody: false,
    exit: null
  };
}

function routeForOpening(opening, house, routeBias) {
  const start = { x: clamp(0.47 + routeBias, 0.18, 0.82), y: 0.98 };
  const knee = { x: clamp(0.47 + routeBias * 1.8, 0.18, 0.82), y: 0.79 };
  if (!opening.crossesBody) return [start, knee, { ...opening.from }, { ...opening.to, inside: true }];

  const interior = {
    x: house.houseX + (opening.wall === 'left' ? 0.08 : -0.08),
    y: opening.center.y + 0.035,
    inside: true
  };
  return [start, knee, { ...opening.from }, { ...opening.to, inside: true }, interior, { ...opening.exit }];
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = clamp(Math.floor(stage), 0, STAGES - 1);
  const random = rng(SEED + safeStage * 31337);
  const inherited = Array.isArray(memory) ? memory.map(copyCorrection) : [];
  const correction = correctionForStage(safeStage);
  const wallSteps = inherited.reduce((sum, item) => sum + Number(item.wallStep ?? 0), 0);
  const portalDrift = clamp(inheritedInfluence(inherited, 'portalDrift'), -0.18, 0.18);
  const routeBias = clamp(inheritedInfluence(inherited, 'routeBias'), -0.22, 0.22);
  const house = {
    houseX: clamp(0.48 + (random() - 0.5) * 0.025, 0.34, 0.62),
    houseY: clamp(0.38 + (random() - 0.5) * 0.02, 0.28, 0.48),
    houseWidth: 0.31 + random() * 0.024,
    houseHeight: 0.27 + random() * 0.022,
    roofLean: (random() - 0.5) * 0.08
  };
  const sceneOpening = portalForWall(OPENINGS[mod(wallSteps, OPENINGS.length)], house, portalDrift, routeBias);
  const draftOpening = portalForWall('front', house, 0, 0);

  return {
    stage: safeStage,
    memory: inherited,
    correction,
    primitiveCount: PRIMITIVE_BUDGET,
    draft: {
      ...house,
      opening: draftOpening,
      route: routeForOpening(draftOpening, house, 0)
    },
    scene: {
      ...house,
      opening: sceneOpening,
      route: routeForOpening(sceneOpening, house, routeBias),
      sun: {
        x: clamp(0.16 + random() * 0.08, 0.10, 0.30),
        y: clamp(0.16 + random() * 0.07, 0.10, 0.28),
        radius: 0.058 + random() * 0.012
      },
      tree: {
        x: clamp(0.79 - routeBias * 0.18, 0.66, 0.90),
        y: clamp(0.49 + portalDrift * 0.12, 0.42, 0.58)
      },
      decisionTrace: {
        openingChanged: sceneOpening.wall !== draftOpening.wall,
        routeLength: sceneOpening.wall === 'front' ? 4 : 6,
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

export function applyCorrection(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.08, 0.92),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.12, 0.86)
  };
  const correction = {
    stage: frame.stage,
    source: 'visitor-threshold',
    point: bounded,
    wallStep: bounded.x < 0.5 ? 1 : 2,
    portalDrift: (bounded.y - 0.5) * 0.28,
    routeBias: (bounded.x - 0.5) * 0.22,
    reason: bounded.x < 0.5 ? 'the visitor moved the threshold left' : 'the visitor moved the threshold right'
  };
  return { ...buildFrame(frame.stage, [...frame.memory, correction]), interaction: 'visitor-threshold' };
}

export function deleteLatestCorrection(frame) {
  if (!frame.memory.length) return { ...frame, interaction: 'threshold-deleted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'threshold-deleted' };
}

export function layoutForViewport(width, height) {
  const stacked = width < 640;
  return stacked
    ? {
      mode: 'stacked',
      panels: [
        { x: 0.08, y: 0.06, w: 0.84, h: 0.38, label: 'refused' },
        { x: 0.08, y: 0.56, w: 0.84, h: 0.38, label: 'kept' }
      ],
      bridge: { x1: 0.50, y1: 0.44, x2: 0.50, y2: 0.56 },
      height
    }
    : {
      mode: 'diptych',
      panels: [
        { x: 0.04, y: 0.10, w: 0.41, h: 0.78, label: 'refused' },
        { x: 0.55, y: 0.10, w: 0.41, h: 0.78, label: 'kept' }
      ],
      bridge: { x1: 0.45, y1: 0.50, x2: 0.55, y2: 0.50 },
      height
    };
}
