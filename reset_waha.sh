#!/bin/bash
# This script fixes the "Unauthorized 401" error by clearing old WAHA configuration.

echo "🛑 Stopping containers..."
docker-compose down

echo "🧹 Finding and removing WAHA persistence volume..."
# This finds any docker volume containing 'waha_data' and deletes it.
# This fixes the issue where 'rm -rf waha_data' didn't work because the data was inside Docker.
docker volume ls -q | grep waha_data | xargs -r docker volume rm

echo "🗑️  Removing any local temporary folders..."
sudo rm -rf waha_data
sudo rm -rf .waha

echo "🚀 Restarting..."
docker-compose up -d

echo "⏳ Waiting 15 seconds for WAHA to initialize with new password..."
sleep 15

echo "---------------------------------------------------"
echo "✅ DONE. Configuration has been reset to 'secret123'."
echo "---------------------------------------------------"
echo "👉 Login: admin / secret123"
echo "👉 If it still fails, your browser might be caching the old session. Try Incognito."
echo "---------------------------------------------------"
