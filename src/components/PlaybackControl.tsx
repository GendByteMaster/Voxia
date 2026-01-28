import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { useMemo, type CSSProperties } from 'react';

interface PlaybackControlProps {
    isPlaying: boolean;
    onToggle: () => void;
    disabled: boolean;
}

export const PlaybackControl = ({ isPlaying, onToggle, disabled }: PlaybackControlProps) => {
    const bars = useMemo(
        () =>
            Array.from({ length: 50 }, (_, index) => ({
                id: index,
                scale: 0.35 + Math.random() * 0.9,
                duration: 0.55 + Math.random() * 0.6,
                delay: index * 0.03
            })),
        []
    );

    return (
        <div className="flex items-center gap-8">
            <div className="flex flex-col items-center gap-2">
                <motion.button
                    whileHover={{ scale: 1.04, boxShadow: "0 18px 36px rgba(0, 122, 255, 0.3)" }}
                    whileTap={{ scale: 0.96 }}
                    onClick={onToggle}
                    disabled={disabled}
                    className={clsx(
                        "w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center shadow-lg transition-all",
                        disabled
                            ? "bg-black/5 text-text-secondary cursor-not-allowed"
                            : "bg-accent text-white cursor-pointer"
                    )}
                >
                    {isPlaying ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="translate-x-0.5"><path d="M5 3l14 9-14 9V3z" /></svg>
                    )}
                </motion.button>
                <div className="text-[10px] text-text-secondary font-semibold tracking-[0.25em]">
                    CTRL + ENTER
                </div>
            </div>

            <div
                className={clsx(
                    "flex-1 h-16 glass rounded-[20px] overflow-hidden flex items-center justify-center relative px-6 gap-1",
                    !isPlaying && "equalizer-paused"
                )}
            >
                {bars.map((bar) => {
                    const style = {
                        '--bar-scale': bar.scale.toString(),
                        '--bar-duration': `${bar.duration}s`,
                        '--bar-delay': `${bar.delay}s`
                    } as CSSProperties;

                    return (
                        <div
                            key={bar.id}
                            className={clsx(
                                "equalizer-bar w-1.5 rounded-full",
                                isPlaying ? "bg-accent" : "bg-black/20"
                            )}
                            style={style}
                        />
                    );
                })}
                {!isPlaying && <div className="absolute inset-0 flex items-center justify-center text-text-secondary text-sm font-medium tracking-wide">READY TO SPEAK</div>}
            </div>
        </div>
    );
};
