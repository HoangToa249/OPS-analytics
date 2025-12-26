#!/bin/bash

# Script deploy lên Vercel
# Usage: chmod +x deploy.sh && ./deploy.sh

echo "🚀 Starting Vercel Deployment..."
echo ""

# Kiểm tra Vercel CLI có cài không
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI chưa cài. Cài đặt..."
    npm install -g vercel
fi

# Build
echo "📦 Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"
echo ""

# Deploy
echo "📤 Deploying to Vercel..."
echo "Note: Make sure you're logged in: vercel login"
echo ""

vercel --prod

echo ""
echo "✅ Deployment complete!"
echo "Check https://vercel.com/dashboard for details"
