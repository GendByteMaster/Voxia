from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import os
import uvicorn
from contextlib import asynccontextmanager

from models import TTSRequest, SpeakerResponse
from tts_engine import TTSEngine

# Global engine instance
engine = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global engine
    # Load model on startup
    engine = TTSEngine()
    yield
    # Clean up if needed

app = FastAPI(lifespan=lifespan)

# CORS configuration
origins = [
    "http://localhost:5173",  # Vite default
    "http://127.0.0.1:5173",
    "*" # For dev
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def read_root():
    return {"status": "ok", "model_loaded": engine is not None}

@app.get("/speakers", response_model=list[SpeakerResponse])
async def get_speakers():
    if not engine:
        raise HTTPException(status_code=503, detail="Engine not loaded")
    return await engine.list_speakers()

@app.post("/tts")
async def generate_speech(request: TTSRequest):
    if not engine:
        raise HTTPException(status_code=503, detail="Engine not loaded")
    
    print(f"[API] Received TTS request: text='{request.text[:50]}...', speaker={request.speaker_wav}, speed={request.speed}")
    
    try:
        output_path = await engine.generate_audio_file(
            text=request.text,
            language=request.language,
            speaker_wav=request.speaker_wav,
            speed=request.speed
        )
        # Check if file exists to be safe
        if not os.path.exists(output_path):
             raise HTTPException(status_code=500, detail="Audio file not generated")
             
        # media_type audio/mpeg for mp3 which edge-tts produces
        return FileResponse(output_path, media_type="audio/mpeg", filename="output.mp3")
    except Exception as e:
        print(f"Error generating TTS: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8090, reload=True)
