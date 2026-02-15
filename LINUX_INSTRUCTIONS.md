# 🐧 Complete Linux Setup Guide (No n8n)

This guide will set up the **WhatsDoc Platform** using Python FastAPI, React, MongoDB, and WAHA on your Linux server (AWS T3 Small/Ubuntu).

---

## 🟢 Step 1: Deploy to Server

```bash
# 1. Update system
sudo apt-get update

# 2. Install Docker
sudo apt-get install -y docker.io docker-compose unzip
sudo usermod -aG docker $USER
# (Logout and Login again)
```

**Run the stack:**
```bash
docker-compose down
docker-compose up -d --build
```

---

## 🔵 Step 2: Configure WhatsApp (WAHA)

1.  Go to `http://<your-server-ip>:3000/dashboard`
2.  Login: `admin` / `secret123`
3.  **Ensure the session is named "default"**. If it's not, delete it and create one named "default".
4.  **Scan the QR Code**. Status must be **WORKING**.

---

## 🟠 Step 3: Troubleshooting "Sent but not received"

If the dashboard says "Sent" (or "Queue size reduced") but no WhatsApp arrives:

1.  **Check Phone Number**: 
    The number MUST include the country code.
    *   ❌ Wrong: `07700 900 900`
    *   ✅ Correct: `447700900900` (for UK) or `15551234567` (for USA).

2.  **Check Session Name**:
    The backend looks for a session named `default`. If your session is called `session1`, it won't work.

3.  **View Real Logs**:
    Run this command to see exactly what happened:
    ```bash
    docker logs -f backend
    ```
    *   Look for `❌ WAHA Rejected`.
    *   Look for `⚠️ Upload rejected because WAHA is not ready`.
    *   Check the `Chat ID` in the logs. e.g. `Sending to 12345678@c.us`. Does that number look right?

4.  **Restart WAHA**:
    Sometimes WAHA gets stuck.
    ```bash
    docker-compose restart waha
    ```

---
