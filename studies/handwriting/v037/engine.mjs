export const SEED = '0x48574937';
export const MODE = 'pressure-seam';
export const MEMORY_WINDOW = 4;
export const MIN_SWEEP = 0.22;
export const MAX_SWEEP = 0.92;
export const GLYPH_COUNT = 32;

const LETTER_STREAM = 'THE LINE BREAKS / PRESSURE TURNS';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value) => Math.round(value * 10000) / 10000;
const clone = (value) => JSON.parse(JSON.stringify(value));
const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

function makeGlyphs() {
  return Array.from(LETTER_STREAM).map((char, id, chars) => {
    const t = id / Math.max(1, chars.length - 1);
    const bend = Math.sin(t * Math.PI * 2.15 - 0.45) * 0.19;
    const fold = Math.sin(t * Math.PI * 4.3 + 0.4) * 0.045;
    return {
      id,
      char,
      x: round(-0.88 + t * 1.76),
      y: round(bend + fold - 0.02),
      rotation: round(Math.cos(t * Math.PI * 2.15 - 0.45) * 0.18),
      size: round(char === ' ' ? 0.56 : (0.9 + ((id * 7) % 5) * 0.08)),
      tracking: round(char === ' ' ? 0.72 : 0.06 + ((id * 3) % 4) * 0.018),
      opacity: char === ' ' ? 0 : 1,
      mode: char === ' ' ? 'space' : 'solid',
      event: 0
    };
  });
}

function signatureFor(glyphs, cuts) {
  return JSON.stringify({
    glyphs: glyphs.map(({ id, char, x, y, rotation, size, tracking, opacity, mode, event }) => ({ id, char, x, y, rotation, size, tracking, opacity, mode, event })),
    cuts: cuts.map(({ hinge, direction, depth, event }) => ({ hinge, direction, depth, event }))
  });
}

function rebuildField(glyphs, cuts) {
  return {
    kind: 'sentence-seam',
    seam: 'folded-baseline',
    glyphCount: glyphs.length,
    cuts: clone(cuts),
    signature: signatureFor(glyphs, cuts)
  };
}

function baselineFrame() {
  const glyphs = makeGlyphs();
  const cuts = [];
  return {
    mode: MODE,
    glyphs,
    field: rebuildField(glyphs, cuts),
    history: [],
    memory: [],
    cuts,
    pressure: 0,
    active: null,
    probe: null,
    changedGlyphIds: [],
    lastEvent: 'quiet'
  };
}

function nearestLetter(glyphs, x) {
  return glyphs
    .filter((glyph) => glyph.char.trim())
    .map((glyph) => ({ glyph, distance: Math.abs(glyph.x - x) }))
    .sort((a, b) => a.distance - b.distance || a.glyph.id - b.glyph.id)[0]?.glyph.id ?? 0;
}

function applyPressureCut(frame, event) {
  const glyphs = clone(frame.glyphs);
  const cuts = clone(frame.cuts);
  const eventIndex = frame.history.length + 1;
  const sweep = clamp(distance(event.start, event.end), MIN_SWEEP, MAX_SWEEP);
  const direction = event.end.y - event.start.y >= 0 ? 1 : -1;
  const hinge = nearestLetter(glyphs, (event.start.x + event.end.x) * 0.5);
  const candidates = glyphs.filter((glyph) => glyph.char.trim()).map((glyph) => glyph.id);
  const hingePosition = candidates.indexOf(hinge);
  const split = [
    hinge,
    candidates[(hingePosition + 1) % candidates.length],
    candidates[(hingePosition + 2) % candidates.length]
  ];
  const [hingeGlyph, hollowGlyph, driftGlyph] = split.map((id) => glyphs[id]);
  const force = round(clamp(sweep / MAX_SWEEP, 0.25, 1));

  hingeGlyph.mode = 'cut';
  hingeGlyph.opacity = round(clamp(hingeGlyph.opacity - 0.16 * force, 0.42, 1));
  hingeGlyph.rotation = round(hingeGlyph.rotation + direction * (0.1 + force * 0.12));
  hingeGlyph.y = round(hingeGlyph.y + direction * (0.05 + force * 0.06));
  hingeGlyph.event = eventIndex;

  hollowGlyph.mode = 'hollow';
  hollowGlyph.size = round(clamp(hollowGlyph.size * (1.08 + force * 0.1), 0.72, 1.55));
  hollowGlyph.tracking = round(hollowGlyph.tracking + 0.08 + force * 0.08);
  hollowGlyph.rotation = round(hollowGlyph.rotation - direction * (0.14 + force * 0.09));
  hollowGlyph.x = round(clamp(hollowGlyph.x + direction * (0.045 + force * 0.035), -0.94, 0.94));
  hollowGlyph.event = eventIndex;

  driftGlyph.mode = 'drift';
  driftGlyph.x = round(clamp(driftGlyph.x - direction * (0.07 + force * 0.08), -0.94, 0.94));
  driftGlyph.y = round(clamp(driftGlyph.y - 0.035 + direction * 0.03, -0.86, 0.86));
  driftGlyph.size = round(clamp(driftGlyph.size * (0.94 + force * 0.06), 0.6, 1.5));
  driftGlyph.rotation = round(driftGlyph.rotation + direction * 0.16);
  driftGlyph.event = eventIndex;

  const cut = {
    hinge,
    direction,
    depth: force,
    event: eventIndex
  };
  cuts.push(cut);
  const history = [...frame.history, {
    mode: MODE === 'pressure-seam' ? 'pressure-cut' : MODE,
    hinge,
    changedGlyphIds: split,
    direction,
    pressure: force,
    sweep: round(sweep),
    start: clone(event.start),
    end: clone(event.end),
    eventIndex
  }];
  return {
    ...frame,
    glyphs,
    cuts,
    field: rebuildField(glyphs, cuts),
    history,
    memory: history.slice(-MEMORY_WINDOW),
    pressure: 0,
    active: null,
    probe: null,
    changedGlyphIds: [...split].sort((a, b) => a - b),
    lastEvent: 'cut'
  };
}

export function buildFrame(events = []) {
  let frame = baselineFrame();
  for (const event of events) {
    const start = event.start ?? { x: -0.35, y: 0.72 };
    const end = event.end ?? { x: start.x + MIN_SWEEP, y: start.y };
    frame = finishPressure(beginPressure(frame, { ...start, at: 0 }), { ...end, at: 500 });
  }
  return frame;
}

export function buildTimeline(count = MEMORY_WINDOW) {
  const starts = [-0.68, -0.28, 0.18, 0.56, 0.78];
  const directions = [1, -1, 1, -1, 1];
  const timeline = [buildFrame()];
  for (let index = 0; index < count; index += 1) {
    const start = { x: starts[index % starts.length], y: 0.68, at: 0 };
    const end = { x: start.x + 0.34, y: start.y + directions[index % directions.length] * 0.08, at: 500 };
    timeline.push(finishPressure(beginPressure(timeline.at(-1), start), end));
  }
  return timeline;
}

export function beginPressure(frame, point) {
  return {
    ...frame,
    active: { x: point.x, y: point.y, at: point.at ?? 0 },
    probe: { start: { x: point.x, y: point.y }, end: { x: point.x, y: point.y }, sweep: 0 },
    pressure: 0,
    lastEvent: 'charging'
  };
}

export function movePressure(frame, point) {
  if (!frame.active) return { ...frame, lastEvent: 'refused' };
  const probe = {
    start: { x: frame.active.x, y: frame.active.y },
    end: { x: point.x, y: point.y },
    sweep: round(distance(frame.active, point))
  };
  return {
    ...frame,
    probe,
    pressure: round(clamp(probe.sweep / MAX_SWEEP, 0, 1)),
    lastEvent: 'charging'
  };
}

export function finishPressure(frame, point) {
  if (!frame.active) return { ...frame, lastEvent: 'refused' };
  const next = movePressure(frame, point);
  const sweep = next.probe?.sweep ?? 0;
  if (sweep < MIN_SWEEP || sweep > MAX_SWEEP) {
    return { ...frame, active: null, probe: null, pressure: 0, lastEvent: 'refused' };
  }
  return applyPressureCut(next, { start: next.probe.start, end: next.probe.end });
}

export function liftLatest(frame) {
  if (!frame.history.length) return { ...frame, lastEvent: 'refused' };
  return { ...buildFrame(frame.history.slice(0, -1)), lastEvent: 'lifted' };
}

export function release() {
  return baselineFrame();
}

export function geometrySignature(frame) {
  return frame.field.signature;
}

export function geometryChanged(a, b) {
  return geometrySignature(a) !== geometrySignature(b);
}
