import { MongoClient } from "mongodb";

const dbName = process.env.MONGODB_DB_NAME || "greenremote";
const collectionName = process.env.MONGODB_COLLECTION_NAME || "jobs";

declare global {
  var __mongoClientPromise__: Promise<MongoClient> | undefined;
}

export async function getMongoClient() {
  if (!global.__mongoClientPromise__) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("Missing MONGODB_URI");
    }

    global.__mongoClientPromise__ = new MongoClient(uri, {
      appName: "greenremote-jobs",
      family: 4,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    }).connect();
  }

  return global.__mongoClientPromise__;
}

export async function getJobsCollection() {
  const client = await getMongoClient();
  const collection = client.db(dbName).collection(collectionName);

  await collection.createIndex({ apply_url: 1 }, { unique: true });
  await collection.createIndex({ created_at: -1 });
  await collection.createIndex({ title: "text", company: "text" });

  return collection;
}
