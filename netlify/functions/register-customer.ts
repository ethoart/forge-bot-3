import { Handler } from '@netlify/functions';
import clientPromise from './lib/mongo';

export const handler: Handler = async (event, context) => {
  // CORS Headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    const data = JSON.parse(event.body || '{}');
    const { name, phone, videoName } = data;

    if (!name || !phone || !videoName) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    // DEBUG LOGGING
    console.log("Attempting MongoDB Connection...");
    if (process.env.MONGODB_URI) {
      // Log obscured URI to confirm it's loaded
      console.log("URI Configured:", process.env.MONGODB_URI.replace(/:([^:@]+)@/, ':****@'));
    } else {
      console.error("CRITICAL: MONGODB_URI is missing from Netlify Environment Variables");
    }

    const client = await clientPromise;
    const db = client.db("whatsdoc");
    const collection = db.collection("customers");

    console.log("Inserting customer:", name);
    const newCustomer = {
      customerName: name,
      phoneNumber: phone,
      videoName: videoName,
      status: 'pending',
      requestedAt: new Date().toISOString()
    };

    const result = await collection.insertOne(newCustomer);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, id: result.insertedId }),
    };

  } catch (error: any) {
    console.error("Database Error Detail:", error);
    
    // Check for timeout specific errors
    const isTimeout = error.message?.includes('timed out') || error.message?.includes('Server selection');
    const errorMessage = isTimeout 
      ? 'Connection Timed Out. Please check your AWS Security Group allows Port 27017 from 0.0.0.0/0'
      : (error.message || 'Internal Server Error');

    return { 
      statusCode: 500, 
      headers,
      body: JSON.stringify({ 
        error: errorMessage,
        originalError: error.message
      }) 
    };
  }
};