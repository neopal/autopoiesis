export const PANEL_COUNT = 9;
export const MEMORY_WINDOW = 4;
export const MODE = 'attention-fugue';

const BASE_PANELS = [
  { id: 0, x: 0.07, y: 0.08, width: 0.25, height: 0.28, angle: -7, scale: 1, writing: 'horizontal', order: 'forward', leading: 1, tracking: 0.02, response: 0, role: 'quiet' },
  { id: 1, x: 0.37, y: 0.05, width: 0.18, height: 0.42, angle: 4, scale: 0.96, writing: 'vertical', order: 'forward', leading: 0.92, tracking: 0.04, response: 0, role: 'quiet' },
  { id: 2, x: 0.65, y: 0.1, width: 0.27, height: 0.26, angle: 9, scale: 1.04, writing: 'horizontal', order: 'reverse', leading: 1.06, tracking: -0.01, response: 0, role: 'quiet' },
  { id: 3, x: 0.05, y: 0.48, width: 0.2, height: 0.3, angle: -3, scale: 0.9, writing: 'vertical', order: 'reverse', leading: 1.08, tracking: 0.01, response: 0, role: 'quiet' },
  { id: 4, x: 0.31, y: 0.46, width: 0.34, height: 0.2, angle: 3, scale: 1.08, writing: 'horizontal', order: 'forward', leading: 0.88, tracking: 0.03, response: 0, role: 'quiet' },
  { id: 5, x: 0.74, y: 0.45, width: 0.19, height: 0.33, angle: -8, scale: 0.94, writing: 'vertical', order: 'forward', leading: 0.98, tracking: 0.03, response: 0, role: 'quiet' },
  { id: 6, x: 0.13, y: 0.82, width: 0.24, height: 0.13, angle: 5, scale: 0.9, writing: 'horizontal', order: 'reverse', leading: 1, tracking: 0.05, response: 0, role: 'quiet' },
  { id: 7, x: 0.43, y: 0.76, width: 0.22, height: 0.18, angle: -5, scale: 0.98, writing: 'horizontal', order: 'forward', leading: 0.92, tracking: 0.02, response: 0, role: 'quiet' },
  { id: 8, x: 0.7, y: 0.8, width: 0.23, height: 0.13, angle: 6, scale: 1.02, writing: 'vertical', order: 'reverse', leading: 1.02, tracking: 0.04, response: 0, role: 'quiet' }
];

const clone = (value) => JSON.parse(JSON.stringify(value));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value) => Number(Number(value).toFixed(5));
const baseField = () => ({ panels: clone(BASE_PANELS) });
const withSignature = (field) => ({
  ...field,
  signature: JSON.stringify({
    panels: field.panels.map(({ id, x, y, width, height, angle, scale, writing, order, leading, tracking, response, role }) => ({ id, x, y, width, height, angle, scale, writing, order, leading, tracking, response, role }))
  })
});
const makeFrame = (field, memory = [], pending = [], history = memory, serial = 0, lastEvent = 'quiet', changedPanelIds = []) => ({
  field: withSignature(field), memory, history, pending, serial, lastEvent, changedPanelIds
});
const eventHash = (source, serial) => {
  let hash = 2166136261 ^ (source + 31) ^ serial;
  for (const value of [source, serial, source * 3 + serial]) hash = Math.imul(hash ^ (value + 17), 16777619) >>> 0;
  return hash >>> 0;
};
const pickRemote = (source, serial) => {
  const remote = [];
  let cursor = eventHash(source, serial) % PANEL_COUNT;
  while (remote.length < 2) {
    if (cursor !== source && !remote.includes(cursor)) remote.push(cursor);
    cursor = (cursor + 2 + remote.length) % PANEL_COUNT;
  }
  return remote;
};

export const buildFrame = () => makeFrame(baseField());

export const previewAttention = (frame, panelId) => {
  const id = Number(panelId);
  if (!Number.isInteger(id) || id < 0 || id >= PANEL_COUNT) return { ...frame, pending: [], lastEvent: 'refused attention', changedPanelIds: [] };
  return { ...frame, pending: [id], lastEvent: 'attention held', changedPanelIds: [] };
};

const applyEvent = (field, event) => {
  const next = clone(field);
  const remote = pickRemote(event.source, event.serial);
  const polarity = (event.source + event.serial) % 2 === 0 ? 1 : -1;
  remote.forEach((id, index) => {
    const panel = next.panels[id];
    const amount = 0.026 + ((event.serial + index) % 3) * 0.014;
    if (index === 0) {
      panel.writing = panel.writing === 'vertical' ? 'horizontal' : 'vertical';
      panel.order = panel.order === 'forward' ? 'reverse' : 'forward';
      panel.width = round(clamp(panel.width + polarity * amount, 0.12, 0.42));
      panel.height = round(clamp(panel.height - polarity * amount * 0.55, 0.1, 0.46));
      panel.angle = round(panel.angle + polarity * 7);
      panel.scale = round(clamp(panel.scale + 0.06, 0.74, 1.28));
      panel.leading = round(clamp(panel.leading - 0.08, 0.68, 1.26));
      panel.tracking = round(clamp(panel.tracking + 0.025, -0.08, 0.16));
      panel.role = 'reflowed';
    } else {
      panel.writing = panel.writing === 'horizontal' ? 'vertical' : 'horizontal';
      panel.order = panel.order === 'forward' ? 'reverse' : 'forward';
      panel.width = round(clamp(panel.width - polarity * amount * 0.65, 0.12, 0.42));
      panel.height = round(clamp(panel.height + polarity * amount * 0.8, 0.1, 0.46));
      panel.angle = round(panel.angle - polarity * 5);
      panel.scale = round(clamp(panel.scale - 0.035, 0.72, 1.22));
      panel.leading = round(clamp(panel.leading + 0.09, 0.68, 1.3));
      panel.tracking = round(clamp(panel.tracking - 0.018, -0.08, 0.16));
      panel.role = 'echoed';
    }
    panel.response += 1;
  });
  return { field: next, remote };
};

const replay = (history) => {
  let field = baseField();
  let changedPanelIds = [];
  for (const event of history) {
    const applied = applyEvent(field, event);
    field = applied.field;
    changedPanelIds = applied.remote;
  }
  return { field, changedPanelIds };
};

export const commitAttention = (frame) => {
  if (!frame.pending || frame.pending.length !== 1) return { ...frame, pending: [], lastEvent: 'refused attention', changedPanelIds: [] };
  const event = { source: frame.pending[0], serial: frame.serial + 1, mode: MODE };
  const history = [...(frame.history ?? frame.memory), event];
  const replayed = replay(history);
  return makeFrame(replayed.field, history.slice(-MEMORY_WINDOW), [], history, event.serial, 'remote reflow answered', replayed.changedPanelIds);
};

export const liftLatest = (frame) => {
  const history = (frame.history ?? frame.memory).slice(0, -1);
  if (!history.length) return { ...buildFrame(), serial: frame.serial, lastEvent: 'lifted latest' };
  const replayed = replay(history);
  return makeFrame(replayed.field, history.slice(-MEMORY_WINDOW), [], history, frame.serial, 'lifted latest', replayed.changedPanelIds);
};

export const release = () => buildFrame();
export const geometrySignature = (frame) => frame.field.signature;
export const stateSignature = (frame) => JSON.stringify({ geometry: geometrySignature(frame), memory: frame.memory, pending: frame.pending });
