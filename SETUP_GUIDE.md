# 🚀 A-Z Guide: WhatsApp Document Platform (Python Version)

**Architecture:**
*   **Backend**: Python FastAPI (Handles DB & WhatsApp logic).
*   **Frontend**: React (Served via Nginx).
*   **Database**: MongoDB (Local Docker).
*   **WhatsApp**: WAHA (Local Docker).

---

## 🟢 Step 1: Deploy to Server

1.  **Pull Changes**:
    Copy all files (including the new `backend` folder) to your server.

2.  **Rebuild Containers**:
    This will build the new Python backend and the updated React frontend.
    ```bash
    # Stop existing containers
    docker-compose down

    # Build and start new stack
    docker-compose up -d --build
    ```

3.  **Verify Status**:
    ```bash
    docker-compose ps
    ```
    You should see `backend`, `nginx_frontend`, `mongo`, and `waha` all running.

---

## 🔵 Step 2: Configure WhatsApp (WAHA)

1.  Go to `http://<your-server-ip>:3000/dashboard` (or your domain).
2.  Login: `admin` / `secret123`.
3.  **Scan the QR Code** with your WhatsApp mobile app.
4.  Once it says "Active", you are ready.

---

## 🟠 Step 3: Usage

*   **Mobile Registration**: Open your app (e.g., `https://your-domain.com/register`).
*   **Dashboard**: Open `https://your-domain.com/admin`.

**Troubleshooting:**
*   **Upload Fails?** Check server logs: `docker logs backend`.
*   **502 Bad Gateway?** The Python server might be restarting. Wait 30 seconds.
*   **WhatsApp not sending?** Ensure WAHA session is "Active" in the dashboard.
