import edge_tts
from edge_tts.exceptions import NoAudioReceived
import tempfile
import os
import asyncio
import traceback
import re

class TTSEngine:
    def __init__(self):
        self.output_dir = os.path.join(os.path.dirname(__file__), "output")
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

    async def list_speakers(self):
        voices = await edge_tts.list_voices()
        # Filter for quality/popular ones if needed, or return all
        return [
            {"id": v["ShortName"], "name": f"{v['FriendlyName']} ({v['Gender']})"}
            for v in voices
        ]

    async def generate_audio_file(self, text: str, language: str, speaker_wav: str, speed: float = 1.0):
        # speaker_wav here is the Voice ID (ShortName)
        # Treat empty string as None
        if speaker_wav == "":
            speaker_wav = None
        voice = speaker_wav or "ru-RU-DmitryNeural"
        
        print(f"[TTS] Generating audio: text='{text[:50]}...', voice={voice}, speed={speed}")
        
        # Validate voice exists and get voice info
        voices = await edge_tts.list_voices()
        valid_voices = {v["ShortName"]: v for v in voices}
        
        if voice not in valid_voices:
            raise ValueError(f"Invalid voice ID: {voice}. Use /speakers endpoint to get valid voice IDs.")
        
        # Check for language mismatch and warn
        voice_locale = valid_voices[voice]["Locale"]
        voice_lang = voice_locale.split("-")[0].lower()  # e.g., "ru" from "ru-RU"
        
        # Detect if text contains Cyrillic (Russian), Latin, etc.
        has_cyrillic = bool(re.search(r'[а-яА-ЯёЁ]', text))
        has_chinese = bool(re.search(r'[\u4e00-\u9fff]', text))
        has_arabic = bool(re.search(r'[\u0600-\u06ff]', text))
        
        # Auto-correct for obvious mismatches
        if has_cyrillic and voice_lang not in ['ru', 'uk', 'be']:
            print(f"[TTS] WARNING: Detected Cyrillic text but voice is {voice_locale}. Auto-switching to Russian voice.")
            # Automatically switch to a Russian voice
            russian_voices = [v for v in voices if v["Locale"].startswith("ru-")]
            if russian_voices:
                voice = russian_voices[0]["ShortName"]
                voice_locale = russian_voices[0]["Locale"]
                voice_lang = voice_locale.split("-")[0].lower()
                print(f"[TTS] Switched to Russian voice: {voice}")
            else:
                raise ValueError(
                    f"Language mismatch: Detected Russian/Cyrillic text but selected voice '{voice}' is {voice_locale}, "
                    f"and no Russian voices are available."
                )
        
        if has_chinese and not voice_locale.startswith(("zh-", "cmn-")):
            print(f"[TTS] WARNING: Detected Chinese text but voice is {voice_locale}. Auto-switching to Chinese voice.")
            chinese_voices = [v for v in voices if v["Locale"].startswith("zh-")]
            if chinese_voices:
                voice = chinese_voices[0]["ShortName"]
                voice_locale = chinese_voices[0]["Locale"]
                voice_lang = voice_locale.split("-")[0].lower()
                print(f"[TTS] Switched to Chinese voice: {voice}")
            else:
                raise ValueError(
                    f"Language mismatch: Detected Chinese text but selected voice '{voice}' is {voice_locale}, "
                    f"and no Chinese voices are available."
                )
        
        if has_arabic and not voice_locale.startswith("ar-"):
            print(f"[TTS] WARNING: Detected Arabic text but voice is {voice_locale}. Auto-switching to Arabic voice.")
            arabic_voices = [v for v in voices if v["Locale"].startswith("ar-")]
            if arabic_voices:
                voice = arabic_voices[0]["ShortName"]
                voice_locale = arabic_voices[0]["Locale"]
                voice_lang = voice_locale.split("-")[0].lower()
                print(f"[TTS] Switched to Arabic voice: {voice}")
            else:
                raise ValueError(
                    f"Language mismatch: Detected Arabic text but selected voice '{voice}' is {voice_locale}, "
                    f"and no Arabic voices are available."
                )
        
        # Rate string format for edge-tts (e.g., "+50%", "-20%")
        # map 0.5 to -50%, 1.5 to +50%
        rate_pct = int((speed - 1.0) * 100)
        rate_str = f"{rate_pct:+d}%"

        print(f"[TTS] Creating communicate object with rate={rate_str}")
        communicate = edge_tts.Communicate(text, voice, rate=rate_str)
        
        fd, path = tempfile.mkstemp(suffix=".mp3", dir=self.output_dir)
        os.close(fd)
        
        print(f"[TTS] Saving audio to: {path}")
        
        try:
            await communicate.save(path)
            
            # Verify the file was created and has content
            if not os.path.exists(path):
                raise Exception("Audio file was not created")
            
            file_size = os.path.getsize(path)
            print(f"[TTS] Audio file created successfully. Size: {file_size} bytes")
            
            if file_size == 0:
                os.remove(path)
                raise Exception("Audio file is empty (0 bytes)")
                
        except NoAudioReceived as e:
            print(f"[TTS] NoAudioReceived error - likely language mismatch")
            print(traceback.format_exc())
            # Clean up temp file on error
            if os.path.exists(path):
                os.remove(path)
            
            # Provide helpful error message
            error_msg = (
                f"No audio received from Edge TTS service. This usually means the voice '{voice}' ({voice_locale}) "
                f"cannot synthesize the provided text. Common causes:\n"
                f"1. Language mismatch: The voice language doesn't match the text language\n"
                f"2. Unsupported characters: The text contains characters the voice cannot pronounce\n"
                f"Please select a voice that matches your text language."
            )
            raise ValueError(error_msg) from e
            
        except Exception as e:
            print(f"[TTS] Error during generation:")
            print(traceback.format_exc())
            # Clean up temp file on error
            if os.path.exists(path):
                os.remove(path)
            raise Exception(f"Edge-TTS error: {str(e)}") from e
        
        return path
