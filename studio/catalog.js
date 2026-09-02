import { buildCatalog, findCurrent, findWork } from './catalog.mjs';

const DATA_URLS = [
  '/studio/data/studio.json',
  '/studio/data/works.json',
  '/studio/data/stimuli.json',
  '/studio/data/artist.json'
];

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const withPreview = (path, options = {}) => {
  const params = new URLSearchParams({ preview: '1', ...options });
  return `${path}${path.includes('?') ? '&' : '?'}${params}`;
};
const pluralize = (count, singular, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;
const journalHref = (work) => work.journal?.anchor ? `/journal/#${work.journal.anchor}` : null;
const sortByDateDescending = (entries) => [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

function renderArtistPhilosophy(root, artist) {
  root.dataset.ready = 'true';
  root.innerHTML = `
    <p class="gallery-artist__statement">${escapeHtml(artist.statement)}</p>
    <ul class="artist-principles">
      ${(artist.principles ?? []).map((principle) => `<li>${escapeHtml(principle)}</li>`).join('')}
    </ul>`;
}

function renderHomeCurrent(current) {
  const work = current.latestWork;
  if (!work) {
    return `<article class="home-current home-current--held" data-current-id="${escapeHtml(current.id)}">
      <div class="home-current__held"><span>NO TABLEAU</span><strong>QUESTION HELD</strong></div>
      <header><p class="studio-kicker">${escapeHtml(current.title)} / ${escapeHtml(current.state)}</p><h3><a href="${escapeHtml(current.path)}">${escapeHtml(current.title)}</a></h3><p>${escapeHtml(current.question)}</p></header>
    </article>`;
  }

  return `<article class="home-current" data-current-id="${escapeHtml(current.id)}">
    <a class="home-current__art" href="${escapeHtml(work.route)}" aria-label="Open ${escapeHtml(work.title)}">
      <figure>
        <iframe src="${escapeHtml(withPreview(work.rawPath, { static: '1' }))}" title="${escapeHtml(work.title)} — latest ${escapeHtml(current.title)} work" loading="lazy" tabindex="-1" aria-hidden="true"></iframe>
        <figcaption><span>${escapeHtml(current.title)}</span><time datetime="${escapeHtml(work.date)}">${escapeHtml(work.date)}</time></figcaption>
      </figure>
    </a>
    <header><p class="studio-kicker">${escapeHtml(current.state)} / latest work</p><h3><a href="${escapeHtml(work.route)}">${escapeHtml(work.title)}</a></h3><p>${escapeHtml(work.status)}</p><a class="text-link" href="${escapeHtml(current.path)}">all ${escapeHtml(current.title)} works ↗</a></header>
  </article>`;
}

function renderLatestByCurrent(root, catalog) {
  root.dataset.ready = 'true';
  root.innerHTML = `<div class="gallery-current-grid">${catalog.currents.map(renderHomeCurrent).join('')}</div>`;
  const count = root.closest('.gallery-latest')?.querySelector('[data-gallery-count]');
  if (count) count.textContent = `${catalog.currents.length} currents · latest recorded work per current`;
}

function renderWorkCard(work) {
  const current = escapeHtml(work.currentTitle ?? work.currentId);
  const critiqueCount = work.critiques?.length ?? 0;
  return `<article class="catalog-card catalog-card--work catalog-card--${escapeHtml(work.currentId)}" data-work-id="${escapeHtml(work.id)}">
    <a class="catalog-card__art-link" href="${escapeHtml(work.route)}" aria-label="Open work ${escapeHtml(work.title)}">
      <figure class="catalog-card__art">
        <iframe src="${escapeHtml(withPreview(work.rawPath, { static: '1' }))}" title="${escapeHtml(work.title)} — ${current}" loading="lazy" tabindex="-1" aria-hidden="true"></iframe>
        <figcaption><span>${current}</span><time datetime="${escapeHtml(work.date)}">${escapeHtml(work.date)}</time></figcaption>
      </figure>
    </a>
    <div class="catalog-card__body">
      <div class="catalog-card__eyebrow"><span>${current}</span><span>${escapeHtml(work.status)}</span></div>
      <h3><a href="${escapeHtml(work.route)}">${escapeHtml(work.title)}</a></h3>
      <div class="catalog-card__meta"><time datetime="${escapeHtml(work.date)}">${escapeHtml(work.date)}</time><span>${escapeHtml(pluralize(critiqueCount, 'critique'))}</span></div>
      <div class="catalog-card__actions"><a class="catalog-card__open" href="${escapeHtml(work.route)}">enter work <span aria-hidden="true">↗</span></a>${journalHref(work) ? `<a class="catalog-card__quiet-link" href="${escapeHtml(journalHref(work))}">journal ↗</a>` : ''}</div>
    </div>
  </article>`;
}

function renderCurrentGrid(root, catalog, currentId) {
  const current = findCurrent(catalog, currentId);
  if (!current) {
    root.innerHTML = '<p class="catalog-state catalog-state--error">Current not found in the studio register.</p>';
    return;
  }

  root.dataset.ready = 'true';
  root.innerHTML = current.works.length
    ? `<div class="catalog-grid catalog-grid--current">${current.works.map(renderWorkCard).join('')}</div>`
    : `<div class="catalog-state catalog-state--empty"><strong>NO WORK YET</strong><span>${escapeHtml(current.question)}</span><small>This current stays open without inventing a tableau.</small></div>`;

  const count = root.closest('section')?.querySelector('[data-catalog-count]');
  if (count) count.textContent = current.works.length
    ? `${pluralize(current.works.length, 'daily work')} · newest first`
    : 'no tableau · question held';
}

function renderCurrentHeader(root, catalog) {
  const current = findCurrent(catalog, root.dataset.catalogCurrentHeader);
  if (!current) {
    root.innerHTML = '<p class="catalog-state catalog-state--error">Current not found in the studio register.</p>';
    return;
  }

  const latest = current.latestWork;
  root.dataset.ready = 'true';
  root.innerHTML = `
    <p class="studio-kicker">CURRENT / ${escapeHtml(current.title)} / ${escapeHtml(current.state)}</p>
    <h1 class="catalog-current-header__title" id="current-title">${escapeHtml(current.title)}<br><i>${escapeHtml(current.subtitle ?? 'a question kept open.')}</i></h1>
    <p class="catalog-current-header__question">${escapeHtml(current.question)}</p>
    <p class="catalog-current-header__state">${latest ? `${escapeHtml(latest.date)} / ${escapeHtml(latest.status)}` : 'question held / no tableau recorded'}</p>`;
}

function renderJournalCalendar(catalog) {
  const activity = sortByDateDescending(catalog.activity ?? []);
  const monthKeys = [...new Set(activity.map((entry) => entry.date.slice(0, 7)))].sort().reverse();
  if (!monthKeys.length) return '<section class="journal-calendar"><p class="journal-calendar__empty">The calendar stays empty until a work carries a recorded date.</p></section>';

  const weekdayLabels = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const months = monthKeys.map((monthKey) => {
    const [year, month] = monthKey.split('-').map(Number);
    const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const cells = Array.from({ length: firstWeekday }, () => '<div class="journal-calendar__day journal-calendar__day--blank" aria-hidden="true"></div>');

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${monthKey}-${String(day).padStart(2, '0')}`;
      const events = activity.filter((entry) => entry.date === date);
      cells.push(`<div class="journal-calendar__day${events.length ? ' journal-calendar__day--active' : ''}" role="gridcell"><time datetime="${date}">${day}</time>${events.map((event) => `<a class="journal-calendar__event" href="${escapeHtml(`${event.workRoute}#journal`)}" aria-label="${escapeHtml(`${event.title}, ${event.date}`)}"><strong>${escapeHtml(event.title)}</strong><small>${escapeHtml(event.currentTitle ?? event.currentId)}</small></a>`).join('')}</div>`);
    }

    const label = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)));
    return `<article class="journal-calendar__month"><header><h3>${escapeHtml(label)}</h3><p>${escapeHtml(pluralize(activity.filter((entry) => entry.date.startsWith(`${monthKey}-`)).length, 'daily work'))}</p></header><div class="journal-calendar__grid" role="grid" aria-label="${escapeHtml(label)}">${weekdayLabels.map((day) => `<span class="journal-calendar__weekday" role="columnheader">${day}</span>`).join('')}${cells.join('')}</div></article>`;
  }).join('');

  return `<section class="journal-calendar" aria-labelledby="journal-calendar-title"><header class="journal-calendar__heading"><div><p class="studio-kicker">THE CALENDAR / BY DAY</p><h2 id="journal-calendar-title">Studio days</h2></div><p>${escapeHtml(pluralize(activity.length, 'recorded daily work'))}<br>one entry per current and date</p></header><div class="journal-calendar__months">${months}</div></section>`;
}

function renderJournalIndex(root, catalog) {
  const entries = sortByDateDescending(catalog.works).filter((work) => work.journal);
  root.dataset.ready = 'true';
  root.innerHTML = `${renderJournalCalendar(catalog)}<ol class="journal-list journal-list--catalog">${entries.map((work) => `<li class="journal-entry journal-entry--${escapeHtml(work.currentId)}" id="${escapeHtml(work.journal.anchor)}"><time datetime="${escapeHtml(work.date)}">${escapeHtml(work.date)}</time><div><p class="studio-kicker">${escapeHtml(work.currentTitle ?? work.currentId)} / ${escapeHtml(work.status)}</p><h3><a href="${escapeHtml(`${work.route}#journal`)}">${escapeHtml(work.title)}</a></h3><p>${escapeHtml(work.journal.note ?? 'No note recorded for this work.')}</p><a class="text-link" href="${escapeHtml(work.route)}">open daily work ↗</a></div><p class="entry-result"><strong>${escapeHtml(work.status)}</strong>${escapeHtml(pluralize(work.critiques?.length ?? 0, 'critique'))}<br>daily trace retained</p></li>`).join('')}</ol>`;
}

function renderMetrics(metrics = {}) {
  const entries = Object.entries(metrics).filter(([key]) => key !== 'probe').slice(0, 6);
  if (!entries.length) return '<p class="work-empty">No metrics recorded for this daily work.</p>';
  return `<dl class="work-metrics">${entries.map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(typeof value === 'object' ? JSON.stringify(value) : value)}</dd></div>`).join('')}</dl>`;
}

function renderWorkTimeline(work, catalog) {
  const timeline = catalog.worksByCurrent[work.currentId] ?? [];
  return `<ol class="work-timeline" aria-label="${escapeHtml(work.currentId)} daily work timeline">${timeline.map((entry) => `<li class="work-timeline__item${entry.id === work.id ? ' is-selected' : ''}"><a href="${escapeHtml(entry.route)}"${entry.id === work.id ? ' aria-current="page"' : ''}><time datetime="${escapeHtml(entry.date)}">${escapeHtml(entry.date)}</time><strong>${escapeHtml(entry.title)}</strong></a></li>`).join('')}</ol>`;
}

function renderWorkNeighbor(work, direction) {
  const label = direction === 'previous' ? '← previous daily work' : 'next daily work →';
  if (!work) return `<span class="work-neighbor is-disabled"><span>${label}</span><strong>edge of current timeline</strong></span>`;
  return `<a class="work-neighbor" href="${escapeHtml(work.route)}"><span>${label}</span><strong>${escapeHtml(work.title)}</strong><time datetime="${escapeHtml(work.date)}">${escapeHtml(work.date)}</time></a>`;
}

function renderWorkDetail(root, catalog, workId) {
  const work = findWork(catalog, workId);
  if (!work) {
    root.innerHTML = '<p class="catalog-state catalog-state--error">Daily work not found in the studio register.</p>';
    return;
  }

  const timeline = catalog.worksByCurrent[work.currentId] ?? [];
  const index = timeline.findIndex((entry) => entry.id === work.id);
  const previous = timeline[index + 1];
  const next = timeline[index - 1];
  const critique = work.critiques ?? [];
  const journal = journalHref(work);

  root.dataset.ready = 'true';
  root.innerHTML = `<nav class="work-timeline-bar" data-work-region="timeline" aria-label="Navigate the ${escapeHtml(work.currentTitle ?? work.currentId)} daily timeline"><div class="work-timeline-bar__heading"><p class="studio-label">01 / timeline</p><strong>${escapeHtml(work.currentTitle ?? work.currentId)}</strong><span>${escapeHtml(pluralize(timeline.length, 'recorded day'))}</span></div>${renderWorkTimeline(work, catalog)}</nav><div class="work-inspect">
    <article class="work-inspect__stage">
      <figure class="artwork-frame artwork-frame--inspect"><iframe src="${escapeHtml(withPreview(work.rawPath, { interaction: '1' }))}" title="${escapeHtml(work.title)} — full artwork" loading="eager"></iframe><figcaption><span>${escapeHtml(work.currentTitle ?? work.currentId)} / ${escapeHtml(work.status)}</span><time datetime="${escapeHtml(work.date)}">${escapeHtml(work.date)}</time></figcaption></figure>
      <header class="work-inspect__heading"><p class="studio-kicker">${escapeHtml(work.currentTitle ?? work.currentId)} / DAILY WORK</p><h1>${escapeHtml(work.title)}</h1><p class="work-inspect__date"><span>recorded</span> <time datetime="${escapeHtml(work.date)}">${escapeHtml(work.date)}</time></p><p>${escapeHtml(work.journal?.note ?? 'No note recorded for this daily work.')}</p></header>
      ${work.decision?.nextMutation ? `<section class="work-next-mutation" data-work-region="decision"><p class="studio-label">next decision</p><p>${escapeHtml(work.decision.nextMutation)}</p></section>` : ''}
    </article>
    <aside class="work-inspect__ledger" aria-label="Daily work record">
      <section id="journal" class="work-ledger-section" data-work-region="journal"><p class="studio-label">02 / journal</p><h2>Artist trace</h2>${journal ? `<a class="work-ledger-link" href="${escapeHtml(journal)}">read the Journal entry ↗</a>` : '<p class="work-empty">Journal not recorded.</p>'}</section>
      <section id="critiques" class="work-ledger-section" data-work-region="critiques"><p class="studio-label">03 / critique</p><h2>Returns</h2><div class="work-critique-list">${critique.length ? critique.map((entry) => `<blockquote><p>${escapeHtml(entry.argument)}</p><cite>${escapeHtml(entry.persona)}</cite></blockquote>`).join('') : '<p class="work-empty">No critique recorded yet.</p>'}</div></section>
      <section id="evidence" class="work-ledger-section" data-work-region="evidence"><p class="studio-label">04 / evidence</p><h2>Working conditions</h2>${renderMetrics(work.metrics)}</section>
    </aside>
  </div><nav class="work-neighbor-nav" data-work-region="navigation" aria-label="Navigate between daily works">${renderWorkNeighbor(previous, 'previous')}${renderWorkNeighbor(next, 'next')}</nav>`;
}

function showCatalogError(error) {
  console.error('Mutine catalog failed to load', error);
  document.querySelectorAll('[data-catalog-current-header], [data-catalog-current], [data-catalog="artist"], [data-catalog="gallery"], [data-catalog="journal"], [data-catalog-work-detail]').forEach((root) => {
    root.innerHTML = '<p class="catalog-state catalog-state--error">The studio register could not be loaded.</p>';
  });
}

async function init() {
  const mounts = document.querySelectorAll('[data-catalog-current-header], [data-catalog-current], [data-catalog="artist"], [data-catalog="gallery"], [data-catalog="journal"], [data-catalog-work-detail]');
  if (!mounts.length) return;

  try {
    const responses = await Promise.all(DATA_URLS.map((url) => fetch(url)));
    if (responses.some((response) => !response.ok)) throw new Error('Catalog data request failed');
    const [studio, works, stimuli, artist] = await Promise.all(responses.map((response) => response.json()));
    const catalog = buildCatalog(studio, works, stimuli);

    document.querySelectorAll('[data-catalog="artist"]').forEach((root) => renderArtistPhilosophy(root, artist));
    document.querySelectorAll('[data-catalog="gallery"]').forEach((root) => renderLatestByCurrent(root, catalog));
    document.querySelectorAll('[data-catalog-current-header]').forEach((root) => renderCurrentHeader(root, catalog));
    document.querySelectorAll('[data-catalog-current]').forEach((root) => renderCurrentGrid(root, catalog, root.dataset.catalogCurrent));
    document.querySelectorAll('[data-catalog="journal"]').forEach((root) => renderJournalIndex(root, catalog));
    document.querySelectorAll('[data-catalog-work-detail]').forEach((root) => renderWorkDetail(root, catalog, root.dataset.catalogWorkDetail));
  } catch (error) {
    showCatalogError(error);
  }
}

document.addEventListener('DOMContentLoaded', init);