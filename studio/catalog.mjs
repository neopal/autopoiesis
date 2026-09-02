const fieldTestId = (path, index) => String(path ?? `field-test-${index + 1}`)
  .split('/')
  .filter(Boolean)
  .at(-1) ?? `field-test-${index + 1}`;

const normalizeFieldTests = (currentEntries) => currentEntries.flatMap((current) =>
  (current.fieldTests ?? []).map((entry, index) => {
    const record = typeof entry === 'string' ? { path: entry } : entry;
    const id = record.id ?? fieldTestId(record.path, index);
    return {
      ...record,
      id,
      path: record.path ?? null,
      title: record.title ?? id,
      relation: record.relation ?? `${current.title} relation`,
      note: record.note ?? 'No note recorded for this field test.',
      status: record.status ?? 'field test / disposable',
      currentId: current.id,
      currentTitle: current.title
    };
  }));

const dateSortDescending = (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id);

const normalizeWork = (entry, currentById) => ({
  ...entry,
  route: `/works/${entry.id}/`,
  rawPath: entry.rawPath ?? null,
  currentTitle: currentById.get(entry.currentId)?.title ?? entry.currentId,
  lifecycle: entry.lifecycle ?? (entry.status === 'complete' ? 'complete' : 'active'),
  journal: entry.journal ?? null,
  critiques: Array.isArray(entry.critiques) ? entry.critiques : [],
  metrics: entry.metrics ?? {},
  decision: entry.decision ?? {}
});

export function buildCatalog(studio, worksData, stimuli = {}) {
  const currentEntries = Array.isArray(studio?.currents) ? studio.currents : [];
  const workEntries = Array.isArray(worksData?.works) ? worksData.works : [];
  const stimulusEntries = Array.isArray(stimuli?.stimuli) ? stimuli.stimuli : [];
  const fieldTestEntries = normalizeFieldTests(currentEntries);
  const currentById = new Map(currentEntries.map((current) => [current.id, current]));
  const works = workEntries.map((entry) => normalizeWork(entry, currentById)).sort(dateSortDescending);
  const worksById = Object.fromEntries(works.map((work) => [work.id, work]));
  const worksByCurrent = new Map(currentEntries.map((current) => [
    current.id,
    works.filter((work) => work.currentId === current.id).sort(dateSortDescending)
  ]));
  const currents = currentEntries.map((current) => {
    const currentWorks = worksByCurrent.get(current.id) ?? [];
    return {
      ...current,
      works: currentWorks,
      latestWork: currentWorks[0] ?? null
    };
  });
  const activity = works
    .filter((work) => work.journal?.anchor && work.date)
    .map((work) => ({
      id: work.id,
      workId: work.id,
      workRoute: work.route,
      currentId: work.currentId,
      currentTitle: work.currentTitle,
      date: work.date,
      title: work.title,
      journalAnchor: work.journal.anchor
    }));

  return {
    currents,
    works,
    worksById,
    worksByCurrent: Object.fromEntries([...worksByCurrent].map(([id, entries]) => [id, entries])),
    activity,
    stimuli: stimulusEntries,
    fieldTests: fieldTestEntries
  };
}

export function findCurrent(catalog, currentId) {
  return catalog.currents.find((current) => current.id === currentId) ?? null;
}

export function findWork(catalog, workId) {
  return catalog.worksById[workId] ?? null;
}
