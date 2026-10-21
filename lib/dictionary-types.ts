export type DictionaryCredit = { source: string; sourceUrl?: string; license?: { name: string; url: string } };
export type EnglishSense = { definition: string; example?: string; synonyms: string[]; antonyms: string[] };
export type EnglishMeaning = DictionaryCredit & { partOfSpeech: string; definitions: EnglishSense[]; synonyms: string[]; antonyms: string[] };
export type DictionaryLookup = DictionaryCredit & {
  word?: string; lemma?: string; meaning: string; pos: string; phonetic?: string;
  definition?: string; english?: EnglishMeaning[]; englishStatus?: "available" | "not-found" | "unavailable";
  error?: string;
};
export type ChosenSense = DictionaryCredit & { definition: string; pos: string };
