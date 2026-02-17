# 🚀 n8n Powered WhatsApp Platform

This version uses **n8n** as the backend logic engine, eliminating Python server issues.

---

## 🟢 Step 1: Deploy

```bash
docker-compose down
# Remove old backend logic
docker-compose rm backend
# Start new stack
docker-compose up -d --build
```

You should see `n8n`, `waha`, `mongo`, and `nginx_frontend` running.

---

## 🔵 Step 2: Configure n8n

1.  Open **http://<your-server-ip>:5678**.
2.  Set up your owner account (email/pass).
3.  **Import Workflow**:
    *   Click "Workflows" -> "Add Workflow".
    *   Click the three dots (top right) -> "Import from File".
    *   Upload `n8n_workflow.json` (from your project folder).
4.  **Configure Credentials** (Inside n8n):
    *   Open the **Mongo Insert** node.
    *   Create New Credential "MongoDb".
    *   Connection String: `mongodb://admin:secret123@mongo:27017`
    *   Save.
    *   Ensure ALL Mongo nodes use this credential.
5.  **Activate Workflow**:
    *   Click "Activate" (Toggle switch at top right).

---

## 🟠 Step 3: Configure WAHA

1.  Open **http://<your-server-ip>:3000/dashboard**.
2.  Login: `admin` / `secret123`.
3.  Scan QR Code for the **default** session.

---

## 🟣 Done!

*   **App**: `http://<your-server-ip>/register`
*   **Admin**: `http://<your-server-ip>/admin`

All logic is now handled visually in n8n.
