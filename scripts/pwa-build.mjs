import {readdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';import {createHash} from 'node:crypto';
export async function preparePwa(client){
 const files=[];async function visit(dir,relative=''){for(const entry of await readdir(dir,{withFileTypes:true})){const rel=relative+entry.name;if(entry.isDirectory())await visit(path.join(dir,entry.name),rel+'/');else if(rel.startsWith('_next/static/')||/^(icons|images)\//.test(rel)||['offline.html','favicon.svg','manifest.webmanifest'].includes(rel))files.push(rel);}}
 await visit(client);files.sort();const hash=createHash('sha256');for(const file of files){hash.update(file);hash.update(await readFile(path.join(client,file)));}const sw=await readFile(path.join(client,'sw.js'),'utf8');hash.update(sw);const version=hash.digest('hex').slice(0,16);
 await writeFile(path.join(client,'sw.js'),sw.replaceAll('__READSPACE_PWA_VERSION__',version));
 await writeFile(path.join(client,'pwa-assets.json'),JSON.stringify({version,assets:files.map(file=>'/'+file)}));
}
