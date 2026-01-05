# One-Click Game Dev Platform - Setup Script
# This script checks and helps install Node.js

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Environment Setup Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
Write-Host "Checking Node.js..." -ForegroundColor Yellow
$nodeInstalled = $false
$npmInstalled = $false

$nodeCheck = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCheck) {
    $nodeVersion = node --version
    Write-Host "Node.js installed: $nodeVersion" -ForegroundColor Green
    $nodeInstalled = $true
} else {
    Write-Host "Node.js not installed" -ForegroundColor Red
}

# Check npm
Write-Host "Checking npm..." -ForegroundColor Yellow
$npmCheck = Get-Command npm -ErrorAction SilentlyContinue
if ($npmCheck) {
    $npmVersion = npm --version
    Write-Host "npm installed: $npmVersion" -ForegroundColor Green
    $npmInstalled = $true
} else {
    Write-Host "npm not installed" -ForegroundColor Red
}

Write-Host ""

if ($nodeInstalled -and $npmInstalled) {
    Write-Host "Environment OK! Installing project dependencies..." -ForegroundColor Green
    Write-Host ""
    
    Write-Host "Installing dependencies, this may take a few minutes..." -ForegroundColor Yellow
    npm install
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  Setup Complete!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Run the following command to start:" -ForegroundColor Cyan
        Write-Host "  npm run dev" -ForegroundColor White
        Write-Host ""
        Write-Host "Then visit: http://localhost:3000" -ForegroundColor Cyan
    } else {
        Write-Host ""
        Write-Host "Installation failed, please check errors above" -ForegroundColor Red
    }
} else {
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "  Node.js Required" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please install Node.js:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Visit: https://nodejs.org/" -ForegroundColor White
    Write-Host "2. Download LTS version" -ForegroundColor White
    Write-Host "3. Run installer and complete setup" -ForegroundColor White
    Write-Host "4. Restart terminal and run this script again" -ForegroundColor White
    Write-Host ""
}
