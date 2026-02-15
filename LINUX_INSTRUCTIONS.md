# 🐧 Complete Linux Setup Guide (No n8n)

This guide will set up the **WhatsDoc Platform** using Python FastAPI, React, MongoDB, and WAHA on your Linux server (AWS T3 Small/Ubuntu).

---

## 🟢 Step 1: Install Docker & Tools
Run these commands one by one to install Docker and unzip tools.

```bash
# 1. Update system
sudo apt-get update

# 2. Install Docker and unzip
sudo apt-get install -y docker.io docker-compose unzip

# 3. Start Docker
sudo systemctl start docker
sudo systemctl enable docker

# 4. Add your user to docker group (so you don't need 'sudo' for docker commands)
sudo usermod -aG docker $USER
```
**⚠️ IMPORTANT:** Log out of your server (`exit`) and log back in for the group changes to work.

---

## 🔵 Step 2: Create Project Structure
We need to create the folders for the application.

```bash
# 1. Create main folder
mkdir whatsdoc
cd whatsdoc

# 2. Create backend folder
mkdir backend
```

---

## 🟠 Step 3: Create The Files
You can create these files using a text editor like `nano`.

### 1. Create `.env`
```bash
nano .env
```
Paste this content (Right-click to paste in PuTTY/Terminal):
```ini
MONGO_USER=admin
MONGO_PASS=secret123
WAHA_API_KEY=secret123
WAHA_DASHBOARD_PASS=secret123
CLOUDFLARED_TOKEN=your_token_here
```
*Press `Ctrl+O`, `Enter` to save, then `Ctrl+X` to exit.*

---

### 2. Create `docker-compose.yml`
```bash
nano docker-compose.yml
```
*(Paste the content of docker-compose.yml provided in the codebase)*

---

### 3. Create Frontend `Dockerfile.txt`
```bash
nano Dockerfile.txt
```
*(Paste the content of Dockerfile.txt provided in the codebase)*

---

### 4. Create Backend Files
Enter the backend directory:
```bash
cd backend
```

**Create `requirements.txt`:**
```bash
nano requirements.txt
```
*(Paste contents: fastapi, uvicorn, motor, httpx, etc)*

**Create `main.py`:**
```bash
nano main.py
```
*(Paste the Python code provided in the codebase)*

**Create `Dockerfile.txt`:**
```bash
nano Dockerfile.txt
```
*(Paste the content of backend/Dockerfile.txt provided in the codebase)*

Go back to root:
```bash
cd ..
```

---

## 🟣 Step 4: Run The Platform

Now we build and start everything.

```bash
docker-compose up -d --build
```

**Check if it's running:**
```bash
docker-compose ps
```
You should see 5 services: `backend`, `nginx_frontend`, `waha`, `mongo`, `cloudflared` (if token provided).

---

## 🔴 Step 5: Connect WhatsApp

1.  Open your browser and go to: `http://<your-server-ip>:3000/dashboard`
2.  Login with **admin** / **secret123**
3.  Click "Start" on the default session if it's stopped.
4.  Scan the QR code with your WhatsApp app (Linked Devices).
5.  Wait until it says **WORKING** or **ONLINE**.

---

## 🏁 Step 6: Test It

1.  **Register a Customer:**
    Go to `http://<your-server-ip>/register`
    *   Name: Test User
    *   Phone: Your Number (with country code, no +)
    *   Video Name: `welcome`

2.  **Upload a Document:**
    Go to `http://<your-server-ip>/admin`
    *   You should see "Test User" in the queue.
    *   Rename a file on your computer to `welcome.pdf` (or .mp4, .jpg).
    *   Drag and drop it into the upload box.

3.  **Result:**
    *   The file will be uploaded.
    *   The Python backend will wait 5-15 seconds.
    *   You will receive the file on WhatsApp!

---

### 🛠 Troubleshooting

**View Backend Logs:**
```bash
docker logs -f backend
```

**View Web Server Logs:**
```bash
docker logs -f nginx_frontend
```

**Restart Everything:**
```bash
docker-compose restart
```
