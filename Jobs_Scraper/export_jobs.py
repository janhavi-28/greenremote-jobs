import argparse
import glob
import hashlib
import json
import os
import sys
from typing import Dict, List, Optional

import pandas as pd


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--scope", default="latest-xlsx")
    return parser.parse_args()


def pick_column(df: pd.DataFrame, columns: List[str]) -> pd.Series:
    for column in columns:
        if column in df.columns:
            return df[column]
    return pd.Series([None] * len(df))


def get_latest_workbook() -> Optional[str]:
    base_dir = os.path.dirname(__file__)
    files = glob.glob(os.path.join(base_dir, "jobs_clean_*.xlsx"))
    if not files:
        return None
    return max(files, key=os.path.getctime)


def normalize(df: pd.DataFrame) -> pd.DataFrame:
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
            "apply_url": pick_column(working, ["apply_url", "link", "job_url", "url"]),
            "experience_level": pick_column(working, ["experience_level", "experience"]),
            "salary": pick_column(working, ["salary", "salary_min"]),
            "tags": pick_column(working, ["tags"]),
            "source": pick_column(working, ["source"]),
        }
    )

    normalized["location"] = normalized["location"].fillna("Remote")
    normalized["category"] = normalized["category"].where(
        normalized["category"].notna(), None
    )
    normalized["description"] = normalized["description"].where(
        normalized["description"].notna(), None
    )
    normalized["publication_date"] = normalized["publication_date"].where(
        normalized["publication_date"].notna(), None
    )
    normalized["experience_level"] = normalized["experience_level"].where(
        normalized["experience_level"].notna(), None
    )
    normalized["salary"] = normalized["salary"].where(normalized["salary"].notna(), None)
    normalized["source"] = normalized["source"].replace("", pd.NA).fillna("jobs_clean_xlsx")

    return normalized


def build_internal_apply_url(record: Dict[str, object]) -> str:
    raw = "|".join(
        [
            str(record.get("title", "")).strip(),
            str(record.get("company", "")).strip(),
            str(record.get("location", "")).strip(),
            str(record.get("publication_date", "")).strip(),
            str(record.get("description", "")).strip()[:120],
        ]
    )
    digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()
    return f"internal://jobs-clean-xlsx/{digest}"


def dataframe_to_jobs(df: pd.DataFrame) -> List[Dict[str, object]]:
    cleaned = df.copy().fillna("")

    jobs = []
    for record in cleaned.to_dict(orient="records"):
        tags = record.get("tags", "")
        apply_url = str(record.get("apply_url", "")).strip() or build_internal_apply_url(record)
        jobs.append(
            {
                "title": str(record.get("title", "")).strip(),
                "company": str(record.get("company", "")).strip() or "Unknown Company",
                "location": str(record.get("location", "Remote")).strip() or "Remote",
                "category": str(record.get("category", "")).strip() or None,
                "description": str(record.get("description", "")).strip() or None,
                "publication_date": str(record.get("publication_date", "")).strip() or None,
                "apply_url": apply_url,
                "experience_level": str(record.get("experience_level", "")).strip() or None,
                "salary": str(record.get("salary", "")).strip() or None,
                "source": str(record.get("source", "")).strip() or None,
                "tags": [tag.strip() for tag in str(tags).split(",") if tag.strip()],
            }
        )
    unique_jobs = {job["apply_url"]: job for job in jobs}
    jobs = list(unique_jobs.values())
    return jobs


def main():
    _args = parse_args()
    workbook = get_latest_workbook()

    if not workbook:
        payload = {
            "ok": False,
            "total": 0,
            "jobs": [],
            "source_file": None,
            "scrapers": [],
            "error": "No jobs_clean_*.xlsx file found in Jobs_Scraper",
        }
        sys.stdout.write(json.dumps(payload))
        return

    normalized = normalize(pd.read_excel(workbook))
    jobs = dataframe_to_jobs(normalized)

    payload = {
        "ok": True,
        "total": len(jobs),
        "jobs": jobs,
        "source_file": os.path.basename(workbook),
        "scrapers": [
            {
                "name": "latest-xlsx",
                "script": os.path.basename(workbook),
                "success": True,
                "returncode": 0,
            }
        ],
    }

    sys.stdout.write(json.dumps(payload))


if __name__ == "__main__":
    main()
