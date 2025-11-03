from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import whisper
import tempfile
import os
import asyncio
from typing import Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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

async def load_model_async():
    """Load Whisper model in background"""
    global model, model_loading
    model_loading = True
    try:
        logger.info("Loading Whisper model (small)...")
        # Run in thread pool to avoid blocking
        model = await asyncio.to_thread(whisper.load_model, "small")
        logger.info("Whisper model loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load Whisper model: {e}")
    finally:
        model_loading = False

@app.on_event("startup")
async def startup_event():
    """Start model loading in background"""
    asyncio.create_task(load_model_async())

@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Speech to Text API", "status": "running"}

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "model_loading": model_loading
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
            "fp16": False  # Use FP32 for CPU compatibility
        }
        
        if language:
            transcribe_options["language"] = language
        
        result = model.transcribe(temp_file_path, **transcribe_options)
        
        return JSONResponse(content={
            "success": True,
            "text": result["text"].strip(),
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
