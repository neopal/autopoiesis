export const SEED = 0x57473332;
export const STAGES = 9;
export const CELL_COUNT = 24;
export const MEMORY_LIMIT = 4;
export const PRIMITIVE_BUDGET = 66;
export const QUORUM_SIZE = 3;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const integer = (value, min, max) => Math.round(clamp(finite(value, min), min, max));
const round = (value) => Number(value.toFixed(5));
const pseudo = (value) => {
  const raw = Math.sin(value * 19.173 + SEED * 0.00003) * 43758.5453;
  return raw - Math.floor(raw);
};
const normalizeCell = (value) => integer(value, 0, CELL_COUNT - 1);
const uniqueCells = (values = []) => [...new Set(values.map((value) => normalizeCell(value)))];

const normalizeEvent = (raw = {}, serial = 0) => ({
  id: `quorum-${serial}`,
  mode: 'remote-quorum',
  witnesses: uniqueCells(raw.witnesses).slice(0, QUORUM_SIZE),
  remote: normalizeCell(raw.remote),
  refusal: normalizeCell(raw.refusal),
  bridge: normalizeCell(raw.bridge),
  force: round(clamp(finite(raw.force, 0.72), 0.42, 1)),
  serial
});
const normalizeMemory = (memory = []) => (Array.isArray(memory) ? memory : [])
  .slice(-MEMORY_LIMIT)
  .map((event, index) => normalizeEvent(event, index));

const baseCells = () => Array.from({ length: CELL_COUNT }, (_, id) => {
  const ring = Math.floor(id / 8);
  const spoke = id % 8;
  const radius = [0.13, 0.29, 0.44][ring];
  const angle = spoke * Math.PI / 4 + ring * 0.19;
  return {
    id,
    ring,
    spoke,
    x: round(0.5 + Math.cos(angle) * radius * 1.08),
    y: round(0.5 + Math.sin(angle) * radius * 0.82),
    size: round(0.72 + pseudo(id + 8) * 0.26),
    phase: round(pseudo(id + 34) * Math.PI * 2),
    voidness: 0,
    bridge: 0,
    proxy: 0,
    voice: 1,
    tilt: 0
  };
});

const baseLinks = () => {
  const links = [];
  for (let ring = 0; ring < 3; ring += 1) {
    for (let spoke = 0; spoke < 8; spoke += 1) {
      const next = (spoke + 1) % 8;
      links.push({ a: ring * 8 + spoke, b: ring * 8 + next, tension: round(0.04 + pseudo(ring * 31 + spoke) * 0.07), open: 0 });
      if (ring < 2) links.push({ a: ring * 8 + spoke, b: (ring + 1) * 8 + ((spoke + ring) % 8), tension: round(0.03 + pseudo(ring * 47 + spoke + 3) * 0.06), open: 0 });
    }
  }
  return links;
};

const loadScores = (memory) => {
  const scores = Array.from({ length: CELL_COUNT }, () => 0);
  normalizeMemory(memory).forEach((event, serial) => {
    event.witnesses.forEach((cell) => { scores[cell] += 0.3 + serial * 0.04; });
    scores[event.remote] += 1.8;
    scores[event.refusal] += 1.2;
    scores[event.bridge] += 0.9;
  });
  return scores;
};
const chooseRemote = (memory, forbidden = [], offset = 0) => {
  const scores = loadScores(memory);
  const blocked = new Set(forbidden.map(normalizeCell));
  return Array.from({ length: CELL_COUNT }, (_, id) => id)
    .filter((id) => !blocked.has(id))
    .sort((a, b) => scores[a] - scores[b] || pseudo(a + offset * 17) - pseudo(b + offset * 17))[0] ?? 0;
};

const buildTopology = (memory) => {
  const cells = baseCells();
  const links = baseLinks();
  const route = [];
  normalizeMemory(memory).forEach((event, serial) => {
    const force = event.force + serial * 0.04;
    const remote = cells[event.remote];
    const refusal = cells[event.refusal];
    const bridge = cells[event.bridge];
    remote.proxy = round(Math.min(1, remote.proxy + force * 0.78));
    remote.size = round(Math.min(1.4, remote.size + force * 0.18));
    remote.tilt = round(remote.tilt + (serial % 2 ? -1 : 1) * force * 0.22);
    refusal.voidness = round(Math.min(0.92, refusal.voidness + force * 0.72));
    refusal.size = round(Math.max(0.46, refusal.size - force * 0.14));
    refusal.tilt = round(refusal.tilt - force * 0.12);
    bridge.bridge = round(Math.min(1, bridge.bridge + force * 0.78));
    bridge.size = round(Math.min(1.34, bridge.size + force * 0.1));
    bridge.tilt = round(bridge.tilt + force * 0.16);
    event.witnesses.forEach((cellId) => {
      cells[cellId].voice = round(Math.max(0.36, cells[cellId].voice - force * 0.08));
    });
    const link = links[(event.bridge * 3 + event.remote * 5 + serial * 11) % links.length];
    link.tension = round(Math.min(0.95, link.tension + force * 0.58));
    link.open = round(Math.min(0.78, link.open + refusal.voidness * 0.2));
    route.push(`${event.witnesses.join('.')}>${event.remote}>${event.refusal}>${event.bridge}`);
  });
  const signature = JSON.stringify({
    route: route.join('|') || 'quiet',
    cells: cells.map((cell) => [cell.id, cell.x, cell.y, cell.size, cell.voidness, cell.bridge, cell.proxy, cell.voice, cell.tilt]),
    links: links.map((link) => [link.a, link.b, link.tension, link.open])
  });
  return { cells, links, route: route.join('|') || 'quiet', signature };
};

export const buildFrame = (stage = 0, memory = [], witnesses = [], lastAction = 'quiet') => ({
  stage: integer(stage, 0, STAGES - 1),
  memory: normalizeMemory(memory),
  witnesses: uniqueCells(witnesses).slice(0, QUORUM_SIZE),
  lastAction,
  field: buildTopology(memory)
});

export const witnessCell = (frame, input = {}) => {
  const cell = normalizeCell(input.cell);
  if (frame.witnesses.includes(cell)) return { ...frame, lastAction: 'witness-duplicate' };
  if (frame.witnesses.length >= QUORUM_SIZE) return { ...frame, lastAction: 'quorum-ready' };
  return { ...frame, witnesses: [...frame.witnesses, cell], lastAction: 'witness-added' };
};

export const commitQuorum = (frame) => {
  if (frame.memory.length >= MEMORY_LIMIT) return { ...frame, witnesses: [], lastAction: 'memory-limit' };
  if (frame.witnesses.length < QUORUM_SIZE) return { ...frame, lastAction: 'quorum-refused-incomplete' };
  const witnesses = frame.witnesses.slice(0, QUORUM_SIZE);
  const remote = chooseRemote(frame.memory, witnesses, 1);
  const refusal = chooseRemote(frame.memory, [...witnesses, remote], 2);
  const bridge = chooseRemote(frame.memory, [...witnesses, remote, refusal], 3);
  const event = normalizeEvent({ witnesses, remote, refusal, bridge, force: 0.68 + ((frame.memory.length + remote) % 3) * 0.09 }, frame.memory.length);
  return buildFrame(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], [], 'quorum-committed');
};

export const liftLatestQuorum = (frame) => buildFrame(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), [], 'quorum-lifted');
export const releaseArchive = () => buildFrame(0, [], [], 'archive-released');

const AUTO_QUORUMS = [[2, 9, 17], [4, 11, 19], [1, 8, 15], [5, 13, 21]];
export const buildTimeline = (limit = STAGES) => {
  const timeline = [buildFrame(0, [])];
  for (let stage = 1; stage < limit; stage += 1) {
    const count = Math.min(MEMORY_LIMIT, Math.ceil(stage / 2));
    let frame = buildFrame(stage - 1, timeline.at(-1).memory);
    for (let serial = 0; serial < count; serial += 1) {
      for (const cell of AUTO_QUORUMS[serial]) frame = witnessCell(frame, { cell });
      frame = commitQuorum(frame);
    }
    timeline.push(buildFrame(stage, frame.memory, [], count ? 'settled-preview' : 'quiet'));
  }
  return timeline;
};

export const geometrySignature = (frame) => JSON.stringify({ field: frame.field.signature, cells: frame.field.cells, links: frame.field.links });
