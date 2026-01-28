import fs from 'fs';
import path from 'path';
import readline from 'readline';

const args = process.argv.slice(2);
const getArg = (name, fallback = null) => {
    const index = args.indexOf(`--${name}`);
    if (index === -1 || index + 1 >= args.length) return fallback;
    return args[index + 1];
};

const input = getArg('input');
const output = getArg('output', 'public/dictionaries/en.json');
const language = getArg('lang', '');
const limit = Number(getArg('limit', '0')) || Infinity;

if (!input) {
    console.error('Usage: node scripts/build-dictionary-pack.mjs --input <path> --output <path> --lang <code> [--limit <n>]');
    process.exit(1);
}

const normalizeForMatch = (value, locale) => value.normalize('NFKC').toLocaleLowerCase(locale || undefined);

const pushUnique = (list, item, max) => {
    if (!item) return;
    if (list.includes(item)) return;
    list.push(item);
    if (list.length > max) list.length = max;
};

const coerceArray = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    return [value];
};

const extractGlosses = (sense) => {
    const glosses = [
        ...coerceArray(sense.glosses),
        ...coerceArray(sense.gloss),
        ...coerceArray(sense.definition),
        ...coerceArray(sense.definitions)
    ];
    return glosses.filter((item) => typeof item === 'string');
};

const extractExamples = (sense) => {
    const examples = coerceArray(sense.examples)
        .map((example) => {
            if (typeof example === 'string') return example;
            if (example && typeof example.text === 'string') return example.text;
            if (example && typeof example.example === 'string') return example.example;
            return null;
        })
        .filter(Boolean);
    return examples;
};

const extractRelated = (sense) => {
    const related = [
        ...coerceArray(sense.synonyms),
        ...coerceArray(sense.antonyms),
        ...coerceArray(sense.hypernyms),
        ...coerceArray(sense.hyponyms),
        ...coerceArray(sense.related)
    ];
    return related.filter((item) => typeof item === 'string');
};

const entries = new Map();
const words = new Set();

const stream = fs.createReadStream(input, 'utf8');
const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

let processed = 0;
for await (const line of rl) {
    if (!line) continue;
    if (processed >= limit) break;

    let data;
    try {
        data = JSON.parse(line);
    } catch {
        continue;
    }

    const langCode = data.lang_code || data.lang || data.lang_code_ipa || data.langid;
    if (language && langCode && String(langCode).toLowerCase() !== language.toLowerCase()) {
        continue;
    }

    const word = typeof data.word === 'string' ? data.word : null;
    if (!word) continue;

    processed += 1;

    const key = normalizeForMatch(word, language || undefined);
    const existing = entries.get(key) || {
        word,
        definitions: [],
        examples: [],
        related: [],
        partOfSpeech: data.pos || data.part_of_speech || undefined
    };

    const senses = Array.isArray(data.senses) ? data.senses : [];
    for (const sense of senses) {
        extractGlosses(sense).forEach((gloss) => pushUnique(existing.definitions, gloss, 6));
        extractExamples(sense).forEach((example) => pushUnique(existing.examples, example, 6));
        extractRelated(sense).forEach((item) => pushUnique(existing.related, item, 12));
    }

    entries.set(key, existing);
    words.add(word);
}

const pack = {
    version: 1,
    language: language || 'unknown',
    words: Array.from(words),
    entries: Object.fromEntries(entries)
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(pack));
console.log(`Saved ${entries.size} entries to ${output}`);
