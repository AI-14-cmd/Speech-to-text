# Speech to Text - Kannada (Offline)

## System Requirements
- **Windows 7 or later**
- **Python 3.11 or 3.12** (NOT 3.14)
- **1 GB free disk space** (for Whisper model)
- **Microphone** connected to PC

## First-Time Setup

1. **Download and Install Python 3.11 or 3.12**
   - Download from: https://www.python.org/downloads/
   - During installation, **CHECK** "Add Python to PATH"
   - Choose **3.11.x** or **3.12.x** (NOT 3.14)

2. **Run Setup**
   - Double-click `setup.bat`
   - Let it install dependencies (first run takes 3-5 min)
   - The app will start automatically

## Running the App

After first setup, just double-click **`run.bat`**

- Server starts on `http://localhost:5000`
- Browser opens automatically
- Click **"Start Listening"** to record Kannada speech
- Click **"Download Word"** to export transcript

## Features

✓ **100% Offline** - Works without internet
✓ **Kannada Support** - Default language
✓ **High Accuracy** - Uses OpenAI Whisper small model
✓ **Real-time Transcription** - Live text as you speak
✓ **Export to Word** - Save transcripts as .docx files

## Troubleshooting

### "Python not found"
- Ensure Python 3.11/3.12 is installed and added to PATH
- Restart computer after installing Python

### "Microphone not working"
- Check Windows microphone permissions
- Ensure microphone is enabled in browser

### "Port 5000 already in use"
- Close other apps using port 5000
- Or edit `app.py` line 131: change `port=5000` to `port=5001`

## Support

For issues, contact support with:
1. Python version (`python --version`)
2. Error message from command window
3. Browser console error (F12 → Console)
