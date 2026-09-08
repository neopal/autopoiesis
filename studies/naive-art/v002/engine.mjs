export const SEED = 0x4e413032;
export const STAGES = 9;
export const PRIMITIVE_BUDGET = 28;

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
  return { x: Number(point.x), y: Number(point.y) };
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
  const side = stage % 3 === 1 ? -1 : 1;
  return {
    stage,
    doorOffset: 0.055 + random() * 0.018,
    bodyShift: 0.045 + random() * 0.018,
    pathBend: side * (0.082 + random() * 0.028),
    verticalShift: (random() - 0.5) * 0.024,
    reason: stage % 2 ? 'the correction walked past the wall' : 'the correction kept walking'
  };
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = clamp(Math.floor(stage), 0, STAGES - 1);
  const random = rng(SEED + safeStage * 31337);
  const inherited = Array.isArray(memory) ? memory.map(copyCorrection) : [];
  const current = correctionForStage(safeStage);
  const inheritedBody = inheritedInfluence(inherited, 'bodyShift');
  const inheritedDoor = inheritedInfluence(inherited, 'doorOffset');
  const inheritedPath = inheritedInfluence(inherited, 'pathBend');
  const inheritedVertical = inheritedInfluence(inherited, 'verticalShift');
  const baseX = clamp(0.46 + (random() - 0.5) * 0.035, 0.33, 0.58);
  const baseY = clamp(0.37 + (random() - 0.5) * 0.022, 0.28, 0.48);
  const houseWidth = 0.31 + random() * 0.025;
  const houseHeight = 0.28 + random() * 0.022;
  const draftHouseX = baseX;
  const keptHouseX = clamp(baseX + inheritedBody * 0.48, 0.29, 0.68);
  const draftHouseY = baseY;
  const keptHouseY = clamp(baseY + inheritedVertical * 0.52, 0.26, 0.52);
  const draftDoorLocal = clamp(0.5 + current.doorOffset * 2.2, 0.18, 0.82);
  const keptDoorLocal = clamp(0.5 + current.doorOffset * 2.2 + inheritedDoor * 1.8, 0.16, 0.84);
  const draftPathBend = clamp(0.48 + current.pathBend, 0.16, 0.84);
  const keptPathBend = clamp(draftPathBend + inheritedPath * 0.72, 0.12, 0.88);
  const doorY = 0.60;
  const treeX = clamp(0.79 - inheritedBody * 0.14, 0.66, 0.89);

  const geometry = (houseX, houseY, doorLocal, pathBend) => {
    const doorX = houseX - houseWidth / 2 + houseWidth * doorLocal;
    return {
      houseX,
      houseY,
      houseWidth,
      houseHeight,
      roofLean: clamp((random() - 0.5) * 0.08 + inheritedPath * 0.12, -0.09, 0.09),
      door: { x: doorX, y: houseY + houseHeight * doorY },
      doorLocal,
      pathBend,
      pathKneeY: clamp(0.78 + inheritedVertical * 0.2, 0.70, 0.86)
    };
  };

  const draft = geometry(draftHouseX, draftHouseY, draftDoorLocal, draftPathBend);
  const scene = geometry(keptHouseX, keptHouseY, keptDoorLocal, keptPathBend);

  return {
    stage: safeStage,
    memory: inherited,
    correction: current,
    primitiveCount: PRIMITIVE_BUDGET,
    draft,
    scene: {
      ...scene,
      sun: { x: clamp(0.17 + random() * 0.08, 0.10, 0.30), y: clamp(0.17 + random() * 0.06, 0.10, 0.28), radius: 0.056 + random() * 0.012 },
      tree: { x: treeX, y: clamp(0.50 + inheritedVertical * 0.1, 0.42, 0.58) },
      decisionTrace: {
        houseShift: Math.abs(scene.houseX - draft.houseX),
        doorShift: Math.abs(scene.door.x - draft.door.x),
        pathShift: Math.abs(scene.pathBend - draft.pathBend),
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
  const side = bounded.x >= 0.5 ? 1 : -1;
  const correction = {
    stage: frame.stage,
    source: 'visitor-correction',
    point: bounded,
    doorOffset: 0.084,
    bodyShift: side * 0.074,
    pathBend: side * 0.13,
    verticalShift: (bounded.y - 0.5) * 0.08,
    reason: 'the visitor placed a correction'
  };
  return { ...buildFrame(frame.stage, [...frame.memory, correction]), interaction: 'visitor-correction' };
}

export function deleteLatestCorrection(frame) {
  if (!frame.memory.length) return { ...frame, interaction: 'correction-deleted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'correction-deleted' };
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
