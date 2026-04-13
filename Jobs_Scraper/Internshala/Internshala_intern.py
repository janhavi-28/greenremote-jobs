import re

import requests
from bs4 import BeautifulSoup
import pandas as pd
import os
import glob
from datetime import datetime

URL = "https://internshala.com/internships/ai-internship"

HEADERS = {
    "User-Agent": "Mozilla/5.0"
}


def load_existing_links():
    """Read all previous CSV files and collect links"""
    existing_links = set()

    files = glob.glob("data/internshala_*.csv")

    for file in files:
        try:
            df = pd.read_csv(file)
            if "link" in df.columns:
                existing_links.update(df["link"].dropna().tolist())
        except:
            continue

    return existing_links


def fetch_internships(existing_links):

    internships = []

    print("Fetching Internshala internships...")

    r = requests.get(URL, headers=HEADERS)

    soup = BeautifulSoup(r.text, "html.parser")

    cards = soup.find_all("div", class_="internship_meta")

    print("Found cards:", len(cards))

    for card in cards:

        try:

            title = card.find("a").text.strip()

            company = card.find("div", class_="company_name").text.strip()

            location_tag = card.find("a", class_="location_link")
            location = location_tag.text.strip() if location_tag else "Remote"

            stipend_tag = card.find("span", class_="stipend")
            stipend = stipend_tag.text.strip() if stipend_tag else ""

            link = "https://internshala.com" + card.find("a")["href"]

            # Skip duplicates from previous runs
            if link in existing_links:
                continue

            internships.append({
                "title": title,
                "company": company,
                "location": location,
                "stipend": stipend,
                "link": link
            })

        except:
            continue

    return internships


def save_data(data):

    os.makedirs("data", exist_ok=True)

    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")

    filename = f"data/internshala_{timestamp}.csv"

    df = pd.DataFrame(data)
    df.to_csv(filename, index=False)
    print(f"\nSaved {len(df)} NEW internships to {filename}")
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


def main():

    print("\nStarting Internshala Scraper...\n")

    os.makedirs("data", exist_ok=True)

    existing_links = load_existing_links()

    print(f"Previously scraped internships: {len(existing_links)}")

    data = fetch_internships(existing_links)
    if data:
        normalized_jobs = [normalize_job(job) for job in data]
        save_data(normalized_jobs)
    else:
        print("No new internships found")


if __name__ == "__main__":
    main()

