import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';

interface VoiceControlsProps {
    voices: SpeechSynthesisVoice[];
    selectedVoice: SpeechSynthesisVoice | null;
    onVoiceSelect: (voice: SpeechSynthesisVoice) => void;
    rate: number;
    onRateChange: (rate: number) => void;
}

export const VoiceControls = ({ voices, selectedVoice, onVoiceSelect, rate, onRateChange }: VoiceControlsProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap items-center gap-4 p-4 glass rounded-2xl shadow-xl z-20 relative"
        >
            {/* Custom Dropdown */}
            <div className="flex-1 min-w-[240px] relative" ref={dropdownRef}>
                <label className="text-xs text-text-secondary uppercase tracking-wider mb-2 block pl-1 font-semibold">Voice</label>

                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 text-left text-text-primary rounded-xl px-4 py-3 transition-colors border border-white/5"
                >
                    <span className="truncate">{selectedVoice ? `${selectedVoice.name} (${selectedVoice.lang})` : 'Select Voice'}</span>
                    <motion.svg
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        className="text-text-secondary ml-2 shrink-0"
                    >
                        <path d="m6 9 6 6 6-6" />
                    </motion.svg>
                </button>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.98 }}
                            transition={{ duration: 0.2 }}
                            className="absolute top-full left-0 right-0 mt-2 max-h-[300px] overflow-y-auto bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl p-1 no-scrollbar z-50"
                        >
                            {voices.map(voice => (
                                <button
                                    key={voice.name}
                                    onClick={() => {
                                        onVoiceSelect(voice);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors text-white ${selectedVoice?.name === voice.name
                                        ? 'bg-accent text-white font-medium'
                                        : 'hover:bg-white/10'
                                        }`}
                                >
                                    <div className="truncate">{voice.name}</div>
                                    <div className="text-xs opacity-60">{voice.lang}</div>
                                </button>
                            ))}
                            {voices.length === 0 && (
                                <div className="p-4 text-center text-text-secondary text-sm">No voices found</div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Speed Control */}
            <div className="flex-none w-48">
                <div className="flex justify-between items-center mb-2 px-1">
                    <label className="text-xs text-text-secondary uppercase tracking-wider font-semibold">Speed</label>
                    <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded text-center min-w-[3rem]">{rate}x</span>
                </div>
                <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={rate}
                    onChange={(e) => onRateChange(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125"
                />
            </div>
        </motion.div>
    );
};
