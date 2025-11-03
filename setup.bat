@echo off
title Speech to Text - Setup

echo Installing Python dependencies...
python -m pip install -r requirements.txt --quiet

if errorlevel 1 (
    echo.
    echo ERROR: Failed to install dependencies
    echo Please ensure Python 3.11 or 3.12 is installed
    pause
    exit /b 1
)

echo.
echo Setup complete!
echo Starting application...
python app.py
pause
