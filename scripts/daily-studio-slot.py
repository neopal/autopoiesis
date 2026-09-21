#!/usr/bin/env python3
"""Print the deterministic Mutine daily slot without changing the catalogue."""
from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path

CURRENT_IDS = ["typography", "portrait", "svg", "brush", "naive", "webgpu"]
now_value = os.environ.get("MUTINE_SLOT_NOW")
now = datetime.fromisoformat(now_value) if now_value else datetime.now().astimezone()
date = now.date().isoformat()
scheduled_index = (now.hour // 4) % len(CURRENT_IDS)
root = Path(__file__).resolve().parents[1]
scheduled_current_id = CURRENT_IDS[scheduled_index]
works_path = root / "studio" / "data" / "works.json"
if os.environ.get("MUTINE_SLOT_TEST_MODE") == "1":
    works_path = Path(os.environ.get("MUTINE_SLOT_WORKS_PATH", works_path))
payload = json.loads(works_path.read_text(encoding="utf-8"))
if not isinstance(payload, dict) or not isinstance(payload.get("works"), list):
    raise SystemExit("invalid works registry: expected an object with a works list")
if any(not isinstance(work, dict) for work in payload["works"]):
    raise SystemExit("invalid works registry: every work must be an object")
works = payload["works"]

selected_index = scheduled_index
existing = None
scheduled_existing = next(
    (work for work in works if work.get("currentId") == scheduled_current_id and work.get("date") == date),
    None,
)
for offset in range(len(CURRENT_IDS)):
    candidate_index = (scheduled_index + offset) % len(CURRENT_IDS)
    candidate_id = CURRENT_IDS[candidate_index]
    candidate_existing = next(
        (work for work in works if work.get("currentId") == candidate_id and work.get("date") == date),
        None,
    )
    if candidate_existing is None:
        selected_index = candidate_index
        existing = None
        break
    if offset == len(CURRENT_IDS) - 1:
        selected_index = scheduled_index
        existing = scheduled_existing

current_id = CURRENT_IDS[selected_index]

print("MUTINE DAILY SLOT")
print(f"date={date}")
print(f"scheduled_current_id={scheduled_current_id}")
print(f"current_id={current_id}")
print(f"current_index={selected_index + 1}/{len(CURRENT_IDS)}")
print(f"existing_work_id={existing.get('id') if existing else 'none'}")
print(f"action={'verify-only' if existing else 'create-and-record'}")
