import glob
import os
import re
from datetime import datetime

import pandas as pd
from playwright.sync_api import sync_playwright

URL = "https://cutshort.io/jobs"


def load_existing_links():
    existing_links = set()
    files = glob.glob("data/cutshort_jobs_*.csv")

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
        "company": clean_text(raw.get("company", "Cutshort")),
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

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page()

        print("Opening Cutshort jobs page...")
        page.goto(URL, timeout=60000)
        page.wait_for_timeout(5000)

        for _ in range(5):
            page.mouse.wheel(0, 5000)
            page.wait_for_timeout(2000)

        links = page.query_selector_all("a")

        for link in links:
            href = link.get_attribute("href")
            if not href or "/job/" not in href:
                continue

            full_link = "https://cutshort.io" + href
            if full_link in existing_links:
                continue

            try:
                title = link.inner_text().split("\n")[0].strip()
                jobs.append(
                    {
                        "title": title,
                        "company": "Cutshort",
                        "location": "India",
                        "salary": None,
                        "experience": None,
                        "date": None,
                        "description": None,
                        "skills": None,
                        "responsibilities": None,
                        "link": full_link,
                    }
                )
            except Exception:
                continue

        browser.close()

    return jobs


def save_jobs(jobs):
    os.makedirs("data", exist_ok=True)
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    filename = f"data/cutshort_jobs_{timestamp}.csv"
    df = pd.DataFrame(jobs)
    df.to_csv(filename, index=False)
    print(f"\nSaved {len(df)} NEW jobs to {filename}")


def main():
    print("\nStarting Cutshort Job Scraper...\n")
    os.makedirs("data", exist_ok=True)
    existing_links = load_existing_links()
    print(f"Previously scraped jobs: {len(existing_links)}")

    jobs = fetch_jobs(existing_links)
    if jobs:
        normalized_jobs = [normalize_job(job) for job in jobs]
        save_jobs(normalized_jobs)
    else:
        print("No new jobs found.")


if __name__ == "__main__":
    main()
