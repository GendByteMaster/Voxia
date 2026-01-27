import { motion } from 'framer-motion';
import { clsx } from 'clsx';

interface PlaybackControlProps {
    isPlaying: boolean;
    onToggle: () => void;
    disabled: boolean;
}

export const PlaybackControl = ({ isPlaying, onToggle, disabled }: PlaybackControlProps) => {
    return (
        <div className="flex items-center gap-8">
            <motion.button
                whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(252, 76, 2, 0.4)" }}
                whileTap={{ scale: 0.95 }}
                onClick={onToggle}
                disabled={disabled}
                className={clsx(
                    "w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all relative z-10",
                    disabled ? "bg-white/5 cursor-not-allowed opacity-50" : "bg-accent text-white cursor-pointer"
                )}
            >
                {isPlaying ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="translate-x-1"><path d="M5 3l14 9-14 9V3z" /></svg>
                )}
            </motion.button>

            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] text-text-secondary/50 font-medium tracking-wider whitespace-nowrap">
                CTRL + ENTER
            </div>

            {/* Visualizer Mockup */}
            <div className="flex-1 h-16 glass rounded-2xl overflow-hidden flex items-center justify-center relative px-6 gap-1 shadow-lg">
                {Array.from({ length: 50 }).map((_, i) => (
                    <motion.div
                        key={i}
                        className="w-1.5 bg-accent rounded-full"
                        animate={{
                            height: isPlaying ? [4, Math.max(4, Math.random() * 40), 4] : 4,
                            opacity: isPlaying ? 0.8 : 0.2,
                            backgroundColor: isPlaying ? '#FC4C02' : '#ffffff'
                        }}
                        transition={{
                            repeat: Infinity,
                            duration: 0.4,
                            delay: i * 0.03,
                            ease: "easeInOut" // keeping it simple for now, could use spring
                        }}
                    />
                ))}
                {!isPlaying && <div className="absolute inset-0 flex items-center justify-center text-text-secondary text-sm font-medium tracking-wide">READY TO SPEAK</div>}
            </div>
        </div>
    );
};
