import { safeUrl } from "@/lib/reading";
import type { Word } from "@/lib/reading";
export default function WordEnglish({word}:{word:Word}){
  if(!word.definition)return null;
  return <div className="saved-english"><span>English</span><p>{word.definition}</p>{word.definitionSource&&<p className="english-attribution">{word.definitionSource.source}{word.definitionSource.sourceUrl&&safeUrl(word.definitionSource.sourceUrl)&&<> · <a href={safeUrl(word.definitionSource.sourceUrl)} target="_blank" rel="noopener noreferrer">原词条</a></>}{word.definitionSource.license&&safeUrl(word.definitionSource.license.url)&&<> · <a href={safeUrl(word.definitionSource.license.url)} target="_blank" rel="noopener noreferrer">{word.definitionSource.license.name}</a></>}</p>}</div>;
}
