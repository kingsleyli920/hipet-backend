#!/bin/bash

# HiPet Backend Service Startup Script
# This script starts the backend service with proper configuration

echo "🚀 Starting HiPet Backend Service..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from example..."
    if [ -f env.example ]; then
        cp env.example .env
        echo "📝 Please update .env with your actual configuration values"
    else
        echo "❌ env.example file not found. Please create .env manually"
        exit 1
    fi
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    bun install
fi

# Check if Prisma client is generated
if [ ! -d node_modules/@prisma/client ]; then
    echo "🔧 Generating Prisma client..."
    bunx prisma generate
fi

# Check if database is accessible
echo "🔍 Checking database connection..."
if ! bunx prisma db push --accept-data-loss > /dev/null 2>&1; then
    echo "❌ Database connection failed. Please check your DATABASE_URL in .env"
    exit 1
fi

echo "✅ Database connection successful"

# Start the service
echo "🌟 Starting backend service on port ${PORT:-8000}..."
bun run start