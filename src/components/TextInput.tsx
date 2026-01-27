import { motion } from 'framer-motion';


interface TextInputProps {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
}

export const TextInput = ({ value, onChange, placeholder }: TextInputProps) => {
    return (
        <motion.div
            layout
            className="flex flex-col h-full glass rounded-3xl overflow-hidden shadow-2xl transition-all"
        >
            <div className="flex-1 relative group">
                <textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full h-full p-8 bg-transparent resize-none outline-none text-3xl leading-relaxed text-text-primary placeholder-text-secondary/30 scrollbar-thin font-light"
                    style={{ fontFamily: 'inherit' }}
                    autoFocus
                />

                <div className="absolute bottom-6 right-6 flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="text-sm text-text-secondary transition-colors">
                        {value.length} characters
                    </div>
                    {value && (
                        <button
                            onClick={() => onChange('')}
                            className="p-2 rounded-full hover:bg-surface-hover text-text-secondary hover:text-red-400 transition-colors"
                            title="Clear text"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
};
