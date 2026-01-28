"""
Diagnostic script to test edge-tts functionality
Run this to verify edge-tts is working correctly
"""
import asyncio
import edge_tts
import os

async def test_edge_tts():
    print("=" * 60)
    print("Testing Edge-TTS")
    print("=" * 60)
    
    # Test 1: List voices
    print("\n1. Testing voice listing...")
    try:
        voices = await edge_tts.list_voices()
        print(f"✓ Successfully fetched {len(voices)} voices")
        
        # Show some Russian voices
        ru_voices = [v for v in voices if v['Locale'].startswith('ru-')]
        print(f"  Found {len(ru_voices)} Russian voices:")
        for v in ru_voices[:5]:
            print(f"    - {v['ShortName']}: {v['FriendlyName']}")
    except Exception as e:
        print(f"✗ Failed to list voices: {e}")
        return False
    
    # Test 2: Generate audio
    print("\n2. Testing audio generation...")
    test_text = "Привет, это тест."
    test_voice = "ru-RU-DmitryNeural"
    output_path = "test_output.mp3"
    
    try:
        communicate = edge_tts.Communicate(test_text, test_voice)
        await communicate.save(output_path)
        
        if os.path.exists(output_path):
            size = os.path.getsize(output_path)
            print(f"✓ Audio generated successfully")
            print(f"  File: {output_path}")
            print(f"  Size: {size} bytes")
            
            # Clean up
            os.remove(output_path)
            print(f"  Cleaned up test file")
            return True
        else:
            print(f"✗ Audio file was not created")
            return False
            
    except Exception as e:
        print(f"✗ Failed to generate audio: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    result = asyncio.run(test_edge_tts())
    print("\n" + "=" * 60)
    if result:
        print("✓ All tests passed - edge-tts is working correctly")
    else:
        print("✗ Tests failed - there's an issue with edge-tts")
    print("=" * 60)
