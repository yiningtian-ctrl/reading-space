import { DatabaseSync } from 'node:sqlite';
import { handleAccount } from '../lib/account-server.mjs';
export class TestD1{
 constructor(){this.sql=new DatabaseSync(':memory:');this.sql.exec('PRAGMA foreign_keys=ON');}
 prepare(sql){const db=this;return{bind(...args){return{async first(){return db.sql.prepare(sql).get(...args)||null;},async run(){return{meta:db.sql.prepare(sql).run(...args)};},sql,args};},sql,args:[]};}
 async batch(statements){this.sql.exec('BEGIN');try{const results=statements.map(s=>{const statement=this.sql.prepare(s.sql);return{meta:statement.run(...s.args)};});this.sql.exec('COMMIT');return results;}catch(e){this.sql.exec('ROLLBACK');throw e;}}
 close(){this.sql.close();}
}
export class MemoryStorage{
 map=new Map();getItem(key){return this.map.get(key)??null;}setItem(key,value){this.map.set(key,String(value));}removeItem(key){this.map.delete(key);}clear(){this.map.clear();}
}
export function device(db,ip='192.0.2.1'){
 let cookie='';const client={offline:false,now:Date.now(),cookie:()=>cookie};
 client.fetch=async(path,options={})=>{
  if(client.offline)throw new TypeError('Offline');
  const request=new Request(new URL(path,'https://readspace.test'),{...options,headers:{...options.headers,Origin:'https://readspace.test','CF-Connecting-IP':ip,...(cookie?{Cookie:cookie}:{})}});
  const response=await handleAccount(request,db,{now:client.now});
  const setCookie=response.headers.get('set-cookie');if(setCookie)cookie=setCookie.split(';')[0];
  return response;
 };
 client.request=(path,method='GET',data)=>client.fetch(path,{method,...(data===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})});
 return client;
}
export const password='readspace-test-password-2026';
export const word=(id,meaning='注意')=>({id,word:'attention',meaning,pos:'n.',sentence:'Reading needs attention.',articleId:'green-spaces',articleTitle:'Green spaces',addedAt:'2026-10-29T12:00:00Z',mastered:false});
export const note=id=>({id,articleId:'green-spaces',quote:'Green spaces matter.',text:'My thought',paragraph:0,addedAt:'2026-10-29T12:00:00Z'});
