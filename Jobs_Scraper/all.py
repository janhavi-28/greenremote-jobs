import argparse
import glob
import hashlib
import json
import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import pandas as pd
from dotenv import load_dotenv


def load_env() -> None:
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    dotenv_path = os.path.join(repo_root, ".env")
    load_dotenv(dotenv_path)

SCRAPERS = {
    "amazon": "Amazon/amazon.py",
    "cutshort": "CutShort/cutshort.py",
    "google": "Google/google_scraper.py",
    "hirist": "Hirist/hirist_scraper.py",
    "internshala": "Internshala/Internshala_intern.py",
    "jobsora": "jobsora/jobsora_scraper.py",
    "linkedin": "Linkedin/l2.py",
    "remoteok": "remoteok/remoteok.py",
    "weworkremotely": "WeWorkRemotely/we_work_remotely.py",
}

DATA_GLOBS = {
    "amazon": ["data/amazon_jobs_*.csv", "Amazon/data/*.csv"],
    "cutshort": ["data/cutshort_jobs_*.csv", "CutShort/data/*.csv"],
    "google": ["data/google_jobs_*.csv", "Google/data/*.csv"],
    "hirist": ["data/hirist_jobs_*.csv", "Hirist/data/*.csv"],
    "internshala": ["data/internshala*.csv", "Internshala/data/*.csv"],
    "jobsora": ["data/jobsora_jobs_*.csv", "jobsora/data/*.csv"],
    "linkedin": ["data/linkedin_jobs_*.csv", "Linkedin/data/*.csv"],
    "remoteok": ["data/remoteok_jobs_*.csv", "remoteok/data/*.csv"],
    "weworkremotely": ["data/weworkremotely_jobs_*.csv", "WeWorkRemotely/data/*.csv"],
}


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--scope", default="all")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--skip-snapshot", action="store_true")
    parser.add_argument("--timeout", type=int, default=120)
    parser.add_argument("--recent-days", type=int, default=None)
    return parser.parse_args()


def selected_scrapers(scope: str):
    if scope == "all":
        return list(SCRAPERS.items())
    if scope not in SCRAPERS:
        raise ValueError(f"Unknown scope: {scope}")
    return [(scope, SCRAPERS[scope])]


def run_scraper(name: str, script: str, timeout_seconds: int) -> Dict[str, object]:
    try:
        completed = subprocess.run(
            [sys.executable, script],
            cwd=os.path.dirname(__file__),
            capture_output=True,
            text=True,
            errors="replace",
            timeout=timeout_seconds,
        )
        return {
            "name": name,
            "script": script,
            "success": completed.returncode == 0,
            "returncode": completed.returncode,
            "stdout": completed.stdout[-1200:],
            "stderr": completed.stderr[-1200:],
        }
    except subprocess.TimeoutExpired as exc:
        return {
            "name": name,
            "script": script,
            "success": False,
            "returncode": -1,
            "stdout": (exc.stdout or "")[-1200:],
            "stderr": f"Timed out after {timeout_seconds}s. {(exc.stderr or '')}"[-1200:],
        }


def pick_column(df: pd.DataFrame, columns: List[str]) -> pd.Series:
    for column in columns:
        if column in df.columns:
            return df[column]
    return pd.Series([None] * len(df))


def get_latest_csv(patterns: List[str]) -> Optional[str]:
    files: List[str] = []
    base_dir = os.path.dirname(__file__)
    for pattern in patterns:
        files.extend(glob.glob(os.path.join(base_dir, pattern)))
    if not files:
        return None
    return max(files, key=os.path.getctime)


def normalize(df: pd.DataFrame, source: str) -> pd.DataFrame:
    working = df.copy()
    working.columns = [str(col).lower() for col in working.columns]

    normalized = pd.DataFrame(
        {
            "title": pick_column(working, ["title"]),
            "company": pick_column(working, ["company"]),
            "location": pick_column(working, ["location"]),
            "category": pick_column(working, ["category"]),
            "description": pick_column(working, ["description"]),
            "publication_date": pick_column(
                working, ["publication_date", "date", "posted_on", "date_posted"]
            ),
            "apply_url": pick_column(working, ["link", "apply_url", "job_url", "url"]),
            "experience_level": pick_column(working, ["experience_level", "experience"]),
            "salary": pick_column(working, ["salary", "salary_min"]),
            "tags": pick_column(working, ["tags"]),
        }
    )

    normalized["source"] = source
    normalized["location"] = normalized["location"].fillna("Remote")
    normalized["company"] = normalized["company"].fillna("Unknown Company")
    return normalized


def build_internal_apply_url(record: Dict[str, object]) -> str:
    raw = "|".join(
        [
            str(record.get("title", "")).strip(),
            str(record.get("company", "")).strip(),
            str(record.get("location", "")).strip(),
            str(record.get("publication_date", "")).strip(),
        ]
    )
    digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()
    return f"internal://jobs-scraper/{digest}"


def canonicalize_apply_url(url: str) -> str:
    raw = (url or "").strip()
    if not raw:
        return ""

    parsed = urlsplit(raw)
    scheme = (parsed.scheme or "https").lower()
    netloc = parsed.netloc.lower()
    path = parsed.path.rstrip("/")

    # Keep only meaningful query params and drop common tracking noise.
    allowed_query = []
    for key, value in parse_qsl(parsed.query, keep_blank_values=False):
        key_lower = key.lower()
        if key_lower.startswith("utm_"):
            continue
        if key_lower in {
            "trk",
            "trkemail",
            "trackingid",
            "refid",
            "ref",
            "src",
            "source",
            "campaignid",
        }:
            continue
        allowed_query.append((key, value))

    query = urlencode(allowed_query, doseq=True)
    return urlunsplit((scheme, netloc, path, query, ""))


def build_dedupe_key(record: Dict[str, object], apply_url: str) -> str:
    source = str(record.get("source", "")).strip().lower()
    if apply_url:
        return f"url::{source}::{apply_url}"

    fallback = "|".join(
        [
            source,
            str(record.get("title", "")).strip().lower(),
            str(record.get("company", "")).strip().lower(),
            str(record.get("location", "")).strip().lower(),
            str(record.get("publication_date", "")).strip().lower(),
        ]
    )
    digest = hashlib.sha1(fallback.encode("utf-8")).hexdigest()
    return f"fallback::{source}::{digest}"


def parse_publication_datetime(value: object) -> Optional[datetime]:
    raw = str(value or "").strip()
    if not raw or raw.lower() in {"not specified", "nan", "none", "null"}:
        return None

    normalized = raw.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except ValueError:
        pass

    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%m-%d-%Y", "%b %d, %Y", "%B %d, %Y"):
        try:
            return datetime.strptime(raw, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue

    return None


def filter_recent_jobs(df: pd.DataFrame, recent_days: Optional[int]) -> pd.DataFrame:
    if df.empty or recent_days is None or recent_days <= 0:
        return df

    cutoff = datetime.now(timezone.utc) - timedelta(days=recent_days)
    parsed_dates = df["publication_date"].apply(parse_publication_datetime)
    keep_mask = parsed_dates.apply(lambda value: value is None or value >= cutoff)
    return df[keep_mask].reset_index(drop=True)


def dataframe_to_jobs(df: pd.DataFrame) -> List[Dict[str, object]]:
    cleaned = df.copy().fillna("")
    jobs: List[Dict[str, object]] = []

    for record in cleaned.to_dict(orient="records"):
        raw_apply_url = str(record.get("apply_url", "")).strip()
        canonical_apply_url = canonicalize_apply_url(raw_apply_url)
        apply_url = canonical_apply_url or build_internal_apply_url(record)
        tags = [tag.strip() for tag in str(record.get("tags", "")).split(",") if tag.strip()]
        jobs.append(
            {
                "title": str(record.get("title", "")).strip(),
                "company": str(record.get("company", "")).strip() or "Unknown Company",
                "location": str(record.get("location", "")).strip() or "Remote",
                "category": str(record.get("category", "")).strip() or None,
                "description": str(record.get("description", "")).strip() or None,
                "publication_date": str(record.get("publication_date", "")).strip() or None,
                "apply_url": apply_url,
                "raw_apply_url": raw_apply_url or None,
                "dedupe_key": build_dedupe_key(record, apply_url),
                "experience_level": str(record.get("experience_level", "")).strip() or None,
                "salary": str(record.get("salary", "")).strip() or None,
                "source": str(record.get("source", "")).strip() or None,
                "tags": tags,
            }
        )

    unique_jobs = {job["dedupe_key"]: job for job in jobs}
    return list(unique_jobs.values())


def save_snapshot(df: pd.DataFrame) -> str:
    filename = f"jobs_clean_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.xlsx"
    path = os.path.join(os.path.dirname(__file__), filename)
    snapshot_df = df.copy().fillna("")
    snapshot_df.to_excel(path, index=False)
    return filename


def save_latest_payload(payload: Dict[str, object]) -> None:
    path = os.path.join(os.path.dirname(__file__), "latest_jobs.json")
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False)


def upsert_to_mongo(jobs: List[Dict[str, object]]) -> Dict[str, int]:
    import certifi
    from pymongo import MongoClient, UpdateOne

    uri = (os.getenv("MONGODB_URI") or "").strip()
    if not uri:
        raise RuntimeError("Missing MONGODB_URI")

    db_name = (os.getenv("MONGODB_DB_NAME", "greenremote") or "greenremote").strip()
    collection_name = (os.getenv("MONGODB_COLLECTION_NAME", "jobs") or "jobs").strip()
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    client = MongoClient(
        uri,
        appname="greenremote-jobs-scraper",
        tlsCAFile=certifi.where(),
        serverSelectionTimeoutMS=30000,
        connectTimeoutMS=30000,
    )
    try:
        collection = client[db_name][collection_name]
        collection.create_index("apply_url", unique=True)
        collection.create_index("dedupe_key", sparse=True)
        collection.create_index("created_at")
        collection.create_index("source")

        operations = []
        for job in jobs:
            operations.append(
                UpdateOne(
                    {
                        "$or": [
                            {"dedupe_key": job["dedupe_key"]},
                            {"apply_url": job["apply_url"]},
                        ]
                    },
                    {
                        "$set": {
                            **job,
                            "updated_at": now,
                        },
                        "$setOnInsert": {
                            "created_at": now,
                        },
                    },
                    upsert=True,
                )
            )

        if not operations:
            return {"inserted": 0, "matched": 0, "modified": 0}

        result = collection.bulk_write(operations, ordered=False)
        return {
            "inserted": result.upserted_count,
            "matched": result.matched_count,
            "modified": result.modified_count,
        }
    finally:
        client.close()


def main():
    load_env()
    args = parse_args()
    runs = []
    frames = []
    source_files = {}

    for name, script in selected_scrapers(args.scope):
        run = run_scraper(name, script, args.timeout)
        runs.append(run)

        latest_csv = get_latest_csv(DATA_GLOBS[name])
        if latest_csv:
            source_files[name] = os.path.basename(latest_csv)
            try:
                frames.append(normalize(pd.read_csv(latest_csv), name))
            except Exception as exc:
                runs.append(
                    {
                        "name": name,
                        "script": os.path.basename(latest_csv),
                        "success": False,
                        "returncode": 1,
                        "stderr": str(exc),
                    }
                )

    merged = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
    merged = filter_recent_jobs(merged, args.recent_days or int(os.getenv("SCRAPER_RECENT_DAYS", "30")))
    jobs = dataframe_to_jobs(merged) if not merged.empty else []
    snapshot_file = None if args.skip_snapshot or merged.empty else save_snapshot(merged)

    mongo_summary = {"inserted": 0, "matched": 0, "modified": 0}
    if not args.dry_run:
        mongo_summary = upsert_to_mongo(jobs)

    payload = {
        "ok": True,
        "total": len(jobs),
        "inserted": mongo_summary["inserted"],
        "matched": mongo_summary["matched"],
        "modified": mongo_summary["modified"],
        "jobs": jobs,
        "snapshot_file": snapshot_file,
        "source_files": source_files,
        "scrapers": runs,
        "dry_run": args.dry_run,
    }
    save_latest_payload(payload)
    sys.stdout.write(json.dumps(payload))


if __name__ == "__main__":
    main()
