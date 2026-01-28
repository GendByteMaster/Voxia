import { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { TextInput } from './components/TextInput';
import { VoiceControls } from './components/VoiceControls';
import { PlaybackControl } from './components/PlaybackControl';
import { LanguageInsights } from './components/LanguageInsights';

type VoiceOption = {
  name: string;
  lang?: string;
  id: string;
  original?: SpeechSynthesisVoice;
};

const extractLocaleFromId = (id?: string | null) => {
  if (!id) return null;
  const match = id.match(/^([a-z]{2,3}-[A-Z]{2})/);
  return match ? match[1] : null;
};

const normalizeLang = (lang?: string | null) => {
  if (!lang) return null;
  return lang.split(/[-_]/)[0].toLowerCase();
};

const detectTextLanguage = (text: string) => {
  if (/[\u0400-\u04ff]/.test(text)) return 'ru';
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
  if (/[\u3040-\u30ff]/.test(text)) return 'ja';
  if (/[\uac00-\ud7af]/.test(text)) return 'ko';
  if (/[\u0600-\u06ff]/.test(text)) return 'ar';
  if (/[\u0590-\u05ff]/.test(text)) return 'he';
  if (/[\u0900-\u097f]/.test(text)) return 'hi';
  if (/[\u0e00-\u0e7f]/.test(text)) return 'th';
  if (/[\u0370-\u03ff]/.test(text)) return 'el';
  return null;
};

const getVoiceLocale = (voice: VoiceOption | null) => {
  if (!voice) return null;
  return voice.lang || extractLocaleFromId(voice.id);
};

const getBackendLanguage = (text: string, voice: VoiceOption | null) => {
  const detected = detectTextLanguage(text);
  if (detected) return detected;
  const voiceLocale = getVoiceLocale(voice);
  return normalizeLang(voiceLocale) || 'en';
};

const getFocusWord = (text: string) => {
  const matches = text.match(/[\p{L}\p{M}'-]+/gu);
  if (!matches || matches.length === 0) return null;
  return matches[matches.length - 1];
};

function App() {
  const [useBackend, setUseBackend] = useState(true);
  const [browserVoices, setBrowserVoices] = useState<VoiceOption[]>([]);
  const [backendVoices, setBackendVoices] = useState<VoiceOption[]>([]);

  // Computed voices list based on mode
  const voices = useBackend ? backendVoices : browserVoices;
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption | null>(null);

  const [text, setText] = useState('');
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [rate, setRate] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const synth = useRef(window.speechSynthesis);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load Browser Voices
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = synth.current.getVoices().map(v => ({
        name: v.name,
        lang: v.lang,
        id: v.voiceURI,
        original: v
      }));
      setBrowserVoices(availableVoices);

      if (!selectedVoice && !useBackend && availableVoices.length > 0) {
        const defaultVoice = availableVoices.find(v => v.lang.startsWith('en')) || availableVoices[0];
        setSelectedVoice(defaultVoice);
      }
    };

    loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [selectedVoice, useBackend]);

  // Load Backend Voices
  useEffect(() => {
    if (useBackend) {
      // Import the api dynamically or assume it's available global/imported
      import('./api/tts').then(async ({ ttsApi }) => {
        try {
          const speakers = await ttsApi.getSpeakers();
          const formatted = speakers.map(s => {
            const locale = s.language || extractLocaleFromId(s.id);
            return {
              name: s.name,
              lang: locale || undefined,
              id: s.id
            };
          });
          setBackendVoices(formatted);
          if (formatted.length > 0 && (!selectedVoice || !formatted.find(v => v.id === selectedVoice.id))) {
            setSelectedVoice(formatted[0]);
          }
        } catch (e) {
          console.error("Failed to load backend voices", e);
        }
      });
    } else {
      // Switch back to browser voice if needed
      if (browserVoices.length > 0) {
        // check if current selectedVoice is in browserVoices
        const exists = browserVoices.find(v => v.id === selectedVoice?.id);
        if (!exists) setSelectedVoice(browserVoices[0]);
      }
    }
  }, [useBackend, browserVoices]); // Removed selectedVoice from deps to avoid loop

  // Auto-switch voice to match detected text language (when possible)
  useEffect(() => {
    if (!text.trim() || voices.length === 0) return;
    const detectedLang = detectTextLanguage(text);
    if (!detectedLang) return;
    const currentLang = normalizeLang(getVoiceLocale(selectedVoice));
    if (currentLang === detectedLang) return;
    const match = voices.find(
      (voice) => normalizeLang(getVoiceLocale(voice)) === detectedLang
    );
    if (match) {
      setSelectedVoice(match);
    }
  }, [text, voices, selectedVoice]);

  // Handle Playback
  const handleTogglePlay = async () => {
    if (isPlaying) {
      if (useBackend) {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
      } else {
        synth.current.cancel();
      }
      setIsPlaying(false);
    } else {
      if (!text) return;

      if (useBackend) {
        try {
          const { ttsApi } = await import('./api/tts');
          const language = getBackendLanguage(text, selectedVoice);
          const blob = await ttsApi.generateSpeech(text, selectedVoice?.id || '', language, rate);
          const url = URL.createObjectURL(blob);
          setAudioUrl(url);

          if (audioRef.current) {
            audioRef.current.src = url;
            audioRef.current.play();
            setIsPlaying(true);
            audioRef.current.onended = () => setIsPlaying(false);
          } else {
            const audio = new Audio(url);
            audioRef.current = audio;
            audio.play();
            setIsPlaying(true);
            audio.onended = () => setIsPlaying(false);
          }
        } catch (e) {
          console.error(e);
          alert("Backend TTS failed. Ensure backend is running.");
          setIsPlaying(false);
        }
      } else {
        const utterance = new SpeechSynthesisUtterance(text);
        if (selectedVoice && selectedVoice.original) utterance.voice = selectedVoice.original;
        utterance.rate = rate;

        utterance.onend = () => setIsPlaying(false);
        utterance.onerror = () => setIsPlaying(false);

        synth.current.speak(utterance);
        setIsPlaying(true);
      }
    }
  };

  // Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleTogglePlay();
      }
      if (e.key === 'Escape') {
        if (useBackend && audioRef.current) {
          audioRef.current.pause();
        } else {
          synth.current.cancel();
        }
        setIsPlaying(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, text, selectedVoice, rate, useBackend]);

  const autoLanguage = getBackendLanguage(text, selectedVoice);
  const focusWord = selectedWord || getFocusWord(text);

  const handleTextChange = (value: string) => {
    setText(value);
    if (selectedWord) setSelectedWord(null);
  };

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col font-sans selection:bg-accent selection:text-white">
      <Header />

      <main className="flex-1 max-w-[1320px] mx-auto w-full px-6 py-8 md:px-10 md:py-10">
        <div className="flex flex-col gap-8">
          <VoiceControls
            selectedVoice={selectedVoice}
            rate={rate}
            onRateChange={setRate}
            useBackend={useBackend}
            onToggleBackend={setUseBackend}
            autoLanguage={autoLanguage}
          />

          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_440px]">
            <div className="flex flex-col gap-6">
              <div className="min-h-[280px] md:min-h-[360px] lg:min-h-[420px]">
                <TextInput
                  value={text}
                  onChange={handleTextChange}
                  onSelectionChange={setSelectedWord}
                  placeholder="Type something to speak..."
                  language={autoLanguage}
                />
              </div>

              <div className="h-24 flex items-center justify-center pb-6">
                <PlaybackControl
                  isPlaying={isPlaying}
                  onToggle={handleTogglePlay}
                  disabled={!text}
                />
              </div>
            </div>

            <aside className="self-start xl:sticky xl:top-24">
              <LanguageInsights word={focusWord} language={autoLanguage} text={text} />
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;

