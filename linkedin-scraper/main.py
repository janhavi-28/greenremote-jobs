"""
main.py – Entry point for the LinkedIn scraper service.

Modes
─────
  python main.py            → run once immediately, then schedule every 6 h
  python main.py --once     → single run and exit (useful for cron / CI)
  python main.py --test     → lightweight smoke test (no real scrape)

Scheduling
──────────
The built-in `schedule` library runs the pipeline every N hours
(cfg.run_interval_hours, default = 6) in an infinite loop. For
production deployments on Railway / Render / Fly.io you can alternatively
use one-shot runs triggered by GitHub Actions or platform cron jobs with
the `--once` flag.
"""

from __future__ import annotations

import argparse
import sys
import time

import schedule

from config import cfg
from logger import log
from pipeline import run_pipeline


def _run_once() -> None:
    """Execute a single pipeline run, exiting non-zero on failure."""
    try:
        inserted, updated = run_pipeline()
        log.info("Run complete — inserted=%d, updated=%d", inserted, updated)
    except Exception as exc:
        log.error("Unhandled error in pipeline: %s", exc)
        sys.exit(1)


def _smoke_test() -> None:
    """Validate configuration and imports without hitting LinkedIn."""
    log.info("Smoke test: validating configuration …")
    log.info("  SUPABASE_URL          = %s", cfg.supabase_url)
    log.info("  DB table              = %s.%s", cfg.db_schema, cfg.db_table)
    log.info("  Search queries        = %s", cfg.search_queries)
    log.info("  Search locations      = %s", cfg.search_locations)
    log.info("  Max jobs per run      = %d", cfg.max_jobs_per_run)
    log.info("  Schedule interval     = every %d hours", cfg.run_interval_hours)
    log.info("  LinkedIn credentials  = %s",
             "configured" if cfg.linkedin_email else "NOT configured (public scrape only)")

    # Quick Supabase connection test via raw HTTP (avoids client-version issues)
    import httpx
    url = f"{cfg.supabase_url}/rest/v1/{cfg.db_table}?select=id&limit=1"
    headers = {
        "apikey": cfg.supabase_key,
        "Authorization": f"Bearer {cfg.supabase_key}",
    }
    try:
        resp = httpx.get(url, headers=headers, timeout=10)
        if resp.status_code in (200, 206):
            log.info("  Supabase connection   = ✅ OK (HTTP %d)", resp.status_code)
        else:
            log.error(
                "  Supabase connection   = ❌ FAILED: HTTP %d — %s",
                resp.status_code, resp.text[:300],
            )
            sys.exit(1)
    except Exception as exc:
        log.error("  Supabase connection   = ❌ FAILED: %s", exc)
        sys.exit(1)

    log.info("Smoke test passed ✅")



def _run_scheduler() -> None:
    """Run immediately then repeat every N hours forever."""
    log.info("Scheduler started — pipeline will run every %d hours.", cfg.run_interval_hours)

    # First run immediately so we don't wait 6 hours on deploy
    _run_once()

    schedule.every(cfg.run_interval_hours).hours.do(_run_once)

    while True:
        schedule.run_pending()
        time.sleep(60)   # check every minute


def main() -> None:
    parser = argparse.ArgumentParser(
        description="LinkedIn job scraper service for GreenRemote Jobs",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run the pipeline once and exit (no scheduling).",
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Smoke-test configuration and Supabase connection, then exit.",
    )
    args = parser.parse_args()

    if args.test:
        _smoke_test()
    elif args.once:
        _run_once()
    else:
        _run_scheduler()


if __name__ == "__main__":
    main()
