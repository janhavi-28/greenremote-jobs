import re

#!/usr/bin/env python3

import requests
from bs4 import BeautifulSoup
import csv
import os
import glob
from datetime import datetime

URL = "https://internshala.com/jobs"

headers = {
    "User-Agent": "Mozilla/5.0"
}


def load_existing_links():

    existing_links = set()

    files = glob.glob("data/internshala_jobs_*.csv")

    for file in files:
        with open(file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                existing_links.add(row["link"])

    return existing_links


def scrape_internshala(existing_links):

    print("Scraping Internshala jobs page...")

    response = requests.get(URL, headers=headers)
    soup = BeautifulSoup(response.text, "html.parser")

    job_cards = soup.find_all("div", class_="individual_internship")

    print(f"Found job cards: {len(job_cards)}")

    jobs = []

    for card in job_cards:

        try:
            title = card.find("a", class_="job-title-href").text.strip()
            company = card.find("p", class_="company-name").text.strip()

            location_tag = card.find("a", class_="location_link")
            location = location_tag.text.strip() if location_tag else "Remote"

            stipend_tag = card.find("span", class_="stipend")
            stipend = stipend_tag.text.strip() if stipend_tag else "Not specified"

            link = "https://internshala.com" + card.find("a", class_="job-title-href")["href"]

            if link in existing_links:
                continue

            job = {
                "title": title,
                "company": company,
                "location": location,
                "stipend": stipend,
                "link": link
            }

            jobs.append(job)

        except:
            continue

    return jobs


def save_jobs(jobs):

    os.makedirs("data", exist_ok=True)

    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")

    filename = f"data/internshala_jobs_{timestamp}.csv"

    import pandas as pd
    df = pd.DataFrame(jobs)
    df.to_csv(filename, index=False)
    print(f"Saved {len(jobs)} new jobs to {filename}")
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
        'salary': clean_text(raw.get('stipend') or raw.get('salary') or raw.get('salary_min') or extract_salary(description)),
        'experience': extract_experience(description),
        'date': clean_text(raw.get('date') or raw.get('posted_on') or raw.get('date_posted', 'Not specified')),
        'description': clean_text(description),
        'skills': extract_skills(description),
        'responsibilities': extract_responsibilities(description),
        'url': clean_text(raw.get('link') or raw.get('apply_url') or raw.get('job_url', 'Not specified')),
    }


if __name__ == "__main__":

    os.makedirs("data", exist_ok=True)

    existing_links = load_existing_links()

    jobs = scrape_internshala(existing_links)
    if jobs:
        normalized_jobs = [normalize_job(job) for job in jobs]
        save_jobs(normalized_jobs)
    else:
        print("No new jobs found")

