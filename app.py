from flask import Flask, render_template, request, send_file
from flask_socketio import SocketIO, emit
import io
from docx import Document
from docx.shared import Pt

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-123'
socketio = SocketIO(app, cors_allowed_origins="*")

# Store transcriptions
transcriptions = []

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('transcription')
def handle_transcription(data):
    """Handle incoming transcriptions from the client"""
    if data.get('text'):
        transcriptions.append(data['text'])
        emit('update', {'text': data['text'], 'full_text': ' '.join(transcriptions)}, broadcast=True)

@socketio.on('reset')
def handle_reset():
    """Handle reset request"""
    global transcriptions
    transcriptions = []
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
