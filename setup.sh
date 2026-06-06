#!/bin/bash

echo "🚀 Starting WhatsApp System Production Setup..."

# 1. Install Docker & Docker Compose if not exists
if ! [ -x "$(command -v docker)" ]; then
  echo "📦 Installing Docker..."
  curl -fsSL https://get.docker.com -o get-docker.sh
  sh get-docker.sh
fi

# 2. Create sessions directory
mkdir -p sessions
chmod 777 sessions

# 3. Create .env file if not exists
if [ ! -f .env ]; then
  echo "📝 Creating .env file..."
  read -p "Enter Database URL: " db_url
  read -p "Enter JWT Secret: " jwt_secret
  echo "DATABASE_URL=$db_url" > .env
  echo "JWT_SECRET=$jwt_secret" >> .env
fi

# 4. Pull and Run
echo "⚡ Starting System Containers..."
docker compose up -d --build

echo "✅ System is LIVE at http://YOUR_SERVER_IP:3000"
echo "📡 Monitoring logs: docker compose logs -f"
