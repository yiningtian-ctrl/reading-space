import {defaultData} from './reading.ts';
export function same(a,b){
  if(a===b)return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));
}
const own=(obj,key)=>obj&&Object.hasOwn(obj,key)?obj[key]:undefined;
const entityArrays=new Set(['words','notes','imported','external']);
// A three-way merge preserves deletions and never resolves simultaneous edits by a device clock.
export function mergeStudy(base,local,cloud,prefer){
  const conflicts=[];
  function merge(b,l,r,path){
    if(same(l,b))return r;
    if(same(r,b)||same(l,r))return l;
    if(Array.isArray(l)&&Array.isArray(r)){
      if(path==='saved'||path==='review.days'){
        const bs=new Set(b||[]),ls=new Set(l),rs=new Set(r);
        return [...new Set([...l,...r])].filter(v=>!bs.has(v)||ls.has(v)&&rs.has(v));
      }
      if(entityArrays.has(path)){
        const bm=new Map((b||[]).map(x=>[x.id,x])),lm=new Map(l.map(x=>[x.id,x])),rm=new Map(r.map(x=>[x.id,x]));
        return [...new Set([...lm.keys(),...rm.keys()])].map(id=>merge(bm.get(id),lm.get(id),rm.get(id),path+'.'+id)).filter(x=>x!==undefined);
      }
    }
    if(l&&r&&typeof l==='object'&&typeof r==='object'&&!Array.isArray(l)&&!Array.isArray(r)){
      const result=Object.create(null);
      for(const key of new Set([...Object.keys(l),...Object.keys(r)])){
        if(['__proto__','constructor','prototype'].includes(key))continue;
        const value=merge(own(b,key),own(l,key),own(r,key),path?path+'.'+key:key);
        if(value!==undefined)result[key]=value;
      }
      return result;
    }
    conflicts.push(path);return prefer==='local'?l:r;
  }
  const data=merge(base||defaultData,local,cloud||defaultData,'');
  return{data,conflicts};
}
export function hasStudyData(data){return !!(data.saved.length||data.words.length||data.notes.length||data.imported.length||Object.keys(data.records).length||data.review?.days.length);}
