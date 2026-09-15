from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT = 'https://autopoiesis-nine.vercel.app'
PROOF = Path('research/qa/proofs/naive-art-v011-2026-09-15/production')

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 390, 'height': 844}, reduced_motion='reduce')
    journal_page = context.new_page()
    journal_events = {'console': [], 'pageErrors': [], 'failedRequests': [], 'badResponses': []}
    journal_page.on('console', lambda message: journal_events['console'].append({'type': message.type, 'text': message.text}))
    journal_page.on('pageerror', lambda error: journal_events['pageErrors'].append(str(error)))
    journal_page.on('requestfailed', lambda request: journal_events['failedRequests'].append({'url': request.url, 'failure': request.failure or 'unknown'}))
    journal_page.on('response', lambda response: journal_events['badResponses'].append({'url': response.url, 'status': response.status}) if response.status >= 400 else None)
    journal_response = journal_page.goto(f'{ROOT}/journal/', wait_until='networkidle')
    journal_page.wait_for_selector('#journal-naive-2026-09-15')
    journal = journal_page.evaluate("""() => {
      const entry = document.querySelectorAll('#journal-naive-2026-09-15').length === 1
        ? document.querySelector('#journal-naive-2026-09-15') : null;
      const rect = document.documentElement.getBoundingClientRect();
      return {
        status: document.querySelector('[data-catalog="journal"]')?.dataset.ready === 'true',
        innerWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        entryCount: document.querySelectorAll('#journal-naive-2026-09-15').length,
        title: entry?.querySelector('h3')?.textContent.trim() ?? null,
        href: entry?.querySelector('h3 a')?.getAttribute('href') ?? null,
        date: entry?.querySelector('time')?.getAttribute('datetime') ?? null,
        entryRect: entry ? { top: entry.getBoundingClientRect().top, height: entry.getBoundingClientRect().height } : null,
        documentRect: { left: rect.left, right: rect.right }
      };
    }""")
    journal_page.screenshot(path=str(PROOF / 'journal-390x844.png'), full_page=True)
    assert journal_response and journal_response.status == 200, journal_response.status if journal_response else None
    assert journal['status'] and journal['entryCount'] == 1, journal
    assert journal['title'] == 'The mistake keeps a bump.', journal
    assert journal['href'] == '/works/naive-2026-09-15/#journal', journal
    assert journal['date'] == '2026-09-15', journal
    assert journal['innerWidth'] == 390 and journal['clientWidth'] == 390 and journal['scrollWidth'] == 390, journal
    assert not any(journal_events.values()), journal_events

    raw_page = context.new_page()
    raw_response = raw_page.goto(f'{ROOT}/chantiers/naive-art/v011/', wait_until='networkidle')
    raw_final_url = raw_page.url
    raw_status = raw_response.status if raw_response else None
    raw_body = raw_page.locator('body').inner_text()
    assert raw_status == 200 and raw_final_url.endswith('/works/naive-2026-09-15/'), {'status': raw_status, 'url': raw_final_url}
    assert 'The mistake keeps a bump' in raw_body or raw_page.locator('#field').count() == 1, raw_body[:200]

    icon = context.request.get(f'{ROOT}/studio/favicon.svg')
    icon_type = icon.headers.get('content-type', '')
    assert icon.status == 200 and icon_type.startswith('image/svg+xml'), {'status': icon.status, 'contentType': icon_type}

    catalog_response = context.request.get(f'{ROOT}/studio/data/works.json')
    assert catalog_response.status == 200, catalog_response.status
    catalog = catalog_response.json()
    rows = catalog['works']
    matches = [row for row in rows if row.get('id') == 'naive-2026-09-15']
    assert len(matches) == 1, len(matches)
    record = matches[0]
    assert record['title'] == 'The mistake keeps a bump.'
    assert record['rawPath'] == '/studies/naive-art/v011/'
    assert record['journal']['anchor'] == 'journal-naive-2026-09-15'

    supplement = {
      'stableAlias': ROOT,
      'journal': journal,
      'journalIssues': journal_events,
      'rawRoute': {'initialStatus': raw_status, 'finalUrl': raw_final_url, 'containsTableau': '#field' in raw_page.content() or 'The mistake keeps a bump' in raw_body},
      'favicon': {'status': icon.status, 'contentType': icon_type, 'bytes': len(icon.body())},
      'worksJson': {'status': catalog_response.status, 'workCount': len(rows), 'matchingRecordCount': len(matches), 'recordId': record['id'], 'title': record['title'], 'rawPath': record['rawPath'], 'journalAnchor': record['journal']['anchor']}
    }
    (PROOF / 'supplement.json').write_text(json.dumps(supplement, indent=2), encoding='utf-8')
    print(json.dumps(supplement, indent=2))
    raw_page.close()
    journal_page.close()
    context.close()
    browser.close()
