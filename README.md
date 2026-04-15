# GreenRemote Jobs

Next.js jobs board backed by MongoDB Atlas, with ingestion powered by the Python scrapers in [`Jobs_Scraper`](/c:/Users/SACHIN/Documents/Python3/greenremote-jobs/Jobs_Scraper).

## Setup

1. Install Node dependencies:

```bash
npm install
```

2. Install Python scraper dependencies:

```bash
pip install -r Jobs_Scraper/requirements.txt
playwright install
```

3. Copy `.env.example` to `.env.local` and set:

```bash
MONGODB_URI=...
MONGODB_DB_NAME=greenremote
MONGODB_COLLECTION_NAME=jobs
PYTHON_EXECUTABLE=python
ADMIN_API_KEY=optional
```

4. Start the app:

```bash
npm run dev
```

## Ingestion Flow

- `Jobs_Scraper/all.py` is the main ingestion pipeline.
- It runs the scrapers, reads the latest CSV output from each source, normalizes the rows, optionally writes a `jobs_clean_*.xlsx` snapshot, and bulk upserts directly into Mongo Atlas.
- `/api/fetch-jobs` runs the full pipeline.
- `/api/scrape-linkedin` runs only the LinkedIn pipeline.
- `.github/workflows/linkedin-scraper.yml` runs the same pipeline automatically every 4 hours in GitHub Actions.

## Notes

- Mongo Atlas is the system of record.
- The generated Excel file is only a snapshot/report, not the main import source.
- `apply_url` is the main dedupe key, with an internal fallback key only when a scraper has no URL.
- Add `MONGODB_URI`, `MONGODB_DB_NAME`, and `MONGODB_COLLECTION_NAME` as GitHub Actions secrets so the scheduled workflow can write to the same live database as your deployed site.
