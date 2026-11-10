export const SEED = 0x57473049;
export const SITE_COUNT = 24;
export const MEMORY_LIMIT = 4;
export const TWO_PI = Math.PI * 2;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const integer = (value, fallback, min, max) => Math.round(clamp(finite(value, fallback), min, max));
const round = (value) => Number(value.toFixed(5));
const wrap = (value, size) => ((value % size) + size) % size;

const SITE_RINGS = [0.18, 0.33, 0.49];
const SITE_LAYOUT = Array.from({ length: SITE_COUNT }, (_, index) => {
  const ring = index % SITE_RINGS.length;
  const orbitIndex = Math.floor(index / SITE_RINGS.length);
  const angle = orbitIndex / 8 * TWO_PI + ring * 0.36 + 0.08 * Math.sin(index * 1.73);
  const radius = SITE_RINGS[ring] + 0.018 * Math.sin(index * 2.41);
  return {
    x: round(0.5 + Math.cos(angle) * radius * 1.18),
    y: round(0.5 + Math.sin(angle) * radius * 0.82),
    radius: round(0.018 + ring * 0.005 + (index % 4) * 0.002),
    gap: round(wrap(0.4 + index * 0.71, TWO_PI)),
    aperture: round(0.34 + (index % 5) * 0.035),
    echo: 0,
    attention: 0
  };
});

const normalizeSite = (value, fallback = 0) => integer(value, fallback, 0, SITE_COUNT - 1);
const cloneGesture = (gesture) => gesture ? { ...gesture } : null;
const cloneMemory = (memory) => memory.map((event) => ({ ...event }));

export const expectedReplyFor = (entry, serial = 0) => wrap(normalizeSite(entry) + 5 + serial * 4, SITE_COUNT);

const normalizeEvent = (event = {}, serial = 0) => {
  const entry = normalizeSite(event.entry, serial === 0 ? 3 : 3);
  const reply = normalizeSite(event.reply, expectedReplyFor(entry, serial));
  const angle = finite(event.angle, Math.atan2(SITE_LAYOUT[reply].y - SITE_LAYOUT[entry].y, SITE_LAYOUT[reply].x - SITE_LAYOUT[entry].x));
  return {
    id: `returned-attention-${serial + 1}`,
    type: 'returned-attention',
    entry,
    reply,
    angle: round(angle),
    serial,
    reason: event.reason ?? 'reciprocal-withdrawal'
  };
};

const baseSites = () => SITE_LAYOUT.map((site) => ({ ...site }));

const applyReturn = (sites, event) => sites.map((site, index) => {
  const dx = site.x - SITE_LAYOUT[event.entry].x;
  const dy = site.y - SITE_LAYOUT[event.entry].y;
  const distance = Math.hypot(dx, dy);
  const relation = Math.sin((index + 1) * 1.17 + event.serial * 0.87 + event.angle * 2.4);
  const counter = Math.cos((site.x + site.y) * 12 + event.reply * 0.61);
  const globalTurn = (event.serial % 2 === 0 ? 1 : -1) * (0.11 + event.serial * 0.025);
  const absence = index === event.entry ? 0.28 : index === event.reply ? -0.12 : 0;
  return {
    ...site,
    gap: round(wrap(site.gap + globalTurn + relation * 0.055 + counter * 0.025, TWO_PI)),
    aperture: round(clamp(site.aperture + relation * 0.045 + absence, 0.18, 0.78)),
    echo: round(clamp(site.echo + 0.16 + Math.abs(relation) * 0.13 + distance * 0.09, 0, 1)),
    attention: round(clamp(site.attention + (index === event.entry ? 0.5 : index === event.reply ? 0.24 : 0.055 + Math.abs(counter) * 0.035), 0, 1))
  };
});

const buildField = (memory) => {
  let sites = baseSites();
  const absenceHistory = [];
  cloneMemory(memory).forEach((event) => {
    const normalized = normalizeEvent(event, absenceHistory.length);
    sites = applyReturn(sites, normalized);
    absenceHistory.push(normalized.entry);
  });
  const last = memory.at(-1);
  const nextWitness = last ? normalizeEvent(last, memory.length - 1).reply : 3;
  const absenceSite = absenceHistory.at(-1) ?? null;
  const field = {
    kind: 'attention-field',
    sites,
    absenceHistory,
    absenceSite,
    nextWitness,
    returnAxis: last ? normalizeEvent(last, memory.length - 1).angle : 0,
    signature: ''
  };
  field.signature = JSON.stringify({ sites: field.sites, absenceHistory, absenceSite, nextWitness, returnAxis: field.returnAxis });
  return field;
};

const normalizeMemory = (memory = []) => (Array.isArray(memory) ? memory : []).slice(-MEMORY_LIMIT).map((event, index) => normalizeEvent(event, index));

const frameFrom = (memory, lastAction = 'quiet', gesture = null, event = null) => {
  const normalizedMemory = normalizeMemory(memory);
  return {
    grammar: 'reciprocal-absence',
    renderer: 'deterministic Canvas 2D attention field with WebGPU capability signal',
    stage: normalizedMemory.length,
    memory: normalizedMemory,
    field: buildField(normalizedMemory),
    gesture: cloneGesture(gesture),
    event,
    lastAction
  };
};

export const buildFrame = (memory = []) => frameFrom(memory);
export const geometrySignature = (frame) => frame?.field?.signature ?? '';

export const attendAt = (frame, site) => {
  if (!frame || frame.memory.length >= MEMORY_LIMIT) return frameFrom(frame?.memory ?? [], 'attention-refused-memory-limit', frame?.gesture ?? null);
  const normalizedSite = normalizeSite(site, 0);
  if (frame.gesture?.entry === normalizedSite) return frameFrom(frame.memory, 'attention-refused-repeat', frame.gesture);
  if (frame.gesture) return frameFrom(frame.memory, 'attention-refused-active-gaze', frame.gesture);
  if (normalizedSite !== frame.field.nextWitness) return frameFrom(frame.memory, 'attention-refused-witness');
  return frameFrom(frame.memory, 'attention-held', { entry: normalizedSite });
};

export const withdrawAt = (frame, reply) => {
  if (!frame?.gesture) return frameFrom(frame?.memory ?? [], 'attention-refused-no-gaze');
  const normalizedReply = normalizeSite(reply, 0);
  if (normalizedReply === frame.gesture.entry) return frameFrom(frame.memory, 'attention-refused-no-return', frame.gesture);
  const expected = expectedReplyFor(frame.gesture.entry, frame.memory.length);
  if (normalizedReply !== expected) return frameFrom(frame.memory, 'attention-refused-reply', frame.gesture);
  const event = normalizeEvent({ entry: frame.gesture.entry, reply: normalizedReply, reason: 'pointer-withdrawal' }, frame.memory.length);
  return frameFrom([...frame.memory, event], 'attention-returned', null, event);
};

export const defaultAttention = (frame) => {
  const entry = frame?.field?.nextWitness ?? 3;
  return { entry, reply: expectedReplyFor(entry, frame?.memory?.length ?? 0) };
};

export const commitDefaultAttention = (frame) => {
  const attention = defaultAttention(frame);
  const armed = attendAt(frame, attention.entry);
  return withdrawAt(armed, attention.reply);
};

export const liftLatest = (frame) => frameFrom((frame?.memory ?? []).slice(0, -1), 'attention-lifted', null, { type: 'attention-lifted' });
export const releaseAttention = () => frameFrom([], 'attention-released');

export const buildTimeline = () => {
  const timeline = [buildFrame()];
  for (let serial = 0; serial < MEMORY_LIMIT; serial += 1) timeline.push(commitDefaultAttention(timeline.at(-1)));
  return timeline;
};
