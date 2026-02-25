"""
pipeline.py – Orchestrates one complete scrape → normalise → translate → upsert cycle.

Call `run_pipeline()` from main.py or your scheduler.
"""

from __future__ import annotations

import time
from typing import Tuple

from config import cfg
from db import upsert_jobs
from logger import log
from normalizer import normalise_job
from scraper import LinkedInScraper
from translator import translate_job_fields


def run_pipeline() -> Tuple[int, int]:
    """
    Execute one full scrape cycle.

    Returns (inserted, updated) counts.
    """
    start_ts = time.time()
    log.info("=" * 60)
    log.info("Pipeline start")
    log.info("=" * 60)

    # ── 1. Scrape ─────────────────────────────────────────────────────────────
    log.info("STEP 1/3 — Scraping LinkedIn …")
    scraper = LinkedInScraper()
    try:
        raw_jobs = scraper.scrape()
    except Exception as exc:
        log.error("Scraping failed: %s", exc)
        return 0, 0

    log.info("Scraped %d raw jobs", len(raw_jobs))
    if not raw_jobs:
        log.warning("No jobs scraped — aborting pipeline.")
        return 0, 0

    # ── 2. Normalise ──────────────────────────────────────────────────────────
    log.info("STEP 2/3 — Normalising and translating …")
    normalised = []
    skipped = 0

    for i, raw in enumerate(raw_jobs, 1):
        normed = normalise_job(raw, source=cfg.source_name)
        if normed is None:
            skipped += 1
            continue

        # Translate (skips if already English)
        try:
            normed = translate_job_fields(normed)
        except Exception as exc:
            log.warning("  [%d/%d] Translation error for '%s': %s — using original",
                        i, len(raw_jobs), normed.get("title", "?"), exc)

        normalised.append(normed)
        if i % 25 == 0:
            log.info("  Processed %d/%d jobs …", i, len(raw_jobs))

    log.info(
        "Normalisation complete: %d valid, %d skipped (no source_url)",
        len(normalised), skipped,
    )

    if not normalised:
        log.warning("No valid jobs after normalisation — aborting pipeline.")
        return 0, 0

    # ── 3. Upsert ─────────────────────────────────────────────────────────────
    log.info("STEP 3/3 — Upserting to Supabase (table: %s) …", cfg.db_table)
    try:
        inserted, updated = upsert_jobs(normalised)
    except Exception as exc:
        log.error("Upsert failed: %s", exc)
        return 0, 0

    elapsed = time.time() - start_ts
    log.info("=" * 60)
    log.info(
        "Pipeline complete in %.1fs  |  inserted=%d  updated=%d  total=%d",
        elapsed, inserted, updated, inserted + updated,
    )
    log.info("=" * 60)
    return inserted, updated
