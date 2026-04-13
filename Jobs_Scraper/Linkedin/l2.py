import os
import time
from datetime import datetime

import pandas as pd
import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
KEYWORD = "AI Engineer"
LOCATION = "India"
PAGES = 5
RESULTS_PER_PAGE = 25

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept-Language": "en-US,en;q=0.9",
}


def get_page(params):
    for attempt in range(5):
        try:
            response = requests.get(
                BASE_URL,
                params=params,
                headers=HEADERS,
                timeout=15,
            )

            if response.status_code == 200:
                return response.text
        except requests.exceptions.RequestException as exc:
            print(f"Retry {attempt + 1}/5 -> {exc}")

        time.sleep(3)

    return None


def fetch_description(url):
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        soup = BeautifulSoup(response.text, "html.parser")
        description = soup.find("div", class_="show-more-less-html__markup")
        if description:
            return description.text.strip()
    except requests.exceptions.RequestException:
        pass

    return ""


def fetch_jobs():
    jobs = []

    for page in range(PAGES):
        start = page * RESULTS_PER_PAGE
        params = {
            "keywords": KEYWORD,
            "location": LOCATION,
            "start": start,
        }

        print(f"Fetching page {page + 1}...")
        html = get_page(params)

        if html is None:
            print("Skipping page due to connection failure")
            continue

        soup = BeautifulSoup(html, "html.parser")
        listings = soup.find_all("li")

        for job in listings:
            try:
                title_node = job.find("h3", class_="base-search-card__title")
                company_node = job.find("h4", class_="base-search-card__subtitle")
                location_node = job.find("span", class_="job-search-card__location")
                link_node = job.find("a", class_="base-card__full-link")

                if not (title_node and company_node and location_node and link_node):
                    continue

                title = title_node.text.strip()
                company = company_node.text.strip()
                location = location_node.text.strip()
                link = link_node["href"]
                description = fetch_description(link)

                jobs.append(
                    {
                        "title": title,
                        "company": company,
                        "location": location,
                        "link": link,
                        "description": description,
                    }
                )

                time.sleep(1)
            except Exception:
                continue

        time.sleep(2)

    return jobs


def load_existing_links():
    existing_links = set()

    if not os.path.exists("data"):
        return existing_links

    for file in os.listdir("data"):
        if not file.endswith(".csv"):
            continue

        try:
            df = pd.read_csv(os.path.join("data", file))
            if "link" in df.columns:
                existing_links.update(df["link"].dropna().astype(str).tolist())
        except Exception:
            pass

    return existing_links


def save_jobs(jobs):
    os.makedirs("data", exist_ok=True)
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    filename = f"data/linkedin_jobs_{timestamp}.csv"

    df = pd.DataFrame(jobs)
    df.drop_duplicates(subset=["link"], inplace=True)

    existing_links = load_existing_links()
    df = df[~df["link"].isin(existing_links)]

    df.to_csv(filename, index=False)
    print(f"\nSaved {len(df)} jobs to {filename}")


def main():
    print("\nStarting LinkedIn Job Scraper...\n")
    jobs = fetch_jobs()

    if jobs:
        save_jobs(jobs)
    else:
        print("No jobs found.")


if __name__ == "__main__":
    main()
