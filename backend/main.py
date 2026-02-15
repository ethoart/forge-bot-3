import os
import asyncio
import random
import base64
import logging
from datetime import datetime
from typing import List

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from bson import ObjectId
import httpx

# --- LOGGING SETUP ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# --- CONFIG ---
# Connection string for Docker: mongo service on port 27017
MONGO_USER = os.getenv("MONGO_USER", "admin")
MONGO_PASS = os.getenv("MONGO_PASS", "secret123")
MONGO_URI = f"mongodb://{MONGO_USER}:{MONGO_PASS}@mongo:27017"

WAHA_API_URL = "http://waha:3000"
WAHA_API_KEY = os.getenv("WAHA_API_KEY", "secret123")
WAHA_SESSION = os.getenv("WAHA_WORKER_ID", "default")

logger.info("🚀 Starting Backend...")
logger.info(f"🔌 Connecting to Mongo at: mongo:27017 (User: {MONGO_USER})")

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DATABASE ---
try:
    client = AsyncIOMotorClient(MONGO_URI)
    db = client.whatsdoc
    customers = db.customers
except Exception as e:
    logger.error(f"❌ Failed to initialize Mongo Client: {e}")
    raise e

# --- MODELS ---
class CustomerCreate(BaseModel):
    name: str
    phone: str
    videoName: str

# --- HELPERS ---
def pydantic_encoder(item):
    """Convert Mongo Object to JSON compatible dict"""
    return {
        "id": str(item["_id"]),
        "customerName": item["customerName"],
        "phoneNumber": item["phoneNumber"],
        "videoName": item["videoName"],
        "status": item.get("status", "pending"),
        "requestedAt": item.get("requestedAt")
    }

def format_phone_to_chat_id(phone: str) -> str:
    """Formats a phone number to WAHA chat ID (e.g., 12125551234@c.us)"""
    # Remove all non-numeric characters
    clean_number = "".join(filter(str.isdigit, phone))
    return f"{clean_number}@c.us"

async def background_send_workflow(request_id: str, phone: str, name: str, video_name: str, file_content: bytes, mime_type: str, filename: str):
    """
    Background Task:
    1. Waits 5-15 seconds (Human simulation).
    2. Sends document via WAHA.
    3. Updates Status in MongoDB.
    """
    try:
        logger.info(f"[{request_id}] ⏳ Workflow started. Simulating delay...")
        
        # 1. Human Delay
        delay = random.randint(5, 15)
        await asyncio.sleep(delay)
        
        logger.info(f"[{request_id}] 🚀 Sending to WAHA now...")

        # 2. Prepare WAHA Payload
        chat_id = format_phone_to_chat_id(phone)
        b64_data = base64.b64encode(file_content).decode('utf-8')
        data_uri = f"data:{mime_type};base64,{b64_data}"

        payload = {
            "chatId": chat_id,
            "caption": f"Hi {name}! Here is the document you requested: {video_name}.\n\nThanks for visiting us!",
            "session": WAHA_SESSION,
            "file": {
                "mimetype": mime_type,
                "filename": filename,
                "data": data_uri
            }
        }

        headers = {
            "Content-Type": "application/json",
            "X-Api-Key": WAHA_API_KEY
        }

        # 3. Send Request
        async with httpx.AsyncClient(timeout=60.0) as http_client:
            response = await http_client.post(f"{WAHA_API_URL}/api/sendFile", json=payload, headers=headers)
            
            if response.status_code in [200, 201]:
                logger.info(f"[{request_id}] ✅ WAHA Success: {response.json()}")
                await customers.update_one(
                    {"_id": ObjectId(request_id)},
                    {"$set": {"status": "completed", "completedAt": datetime.utcnow().isoformat()}}
                )
            else:
                logger.error(f"[{request_id}] ❌ WAHA Error ({response.status_code}): {response.text}")
                await customers.update_one(
                    {"_id": ObjectId(request_id)},
                    {"$set": {"status": "failed", "error": response.text}}
                )

    except Exception as e:
        logger.error(f"[{request_id}] 💥 Exception: {str(e)}")
        await customers.update_one(
            {"_id": ObjectId(request_id)},
            {"$set": {"status": "failed", "error": str(e)}}
        )

# --- ROUTES ---

@app.get("/")
def read_root():
    return {"status": "WhatsDoc Backend Running"}

@app.post("/api/register-customer")
async def register_customer(request: CustomerCreate):
    new_customer = {
        "customerName": request.name,
        "phoneNumber": request.phone,
        "videoName": request.videoName,
        "status": "pending",
        "requestedAt": datetime.utcnow().isoformat()
    }
    result = await customers.insert_one(new_customer)
    return {"success": True, "id": str(result.inserted_id)}

@app.get("/api/get-pending")
async def get_pending():
    # Get oldest pending first
    pending_docs = await customers.find({"status": "pending"}).sort("requestedAt", 1).limit(100).to_list(length=100)
    return [pydantic_encoder(doc) for doc in pending_docs]

@app.post("/api/upload-document")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    requestId: str = Form(...),
    phoneNumber: str = Form(...),
    videoName: str = Form(...)
):
    # 1. Validate ID
    try:
        req_oid = ObjectId(requestId)
    except:
        raise HTTPException(status_code=400, detail="Invalid ID")

    # 2. Read File
    content = await file.read()
    
    # 3. Find Customer Name (Optional, for personalization)
    customer = await customers.find_one({"_id": req_oid})
    customer_name = customer['customerName'] if customer else "Customer"

    # 4. Trigger Background Task
    background_tasks.add_task(
        background_send_workflow,
        requestId,
        phoneNumber,
        customer_name,
        videoName,
        content,
        file.content_type,
        file.filename
    )

    return {"success": True, "message": "Queued for delivery"}

@app.get("/health")
def health_check():
    return {"status": "ok"}