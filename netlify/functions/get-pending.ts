import { Handler } from '@netlify/functions';
import clientPromise from './lib/mongo';

export const handler: Handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    const client = await clientPromise;
    const db = client.db("whatsdoc");
    const collection = db.collection("customers");

    const pending = await collection
      .find({ status: 'pending' })
      .sort({ requestedAt: 1 })
      .limit(100)
      .toArray();

    const results = pending.map(doc => ({
      id: doc._id.toString(),
      customerName: doc.customerName,
      phoneNumber: doc.phoneNumber,
      videoName: doc.videoName,
      status: doc.status,
      requestedAt: doc.requestedAt
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(results),
    };

  } catch (error: any) {
    console.error("Database Error:", error);
    return { 
      statusCode: 500, 
      headers,
      body: JSON.stringify({ 
        error: error.message || 'Internal Server Error',
        details: 'Check Netlify logs or AWS Security Group (Port 27017)'
      }) 
    };
  }
};