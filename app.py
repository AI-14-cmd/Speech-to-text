from flask import Flask, render_template, request, send_file
from flask_socketio import SocketIO, emit
import io
import numpy as np
import threading
from docx import Document
from docx.shared import Pt

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-123'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Try to load Whisper model if available, otherwise use Web Speech API fallback
try:
    import whisper
    print("Loading Whisper small model...")
    model = whisper.load_model('small')
    print("Whisper model loaded successfully!")
    USE_WHISPER = True
except Exception as e:
    print(f"Warning: Could not load Whisper model: {e}")
    print("Falling back to Web Speech API mode")
    model = None
    USE_WHISPER = False

# Store transcriptions and audio data
transcriptions = []
audio_buffer = np.array([], dtype=np.float32)
model_lock = threading.Lock()

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('audio_chunk')
def handle_audio_chunk(data):
    """Handle incoming audio chunks from the client"""
    global audio_buffer
    
    if not USE_WHISPER:
        return  # Skip if Whisper not available
    
    try:
        # Convert array to numpy array
        audio_data = np.array(data, dtype=np.float32)
        audio_buffer = np.append(audio_buffer, audio_data)
        
        # Process when buffer reaches ~1 second (16000 samples at 16kHz)
        if len(audio_buffer) >= 16000:
            with model_lock:
                result = model.transcribe(audio_buffer, language='kn', fp16=True)
            
            text = result['text'].strip()
            if text:
                transcriptions.append(text)
                emit('update', {'text': text, 'full_text': ' '.join(transcriptions)}, broadcast=True)
            
            audio_buffer = np.array([], dtype=np.float32)
    except Exception as e:
        print(f"Error processing audio: {e}")
        emit('error', {'message': str(e)}, broadcast=True)

@socketio.on('check_whisper')
def check_whisper():
    """Check if Whisper is available"""
    emit('whisper_status', {'available': USE_WHISPER})

@socketio.on('reset')
def handle_reset():
    """Handle reset request"""
    global transcriptions, audio_buffer
    transcriptions = []
    audio_buffer = np.array([], dtype=np.float32)
    emit('update', {'text': '', 'full_text': ''}, broadcast=True)


@app.route('/export', methods=['POST'])
def export_docx():
    """Export transcript to Word document"""
    data = request.get_json()
    text = data.get('text', '')
    language = data.get('language', 'auto')
    
    # Create Word document
    doc = Document()
    style = doc.styles['Normal']
    font = style.font
    font.name = 'Calibri'
    font.size = Pt(11)
    
    # Add title
    title = doc.add_paragraph()
    title_run = title.add_run('Speech Transcription')
    title_run.bold = True
    title_run.font.size = Pt(14)
    
    # Add language info
    lang_names = {
        'auto': 'Auto-detect',
        'en': 'English', 
        'hi': 'Hindi',
        'kn': 'Kannada'
    }
    doc.add_paragraph(f"Language: {lang_names.get(language, language)}")
    doc.add_paragraph("")  # spacer
    
    # Add transcript text
    if text.strip():
        for para in text.split('\n'):
            if para.strip():
                doc.add_paragraph(para.strip())
    else:
        doc.add_paragraph('(No speech detected)')
    
    # Save to memory
    stream = io.BytesIO()
    doc.save(stream)
    stream.seek(0)
    
    return send_file(
        stream,
        as_attachment=True,
        download_name='transcription.docx',
        mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )

if __name__ == '__main__':
    print("Starting server...")
    print("Access via: http://localhost:5000 (microphone will work)")
    print("Or via IP: http://192.168.1.5:5000 (microphone blocked by browser)")
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)
