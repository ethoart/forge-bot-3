import os
import shutil
import asyncio
import random
import base64
import logging
from datetime import datetime
from typing import List, Optional

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
MONGO_USER = os.getenv("MONGO_USER", "admin")
MONGO_PASS = os.getenv("MONGO_PASS", "secret123")
MONGO_URI = f"mongodb://{MONGO_USER}:{MONGO_PASS}@mongo:27017"
UPLOAD_DIR = "uploads"

WAHA_API_URL = "http://waha:3000"
WAHA_SESSION = os.getenv("WAHA_WORKER_ID", "default")

# --- API KEY SECURITY CHECK ---
_raw_key = os.getenv("WAHA_API_KEY", "secret123").strip()
if _raw_key.startswith("sha512:"):
    logger.warning("⚠️ CRITICAL: It looks like you put a SHA512 hash in WAHA_API_KEY.")
    logger.warning("⚠️ The system requires the PLAIN TEXT password.")
    logger.warning("⚠️ Falling back to default: 'secret123'")
    WAHA_API_KEY = "secret123"
else:
    WAHA_API_KEY = _raw_key

# Create Upload Directory
os.makedirs(UPLOAD_DIR, exist_ok=True)

logger.info("🚀 Starting Backend...")
logger.info(f"📂 Storage Directory: {os.path.abspath(UPLOAD_DIR)}")
logger.info(f"🔌 Connecting to Mongo at: mongo:27017")
logger.info(f"🔑 WAHA API Key Configured: {WAHA_API_KEY[:3]}***")

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
        "error": item.get("error", None),
        "requestedAt": item.get("requestedAt")
    }

def format_phone_to_chat_id(phone: str) -> str:
    clean_number = "".join(filter(str.isdigit, phone))
    if clean_number.startswith("00"):
        clean_number = clean_number[2:]
    return f"{clean_number}@c.us"

async def is_waha_ready():
    """Checks if the configured WAHA session is in WORKING state"""
    headers = {
        "X-Api-Key": WAHA_API_KEY,
        "Content-Type": "application/json"
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as http_client:
            url = f"{WAHA_API_URL}/api/sessions/{WAHA_SESSION}"
            # IMPORTANT: Must include headers for authentication
            resp = await http_client.get(url, headers=headers)
            
            if resp.status_code == 200:
                data = resp.json()
                if data.get("status") == "WORKING":
                    return True, "Ready"
                return False, f"Session status is {data.get('status')}"
            elif resp.status_code == 401:
                logger.critical("🚨 WAHA AUTH FAILED (401)")
                logger.critical("🚨 SOLUTION: Run 'bash reset_waha.sh' on your server to fix the password.")
                return False, f"WAHA Auth Failed. Run 'bash reset_waha.sh'."
            elif resp.status_code == 404:
                 return False, f"Session '{WAHA_SESSION}' not found. Please scan QR."
            return False, f"WAHA Error: {resp.status_code}"
    except Exception as e:
        return False, f"Connection Error: {str(e)}"

async def send_file_logic(request_id: str, phone: str, name: str, video_name: str, file_path: str, filename: str, mime_type: str):
    """Core logic to send file via WAHA. Deletes file on success."""
    try:
        # Check if file exists on disk
        if not os.path.exists(file_path):
             logger.error(f"[{request_id}] ❌ File not found on disk: {file_path}")
             await customers.update_one(
                {"_id": ObjectId(request_id)},
                {"$set": {"status": "failed", "error": "File missing from server"}}
             )
             return

        # 1. Check WAHA Status
        is_ready, reason = await is_waha_ready()
        if not is_ready:
            logger.error(f"[{request_id}] ❌ WAHA Not Ready: {reason}")
            await customers.update_one(
                {"_id": ObjectId(request_id)},
                {"$set": {"status": "failed", "error": f"System Offline: {reason}"}}
            )
            return

        logger.info(f"[{request_id}] ⏳ Processing '{filename}'...")
        
        # 2. Read File from Disk
        with open(file_path, "rb") as f:
            file_content = f.read()

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

        # 3. Send
        async with httpx.AsyncClient(timeout=180.0) as http_client:
            response = await http_client.post(f"{WAHA_API_URL}/api/sendFile", json=payload, headers=headers)
            
            if response.status_code in [200, 201]:
                logger.info(f"[{request_id}] ✅ Sent. Deleting {file_path} to free space.")
                await customers.update_one(
                    {"_id": ObjectId(request_id)},
                    {"$set": {"status": "completed", "completedAt": datetime.utcnow().isoformat(), "error": None}}
                )
                # --- AUTO DELETE ON SUCCESS ---
                try:
                    os.remove(file_path)
                except Exception as e:
                    logger.warning(f"Failed to delete file {file_path}: {e}")
            else:
                error_msg = response.text[:200]
                logger.error(f"[{request_id}] ❌ WAHA Rejected: {error_msg}")
                await customers.update_one(
                    {"_id": ObjectId(request_id)},
                    {"$set": {"status": "failed", "error": f"WAHA {response.status_code}: {error_msg}"}}
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
    pending_docs = await customers.find({"status": "pending"}).sort("requestedAt", 1).limit(100).to_list(length=100)
    return [pydantic_encoder(doc) for doc in pending_docs]

@app.get("/api/get-failed")
async def get_failed():
    failed_docs = await customers.find({"status": "failed"}).sort("requestedAt", -1).limit(50).to_list(length=50)
    return [pydantic_encoder(doc) for doc in failed_docs]

# --- SERVER FILE MANAGEMENT ---

@app.get("/api/server-files")
def get_server_files():
    """List files currently on disk"""
    files = []
    try:
        for filename in os.listdir(UPLOAD_DIR):
            filepath = os.path.join(UPLOAD_DIR, filename)
            if os.path.isfile(filepath):
                size_mb = os.path.getsize(filepath) / (1024 * 1024)
                files.append({
                    "name": filename,
                    "size": f"{size_mb:.2f} MB",
                    "created": datetime.fromtimestamp(os.path.getctime(filepath)).isoformat()
                })
    except Exception as e:
        logger.error(f"Error listing files: {e}")
    return files

@app.delete("/api/server-files/{filename}")
def delete_server_file(filename: str):
    """Manually delete a file to free space"""
    filepath = os.path.join(UPLOAD_DIR, filename)
    if os.path.exists(filepath):
        try:
            os.remove(filepath)
            return {"success": True, "message": "File deleted"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    raise HTTPException(status_code=404, detail="File not found")

@app.post("/api/retry-file")
async def retry_file(background_tasks: BackgroundTasks, filename: str = Form(...)):
    """
    Manually trigger a send for a file sitting on the server.
    """
    filepath = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found on server")

    # Try to find a matching customer request
    # 1. Exact match attempt
    customer = await customers.find_one({
        "videoName": filename, 
        "status": {"$in": ["pending", "failed"]}
    })
    
    # 2. Loose match
    if not customer:
        name_no_ext = os.path.splitext(filename)[0]
        customer = await customers.find_one({
            "videoName": name_no_ext, 
            "status": {"$in": ["pending", "failed"]}
        })

    if not customer:
        raise HTTPException(status_code=404, detail="No pending/failed customer found matching this filename.")

    # Trigger Send
    import mimetypes
    mime_type, _ = mimetypes.guess_type(filepath)
    if not mime_type: mime_type = "application/octet-stream"

    background_tasks.add_task(
        send_file_logic,
        str(customer["_id"]),
        customer["phoneNumber"],
        customer["customerName"],
        customer["videoName"],
        filepath,
        filename,
        mime_type
    )

    return {"success": True, "message": f"Retrying send to {customer['customerName']}"}


@app.post("/api/upload-document")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    requestId: str = Form(...),
    phoneNumber: str = Form(...),
    videoName: str = Form(...)
):
    try:
        ObjectId(requestId)
    except:
        raise HTTPException(status_code=400, detail="Invalid ID")

    # SAVE TO DISK FIRST
    file_location = os.path.join(UPLOAD_DIR, file.filename)
    
    try:
        with open(file_location, "wb+") as file_object:
            shutil.copyfileobj(file.file, file_object)
    except Exception as e:
        logger.error(f"Disk Write Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to save file to disk")

    # Trigger Task
    background_tasks.add_task(
        send_file_logic,
        requestId,
        phoneNumber,
        "Customer", # Will be updated by dashboard later if needed
        videoName,
        file_location,
        file.filename,
        file.content_type
    )
    
    return {"success": True, "message": "Saved to disk & queued"}
