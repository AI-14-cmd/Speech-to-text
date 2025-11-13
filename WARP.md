# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Project overview
- Purpose: Browser-based speech-to-text using OpenAI Whisper on a FastAPI backend. The backend serves the static frontend and exposes a /transcribe endpoint for file uploads. A legacy streaming demo (not wired into the backend) lives under whisper_streaming/.
- Primary entrypoints:
  - Backend API: backend/main.py (FastAPI)
  - Frontend (static): frontend/index.html with JS in frontend/js/app.js

Quick start (local development)
- Prereqs: Python 3.11+ recommended, ffmpeg installed on PATH (Whisper uses it to decode audio like webm/mp3/m4a), Node optional (frontend is static, no build step).
- Install backend deps and run the dev server (run from backend/ so static mounts resolve correctly):
  - PowerShell (Windows):
    ```pwsh
    python -m venv .venv
    .\.venv\Scripts\Activate.ps1
    pip install --upgrade pip
    pip install -r requirements.txt
    uvicorn main:app --reload --host 127.0.0.1 --port 8000
    ```
  - Bash (macOS/Linux):
    ```bash
    python -m venv .venv
    source .venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    uvicorn main:app --reload --host 127.0.0.1 --port 8000
    ```
- Open http://127.0.0.1:8000/ — the backend serves frontend/index.html and static assets.

Common commands
- Health check (model loads in background on startup):
  ```bash
  curl http://127.0.0.1:8000/health
  ```
- Transcribe a local audio file (language optional: en, hi, kn, etc.):
  ```bash
  curl -F "file=@path/to/audio.webm" -F "language=en" http://127.0.0.1:8000/transcribe
  ```
- API status:
  ```bash
  curl http://127.0.0.1:8000/api
  ```

Frontend notes
- frontend/js/app.js posts microphone recordings (MediaRecorder -> webm) to /transcribe and polls /health on load. API_URL is set to '' (same-origin). If you host frontend separately, set API_URL to your backend origin.
- No build tool; package.json scripts are placeholders. The backend should serve the app at /.

Architecture and key flows
- Backend (FastAPI)
  - Startup: load_model_async() loads whisper.load_model("small") in a background task; /health reports model_loaded/model_loading.
  - Static serving: app.mount("/css", StaticFiles(directory="../frontend/css")); app.mount("/js", StaticFiles(directory="../frontend/js")). This relies on the process working directory being backend/. Run uvicorn/gunicorn from backend/.
  - Routes:
    - GET / → serves ../frontend/index.html
    - GET /api → { message, status }
    - GET /health → { status, model_loaded, model_loading }
    - POST /transcribe → accepts audio file (UploadFile) and optional language; writes to a temp file; model.transcribe(fp16=False, language=...) → JSON { success, text, language, segments }
  - Model/runtime: OpenAI Whisper (git+https://github.com/openai/whisper.git), torch/torchaudio pinned; fp16 disabled for CPU compatibility; first startup downloads the model.
- Frontend (static HTML/CSS/JS)
  - MediaRecorder captures microphone audio, stops on button toggle, then POSTs a webm blob to /transcribe; UI shows status and renders the cumulative transcript; a language <select> appends language to form data.
  - On load, checks /health; if model is still loading, it auto-reloads after a delay.
- Legacy/experimental code in repo (not wired into backend):
  - static/ and templates/: artifacts from a Socket.IO/Flask prototype (e.g., templates/index.html pulls Socket.IO CDN). Current FastAPI backend does not serve WebSockets or /export and does not use these assets.
  - whisper_streaming/: a third-party real-time streaming demo and library (see whisper_streaming/README.md). It provides CLI tools (whisper_online.py, whisper_online_server.py) and multiple backends (faster-whisper, openai-api, mlx-whisper, etc.). Not imported by backend/main.py.

Linting, tests, and formatting
- No linter/formatter/test suite is configured in this repo.
  - If you add pytest, typical usage:
    - Run all: pytest -q
    - Run single test: pytest path/to/test_file.py::TestClass::test_name -q
  - If you add ruff/black for Python:
    - Ruff check: ruff check backend
    - Format: black backend

Deployment references in-repo
- Render (backend/render.yaml):
  - build: pip install -r requirements.txt
  - start: gunicorn main:app --workers 1 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT
  - Python 3.11.x
- Deta Space (backend/Spacefile): uvicorn main:app --host 0.0.0.0 --port 8080, engine python3.9
- Vercel (frontend/vercel.json): static frontend config (backend is separate).

Repository-specific cautions
- Run from backend/ in development and in process managers so that relative static paths (../frontend/...) resolve.
- Ensure ffmpeg is installed so Whisper can decode webm/mp3/m4a/flac/ogg. Missing ffmpeg will cause decode errors at /transcribe.
- The root README.md describes a Flask + WebSocket approach that does not match the current FastAPI + file-upload backend. Prefer this WARP.md and backend/main.py for the authoritative implementation.
