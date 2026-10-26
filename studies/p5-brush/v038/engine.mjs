export const MEMORY_LIMIT = 4;
export const STAGES = 13;
export const SKIN_COUNT = 9;
export const SEAM_COUNT = 8;
export const MIN_SPAN = 2;

const SEED = 0x42523838;
const round = (value) => Number(value.toFixed(5));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const CONTROL_PAIRS = [[1, 5], [2, 7], [0, 4], [3, 6]];
const PALETTE_INDEX = [0, 2, 1, 3, 0, 4, 2, 1, 3];

function hash(value) {
  let state = (value >>> 0) + 0x9e3779b9;
  state = Math.imul(state ^ (state >>> 16), 0x85ebca6b);
  state = Math.imul(state ^ (state >>> 13), 0xc2b2ae35);
  return (state ^ (state >>> 16)) >>> 0;
}

const seeded = (index, salt) => (hash(SEED + index * 977 + salt * 389) >>> 0) / 4294967296;
const clampIndex = (value, count) => ((Math.floor(Number(value) || 0) % count) + count) % count;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function basePath(index) {
  const jitter = (salt, amount) => (seeded(index, salt) - 0.5) * amount;
  return [
    { x: round(0.09 + jitter(1, 0.05)), y: round(0.16 + jitter(2, 0.08)) },
    { x: round(0.30 + jitter(3, 0.08)), y: round(0.05 + jitter(4, 0.06)) },
    { x: round(0.68 + jitter(5, 0.08)), y: round(0.08 + jitter(6, 0.06)) },
    { x: round(0.91 + jitter(7, 0.06)), y: round(0.25 + jitter(8, 0.10)) },
    { x: round(0.86 + jitter(9, 0.08)), y: round(0.53 + jitter(10, 0.10)) },
    { x: round(0.95 + jitter(11, 0.05)), y: round(0.78 + jitter(12, 0.08)) },
    { x: round(0.60 + jitter(13, 0.10)), y: round(0.94 + jitter(14, 0.05)) },
    { x: round(0.24 + jitter(15, 0.08)), y: round(0.97 + jitter(16, 0.04)) },
    { x: round(0.05 + jitter(17, 0.04)), y: round(0.78 + jitter(18, 0.08)) },
    { x: round(0.12 + jitter(19, 0.06)), y: round(0.44 + jitter(20, 0.10)) }
  ];
}

function baseSkins() {
  return Array.from({ length: SKIN_COUNT }, (_, index) => {
    const angle = -18 + index * 4.5 + (seeded(index, 21) - 0.5) * 8;
    return {
      id: index,
      x: round(0.28 + index * 0.055 + (seeded(index, 22) - 0.5) * 0.02),
      y: round(0.50 + Math.sin(index * 0.82) * 0.045 + (seeded(index, 23) - 0.5) * 0.025),
      width: round(0.34 + (seeded(index, 24) - 0.5) * 0.035),
      height: round(0.52 + (seeded(index, 25) - 0.5) * 0.045),
      angle: round(angle),
      depth: round(0.14 + index * 0.028),
      fold: 0,
      opening: 0,
      peel: 0,
      sealed: 0,
      shed: 0,
      tone: PALETTE_INDEX[index],
      path: basePath(index)
    };
  });
}

function baseSeams() {
  const positions = [
    [0.17, 0.20, -18], [0.31, 0.13, -4], [0.49, 0.11, 10], [0.68, 0.16, 24],
    [0.82, 0.31, 70], [0.84, 0.57, 106], [0.69, 0.79, 164], [0.37, 0.84, 204]
  ];
  return positions.map(([x, y, angle], id) => ({
    id,
    x,
    y,
    angle,
    pressure: 0,
    open: 0,
    selected: false
  }));
}

function normalizePoint(point = {}) {
  return {
    x: round(clamp(Number(point.x) || 0, 0.02, 0.98)),
    y: round(clamp(Number(point.y) || 0, 0.02, 0.98))
  };
}

function normalizeEvent(event = {}) {
  const a = clampIndex(event.a, SEAM_COUNT);
  const b = clampIndex(event.b, SEAM_COUNT);
  const span = Math.min(Math.abs(a - b), SEAM_COUNT - Math.abs(a - b));
  return {
    source: event.source || 'unknown',
    a,
    b,
    span: Number.isFinite(event.span) ? event.span : span,
    pressure: Number.isFinite(event.pressure) ? event.pressure : 0.4 + span * 0.12,
    field: Number.isFinite(event.field) ? event.field >>> 0 : hash(SEED + a * 31 + b * 71)
  };
}

function adjustPath(path, influence, role, eventIndex) {
  const direction = role === 'seal' ? -1 : 1;
  return path.map((point, pointIndex) => {
    const wave = Math.sin((pointIndex + 1) * 1.7 + eventIndex * 0.9) * 0.012;
    const edge = pointIndex % 2 === 0 ? 1 : -1;
    return {
      x: round(clamp(point.x + direction * influence * (0.018 + wave) * edge, 0.02, 0.98)),
      y: round(clamp(point.y + influence * (0.014 + wave) * (role === 'shed' ? -1 : 1), 0.02, 0.98))
    };
  });
}

function mutateSkin(skin, role, event, eventIndex) {
  const spanForce = 0.24 + event.span * 0.055;
  const base = {
    ...skin,
    path: adjustPath(skin.path, spanForce, role, eventIndex)
  };
  if (role === 'peel') {
    return {
      ...base,
      x: round(clamp(skin.x + 0.018 + eventIndex * 0.006, 0.12, 0.90)),
      y: round(clamp(skin.y - 0.028 - eventIndex * 0.004, 0.16, 0.84)),
      angle: round(skin.angle + 7 + event.span * 1.8),
      depth: round(skin.depth + 0.10),
      fold: round(skin.fold + 0.32 + event.pressure * 0.24),
      opening: round(clamp(skin.opening + 0.24 + event.pressure * 0.18, 0, 1.8)),
      peel: round(skin.peel + 0.74 + event.pressure * 0.10)
    };
  }
  if (role === 'seal') {
    return {
      ...base,
      x: round(clamp(skin.x - 0.012, 0.12, 0.90)),
      y: round(clamp(skin.y + 0.018, 0.16, 0.84)),
      angle: round(skin.angle - 4.5),
      fold: round(skin.fold - 0.22),
      opening: round(clamp(skin.opening - 0.18, 0, 1.8)),
      sealed: round(skin.sealed + 0.78 + event.pressure * 0.08)
    };
  }
  return {
    ...base,
    x: round(clamp(skin.x - 0.024 - eventIndex * 0.003, 0.12, 0.90)),
    y: round(clamp(skin.y + 0.032, 0.16, 0.84)),
    angle: round(skin.angle + 3),
    depth: round(Math.max(0.05, skin.depth - 0.025)),
    fold: round(skin.fold + 0.12),
    opening: round(clamp(skin.opening + 0.46 + event.pressure * 0.12, 0, 1.8)),
    shed: round(skin.shed + 0.70 + event.span * 0.08)
  };
}

function seamInSpan(index, a, b) {
  const clockwise = (index - a + SEAM_COUNT) % SEAM_COUNT;
  const forward = (b - a + SEAM_COUNT) % SEAM_COUNT;
  const backward = (a - b + SEAM_COUNT) % SEAM_COUNT;
  if (forward <= backward) return clockwise <= forward;
  const counterClockwise = (a - index + SEAM_COUNT) % SEAM_COUNT;
  return counterClockwise <= backward;
}

function buildFrameFrom(stage, memory, interaction = 'baseline', pendingSeams = []) {
  const boundedMemory = memory.slice(-MEMORY_LIMIT).map(normalizeEvent);
  let skins = baseSkins();
  let seams = baseSeams();
  let event = null;

  boundedMemory.forEach((stored, eventIndex) => {
    const eventWithRoles = {
      ...stored,
      type: 'pressure-span',
      committed: true,
      index: eventIndex,
      peelSkin: (stored.a + eventIndex * 2) % SKIN_COUNT,
      sealSkin: (stored.b + eventIndex * 3 + 2) % SKIN_COUNT,
      shedSkin: (stored.a + stored.b + eventIndex + 4) % SKIN_COUNT
    };
    if (eventWithRoles.sealSkin === eventWithRoles.peelSkin) eventWithRoles.sealSkin = (eventWithRoles.sealSkin + 1) % SKIN_COUNT;
    if (eventWithRoles.shedSkin === eventWithRoles.peelSkin || eventWithRoles.shedSkin === eventWithRoles.sealSkin) eventWithRoles.shedSkin = (eventWithRoles.shedSkin + 2) % SKIN_COUNT;

    skins = skins.map((skin) => {
      if (skin.id === eventWithRoles.peelSkin) return mutateSkin(skin, 'peel', stored, eventIndex);
      if (skin.id === eventWithRoles.sealSkin) return mutateSkin(skin, 'seal', stored, eventIndex);
      if (skin.id === eventWithRoles.shedSkin) return mutateSkin(skin, 'shed', stored, eventIndex);
      return skin;
    });
    seams = seams.map((seam) => {
      if (seam.id === stored.a || seam.id === stored.b || seamInSpan(seam.id, stored.a, stored.b)) {
        return {
          ...seam,
          pressure: round(seam.pressure + 0.48 + stored.span * 0.09),
          open: round(clamp(seam.open + (seam.id === stored.a || seam.id === stored.b ? 0.28 : 0.10), 0, 1.8))
        };
      }
      return seam;
    });
    event = eventWithRoles;
  });

  const selected = pendingSeams.map((value) => clampIndex(value, SEAM_COUNT));
  seams = seams.map((seam) => ({ ...seam, selected: selected.includes(seam.id) }));
  return {
    grammar: 'lamina-stack',
    stage,
    memory: boundedMemory,
    memoryLimit: MEMORY_LIMIT,
    skins,
    seams,
    event,
    pending: { seams: selected },
    peelCount: skins.filter((skin) => skin.peel > 0.1).length,
    openingCount: skins.filter((skin) => skin.opening > 0.1).length,
    sealedCount: skins.filter((skin) => skin.sealed > 0.1).length,
    interaction,
    renderer: 'deterministic browser-native DOM/CSS lamina stack'
  };
}

export function buildFrame(stage = 0, memory = []) {
  return buildFrameFrom(stage, memory);
}

export function selectSeam(frame, seamIndex) {
  const index = clampIndex(seamIndex, SEAM_COUNT);
  const selected = frame.pending?.seams || [];
  if (selected.includes(index)) return buildFrameFrom(frame.stage, frame.memory, 'seam-refused-repeat', selected);
  if (selected.length >= 2) return buildFrameFrom(frame.stage, frame.memory, 'seam-refused-full', selected);
  return buildFrameFrom(frame.stage, frame.memory, 'seam-selected', [...selected, index]);
}

export function applyPinch(frame, seamA, seamB, source = 'visitor-pinch') {
  const a = clampIndex(seamA, SEAM_COUNT);
  const b = clampIndex(seamB, SEAM_COUNT);
  const gap = Math.min(Math.abs(a - b), SEAM_COUNT - Math.abs(a - b));
  if (a === b || gap < MIN_SPAN) return buildFrameFrom(frame.stage, frame.memory, 'pinch-refused-adjacent');
  const event = {
    source,
    a,
    b,
    span: gap,
    pressure: round(0.52 + gap * 0.13),
    field: hash(SEED + frame.memory.length * 7919 + a * 31 + b * 71)
  };
  return buildFrameFrom(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], 'pinch-committed');
}

export function liftLatest(frame) {
  if (!frame.memory.length) return buildFrameFrom(frame.stage, frame.memory, 'lift-refused');
  return buildFrameFrom(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), 'lifted');
}

export function releaseLayers() {
  return buildFrameFrom(0, [], 'released');
}

export function buildTimeline(stageCount = STAGES) {
  let frame = buildFrame(0, []);
  const timeline = [frame];
  for (let stage = 1; stage < stageCount; stage += 1) {
    if (stage % 3 === 0) {
      const pair = CONTROL_PAIRS[(stage / 3) - 1];
      frame = applyPinch(frame, pair[0], pair[1], 'timeline-pinch');
    } else {
      frame = buildFrameFrom(stage, frame.memory, 'timeline');
    }
    frame = { ...frame, stage };
    timeline.push(frame);
  }
  return timeline;
}

export function geometrySignature(frame) {
  const seams = frame.seams.map(({ selected, ...seam }) => seam);
  return JSON.stringify({ skins: frame.skins, seams });
}
