#!/usr/bin/env python3
"""Print the deterministic Mutine daily slot without changing the catalogue."""
from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit

CURRENT_IDS = ["typography", "portrait", "svg", "brush", "naive", "webgpu"]
now_value = os.environ.get("MUTINE_SLOT_NOW")
now = datetime.fromisoformat(now_value) if now_value else datetime.now().astimezone()
date = now.date().isoformat()
scheduled_index = (now.hour // 4) % len(CURRENT_IDS)
root = Path(__file__).resolve().parents[1]
scheduled_current_id = CURRENT_IDS[scheduled_index]
works_path = root / "studio" / "data" / "works.json"
culture_path = root / "studio" / "data" / "cultural-field.json"


def resolve_test_path(default_path: Path, variable_name: str) -> Path:
    if os.environ.get("MUTINE_SLOT_TEST_MODE") != "1":
        return default_path
    override = os.environ.get(variable_name)
    if not override:
        return default_path
    try:
        candidate = Path(override).expanduser().resolve()
        candidate.relative_to(root)
    except (OSError, RuntimeError, ValueError) as error:
        raise SystemExit("test override path must remain inside repository root") from error
    return candidate


works_path = resolve_test_path(works_path, "MUTINE_SLOT_WORKS_PATH")
payload = json.loads(works_path.read_text(encoding="utf-8"))
if not isinstance(payload, dict) or not isinstance(payload.get("works"), list):
    raise SystemExit("invalid works registry: expected an object with a works list")
if any(not isinstance(work, dict) for work in payload["works"]):
    raise SystemExit("invalid works registry: every work must be an object")
works = payload["works"]

culture_path = resolve_test_path(culture_path, "MUTINE_CULTURAL_FIELD_PATH")
culture_payload = json.loads(culture_path.read_text(encoding="utf-8"))


def invalid_cultural_field(message: str) -> None:
    raise SystemExit(f"invalid cultural field: {message}")


def require_exact_keys(value: object, expected: set[str], label: str) -> dict:
    if not isinstance(value, dict) or set(value) != expected:
        invalid_cultural_field(f"{label} has an unexpected schema")
    return value


def non_empty_string(value: object) -> bool:
    return isinstance(value, str) and bool(value.strip())


def non_empty_string_list(value: object) -> bool:
    return isinstance(value, list) and bool(value) and all(non_empty_string(item) for item in value)


def is_valid_https_url(value: object) -> bool:
    if not isinstance(value, str) or not value.strip():
        return False
    if any(character == "\\" or character.isspace() or ord(character) < 0x20 or ord(character) == 0x7F for character in value):
        return False
    try:
        parsed = urlsplit(value)
        hostname = parsed.hostname
        port = parsed.port
    except ValueError:
        return False
    return (
        parsed.scheme == "https"
        and bool(parsed.netloc)
        and bool(hostname)
        and parsed.username is None
        and parsed.password is None
        and not parsed.netloc.endswith(":")
        and (port is None or 0 <= port <= 65535)
    )


cultural = require_exact_keys(
    culture_payload,
    {"schema", "title", "purpose", "practice", "references", "researchDirections", "rotation"},
    "top-level field",
)
if cultural["schema"] != "mutine-cultural-field/v1":
    invalid_cultural_field("unexpected schema")
if not non_empty_string(cultural["title"]) or not non_empty_string(cultural["purpose"]):
    invalid_cultural_field("title and purpose must be non-empty strings")

practice = require_exact_keys(cultural["practice"], {"cycle", "antiCopyRules", "periodRule"}, "practice")
if not non_empty_string_list(practice["cycle"]):
    invalid_cultural_field("practice.cycle must be a non-empty string list")
if not non_empty_string_list(practice["antiCopyRules"]):
    invalid_cultural_field("practice.antiCopyRules must be a non-empty string list")
if not non_empty_string(practice["periodRule"]):
    invalid_cultural_field("practice.periodRule must be a non-empty string")

rotation = require_exact_keys(cultural["rotation"], {"selection", "requiredOutput", "reuseRule"}, "rotation")
if not non_empty_string(rotation["selection"]):
    invalid_cultural_field("rotation.selection must be a non-empty string")
if not non_empty_string_list(rotation["requiredOutput"]):
    invalid_cultural_field("rotation.requiredOutput must be a non-empty string list")
if not non_empty_string(rotation["reuseRule"]):
    invalid_cultural_field("rotation.reuseRule must be a non-empty string")

references = cultural["references"]
if not isinstance(references, list) or not references:
    invalid_cultural_field("references must be a non-empty list")
required_translation_fields = {"principle", "candidateCurrents", "experiments", "falsifier", "doNotCopy"}
reference_ids = []

for reference in references:
    reference = require_exact_keys(
        reference,
        {"id", "kind", "title", "url", "author", "observedMechanisms", "translation"},
        "reference",
    )
    translation = require_exact_keys(reference["translation"], required_translation_fields, "reference.translation")
    if not all(non_empty_string(reference[key]) for key in ("id", "kind", "title", "url", "author")):
        invalid_cultural_field("reference identity fields must be non-empty strings")
    if not is_valid_https_url(reference["url"]):
        invalid_cultural_field("reference URLs must be safe HTTPS URLs")
    if not non_empty_string_list(reference["observedMechanisms"]):
        invalid_cultural_field("reference.observedMechanisms must be a non-empty string list")
    if not non_empty_string(translation["principle"]):
        invalid_cultural_field("translation.principle must be a non-empty string")
    if not non_empty_string_list(translation["candidateCurrents"]):
        invalid_cultural_field("translation.candidateCurrents must be a non-empty string list")
    if not non_empty_string_list(translation["experiments"]):
        invalid_cultural_field("translation.experiments must be a non-empty string list")
    if not non_empty_string(translation["falsifier"]):
        invalid_cultural_field("translation.falsifier must be a non-empty string")
    if not non_empty_string(translation["doNotCopy"]):
        invalid_cultural_field("translation.doNotCopy must be a non-empty string")
    reference_ids.append(reference["id"])

if len(set(reference_ids)) != len(reference_ids):
    invalid_cultural_field("reference IDs must be unique")

research_directions = cultural["researchDirections"]
if not isinstance(research_directions, list) or not research_directions:
    invalid_cultural_field("researchDirections must be a non-empty list")
for direction in research_directions:
    direction = require_exact_keys(direction, {"id", "question", "preferredCurrents"}, "research direction")
    if not non_empty_string(direction["id"]) or not non_empty_string(direction["question"]):
        invalid_cultural_field("research direction identity fields must be non-empty strings")
    if not non_empty_string_list(direction["preferredCurrents"]):
        invalid_cultural_field("research direction.preferredCurrents must be a non-empty string list")

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
culture_index = (now.date().toordinal() + selected_index) % len(references)
culture_reference = references[culture_index]

print("MUTINE DAILY SLOT")
print(f"date={date}")
print(f"scheduled_current_id={scheduled_current_id}")
print(f"current_id={current_id}")
print(f"current_index={selected_index + 1}/{len(CURRENT_IDS)}")
print(f"existing_work_id={existing.get('id') if existing else 'none'}")
print(f"action={'verify-only' if existing else 'create-and-record'}")
print(f"culture_reference_id={culture_reference['id']}")
print(f"culture_reference_title={culture_reference['title']}")
