import glob
import os
import re
import time
from datetime import datetime

import pandas as pd
import requests

BASE_URL = "https://www.amazon.jobs/en/search.json"
KEYWORD = "software"
LOCATION = ""
RESULTS_PER_PAGE = 50
MAX_PAGES = 20

HEADERS = {
    "User-Agent": "Mozilla/5.0",
}


def load_existing_links():
    existing_links = set()
    files = glob.glob("data/amazon_jobs_*.csv")

    for file in files:
        try:
            df = pd.read_csv(file)
            for column in ("link", "url"):
                if column in df.columns:
                    existing_links.update(df[column].dropna().astype(str).tolist())
        except Exception:
            continue

    return existing_links


def extract_experience(text):
    if not text:
        return "Not specified"
    match = re.search(r"(\d+\+?\s*(?:years?|yrs?))", text, re.IGNORECASE)
    return match.group(1) if match else "Not specified"


def extract_salary(text):
    if not text:
        return "Not disclosed"
    match = re.search(r"(\$?\d+[\d,]*(?:\s*-\s*\$?\d+[\d,]*)?)", text)
    return match.group(1) if match else "Not disclosed"


def extract_skills(text):
    if not text:
        return "Not specified"
    words = re.findall(r"\b\w{4,}\b", text)
    keywords = sorted({word.lower() for word in words if word.isalpha()})
    return ", ".join(keywords) if keywords else "Not specified"


def extract_responsibilities(text):
    if not text:
        return "Not specified"
    sentences = re.split(r"(?<=[.!?])\s+", text)
    relevant = [
        sentence.strip()
        for sentence in sentences
        if re.search(r"responsible|role|you will", sentence, re.IGNORECASE)
    ]
    return " ".join(relevant) if relevant else "Not specified"


def clean_text(text):
    if text is None:
        return "Not specified"
    cleaned = re.sub(r"\s+", " ", str(text)).strip()
    return cleaned or "Not specified"


def normalize_job(raw):
    description = raw.get("description", "")
    return {
        "title": clean_text(raw.get("title")),
        "company": clean_text(raw.get("company", "Amazon")),
        "location": clean_text(raw.get("location") or raw.get("locations")),
        "salary": clean_text(raw.get("salary") or extract_salary(description)),
        "experience": extract_experience(description),
        "date": clean_text(raw.get("date") or raw.get("posted_on") or raw.get("date_posted")),
        "description": clean_text(description),
        "skills": extract_skills(description),
        "responsibilities": extract_responsibilities(description),
        "url": clean_text(raw.get("url") or raw.get("link") or raw.get("apply_url") or raw.get("job_url")),
    }


def fetch_jobs(existing_links):
    jobs = []

    for page in range(MAX_PAGES):
        offset = page * RESULTS_PER_PAGE
        params = {
            "base_query": KEYWORD,
            "loc_query": LOCATION,
            "offset": offset,
            "result_limit": RESULTS_PER_PAGE,
        }

        print(f"Fetching offset {offset}")

        try:
            response = requests.get(BASE_URL, headers=HEADERS, params=params, timeout=15)
            response.raise_for_status()
            data = response.json()
            listings = data.get("jobs", [])

            if not listings:
                break

            for job in listings:
                job_path = job.get("job_path")
                if not job_path:
                    continue

                link = "https://www.amazon.jobs" + job_path
                if link in existing_links:
                    continue

                jobs.append(
                    {
                        "title": job.get("title"),
                        "company": "Amazon",
                        "location": job.get("location"),
                        "salary": job.get("salary"),
                        "experience": None,
                        "date": job.get("posted_on"),
                        "description": job.get("description"),
                        "skills": None,
                        "responsibilities": None,
                        "url": link,
                    }
                )
        except Exception as exc:
            print(f"Error: {exc}")

        time.sleep(1)

    return jobs


def save_jobs(jobs):
    os.makedirs("data", exist_ok=True)
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    filename = f"data/amazon_jobs_{timestamp}.csv"
    df = pd.DataFrame(jobs)
    df.to_csv(filename, index=False)
    print(f"\nSaved {len(df)} NEW jobs to {filename}")


def main():
    print("\nStarting Amazon Jobs Scraper...\n")
    os.makedirs("data", exist_ok=True)
    existing_links = load_existing_links()
    print(f"Previously scraped jobs: {len(existing_links)}")

    jobs = fetch_jobs(existing_links)
    if jobs:
        normalized_jobs = [normalize_job(job) for job in jobs]
        save_jobs(normalized_jobs)
    else:
        print("No new jobs found")


if __name__ == "__main__":
    main()
