import mongoose from "mongoose";

const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/gateway";

type MongoCache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };

const globalCache = globalThis as typeof globalThis & { mongoCache?: MongoCache };
const cache: MongoCache = globalCache.mongoCache ?? { conn: null, promise: null };
globalCache.mongoCache = cache;

export async function connectMongo() {
  if (cache.conn) return cache.conn;
  cache.promise ??= mongoose.connect(uri);
  cache.conn = await cache.promise;
  return cache.conn;
}
