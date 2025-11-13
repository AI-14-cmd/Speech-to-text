// Backend API URL (same domain since both are served from Render)
const API_URL = '';

// DOM elements
const recBtn = document.getElementById('recBtn');
const recStatus = document.getElementById('recStatus');
const transcript = document.getElementById('transcript');
const downloadBtn = document.getElementById('downloadBtn');
const clearBtn = document.getElementById('clearBtn');
const languageSelect = document.getElementById('language');

// Recording variables
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let fullTranscript = '';

// Check backend health
async function checkBackendHealth() {
    try {
        const response = await fetch(`${API_URL}/health`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Backend health check failed:', error);
        return null;
    }
}

// Start recording audio
async function startListening() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        audioChunks = [];
        mediaRecorder = new MediaRecorder(stream);
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            await transcribeAudio(audioBlob);
            
            // Stop all tracks
            stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorder.start();
        isRecording = true;
        recBtn.textContent = 'Stop Recording';
        recStatus.textContent = 'Recording...';
        recStatus.className = 'status-listening';
        
    } catch (error) {
        console.error('Microphone access error:', error);
        recStatus.textContent = 'Microphone access denied';
        recStatus.className = 'status-error';
    }
}

// Stop recording
function stopListening() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        recBtn.textContent = 'Start Recording';
        recStatus.textContent = 'Processing...';
        recStatus.className = 'muted';
    }
}

// Send audio to backend for transcription
async function transcribeAudio(audioBlob) {
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    
    const language = languageSelect.value;
    if (language && language !== 'auto') {
        formData.append('language', language);
    }
    
    try {
        recStatus.textContent = 'Transcribing...';
        recStatus.className = 'muted';
        
        const response = await fetch(`${API_URL}/transcribe`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Transcription failed');
        }
        
        const result = await response.json();
        
        if (result.success && result.text) {
            fullTranscript += result.text + ' ';
            transcript.textContent = fullTranscript;
            downloadBtn.disabled = false;
            recStatus.textContent = 'Transcription complete';
            recStatus.className = 'status-idle';
        }
        
    } catch (error) {
        console.error('Transcription error:', error);
        recStatus.textContent = error.message;
        recStatus.className = 'status-error';
    }
    
    setTimeout(() => {
        if (!isRecording) {
            recStatus.textContent = 'Ready';
            recStatus.className = 'status-idle';
        }
    }, 3000);
}

// Clear transcript
function clearTranscript() {
    fullTranscript = '';
    transcript.textContent = '';
    downloadBtn.disabled = true;
    
    recStatus.textContent = 'Transcript cleared';
    recStatus.className = 'muted';
    
    setTimeout(() => {
        if (!isRecording) {
            recStatus.textContent = 'Ready';
            recStatus.className = 'status-idle';
        }
    }, 1500);
}

// Download transcript as text file
function downloadTranscript() {
    const text = fullTranscript.trim() || 'No transcript available';
    const blob = new Blob([text], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transcription.txt';
    a.click();
    window.URL.revokeObjectURL(url);
}

// Event listeners
recBtn.addEventListener('click', () => {
    if (isRecording) {
        stopListening();
    } else {
        startListening();
    }
});

downloadBtn.addEventListener('click', downloadTranscript);
clearBtn.addEventListener('click', clearTranscript);

languageSelect.addEventListener('change', () => {
    fullTranscript = '';
    transcript.textContent = '';
    downloadBtn.disabled = true;
    
    const originalStatus = recStatus.textContent;
    const originalClass = recStatus.className;
    recStatus.textContent = 'Language changed - transcript cleared';
    recStatus.className = 'muted';
    
    setTimeout(() => {
        if (!isRecording) {
            recStatus.textContent = 'Ready';
            recStatus.className = 'status-idle';
        }
    }, 2000);
    
    if (isRecording) {
        stopListening();
        setTimeout(startListening, 100);
    }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    recStatus.textContent = 'Checking backend...';
    recStatus.className = 'muted';
    
    // Check if MediaRecorder is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        recStatus.textContent = 'Microphone not supported in this browser';
        recStatus.className = 'status-error';
        recBtn.disabled = true;
        return;
    }
    
    // Check backend health
    const health = await checkBackendHealth();
    if (health) {
        if (health.model_loading) {
            recStatus.textContent = 'Backend loading... Please wait';
            recStatus.className = 'muted';
            // Recheck in 10 seconds
            setTimeout(() => location.reload(), 10000);
        } else if (health.model_loaded) {
            recStatus.textContent = 'Ready';
            recStatus.className = 'status-idle';
        } else {
            recStatus.textContent = 'Backend model failed to load';
            recStatus.className = 'status-error';
        }
    } else {
        recStatus.textContent = 'Backend unavailable (will auto-retry)';
        recStatus.className = 'status-error';
        // Still allow recording, backend might wake up
        setTimeout(async () => {
            const retry = await checkBackendHealth();
            if (retry && retry.model_loaded) {
                recStatus.textContent = 'Ready';
                recStatus.className = 'status-idle';
            }
        }, 5000);
    }
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden && isRecording) {
        stopListening();
    }
});
