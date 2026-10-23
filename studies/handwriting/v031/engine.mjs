const GLYPHS = ['L', 'E', 'T', 'T', 'E', 'R', 'R', 'O', 'U', 'T', 'E'];
const BASE_LAYOUT = [
  [0.11, 0.28, -12, 1.02],
  [0.24, 0.58, 7, 0.82],
  [0.37, 0.23, -5, 1.18],
  [0.48, 0.69, 9, 0.9],
  [0.59, 0.34, -8, 1.08],
  [0.7, 0.72, 4, 0.96],
  [0.79, 0.24, 12, 1.12],
  [0.88, 0.53, -6, 0.86],
  [0.18, 0.83, 8, 0.76],
  [0.53, 0.12, -14, 0.7],
  [0.91, 0.84, 5, 0.74]
];

export const STATION_COUNT = GLYPHS.length;
export const ROUTE_LENGTH = 3;
export const MEMORY_WINDOW = 4;

const round = (value, digits = 5) => Number(value.toFixed(digits));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function stationPath(station) {
  const lean = station.rotation * 0.0018;
  const width = 0.032 * station.scale;
  const rise = (0.052 + station.contour * 0.018) * station.scale;
  const notch = (0.014 + station.open * 0.024) * station.scale;
  return [
    `M ${round(station.x - width)} ${round(station.y + rise)}`,
    `C ${round(station.x - width * 0.8 + lean)} ${round(station.y - rise * 0.62)}`,
    `${round(station.x + width * 0.82 + lean)} ${round(station.y - rise * 0.54)}`,
    `${round(station.x + width)} ${round(station.y + rise * 0.72)}`,
    `M ${round(station.x - notch)} ${round(station.y + rise * 0.08)}`,
    `L ${round(station.x + notch)} ${round(station.y - rise * 0.14)}`
  ].join(' ');
}

function routePath(from, to, index, load) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const bend = (index % 2 === 0 ? 1 : -1) * (0.055 + load * 0.012);
  const nx = -dy;
  const ny = dx;
  const length = Math.max(0.001, Math.hypot(dx, dy));
  const controlX = (from.x + to.x) / 2 + (nx / length) * bend;
  const controlY = (from.y + to.y) / 2 + (ny / length) * bend;
  return `M ${round(from.x)} ${round(from.y)} Q ${round(controlX)} ${round(controlY)} ${round(to.x)} ${round(to.y)}`;
}

function buildRoutePaths(stations) {
  return stations.slice(0, -1).map((station, index) => routePath(station, stations[index + 1], index, station.load + stations[index + 1].load));
}

function makeStation(index) {
  const [x, y, rotation, scale] = BASE_LAYOUT[index];
  const station = {
    id: index,
    glyph: GLYPHS[index],
    x,
    y,
    rotation,
    scale,
    open: 0,
    contour: 0,
    load: 0,
    role: 'quiet',
    inheritedFrom: null,
    path: ''
  };
  station.path = stationPath(station);
  return station;
}

function cloneStation(station) {
  return { ...station };
}

function cloneHistory(history) {
  return history.map((event) => ({ ...event, route: [...event.route] }));
}

function refresh(frame) {
  frame.stations.forEach((station) => {
    station.path = stationPath(station);
  });
  frame.routePaths = buildRoutePaths(frame.stations);
  frame.changedStationIds = frame.history.at(-1)?.changedStationIds ? [...frame.history.at(-1).changedStationIds] : [];
  frame.memory = frame.history.slice(-MEMORY_WINDOW).map((event) => ({ ...event, route: [...event.route] }));
  return frame;
}

function applyCommitted(frame, route, serial) {
  const [sourceId, relayId, hingeId] = route;
  const source = frame.stations[sourceId];
  const relay = frame.stations[relayId];
  const hinge = frame.stations[hingeId];
  const load = 0.52 + serial * 0.08;

  source.open = clamp(source.open + 0.2 + serial * 0.012, 0, 0.92);
  source.scale = clamp(source.scale - 0.045 - serial * 0.004, 0.48, 1.3);
  source.rotation = round(source.rotation + 7 + serial * 0.4, 4);
  source.contour = round(source.contour + 0.8 + serial * 0.1, 4);
  source.load = round(source.load + load, 4);
  source.role = 'source';
  source.inheritedFrom = null;

  relay.glyph = source.glyph;
  relay.inheritedFrom = sourceId;
  relay.scale = clamp(relay.scale + 0.05 + serial * 0.006, 0.5, 1.34);
  relay.rotation = round(relay.rotation - 5 - serial * 0.35, 4);
  relay.contour = round(relay.contour + 0.55 + serial * 0.08, 4);
  relay.load = round(relay.load + load * 0.76, 4);
  relay.role = 'relay';

  hinge.x = round(clamp(hinge.x + (source.x - hinge.x) * 0.055 * serial, 0.07, 0.94), 5);
  hinge.y = round(clamp(hinge.y + (relay.y - hinge.y) * 0.04 * serial, 0.08, 0.9), 5);
  hinge.rotation = round(hinge.rotation + (sourceId < hingeId ? -4 : 4) * (1 + serial * 0.08), 4);
  hinge.open = clamp(hinge.open + 0.1 + serial * 0.01, 0, 0.85);
  hinge.contour = round(hinge.contour + 0.42 + serial * 0.06, 4);
  hinge.load = round(hinge.load + load * 0.58, 4);
  hinge.role = 'hinge';

  const event = {
    route: [...route],
    serial,
    changedStationIds: [sourceId, relayId, hingeId]
  };
  frame.history.push(event);
  frame.route = [];
  frame.lastEvent = 'route';
  return refresh(frame);
}

export function buildFrame(_stage = 0, events = []) {
  const frame = {
    stations: Array.from({ length: STATION_COUNT }, (_, index) => makeStation(index)),
    routePaths: [],
    route: [],
    history: [],
    memory: [],
    changedStationIds: [],
    lastEvent: 'quiet'
  };
  refresh(frame);
  for (const event of events) {
    const route = Array.isArray(event) ? event : event.route;
    if (!Array.isArray(route) || route.length !== ROUTE_LENGTH || new Set(route).size !== ROUTE_LENGTH) continue;
    applyCommitted(frame, route, frame.history.length + 1);
  }
  frame.route = [];
  frame.lastEvent = events.length ? 'route' : 'quiet';
  return refresh(frame);
}

export function traceStation(frame, stationId) {
  if (!Number.isInteger(stationId) || stationId < 0 || stationId >= STATION_COUNT || frame.route.includes(stationId) || frame.route.length >= ROUTE_LENGTH) {
    return { ...frame, route: [...frame.route], lastEvent: 'refused' };
  }
  return { ...frame, route: [...frame.route, stationId], lastEvent: 'tracing' };
}

export function commitRoute(frame) {
  if (frame.route.length !== ROUTE_LENGTH || new Set(frame.route).size !== ROUTE_LENGTH) {
    return { ...frame, route: [], lastEvent: 'refused' };
  }
  const next = {
    ...frame,
    stations: frame.stations.map(cloneStation),
    history: cloneHistory(frame.history),
    route: [...frame.route]
  };
  return applyCommitted(next, frame.route, frame.history.length + 1);
}

export function liftLatestRoute(frame) {
  if (frame.history.length === 0) return { ...frame, route: [], lastEvent: 'lifted' };
  const prior = buildFrame(0, frame.history.slice(0, -1));
  prior.lastEvent = 'lifted';
  return prior;
}

export function releaseRoute() {
  const frame = buildFrame(0, []);
  frame.lastEvent = 'released';
  return frame;
}

export function nearestStation(points, point, maxDistance) {
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
    stations: frame.stations.map((station) => [
      station.id,
      station.glyph,
      round(station.x),
      round(station.y),
      round(station.rotation),
      round(station.scale),
      round(station.open),
      round(station.contour),
      round(station.load),
      station.role,
      station.inheritedFrom,
      station.path
    ]),
    routePaths: frame.routePaths
  });
}
