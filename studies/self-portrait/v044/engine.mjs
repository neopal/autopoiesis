export const PANEL_COUNT = 11;
export const MEMORY_LIMIT = 4;
export const CHOICE_LIMIT = 3;
export const SEED = 0x503044;

const LAYOUT = [
  [-0.62, -0.08, 0.078, 0.57, -0.08],
  [-0.48, 0.12, 0.082, 0.72, 0.06],
  [-0.34, -0.18, 0.074, 0.48, -0.04],
  [-0.19, 0.07, 0.088, 0.64, 0.1],
  [-0.04, -0.12, 0.076, 0.54, -0.06],
  [0.11, 0.02, 0.09, 0.77, 0.05],
  [0.27, -0.16, 0.08, 0.52, -0.08],
  [0.41, 0.1, 0.084, 0.67, 0.08],
  [0.55, -0.09, 0.076, 0.57, -0.05],
  [0.67, 0.13, 0.065, 0.44, 0.11],
  [0.0, 0.35, 0.072, 0.38, -0.12]
];

const clone = (value) => JSON.parse(JSON.stringify(value));
const rounded = (value) => Number(Number(value).toFixed(6));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function seeded(index) {
  const value = Math.sin((index + 1) * 29.173 + SEED) * 43758.5453;
  return value - Math.floor(value);
}

function createPanel(index) {
  const [x, y, width, height, lean] = LAYOUT[index];
  return {
    index,
    x: rounded(x + (seeded(index + 7) - 0.5) * 0.018),
    y: rounded(y + (seeded(index + 17) - 0.5) * 0.02),
    width: rounded(width * (0.94 + seeded(index + 27) * 0.1)),
    height: rounded(height * (0.94 + seeded(index + 37) * 0.1)),
    lean: rounded(lean + (seeded(index + 47) - 0.5) * 0.08),
    seams: 1 + Math.floor(seeded(index + 57) * 2),
    notch: rounded(0.18 + seeded(index + 67) * 0.64),
    phase: rounded(seeded(index + 77)),
    tone: index % 4,
    state: 'quiet'
  };
}

export function buildField() {
  return {
    composition: 'refusal-register',
    renderer: 'p5-canvas',
    revision: 0,
    panels: Array.from({ length: PANEL_COUNT }, (_, index) => createPanel(index)),
    choices: [],
    memory: [],
    snapshots: [],
    interaction: 'quiet register'
  };
}

export function geometrySignature(field) {
  return JSON.stringify({
    composition: field.composition,
    revision: field.revision,
    panels: field.panels.map((panel) => ({
      index: panel.index,
      x: panel.x,
      y: panel.y,
      width: panel.width,
      height: panel.height,
      lean: panel.lean,
      seams: panel.seams,
      notch: panel.notch,
      phase: panel.phase,
      tone: panel.tone,
      state: panel.state
    }))
  });
}

function safePanel(panel) {
  return clamp(Math.floor(Number(panel) || 0), 0, PANEL_COUNT - 1);
}

function safeSide(side) {
  return side === 'right' ? 'right' : 'left';
}

export function choosePanel(field, panel, side) {
  const next = clone(field);
  const safe = safePanel(panel);
  const choice = { panel: safe, side: safeSide(side) };
  const existing = next.choices.findIndex((entry) => entry.panel === safe);
  if (existing >= 0) next.choices[existing] = choice;
  else next.choices = [...next.choices, choice].slice(-CHOICE_LIMIT);
  next.interaction = 'choice held';
  return next;
}

function chooseReceiver(sources, revision) {
  let receiver = (sources.reduce((sum, source) => sum + source, 0) + revision * 4) % PANEL_COUNT;
  if (sources.includes(receiver)) receiver = (receiver + 1) % PANEL_COUNT;
  if (sources.includes(receiver)) receiver = (receiver + 1) % PANEL_COUNT;
  return receiver;
}

function splitPanel(panel, sides, revision) {
  const bias = sides.filter((side) => side === 'right').length - sides.filter((side) => side === 'left').length;
  const direction = bias >= 0 ? 1 : -1;
  const intensity = 0.15 + Math.abs(bias) * 0.06 + revision * 0.018;
  return {
    ...panel,
    x: rounded(panel.x + direction * intensity * 0.18),
    y: rounded(panel.y - intensity * 0.08),
    width: rounded(clamp(panel.width * (1 + intensity * 0.2), 0.05, 0.16)),
    height: rounded(clamp(panel.height * (1 - intensity * 0.05), 0.22, 0.82)),
    lean: rounded(panel.lean + direction * (0.16 + revision * 0.025)),
    seams: panel.seams + 2 + (revision % 2),
    notch: rounded((panel.notch + direction * 0.14 + 1) % 1),
    phase: rounded((panel.phase + 0.16 + revision * 0.07) % 1),
    state: 'split'
  };
}

export function commitContradiction(field) {
  if (field.choices.length < CHOICE_LIMIT) {
    return {
      accepted: false,
      field: { ...clone(field), interaction: 'refused / incomplete' },
      event: null
    };
  }
  const sides = field.choices.map((choice) => choice.side);
  if (new Set(sides).size < 2) {
    return {
      accepted: false,
      field: { ...clone(field), interaction: 'refused / agreement' },
      event: null
    };
  }

  const next = clone(field);
  const revision = field.revision + 1;
  const sources = field.choices.map((choice) => choice.panel);
  const receiver = chooseReceiver(sources, revision);
  const event = {
    kind: 'contradiction-split',
    relation: 'decision-remembered-elsewhere',
    sources,
    sides,
    receiver,
    revision
  };

  next.revision = revision;
  next.panels[receiver] = splitPanel(field.panels[receiver], sides, revision);
  next.snapshots = [...field.snapshots, clone(field)].slice(-MEMORY_LIMIT);
  next.memory = [...field.memory, event].slice(-MEMORY_LIMIT);
  next.choices = [];
  next.interaction = 'split / elsewhere';
  return { accepted: true, field: next, event };
}

export function liftLatest(field) {
  if (!field.snapshots.length) return { ...clone(field), interaction: 'lifted / exact' };
  return { ...clone(field.snapshots.at(-1)), interaction: 'lifted / exact' };
}

export function releaseField() {
  return buildField();
}

export function buildTimeline() {
  let field = buildField();
  const decisions = [
    [{ panel: 1, side: 'left' }, { panel: 4, side: 'right' }, { panel: 8, side: 'left' }],
    [{ panel: 0, side: 'right' }, { panel: 3, side: 'left' }, { panel: 9, side: 'right' }],
    [{ panel: 2, side: 'left' }, { panel: 5, side: 'left' }, { panel: 7, side: 'right' }],
    [{ panel: 4, side: 'right' }, { panel: 6, side: 'left' }, { panel: 10, side: 'right' }]
  ];
  const timeline = [field];
  for (const decision of decisions) {
    for (const choice of decision) field = choosePanel(field, choice.panel, choice.side);
    field = commitContradiction(field).field;
    timeline.push(field);
  }
  return timeline;
}
