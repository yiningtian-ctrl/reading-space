import {readFileSync,writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const root=new URL("../",import.meta.url);
const revision=readFileSync(new URL(".sites-runtime/ecdict-revision.txt",root),"utf8").trim();
const text=readFileSync(new URL(".sites-runtime/ecdict.csv",root),"utf8").replace(/^\uFEFF/,"");
const entries={},aliases={};let header,row=[],field="",quoted=false;
function emit(){if(!header){header=row;row=[];return;}const entry=Object.fromEntries(header.map((key,i)=>[key,row[i]||""]));row=[];const word=entry.word.toLowerCase();if(!/^[a-z]+(?:['-][a-z]+)*$/.test(word))return;const tags=entry.tag.split(" "),bnc=Number(entry.bnc);if(!tags.some(t=>["cet4","cet6","gk","zk"].includes(t))&&!(bnc>0&&bnc<=5000))return;const meaning=entry.translation.replace(/\\n/g,"；").trim();if(!meaning)return;entries[word]={meaning,pos:entry.pos.split("/")[0].split(":")[0],phonetic:entry.phonetic,englishDefinition:entry.definition};for(const item of entry.exchange.split("/")){const [type,value]=item.split(":");if(["p","d","i","3","r","t","s"].includes(type)&&value&&/^[a-z]+(?:['-][a-z]+)*$/.test(value))aliases[value]=word;}}
for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===","&&!quoted){row.push(field);field="";}else if((c==="\n"||c==="\r")&&!quoted){if(c==="\r"&&text[i+1]==="\n")i++;row.push(field);field="";emit();}else field+=c;}
if(field||row.length){row.push(field);emit();}
const filteredAliases=Object.fromEntries(Object.entries(aliases).filter(([k])=>!entries[k]));
const output=JSON.stringify({revision,entries,aliases:filteredAliases});writeFileSync(new URL("lib/ecdict-cet.json",root),output);
console.log(JSON.stringify({entries:Object.keys(entries).length,inflections:Object.keys(filteredAliases).length,bytes:Buffer.byteLength(output),revision}));
