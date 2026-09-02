---
type: protocol
---
# Sources — ingestion protocol

## Minimal card

```yaml
---
type: source
status: read | partial | blocked | to-read
source_url: https://…
author:
date:
media: []
replies: []
concepts: []
currents: []
---
```

## Method

1. Capture visible text, author, date, media, and replies.
2. Never infer content behind an X access wall: mark it `blocked` or `partial`.
3. Isolate one **tension** and one **falsifiable experiment**; “style to reproduce” is never a conclusion.
4. Add backlinks to concepts and currents.
5. When a work uses the card, link the commit and record the gap between intention and rendering.

See [[03 — Practices — reference ethics]].
