import FlexSearch from 'flexsearch';
import Typo from 'typo-js';

export type DictionaryPackEntry = {
    word: string;
    definitions?: string[];
    examples?: string[];
    related?: string[];
    partOfSpeech?: string;
};

export type DictionaryPack = {
    version: number;
    language: string;
    words?: string[];
    entries: Record<string, DictionaryPackEntry>;
};

export type LanguageResource = {
    label: string;
    dictionaryPackUrl?: string;
    spellcheck?: {
        affUrl: string;
        dicUrl: string;
        locale: string;
    };
};

export type SuggestionIndex = {
    index: InstanceType<typeof FlexSearch.Index>;
    words: string[];
    locale?: string;
};

export type SpellChecker = {
    check: (word: string) => boolean;
    suggest: (word: string) => string[];
};

const RESOURCE_BASE = {
    dictionary: '/dictionaries',
    spelling: '/spelling'
};

export const LANGUAGE_RESOURCES: Record<string, LanguageResource> = {
    en: {
        label: 'English',
        dictionaryPackUrl: `${RESOURCE_BASE.dictionary}/en.json`,
        spellcheck: {
            affUrl: `${RESOURCE_BASE.spelling}/en.aff`,
            dicUrl: `${RESOURCE_BASE.spelling}/en.dic`,
            locale: 'en_US'
        }
    },
    ru: {
        label: 'Russian',
        dictionaryPackUrl: `${RESOURCE_BASE.dictionary}/ru.json`,
        spellcheck: {
            affUrl: `${RESOURCE_BASE.spelling}/ru.aff`,
            dicUrl: `${RESOURCE_BASE.spelling}/ru.dic`,
            locale: 'ru_RU'
        }
    }
};

const normalizeLanguage = (language: string) => {
    const normalized = language.trim().toLowerCase().replace(/_/g, '-');
    if (!normalized) return 'en';
    return normalized;
};

const getBaseLanguage = (language: string) => normalizeLanguage(language).split('-')[0];

export const normalizeForMatch = (value: string, locale?: string) => value.normalize('NFKC').toLocaleLowerCase(locale);

const dictionaryPackCache = new Map<string, Promise<DictionaryPack | null>>();
const suggestionIndexCache = new Map<string, Promise<SuggestionIndex | null>>();
const spellCheckerCache = new Map<string, Promise<SpellChecker | null>>();

export const loadDictionaryPack = async (language: string) => {
    const base = getBaseLanguage(language);
    const resource = LANGUAGE_RESOURCES[base];
    if (!resource?.dictionaryPackUrl) return null;
    if (dictionaryPackCache.has(base)) {
        return dictionaryPackCache.get(base)!;
    }

    const promise = fetch(resource.dictionaryPackUrl)
        .then(async (response) => (response.ok ? (response.json() as Promise<DictionaryPack>) : null))
        .catch(() => null);

    dictionaryPackCache.set(base, promise);
    return promise;
};

export const getPackEntry = (pack: DictionaryPack | null, word: string, locale?: string) => {
    if (!pack || !word) return null;
    const normalized = normalizeForMatch(word, locale);
    return (
        pack.entries[normalized]
        ?? pack.entries[word]
        ?? pack.entries[word.toLowerCase()]
        ?? null
    );
};

const getPackWords = (pack: DictionaryPack) => {
    if (Array.isArray(pack.words) && pack.words.length > 0) {
        return pack.words;
    }
    return Object.keys(pack.entries || {});
};

const buildSuggestionIndex = (words: string[]) => {
    const index = new FlexSearch.Index({
        tokenize: 'forward',
        encode: 'icase',
        cache: true,
        resolution: 9
    });
    words.forEach((word, id) => {
        index.add(id, word);
    });
    return index;
};

export const loadSuggestionIndex = async (language: string) => {
    const base = getBaseLanguage(language);
    if (suggestionIndexCache.has(base)) {
        return suggestionIndexCache.get(base)!;
    }

    const promise = loadDictionaryPack(base).then((pack) => {
        if (!pack) return null;
        const words = getPackWords(pack);
        if (!words.length) return null;
        return {
            index: buildSuggestionIndex(words),
            words,
            locale: base
        } satisfies SuggestionIndex;
    });

    suggestionIndexCache.set(base, promise);
    return promise;
};

const extractSuggestionIds = (result: unknown) => {
    if (!Array.isArray(result)) return [];
    if (result.length === 0) return [];
    if (typeof result[0] === 'number') return result as number[];
    const nested = result as Array<{ result?: number[] }>;
    if (nested[0]?.result && Array.isArray(nested[0].result)) return nested[0].result;
    return [];
};

export const searchSuggestions = (
    suggestionIndex: SuggestionIndex,
    prefix: string,
    limit: number,
    locale?: string
) => {
    if (!prefix) return [];
    const result = suggestionIndex.index.search(prefix, { limit }) as unknown;
    const ids = extractSuggestionIds(result);
    const seen = new Set<string>();
    const suggestions: string[] = [];
    for (const id of ids) {
        const word = suggestionIndex.words[id];
        if (!word) continue;
        const key = normalizeForMatch(word, locale);
        if (seen.has(key)) continue;
        seen.add(key);
        suggestions.push(word);
        if (suggestions.length >= limit) break;
    }
    return suggestions;
};

export const loadSpellChecker = async (language: string) => {
    const base = getBaseLanguage(language);
    const resource = LANGUAGE_RESOURCES[base];
    if (!resource?.spellcheck) return null;
    if (spellCheckerCache.has(base)) {
        return spellCheckerCache.get(base)!;
    }

    const promise = Promise.all([
        fetch(resource.spellcheck.affUrl).then((response) => (response.ok ? response.text() : null)),
        fetch(resource.spellcheck.dicUrl).then((response) => (response.ok ? response.text() : null))
    ])
        .then(([aff, dic]) => {
            if (!aff || !dic) return null;
            return new Typo(resource.spellcheck?.locale || base, aff, dic, { platform: 'any' });
        })
        .catch(() => null);

    spellCheckerCache.set(base, promise);
    return promise;
};
