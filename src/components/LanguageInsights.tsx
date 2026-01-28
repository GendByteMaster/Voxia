import { useEffect, useMemo, useState } from 'react';
import { getPackEntry, loadDictionaryPack, type DictionaryPackEntry } from '../lib/languageTools';

type DictionaryDefinition = {
    definition: string;
    example?: string;
    synonyms?: string[];
    antonyms?: string[];
};

type DictionaryMeaning = {
    partOfSpeech?: string;
    definitions: DictionaryDefinition[];
    synonyms?: string[];
    antonyms?: string[];
};

type DictionaryEntry = {
    word: string;
    phonetic?: string;
    phonetics?: { text?: string; audio?: string }[];
    meanings?: DictionaryMeaning[];
};

type Notice = {
    kind: 'unavailable' | 'fallback';
    message: string;
};

type DictionaryState =
    | { status: 'idle'; entry: null; language: string; error?: string }
    | { status: 'loading'; entry: null; language: string; error?: string }
    | { status: 'ready'; entry: DictionaryEntry; language: string; error?: string }
    | { status: 'error'; entry: null; language: string; error: string };

type AsyncState = 'idle' | 'loading' | 'ready' | 'error';

const API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries';
const DATAMUSE_API = 'https://api.datamuse.com/words';
const WORDNIK_API = 'https://api.wordnik.com/v4/word.json';
const WORDNIK_API_KEY = import.meta.env.VITE_WORDNIK_API_KEY as string | undefined;

const cache = new Map<string, DictionaryEntry>();

const SUPPORTED_DICTIONARY_LANGUAGES: Record<string, string> = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    it: 'Italian',
    pt: 'Portuguese',
    'pt-br': 'Portuguese (Brazil)',
    ru: 'Russian',
    ja: 'Japanese',
    ko: 'Korean',
    hi: 'Hindi',
    ar: 'Arabic'
};

const WORD_PATTERN = /[\p{L}\p{M}'-]+/u;
const LATIN_WORD_PATTERN = /^[\p{Script=Latin}\p{M}'-]+$/u;

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();
const normalizeForMatch = (value: string, locale?: string) => value.normalize('NFKC').toLocaleLowerCase(locale);

type SegmentData = {
    segment: string;
    index: number;
    isWordLike?: boolean;
};

type Segmenter = {
    segment: (input: string) => Iterable<SegmentData>;
} | null;

const createSegmenter = (language: string, granularity: 'word' | 'sentence'): Segmenter => {
    if (typeof Intl === 'undefined' || !('Segmenter' in Intl)) return null;
    const SegmenterConstructor = (Intl as typeof Intl & { Segmenter: new (locale?: string, options?: object) => Segmenter }).Segmenter;
    try {
        return new SegmenterConstructor(language || undefined, { granularity }) as Segmenter;
    } catch {
        return new SegmenterConstructor(undefined, { granularity }) as Segmenter;
    }
};

const uniqueStrings = (items: string[], limit: number, exclude?: string) => {
    const normalizedExclude = exclude ? normalizeWhitespace(exclude).toLowerCase() : null;
    const seen = new Set<string>();
    const result: string[] = [];
    for (const item of items) {
        const cleaned = normalizeWhitespace(item);
        if (!cleaned) continue;
        const key = cleaned.toLowerCase();
        if (normalizedExclude && key === normalizedExclude) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(cleaned);
        if (result.length >= limit) break;
    }
    return result;
};

const getWordSegmentsFromText = (text: string, segmenter: Segmenter) => {
    if (!text) return [];
    const segments: string[] = [];
    if (segmenter) {
        for (const segment of segmenter.segment(text)) {
            if (segment.isWordLike === false) continue;
            if (segment.segment) segments.push(segment.segment);
        }
        return segments;
    }

    const regex = new RegExp(WORD_PATTERN.source, 'gu');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
        segments.push(match[0]);
    }
    return segments;
};

const getSentenceSegments = (text: string, segmenter: Segmenter) => {
    if (!text) return [];
    if (segmenter) {
        return Array.from(segmenter.segment(text), (segment) => segment.segment);
    }
    return text.split(/(?:\r?\n)+|[.!?]+/g);
};

const sentenceHasWord = (sentence: string, wordKey: string, segmenter: Segmenter, locale?: string) => {
    if (!sentence) return false;
    if (segmenter) {
        for (const segment of segmenter.segment(sentence)) {
            if (segment.isWordLike === false) continue;
            if (normalizeForMatch(segment.segment, locale) === wordKey) return true;
        }
        return false;
    }
    return normalizeForMatch(sentence, locale).includes(wordKey);
};

const getExamplesFromText = (
    text: string,
    word: string,
    sentenceSegmenter: Segmenter,
    wordSegmenter: Segmenter,
    locale: string,
    limit = 3
) => {
    if (!text || !word) return [];
    const normalizedWord = normalizeForMatch(word, locale);
    if (!normalizedWord) return [];
    const sentences = getSentenceSegments(text, sentenceSegmenter);
    const examples: string[] = [];
    for (const sentence of sentences) {
        const cleaned = normalizeWhitespace(sentence);
        if (!cleaned) continue;
        if (sentenceHasWord(cleaned, normalizedWord, wordSegmenter, locale)) {
            examples.push(cleaned);
            if (examples.length >= limit) break;
        }
    }
    return uniqueStrings(examples, limit);
};

const getRelatedFromText = (text: string, word: string, wordSegmenter: Segmenter, locale: string, limit = 8) => {
    if (!text || !word) return [];
    const normalizedWord = normalizeForMatch(word, locale);
    const segments = getWordSegmentsFromText(text, wordSegmenter);
    const frequency = new Map<string, { word: string; count: number }>();
    for (const segment of segments) {
        const key = normalizeForMatch(segment, locale);
        if (!key || key === normalizedWord) continue;
        const entry = frequency.get(key);
        if (entry) {
            entry.count += 1;
            entry.word = segment;
        } else {
            frequency.set(key, { word: segment, count: 1 });
        }
    }
    const sorted = Array.from(frequency.values()).sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.word.localeCompare(b.word, locale, { sensitivity: 'base' });
    });
    return uniqueStrings(sorted.map((item) => item.word), limit, word);
};

const buildEntryFromPack = (entry: DictionaryPackEntry): DictionaryEntry => {
    const definitions = entry.definitions?.length
        ? entry.definitions.map((definition) => ({ definition }))
        : [];
    return {
        word: entry.word,
        meanings: definitions.length
            ? [
                {
                    partOfSpeech: entry.partOfSpeech,
                    definitions
                }
            ]
            : []
    };
};

const normalizeLanguage = (language: string) => {
    const normalized = language.trim().toLowerCase().replace(/_/g, '-');
    if (!normalized) return 'en';
    return normalized;
};

const resolveDictionaryLanguage = (language: string) => {
    const requested = normalizeLanguage(language);
    const base = requested.split('-')[0];
    const supportedCode = SUPPORTED_DICTIONARY_LANGUAGES[requested]
        ? requested
        : SUPPORTED_DICTIONARY_LANGUAGES[base]
            ? base
            : null;
    const code = supportedCode ?? requested;
    const label = SUPPORTED_DICTIONARY_LANGUAGES[code] ?? SUPPORTED_DICTIONARY_LANGUAGES[requested] ?? requested.toUpperCase();
    return { requested, code, supported: Boolean(supportedCode), label };
};

const buildCacheKey = (language: string, word: string) => `${language}:${word.toLowerCase()}`;

const getPrimaryDefinition = (entry: DictionaryEntry | null) => {
    if (!entry?.meanings) return null;
    for (const meaning of entry.meanings) {
        const definition = meaning.definitions?.find((item) => item.definition);
        if (definition) {
            return { meaning, definition };
        }
    }
    return null;
};

const getExamples = (entry: DictionaryEntry | null, limit = 3) => {
    if (!entry?.meanings) return [];
    const examples: string[] = [];
    for (const meaning of entry.meanings) {
        for (const def of meaning.definitions || []) {
            if (def.example) examples.push(def.example);
            if (examples.length >= limit) break;
        }
    }
    return uniqueStrings(examples, limit);
};

const getRelated = (entry: DictionaryEntry | null, word: string, limit = 8) => {
    if (!entry?.meanings) return [];
    const related: string[] = [];
    for (const meaning of entry.meanings) {
        meaning.synonyms?.forEach((item) => related.push(item));
        meaning.antonyms?.forEach((item) => related.push(item));
        for (const def of meaning.definitions || []) {
            def.synonyms?.forEach((item) => related.push(item));
            def.antonyms?.forEach((item) => related.push(item));
        }
    }
    return uniqueStrings(related, limit, word);
};

interface LanguageInsightsProps {
    word: string | null;
    language: string;
    text: string;
}

export const LanguageInsights = ({ word, language, text }: LanguageInsightsProps) => {
    const [state, setState] = useState<DictionaryState>({
        status: 'idle',
        entry: null,
        language: normalizeLanguage(language)
    });
    const [packEntry, setPackEntry] = useState<DictionaryPackEntry | null>(null);
    const [notice, setNotice] = useState<Notice | null>(null);
    const [examples, setExamples] = useState<string[]>([]);
    const [examplesState, setExamplesState] = useState<AsyncState>('idle');
    const [relatedWords, setRelatedWords] = useState<string[]>([]);
    const [relatedState, setRelatedState] = useState<AsyncState>('idle');

    const normalizedWord = word?.trim() ?? '';
    const languageInfo = resolveDictionaryLanguage(language);
    const resolvedLanguage = languageInfo.code;
    const requestedLabel = languageInfo.requested.toUpperCase();
    const isLatinWord = normalizedWord ? LATIN_WORD_PATTERN.test(normalizedWord) : false;
    const locale = languageInfo.requested;
    const wordSegmenter = useMemo(() => createSegmenter(locale, 'word'), [locale]);
    const sentenceSegmenter = useMemo(() => createSegmenter(locale, 'sentence'), [locale]);
    const packHasDefinition = Boolean(packEntry?.definitions?.length);
    const packExamples = useMemo(() => packEntry?.examples ?? [], [packEntry]);
    const packRelated = useMemo(() => packEntry?.related ?? [], [packEntry]);
    const textExamples = useMemo(
        () => getExamplesFromText(text, normalizedWord, sentenceSegmenter, wordSegmenter, locale),
        [text, normalizedWord, sentenceSegmenter, wordSegmenter, locale]
    );
    const textRelated = useMemo(
        () => getRelatedFromText(text, normalizedWord, wordSegmenter, locale),
        [text, normalizedWord, wordSegmenter, locale]
    );

    useEffect(() => {
        let active = true;
        setPackEntry(null);
        if (!normalizedWord) return;

        loadDictionaryPack(locale).then((pack) => {
            if (!active || !pack) return;
            const entry = getPackEntry(pack, normalizedWord, locale);
            if (active) setPackEntry(entry);
        });

        return () => {
            active = false;
        };
    }, [normalizedWord, locale]);

    useEffect(() => {
        setNotice(null);
        setExamples([]);
        setExamplesState('idle');
        setRelatedWords([]);
        setRelatedState('idle');

        if (!normalizedWord) {
            setState({ status: 'idle', entry: null, language: resolvedLanguage });
            return;
        }

        if (packEntry) {
            setState({ status: 'ready', entry: buildEntryFromPack(packEntry), language: resolvedLanguage });
            if (packHasDefinition) return;
        }

        const key = buildCacheKey(resolvedLanguage, normalizedWord);
        if (cache.has(key)) {
            setState({ status: 'ready', entry: cache.get(key)!, language: resolvedLanguage });
            return;
        }

        let active = true;
        const controller = new AbortController();

        const fetchEntry = async (langCode: string) => {
            const response = await fetch(
                `${API_BASE}/${encodeURIComponent(langCode)}/${encodeURIComponent(normalizedWord)}`,
                { signal: controller.signal }
            );
            if (!response.ok) return null;
            const data = (await response.json()) as DictionaryEntry[];
            return data[0] ?? null;
        };

        const run = async () => {
            setState({ status: 'loading', entry: null, language: resolvedLanguage });
            try {
                const entry = await fetchEntry(resolvedLanguage);
                if (entry) {
                    cache.set(key, entry);
                    if (active) {
                        setState({ status: 'ready', entry, language: resolvedLanguage });
                    }
                    return;
                }

                if (resolvedLanguage !== 'en' && isLatinWord) {
                    const fallbackKey = buildCacheKey('en', normalizedWord);
                    const fallback = cache.get(fallbackKey) ?? (await fetchEntry('en'));
                    if (fallback) {
                        cache.set(fallbackKey, fallback);
                        if (active) {
                            setNotice({
                                kind: 'fallback',
                                message: `Dictionary not available for ${requestedLabel}. Showing English results.`
                            });
                            setState({ status: 'ready', entry: fallback, language: 'en' });
                        }
                        return;
                    }
                }

                throw new Error('No dictionary entry found.');
            } catch (error) {
                if (!active) return;
                const message = error instanceof Error ? error.message : 'Failed to load dictionary data.';
                if (message === 'No dictionary entry found.') {
                    setNotice({
                        kind: 'unavailable',
                        message: packEntry
                            ? `No dictionary definition found for ${requestedLabel}.`
                            : `No dictionary data found for ${requestedLabel}.`
                    });
                }
                if (packEntry) return;
                setState({
                    status: 'error',
                    entry: null,
                    language: languageInfo.requested,
                    error: message
                });
            }
        };

        run();

        return () => {
            active = false;
            controller.abort();
        };
    }, [normalizedWord, resolvedLanguage, requestedLabel, isLatinWord, languageInfo.requested, packEntry, packHasDefinition]);

    useEffect(() => {
        if (!normalizedWord) {
            setExamples([]);
            setExamplesState('idle');
            return;
        }

        if (state.status === 'loading') {
            setExamples([]);
            setExamplesState('loading');
            return;
        }

        const entryExamples = getExamples(state.entry);
        const combinedExamples = uniqueStrings([...packExamples, ...entryExamples, ...textExamples], 3);
        setExamples(combinedExamples);

        const canFetchExamples = Boolean(WORDNIK_API_KEY) && state.language === 'en' && isLatinWord;
        if (!canFetchExamples || entryExamples.length >= 3) {
            setExamplesState(combinedExamples.length > 0 ? 'ready' : 'error');
            return;
        }

        let active = true;
        const controller = new AbortController();

        const run = async () => {
            setExamplesState('loading');
            try {
                const response = await fetch(
                    `${WORDNIK_API}/${encodeURIComponent(normalizedWord)}/examples?limit=3&api_key=${WORDNIK_API_KEY}`,
                    { signal: controller.signal }
                );
                if (!response.ok) {
                    throw new Error('No examples found.');
                }
                const data = (await response.json()) as { examples?: { text?: string }[] };
                const list = (data.examples || [])
                    .map((item) => item.text)
                    .filter((item): item is string => Boolean(item));
                if (active) {
                    setExamples(uniqueStrings([...packExamples, ...entryExamples, ...list, ...textExamples], 3));
                    setExamplesState('ready');
                }
            } catch {
                if (!active) return;
                setExamples(combinedExamples);
                setExamplesState(combinedExamples.length > 0 ? 'ready' : 'error');
            }
        };

        run();

        return () => {
            active = false;
            controller.abort();
        };
    }, [normalizedWord, state.entry, state.language, state.status, isLatinWord, textExamples, packExamples]);

    useEffect(() => {
        if (!normalizedWord) {
            setRelatedWords([]);
            setRelatedState('idle');
            return;
        }

        if (state.status === 'loading') {
            setRelatedWords([]);
            setRelatedState('loading');
            return;
        }

        const entryRelated = getRelated(state.entry, normalizedWord);
        const combinedRelated = uniqueStrings([...packRelated, ...entryRelated, ...textRelated], 8, normalizedWord);
        setRelatedWords(combinedRelated);

        const canFetchRelated = state.language === 'en' && isLatinWord;
        if (!canFetchRelated || entryRelated.length >= 8) {
            setRelatedState(combinedRelated.length > 0 ? 'ready' : 'error');
            return;
        }

        let active = true;
        const controller = new AbortController();

        const run = async () => {
            setRelatedState('loading');
            try {
                const response = await fetch(
                    `${DATAMUSE_API}?ml=${encodeURIComponent(normalizedWord)}&max=8`,
                    { signal: controller.signal }
                );
                if (!response.ok) {
                    throw new Error('No related words found.');
                }
                const data = (await response.json()) as { word?: string }[];
                const list = data
                    .map((item) => item.word)
                    .filter((item): item is string => Boolean(item));
                if (active) {
                    setRelatedWords(uniqueStrings([...packRelated, ...entryRelated, ...list, ...textRelated], 8, normalizedWord));
                    setRelatedState('ready');
                }
            } catch {
                if (!active) return;
                setRelatedWords(combinedRelated);
                setRelatedState(combinedRelated.length > 0 ? 'ready' : 'error');
            }
        };

        run();

        return () => {
            active = false;
            controller.abort();
        };
    }, [normalizedWord, state.entry, state.language, state.status, isLatinWord, textRelated, packRelated]);

    const primary = useMemo(() => getPrimaryDefinition(state.entry), [state.entry]);
    const languageLabel = state.language.toUpperCase();
    const showDictionaryError = normalizedWord && state.status === 'error' && notice?.kind !== 'unavailable' && !packEntry;
    const examplesMessage = state.status === 'loading' || examplesState === 'loading'
        ? 'Waiting for examples...'
        : examplesState === 'error'
            ? 'No examples found.'
            : 'Examples appear when available.';
    const relatedMessage = state.status === 'loading' || relatedState === 'loading'
        ? 'Loading related words...'
        : relatedState === 'error'
            ? 'No related words found.'
            : 'Related words appear when available.';

    return (
        <section className="grid gap-4">
            <div className="glass rounded-[20px] p-5">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] text-text-secondary uppercase tracking-[0.3em] font-semibold">Dictionary</span>
                    <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-text-secondary bg-black/5 px-2 py-0.5 rounded-full border border-black/10">
                        {languageLabel}
                    </span>
                </div>
                {!normalizedWord && (
                    <p className="text-sm text-text-secondary leading-relaxed">
                        Select a word to see definitions, examples, and related terms.
                    </p>
                )}
                {notice && normalizedWord && (
                    <p className="text-xs text-text-secondary leading-relaxed mb-2">
                        {notice.message}
                    </p>
                )}
                {normalizedWord && state.status === 'loading' && (
                    <p className="text-sm text-text-secondary leading-relaxed">
                        Looking up "{normalizedWord}"...
                    </p>
                )}
                {showDictionaryError && (
                    <p className="text-sm text-text-secondary leading-relaxed">
                        {state.error}
                    </p>
                )}
                {normalizedWord && state.status === 'ready' && state.entry && (
                    <>
                        <div className="text-xl font-semibold tracking-tight text-text-primary">{state.entry.word}</div>
                        {primary?.meaning?.partOfSpeech && (
                            <div className="text-xs uppercase tracking-[0.2em] text-text-secondary mt-2">
                                {primary.meaning.partOfSpeech}
                            </div>
                        )}
                        {primary?.definition && (
                            <p className="mt-2 text-sm text-text-secondary leading-relaxed">
                                {primary.definition.definition}
                            </p>
                        )}
                    </>
                )}
            </div>

            <div className="glass rounded-[20px] p-5">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] text-text-secondary uppercase tracking-[0.3em] font-semibold">Examples</span>
                    <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-text-secondary bg-black/5 px-2 py-0.5 rounded-full border border-black/10">
                        Auto
                    </span>
                </div>
                {examples.length > 0 ? (
                    <ul className="space-y-2 text-sm text-text-secondary leading-relaxed list-disc pl-4 marker:text-text-secondary">
                        {examples.map((example) => (
                            <li key={example}>{example}</li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-text-secondary leading-relaxed">{examplesMessage}</p>
                )}
            </div>

            <div className="glass rounded-[20px] p-5">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] text-text-secondary uppercase tracking-[0.3em] font-semibold">Related</span>
                    <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-text-secondary bg-black/5 px-2 py-0.5 rounded-full border border-black/10">
                        Suggestions
                    </span>
                </div>
                {relatedWords.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {relatedWords.map((item) => (
                            <span
                                key={item}
                                className="text-xs font-semibold text-text-secondary bg-white/70 px-3 py-1 rounded-full border border-black/5"
                            >
                                {item}
                            </span>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-text-secondary leading-relaxed">{relatedMessage}</p>
                )}
            </div>
        </section>
    );
};
