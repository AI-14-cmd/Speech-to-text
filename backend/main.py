from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
import whisper
import tempfile
import os
import asyncio
import uvicorn
from typing import Optional
import logging
import torch
import socket
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get local IP address
def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # doesn't even have to be reachable
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

# Get the directory of the current file
BASE_DIR = Path(__file__).resolve().parent
TEMPLATES_DIR = os.path.join(BASE_DIR, '..', 'templates')
STATIC_DIR = os.path.join(BASE_DIR, '..', 'static')

# Ensure directories exist
os.makedirs(TEMPLATES_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)

# Initialize FastAPI
app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
templates = Jinja2Templates(directory=TEMPLATES_DIR)

# Serve the main page
@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

# Runtime configuration (env-overridable)
MODEL_NAME = os.getenv("WHISPER_MODEL", "base")  # Using base model for better performance
MODEL_PATH = os.getenv("WHISPER_MODEL_PATH")  # absolute/relative dir containing model.bin for fully offline use

# Add this at the end of the file to run the server
if __name__ == "__main__":
    host = '0.0.0.0'  # Listen on all network interfaces
    port = 8000  # Default FastAPI port
    local_ip = get_local_ip()
    
    print(f"\n{'='*50}")
    print(f"Server starting on http://{local_ip}:{port}")
    print(f"To access from other devices on the same network, use the URL above")
    print(f"Make sure your mobile device is connected to the same Wi-Fi network")
    print(f"{'='*50}\n")
    
    uvicorn.run("main:app", host=host, port=port, reload=True)
CACHE_DIR = os.getenv("WHISPER_CACHE_DIR")  # optional cache dir; if None, default whisper cache is used
LOCAL_MODELS_DIR = os.getenv("WHISPER_LOCAL_MODELS_DIR", os.path.join(os.path.dirname(__file__), "models"))
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
BEAM_SIZE = int(os.getenv("WHISPER_BEAM_SIZE", "5"))

app = FastAPI(title="Speech to Text API", version="1.0.0")

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production to your Vercel domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Whisper model on startup
model = None
model_loading = False
model_source = None  # for diagnostics

async def load_model_async():
    """Load Whisper model in background with offline-friendly behavior."""
    global model, model_loading, model_source
    model_loading = True
    try:
        # Prefer an explicit local path if provided
        if MODEL_PATH:
            resolved = MODEL_PATH
            if not os.path.isabs(resolved):
                resolved = os.path.abspath(os.path.join(os.path.dirname(__file__), resolved))
            logger.info(f"Loading Whisper model from local path: {resolved} (device={DEVICE})")
            model = await asyncio.to_thread(whisper.load_model, resolved, device=DEVICE)
            model_source = f"path:{resolved}"
        else:
            # Next, check conventional local models dir (backend/models/<MODEL_NAME>)
            candidate = os.path.join(LOCAL_MODELS_DIR, MODEL_NAME)
            if os.path.isdir(candidate):
                logger.info(f"Loading Whisper model from local models dir: {candidate} (device={DEVICE})")
                model = await asyncio.to_thread(whisper.load_model, candidate, device=DEVICE)
                model_source = f"local_dir:{candidate}"
            else:
                # Finally, load by name (will use cache if already downloaded). Requires internet only if cache is missing.
                logger.info(f"Loading Whisper model '{MODEL_NAME}' (device={DEVICE})")
                if CACHE_DIR:
                    model = await asyncio.to_thread(whisper.load_model, MODEL_NAME, device=DEVICE, download_root=CACHE_DIR)
                else:
                    model = await asyncio.to_thread(whisper.load_model, MODEL_NAME, device=DEVICE)
                model_source = f"name:{MODEL_NAME}"
        logger.info("Whisper model loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load Whisper model: {e}")
    finally:
        model_loading = False

@app.on_event("startup")
async def startup_event():
    """Start model loading in background"""
    asyncio.create_task(load_model_async())

# Mount static files (CSS, JS)
app.mount("/css", StaticFiles(directory="../frontend/css"), name="css")
app.mount("/js", StaticFiles(directory="../frontend/js"), name="js")

@app.get("/")
async def root():
    """Serve frontend HTML"""
    return FileResponse("../frontend/index.html")

@app.get("/api")
async def api_root():
    """API status endpoint"""
    return {"message": "Speech to Text API", "status": "running"}

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "model_loading": model_loading,
        "device": DEVICE,
        "model": MODEL_NAME if model_source is None or model_source.startswith("name:") else model_source,
    }

@app.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: Optional[str] = None
):
    """
    Transcribe audio file to text
    
    Args:
        file: Audio file (wav, mp3, m4a, etc.)
        language: Optional language code (e.g., 'en', 'hi', 'kn')
    
    Returns:
        JSON with transcribed text
    """
    if model is None:
        if model_loading:
            raise HTTPException(status_code=503, detail="Model is still loading, please wait a moment")
        else:
            raise HTTPException(status_code=503, detail="Model failed to load")
    
    # Validate file
    if not file.content_type or not file.content_type.startswith('audio/'):
        # Also accept common formats that might not have correct MIME
        valid_extensions = ['.wav', '.mp3', '.m4a', '.ogg', '.flac', '.webm']
        if not any(file.filename.endswith(ext) for ext in valid_extensions):
            raise HTTPException(
                status_code=400, 
                detail="Invalid file type. Please upload an audio file."
            )
    
    temp_file_path = None
    try:
        # Save uploaded file to temp location
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_file:
            temp_file_path = temp_file.name
            content = await file.read()
            temp_file.write(content)
            temp_file.flush()
        
        logger.info(f"Processing file: {file.filename}, language: {language}")
        
        # Transcribe with Whisper
        transcribe_options = {
            # Use FP16 on GPU for speed, FP32 on CPU for compatibility
            "fp16": DEVICE == "cuda",
            # Improve accuracy (slower): beam search
            "beam_size": BEAM_SIZE,
            "temperature": 0.0,
        }
        
        if language:
            transcribe_options["language"] = language
        
        result = model.transcribe(temp_file_path, **transcribe_options)
        
        return JSONResponse(content={
            "success": True,
            "text": result.get("text", "").strip(),
            "language": result.get("language", language or "auto"),
            "segments": len(result.get("segments", []))
        })
    
    except Exception as e:
        logger.error(f"Transcription error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    
    finally:
        # Clean up temp file
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
            except Exception as e:
                logger.warning(f"Failed to delete temp file: {e}")

# Optional: Add a test endpoint for text-based testing
@app.get("/test")
async def test():
    """Test endpoint to verify API is working"""
    return {
        "message": "API is working",
        "model_status": "loaded" if model else "not loaded"
    }
