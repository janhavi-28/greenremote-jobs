import pandas as pd
import glob
import os
from datetime import datetime

# ===== DATA FOLDERS =====
DATA_PATHS = [
    "Amazon/data",
    "CutShort/data",
    "Internshala/data",
    "Linkedin/data",
    "remoteok/data",
    "WeWorkRemotely/data",
]

# ===== GET LATEST CSV =====
def get_latest_csv(folder):
    files = glob.glob(os.path.join(folder, "*.csv"))

    if not files:
        print(f"⚠️ No CSV in {folder}")
        return None

    latest = max(files, key=os.path.getctime)
    print(f"📄 Using {latest}")
    return latest


# ===== SAFE COLUMN PICKER =====
def pick_column(df, columns):
    for col in columns:
        if col in df.columns:
            return df[col]
    return pd.Series([None] * len(df))


# ===== NORMALIZE =====
def normalize(df):
    df = df.copy()
    df.columns = [col.lower() for col in df.columns]

    normalized = pd.DataFrame({
        "title": pick_column(df, ["title"]),
        "company": pick_column(df, ["company"]),
        "location": pick_column(df, ["location"]),

        "salary": pick_column(df, ["salary", "salary_min"]),
        "date": pick_column(df, ["date", "posted_on", "date_posted"]),

        "description": pick_column(df, ["description"]),

        "url": pick_column(df, ["link", "apply_url", "job_url"])
    })

    return normalized


# ===== MERGE =====
def merge_all():
    dfs = []

    for path in DATA_PATHS:
        file = get_latest_csv(path)

        if file:
            try:
                df = pd.read_csv(file)
                df = normalize(df)
                dfs.append(df)
            except Exception as e:
                print(f"❌ Error reading {file}: {e}")

    if not dfs:
        print("❌ No data found")
        return

    final_df = pd.concat(dfs, ignore_index=True)

    # ===== CLEAN =====
    final_df = final_df[final_df["url"].notna()]

    final_df.drop_duplicates(subset=["url"], inplace=True)
    final_df.drop_duplicates(subset=["title", "company"], inplace=True)

    # fill missing values
    final_df.fillna({
        "salary": "Not disclosed",
        "description": "Not available",
        "date": ""
    }, inplace=True)

    # keep only required columns
    final_df = final_df[
        ["title", "company", "location", "salary", "date", "description"]
    ]

    # ===== SAVE =====
    filename = f"jobs_clean_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.xlsx"
    final_df.to_excel(filename, index=False)

    print(f"\n✅ Saved {len(final_df)} jobs → {filename}")


# ===== RUN =====
if __name__ == "__main__":
    print("\n🚀 Merging Latest CSVs (Clean + Fixed)...\n")
    merge_all()