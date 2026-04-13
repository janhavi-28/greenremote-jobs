import re
#!/usr/bin/env python3

import csv
import datetime as dt
import json
import re
import time
import os
import glob
from dataclasses import dataclass, asdict
from typing import List, Optional

import requests
from bs4 import BeautifulSoup


BASE_URL = "https://www.google.com/about/careers/applications/jobs/results"

HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept-Language": "en-US,en;q=0.9",
}


# ===== DATA MODEL =====
@dataclass
class JobRecord:
    job_id: str
    title: Optional[str]
    company: Optional[str]
    locations: Optional[str]
    posted_at_utc: Optional[str]
    apply_url: Optional[str]
    description: Optional[str]
    source_page: int


# ===== LOAD OLD JOBS =====
def load_existing_ids():
    existing_ids = set()

    os.makedirs("data", exist_ok=True)

    files = glob.glob("data/google_jobs_*.csv")

    for file in files:
        try:
            with open(file, newline="", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row.get("job_id"):
                        existing_ids.add(row["job_id"])
        except:
            continue

    return existing_ids


# ===== CLEAN TEXT =====
def clean_text(value):
    if not value:
        return None
    return re.sub(r"\s+", " ", value).strip()


def html_to_text(value):
    if not value:
        return None

    text = BeautifulSoup(value, "html.parser").get_text("\n", strip=True)
    lines = [clean_text(line) for line in text.splitlines()]
    lines = [line for line in lines if line]

    return "\n".join(lines) if lines else None


def epoch_to_iso(value):
    try:
        ts = int(value)
    except:
        return None

    return dt.datetime.fromtimestamp(ts, dt.timezone.utc).isoformat().replace("+00:00", "Z")


# ===== EXTRACT JOB DATA =====
def extract_ds1_jobs(html):
    m = re.search(
        r"AF_initDataCallback\(\{key:\s*'ds:1'.*?data:(\[.*?\]),\s*sideChannel",
        html,
        re.S,
    )

    if not m:
        return []

    try:
        payload = json.loads(m.group(1))
    except:
        return []

    if not payload:
        return []

    jobs = payload[0]

    if not jobs or not isinstance(jobs, list):
        return []

    return [item for item in jobs if isinstance(item, list) and item]


# ===== FETCH PAGE =====
def fetch_page(session, page):
    for attempt in range(3):
        try:
            r = session.get(
                BASE_URL,
                params={"page": page},
                timeout=30
            )
            r.raise_for_status()
            return r.text
        except requests.exceptions.RequestException:
            print(f"Retry {attempt+1}/3 for page {page}")
            time.sleep(2)

    return ""


# ===== PARSE JOB (FIXED LOCATION) =====
def parse_job(item, source_page):

    job_id = str(item[0]) if len(item) > 0 else ""

    title = clean_text(str(item[1])) if len(item) > 1 else None

    apply_url = clean_text(str(item[2])) if len(item) > 2 else None

    company = clean_text(str(item[7])) if len(item) > 7 else "Google"

    # ✅ FIX: extract location properly
    location = None
    if len(item) > 9:
        loc_data = item[9]
        if isinstance(loc_data, list) and loc_data:
            location = ", ".join([clean_text(str(l)) for l in loc_data if l])

    # description
    description_html = None
    if len(item) > 10 and isinstance(item[10], list) and len(item[10]) > 1:
        description_html = item[10][1]

    # date
    posted_at = None
    if len(item) > 12 and isinstance(item[12], list) and item[12]:
        posted_at = epoch_to_iso(item[12][0])

    return JobRecord(
        job_id=job_id,
        title=title,
        company=company,
        locations=location,   # ✅ FIXED
        posted_at_utc=posted_at,
        apply_url=apply_url,
        description=html_to_text(description_html),
        source_page=source_page
    )


# ===== SCRAPE =====
def scrape_jobs():
    session = requests.Session()
    session.headers.update(HEADERS)

    existing_ids = load_existing_ids()
    print("Previously scraped jobs:", len(existing_ids))

    seen_ids = set(existing_ids)
    results = []

    for page in range(1, 20):   # limit pages for speed
        print("Fetching page", page)

        html = fetch_page(session, page)

        if not html:
            break

        raw_jobs = extract_ds1_jobs(html)

        if not raw_jobs:
            print("No more jobs found. Stopping.")
            break

        for item in raw_jobs:
            job = parse_job(item, page)

            if not job.job_id:
                continue

            if job.job_id in seen_ids:
                continue

            seen_ids.add(job.job_id)
            results.append(job)

        time.sleep(1)

    return results


# ===== SAVE =====
def save_jobs(records):
    if not records:
        print("No new jobs found")
        return

    os.makedirs("data", exist_ok=True)

    timestamp = dt.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")

    filename = f"data/google_jobs_{timestamp}.csv"

    fields = [f.name for f in JobRecord.__dataclass_fields__.values()]

    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)

        writer.writeheader()

        for record in records:
            writer.writerow(asdict(record))

    print(f"\n✅ Saved {len(records)} jobs -> {filename}")


# ===== MAIN =====
def main():
    print("\n🚀 Starting Google Jobs Scraper...\n")

    jobs = scrape_jobs()
    if jobs:
        normalized_jobs = [normalize_job(asdict(job)) for job in jobs]
        save_jobs_unified(normalized_jobs)
    else:
        print("No new jobs found")


# --- Unified schema helpers ---
def extract_experience(text):
    if not text:
        return "Not specified"
    match = re.search(r'(\d+\+?\s*(?:years?|yrs?))', text, re.IGNORECASE)
    return match.group(1) if match else "Not specified"

def extract_salary(text):
    if not text:
        return "Not disclosed"
    match = re.search(r'(\$?\d+[\d,]*(?:\s*-\s*\$?\d+[\d,]*)?)', text)
    return match.group(1) if match else "Not disclosed"

def extract_skills(text):
    if not text:
        return "Not specified"
    words = re.findall(r'\b\w{4,}\b', text)
    keywords = set(w.lower() for w in words if w.isalpha())
    return ', '.join(sorted(keywords)) if keywords else "Not specified"

def extract_responsibilities(text):
    if not text:
        return "Not specified"
    sentences = re.split(r'(?<=[.!?])\s+', text)
    resp = [s.strip() for s in sentences if re.search(r'responsible|role|you will', s, re.IGNORECASE)]
    return ' '.join(resp) if resp else "Not specified"

def clean_text(text):
    if not text:
        return "Not specified"
    return re.sub(r'\s+', ' ', str(text)).strip()

def normalize_job(raw):
    description = raw.get('description', '')
    return {
        'title': clean_text(raw.get('title', 'Not specified')),
        'company': clean_text(raw.get('company', 'Not specified')),
        'location': clean_text(raw.get('location') or raw.get('locations', 'Not specified')),
        'salary': clean_text(raw.get('salary') or raw.get('salary_min') or extract_salary(description)),
        'experience': extract_experience(description),
        'date': clean_text(raw.get('date') or raw.get('posted_on') or raw.get('date_posted') or raw.get('posted_at_utc', 'Not specified')),
        'description': clean_text(description),
        'skills': extract_skills(description),
        'responsibilities': extract_responsibilities(description),
        'url': clean_text(raw.get('link') or raw.get('apply_url') or raw.get('job_url', 'Not specified')),
    }

def save_jobs_unified(jobs):
    os.makedirs("data", exist_ok=True)
    timestamp = dt.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    filename = f"data/google_jobs_{timestamp}.csv"
    import pandas as pd
    df = pd.DataFrame(jobs)
    df.to_csv(filename, index=False)
    print(f"\nSaved {len(df)} NEW jobs to {filename}")


if __name__ == "__main__":
    main()