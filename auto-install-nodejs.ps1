# Auto-install Node.js Script
# Requires Administrator privileges

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Auto-install Node.js" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "This script requires administrator privileges." -ForegroundColor Yellow
    Write-Host "Attempting to restart with elevated privileges..." -ForegroundColor Yellow
    Write-Host ""
    
    $scriptPath = $MyInvocation.MyCommand.Path
    Start-Process powershell -Verb RunAs -ArgumentList "-ExecutionPolicy Bypass -File `"$scriptPath`""
    exit
}

Write-Host "Checking if Node.js is already installed..." -ForegroundColor Yellow
$nodeCheck = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCheck) {
    $version = node --version
    Write-Host "Node.js is already installed: $version" -ForegroundColor Green
    exit 0
}

Write-Host "Node.js not found. Downloading installer..." -ForegroundColor Yellow

# Download Node.js LTS installer
$downloadUrl = "https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi"
$installerPath = "$env:TEMP\nodejs-installer.msi"

try {
    Write-Host "Downloading from: $downloadUrl" -ForegroundColor Cyan
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri $downloadUrl -OutFile $installerPath -UseBasicParsing
    
    if (Test-Path $installerPath) {
        $fileSize = (Get-Item $installerPath).Length / 1MB
        Write-Host "Download complete. File size: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Green
        
        Write-Host ""
        Write-Host "Starting installation..." -ForegroundColor Yellow
        Write-Host "Please follow the installation wizard." -ForegroundColor Yellow
        Write-Host ""
        
        # Run installer
        Start-Process msiexec.exe -ArgumentList "/i `"$installerPath`" /quiet /norestart" -Wait
        
        # Refresh environment variables
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        
        Write-Host ""
        Write-Host "Installation completed!" -ForegroundColor Green
        Write-Host "Please restart your terminal and run: npm install" -ForegroundColor Cyan
        
        # Clean up
        Remove-Item $installerPath -ErrorAction SilentlyContinue
    }
} catch {
    Write-Host ""
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please download and install Node.js manually:" -ForegroundColor Yellow
    Write-Host "  https://nodejs.org/" -ForegroundColor Cyan
    exit 1
}
