// Initialize Socket.IO connection
const socket = io();

// DOM elements
const audioUpload = document.getElementById('audioUpload');
const uploadBtn = document.getElementById('uploadBtn');
const fileName = document.getElementById('fileName');
const uploadStatus = document.getElementById('uploadStatus');
const recBtn = document.getElementById('recBtn');
const recStatus = document.getElementById('recStatus');
const transcript = document.getElementById('transcript');
const fileTranscript = document.getElementById('fileTranscript');
const downloadBtn = document.getElementById('downloadBtn');
const clearBtn = document.getElementById('clearBtn');
const languageSelect = document.getElementById('language');
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

// Audio capture variables
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let fullTranscript = '';
let audioContext = null;
let processor = null;
let recognition = null; // For fallback Web Speech API
let useWhisper = false; // Will be set based on server capability

// Initialize MediaRecorder for Whisper
async function initMediaRecorder() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        // Setup audio context for chunked sending
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        
        // Create script processor for real-time chunk sending (every ~4 seconds)
        processor = audioContext.createScriptProcessor(64000, 1, 1);
        
        processor.onaudioprocess = (event) => {
            const inputData = event.inputBuffer.getChannelData(0);
            const audioData = new Float32Array(inputData);
            socket.emit('audio_chunk', Array.from(audioData));
        };
        
        source.connect(processor);
        processor.connect(audioContext.destination);
        
        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };
        
        mediaRecorder.onstop = () => {
            console.log('Recording stopped');
        };
        
        return true;
    } catch (error) {
        console.error('Error accessing microphone:', error);
        return false;
    }
}

// Initialize Web Speech API (fallback)
function initWebSpeechAPI() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        return false;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'kn-IN';
    
    recognition.onstart = () => {
        isRecording = true;
        recBtn.textContent = 'Stop Listening';
        recStatus.textContent = 'Listening...';
        recStatus.className = 'status-listening';
    };
    
    recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const t = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                fullTranscript += t + ' ';
            } else {
                interim += t;
            }
        }
        transcript.textContent = fullTranscript + interim;
        downloadBtn.disabled = !fullTranscript.trim();
    };
    
    recognition.onerror = (event) => {
        console.error('Speech error:', event.error);
        if (event.error !== 'network') {
            recStatus.textContent = 'Error: ' + event.error;
            recStatus.className = 'status-error';
            stopListening();
        }
    };
    
    recognition.onend = () => {
        if (isRecording) {
            setTimeout(() => {
                if (isRecording) recognition.start();
            }, 100);
        }
    };
    
    return true;
}

// Start listening
async function startListening() {
    if (useWhisper) {
        const ok = await initMediaRecorder();
        if (!ok) {
            // Fallback to Web Speech API if Whisper fails
            if (initWebSpeechAPI()) {
                useWhisper = false;
                recognition.start();
                return;
            } else {
                recStatus.textContent = 'Audio access denied';
                recStatus.className = 'status-error';
                return;
            }
        }
        
        isRecording = true;
        recBtn.textContent = 'Stop Listening';
        recStatus.textContent = 'Listening...';
        recStatus.className = 'status-listening';
        
        if (mediaRecorder) {
            audioChunks = [];
            mediaRecorder.start();
        }
    } else {
        // Use Web Speech API
        if (!recognition) {
            initWebSpeechAPI();
        }
        if (recognition) {
            try {
                recognition.start();
            } catch (e) {
                console.log('Recognition already started');
            }
        }
    }
}

// Stop listening
function stopListening() {
    if (!isRecording) return;
    
    isRecording = false;
    
    if (useWhisper && mediaRecorder) {
        mediaRecorder.stop();
        if (processor) processor.disconnect();
        if (audioContext) audioContext.close();
    } else if (recognition) {
        try {
            recognition.stop();
        } catch (e) {
            console.log('Recognition stop error:', e);
        }
    }
    
    recBtn.textContent = 'Start Listening';
    recStatus.textContent = 'Ready';
    recStatus.className = 'status-idle';
}


// Clear transcript
function clearTranscript() {
    const activeTab = document.querySelector('.tab-content.active').id;
    
    if (activeTab === 'realtime-tab') {
        fullTranscript = '';
        transcript.textContent = '';
        
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
    } else {
        // Clear file upload transcript
        fileTranscript.textContent = '';
        audioUpload.value = '';
        fileName.textContent = 'No file selected';
        uploadBtn.disabled = true;
        uploadStatus.textContent = 'Cleared';
        uploadStatus.className = 'muted';
    }
    
    downloadBtn.disabled = true;
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

// File upload handling
audioUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        fileName.textContent = file.name;
        uploadBtn.disabled = false;
    } else {
        fileName.textContent = 'No file selected';
        uploadBtn.disabled = true;
    }
});

// Handle upload button click
uploadBtn.addEventListener('click', async () => {
    const file = audioUpload.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('language', languageSelect.value);
    
    // Update UI
    uploadBtn.disabled = true;
    uploadStatus.textContent = 'Processing audio...';
    uploadStatus.className = '';
    
    try {
        const response = await fetch('/upload-audio', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            // Clear previous transcript
            fileTranscript.textContent = 'Processing audio...';
            uploadStatus.textContent = 'Transcribing...';
            uploadStatus.className = 'status-listening';
        } else {
            throw new Error(result.error || 'Failed to transcribe audio');
        }
    } catch (error) {
        console.error('Upload error:', error);
        uploadStatus.textContent = `Error: ${error.message}`;
        uploadStatus.className = 'status-error';
    } finally {
        uploadBtn.disabled = false;
    }
});

// Tab switching functionality
tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        // Remove active class from all buttons and contents
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        // Add active class to clicked button and corresponding content
        button.classList.add('active');
        const tabId = button.getAttribute('data-tab');
        document.getElementById(tabId).classList.add('active');
        
        // Clear any status messages when switching tabs
        uploadStatus.textContent = '';
        uploadStatus.className = 'muted';
    });
});

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
    recStatus.textContent = 'Language changed - transcript cleared';
    recStatus.className = 'muted';
    
    setTimeout(() => {
        if (!isRecording) {
            recStatus.textContent = 'Ready';
            recStatus.className = 'status-idle';
        }
    }, 2000);
    
    // Note: Whisper language is handled server-side, so no restart needed
});

// Socket.IO disconnect handler
socket.on('disconnect', () => {
    console.log('Disconnected from server');
    if (isRecording) {
        stopListening();
    }
});

// Listen for file transcription updates
socket.on('file_transcription_update', (data) => {
    if (data.error) {
        console.error('Transcription error:', data.error);
        fileTranscript.textContent = 'Error during transcription. Please try again.';
        uploadStatus.textContent = 'Error: ' + data.error;
        uploadStatus.className = 'status-error';
        uploadBtn.disabled = false;
        return;
    }
    
    if (data.text) {
        // Update the transcript with proper formatting
        const formattedText = data.text.trim();
        fileTranscript.textContent = formattedText;
        fullTranscript = formattedText;
        downloadBtn.disabled = false;
        
        // Auto-scroll to the bottom of the transcript
        fileTranscript.scrollTop = fileTranscript.scrollHeight;
        
        if (data.is_final) {
            uploadStatus.textContent = 'Transcription complete!';
            uploadStatus.className = 'status-listening';
            uploadBtn.disabled = false;
        }
    } else {
        fileTranscript.textContent = 'No text was transcribed. Please try again.';
        uploadStatus.textContent = 'Please try again';
        uploadStatus.className = 'status-error';
        uploadBtn.disabled = false;
    }
});

socket.on('update', (data) => {
    if (data.text) {
        fullTranscript = data.full_text || fullTranscript + data.text;
        transcript.textContent = fullTranscript;
        downloadBtn.disabled = !fullTranscript.trim();
    }
    console.log('Server update:', data);
});

// Check if server has Whisper capability
socket.on('connect', () => {
    console.log('Connected to server');
    socket.emit('check_whisper');
});

socket.on('whisper_status', (data) => {
    useWhisper = data.available;
    console.log('Whisper available:', useWhisper);
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    recStatus.textContent = 'Ready';
    recStatus.className = 'status-idle';
    
    // Check for MediaRecorder and getUserMedia support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
        recStatus.textContent = 'Audio recording not supported in this browser';
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
