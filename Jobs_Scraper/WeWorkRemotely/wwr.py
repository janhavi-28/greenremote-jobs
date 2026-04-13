
from playwright.sync_api import sync_playwright
import pandas as pd
import os
from datetime import datetime


URL = "https://weworkremotely.com/remote-jobs"


def fetch_description(page, url):

    try:

        page.goto(url, timeout=60000)

        page.wait_for_timeout(2000)

        desc = page.query_selector("div.listing-container")

        if desc:
            return desc.inner_text().strip()

    except:
        pass

    return ""


def fetch_jobs():

    jobs = []

    with sync_playwright() as p:

        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        print("Opening WeWorkRemotely page...")
        page.goto(URL, timeout=60000)

        page.wait_for_timeout(5000)

        # scroll to ensure all jobs load
        for _ in range(6):
            page.mouse.wheel(0, 4000)
            page.wait_for_timeout(1500)

        job_links = page.query_selector_all("a[href*='/remote-jobs/']")

        for link in job_links:

            try:

                href = link.get_attribute("href")
                text = link.inner_text().split("\n")

                title = text[0] if len(text) > 0 else ""
                company = text[1] if len(text) > 1 else ""

                job_url = "https://weworkremotely.com" + href

                description = fetch_description(page, job_url)

                jobs.append({
                    "title": title.strip(),
                    "company": company.strip(),
                    "location": "Remote",
                    "link": job_url,
                    "description": description
                })

                page.wait_for_timeout(1000)

            except:
                continue

        browser.close()

    return jobs


def load_existing_links():

    existing_links = set()

    if not os.path.exists("data"):
        return existing_links

    for file in os.listdir("data"):

        if file.endswith(".csv"):

            try:

                df = pd.read_csv(os.path.join("data", file))

                if "link" in df.columns:
                    existing_links.update(df["link"].dropna().tolist())

            except:
                pass

    return existing_links


def save_jobs(jobs):

    os.makedirs("data", exist_ok=True)

    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")

    filename = f"data/weworkremotely_jobs_{timestamp}.csv"

    df = pd.DataFrame(jobs)

    # remove duplicates within same run
    df.drop_duplicates(subset=["link"], inplace=True)

    # remove duplicates from previous runs
    existing_links = load_existing_links()
    df = df[~df["link"].isin(existing_links)]

    df.to_csv(filename, index=False)

    print(f"\nSaved {len(df)} jobs to {filename}")


def main():

    print("\nStarting WeWorkRemotely Job Scraper...\n")

    jobs = fetch_jobs()

    if jobs:
        save_jobs(jobs)
    else:
        print("No jobs found")


if __name__ == "__main__":
    main()

