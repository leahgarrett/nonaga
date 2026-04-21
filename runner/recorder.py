from __future__ import annotations
import json
import os
from datetime import datetime


def save_results(data: dict, output_dir: str) -> str:
    os.makedirs(output_dir, exist_ok=True)
    run_id = data.get("run_id", datetime.now().strftime("%Y-%m-%dT%H-%M-%S"))
    filename = run_id.replace(":", "-") + ".json"
    path = os.path.join(output_dir, filename)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    return path


def load_results(path: str) -> dict:
    with open(path) as f:
        return json.load(f)


def load_latest_results(results_dir: str) -> dict | None:
    if not os.path.isdir(results_dir):
        return None
    files = sorted(
        [f for f in os.listdir(results_dir) if f.endswith(".json")],
        reverse=True,
    )
    return load_results(os.path.join(results_dir, files[0])) if files else None
