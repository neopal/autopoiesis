export const SEED = '0x48574934';
export const FRAGMENT_COUNT = 14;
export const MEMORY_WINDOW = 4;
export const MODE = 'double-register';

const TOKENS = ['THE', 'GAP', 'KEEPS', 'A', 'PLACE', 'FOR', 'AN', 'OTHER', 'LETTER', 'TO', 'ARRIVE', 'LATE', '—', '∅'];
const INITIAL_LAYOUT = [
  { x: 0.13, y: 0.18, scale: 1.08, rotation: -7, skew: -3, register: 0, role: 'word' },
  { x: 0.38, y: 0.14, scale: 0.92, rotation: 5, skew: 2, register: 0, role: 'word' },
  { x: 0.68, y: 0.19, scale: 0.78, rotation: -3, skew: -1, register: 0, role: 'word' },
  { x: 0.87, y: 0.28, scale: 1.22, rotation: 8, skew: 3, register: 0, role: 'word' },
  { x: 0.22, y: 0.44, scale: 1.36, rotation: 4, skew: -4, register: 0, role: 'word' },
  { x: 0.51, y: 0.42, scale: 0.72, rotation: -9, skew: 1, register: 0, role: 'word' },
  { x: 0.78, y: 0.48, scale: 0.94, rotation: 6, skew: -2, register: 0, role: 'interval' },
  { x: 0.12, y: 0.72, scale: 0.82, rotation: -4, skew: 2, register: 1, role: 'word' },
  { x: 0.37, y: 0.79, scale: 1.18, rotation: 8, skew: -1, register: 1, role: 'word' },
  { x: 0.61, y: 0.72, scale: 0.76, rotation: -6, skew: 3, register: 1, role: 'word' },
  { x: 0.84, y: 0.78, scale: 1.02, rotation: 3, skew: -2, register: 1, role: 'word' },
  { x: 0.28, y: 0.91, scale: 0.62, rotation: -8, skew: 1, register: 1, role: 'word' },
  { x: 0.55, y: 0.12, scale: 0.46, rotation: 0, skew: 0, register: 1, role: 'interval' },
  { x: 0.72, y: 0.88, scale: 0.44, rotation: 0, skew: 0, register: 1, role: 'interval' }
];

const clone = (value) => JSON.parse(JSON.stringify(value));

function baseFragments() {
  return INITIAL_LAYOUT.map((layout, id) => ({
    id,
    token: TOKENS[id],
    ...layout,
    opacity: layout.role === 'interval' ? 0.58 : 0.96,
    weight: layout.role === 'interval' ? 260 : 680,
    witness: 0,
    answer: 0,
    echo: 0
  }));
}

function baselineFrame() {
  return {
    mode: MODE,
    fragments: baseFragments(),
    attention: Array(FRAGMENT_COUNT).fill(0),
    history: [],
    memory: [],
    active: null,
    changedFragmentIds: [],
    lastEvent: 'quiet'
  };
}

function remoteCandidates(source) {
  const sourceRegister = baseFragments()[source].register;
  return baseFragments().filter((fragment) => fragment.register !== sourceRegister && fragment.role !== 'interval');
}

function chooseRemote(attention, source, eventIndex) {
  const candidates = remoteCandidates(source);
  let minimum = Math.min(...candidates.map((candidate) => attention[candidate.id]));
  const least = candidates.filter((candidate) => attention[candidate.id] === minimum);
  return least[(source + eventIndex * 2) % least.length].id;
}

function chooseEcho(remote, source, eventIndex) {
  const candidates = baseFragments().filter((fragment) => fragment.id !== source && fragment.id !== remote && fragment.role === 'word');
  return candidates[(remote + source + eventIndex) % candidates.length].id;
}

function applyWithdrawal(frame, event) {
  const fragments = clone(frame.fragments);
  const eventIndex = frame.history.length;
  const source = event.source;
  const remote = event.remote ?? chooseRemote(frame.attention, source, eventIndex);
  const echo = event.echo ?? chooseEcho(remote, source, eventIndex);
  const pressure = 1 + eventIndex * 0.16;
  const sourceFragment = fragments[source];
  const remoteFragment = fragments[remote];
  const echoFragment = fragments[echo];

  remoteFragment.x = Math.min(0.92, remoteFragment.x + 0.035 * pressure);
  remoteFragment.y = Math.max(0.08, remoteFragment.y - 0.028 * pressure);
  remoteFragment.scale = remoteFragment.scale * (1.08 + eventIndex * 0.015);
  remoteFragment.rotation += 7 + eventIndex * 2;
  remoteFragment.skew -= 4;
  remoteFragment.answer = 1;
  remoteFragment.weight = Math.min(900, remoteFragment.weight + 70);

  echoFragment.x = Math.max(0.08, echoFragment.x - 0.022 * pressure);
  echoFragment.y = Math.min(0.94, echoFragment.y + 0.032 * pressure);
  echoFragment.scale = echoFragment.scale * (0.91 - eventIndex * 0.008);
  echoFragment.rotation -= 5 + eventIndex;
  echoFragment.skew += 3;
  echoFragment.echo = 1;
  echoFragment.opacity = Math.max(0.42, echoFragment.opacity - 0.08);

  sourceFragment.witness = 1;
  const historyEntry = {
    source,
    remote,
    echo,
    eventIndex,
    attention: [...frame.attention]
  };
  const history = [...frame.history, historyEntry];
  const memory = history.slice(-MEMORY_WINDOW);
  const changedFragmentIds = [source, remote, echo].sort((a, b) => a - b);
  return {
    ...frame,
    fragments,
    history,
    memory,
    active: null,
    changedFragmentIds,
    lastEvent: 'withdrawal',
    attention: frame.attention.map((value, index) => index === source ? value + 1 : value)
  };
}

export function buildFrame(events = []) {
  let frame = baselineFrame();
  for (const event of events) {
    const source = typeof event === 'number' ? event : event.source;
    frame = applyWithdrawal(frame, typeof event === 'number' ? { source } : event);
  }
  return frame;
}

export function geometrySignature(frame) {
  return JSON.stringify(frame.fragments.map(({ id, x, y, scale, rotation, skew, opacity, weight, witness, answer, echo }) => ({ id, x, y, scale, rotation, skew, opacity, weight, witness, answer, echo })));
}

export function attend(frame, fragmentId) {
  if (!Number.isInteger(fragmentId) || fragmentId < 0 || fragmentId >= FRAGMENT_COUNT) return { ...frame, lastEvent: 'refused' };
  return {
    ...frame,
    active: fragmentId,
    attention: frame.attention.map((value, index) => index === fragmentId ? value + 1 : value),
    lastEvent: 'attending'
  };
}

export function withdraw(frame, fragmentId = 2) {
  if (!Number.isInteger(fragmentId) || fragmentId < 0 || fragmentId >= FRAGMENT_COUNT) return { ...frame, lastEvent: 'refused' };
  return applyWithdrawal(frame, { source: fragmentId });
}

export function withdrawPresence(frame) {
  if (!Number.isInteger(frame.active)) return { ...frame, lastEvent: 'refused' };
  return applyWithdrawal({ ...frame, active: null }, { source: frame.active });
}

export function liftLatest(frame) {
  if (!frame.history.length) return { ...frame, lastEvent: 'refused' };
  return { ...buildFrame(frame.history.slice(0, -1)), lastEvent: 'lifted' };
}

export function release() {
  return baselineFrame();
}

export function geometryChanged(a, b) {
  return geometrySignature(a) !== geometrySignature(b);
}
