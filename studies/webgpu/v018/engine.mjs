export const SEED = 0x57473138;
export const STAGES = 15;
export const NODES = 13;
export const MEMORY_LIMIT = 4;
export const PRIMITIVE_BUDGET = 60;

const TAU = Math.PI * 2;
const AUTO_CUES = [
  { node: 1, dwell: 0.48 },
  { node: 8, dwell: 0.62 },
  { node: 4, dwell: 0.76 },
  { node: 11, dwell: 0.9 }
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clampInt = (value, min, max) => Math.round(clamp(Number.isFinite(Number(value)) ? Number(value) : min, min, max));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const copy = (value) => JSON.parse(JSON.stringify(value));

const baseNodes = () => Array.from({ length: NODES }, (_, id) => {
  const angle = -Math.PI / 2 + id * TAU / NODES + Math.sin(id * 9.17) * 0.045;
  const orbit = 0.285 + (id % 3) * 0.022;
  return {
    id,
    x: Number((0.5 + Math.cos(angle) * orbit).toFixed(5)),
    y: Number((0.5 + Math.sin(angle) * orbit * 0.86).toFixed(5)),
    angle: Number(angle.toFixed(5)),
    radius: Number((0.058 + (id % 4) * 0.006).toFixed(5)),
    rotation: Number((angle + Math.PI / 2).toFixed(5)),
    scale: 1,
    vacancy: 0,
    aperture: 0,
    reply: -1,
    tension: 0
  };
});

const normalizeCue = (cue = {}) => ({
  node: clampInt(cue.node, 0, NODES - 1),
  dwell: clamp(finite(cue.dwell, 0.6), 0.3, 1.2)
});

const normalizeEvent = (event = {}, serial = 0) => ({
  id: `witness-${serial}`,
  source: event.source || 'replayed-witness',
  mode: 'wrong-witness',
  cue: normalizeCue(event.cue || event),
  serial
});

const normalizeMemory = (memory = []) => memory.slice(-MEMORY_LIMIT).map((event, index) => normalizeEvent(event, index));

const buildField = (memory) => {
  const nodes = baseNodes();
  const vacancies = [];
  const apertures = [];
  const events = [];

  memory.forEach((rawEvent, serial) => {
    const event = normalizeEvent(rawEvent, serial);
    const source = nodes[event.cue.node];
    const remoteId = (source.id + 5 + serial * 2) % NODES;
    const remote = nodes[remoteId];
    source.vacancy = Math.min(1, source.vacancy + 0.72);
    source.scale = Math.max(0.42, source.scale - 0.09);
    source.rotation += 0.08 + serial * 0.018;
    source.tension += 0.7 + serial * 0.12;
    source.reply = remoteId;
    remote.aperture = Math.min(1, remote.aperture + 0.76);
    remote.scale += 0.08 + serial * 0.012;
    remote.rotation -= 0.06 + serial * 0.014;
    remote.tension += 0.45 + serial * 0.1;
    remote.reply = source.id;
    const vacancy = { node: source.id, serial, strength: Number(source.vacancy.toFixed(4)) };
    const aperture = { node: remote.id, answeredFrom: source.id, serial, strength: Number(remote.aperture.toFixed(4)) };
    vacancies.push(vacancy);
    apertures.push(aperture);
    events.push({ ...event, sourceNode: source.id, remoteNode: remote.id, vacancy, aperture });
  });

  const signature = JSON.stringify(nodes.map((node) => [
    node.id,
    node.x,
    node.y,
    Number(node.rotation.toFixed(5)),
    Number(node.scale.toFixed(5)),
    Number(node.vacancy.toFixed(5)),
    Number(node.aperture.toFixed(5)),
    node.reply,
    Number(node.tension.toFixed(5))
  ]));

  return { nodes, vacancies, apertures, events, signature };
};

export const buildFrame = (stage = 0, memory = [], armedNode = -1) => {
  const normalizedMemory = normalizeMemory(memory);
  return {
    stage: clampInt(stage, 0, STAGES - 1),
    memory: normalizedMemory,
    armedNode: clampInt(armedNode, -1, NODES - 1),
    field: buildField(normalizedMemory),
    archive: normalizedMemory.map((event, index) => ({
      index,
      id: event.id,
      mode: event.mode,
      cue: copy(event.cue)
    }))
  };
};

export const buildTimeline = (limit = STAGES) => Array.from({ length: limit }, (_, stage) => {
  const memory = AUTO_CUES.slice(0, Math.min(MEMORY_LIMIT, Math.floor((stage + 1) / 3)))
    .map((cue, index) => ({ cue, source: 'auto-witness', index }));
  return buildFrame(stage, memory);
});

export const armWitness = (frame, cue = defaultCue()) => {
  const normalized = normalizeCue(cue);
  return { ...frame, armedNode: normalized.node };
};

export const commitWitness = (frame, cue = defaultCue()) => {
  if (frame.memory.length >= MEMORY_LIMIT) return frame;
  const event = normalizeEvent({ cue, source: 'visitor-witness' }, frame.memory.length);
  return buildFrame(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], -1);
};

export const liftLatestWitness = (frame) => buildFrame(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), -1);
export const releaseField = () => buildFrame(0, [], -1);
export const defaultCue = () => copy(AUTO_CUES[0]);
export const geometrySignature = (frame) => JSON.stringify({
  field: frame.field.signature,
  vacancies: frame.field.vacancies,
  apertures: frame.field.apertures
});
