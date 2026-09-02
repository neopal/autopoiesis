import { buildStage, makeRoutes } from '../../../../chantiers/typographie-manuscrite/v002/engine.mjs';

const STAGE = 3;

const geometryOnly = (routes) => routes.map((route) => ({
  points: route.points.map(({ x, y }) => ({ x, y }))
}));

const changedPointIndicesBetween = (intact, deleted) => intact.flatMap((route, routeIndex) => route.points.flatMap((point, pointIndex) => {
  const other = deleted[routeIndex].points[pointIndex];
  return point.x !== other.x || point.y !== other.y ? [{ routeIndex, pointIndex }] : [];
}));

const maxDisplacementBetween = (intact, deleted) => intact.reduce((maximum, route, routeIndex) => Math.max(maximum, ...route.points.map((point, pointIndex) => {
  const other = deleted[routeIndex].points[pointIndex];
  return Math.hypot(point.x - other.x, point.y - other.y);
})), 0);

export function buildCaptionFreeComparison(stage = STAGE) {
  const frame = buildStage(stage);
  const intactRoutes = geometryOnly(makeRoutes(stage, frame.memory));
  const deletedRoutes = geometryOnly(makeRoutes(stage, frame.memory.slice(0, -1)));
  const changedPointIndices = changedPointIndicesBetween(intactRoutes, deletedRoutes);

  return {
    stage,
    intactMemoryCount: frame.memory.length,
    deletedMemoryCount: Math.max(0, frame.memory.length - 1),
    changedPointCount: changedPointIndices.length,
    changedPointIndices,
    maxDisplacement: maxDisplacementBetween(intactRoutes, deletedRoutes),
    panels: [
      { routes: intactRoutes },
      { routes: deletedRoutes }
    ]
  };
}
