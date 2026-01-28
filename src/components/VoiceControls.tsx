import { motion } from 'framer-motion';
import { clsx } from 'clsx';

interface VoiceOption {
    name: string;
    lang?: string;
    id: string; // voiceURI for browser, id for backend
}

interface VoiceControlsProps {
    selectedVoice: VoiceOption | null;
    rate: number;
    onRateChange: (rate: number) => void;
    useBackend: boolean;
    onToggleBackend: (use: boolean) => void;
    autoLanguage: string;
}

export const VoiceControls = ({
    selectedVoice,
    rate,
    onRateChange,
    useBackend,
    onToggleBackend,
    autoLanguage
}: VoiceControlsProps) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap items-center gap-6 p-6 glass rounded-[24px] z-20 relative"
        >
            <div className="flex flex-col gap-2 items-start">
                <label className="text-[10px] text-text-secondary uppercase tracking-[0.3em] font-semibold">Engine</label>
                <div className="inline-flex items-center rounded-full bg-black/5 p-1 border border-black/10 shadow-inner">
                    <button
                        type="button"
                        onClick={() => onToggleBackend(true)}
                        className={clsx(
                            "px-3.5 py-1.5 text-[11px] font-semibold rounded-full transition-all",
                            useBackend
                                ? "bg-white text-text-primary shadow-sm"
                                : "text-text-secondary hover:text-text-primary"
                        )}
                    >
                        Neural / XTTS
                    </button>
                    <button
                        type="button"
                        onClick={() => onToggleBackend(false)}
                        className={clsx(
                            "px-3.5 py-1.5 text-[11px] font-semibold rounded-full transition-all",
                            !useBackend
                                ? "bg-white text-text-primary shadow-sm"
                                : "text-text-secondary hover:text-text-primary"
                        )}
                    >
                        Browser / Native
                    </button>
                </div>
            </div>

            <div className="flex-1 min-w-[240px] relative">
                <label className="text-[10px] text-text-secondary uppercase tracking-[0.3em] mb-2 block pl-1 font-semibold">Voice</label>
                <div className="w-full bg-white/80 text-left text-text-primary rounded-[20px] px-4 py-3 border border-black/10 shadow-sm">
                    <div className="truncate font-medium">
                        {selectedVoice ? selectedVoice.name : 'Auto voice'}
                    </div>
                    {selectedVoice?.lang && <div className="text-xs text-text-secondary mt-1">{selectedVoice.lang}</div>}
                </div>
            </div>

            <div className="flex-none w-56">
                <div className="flex justify-between items-center mb-3 px-1 gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                        <label className="text-[10px] text-text-secondary uppercase tracking-[0.3em] font-semibold">Speed</label>
                        <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-text-secondary bg-black/5 px-2 py-0.5 rounded-full border border-black/10 inline-flex items-center gap-1 whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden="true"></span>
                            Auto
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-text-secondary bg-white/80 px-2 py-0.5 rounded-full border border-black/10 whitespace-nowrap">
                            {autoLanguage.toUpperCase()}
                        </span>
                    </div>
                    <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full text-center min-w-[3rem]">{rate}x</span>
                </div>
                <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={rate}
                    onChange={(e) => onRateChange(parseFloat(e.target.value))}
                    className="accented-range w-full h-1.5 rounded-full cursor-pointer bg-black/10"
                />
            </div>
        </motion.div>
    );
};
