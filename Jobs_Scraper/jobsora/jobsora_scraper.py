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
    "User-Agent": "Mozilla/5.0"
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
    functional_area: Optional[str]
    recruiter_name: Optional[str]
    recruiter_role: Optional[str]
    recruiter_activity: Optional[str]
    job_views: Optional[str]
    applications: Optional[str]
    recruiter_actions: Optional[str]
    description: Optional[str]
    raw_fields_json: str


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def excel_hyperlink(url: str) -> str:
    safe_url = url.replace('"', '""')
    return f'=HYPERLINK("{safe_url}","Open Job")'


def extract_links_from_listing(html: str) -> List[str]:

    links = set()

    for href in re.findall(r'href=["\']([^"\']+)["\']', html):

        if "/j/" in href:

            links.add(urljoin(BASE_URL, href.split("?")[0].rstrip("/")))

    return sorted(links)


def extract_next_data(html: str) -> Dict[str, Any]:

    m = re.search(
        r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
        html,
        re.S,
    )

    if not m:
        return {}

    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError:
        return {}


def parse_job_page(html: str, job_url: str) -> JobRecord:

    next_data = extract_next_data(html)

    page_props = next_data.get("props", {}).get("pageProps", {})
    state = page_props.get("initialState", {})
    detail = state.get("jobDetail", {})

    title = detail.get("title")

    company = None
    if detail.get("companyData"):
        company = detail["companyData"].get("companyName")

    return JobRecord(
        job_url=job_url,
        job_link=excel_hyperlink(job_url),
        job_id=str(detail.get("id")) if detail.get("id") else None,
        title=title,
        company=company,
        location=None,
        experience=None,
        skills=None,
        posted_on=None,
        category=None,
        functional_area=None,
        recruiter_name=None,
        recruiter_role=None,
        recruiter_activity=None,
        job_views=None,
        applications=None,
        recruiter_actions=None,
        description=None,
        raw_fields_json=json.dumps(detail),
    )


def listing_url_for_page(page: int) -> str:

    return f"{BASE_URL}/sitemap/category/{page}"


def fetch(session: requests.Session, url: str) -> str:

    r = session.get(url, timeout=20)

    r.raise_for_status()

    return r.text


def build_session(pool_size: int) -> requests.Session:

    session = requests.Session()

    adapter = HTTPAdapter(pool_connections=pool_size, pool_maxsize=pool_size)

    session.mount("http://", adapter)
    session.mount("https://", adapter)

    session.headers.update(HEADERS)

    return session


def scrape_jobs(pages: int, workers: int) -> List[JobRecord]:

    session = build_session(20)

    job_links: List[str] = []
    seen_links: Set[str] = set()

    for page in range(1, pages + 1):

        url = listing_url_for_page(page)

        print(f"[INFO] Fetching listing page {page}")

        html = fetch(session, url)

        links = extract_links_from_listing(html)

        for link in links:

            if link not in seen_links:

                seen_links.add(link)

                job_links.append(link)

    print("[INFO] Total job links:", len(job_links))

    results: List[JobRecord] = []

    def worker(url):

        try:

            html = fetch(session, url)

            return parse_job_page(html, url)

        except:

            return None

    with cf.ThreadPoolExecutor(max_workers=workers) as pool:

        for rec in pool.map(worker, job_links):

            if rec:
                results.append(rec)

    return results


def load_existing_ids():

    os.makedirs("data", exist_ok=True)

    existing_ids = set()

    for file in glob.glob("data/*.csv"):

        try:

            with open(file, newline="", encoding="utf-8") as f:

                reader = csv.DictReader(f)

                for row in reader:

                    if "job_url" in row:
                        existing_ids.add(row["job_url"])

        except:
            pass

    return existing_ids


def save_csv(records):

    if not records:

        print("[INFO] No new jobs found")

        return

    os.makedirs("data", exist_ok=True)

    timestamp = dt.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")

    filename = f"data/hirist_jobs_{timestamp}.csv"

    fields = list(asdict(records[0]).keys())

    with open(filename, "w", newline="", encoding="utf-8") as f:

        writer = csv.DictWriter(f, fieldnames=fields)

        writer.writeheader()

        for r in records:
            writer.writerow(asdict(r))

    print(f"[INFO] Saved {len(records)} jobs -> {filename}")


def main():

    parser = argparse.ArgumentParser()

    parser.add_argument("--pages", type=int, default=5)

    parser.add_argument("--workers", type=int, default=10)

    args = parser.parse_args()

    existing_ids = load_existing_ids()
    print("Previously scraped jobs:", len(existing_ids))
    records = scrape_jobs(args.pages, args.workers)
    records = [r for r in records if r.job_url not in existing_ids]
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
    filename = f"data/jobsora_jobs_{timestamp}.csv"
    df = pd.DataFrame(jobs)
    df.to_csv(filename, index=False)
    print(f"Saved {len(df)} NEW jobs to {filename}")


if __name__ == "__main__":
    main()
