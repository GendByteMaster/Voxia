Place preprocessed Wiktionary (Kaikki/Wiktextract) packs here.
Expected files:
- en.json
- ru.json

Each pack should be a JSON object:
{
  "version": 1,
  "language": "en",
  "words": ["word", "..."],
  "entries": {
    "word": {
      "word": "word",
      "definitions": ["..."],
      "examples": ["..."],
      "related": ["..."],
      "partOfSpeech": "noun"
    }
  }
}
