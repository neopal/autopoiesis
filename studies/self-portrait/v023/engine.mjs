export const SEED = 0x53504643;
export const STAGES = 17;
export const MEMORY_LIMIT = 4;
export const FACE_COUNT = 7;
export const PRIMITIVE_BUDGET = 84;

const clone = (value) => JSON.parse(JSON.stringify(value));
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state ^ (state >>> 16), 2246822519);
    state = Math.imul(state ^ (state >>> 13), 3266489917);
    return ((state ^ (state >>> 16)) >>> 0) / 4294967296;
  };
}

function safeStage(value) {
  return Math.max(0, Math.min(STAGES - 1, Math.floor(Number(value) || 0)));
}

function safeFace(value, fallback = 0) {
  const face = Number(value);
  return Number.isInteger(face) ? Math.max(0, Math.min(FACE_COUNT - 1, face)) : fallback;
}

function safeAngle(value, fallback = 0) {
  const angle = Number(value);
  return Number.isFinite(angle) ? Math.max(-1, Math.min(1, angle)) : fallback;
}

function faceFromAngle(angle) {
  const normalized = (safeAngle(angle) + 1) / 2;
  return Math.min(FACE_COUNT - 1, Math.floor(normalized * FACE_COUNT));
}

function makeFace(stage, index, random) {
  const radial = (index / FACE_COUNT) * Math.PI * 2 - Math.PI / 2;
  return {
    index,
    radial,
    radius: 0.72 + random() * 0.1,
    height: 0.8 + random() * 0.12,
    width: 0.7 + random() * 0.16,
    depth: 0.18 + random() * 0.12,
    twist: (random() - 0.5) * 0.18,
    notch: 0,
    fold: 0,
    seam: 0,
    seen: 0,
    state: 'quiet'
  };
}

function makeBase(stage) {
  const random = rng(SEED + stage * 9973);
  return {
    composition: 'single-observed-solid',
    stage,
    faces: Array.from({ length: FACE_COUNT }, (_, index) => makeFace(stage, index, random)),
    memory: [],
    viewAzimuth: 0,
    viewPitch: 0,
    armedFace: null,
    armedAngle: null,
    interaction: 'sequence'
  };
}

export function geometrySignature(frame) {
  return JSON.stringify({
    composition: frame.composition,
    stage: frame.stage,
    viewAzimuth: Number(frame.viewAzimuth.toFixed(5)),
    viewPitch: Number(frame.viewPitch.toFixed(5)),
    faces: frame.faces.map((face) => [
      face.index,
      Number(face.radial.toFixed(5)),
      Number(face.radius.toFixed(5)),
      Number(face.height.toFixed(5)),
      Number(face.width.toFixed(5)),
      Number(face.depth.toFixed(5)),
      Number(face.twist.toFixed(5)),
      Number(face.notch.toFixed(5)),
      Number(face.fold.toFixed(5)),
      Number(face.seam.toFixed(5)),
      face.state
    ])
  });
}

function chooseLeastSeen(frame, watchedFace) {
  const candidates = frame.faces
    .filter((face) => face.index !== watchedFace)
    .sort((a, b) => {
      const scoreA = a.seen + a.notch * 1.7 + a.fold * 0.4;
      const scoreB = b.seen + b.notch * 1.7 + b.fold * 0.4;
      return scoreA - scoreB || a.index - b.index;
    });
  const offset = frame.memory.length % Math.max(1, candidates.length);
  return candidates[offset]?.index ?? ((watchedFace + 1) % FACE_COUNT);
}

function chooseReply(alteredFace, watchedFace, memoryLength) {
  let reply = (alteredFace + 3 + memoryLength) % FACE_COUNT;
  if (reply === watchedFace || reply === alteredFace) reply = (reply + 1) % FACE_COUNT;
  return reply;
}

function normalizeEvent(frame, input = {}) {
  const watchedFace = safeFace(
    input.watchedFace,
    frame.armedFace ?? faceFromAngle(input.angle ?? frame.armedAngle ?? frame.viewAzimuth)
  );
  const alteredFace = safeFace(
    input.alteredFace,
    chooseLeastSeen(frame, watchedFace)
  );
  const replyFace = safeFace(
    input.replyFace,
    chooseReply(alteredFace, watchedFace, frame.memory.length)
  );
  return {
    id: input.id ?? `visitor-unseen-${frame.stage}-${frame.memory.length + 1}`,
    stage: frame.stage,
    source: 'situated-observation',
    kind: 'unseen-inversion',
    watchedFace,
    alteredFace: alteredFace === watchedFace ? (watchedFace + 1) % FACE_COUNT : alteredFace,
    replyFace,
    angle: safeAngle(input.angle, frame.armedAngle ?? frame.viewAzimuth),
    reason: 'the least-seen face changes while the watched face remains only a witness'
  };
}

function applyObservation(frame, event) {
  const next = clone(frame);
  const watched = next.faces[event.watchedFace];
  const altered = next.faces[event.alteredFace];
  const reply = next.faces[event.replyFace];
  const pressure = 0.16 + frame.memory.length * 0.035;

  watched.seen = Math.min(4, watched.seen + 1);
  altered.notch = clamp(altered.notch + 0.2 + pressure * 0.35, 0, 0.92);
  altered.fold = clamp(altered.fold + 0.24 + pressure * 0.22, 0, 1.2);
  altered.depth += 0.06 + pressure * 0.05;
  altered.twist += (event.alteredFace % 2 === 0 ? 1 : -1) * (0.12 + pressure * 0.08);
  altered.state = 'unseen-open';

  reply.seam = clamp(reply.seam + 0.16 + pressure * 0.2, 0, 1.1);
  reply.depth -= 0.04 + pressure * 0.03;
  reply.twist -= (event.replyFace % 2 === 0 ? 1 : -1) * (0.08 + pressure * 0.04);
  reply.state = 'echo';

  next.viewAzimuth = safeAngle(event.angle) * 0.42 + frame.memory.length * 0.045;
  next.viewPitch = Math.sin((event.watchedFace + 1) * 1.7) * 0.12 + frame.memory.length * 0.018;
  next.memory = [...frame.memory, clone(event)].slice(-MEMORY_LIMIT);
  next.armedFace = null;
  next.armedAngle = null;
  next.interaction = 'observation-sealed';
  return next;
}

export function buildFrame(stage = 0, memory = []) {
  let frame = makeBase(safeStage(stage));
  for (const rawEvent of clone(memory).slice(-MEMORY_LIMIT)) {
    const event = normalizeEvent(frame, rawEvent);
    frame = applyObservation(frame, { ...event, ...rawEvent });
  }
  frame.interaction = 'sequence';
  return frame;
}

export function armOrbit(frame, angle = 0) {
  const next = clone(frame);
  const safe = safeAngle(angle);
  next.viewAzimuth = safe * 0.42;
  next.viewPitch = safe * 0.15;
  next.armedAngle = safe;
  next.armedFace = faceFromAngle(safe);
  next.interaction = 'orbit-armed';
  return next;
}

export function sealObservation(frame, input = {}) {
  const event = normalizeEvent(frame, input);
  return applyObservation(frame, event);
}

export function liftLatestObservation(frame) {
  if (!frame.memory.length) {
    const untouched = clone(frame);
    untouched.interaction = 'observation-lifted';
    return untouched;
  }
  const restored = buildFrame(frame.stage, frame.memory.slice(0, -1));
  restored.interaction = 'observation-lifted';
  return restored;
}

export function releaseObservations(stage = 0) {
  const released = buildFrame(stage, []);
  released.interaction = 'observations-released';
  return released;
}

const CUES = [-0.72, -0.18, 0.31, 0.78];

export function defaultCue(index = 0) {
  return { angle: CUES[index % CUES.length] };
}

export function buildTimeline() {
  const timeline = [];
  let memory = [];
  const eventStages = new Map([[3, 0], [7, 1], [11, 2], [15, 3]]);
  for (let stage = 0; stage < STAGES; stage += 1) {
    let frame = buildFrame(stage, memory);
    if (eventStages.has(stage)) {
      frame = sealObservation(armOrbit(frame, defaultCue(eventStages.get(stage)).angle));
      memory = frame.memory;
    }
    frame.stage = stage;
    timeline.push(frame);
  }
  return timeline;
}
