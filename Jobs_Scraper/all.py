import argparse
import glob
import hashlib
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from typing import Dict, List, Optional

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


def dataframe_to_jobs(df: pd.DataFrame) -> List[Dict[str, object]]:
    cleaned = df.copy().fillna("")
    jobs: List[Dict[str, object]] = []

    for record in cleaned.to_dict(orient="records"):
        apply_url = str(record.get("apply_url", "")).strip() or build_internal_apply_url(record)
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
                "experience_level": str(record.get("experience_level", "")).strip() or None,
                "salary": str(record.get("salary", "")).strip() or None,
                "source": str(record.get("source", "")).strip() or None,
                "tags": tags,
            }
        )

    unique_jobs = {job["apply_url"]: job for job in jobs}
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

    uri = os.getenv("MONGODB_URI")
    if not uri:
        raise RuntimeError("Missing MONGODB_URI")

    db_name = os.getenv("MONGODB_DB_NAME", "greenremote")
    collection_name = os.getenv("MONGODB_COLLECTION_NAME", "jobs")
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
        collection.create_index("created_at")
        collection.create_index("source")

        operations = []
        for job in jobs:
            operations.append(
                UpdateOne(
                    {"apply_url": job["apply_url"]},
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
