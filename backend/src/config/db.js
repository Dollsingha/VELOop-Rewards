import mongoose from "mongoose";

export async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing. Copy .env.example to .env and configure a development database.");

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 8000,
    autoIndex: process.env.NODE_ENV !== "production"
  });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName) {
    await mongoose.disconnect();
    throw new Error("MongoDB must run as a replica set for atomic wallet and withdrawal transactions.");
  }
  console.log(`MongoDB connected to development database: ${mongoose.connection.name}`);
}
