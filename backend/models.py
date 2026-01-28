from pydantic import BaseModel
from typing import Optional

class TTSRequest(BaseModel):
    text: str
    language: str = "ru"
    speaker_wav: Optional[str] = None  # Voice ID (ShortName from edge-tts)
    speed: float = 1.0

class SpeakerResponse(BaseModel):
    id: str
    name: str
    preview_url: Optional[str] = None
