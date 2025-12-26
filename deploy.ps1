# Script deploy lên Vercel cho Windows
# Usage: .\deploy.ps1

Write-Host "🚀 Starting Vercel Deployment..." -ForegroundColor Green
Write-Host ""

# Kiểm tra Vercel CLI
try {
    $version = vercel --version 2>$null
    Write-Host "✅ Vercel CLI found: $version" -ForegroundColor Green
} catch {
    Write-Host "❌ Vercel CLI not found. Installing..." -ForegroundColor Red
    npm install -g vercel
}

# Build
Write-Host "📦 Building project..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build successful!" -ForegroundColor Green
Write-Host ""

# Deploy
Write-Host "📤 Deploying to Vercel..." -ForegroundColor Cyan
Write-Host "Note: Make sure you're logged in: vercel login" -ForegroundColor Yellow
Write-Host ""

vercel --prod

Write-Host ""
Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host "Check https://vercel.com/dashboard for details" -ForegroundColor Cyan
