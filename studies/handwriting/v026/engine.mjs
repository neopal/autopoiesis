const MEMORY_LIMIT = 4;
const GLYPH_COUNT = 7;
const DEPARTURE_THRESHOLD = 0.7;

const ROUTE_LIBRARY = {
  M: [[-0.9, 0.8, -0.9, -0.8], [-0.9, -0.8, 0, 0.1], [0, 0.1, 0.9, -0.8], [0.9, -0.8, 0.9, 0.8]],
  A: [[-0.9, 0.8, 0, -0.8], [0, -0.8, 0.9, 0.8], [-0.58, 0.2, 0.58, 0.2]],
  R: [[-0.72, 0.8, -0.72, -0.8], [-0.72, 0.8, 0.2, 0.8], [0.2, 0.8, 0.58, 0.42], [0.58, 0.42, 0.2, 0.02], [0.2, 0.02, -0.72, 0.02], [0.2, 0.02, 0.76, -0.8]],
  G: [[0.82, 0.48, 0.5, 0.78], [-0.12, 0.82, -0.72, 0.25], [-0.72, 0.25, -0.58, -0.56], [-0.58, -0.56, 0.12, -0.8], [0.12, -0.8, 0.82, -0.38], [0.82, -0.38, 0.82, 0.02], [0.82, 0.02, 0.18, 0.02]],
  I: [[-0.55, 0.8, 0.55, 0.8], [0, 0.8, 0, -0.8], [-0.55, -0.8, 0.55, -0.8]],
  N: [[-0.82, 0.8, -0.82, -0.8], [-0.82, 0.8, 0.82, -0.8], [0.82, -0.8, 0.82, 0.8]],
  S: [[0.78, 0.62, 0.34, 0.8], [0.34, 0.8, -0.62, 0.58], [-0.62, 0.58, -0.8, 0.05], [-0.8, 0.05, -0.5, -0.42], [-0.5, -0.42, 0.58, -0.8], [0.58, -0.8, 0.8, -0.54]]
};

const GLYPH_SEED = ['M', 'A', 'R', 'G', 'I', 'N', 'S'];
const CUSTODY_TOKENS = 'custody'.split('');

function cloneRoute(route) {
  return route.map((segment) => segment.slice());
}

function clampGlyph(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(GLYPH_COUNT - 1, Math.round(number)));
}

function normalizeEvent(event, index = 0) {
  const glyph = clampGlyph(event?.glyph);
  const suppliedReply = clampGlyph(event?.replyIndex);
  const replyIndex = suppliedReply === glyph ? (glyph + 2 + index) % GLYPH_COUNT : suppliedReply;
  return {
    glyph,
    replyIndex,
    token: String(event?.token || CUSTODY_TOKENS[index % CUSTODY_TOKENS.length]),
    distance: Number.isFinite(Number(event?.distance)) ? Number(event.distance) : 0.84
  };
}

function chooseReply(glyph, departureCount) {
  return (glyph * 3 + departureCount * 2 + 1) % GLYPH_COUNT === glyph
    ? (glyph + 1) % GLYPH_COUNT
    : (glyph * 3 + departureCount * 2 + 1) % GLYPH_COUNT;
}

function baseGlyphs() {
  return GLYPH_SEED.map((letter, index) => ({
    index,
    letter,
    route: cloneRoute(ROUTE_LIBRARY[letter]),
    offset: [index * 0.01, 0],
    rotation: (index - 3) * 1.4,
    scale: 1,
    depth: index * 0.12,
    custody: ''
  }));
}

function applyDeparture(glyphs, event, eventIndex) {
  const local = glyphs[event.glyph];
  const localRoute = cloneRoute(local.route);
  const cutIndex = (eventIndex + event.glyph) % localRoute.length;
  const cut = localRoute[cutIndex];
  localRoute[cutIndex] = [cut[0], cut[1], cut[0] + (cut[2] - cut[0]) * 0.28, cut[1] + (cut[3] - cut[1]) * 0.28];
  local.route = localRoute;
  local.offset = [local.offset[0] - 0.025 * (eventIndex + 1), local.offset[1] + 0.035 * ((event.glyph % 2) ? 1 : -1)];
  local.rotation += (eventIndex % 2 ? -1 : 1) * (3.5 + eventIndex * 0.45);
  local.scale *= 1.04;
  local.custody = `${local.custody}${event.token}`;

  const reply = glyphs[event.replyIndex];
  const replyRoute = cloneRoute(reply.route);
  const anchor = replyRoute[(eventIndex + 1) % replyRoute.length];
  replyRoute.push([anchor[0], anchor[1], anchor[2] * 0.35, anchor[3] * 0.35]);
  reply.route = replyRoute;
  reply.offset = [reply.offset[0] + 0.035 * (eventIndex + 1), reply.offset[1] - 0.028 * ((event.replyIndex % 2) ? 1 : -1)];
  reply.rotation -= 2.8 + eventIndex * 0.3;
  reply.scale *= 0.97;
  reply.custody = `${reply.custody}${event.token.toUpperCase()}`;

  glyphs.forEach((glyph, index) => {
    if (index === event.glyph || index === event.replyIndex) return;
    const distance = Math.abs(index - event.glyph);
    if (distance <= 2) {
      glyph.offset = [glyph.offset[0] + (index < event.glyph ? -1 : 1) * 0.012 * (eventIndex + 1), glyph.offset[1]];
      glyph.rotation += (index % 2 ? 1 : -1) * 0.55;
    }
  });
}

function frameFromMemory(stage, memory, departureCount = memory.length, lastEvent = 'quiet') {
  const safeMemory = memory.slice(-MEMORY_LIMIT).map((event, index) => normalizeEvent(event, index));
  const glyphs = baseGlyphs();
  safeMemory.forEach((event, index) => applyDeparture(glyphs, event, index));
  return {
    composition: 'route-rack',
    stage: Number.isFinite(Number(stage)) ? Number(stage) : safeMemory.length,
    glyphs,
    memory: safeMemory,
    material: {
      lastEvent,
      departureCount,
      custody: safeMemory.map((event) => event.token[0]).join('').slice(-MEMORY_LIMIT),
      threshold: DEPARTURE_THRESHOLD
    }
  };
}

function buildFrame(stage = 0, memory = []) {
  return frameFromMemory(stage, Array.isArray(memory) ? memory : []);
}

function commitDeparture(frame, { glyph = 0, distance = 0 } = {}) {
  const safeFrame = frame || buildFrame();
  const safeGlyph = clampGlyph(glyph);
  if (Number(distance) < DEPARTURE_THRESHOLD) {
    return frameFromMemory(safeFrame.stage, safeFrame.memory, safeFrame.material.departureCount, 'armed');
  }
  const departureCount = safeFrame.material.departureCount + 1;
  const event = normalizeEvent({
    glyph: safeGlyph,
    replyIndex: chooseReply(safeGlyph, departureCount),
    token: CUSTODY_TOKENS[(departureCount - 1) % CUSTODY_TOKENS.length],
    distance
  }, departureCount - 1);
  return frameFromMemory(safeFrame.stage + 1, [...safeFrame.memory, event], departureCount, 'departed');
}

function liftLatestDeparture(frame) {
  const safeFrame = frame || buildFrame();
  const memory = safeFrame.memory.slice(0, -1);
  return frameFromMemory(safeFrame.stage, memory, Math.max(0, safeFrame.material.departureCount - 1), 'lifted');
}

function geometrySignature(frame) {
  return JSON.stringify({
    glyphs: frame.glyphs.map(({ route, offset, rotation, scale, depth, custody }) => ({ route, offset, rotation, scale, depth, custody })),
    memory: frame.memory,
    custody: frame.material.custody
  });
}

export {
  DEPARTURE_THRESHOLD,
  GLYPH_COUNT,
  MEMORY_LIMIT,
  buildFrame,
  commitDeparture,
  geometrySignature,
  liftLatestDeparture
};
