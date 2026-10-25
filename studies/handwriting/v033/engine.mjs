const GLYPHS = ['W', 'E', 'I', 'G', 'H', 'T', 'S', 'H', 'I', 'F', 'T'];
const BASE_LAYOUT = [
  [0.13, 0.47, -7, 1.04],
  [0.205, 0.39, 5, 0.88],
  [0.285, 0.51, -3, 1.14],
  [0.365, 0.42, 6, 0.84],
  [0.445, 0.54, -6, 1.08],
  [0.525, 0.43, 4, 0.92],
  [0.61, 0.5, -5, 1.12],
  [0.69, 0.4, 7, 0.86],
  [0.77, 0.52, -4, 1.02],
  [0.845, 0.43, 5, 0.9],
  [0.92, 0.49, -6, 1.02]
];
const BASE_WELLS = [
  [0.16, 0.72],
  [0.32, 0.75],
  [0.48, 0.71],
  [0.65, 0.75],
  [0.82, 0.71]
];

export const GLYPH_COUNT = GLYPHS.length;
export const WELL_COUNT = BASE_WELLS.length;
export const GAP_LENGTH = 2;
export const MEMORY_WINDOW = 4;

const round = (value, digits = 5) => Number(value.toFixed(digits));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function makeGlyph(index) {
  const [x, y, rotation, scale] = BASE_LAYOUT[index];
  return {
    id: index,
    glyph: GLYPHS[index],
    x,
    y,
    rotation,
    scale,
    weight: 0.58,
    shear: 0,
    blank: false,
    role: 'quiet',
    inheritedFrom: null
  };
}

function makeWell(index) {
  const [x, y] = BASE_WELLS[index];
  return { id: index, x, y, role: 'negative' };
}

function cloneGlyph(glyph) { return { ...glyph }; }
function cloneWell(well) { return { ...well }; }
function cloneFold(fold) { return { ...fold, wells: [...fold.wells], changedGlyphIds: [...fold.changedGlyphIds] }; }
function cloneEvent(event) { return { ...event, wells: [...event.wells], roles: { ...event.roles }, changedGlyphIds: [...event.changedGlyphIds], fold: cloneFold(event.fold) }; }

function cloneFrame(frame) {
  return {
    ...frame,
    glyphs: frame.glyphs.map(cloneGlyph),
    wells: frame.wells.map(cloneWell),
    span: [...frame.span],
    history: frame.history.map(cloneEvent),
    memory: frame.memory.map(cloneEvent),
    folds: frame.folds.map(cloneFold),
    changedGlyphIds: [...frame.changedGlyphIds]
  };
}

function refresh(frame) {
  frame.memory = frame.history.slice(-MEMORY_WINDOW).map(cloneEvent);
  frame.folds = frame.history.map((event) => cloneFold(event.fold));
  frame.changedGlyphIds = frame.history.at(-1)?.changedGlyphIds ? [...frame.history.at(-1).changedGlyphIds] : [];
  return frame;
}

function uniqueRoles(a, b, serial) {
  const taken = new Set();
  const pick = (seed) => {
    let id = ((seed % GLYPH_COUNT) + GLYPH_COUNT) % GLYPH_COUNT;
    while (taken.has(id) || id === a || id === b) id = (id + 1) % GLYPH_COUNT;
    taken.add(id);
    return id;
  };
  return {
    inheritance: pick(a * 3 + b + serial),
    counterform: pick(b * 4 + serial * 2),
    hinge: pick(a + b * 2 + serial * 3),
    recoil: pick(a * 5 + b * 3 + serial * 4),
    echo: pick(b * 2 + a * 7 + serial * 5)
  };
}

function applyCommitted(frame, wells, serial) {
  const [from, to] = wells;
  const left = Math.min(from, to);
  const right = Math.max(from, to);
  const span = right - left;
  const center = (left + right) / (WELL_COUNT - 1) / 2;
  const pressure = round(0.22 + span * 0.045 + serial * 0.018);
  const direction = from < to ? 1 : -1;
  const roles = uniqueRoles(from, to, serial);
  const previousGlyphs = frame.glyphs.map(cloneGlyph);

  frame.glyphs.forEach((glyph, index) => {
    const normalized = index / (GLYPH_COUNT - 1);
    const distance = Math.abs(normalized - center);
    const influence = clamp(1 - distance * 1.65, 0.16, 1);
    const wave = Math.sin((index + 1) * (center * 4.2 + serial * 0.31));
    glyph.x = round(clamp(glyph.x + direction * wave * pressure * 0.022 * influence, 0.07, 0.95));
    glyph.y = round(clamp(glyph.y + direction * (0.032 + wave * 0.022) * pressure * influence, 0.27, 0.67));
    glyph.rotation = round(glyph.rotation + direction * (wave * 3.5 + influence * 1.2) * pressure);
    glyph.scale = round(clamp(glyph.scale + wave * 0.034 * pressure + direction * 0.012 * influence, 0.62, 1.36));
    glyph.shear = round(clamp(glyph.shear + direction * wave * 4.2 * pressure, -11, 11));
    glyph.weight = round(clamp(glyph.weight + Math.abs(wave) * 0.018 * pressure, 0.38, 0.96));
    glyph.role = 'quiet';
  });

  const inheritance = frame.glyphs[roles.inheritance];
  const source = previousGlyphs[(roles.inheritance + direction + GLYPH_COUNT) % GLYPH_COUNT];
  inheritance.glyph = source.glyph;
  inheritance.inheritedFrom = source.id;
  inheritance.scale = round(clamp(inheritance.scale + 0.11 + pressure * 0.2, 0.62, 1.42));
  inheritance.weight = round(clamp(inheritance.weight + 0.12, 0.38, 0.96));
  inheritance.role = 'inheritance';

  const counterform = frame.glyphs[roles.counterform];
  counterform.glyph = '';
  counterform.blank = true;
  counterform.scale = round(clamp(counterform.scale + 0.04, 0.62, 1.36));
  counterform.rotation = round(counterform.rotation + direction * 5.5);
  counterform.role = 'counterform';

  const hinge = frame.glyphs[roles.hinge];
  hinge.y = round(clamp(hinge.y - direction * (0.04 + pressure * 0.05), 0.23, 0.7));
  hinge.rotation = round(hinge.rotation + direction * (9 + serial * 1.2));
  hinge.shear = round(clamp(hinge.shear + direction * 4.5, -11, 11));
  hinge.role = 'hinge';

  const recoil = frame.glyphs[roles.recoil];
  recoil.x = round(clamp(recoil.x - direction * (0.025 + pressure * 0.04), 0.06, 0.95));
  recoil.scale = round(clamp(recoil.scale - 0.08, 0.62, 1.36));
  recoil.role = 'recoil';

  const echo = frame.glyphs[roles.echo];
  echo.rotation = round(echo.rotation + direction * 6);
  echo.weight = round(clamp(echo.weight + 0.09, 0.38, 0.96));
  echo.role = 'echo';

  const fold = {
    wells: [from, to],
    center: round(center),
    pressure,
    direction,
    serial,
    changedGlyphIds: [roles.inheritance, roles.counterform, roles.hinge, roles.recoil, roles.echo]
  };
  const event = {
    wells: [from, to],
    serial,
    pressure,
    direction,
    roles,
    changedGlyphIds: [...fold.changedGlyphIds],
    fold
  };
  frame.history.push(event);
  frame.span = [];
  frame.lastEvent = 'fold';
  return refresh(frame);
}

export function buildFrame(events = []) {
  const frame = {
    glyphs: Array.from({ length: GLYPH_COUNT }, (_, index) => makeGlyph(index)),
    wells: Array.from({ length: WELL_COUNT }, (_, index) => makeWell(index)),
    span: [],
    history: [],
    memory: [],
    folds: [],
    changedGlyphIds: [],
    lastEvent: 'quiet'
  };
  refresh(frame);
  for (const rawEvent of events) {
    const wells = Array.isArray(rawEvent) ? rawEvent : rawEvent?.wells;
    if (!Array.isArray(wells) || wells.length !== GAP_LENGTH || new Set(wells).size !== GAP_LENGTH || Math.abs(wells[0] - wells[1]) < GAP_LENGTH) continue;
    applyCommitted(frame, wells, frame.history.length + 1);
  }
  frame.span = [];
  frame.lastEvent = events.length ? 'fold' : 'quiet';
  return refresh(frame);
}

export function loadWell(frame, wellId) {
  const next = cloneFrame(frame);
  if (!Number.isInteger(wellId) || wellId < 0 || wellId >= WELL_COUNT || next.span.includes(wellId) || next.span.length >= GAP_LENGTH) {
    next.lastEvent = 'refused';
    return next;
  }
  next.span.push(wellId);
  next.lastEvent = 'loading';
  return next;
}

export function commitSpan(frame) {
  const next = cloneFrame(frame);
  if (next.span.length !== GAP_LENGTH || new Set(next.span).size !== GAP_LENGTH || Math.abs(next.span[0] - next.span[1]) < GAP_LENGTH) {
    next.span = [];
    next.lastEvent = 'refused';
    return next;
  }
  return applyCommitted(next, next.span, next.history.length + 1);
}

export function liftLatestSpan(frame) {
  if (frame.history.length === 0) {
    const next = cloneFrame(frame);
    next.span = [];
    next.lastEvent = 'lifted';
    return next;
  }
  const prior = buildFrame(frame.history.slice(0, -1));
  prior.lastEvent = 'lifted';
  return prior;
}

export function releaseSpan() {
  const frame = buildFrame([]);
  frame.lastEvent = 'released';
  return frame;
}

export function nearestWell(points, point, maxDistance) {
  let nearest = -1;
  let distance = Number.POSITIVE_INFINITY;
  for (const candidate of points) {
    const next = ((point.x - candidate.x) ** 2) + ((point.y - candidate.y) ** 2);
    if (next < distance) {
      distance = next;
      nearest = candidate.id;
    }
  }
  return distance <= maxDistance ** 2 ? nearest : -1;
}

export function geometrySignature(frame) {
  return JSON.stringify({
    glyphs: frame.glyphs.map((glyph) => [
      glyph.id,
      glyph.glyph,
      round(glyph.x),
      round(glyph.y),
      round(glyph.rotation),
      round(glyph.scale),
      round(glyph.weight),
      round(glyph.shear),
      glyph.blank,
      glyph.role,
      glyph.inheritedFrom
    ]),
    folds: frame.folds.map((fold) => [fold.wells, round(fold.center), round(fold.pressure), fold.direction])
  });
}
