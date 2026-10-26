import { MongoClient } from 'mongodb';

let client;
let db;

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || 'crewli';
  client = new MongoClient(uri, { maxPoolSize: 20 });
  await client.connect();
  db = client.db(dbName);

  // Workers
  await db.collection('workers').createIndex({ phone: 1 }, { unique: true });
  await db.collection('workers').createIndex({ 'refreshTokens.token': 1 });
  await db.collection('workers').createIndex({ isAvailable: 1, lastActive: -1 });
  await db.collection('workers').createIndex({ location: '2dsphere' });
  await db.collection('workers').createIndex({ skills: 1, isAvailable: 1 });
  await db.collection('workers').createIndex({ profession: 1 });
  await db.collection('workers').createIndex({ language: 1 });
  await db.collection('workers').createIndex({ fatigueScore: 1 });

  // Customers
  await db.collection('customers').createIndex({ phone: 1 }, { unique: true });
  await db.collection('customers').createIndex({ location: '2dsphere' });

  // Jobs
  await db.collection('jobs').createIndex({ status: 1, createdAt: -1 });
  await db.collection('jobs').createIndex({ assignedWorkerId: 1 });
  await db.collection('jobs').createIndex({ skillKey: 1, status: 1 });
  await db.collection('jobs').createIndex({ customerId: 1, createdAt: -1 });

  return db;
}

export function getDB() {
  if (!db) throw new Error('DB not initialized. Call connectDB() first.');
  return db;
}

export async function closeDB() {
  if (client) await client.close();
}
