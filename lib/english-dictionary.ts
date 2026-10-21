import type { EnglishMeaning } from "./dictionary-types";
export function localEnglish(definition:string|undefined,pos:string,credit:Pick<EnglishMeaning,"source"|"sourceUrl"|"license">):EnglishMeaning[]{
  if(!definition)return[];
  const names:Record<string,string>={n:"noun",v:"verb",vt:"verb",vi:"verb",a:"adjective",s:"adjective",adj:"adjective",r:"adverb",adv:"adverb",prep:"preposition",pron:"pronoun",conj:"conjunction",interj:"interjection"};
  const grouped=new Map<string,EnglishMeaning>();
  for(const line of definition.split(/\\n|\n/).map(s=>s.trim()).filter(Boolean)){
    const match=line.match(/^([a-z]+)\.\s+/),part=names[match?.[1]||pos]||pos||"other";
    const text=match?line.slice(match[0].length):line;
    if(!/[a-zA-Z]{3,}/.test(text))continue;
    if(!grouped.has(part))grouped.set(part,{...credit,partOfSpeech:part,definitions:[],synonyms:[],antonyms:[]});
    grouped.get(part)!.definitions.push({definition:text,synonyms:[],antonyms:[]});
  }
  return [...grouped.values()];
}
type RawEntry = {
  word?: string; phonetic?: string; phonetics?: { text?: string }[];
  meanings?: { partOfSpeech?: string; definitions?: { definition?: string; example?: string; synonyms?: string[]; antonyms?: string[] }[]; synonyms?: string[]; antonyms?: string[] }[];
  sourceUrls?: string[]; license?: { name?: string; url?: string };
};
function url(value: unknown): string | undefined { if(typeof value!=="string")return;try{const parsed=new URL(value);return parsed.protocol==="https:"?parsed.href:undefined;}catch{return;} }
function words(value:unknown):string[]{return Array.isArray(value)?Array.from(new Set(value.filter((v):v is string=>typeof v==="string"&&v.length>0&&v.length<100))):[];}
export function normalizeEnglish(value:unknown):{english:EnglishMeaning[];phonetic?:string} {
  if(!Array.isArray(value))return{english:[]};
  const english:EnglishMeaning[]=[];let phonetic:string|undefined;
  for(const entry of value as RawEntry[]){
    if(!entry||typeof entry!=="object")continue;
    phonetic ||= typeof entry.phonetic==="string"?entry.phonetic:entry.phonetics?.find(p=>typeof p.text==="string")?.text;
    if(!Array.isArray(entry.meanings))continue;
    const sourceUrl=Array.isArray(entry.sourceUrls)?entry.sourceUrls.map(url).find(Boolean):undefined;
    const licenseUrl=url(entry.license?.url);
    const license=licenseUrl&&typeof entry.license?.name==="string"?{name:entry.license.name,url:licenseUrl}:undefined;
    for(const meaning of entry.meanings){
      if(!meaning||!Array.isArray(meaning.definitions))continue;
      const definitions=meaning.definitions.filter(d=>d&&typeof d.definition==="string"&&d.definition.trim()).map(d=>({definition:d.definition!,...(typeof d.example==="string"&&d.example?{example:d.example}:{}),synonyms:words(d.synonyms),antonyms:words(d.antonyms)}));
      if(!definitions.length)continue;
      english.push({partOfSpeech:typeof meaning.partOfSpeech==="string"?meaning.partOfSpeech:"other",definitions,synonyms:words(meaning.synonyms),antonyms:words(meaning.antonyms),source:"Free Dictionary API",...(sourceUrl?{sourceUrl}:{}),...(license?{license}:{})});
    }
  }
  return{english,...(phonetic?{phonetic}:{})};
}

export async function fetchEnglish(word:string,lemma:string|undefined,fetcher:typeof fetch=fetch){
  // A single deadline covers the inflected form and its optional lemma retry.
  const signal=AbortSignal.timeout(6500);
  for(const query of Array.from(new Set([word,lemma].filter((v):v is string=>!!v)))){
    const response=await fetcher(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(query)}`,{signal});
    if(response.status===404)continue;
    if(!response.ok)throw new Error("English dictionary unavailable");
    const normalized=normalizeEnglish(await response.json());
    if(normalized.english.length)return normalized;
  }
  return{english:[] as EnglishMeaning[]};
}
