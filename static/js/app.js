// Initialize Socket.IO connection
const socket = io();

// DOM elements
const recBtn = document.getElementById('recBtn');
const recStatus = document.getElementById('recStatus');
const transcript = document.getElementById('transcript');
const downloadBtn = document.getElementById('downloadBtn');
const clearBtn = document.getElementById('clearBtn');
// const wordCount = document.getElementById('wordCount'); // Element doesn't exist
const languageSelect = document.getElementById('language');

// Speech recognition variables
let recognition = null;
let isRecording = false;
let fullTranscript = '';

// Language mapping for Web Speech API
function mapLang(code) {
    switch (code) {
        case 'en': return 'en-US';
        case 'hi': return 'hi-IN';
        case 'kn': return 'kn-IN';
        default: return 'en-US';
    }
}

// Initialize speech recognition
function initSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        recStatus.textContent = 'Speech recognition not supported';
        recStatus.className = 'status-error';
        recBtn.disabled = true;
        return false;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = mapLang(languageSelect.value);
    recognition.maxAlternatives = 1;
    
    recognition.onstart = () => {
        isRecording = true;
        recBtn.textContent = 'Stop Listening';
        recStatus.textContent = 'Listening...';
        recStatus.className = 'status-listening';
    };
    
    recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcriptPart = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcriptPart + ' ';
            } else {
                interimTranscript += transcriptPart;
            }
        }
        
        if (finalTranscript) {
            fullTranscript += finalTranscript;
            // Send transcription to server
            socket.emit('transcription', { text: finalTranscript.trim() });
        }
        
        // Update display with both final and interim results
        transcript.textContent = fullTranscript + interimTranscript;
        
        // Update word count (commented out since element doesn't exist)
        // const words = fullTranscript.trim().split(/\s+/).filter(word => word.length > 0);
        // wordCount.textContent = `Words: ${words.length}`;
        
        // Enable download button if there's content
        downloadBtn.disabled = !fullTranscript.trim();
    };
    
    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
            recStatus.textContent = 'Microphone access denied. Please allow microphone access.';
        } else if (event.error === 'network') {
            recStatus.textContent = 'Network error. Check internet connection.';
            // Auto-retry after 2 seconds
            setTimeout(() => {
                if (isRecording) {
                    try {
                        recognition.start();
                    } catch (e) {
                        stopListening();
                    }
                }
            }, 2000);
            return; // Don't stop recording immediately
        } else {
            recStatus.textContent = `Error: ${event.error}`;
        }
        recStatus.className = 'status-error';
        stopListening();
    };
    
    recognition.onend = () => {
        if (isRecording) {
            // Manual restart for continuous recording
            setTimeout(() => {
                if (isRecording) {
                    try {
                        recognition.start();
                    } catch (e) {
                        console.log('Recognition restart failed:', e);
                        stopListening();
                    }
                }
            }, 100);
        }
    };
    
    return true;
}

// Start listening (real-time SpeechRecognition)
function startListening() {
    const ok = initSpeechRecognition();
    if (!ok) return;
    try { recognition.start(); } catch (e) { /* ignore if already started */ }
    isRecording = true;
    recBtn.textContent = 'Stop Listening';
    recStatus.textContent = 'Listening...';
    recStatus.className = 'status-listening';
}

// Stop listening
function stopListening() {
    if (isRecording && recognition) {
        isRecording = false;
        try { recognition.stop(); } catch (e) {}
        recBtn.textContent = 'Start Listening';
        recStatus.textContent = 'Ready';
        recStatus.className = 'status-idle';
    }
}


// Clear transcript
function clearTranscript() {
    fullTranscript = '';
    transcript.textContent = '';
    downloadBtn.disabled = true;
    
    // Reset transcriptions on server
    socket.emit('reset');
    
    // Show feedback
    recStatus.textContent = 'Transcript cleared';
    recStatus.className = 'muted';
    
    setTimeout(() => {
        if (!isRecording) {
            recStatus.textContent = 'Ready';
            recStatus.className = 'status-idle';
        }
    }, 1500);
}

// Download transcript as Word document
function downloadTranscript() {
    const data = {
        text: fullTranscript || 'Sample transcript text',
        language: languageSelect.value
    };
    
    fetch('/export', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.blob();
    })
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'transcription.docx';
        a.click();
        window.URL.revokeObjectURL(url);
    })
    .catch(error => {
        console.error('Download failed:', error);
    });
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
    // Clear transcript when language changes
    fullTranscript = '';
    transcript.textContent = '';
    downloadBtn.disabled = true;
    
    // Reset transcriptions on server
    socket.emit('reset');
    
    // Show brief feedback
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

// Socket.IO event handlers
socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    if (isRecording) {
        stopListening();
    }
});

socket.on('update', (data) => {
    // Handle server updates if needed
    console.log('Server update:', data);
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    recStatus.textContent = 'Ready';
    recStatus.className = 'status-idle';
    
    // Check for speech recognition support
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        recStatus.textContent = 'Speech recognition not supported in this browser';
        recStatus.className = 'status-error';
        recBtn.disabled = true;
    }
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden && isRecording) {
        stopListening();
    }
});
