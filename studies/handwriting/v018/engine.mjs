export const STAGES = 13;
export const MEMORY_WINDOW = 5;
const VIEWBOX = { width: 1200, height: 760 };
const LINE_COUNT = 5;
const X_MIN = 0.12;
const X_MAX = 0.88;
const Y_MIN = 0.16;
const Y_MAX = 0.84;

const BASE_LINES = [
  { text: 'MATTER', x: 0.12, baseline: 0.22, size: 156, rotation: -0.022 },
  { text: 'LEAVES', x: 0.26, baseline: 0.37, size: 128, rotation: 0.018 },
  { text: 'A COUNTER', x: 0.10, baseline: 0.51, size: 116, rotation: -0.014 },
  { text: 'IN THE', x: 0.43, baseline: 0.66, size: 132, rotation: 0.026 },
  { text: 'SENTENCE', x: 0.16, baseline: 0.82, size: 122, rotation: -0.018 }
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value, digits = 6) => Number(Number(value).toFixed(digits));

function rng(seed) {
  return () => {
    seed += 0x6d2b79f5;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function copyLine(line) {
  return { ...line };
}

function normalizePressure(entry, index = 0, stage = 0) {
  const rawX = Number(entry?.x);
  const rawY = Number(entry?.y);
  const x = Number.isFinite(rawX) ? rawX : 0.5;
  const y = Number.isFinite(rawY) ? rawY : 0.5;
  return {
    id: String(entry?.id ?? `pressure-${stage}-${index}`),
    kind: 'hold-pressure',
    stage: Math.max(0, Math.floor(Number(entry?.stage) || stage)),
    x: round(clamp(x, X_MIN, X_MAX), 4),
    y: round(clamp(y, Y_MIN, Y_MAX), 4),
    lineIndex: Math.max(0, Math.min(LINE_COUNT - 1, Math.floor(Number(entry?.lineIndex) || 0))),
    pressure: round(clamp(Number(entry?.pressure) || 0.78, 0.48, 1), 4),
    phase: round(Number(entry?.phase) || 0, 6)
  };
}

function baseLines(stage) {
  const random = rng(0x48574818 + stage * 65537);
  return BASE_LINES.map((line, index) => ({
    ...line,
    id: `line-${index}`,
    x: round(line.x + (random() - 0.5) * 0.018),
    baseline: round(line.baseline + (random() - 0.5) * 0.008),
    rotation: round(line.rotation + (random() - 0.5) * 0.012),
    tracking: round(-0.035 + random() * 0.014),
    pressureDebt: 0,
    state: 'dry'
  }));
}

function lineForPoint(point) {
  const y = clamp(Number(point?.y) || 0.5, Y_MIN, Y_MAX);
  return Math.max(0, Math.min(LINE_COUNT - 1, Math.round((y - 0.22) / 0.15)));
}

function aperturePath(line, event, eventIndex) {
  const cx = clamp(event.x, X_MIN, X_MAX) * VIEWBOX.width;
  const cy = line.baseline * VIEWBOX.height;
  const width = 54 + event.pressure * 42 + (eventIndex % 2) * 18;
  const height = 78 + event.pressure * 36;
  const left = cx - width / 2;
  const right = cx + width / 2;
  const top = cy - height * 0.7;
  const bottom = cy + height * 0.28;
  const nick = width * 0.22;
  return [
    `M ${round(left)} ${round(top)}`,
    `L ${round(cx - nick)} ${round(top)}`,
    `L ${round(cx - nick * 0.32)} ${round(top + height * 0.28)}`,
    `L ${round(right)} ${round(top + height * 0.18)}`,
    `L ${round(right - nick * 0.4)} ${round(bottom)}`,
    `L ${round(cx + nick * 0.08)} ${round(bottom)}`,
    `L ${round(cx - nick * 0.28)} ${round(bottom - height * 0.24)}`,
    `L ${round(left)} ${round(bottom - height * 0.12)}`,
    'Z'
  ].join(' ');
}

function applyEvent(lines, perforations, pressureEvents, event, eventIndex) {
  const source = lines[event.lineIndex];
  const downstreamIndex = (event.lineIndex + 2 + eventIndex) % LINE_COUNT;
  const downstream = lines[downstreamIndex];
  const amount = event.pressure * (0.012 + eventIndex * 0.002);
  source.tracking = round(source.tracking + 0.018 * event.pressure);
  source.baseline = round(source.baseline - 0.006 * event.pressure);
  source.pressureDebt = round(source.pressureDebt + event.pressure);
  source.state = 'punched';
  downstream.baseline = round(clamp(downstream.baseline + 0.018 * event.pressure, 0.12, 0.9));
  downstream.x = round(clamp(downstream.x + (eventIndex % 2 ? -amount : amount), 0.06, 0.76));
  downstream.tracking = round(downstream.tracking - 0.011 * event.pressure);
  downstream.pressureDebt = round(downstream.pressureDebt + event.pressure * 0.55);
  downstream.state = downstream.state === 'punched' ? 'punched' : 'rerouted';
  perforations.push({
    id: `aperture-${event.id}`,
    kind: 'counter-aperture',
    lineIndex: event.lineIndex,
    x: event.x,
    y: round(source.baseline),
    width: round(0.06 + event.pressure * 0.04),
    height: round(0.12 + event.pressure * 0.05),
    path: aperturePath(source, event, eventIndex)
  });
  pressureEvents.push({
    id: `event-${event.id}`,
    sourceLine: event.lineIndex,
    downstreamLine: downstreamIndex,
    pressure: event.pressure,
    phase: event.phase
  });
}

function makeStagePressure(stage) {
  if (stage <= 0) return null;
  const lineIndex = (stage * 2 + 1) % LINE_COUNT;
  return normalizePressure({
    id: `stage-${stage}-pressure`,
    stage,
    lineIndex,
    x: 0.2 + ((stage * 0.137) % 0.62),
    y: BASE_LINES[lineIndex].baseline,
    pressure: 0.56 + (stage % 4) * 0.09,
    phase: stage * 0.73
  }, 0, stage);
}

export function buildFrame(targetStage, memory = []) {
  const stage = Math.max(0, Math.min(STAGES - 1, Math.floor(Number(targetStage) || 0)));
  const lines = baseLines(stage);
  const stableMemory = memory.map((entry, index) => normalizePressure(entry, index, stage)).slice(-MEMORY_WINDOW);
  const perforations = [];
  const pressureEvents = [];
  stableMemory.forEach((event, index) => applyEvent(lines, perforations, pressureEvents, event, index));
  const nextPressure = makeStagePressure(stage);
  return {
    stage,
    lines: lines.map(copyLine),
    perforations: perforations.map((entry) => ({ ...entry })),
    pressureEvents: pressureEvents.map((entry) => ({ ...entry })),
    memory: stableMemory,
    accepted: true,
    previousMemory: null,
    newPressures: nextPressure ? [nextPressure] : [],
    perforationCount: perforations.length,
    reroutedCount: lines.filter((line) => line.state === 'rerouted').length,
    punchedLineCount: lines.filter((line) => line.state === 'punched').length,
    totalPressure: round(stableMemory.reduce((sum, event) => sum + event.pressure, 0))
  };
}

export function buildTimeline(finalStage = STAGES - 1) {
  let memory = [];
  const frames = [];
  for (let stage = 0; stage <= Math.min(STAGES - 1, Math.max(0, Math.floor(finalStage))); stage += 1) {
    const frame = buildFrame(stage, memory);
    frames.push(frame);
    memory = [...memory, ...frame.newPressures].slice(-MEMORY_WINDOW);
  }
  return frames;
}

export function applyPressure(frame, point) {
  const x = round(clamp(Number(point?.x) || 0.5, X_MIN, X_MAX), 4);
  const y = round(clamp(Number(point?.y) || 0.5, Y_MIN, Y_MAX), 4);
  const event = normalizePressure({
    id: `visitor-pressure-${frame.stage}-${frame.memory.length}`,
    stage: frame.stage,
    x,
    y,
    lineIndex: lineForPoint({ y }),
    pressure: 0.78 + (lineForPoint({ y }) % 3) * 0.06,
    phase: x * 11.3 + y * 7.4
  }, frame.memory.length, frame.stage);
  const next = buildFrame(frame.stage, [...frame.memory, event]);
  next.previousMemory = frame.memory.map((entry) => ({ ...entry }));
  return next;
}

export function removeLatestPressure(frame) {
  const previousMemory = Array.isArray(frame.previousMemory)
    ? frame.previousMemory
    : frame.memory.slice(0, -1);
  return buildFrame(frame.stage, previousMemory);
}

export const constants = {
  lineCount: LINE_COUNT,
  memoryWindow: MEMORY_WINDOW,
  finalStage: STAGES - 1,
  viewBox: VIEWBOX,
  bounds: { xMin: X_MIN, xMax: X_MAX, yMin: Y_MIN, yMax: Y_MAX },
  phrase: BASE_LINES.map((line) => line.text).join(' / ')
};
