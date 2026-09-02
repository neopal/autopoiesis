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
index = (now.hour // 4) % len(CURRENT_IDS)
current_id = CURRENT_IDS[index]
root = Path(__file__).resolve().parents[1]
works_path = root / "studio" / "data" / "works.json"
works = json.loads(works_path.read_text(encoding="utf-8")).get("works", [])
existing = next((work for work in works if work.get("currentId") == current_id and work.get("date") == date), None)

print("MUTINE DAILY SLOT")
print(f"date={date}")
print(f"current_id={current_id}")
print(f"current_index={index + 1}/{len(CURRENT_IDS)}")
print(f"existing_work_id={existing.get('id') if existing else 'none'}")
print(f"action={'verify-only' if existing else 'create-and-record'}")
