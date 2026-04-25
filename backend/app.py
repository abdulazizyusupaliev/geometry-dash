from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "backend" / "data"
LEVEL_PATH = DATA_DIR / "level.json"
SCORES_PATH = DATA_DIR / "scores.json"


class RunPayload(BaseModel):
    player: str = Field(min_length=1, max_length=32)
    progress: int = Field(ge=0, le=100)
    attempts: int = Field(ge=0, le=9999)
    collected_orbs: int = Field(ge=0, le=99)
    completed: bool
    duration_ms: int = Field(ge=0, le=3_600_000)


app = FastAPI(title="Pulse Dash API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "online", "engine": "FastAPI"}


@app.get("/api/level")
def get_level() -> dict[str, Any]:
    level = load_json(LEVEL_PATH, default=None)
    if level is None:
        raise HTTPException(status_code=404, detail="Level data not found")
    return {"level": level}


@app.get("/api/scores")
def get_scores() -> dict[str, list[dict[str, Any]]]:
    scores = load_json(SCORES_PATH, default={"scores": []})
    scores["scores"] = sorted(
        scores.get("scores", []),
        key=lambda item: (item["completed"], item["progress"], item["collected_orbs"]),
        reverse=True,
    )[:10]
    return scores


@app.post("/api/run")
def post_run(payload: RunPayload) -> dict[str, Any]:
    scores = load_json(SCORES_PATH, default={"scores": []})
    run_entry = payload.model_dump()
    run_entry["created_at"] = datetime.now(timezone.utc).isoformat()
    scores.setdefault("scores", []).append(run_entry)
    scores["scores"] = sorted(
        scores["scores"],
        key=lambda item: (item["completed"], item["progress"], item["collected_orbs"]),
        reverse=True,
    )[:20]
    write_json(SCORES_PATH, scores)
    return {"saved": True, "run": run_entry}


app.mount("/static", StaticFiles(directory=BASE_DIR), name="static")


@app.get("/")
def root() -> FileResponse:
    return FileResponse(BASE_DIR / "index.html")
