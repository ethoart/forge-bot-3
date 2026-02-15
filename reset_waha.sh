#!/bin/bash
# This script fixes the "Unauthorized 401" error by clearing old password data.

echo "🛑 Stopping containers..."
docker-compose down

echo "🧹 Wiping WAHA data (completely resets database)..."
sudo rm -rf waha_data

echo "🚀 Restarting..."
docker-compose up -d

echo "⏳ Waiting 15 seconds for WAHA to initialize..."
sleep 15

echo "✅ DONE. Configuration reset."
echo "---------------------------------------------------"
echo "Try logging in now:"
echo "   URL: https://waha.arcanes.click/dashboard"
echo "   User: admin"
echo "   Pass: secret123"
echo "---------------------------------------------------"
echo "⚠️  If it still fails, use Incognito mode."
