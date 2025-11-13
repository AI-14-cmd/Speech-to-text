from flask import Flask, render_template, request, send_file, jsonify
from flask_socketio import SocketIO, emit
import io
import numpy as np
import threading
import os
import tempfile
import wave
from docx import Document
from docx.shared import Pt
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-123'
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# File upload disabled - using Web Speech API only

socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Use Web Speech API mode (Whisper disabled due to compatibility issues)
print("Using Web Speech API mode")
model = None
USE_WHISPER = False

# Store transcriptions
transcriptions = []

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('audio_chunk')
def handle_audio_chunk(data):
    """Handle incoming audio chunks - disabled (using Web Speech API)"""
    return  # Skip - using Web Speech API instead

@socketio.on('check_whisper')
def check_whisper():
    """Check if Whisper is available"""
    emit('whisper_status', {'available': USE_WHISPER})

@socketio.on('reset')
def handle_reset():
    """Handle reset request"""
    global transcriptions
    transcriptions = []
    emit('update', {'text': '', 'full_text': ''}, broadcast=True)


@app.route('/upload-audio', methods=['POST'])
def upload_audio():
    """Handle audio file upload - currently disabled"""
    return jsonify({'error': 'File upload transcription requires Whisper model. Please use real-time recording instead.'}), 400

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
    import os
    port = int(os.environ.get('PORT', 5000))
    print("Starting server...")
    socketio.run(app, host='0.0.0.0', port=port, debug=False)
