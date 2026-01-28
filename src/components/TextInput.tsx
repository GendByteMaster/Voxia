import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
    loadSpellChecker,
    loadSuggestionIndex,
    searchSuggestions,
    type SpellChecker,
    type SuggestionIndex
} from '../lib/languageTools';

interface TextInputProps {
    value: string;
    onChange: (val: string) => void;
    onSelectionChange?: (word: string | null) => void;
    placeholder?: string;
    language?: string;
}

const WORD_PATTERN = /[\p{L}\p{M}'-]+/u;
const WORD_SPLIT_PATTERN = /([\p{L}\p{M}'-]+)/gu;
const WORD_CHAR_PATTERN = /[\p{L}\p{M}'-]/u;
const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur', 'dv', 'ps', 'ku', 'yi']);
const SUGGESTION_LIMIT = 3;
const MIN_FONT_SIZE = 16;
const BASE_FONT_SIZE = 26;
const MD_FONT_SIZE = 34;

const getSelectedWord = (selection: string) => {
    const match = selection.match(WORD_PATTERN);
    return match ? match[0] : null;
};

type WordSegment = {
    text: string;
    index: number;
    length: number;
};

type WordRange = {
    word: string;
    start: number;
    end: number;
    prefix: string;
};

type SelectionRange = {
    start: number;
    end: number;
};

const getWordSegments = (text: string, segmenter: Intl.Segmenter | null) => {
    const segments: WordSegment[] = [];
    if (segmenter) {
        for (const segment of segmenter.segment(text)) {
            if (!segment.isWordLike) continue;
            segments.push({ text: segment.segment, index: segment.index, length: segment.segment.length });
        }
        return segments;
    }

    const regex = new RegExp(WORD_PATTERN.source, 'gu');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
        segments.push({ text: match[0], index: match.index, length: match[0].length });
    }
    return segments;
};

const normalizeForMatch = (value: string, locale?: string) => value.normalize('NFKC').toLocaleLowerCase(locale);
const mergeSuggestions = (candidates: string[], limit: number, exclude?: string, locale?: string) => {
    const normalizedExclude = exclude ? normalizeForMatch(exclude, locale) : null;
    const seen = new Set<string>();
    const result: string[] = [];
    for (const candidate of candidates) {
        if (!candidate) continue;
        const key = normalizeForMatch(candidate, locale);
        if (!key) continue;
        if (normalizedExclude && key === normalizedExclude) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(candidate);
        if (result.length >= limit) break;
    }
    return result;
};

const getActiveWordRange = (text: string, selection: SelectionRange, segments: WordSegment[]) => {
    if (!text || selection.start !== selection.end) return null;
    const caret = selection.start;
    const before = caret > 0 ? text[caret - 1] : '';
    const after = caret < text.length ? text[caret] : '';
    if (!before && !after) return null;
    if (!(before && WORD_CHAR_PATTERN.test(before)) && !(after && WORD_CHAR_PATTERN.test(after))) return null;

    const candidate = segments.find((segment) => caret > segment.index && caret <= segment.index + segment.length)
        ?? segments.find((segment) => caret === segment.index)
        ?? segments.find((segment) => caret === segment.index + segment.length);
    if (!candidate) return null;

    const start = candidate.index;
    const end = candidate.index + candidate.length;
    const prefix = text.slice(start, Math.min(caret, end));
    if (!prefix) return null;

    return {
        word: candidate.text,
        start,
        end,
        prefix
    } satisfies WordRange;
};

const buildWordFrequency = (segments: WordSegment[], locale?: string) => {
    const map = new Map<string, { word: string; count: number }>();
    for (const segment of segments) {
        const key = normalizeForMatch(segment.text, locale);
        const entry = map.get(key);
        if (entry) {
            entry.count += 1;
            entry.word = segment.text;
        } else {
            map.set(key, { word: segment.text, count: 1 });
        }
    }
    return map;
};

const getSuggestions = (activeWord: WordRange | null, frequency: Map<string, { word: string; count: number }>, locale?: string) => {
    if (!activeWord) return [];
    const prefixKey = normalizeForMatch(activeWord.prefix, locale);
    if (!prefixKey) return [];

    const exactKey = normalizeForMatch(activeWord.word, locale);
    const matches: { word: string; count: number; key: string }[] = [];

    for (const [key, entry] of frequency) {
        if (key === exactKey) continue;
        if (key.startsWith(prefixKey)) {
            matches.push({ word: entry.word, count: entry.count, key });
        }
    }

    matches.sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.word.localeCompare(b.word, locale, { sensitivity: 'base' });
    });

    const seen = new Set<string>();
    const result: string[] = [];
    for (const match of matches) {
        if (seen.has(match.key)) continue;
        seen.add(match.key);
        result.push(match.word);
        if (result.length >= SUGGESTION_LIMIT) break;
    }
    return result;
};

const getWordAtPosition = (text: string, index: number) => {
    if (!text) return null;
    const safeIndex = Math.max(0, Math.min(index, text.length));
    const prevChar = safeIndex > 0 ? text[safeIndex - 1] : '';
    const nextChar = text[safeIndex] ?? '';
    let start = -1;
    let end = -1;

    if (prevChar && WORD_CHAR_PATTERN.test(prevChar)) {
        start = safeIndex - 1;
        end = safeIndex - 1;
    } else if (nextChar && WORD_CHAR_PATTERN.test(nextChar)) {
        start = safeIndex;
        end = safeIndex;
    } else {
        return null;
    }

    while (start > 0 && WORD_CHAR_PATTERN.test(text[start - 1])) start -= 1;
    while (end + 1 < text.length && WORD_CHAR_PATTERN.test(text[end + 1])) end += 1;

    const word = text.slice(start, end + 1);
    return word || null;
};

export const TextInput = ({ value, onChange, onSelectionChange, placeholder, language }: TextInputProps) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const hasText = value.length > 0;
    const [selection, setSelection] = useState<SelectionRange>({ start: 0, end: 0 });
    const [suggestionIndex, setSuggestionIndex] = useState<SuggestionIndex | null>(null);
    const [spellChecker, setSpellChecker] = useState<SpellChecker | null>(null);
    const [maxFontSize, setMaxFontSize] = useState(
        typeof window !== 'undefined' && window.innerWidth >= 768 ? MD_FONT_SIZE : BASE_FONT_SIZE
    );
    const [fontSize, setFontSize] = useState(maxFontSize);
    const normalizedLanguage = language?.trim() || undefined;
    const languageCode = normalizedLanguage?.split(/[-_]/)[0]?.toLowerCase();
    const isRtl = languageCode ? RTL_LANGUAGES.has(languageCode) : false;
    const segmenter = useMemo(() => {
        if (typeof Intl === 'undefined' || !('Segmenter' in Intl)) return null;
        return new Intl.Segmenter(normalizedLanguage, { granularity: 'word' });
    }, [normalizedLanguage]);
    const tokens = useMemo(() => {
        if (!value) return [];
        return value.split(WORD_SPLIT_PATTERN);
    }, [value]);
    const wordSegments = useMemo(() => getWordSegments(value, segmenter), [value, segmenter]);
    const wordFrequency = useMemo(() => buildWordFrequency(wordSegments, normalizedLanguage), [wordSegments, normalizedLanguage]);
    const activeWord = useMemo(() => getActiveWordRange(value, selection, wordSegments), [value, selection, wordSegments]);
    const localSuggestions = useMemo(
        () => getSuggestions(activeWord, wordFrequency, normalizedLanguage),
        [activeWord, wordFrequency, normalizedLanguage]
    );
    const dictionarySuggestions = useMemo(() => {
        if (!activeWord?.prefix || !suggestionIndex) return [];
        if (activeWord.prefix.length < 2) return [];
        return searchSuggestions(suggestionIndex, activeWord.prefix, SUGGESTION_LIMIT, normalizedLanguage);
    }, [activeWord, suggestionIndex, normalizedLanguage]);
    const spellSuggestions = useMemo(() => {
        if (!activeWord || !spellChecker) return [];
        if (activeWord.word.length < 3) return [];
        if (spellChecker.check(activeWord.word)) return [];
        return spellChecker.suggest(activeWord.word).slice(0, SUGGESTION_LIMIT);
    }, [activeWord, spellChecker]);
    const suggestions = useMemo(() => {
        if (!activeWord) return [];
        return mergeSuggestions(
            [...spellSuggestions, ...dictionarySuggestions, ...localSuggestions],
            SUGGESTION_LIMIT,
            activeWord.word,
            normalizedLanguage
        );
    }, [activeWord, dictionarySuggestions, localSuggestions, spellSuggestions, normalizedLanguage]);
    const lineHeight = useMemo(() => Math.round(fontSize * 1.45), [fontSize]);
    const textStyle = useMemo(
        () => ({ fontSize: `${fontSize}px`, lineHeight: `${lineHeight}px` }),
        [fontSize, lineHeight]
    );

    useEffect(() => {
        const update = () => {
            const next = window.innerWidth >= 768 ? MD_FONT_SIZE : BASE_FONT_SIZE;
            setMaxFontSize(next);
        };
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    useLayoutEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const max = maxFontSize;
        const min = MIN_FONT_SIZE;
        let low = min;
        let high = max;
        let best = min;

        const fits = (size: number) => {
            const nextLineHeight = Math.round(size * 1.45);
            textarea.style.fontSize = `${size}px`;
            textarea.style.lineHeight = `${nextLineHeight}px`;
            return textarea.scrollHeight <= textarea.clientHeight + 1;
        };

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            if (fits(mid)) {
                best = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        if (best !== fontSize) {
            setFontSize(best);
        }
    }, [value, maxFontSize, fontSize, isRtl]);

    useEffect(() => {
        let active = true;
        setSuggestionIndex(null);
        if (!normalizedLanguage) return;
        loadSuggestionIndex(normalizedLanguage).then((index) => {
            if (active) setSuggestionIndex(index);
        });
        return () => {
            active = false;
        };
    }, [normalizedLanguage]);

    useEffect(() => {
        let active = true;
        setSpellChecker(null);
        if (!normalizedLanguage) return;
        loadSpellChecker(normalizedLanguage).then((checker) => {
            if (active) setSpellChecker(checker);
        });
        return () => {
            active = false;
        };
    }, [normalizedLanguage]);

    const updateSelection = (target: HTMLTextAreaElement) => {
        const start = target.selectionStart ?? 0;
        const end = target.selectionEnd ?? 0;
        setSelection({ start, end });
        return { start, end };
    };

    const handleSelection = (target: HTMLTextAreaElement) => {
        const { start, end } = updateSelection(target);
        if (start === end) {
            onSelectionChange?.(getWordAtPosition(target.value, start));
            return;
        }
        const selection = target.value.slice(start, end).trim();
        onSelectionChange?.(selection ? getSelectedWord(selection) : null);
    };

    const applySuggestion = (suggestion: string) => {
        if (!activeWord) return;
        const before = value.slice(0, activeWord.start);
        const after = value.slice(activeWord.end);
        const nextValue = `${before}${suggestion}${after}`;
        const nextCaret = before.length + suggestion.length;
        onChange(nextValue);
        requestAnimationFrame(() => {
            const textarea = textareaRef.current;
            if (!textarea) return;
            textarea.focus();
            textarea.setSelectionRange(nextCaret, nextCaret);
            setSelection({ start: nextCaret, end: nextCaret });
        });
    };

    const handleScroll = (target: HTMLTextAreaElement) => {
        if (overlayRef.current) {
            overlayRef.current.scrollTop = target.scrollTop;
            overlayRef.current.scrollLeft = target.scrollLeft;
        }
    };

    return (
        <motion.div
            layout
            className="flex flex-col h-full glass rounded-[24px] overflow-hidden transition-all h-[520px] md:h-[600px] lg:h-[680px] ring-1 ring-black/5 focus-within:ring-2 focus-within:ring-accent/30"
            style={{ minHeight: '520px' }}
        >
            <div className="flex-1 relative group">
                {suggestions.length > 0 && (
                    <div className="absolute bottom-6 left-6 z-20 flex flex-wrap gap-2">
                        {suggestions.map((suggestion, index) => (
                            <button
                                key={`${suggestion}-${index}`}
                                type="button"
                                onMouseDown={(event) => {
                                    event.preventDefault();
                                    applySuggestion(suggestion);
                                }}
                                className="px-3 py-1 text-xs font-semibold rounded-full bg-white/80 text-text-secondary border border-black/10 hover:bg-white transition-colors"
                                title={`Insert "${suggestion}" (Tab)`}
                            >
                                {suggestion}
                            </button>
                        ))}
                    </div>
                )}
                {hasText && (
                    <div
                        ref={overlayRef}
                        className="absolute inset-0 z-10 p-10 font-normal tracking-tight text-text-primary whitespace-pre-wrap break-words pointer-events-none overflow-hidden"
                        dir={isRtl ? 'rtl' : 'ltr'}
                        style={textStyle}
                        aria-hidden="true"
                    >
                        {tokens.map((token, index) => {
                            if (!token) return null;
                            if (WORD_PATTERN.test(token)) {
                                return (
                                    <span
                                        key={`${token}-${index}`}
                                        className="underline underline-offset-[6px] decoration-accent/30"
                                    >
                                        {token}
                                    </span>
                                );
                            }
                            return <span key={`sep-${index}`}>{token}</span>;
                        })}
                    </div>
                )}
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => {
                        onChange(e.target.value);
                        updateSelection(e.currentTarget);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Tab' && suggestions.length > 0) {
                            e.preventDefault();
                            applySuggestion(suggestions[0]);
                        }
                    }}
                    onMouseUp={(e) => handleSelection(e.currentTarget)}
                    onKeyUp={(e) => handleSelection(e.currentTarget)}
                    onTouchEnd={(e) => handleSelection(e.currentTarget)}
                    onSelect={(e) => handleSelection(e.currentTarget)}
                    onScroll={(e) => handleScroll(e.currentTarget)}
                    placeholder={placeholder}
                    lang={normalizedLanguage}
                    dir={isRtl ? 'rtl' : 'ltr'}
                    spellCheck
                    autoCorrect="on"
                    autoCapitalize="sentences"
                    autoComplete="on"
                    className={clsx(
                        "w-full h-full p-10 bg-transparent resize-none outline-none placeholder-text-secondary/40 scrollbar-thin font-normal tracking-tight relative z-0",
                        hasText ? "text-transparent" : "text-text-primary"
                    )}
                    style={{ fontFamily: 'inherit', caretColor: 'var(--color-text-primary)', ...textStyle }}
                    autoFocus
                />

                <div className="absolute bottom-6 right-6 flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="text-sm text-text-secondary transition-colors">
                        {value.length} characters
                    </div>
                    {value && (
                        <button
                            onClick={() => onChange('')}
                            className="p-2 rounded-full hover:bg-black/5 text-text-secondary hover:text-red-500 transition-colors"
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

