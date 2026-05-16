/**
 * Test setup — chạy in-memory MongoDB cho tests, không cần kết nối Mongo thật.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mongoServer;

export async function setupTestDb() {
  if (mongoServer) return;
  mongoServer = await MongoMemoryServer.create({ binary: { version: "7.0.5" } });
  const uri = mongoServer.getUri();
  process.env.MONGODB_URI = uri;
  process.env.JWT_SECRET = "test-secret";
  process.env.REFRESH_JWT_SECRET = "test-refresh-secret";
  process.env.NODE_ENV = "test";

  await mongoose.connect(uri);
}

export async function teardownTestDb() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
}

export async function clearTestDb() {
  if (mongoose.connection.readyState === 0) return;
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}
