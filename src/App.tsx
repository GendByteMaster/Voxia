import { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { TextInput } from './components/TextInput';
import { VoiceControls } from './components/VoiceControls';
import { PlaybackControl } from './components/PlaybackControl';

function App() {
  const [text, setText] = useState('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [rate, setRate] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);

  const synth = useRef(window.speechSynthesis);

  // Load voices
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = synth.current.getVoices();
      setVoices(availableVoices);
      // Default to English if available, or first one
      if (!selectedVoice && availableVoices.length > 0) {
        const defaultVoice = availableVoices.find(v => v.lang.startsWith('en')) || availableVoices[0];
        setSelectedVoice(defaultVoice);
      }
    };

    loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [selectedVoice]);

  // Handle Playback
  const handleTogglePlay = () => {
    if (isPlaying) {
      synth.current.cancel();
      setIsPlaying(false);
    } else {
      if (!text) return;

      const utterance = new SpeechSynthesisUtterance(text);
      if (selectedVoice) utterance.voice = selectedVoice;
      utterance.rate = rate;

      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);

      synth.current.speak(utterance);
      setIsPlaying(true);
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
        synth.current.cancel();
        setIsPlaying(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, text, selectedVoice, rate]); // Re-bind when state changes to capture latest values

  return (
    <div className="h-screen bg-background text-text-primary flex flex-col font-sans selection:bg-accent selection:text-white overflow-hidden">
      <Header />

      <main className="flex-1 max-w-[1600px] mx-auto w-full p-4 md:p-8 flex flex-col gap-6 overflow-hidden">

        {/* Voice & Speed Controls */}
        <VoiceControls
          voices={voices}
          selectedVoice={selectedVoice}
          onVoiceSelect={setSelectedVoice}
          rate={rate}
          onRateChange={setRate}
        />

        {/* Text Area */}
        <div className="flex-1 min-h-0">
          <TextInput
            value={text}
            onChange={setText}
            placeholder="Type something to speak..."
          />
        </div>

        {/* Playback Controls */}
        <div className="h-24 flex items-center justify-center">
          <PlaybackControl
            isPlaying={isPlaying}
            onToggle={handleTogglePlay}
            disabled={!text}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
