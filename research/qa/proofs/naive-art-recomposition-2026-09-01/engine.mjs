export const SEED = 0x4e415649;
export const STAGES = 9;
export const PRIMITIVE_BUDGET = 26;
export const MISTAKE = 0.072;
const DOOR_CLEARANCE = 0.042;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function mistakeForStage(stage) {
  const random = rng(SEED + stage * 977);
  const direction = stage % 2 === 0 ? 1 : -1;
  return {
    stage,
    doorOffset: direction * (0.026 + random() * 0.022),
    pathBend: direction * (0.032 + random() * 0.026),
    reason: stage % 3 === 0 ? 'the correction was too sure' : 'the correction missed the mark'
  };
}

function inheritedInfluence(memory, key) {
  return memory.reduce((sum, mistake, index) => {
    const decay = 1 - Math.min(index, 7) * 0.075;
    return sum + mistake[key] * decay;
  }, 0);
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = clamp(Math.floor(stage), 0, STAGES - 1);
  const random = rng(SEED + safeStage * 313);
  const inherited = Array.isArray(memory) ? memory.map((mistake) => ({ ...mistake })) : [];
  const currentMistake = mistakeForStage(safeStage);
  const inheritedDoor = inheritedInfluence(inherited, 'doorOffset');
  const inheritedPath = inheritedInfluence(inherited, 'pathBend');
  const wobble = (random() - 0.5) * 0.024;
  const houseX = clamp(0.47 + wobble + inheritedDoor * 0.18, 0.30, 0.62);
  const houseY = clamp(0.46 + (random() - 0.5) * 0.018, 0.34, 0.54);
  const houseWidth = 0.28 + (random() - 0.5) * 0.018;
  const houseHeight = 0.22 + (random() - 0.5) * 0.012;
  const baseDoorX = houseX + houseWidth * 0.5;
  const doorY = houseY + houseHeight * 0.54;
  const draftDoorX = clamp(baseDoorX + currentMistake.doorOffset, 0.22, 0.78);
  const acceptedDoorX = clamp(
    draftDoorX + inheritedDoor,
    houseX - houseWidth / 2 + DOOR_CLEARANCE,
    houseX + houseWidth / 2 - DOOR_CLEARANCE
  );
  const draftPathBend = clamp(0.5 + currentMistake.pathBend, 0.18, 0.82);
  const acceptedPathBend = clamp(draftPathBend + inheritedPath, 0.12, 0.88);

  return {
    stage: safeStage,
    memory: inherited,
    mistake: currentMistake,
    primitiveCount: 18 + safeStage,
    draft: {
      houseX,
      houseY,
      houseWidth,
      houseHeight,
      door: { x: draftDoorX, y: doorY },
      pathBend: draftPathBend
    },
    scene: {
      houseX,
      houseY,
      houseWidth,
      houseHeight,
      door: { x: acceptedDoorX, y: doorY },
      pathBend: acceptedPathBend,
      sun: {
        x: clamp(0.18 + random() * 0.08 + safeStage * 0.006, 0.10, 0.32),
        y: clamp(0.18 + random() * 0.07, 0.10, 0.32),
        radius: 0.065 + random() * 0.012
      },
      tree: {
        x: clamp(0.78 + wobble * 2 - inheritedPath * 0.12, 0.66, 0.90),
        y: clamp(0.50 + inheritedDoor * 0.08, 0.42, 0.58)
      },
      decisionTrace: {
        doorGap: Math.abs(draftDoorX - acceptedDoorX),
        pathGap: Math.abs(draftPathBend - acceptedPathBend),
        retained: inherited.length > 0
      }
    }
  };
}

export function buildTimeline(count = STAGES) {
  const timeline = [];
  let memory = [];
  for (let stage = 0; stage < Math.min(count, STAGES); stage += 1) {
    const frame = buildFrame(stage, memory);
    timeline.push(frame);
    memory = [...memory, frame.mistake];
  }
  return timeline;
}

export function layoutForViewport(width, height) {
  const stacked = width < 560;
  return stacked
    ? {
      mode: 'stacked',
      panels: [
        { x: 0.08, y: 0.08, w: 0.84, h: 0.32, label: 'refused' },
        { x: 0.08, y: 0.58, w: 0.84, h: 0.32, label: 'kept' }
      ],
      bridge: { x1: 0.50, y1: 0.42, x2: 0.50, y2: 0.58 }
    }
    : {
      mode: 'diptych',
      panels: [
        { x: 0.05, y: 0.10, w: 0.40, h: 0.80, label: 'refused' },
        { x: 0.55, y: 0.10, w: 0.40, h: 0.80, label: 'kept' }
      ],
      bridge: { x1: 0.45, y1: 0.50, x2: 0.55, y2: 0.50 }
    };
}
