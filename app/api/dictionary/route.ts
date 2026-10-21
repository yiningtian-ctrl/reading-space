import { lookupLocal } from "@/lib/dictionary";
import { fetchEnglish, localEnglish } from "@/lib/english-dictionary";
import type { DictionaryLookup } from "@/lib/dictionary-types";
import ecdict from "@/lib/ecdict-cet.json";
const entries=ecdict.entries as Record<string,{meaning:string;pos:string;phonetic:string;englishDefinition?:string}>;
const aliases=ecdict.aliases as Record<string,string>;
export async function GET(request:Request){
  const word=(new URL(request.url).searchParams.get("word")||"").toLowerCase();
  if(!/^[a-z]+(?:['-][a-z]+)*$/.test(word)||word.length>50)return Response.json({error:"请输入一个英文单词。"},{status:400});
  const local=lookupLocal(word),root=word.replace(/'s$/,"");
  const lemma=entries[word]?word:entries[root]?root:aliases[word]||aliases[root];
  const translated=lemma?entries[lemma]:undefined;
  const result:DictionaryLookup=local?{...local,word,lemma,source:"ReadSpace 学习释义"}:translated?{meaning:translated.meaning,pos:translated.pos,phonetic:translated.phonetic,word,lemma,source:"ECDICT · 中英词库",sourceUrl:"https://github.com/skywind3000/ECDICT",license:{name:"MIT",url:`https://raw.githubusercontent.com/skywind3000/ECDICT/${ecdict.revision}/LICENSE`}}:{word,lemma,meaning:"",pos:"",source:"个人释义"};
  result.phonetic ||= translated?.phonetic;
  const fallback=localEnglish(translated?.englishDefinition,translated?.pos||"",{source:"ECDICT · 本地英文释义",sourceUrl:"https://github.com/skywind3000/ECDICT",license:{name:"MIT",url:`https://raw.githubusercontent.com/skywind3000/ECDICT/${ecdict.revision}/LICENSE`}});
  if(fallback.length){result.english=fallback;result.definition=fallback[0].definitions[0].definition;}
  // The quick request is independent of the optional online enrichment.
  if(new URL(request.url).searchParams.get("detail")==="chinese")return Response.json(result,{headers:{"Cache-Control":"public, max-age=86400"}});
  try{
    const extra=await fetchEnglish(word,lemma);
    if(extra.english.length){
      const first=extra.english[0];
      return Response.json({...result,...extra,definition:first.definitions[0].definition,pos:result.pos||first.partOfSpeech,englishStatus:"available"},{headers:{"Cache-Control":"public, max-age=3600"}});
    }
    return Response.json({...result,englishStatus:"not-found",error:fallback.length?"在线词典暂未收录，当前显示本地词库的英文释义。":"在线词典暂未收录这个词的英文释义。"},{headers:{"Cache-Control":"public, max-age=300"}});
  }catch{
    return Response.json({...result,englishStatus:"unavailable",error:fallback.length?"在线补充暂不可用，当前显示本地英文释义。":"英文词典暂时无法连接。中文释义和原句仍可收藏，也可以稍后重试。"},{headers:{"Cache-Control":"no-store"}});
  }
}
