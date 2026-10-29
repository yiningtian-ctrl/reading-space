import { validateData } from './reading.ts';
import { ACCOUNT_SCHEMA } from './account-schema.mjs';

const COOKIE='__Host-readspace_session',LOCAL_COOKIE='readspace_session_local';
const SESSION_MS=30*86400000, MAX_BYTES=1_550_000;
const encoder=new TextEncoder(),initialized=new WeakMap();
class AccountError extends Error {constructor(status,message,code='request'){super(message);this.status=status;this.code=code;}}
const hex=bytes=>Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
export async function digest(value){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))));}
export async function hashPassword(password,salt=hex(crypto.getRandomValues(new Uint8Array(16)))){
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  const result=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-512',salt:encoder.encode(salt),iterations:100000},key,256);
  return `pbkdf2-sha512:100000:${salt}:${hex(new Uint8Array(result))}`;
}
async function verifyPassword(password,stored){
  if(typeof stored!=='string'||!/^pbkdf2-sha512:100000:[a-f0-9]{32}:[a-f0-9]{64}$/.test(stored))return false;
  const computed=await hashPassword(password,stored.split(':')[2]);let diff=0;
  for(let i=0;i<stored.length;i++)diff|=stored.charCodeAt(i)^computed.charCodeAt(i);
  return diff===0;
}
function cookie(request,token='',maxAge=SESSION_MS/1000){
  const secure=new URL(request.url).protocol==='https:';
  return `${secure?COOKIE:LOCAL_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure?'; Secure':''}`;
}
function json(value,status=200,extra={}){
  return Response.json(value,{status,headers:{'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff',...extra}});
}
async function init(db){
  if(!initialized.has(db))initialized.set(db,db.batch(ACCOUNT_SCHEMA.map(sql=>db.prepare(sql))).catch(e=>{initialized.delete(db);throw e;}));
  await initialized.get(db);
}
async function body(request,max=4096){
  if(!request.headers.get('content-type')?.toLowerCase().includes('application/json'))throw new AccountError(415,'请使用 JSON 提交。');
  const reader=request.body?.getReader();if(!reader)throw new AccountError(400,'请求内容为空。');
  let length=0;const chunks=[];
  while(true){const{done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>max){await reader.cancel();throw new AccountError(413,'内容过大，云端单份学习记录最多支持 1.5 MB。');}chunks.push(value);}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try{const value=JSON.parse(new TextDecoder().decode(bytes));if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value;}catch{throw new AccountError(400,'请求格式无效。');}
}
function credentials(input){
  const username=typeof input.username==='string'?input.username.trim().toLowerCase():'';
  if(!/^[a-z0-9_]{3,32}$/.test(username))throw new AccountError(400,'用户名需为 3–32 位英文字母、数字或下划线。');
  if(typeof input.password!=='string'||input.password.length<12||input.password.length>128)throw new AccountError(400,'密码需为 12–128 个字符。');
  return{username,password:input.password};
}
async function rate(db,key,limit,now){
  const bucket=await digest(key+':'+Math.floor(now/900000));
  const row=await db.prepare(`INSERT INTO rs_limits(bucket,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1 RETURNING attempts`).bind(bucket,now+1800000).first();
  if(row.attempts>limit)throw new AccountError(429,'尝试次数较多，请在 15 分钟后重试。','rate_limit');
}
async function session(request,db,now){
  const secure=new URL(request.url).protocol==='https:';
  const token=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith((secure?COOKIE:LOCAL_COOKIE)+'='))?.split('=')[1];
  if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
  return db.prepare(`SELECT u.id,u.username,s.token_hash FROM rs_sessions s JOIN rs_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`).bind(await digest(token),now).first();
}
async function issueSession(request,db,user,now){
  const token=random();
  await db.prepare(`INSERT INTO rs_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)`).bind(await digest(token),user.id,now+SESSION_MS).run();
  return cookie(request,token);
}
function validSnapshot(data){
  if(!validateData(data))return false;
  // Reject ambiguous duplicate IDs and prototype keys before any merge on another device.
  for(const key of ['words','notes','imported','external']){
    const ids=data[key].map(item=>item.id);if(new Set(ids).size!==ids.length||ids.some(id=>['__proto__','constructor','prototype'].includes(id)))return false;
  }
  const unsafe=obj=>obj&&typeof obj==='object'&&Object.keys(obj).some(k=>['__proto__','constructor','prototype'].includes(k)||unsafe(obj[k]));
  return !unsafe(data);
}
export async function handleAccount(request,db,{now=Date.now()}={}){
  const path=new URL(request.url).pathname;
  if(!path.startsWith('/api/account/')&&path!=='/api/study-sync')return null;
  try{
    if(!['GET','POST','PUT'].includes(request.method))return json({error:'不支持的请求方式。'},405,{'Allow':path==='/api/study-sync'?'GET, PUT':'GET, POST'});
    if(!['GET','HEAD'].includes(request.method)){
      // Session cookies are never sufficient on their own for mutations.
      if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')throw new AccountError(403,'请从当前 ReadSpace 页面操作。','origin');
    }
    if(!db)return json({available:false,user:null,error:'云端账号尚未启用，请先配置云数据库。',code:'not_configured'},503);
    await init(db);
    const identity=await session(request,db,now);
    if(path==='/api/account/session'&&request.method==='GET')return json({available:true,user:identity?{id:identity.id,username:identity.username}:null});
    const ip=request.headers.get('cf-connecting-ip')||'local';
    if(['/api/account/register','/api/account/login','/api/account/recover'].includes(path)&&request.method==='POST'){
      const input=await body(request),{username,password}=credentials(input);
      await rate(db,`ip:${ip}`,30,now);await rate(db,`user:${username}`,12,now);
      // Clean expired security rows opportunistically, never study data.
      await db.batch([db.prepare('DELETE FROM rs_limits WHERE expires_at<?').bind(now),db.prepare('DELETE FROM rs_sessions WHERE expires_at<?').bind(now)]);
      if(path==='/api/account/register'){
        await rate(db,`register:${ip}`,5,now);
        const user={id:crypto.randomUUID(),username},recoveryCode=random();
        const passwordHash=await hashPassword(password),recoveryHash=await digest(recoveryCode);
        try{
          await db.batch([
            db.prepare(`INSERT INTO rs_users(id,username,password_hash,recovery_hash,created_at) VALUES(?,?,?,?,?)`).bind(user.id,username,passwordHash,recoveryHash,now),
            db.prepare(`INSERT INTO rs_study(user_id,revision) VALUES(?,0)`).bind(user.id),
          ]);
        }catch(e){if(String(e).includes('UNIQUE'))throw new AccountError(409,'这个用户名已被使用，请换一个。');throw e;}
        return json({user,recoveryCode},201,{'Set-Cookie':await issueSession(request,db,user,now)});
      }
      const user=await db.prepare('SELECT id,username,password_hash,recovery_hash FROM rs_users WHERE username=?').bind(username).first();
      if(path==='/api/account/recover'){
        if(typeof input.recoveryCode!=='string'||!/^[a-f0-9]{64}$/.test(input.recoveryCode)||!user||await digest(input.recoveryCode)!==user.recovery_hash)throw new AccountError(401,'用户名或恢复码不正确。');
        const replacement=random();
        const replacementHash=await digest(replacement);
        const changed=await db.batch([
          db.prepare('UPDATE rs_users SET password_hash=?,recovery_hash=? WHERE id=? AND recovery_hash=?').bind(await hashPassword(password),replacementHash,user.id,user.recovery_hash),
          db.prepare('DELETE FROM rs_sessions WHERE user_id=? AND EXISTS(SELECT 1 FROM rs_users WHERE id=? AND recovery_hash=?)').bind(user.id,user.id,replacementHash),
        ]);
        if(changed[0].meta.changes!==1)throw new AccountError(401,'恢复码已使用，请使用最新恢复码。');
        return json({user:{id:user.id,username:user.username},recoveryCode:replacement},200,{'Set-Cookie':await issueSession(request,db,user,now)});
      }
      // Perform the same KDF for unknown usernames to reduce username timing leakage.
      const match=await verifyPassword(password,user?.password_hash||'pbkdf2-sha512:100000:00000000000000000000000000000000:'+ '0'.repeat(64));
      if(!user||!match)throw new AccountError(401,'用户名或密码不正确。');
      return json({user:{id:user.id,username:user.username}},200,{'Set-Cookie':await issueSession(request,db,user,now)});
    }
    if(!identity)throw new AccountError(401,'登录已过期，请重新登录。','unauthorized');
    if(path==='/api/account/logout'&&request.method==='POST'){
      await db.prepare('DELETE FROM rs_sessions WHERE token_hash=?').bind(identity.token_hash).run();
      return json({ok:true},200,{'Set-Cookie':cookie(request,'',0)});
    }
    if(path==='/api/study-sync'){
      if(request.method==='GET'){
        const row=await db.prepare('SELECT revision,data,updated_at FROM rs_study WHERE user_id=?').bind(identity.id).first();
        return json({revision:row.revision,data:row.data?JSON.parse(row.data):null,updatedAt:row.updated_at});
      }
      if(request.method==='PUT'){
        const input=await body(request,MAX_BYTES);
        if(!Number.isSafeInteger(input.revision)||input.revision<0||!validSnapshot(input.data))throw new AccountError(400,'学习记录格式无效，云端记录未修改。');
        if(encoder.encode(JSON.stringify(input.data)).length>1_500_000)throw new AccountError(413,'云端单份学习记录最多支持 1.5 MB，请先导出备份并减少导入正文。');
        const updatedAt=new Date(now).toISOString();
        const row=await db.prepare('UPDATE rs_study SET data=?,revision=revision+1,updated_at=? WHERE user_id=? AND revision=? RETURNING revision').bind(JSON.stringify(input.data),updatedAt,identity.id,input.revision).first();
        if(!row)throw new AccountError(409,'另一台设备已更新记录，请先合并最新内容。','conflict');
        return json({revision:row.revision,updatedAt});
      }
    }
    return json({error:'没有这个账号接口。'},404);
  }catch(e){
    if(e instanceof AccountError)return json({error:e.message,code:e.code},e.status,e.status===429?{'Retry-After':'900'}:{});
    // No passwords, cookies, body text or database internals in logs/responses.
    return json({error:'云端服务暂不可用，本机记录仍保留。',code:'unavailable'},503);
  }
}
