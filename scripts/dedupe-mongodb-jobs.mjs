import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || "greenremote";
const collectionName = process.env.MONGODB_COLLECTION_NAME || "jobs";
const isDryRun = process.argv.includes("--dry-run");

if (!uri) {
  console.error("Missing MONGODB_URI");
  process.exit(1);
}

function canonicalizeApplyUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) {
    return "";
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return raw;
  }

  const removableKeys = new Set([
    "trk",
    "trkemail",
    "trackingid",
    "refid",
    "ref",
    "src",
    "source",
    "campaignid",
  ]);

  for (const key of [...parsed.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_") || removableKeys.has(key.toLowerCase())) {
      parsed.searchParams.delete(key);
    }
  }

  parsed.hash = "";
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  return parsed.toString();
}

function buildFallbackDedupeKey(job) {
  const fingerprint = [
    String(job.source || "").trim().toLowerCase(),
    String(job.title || "").trim().toLowerCase(),
    String(job.company || "").trim().toLowerCase(),
    String(job.location || "").trim().toLowerCase(),
    String(job.publication_date || "").trim().toLowerCase(),
  ].join("|");

  return `fallback::${fingerprint}`;
}

function buildDedupeKey(job) {
  const source = String(job.source || "").trim().toLowerCase();
  const canonicalUrl = canonicalizeApplyUrl(job.apply_url);
  if (canonicalUrl) {
    return {
      apply_url: canonicalUrl,
      raw_apply_url: job.apply_url && canonicalUrl !== job.apply_url ? job.apply_url : job.raw_apply_url,
      dedupe_key: `url::${source}::${canonicalUrl}`,
    };
  }

  return {
    apply_url: String(job.apply_url || "").trim(),
    raw_apply_url: job.raw_apply_url || null,
    dedupe_key: buildFallbackDedupeKey(job),
  };
}

function sortTimestamp(job) {
  return new Date(job.updated_at || job.created_at || 0).getTime();
}

const client = new MongoClient(uri, {
  appName: "greenremote-jobs-dedupe",
  family: 4,
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
});

try {
  await client.connect();
  const collection = client.db(dbName).collection(collectionName);
  const jobs = await collection.find({}).toArray();

  const groups = new Map();
  for (const job of jobs) {
    const normalized = buildDedupeKey(job);
    const key = normalized.dedupe_key;
    const bucket = groups.get(key) || [];
    bucket.push({ ...job, ...normalized });
    groups.set(key, bucket);
  }

  let duplicateGroups = 0;
  let deletedCount = 0;
  let updatedCount = 0;

  for (const entries of groups.values()) {
    if (entries.length === 0) {
      continue;
    }

    entries.sort((a, b) => sortTimestamp(b) - sortTimestamp(a));
    const [keeper, ...duplicates] = entries;
    if (duplicates.length > 0) {
      duplicateGroups += 1;
      deletedCount += duplicates.length;
    }

    const update = {
      apply_url: keeper.apply_url,
      dedupe_key: keeper.dedupe_key,
      updated_at: keeper.updated_at || keeper.created_at || new Date().toISOString(),
    };

    if (keeper.raw_apply_url) {
      update.raw_apply_url = keeper.raw_apply_url;
    }

    if (!isDryRun) {
      await collection.updateOne({ _id: keeper._id }, { $set: update });

      if (duplicates.length > 0) {
        await collection.deleteMany({
          _id: { $in: duplicates.map((job) => job._id) },
        });
      }
    }

    updatedCount += 1;
  }

  if (!isDryRun) {
    await collection.createIndex({ dedupe_key: 1 }, { sparse: true });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: isDryRun,
        scanned: jobs.length,
        groups: groups.size,
        updated: updatedCount,
        duplicateGroups,
        deleted: deletedCount,
      },
      null,
      2,
    ),
  );
} finally {
  await client.close();
}
