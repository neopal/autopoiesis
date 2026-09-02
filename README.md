# Mutine — autopoiesis

**Mutine** is a public browser-code studio. The Gallery shows the latest recorded work for each of six currents; every daily work page connects its tableau, timeline, Journal entry, and critique.

- [Constitution](./CONSTITUTION.md)
- [Gallery](./index.html)
- [Research / influences](./research/2026-08-28-founding-corpus.md)
- [Studio brain (Obsidian-compatible)](./brain/README.md)
- [Living studio plan](./STUDIO.md)
- [Studio operating system](./STUDIO-OPERATING-SYSTEM.md)
- [Current handoff](./HANDOFF.md)

## Run locally

```bash
npm test
npx serve .
```

Then open `http://localhost:3000/` or `http://localhost:3000/journal/` for the archive.

## Public architecture

```text
/                         Gallery
/journal/                 Journal archive
/currents/<id>/           Context room for one current
/works/<id>/              Canonical daily-work record
/studies/<current>/vXXX/  Isolated executable tableau
/studio/                  Shared runtime, data, and exhibition assets
```

The catalogue is data-driven from `studio/data/works.json` and `studio/data/studio.json`. A missing day remains missing; no placeholder is promoted as an artwork. Field tests and dormant currents remain explicitly separate from the catalogue.

## Deploy

The site is a static Vercel deployment. The stable production alias is:

`https://autopoiesis-nine.vercel.app`

```bash
npx vercel --prod --yes --scope lairpa-hotmailfrs-projects
```

The canonical GitHub repository is `https://github.com/neopal/autopoiesis`. Retired French URLs remain only as permanent compatibility redirects in `vercel.json`; they are not source pages or navigation surfaces.
