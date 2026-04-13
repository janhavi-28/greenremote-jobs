import { readdir, readFile } from "fs/promises";
import { ObjectId } from "mongodb";
import path from "path";
import type { Job, JobFilters } from "./types";
import { getJobsCollection } from "./mongodb";

const DEFAULT_LIMIT = 12;

export interface GetJobsResult {
  jobs: Job[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export interface JobUpsertInput {
  title: string;
  company: string;
  location: string;
  apply_url: string;
  category?: string | null;
  description?: string | null;
  publication_date?: string | null;
  experience_level?: string | null;
  salary?: string | null;
  source?: string | null;
  tags?: string[] | null;
}

type JobDocument = Omit<Job, "id"> & {
  _id: ObjectId;
  updated_at?: string;
  salary?: string | null;
  source?: string | null;
  tags?: string[] | null;
};

type CachedJobRecord = {
  title?: string | null;
  company?: string | null;
  location?: string | null;
  category?: string | null;
  description?: string | null;
  publication_date?: string | null;
  apply_url?: string | null;
  experience_level?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type CachedJobsPayload = {
  jobs?: CachedJobRecord[];
};

type CachedJobDocument = Omit<JobDocument, "_id"> & {
  _id: ObjectId;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toJob(document: JobDocument): Job {
  return {
    id: document._id.toHexString(),
    title: document.title,
    company: document.company,
    location: document.location,
    category: document.category ?? null,
    description: document.description ?? null,
    publication_date: document.publication_date ?? null,
    apply_url: document.apply_url,
    experience_level: document.experience_level ?? null,
    created_at: document.created_at,
  };
}

function buildMongoQuery(filters: JobFilters) {
  const query: Record<string, unknown> = {};
  const andClauses: Record<string, unknown>[] = [];

  if (filters.search?.trim()) {
    const regex = new RegExp(escapeRegex(filters.search.trim()), "i");
    andClauses.push({
      $or: [{ title: regex }, { company: regex }],
    });
  }

  if (filters.location?.trim()) {
    andClauses.push({
      location: new RegExp(escapeRegex(filters.location.trim()), "i"),
    });
  }

  if (filters.category?.trim()) {
    andClauses.push({
      category: new RegExp(escapeRegex(filters.category.trim()), "i"),
    });
  }

  if (filters.experience?.trim()) {
    andClauses.push({
      experience_level: new RegExp(escapeRegex(filters.experience.trim()), "i"),
    });
  }

  if (filters.remote) {
    andClauses.push({
      location: /remote/i,
    });
  }

  if (andClauses.length > 0) {
    query.$and = andClauses;
  }

  return query;
}

function matchJobFilters(job: Job, filters: JobFilters) {
  const search = filters.search?.trim().toLowerCase();
  const location = filters.location?.trim().toLowerCase();
  const category = filters.category?.trim().toLowerCase();
  const experience = filters.experience?.trim().toLowerCase();

  if (search) {
    const haystack = `${job.title} ${job.company}`.toLowerCase();
    if (!haystack.includes(search)) {
      return false;
    }
  }

  if (location && !job.location.toLowerCase().includes(location)) {
    return false;
  }

  if (category && !(job.category ?? "").toLowerCase().includes(category)) {
    return false;
  }

  if (
    experience &&
    !(job.experience_level ?? "").toLowerCase().includes(experience)
  ) {
    return false;
  }

  if (filters.remote && !job.location.toLowerCase().includes("remote")) {
    return false;
  }

  return true;
}

function toCachedJob(record: CachedJobRecord, index: number): Job | null {
  const applyUrl = record.apply_url?.trim();
  const title = record.title?.trim();
  if (!applyUrl || !title) {
    return null;
  }

  return {
    id: applyUrl || `cached-${index}`,
    title,
    company: record.company?.trim() || "Unknown Company",
    location: record.location?.trim() || "Remote",
    category: record.category?.trim() || null,
    description: record.description?.trim() || null,
    publication_date: record.publication_date?.trim() || null,
    apply_url: applyUrl,
    experience_level: record.experience_level?.trim() || null,
    created_at: record.created_at?.trim() || record.updated_at?.trim() || undefined,
  };
}

async function readJobsCache(): Promise<Job[]> {
  const scraperDir = path.join(process.cwd(), "Jobs_Scraper");
  const preferredPath = path.join(scraperDir, "latest_jobs.json");

  const cacheCandidates = [preferredPath];

  try {
    const names = await readdir(scraperDir);
    const importOutputs = names
      .filter((name) => name === "latest_jobs.json")
      .map((name) => path.join(scraperDir, name));
    cacheCandidates.push(...importOutputs);
  } catch {
    return [];
  }

  for (const filePath of cacheCandidates) {
    try {
      const raw = await readFile(filePath, "utf-8");
      const payload = JSON.parse(raw) as CachedJobsPayload;
      const jobs = (payload.jobs ?? [])
        .map((record, index) => toCachedJob(record, index))
        .filter((job): job is Job => Boolean(job));
      if (jobs.length > 0) {
        return jobs;
      }
    } catch {
      continue;
    }
  }

  return [];
}

async function readCachedJobRecords(): Promise<CachedJobRecord[]> {
  const scraperDir = path.join(process.cwd(), "Jobs_Scraper");
  const preferredPath = path.join(scraperDir, "latest_jobs.json");

  try {
    const raw = await readFile(preferredPath, "utf-8");
    const payload = JSON.parse(raw) as CachedJobsPayload;
    return payload.jobs ?? [];
  } catch {
    return [];
  }
}

async function getCachedJobById(id: string): Promise<Job | null> {
  const records = await readCachedJobRecords();
  const index = records.findIndex((record) => (record.apply_url ?? "").trim() === id);
  if (index === -1) {
    return null;
  }
  return toCachedJob(records[index], index);
}

async function getCachedJobDocumentById(id: string): Promise<JobDocument | null> {
  const records = await readCachedJobRecords();
  const record = records.find((entry) => (entry.apply_url ?? "").trim() === id);
  if (!record) {
    return null;
  }

  return {
    _id: new ObjectId(),
    title: record.title?.trim() || "",
    company: record.company?.trim() || "Unknown Company",
    location: record.location?.trim() || "Remote",
    category: record.category?.trim() || null,
    description: record.description?.trim() || null,
    publication_date: record.publication_date?.trim() || null,
    apply_url: record.apply_url?.trim() || id,
    experience_level: record.experience_level?.trim() || null,
    created_at: record.created_at?.trim() || record.updated_at?.trim() || new Date().toISOString(),
    updated_at: record.updated_at?.trim() || undefined,
    salary: null,
    source: null,
    tags: [],
  };
}

async function getJobsFromCache(filters: JobFilters): Promise<GetJobsResult> {
  const allJobs = await readJobsCache();
  const filtered = allJobs.filter((job) => matchJobFilters(job, filters));
  const sortDirection = filters.sort === "oldest" ? 1 : -1;
  const sorted = [...filtered].sort((a, b) => {
    const aTime = new Date(a.created_at ?? a.publication_date ?? 0).getTime();
    const bTime = new Date(b.created_at ?? b.publication_date ?? 0).getTime();
    return sortDirection === 1 ? aTime - bTime : bTime - aTime;
  });

  const limit = Math.min(Number(filters.limit) || DEFAULT_LIMIT, 50);
  const page = Math.max(0, Number(filters.page) || 0);
  const total = sorted.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const jobs = sorted.slice(page * limit, page * limit + limit);

  return {
    jobs,
    total,
    page,
    totalPages,
    limit,
  };
}

export async function getJobs(filters: JobFilters): Promise<GetJobsResult> {
  try {
    const collection = await getJobsCollection();
    const limit = Math.min(Number(filters.limit) || DEFAULT_LIMIT, 50);
    const page = Math.max(0, Number(filters.page) || 0);
    const sortDirection = filters.sort === "oldest" ? 1 : -1;
    const query = buildMongoQuery(filters);

    const [documents, total] = await Promise.all([
      collection
        .find(query)
        .sort({ created_at: sortDirection, _id: sortDirection })
        .skip(page * limit)
        .limit(limit)
        .toArray(),
      collection.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      jobs: documents.map((document) => toJob(document as JobDocument)),
      total,
      page,
      totalPages,
      limit,
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Mongo unavailable, serving cached jobs instead.", error);
    }
    return getJobsFromCache(filters);
  }
}

export async function getJobById(id: string): Promise<Job | null> {
  if (ObjectId.isValid(id)) {
    try {
      const collection = await getJobsCollection();
      const document = await collection.findOne({ _id: new ObjectId(id) });
      if (document) {
        return toJob(document as JobDocument);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("Falling back to cached job details.", error);
      }
    }
  }

  return getCachedJobById(id);
}

export async function getJobDocumentById(id: string) {
  if (ObjectId.isValid(id)) {
    try {
      const collection = await getJobsCollection();
      const document = await collection.findOne({ _id: new ObjectId(id) });
      if (document) {
        return document as JobDocument | null;
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("Falling back to cached job preview.", error);
      }
    }
  }

  return getCachedJobDocumentById(id);
}

export async function insertJob(job: JobUpsertInput): Promise<string> {
  const collection = await getJobsCollection();
  const timestamp = new Date().toISOString();
  const result = await collection.insertOne({
    ...job,
    created_at: timestamp,
    updated_at: timestamp,
  });
  return result.insertedId.toHexString();
}

export async function updateJobById(
  id: string,
  updates: Partial<JobUpsertInput>,
): Promise<boolean> {
  if (!ObjectId.isValid(id)) {
    return false;
  }

  const collection = await getJobsCollection();
  const result = await collection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        ...updates,
        updated_at: new Date().toISOString(),
      },
    },
  );
  return result.matchedCount > 0;
}

export async function deleteJobById(id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) {
    return false;
  }

  const collection = await getJobsCollection();
  const result = await collection.deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount > 0;
}

export async function countJobs(): Promise<number> {
  const collection = await getJobsCollection();
  return collection.countDocuments();
}

export async function getJobsBatch(offset: number, batch: number): Promise<Job[]> {
  const collection = await getJobsCollection();
  const documents = await collection
    .find({})
    .sort({ created_at: -1, _id: -1 })
    .skip(offset)
    .limit(batch)
    .toArray();

  return documents.map((document) => toJob(document as JobDocument));
}

export async function upsertJobs(jobs: JobUpsertInput[]) {
  if (jobs.length === 0) {
    return { inserted: 0, matched: 0, modified: 0, upserts: 0 };
  }

  const collection = await getJobsCollection();
  const now = new Date().toISOString();
  const operations = jobs
    .filter((job) => job.apply_url?.trim())
    .map((job) => ({
      updateOne: {
        filter: { apply_url: job.apply_url },
        update: {
          $set: {
            ...job,
            updated_at: now,
          },
          $setOnInsert: {
            created_at: now,
          },
        },
        upsert: true,
      },
    }));

  if (operations.length === 0) {
    return { inserted: 0, matched: 0, modified: 0, upserts: 0 };
  }

  const result = await collection.bulkWrite(operations, { ordered: false });

  return {
    inserted: result.upsertedCount,
    matched: result.matchedCount,
    modified: result.modifiedCount,
    upserts: result.upsertedCount,
  };
}
