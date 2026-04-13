import re

#!/usr/bin/env python3

import argparse
import concurrent.futures as cf
import csv
import datetime as dt
import json
import re
import sys
import threading
import time
import os
import glob
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter


BASE_URL = "https://www.hirist.tech"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9"
}


@dataclass
class JobRecord:
    job_url: str
    job_link: str
    job_id: Optional[str]
    title: Optional[str]
    company: Optional[str]
    location: Optional[str]
    experience: Optional[str]
    skills: Optional[str]
    posted_on: Optional[str]
    category: Optional[str]
    description: Optional[str]


def load_existing_ids():

    existing_ids = set()

    os.makedirs("data", exist_ok=True)

    files = glob.glob("data/hirist_jobs_*.csv")

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


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def extract_links_from_listing(html: str) -> List[str]:

    links: Set[str] = set()

    for href in re.findall(r'href=["\']([^"\']+)["\']', html):

        if "/j/" in href:
            links.add(urljoin(BASE_URL, href.split("?")[0].rstrip("/")))

    return sorted(links)


def extract_next_data(html: str) -> Dict[str, Any]:

    m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html, re.S)

    if not m:
        return {}

    try:
        return json.loads(m.group(1))
    except:
        return {}


def timestamp_ms_to_iso(value: Any) -> Optional[str]:

    if value is None:
        return None

    try:
        ts = int(value) / 1000
    except:
        return None

    return dt.datetime.fromtimestamp(ts, dt.timezone.utc).isoformat().replace("+00:00", "Z")


def parse_job_page(html: str, job_url: str) -> Optional[JobRecord]:

    data = extract_next_data(html)

    page_props = data.get("props", {}).get("pageProps", {})

    state = page_props.get("initialState", {})

    detail = state.get("jobDetail", {})

    if not detail:
        return None

    job_id = str(detail.get("id"))

    title = clean_text(detail.get("title", ""))

    company = detail.get("companyData", {}).get("companyName")

    location = None

    locations = detail.get("locations") or []

    if locations:
        location = locations[0].get("name")

    skills = None

    tags = detail.get("tags") or []

    if tags:
        skills = ", ".join(t.get("name") for t in tags if t.get("name"))

    description = None

    if detail.get("introText"):
        description = BeautifulSoup(detail.get("introText"), "html.parser").get_text()

    return JobRecord(
        job_url=job_url,
        job_link=f'=HYPERLINK("{job_url}","Open Job")',
        job_id=job_id,
        title=title,
        company=company,
        location=location,
        experience=None,
        skills=skills,
        posted_on=timestamp_ms_to_iso(detail.get("createdTimeMs")),
        category=page_props.get("categoryName"),
        description=description
    )


def fetch(session: requests.Session, url: str, timeout: int) -> str:

    r = session.get(url, timeout=timeout)

    r.raise_for_status()

    return r.text


def build_session(pool_size: int) -> requests.Session:

    session = requests.Session()

    session.headers.update(HEADERS)

    adapter = HTTPAdapter(pool_connections=pool_size, pool_maxsize=pool_size)

    session.mount("http://", adapter)

    session.mount("https://", adapter)

    return session


def scrape_jobs(pages: int, timeout: int, workers: int) -> List[JobRecord]:

    session = build_session(16)

    job_links = []

    seen_links = set()

    for page in range(1, pages + 1):

        url = f"{BASE_URL}/sitemap/category/{page}"

        try:

            html = fetch(session, url, timeout)

        except Exception as e:

            print("Failed page", page, e)

            continue

        links = extract_links_from_listing(html)

        for link in links:

            if link not in seen_links:

                seen_links.add(link)

                job_links.append(link)

        time.sleep(1)

    print("Total job links:", len(job_links))

    thread_local = threading.local()

    results = []

    def worker(url):

        if not hasattr(thread_local, "session"):

            thread_local.session = build_session(8)

        try:

            html = fetch(thread_local.session, url, timeout)

            return parse_job_page(html, url)

        except:

            return None

    with cf.ThreadPoolExecutor(max_workers=workers) as pool:

        futures = [pool.submit(worker, link) for link in job_links]

        for f in cf.as_completed(futures):

            r = f.result()

            if r:

                results.append(r)

    return results


def save_csv(records: List[JobRecord]):

    if not records:
        print("No new jobs found")
        return

    os.makedirs("data", exist_ok=True)

    timestamp = dt.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")

    filename = f"data/hirist_jobs_{timestamp}.csv"

    fieldnames = list(asdict(records[0]).keys())

    with open(filename, "w", newline="", encoding="utf-8") as f:

        writer = csv.DictWriter(f, fieldnames=fieldnames)

        writer.writeheader()

        for r in records:

            writer.writerow(asdict(r))

    print(f"Saved {len(records)} NEW jobs -> {filename}")


def main():

    parser = argparse.ArgumentParser()

    parser.add_argument("--pages", type=int, default=3)

    parser.add_argument("--timeout", type=int, default=20)

    parser.add_argument("--workers", type=int, default=12)

    args = parser.parse_args()

    existing_ids = load_existing_ids()
    print("Previously scraped jobs:", len(existing_ids))
    records = scrape_jobs(args.pages, args.timeout, args.workers)
    records = [r for r in records if r.job_id not in existing_ids]
    if records:
        normalized_jobs = [normalize_job(asdict(r)) for r in records]
        save_csv_unified(normalized_jobs)
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
        'date': clean_text(raw.get('date') or raw.get('posted_on') or raw.get('date_posted', 'Not specified')),
        'description': clean_text(description),
        'skills': extract_skills(description),
        'responsibilities': extract_responsibilities(description),
        'url': clean_text(raw.get('job_url') or raw.get('link') or raw.get('apply_url') or raw.get('job_link', 'Not specified')),
    }

def save_csv_unified(jobs):
    import pandas as pd
    os.makedirs("data", exist_ok=True)
    timestamp = dt.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    filename = f"data/hirist_jobs_{timestamp}.csv"
    df = pd.DataFrame(jobs)
    df.to_csv(filename, index=False)
    print(f"Saved {len(df)} NEW jobs to {filename}")


if __name__ == "__main__":

    main()

