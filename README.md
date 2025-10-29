# Real-time Speech to Text with Flask and Whisper

A real-time speech-to-text application that uses Python (Flask + WebSocket) for the backend and a modern web interface for the frontend. The application captures audio from your microphone and transcribes it in real-time using OpenAI's Whisper model.

## Features

- 🎙️ Real-time audio capture from microphone
- 🔄 WebSocket for real-time communication
- 🧠 Powered by OpenAI's Whisper for speech recognition
- 🎨 Modern, responsive web interface
- 🚀 Easy to set up and use

## Prerequisites

- Python 3.8 or higher
- Port 5000 available (or modify in `app.py`)
- Microphone access

## Installation

1. Clone the repository or download the files
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: .\venv\Scripts\activate
   ```
3. Install the required packages:
   ```bash
   pip install -r requirements.txt
   ```

## Running the Application

1. Start the Flask server:
   ```bash
   python app.py
   ```
2. Open your web browser and navigate to `http://localhost:5000`
3. Click "Start Listening" and allow microphone access when prompted
4. Speak into your microphone and see the transcription in real-time

## How It Works

1. The web interface captures audio from your microphone using the Web Audio API
2. Audio data is sent to the server via WebSocket
3. The server processes the audio using the Whisper model
4. Transcribed text is sent back to the web interface in real-time

## Customization

- To use a different Whisper model, modify the `model = whisper.load_model("base")` line in `app.py`
- Adjust audio settings like sample rate and chunk size in `app.py` if needed
- Customize the web interface in `templates/index.html` and the associated JavaScript

## Troubleshooting

- If you get port conflicts, change the port in `app.py`
- Ensure your microphone is properly connected and allowed in browser settings
- Check the browser console for any JavaScript errors
- Make sure all required Python packages are installed

## License

This project is open source and available under the [MIT License](LICENSE).
