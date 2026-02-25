"""
db.py – Supabase integration layer using direct HTTP (PostgREST API).

Uses raw httpx instead of supabase-py so the new sb_secret_... key format
works correctly regardless of supabase-py version.

Handles:
  • Batch upsert with conflict resolution on `source_url`
  • Reporting inserted vs. updated counts
  • Retry logic via tenacity
"""

from __future__ import annotations

import logging
from typing import Dict, List, Tuple

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, before_sleep_log

from config import cfg
from logger import log

# ── HTTP client factory ───────────────────────────────────────────────────────

def _headers() -> Dict[str, str]:
    return {
        "apikey":        cfg.supabase_key,
        "Authorization": f"Bearer {cfg.supabase_key}",
        "Content-Type":  "application/json",
    }

def _base_url() -> str:
    return f"{cfg.supabase_url}/rest/v1"


# ── Upsert ────────────────────────────────────────────────────────────────────

_BATCH_SIZE = 50


@retry(
    stop=stop_after_attempt(4),
    wait=wait_exponential(multiplier=2, min=3, max=30),
    before_sleep=before_sleep_log(log, logging.WARNING),  # type: ignore[arg-type]
    reraise=True,
)
def _upsert_batch(rows: List[Dict]) -> Tuple[int, int]:
    """
    Upsert a single batch via PostgREST; returns (inserted, updated).

    We pre-fetch existing source_urls to accurately count inserts vs updates.
    """
    urls = [r["source_url"] for r in rows]

    # ── 1. Find which source_urls already exist ────────────────────────────
    # PostgREST: GET /jobs?source_url=in.(url1,url2,...)&select=source_url
    encoded = ",".join(f'"{u}"' for u in urls)
    check_url = (
        f"{_base_url()}/{cfg.db_table}"
        f"?source_url=in.({encoded})"
        f"&select=source_url"
    )
    check_resp = httpx.get(check_url, headers=_headers(), timeout=20)
    check_resp.raise_for_status()
    existing_urls = {row["source_url"] for row in check_resp.json()}

    inserted_count = sum(1 for r in rows if r["source_url"] not in existing_urls)
    updated_count  = sum(1 for r in rows if r["source_url"] in existing_urls)

    # ── 2. Upsert ─────────────────────────────────────────────────────────
    # Prefer: resolution=merge-duplicates  →  UPDATE on conflict
    upsert_url = (
        f"{_base_url()}/{cfg.db_table}"
        f"?on_conflict={cfg.conflict_column}"
    )
    upsert_headers = {
        **_headers(),
        "Prefer": "resolution=merge-duplicates",
    }
    resp = httpx.post(upsert_url, headers=upsert_headers, json=rows, timeout=30)

    if resp.status_code not in (200, 201, 204):
        raise RuntimeError(
            f"Supabase upsert failed: HTTP {resp.status_code} — {resp.text[:300]}"
        )

    return inserted_count, updated_count


def upsert_jobs(jobs: List[Dict]) -> Tuple[int, int]:
    """
    Upsert all *jobs* into `public.jobs` in batches of {_BATCH_SIZE}.
    Returns (total_inserted, total_updated).
    """
    if not jobs:
        return 0, 0

    total_inserted = 0
    total_updated  = 0
    total_batches  = -(-len(jobs) // _BATCH_SIZE)  # ceiling division

    for i in range(0, len(jobs), _BATCH_SIZE):
        batch      = jobs[i: i + _BATCH_SIZE]
        batch_num  = i // _BATCH_SIZE + 1
        try:
            ins, upd = _upsert_batch(batch)
            total_inserted += ins
            total_updated  += upd
            log.info(
                "  Batch %d/%d → inserted=%d, updated=%d",
                batch_num, total_batches, ins, upd,
            )
        except Exception as exc:
            log.error(
                "  Failed to upsert batch %d: %s — skipping batch",
                batch_num, exc,
            )
            continue

    return total_inserted, total_updated
