const encoder=new TextEncoder();
export const EMAIL_SCHEMA=[
 `CREATE TABLE IF NOT EXISTS rs_emails (user_id TEXT PRIMARY KEY REFERENCES rs_users(id) ON DELETE CASCADE,email TEXT NOT NULL UNIQUE,verified_at INTEGER NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS rs_email_codes (id TEXT PRIMARY KEY,email TEXT NOT NULL,purpose TEXT NOT NULL,owner TEXT NOT NULL,code_hash TEXT NOT NULL,expires_at INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,used INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL)`,
 `CREATE INDEX IF NOT EXISTS rs_email_codes_lookup ON rs_email_codes(email,purpose,created_at)`,
 `CREATE TABLE IF NOT EXISTS rs_email_send_locks (email TEXT PRIMARY KEY,sent_at INTEGER NOT NULL)`,
];
export function normalizeEmail(value){if(typeof value!=='string')return null;const s=value.trim().toLowerCase();return s.length<=254&&/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(s)?s:null;}
async function signature(secret,id,email,purpose,owner,code){const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(JSON.stringify([id,email,purpose,owner,code])))),v=>v.toString(16).padStart(2,'0')).join('');}
export async function createEmailCode(db,{email,purpose,owner='',secret,sendMail,now}){
 const lock=await db.prepare('INSERT INTO rs_email_send_locks(email,sent_at) VALUES(?,?) ON CONFLICT(email) DO UPDATE SET sent_at=excluded.sent_at WHERE sent_at<=? RETURNING email').bind(email,now,now-60000).first();
 if(!lock)throw new Error('cooldown');
 const id=crypto.randomUUID();let n;do{n=crypto.getRandomValues(new Uint32Array(1))[0];}while(n>=4294000000);const code=String(n%1000000).padStart(6,'0');
 await db.batch([db.prepare('DELETE FROM rs_email_send_locks WHERE sent_at<?').bind(now-86400000),db.prepare('DELETE FROM rs_email_codes WHERE expires_at<?').bind(now),db.prepare('UPDATE rs_email_codes SET used=1 WHERE email=? AND purpose=? AND owner=?').bind(email,purpose,owner),db.prepare('INSERT INTO rs_email_codes(id,email,purpose,owner,code_hash,expires_at,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,email,purpose,owner,await signature(secret,id,email,purpose,owner,code),now+600000,now)]);
 try{await sendMail({to:email,code,purpose});}catch{await db.prepare('UPDATE rs_email_codes SET used=1 WHERE id=?').bind(id).run();throw new Error('mail_failed');}
 return {challengeId:id,expiresIn:600,retryAfter:60};
}
export async function consumeEmailCode(db,{email,purpose,owner='',id,code,secret,now}){
 if(typeof id!=='string'||typeof code!=='string'||!/^\d{6}$/.test(code))return false;
 const row=await db.prepare('UPDATE rs_email_codes SET attempts=attempts+1 WHERE id=? AND email=? AND purpose=? AND owner=? AND used=0 AND expires_at>? AND attempts<5 RETURNING code_hash').bind(id,email,purpose,owner,now).first();
 if(!row)return false;
 const expected=await signature(secret,id,email,purpose,owner,code);let diff=0;for(let i=0;i<64;i++)diff|=expected.charCodeAt(i)^row.code_hash.charCodeAt(i);if(diff)return false;
 const used=await db.prepare('UPDATE rs_email_codes SET used=1 WHERE id=? AND used=0 AND expires_at>? RETURNING id').bind(id,now).first();return !!used;
}
