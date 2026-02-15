import { MongoClient, ServerApiVersion } from 'mongodb';

const uri = process.env.MONGODB_URI;
let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (!uri) {
  throw new Error('Please add your Mongo URI to .env.local');
}

// Optimization for Serverless environment
const options = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  // Fail fast if firewall blocks connection (avoid 10s hang)
  serverSelectionTimeoutMS: 5000, 
  socketTimeoutMS: 10000,
  connectTimeoutMS: 5000,
};

if (process.env.NODE_ENV === 'development') {
  let globalWithMongo = globalThis as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;