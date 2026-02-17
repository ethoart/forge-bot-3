import express from 'express';
import cors from 'cors';
import multer from 'multer';
import mongoose from 'mongoose';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// --- CONFIGURATION ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 8000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://admin:secret123@mongo:27017';
const WAHA_API_URL = process.env.WAHA_API_URL || 'http://waha:3000';
const WAHA_API_KEY = process.env.WAHA_API_KEY || 'secret123';
const WAHA_SESSION = process.env.WAHA_WORKER_ID || 'default';

// --- APP SETUP ---
const app = express();
app.use(cors());
app.use(express.json());

// --- DATABASE CONNECTION ---
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

const CustomerSchema = new mongoose.Schema({
  customerName: String,
  phoneNumber: String,
  videoName: String,
  status: { type: String, default: 'pending' },
  error: String,
  requestedAt: { type: Date, default: Date.now },
  completedAt: Date
});

const Customer = mongoose.model('Customer', CustomerSchema);

// --- FILE UPLOAD SETUP ---
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Replace spaces and special chars to avoid filesystem issues
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, safeName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// --- ROUTES ---

app.get('/', (req, res) => {
  res.send('WhatsDoc Node.js Backend is Running 🚀');
});

// 1. REGISTER CUSTOMER
app.post('/register-customer', async (req, res) => {
  try {
    const { name, phone, videoName } = req.body;
    if (!name || !phone || !videoName) {
      return res.status(400).json({ error: 'Missing name, phone, or videoName' });
    }

    const newCustomer = new Customer({
      customerName: name,
      phoneNumber: phone,
      videoName: videoName
    });

    await newCustomer.save();
    console.log(`📝 Registered: ${name} (${phone}) -> ${videoName}`);
    res.json({ success: true, id: newCustomer._id });
  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 2. GET PENDING REQUESTS
app.get('/get-pending', async (req, res) => {
  try {
    const docs = await Customer.find({ status: 'pending' }).sort({ requestedAt: 1 }).limit(100);
    const mapped = docs.map(d => ({
      id: d._id,
      customerName: d.customerName,
      phoneNumber: d.phoneNumber,
      videoName: d.videoName,
      status: d.status,
      requestedAt: d.requestedAt
    }));
    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. GET FAILED REQUESTS
app.get('/get-failed', async (req, res) => {
  try {
    const docs = await Customer.find({ status: 'failed' }).sort({ requestedAt: -1 }).limit(50);
    const mapped = docs.map(d => ({
      id: d._id,
      customerName: d.customerName,
      phoneNumber: d.phoneNumber,
      videoName: d.videoName,
      status: d.status,
      requestedAt: d.requestedAt,
      error: d.error
    }));
    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. UPLOAD & PROCESS
app.post('/upload-document', upload.single('file'), async (req, res) => {
  // 1. Validation
  if (!req.file) {
    console.error("❌ Upload Error: No file received.");
    return res.status(400).json({ error: 'No file uploaded. Key must be "file".' });
  }

  const { requestId, phoneNumber, videoName } = req.body;
  if (!requestId || !phoneNumber) {
    // Clean up if validation fails
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Missing requestId or phoneNumber' });
  }

  // 2. Immediate Response
  res.json({ success: true, message: 'Processing started' });

  // 3. Background Processing
  processUpload(requestId, phoneNumber, videoName || req.file.originalname, req.file);
});

async function processUpload(requestId, phone, videoName, fileObj) {
  const filePath = fileObj.path;
  const mimeType = fileObj.mimetype;
  const originalName = fileObj.originalname;

  try {
    console.log(`🔄 Processing Upload for ID: ${requestId}`);

    // Format Phone Number (Remove non-digits, append suffix)
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const chatId = `${cleanPhone}@c.us`;

    // Read File & Convert to Base64
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString('base64');
    const dataUri = `data:${mimeType};base64,${base64Data}`;

    // WAHA Payload
    const payload = {
      chatId: chatId,
      caption: `Hello! Here is your document: ${videoName}`,
      session: WAHA_SESSION,
      file: {
        mimetype: mimeType,
        filename: originalName,
        data: dataUri
      }
    };

    console.log(`🚀 Sending to WAHA: ${WAHA_API_URL} | Chat: ${chatId} | File: ${originalName}`);

    // Send to WAHA
    const response = await axios.post(`${WAHA_API_URL}/api/sendFile`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': WAHA_API_KEY
      }
    });

    console.log(`✅ WAHA Response: ${response.status} ${response.statusText}`);

    // Update DB
    await Customer.findByIdAndUpdate(requestId, {
      status: 'completed',
      completedAt: new Date(),
      error: null
    });

  } catch (error) {
    let errorMessage = error.message;
    if (error.response) {
      console.error(`❌ WAHA Error Data:`, JSON.stringify(error.response.data));
      errorMessage = `WAHA Error: ${JSON.stringify(error.response.data)}`;
    } else {
      console.error(`❌ Processing Error:`, error);
    }

    // Update DB with error
    await Customer.findByIdAndUpdate(requestId, {
      status: 'failed',
      error: errorMessage
    });

  } finally {
    // Cleanup File
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

// 5. SERVER FILES STUB
app.get('/server-files', (req, res) => {
  res.json([]);
});

// --- START SERVER ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Node.js Backend listening on port ${PORT}`);
});
