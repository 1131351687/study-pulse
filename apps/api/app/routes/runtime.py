from __future__ import annotations

import json
import os
import signal
import subprocess
import threading
from typing import Any

from fastapi import APIRouter

from app.config import get_settings

router = APIRouter(tags=["runtime"])


@router.get("/runtime/status")
def read_runtime_status() -> dict[str, Any]:
    state = _read_runtime_state()
    return {
        "managed": bool(state),
        "backend": _process_status(state.get("backend")),
        "frontend": _process_status(state.get("frontend")),
        "updatedAt": state.get("updatedAt", ""),
    }


@router.post("/runtime/stop")
def stop_runtime() -> dict[str, Any]:
    state = _read_runtime_state()
    backend = _stop_process(state.get("backend"), delay_seconds=0.8)
    frontend = _stop_process(state.get("frontend"))
    return {
        "stopped": backend or frontend,
        "backendStopped": backend,
        "frontendStopped": frontend,
    }


def _read_runtime_state() -> dict[str, Any]:
    settings = get_settings()
    if not settings.runtime_state_path.exists():
        return {}
    try:
        return json.loads(settings.runtime_state_path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError):
        return {}


def _process_status(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        return {"running": False, "pid": None, "startedAt": "", "label": ""}
    pid = payload.get("pid")
    running = _is_running(pid)
    return {
        "running": running,
        "pid": pid if running else None,
        "startedAt": str(payload.get("startedAt") or ""),
        "label": str(payload.get("label") or ""),
    }


def _is_running(pid: Any) -> bool:
    if not isinstance(pid, int):
        return False
    if os.name == "nt":
        result = subprocess.run(
            ["tasklist", "/FI", f"PID eq {pid}"],
            capture_output=True,
            text=True,
            check=False,
        )
        return str(pid) in result.stdout
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def _stop_process(payload: Any, delay_seconds: float = 0.0) -> bool:
    if not isinstance(payload, dict):
        return False
    pid = payload.get("pid")
    if not isinstance(pid, int):
        return False
    try:
        if delay_seconds > 0:
            timer = threading.Timer(delay_seconds, _terminate_pid, args=(pid,))
            timer.daemon = True
            timer.start()
        else:
            _terminate_pid(pid)
        return True
    except OSError:
        return False


def _terminate_pid(pid: int) -> None:
    if os.name == "nt":
        subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"], check=False, capture_output=True)
        return
    os.kill(pid, signal.SIGTERM)
