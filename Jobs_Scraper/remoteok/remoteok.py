
import requests
import pandas as pd
import os
from datetime import datetime

URL = "https://remoteok.com/api"


def fetch_jobs():

    headers = {
        "User-Agent": "Mozilla/5.0"
    }

    print("Fetching jobs from RemoteOK...")

    response = requests.get(URL, headers=headers)

    data = response.json()

    jobs = []

    for job in data[1:]:

        try:

            salary_min = job.get("salary_min")
            salary_max = job.get("salary_max")

            if salary_min and salary_max:
                salary = f"{salary_min}-{salary_max}"
            else:
                salary = "Not specified"

            location = job.get("location") or "Remote"

            jobs.append({
                "title": job.get("position"),
                "company": job.get("company"),
                "location": location,
                "salary": salary,
                "tags": ", ".join(job.get("tags", [])),
                "date_posted": job.get("date"),
                "link": "https://remoteok.com/remote-jobs/" + job.get("slug", "")
            })

        except:
            continue

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

    filename = f"data/remoteok_jobs_{timestamp}.csv"

    df = pd.DataFrame(jobs)

    # Remove duplicates within same run
    df.drop_duplicates(subset=["link"], inplace=True)

    # Remove duplicates from previous runs
    existing_links = load_existing_links()
    df = df[~df["link"].isin(existing_links)]

    df.to_csv(filename, index=False)

    print(f"\nSaved {len(df)} jobs to {filename}")


def main():

    print("\nStarting RemoteOK Scraper...\n")

    jobs = fetch_jobs()

    if jobs:
        save_jobs(jobs)
    else:
        print("No jobs found")


if __name__ == "__main__":
    main()

