"""
config.py – Centralised configuration loader.

Reads all values from .env (or real environment variables).
Every module imports from here – no scattered os.getenv() calls.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import List

from dotenv import load_dotenv

# Load .env from the same directory as this file
_ENV_PATH = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(_ENV_PATH, override=False)


def _require(name: str) -> str:
    """Return env var or raise a helpful error."""
    value = os.getenv(name, "").strip()
    if not value:
        raise EnvironmentError(
            f"Required environment variable '{name}' is not set. "
            f"Copy .env.example → .env and fill in your values."
        )
    return value


def _optional(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _optional_int(name: str, default: int) -> int:
    raw = os.getenv(name, "")
    try:
        return int(raw.strip()) if raw.strip() else default
    except ValueError:
        return default


def _optional_float(name: str, default: float) -> float:
    raw = os.getenv(name, "")
    try:
        return float(raw.strip()) if raw.strip() else default
    except ValueError:
        return default


def _optional_bool(name: str, default: bool = True) -> bool:
    raw = os.getenv(name, "").strip().lower()
    if raw in ("false", "0", "no"):
        return False
    if raw in ("true", "1", "yes"):
        return True
    return default


@dataclass
class ScraperConfig:
    # ── Supabase ──────────────────────────────────────────────────────────────
    supabase_url: str = field(default_factory=lambda: _require("SUPABASE_URL"))
    supabase_key: str = field(default_factory=lambda: _require("SUPABASE_SERVICE_ROLE_KEY"))

    # ── LinkedIn credentials (optional) ───────────────────────────────────────
    linkedin_email: str = field(default_factory=lambda: _optional("LINKEDIN_EMAIL"))
    linkedin_password: str = field(default_factory=lambda: _optional("LINKEDIN_PASSWORD"))

    # ── Search parameters ─────────────────────────────────────────────────────
    search_queries: List[str] = field(default_factory=lambda: [
        q.strip()
        for q in _optional(
            "SEARCH_QUERIES",
            "remote developer,remote software engineer,remote python developer",
        ).split(",")
        if q.strip()
    ])
    search_locations: List[str] = field(default_factory=lambda: [
        loc.strip()
        for loc in _optional("SEARCH_LOCATIONS", "Worldwide").split(",")
        if loc.strip()
    ])
    max_jobs_per_run: int = field(default_factory=lambda: _optional_int("MAX_JOBS_PER_RUN", 150))

    # ── Rate limiting ─────────────────────────────────────────────────────────
    delay_min: float = field(default_factory=lambda: _optional_float("DELAY_MIN", 2.0))
    delay_max: float = field(default_factory=lambda: _optional_float("DELAY_MAX", 5.0))

    # ── Browser ───────────────────────────────────────────────────────────────
    headless: bool = field(default_factory=lambda: _optional_bool("HEADLESS", True))

    # ── Database ──────────────────────────────────────────────────────────────
    db_table: str = "jobs"
    db_schema: str = "public"
    conflict_column: str = "source_url"      # upsert on this unique column
    source_name: str = "LinkedIn"

    # ── Scheduling ────────────────────────────────────────────────────────────
    run_interval_hours: int = 6


# Module-level singleton – import this everywhere.
cfg = ScraperConfig()
