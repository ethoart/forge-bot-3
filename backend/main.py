import os
import base64
import asyncio
import random
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from bson import ObjectId
import httpx

# --- CONFIG ---
MONGO_URI = os.getenv("MONGO_URI", "mongodb://mongo:27017")
WAHA_API_URL = os.getenv("WAHA_API_URL", "http://waha:3000")
WAHA_API_KEY = os.getenv("WAHA_API_KEY", "secret123")
WAHA_SESSION = os.getenv("WAHA_WORKER_ID", "default")

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DATABASE ---
client = AsyncIOMotorClient(MONGO_URI)
db = client.whatsdoc
customers = db.customers

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

async def process_upload_workflow(request_id: str, phone: str, name: str, video_name: str, file_content: bytes, mime_type: str, filename: str):
    """
    1. Wait Random Time (5-15s)
    2. Send Message via WAHA
    3. Update DB
    """
    print(f"[{request_id}] Workflow started. Simulating human delay...")
    
    # 1. Human Delay
    delay = random.randint(5, 15)
    await asyncio.sleep(delay)
    
    print(f"[{request_id}] Delay finished. Sending to WAHA...")

    # 2. Prepare Payload
    chat_id = format_phone_to_chat_id(phone)
    
    # Encode file to Base64
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

    # 3. Send to WAHA
    async with httpx.AsyncClient(timeout=60.0) as http_client:
        try:
            # Check if session is 'WORKING' first (Optional, but good practice)
            # session_check = await http_client.get(f"{WAHA_API_URL}/api/sessions/{WAHA_SESSION}", headers=headers)
            
            response = await http_client.post(f"{WAHA_API_URL}/api/sendFile", json=payload, headers=headers)
            
            if response.status_code == 201 or response.status_code == 200:
                print(f"[{request_id}] WAHA Success: {response.json()}")
                await customers.update_one(
                    {"_id": ObjectId(request_id)},
                    {"$set": {"status": "completed", "completedAt": datetime.utcnow().isoformat()}}
                )
            else:
                print(f"[{request_id}] WAHA Error ({response.status_code}): {response.text}")
                await customers.update_one(
                    {"_id": ObjectId(request_id)},
                    {"$set": {"status": "failed", "error": response.text}}
                )

        except Exception as e:
            print(f"[{request_id}] Network/Exception Error: {str(e)}")
            await customers.update_one(
                {"_id": ObjectId(request_id)},
                {"$set": {"status": "failed", "error": str(e)}}
            )

# --- ENDPOINTS ---

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
    # 1. Read file content into memory
    content = await file.read()
    
    # 2. Verify Request Exists
    try:
        req_oid = ObjectId(requestId)
    except:
        raise HTTPException(status_code=400, detail="Invalid ID")

    customer = await customers.find_one({"_id": req_oid})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer request not found")

    # 3. Add to Background Tasks
    background_tasks.add_task(
        process_upload_workflow,
        requestId,
        phoneNumber,
        customer['customerName'],
        videoName,
        content,
        file.content_type,
        file.filename
    )

    return {"success": True, "message": "Queued for delivery"}

@app.get("/health")
def health_check():
    return {"status": "ok"}