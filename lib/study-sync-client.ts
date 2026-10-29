import {defaultData,validateData} from './reading.ts';
import type {StudyData} from './reading.ts';
import {same,mergeStudy,hasStudyData} from './study-merge.mjs';

export type AccountUser={id:string;username:string;email?:string|null};
export type SyncStatus='checking'|'local'|'syncing'|'synced'|'pending'|'offline'|'conflict'|'expired'|'email-required';
export type AccountState={user:AccountUser|null;available:boolean|null;mailReady?:boolean;status:SyncStatus;error:string;lastSynced:string|null;authBusy:boolean;authRequired:boolean;recoveryCode:string;conflicts:string[];migrationPending:boolean;storageError:boolean};
const GUEST='readspace.study.v1',ACTIVE='readspace.account.v1';
const dataKey=(id:string)=>'readspace.study.user.'+id;
const metaKey=(id:string)=>'readspace.sync.user.'+id;
const blank=()=>structuredClone(defaultData);
function isUser(value:unknown):value is AccountUser {const v=value as AccountUser;return !!v&&typeof v.id==='string'&&/^[a-f0-9-]{36}$/.test(v.id)&&typeof v.username==='string'&&/^[a-z0-9_]{3,32}$/.test(v.username);}
export function activeStudyStorageKey(){try{const user=JSON.parse(localStorage.getItem(ACTIVE)||'null');return isUser(user)?dataKey(user.id):GUEST;}catch{return GUEST;}}
export const initialAccount:AccountState={user:null,available:null,status:'checking',error:'',lastSynced:null,authBusy:false,authRequired:false,recoveryCode:'',conflicts:[],migrationPending:false,storageError:false};
class ApiError extends Error{status:number;constructor(status:number,message:string){super(message);this.status=status;}}
type Remote={revision:number;data:StudyData|null;updatedAt:string|null};
type Conflict={local:StudyData;cloud:StudyData;at:string};

export class StudySync {
  data:StudyData=blank();state:AccountState={...initialAccount};ready=false;
  private base:StudyData=blank();private revision=0;private generation=0;private busy=false;private stopped=false;
  private timer:ReturnType<typeof setTimeout>|null=null;private requests=new Set<AbortController>();private conflict:Conflict|null=null;
  private storage:Storage;private changed:(data:StudyData,state:AccountState,ready:boolean)=>void;private notify:(text:string)=>void;private fetcher:typeof fetch;
  constructor(storage:Storage,changed:(data:StudyData,state:AccountState,ready:boolean)=>void,notify:(text:string)=>void,fetcher:typeof fetch=fetch){this.storage=storage;this.changed=changed;this.notify=notify;this.fetcher=fetcher.bind(globalThis);}
  private read(key:string){try{return JSON.parse(this.storage.getItem(key)||'null');}catch{return null;}}
  private write(key:string,value:unknown){try{this.storage.setItem(key,JSON.stringify(value));return true;}catch{if(!this.state.storageError)this.notify('浏览器缓存不可用，请联网完成同步或导出备份。');this.state={...this.state,storageError:true};return false;}}
  private emit(patch:Partial<AccountState>={}){if(this.stopped)return;this.state={...this.state,...patch};this.changed(this.data,this.state,this.ready);}
  private persist(){const u=this.state.user;this.write(u?dataKey(u.id):GUEST,this.data);if(u)this.write(metaKey(u.id),{base:this.base,revision:this.revision,lastSynced:this.state.lastSynced});}
  private async api<T={user?:unknown;recoveryCode?:unknown;mailReady?:boolean}>(path:string,method='GET',payload?:unknown):Promise<T>{
    const controller=new AbortController();this.requests.add(controller);const timer=setTimeout(()=>controller.abort(),path==='/api/account/email/send'?30000:15000);
    try{
      const r=await this.fetcher(path,{method,credentials:'same-origin',cache:'no-store',headers:payload===undefined?{}:{'Content-Type':'application/json'},body:payload===undefined?undefined:JSON.stringify(payload),signal:controller.signal});
      const value:unknown=await r.json();if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('云端响应格式无效。');
      const result=value as Record<string,unknown>;if(!r.ok)throw new ApiError(r.status,typeof result.error==='string'?result.error:'云端请求失败。');return result as T;
    }finally{clearTimeout(timer);this.requests.delete(controller);}
  }
  async start(){
    const cached=this.read(ACTIVE);
    if(isUser(cached)){this.state={...this.state,user:cached};this.loadAccount(cached);}else{const guest=this.read(GUEST);this.data=validateData(guest)?guest:blank();}
    this.ready=true;this.emit();await this.checkSession();
  }
  private loadAccount(user:AccountUser){
    const cached=this.read(dataKey(user.id)),meta=this.read(metaKey(user.id));
    this.data=validateData(cached)?cached:blank();
    this.base=validateData(meta?.base)?meta.base:blank();this.revision=Number.isSafeInteger(meta?.revision)&&meta.revision>=0?meta.revision:0;
    this.state={...this.state,lastSynced:typeof meta?.lastSynced==='string'?meta.lastSynced:null};
  }
  async checkSession(){
    const generation=this.generation;
    try{
      const result=await this.api('/api/account/session');if(this.stopped||generation!==this.generation)return;
      this.emit({available:true,mailReady:result.mailReady});
      if(isUser(result.user)){
        if(result.user.id!==this.state.user?.id)this.activate(result.user);else{this.write(ACTIVE,result.user);this.emit({user:result.user,authRequired:false});}
        if(!result.user.email){this.emit({status:'email-required'});return;}
        await this.flush();
      }else if(this.state.user)this.emit({status:'expired',authRequired:true,error:'请重新登录，未同步的记录仍保留在此设备。'});
      else this.emit({status:'local',authRequired:false,error:''});
    }catch(e){if(this.stopped||generation!==this.generation)return;this.emit({available:e instanceof ApiError&&e.status===503?false:this.state.available,status:this.state.user?'offline':'local',error:e instanceof Error?e.message:'无法连接云端。'});}
  }
  private activate(user:AccountUser){
    this.generation++;this.busy=false;if(this.timer)clearTimeout(this.timer);this.timer=null;
    this.state={...initialAccount,available:true,mailReady:this.state.mailReady,user,status:user.email?'syncing':'email-required',authBusy:this.state.authBusy};this.loadAccount(user);this.write(ACTIVE,user);
    const guest=this.read(GUEST);this.emit({migrationPending:validateData(guest)&&hasStudyData(guest)&&!this.read('readspace.migrated.'+user.id)});
  }
  update(fn:(data:StudyData)=>StudyData){
    const next=fn(this.data);if(!validateData(next)){this.notify('记录格式无效，未覆盖现有数据。');return;}
    this.data=next;this.persist();this.emit(this.state.user&&!this.state.authRequired&&this.state.status!=='conflict'?{status:'pending'}:{});this.queue();
  }
  private queue(delay=1800){if(this.stopped||this.timer||!this.state.user||this.state.authRequired||this.state.status==='conflict')return;this.timer=setTimeout(()=>{this.timer=null;void this.flush();},delay);}
  async authenticate(mode:'login'|'register'|'recover'|'email/login'|'email/bind',username:string,password:string,recoveryCode='',verification:Record<string,string>={}){
    if(this.state.authBusy)return;this.emit({authBusy:true,error:''});
    try{
      const result=await this.api('/api/account/'+mode,'POST',{username,password,...verification,...(mode==='recover'?{recoveryCode}:{})});
      if(!isUser(result.user))throw new Error('账号响应无效。');
      if(this.stopped)return;
      if(result.user.id===this.state.user?.id){this.write(ACTIVE,result.user);this.emit({user:result.user,authRequired:false,status:result.user.email?'syncing':'email-required',error:''});}else this.activate(result.user);
      this.emit({recoveryCode:typeof result.recoveryCode==='string'?result.recoveryCode:''});
      await this.flush();
    }catch(e){if(!this.stopped)this.emit({error:e instanceof Error?e.message:'登录失败。'});throw e;}
    finally{this.emit({authBusy:false});}
  }
  async flush(){
    if(this.stopped||this.busy||!this.state.user||!this.state.user.email||this.state.authRequired||this.state.status==='conflict')return;
    const generation=this.generation;this.busy=true;let success=false;this.emit({status:'syncing'});
    try{
      const remote=await this.api<Remote>('/api/study-sync');if(this.stopped||generation!==this.generation)return;
      if(!Number.isSafeInteger(remote.revision)||remote.revision<0||remote.data!==null&&!validateData(remote.data))throw new Error('云端记录格式异常，未覆盖本机数据。');
      const cloud=remote.data||blank();const merged=mergeStudy(this.base,this.data,cloud);
      if(merged.conflicts.length){
        // A preference is applied only in resolve(); the ordinary path never overwrites conflicting edits.
        this.conflict={local:structuredClone(this.data),cloud,at:new Date().toISOString()};
        this.emit({status:'conflict',conflicts:merged.conflicts,error:'同一条内容在两台设备上有不同修改，请选择冲突处保留哪一份。'});return;
      }
      this.base=cloud;this.revision=remote.revision;this.data=merged.data as StudyData;this.persist();this.emit();
      if(!same(this.data,cloud)){
        const sent=structuredClone(this.data);
        const result=await this.api<{revision:number;updatedAt:string|null}>('/api/study-sync','PUT',{revision:this.revision,data:sent});if(this.stopped||generation!==this.generation)return;
        if(!Number.isSafeInteger(result.revision)||result.revision!==remote.revision+1)throw new Error('云端版本确认失败，请重试同步。');
        this.base=sent;this.revision=result.revision;remote.updatedAt=result.updatedAt;
      }
      success=true;this.emit({status:same(this.data,this.base)?'synced':'pending',lastSynced:remote.updatedAt||new Date().toISOString(),error:'',conflicts:[]});this.persist();
    }catch(e){
      if(this.stopped||generation!==this.generation)return;
      if(e instanceof ApiError&&e.status===401)this.emit({status:'expired',authRequired:true,error:'登录已过期，未同步的记录仍保留在此设备。'});
      else if(e instanceof ApiError&&e.status===409){this.emit({status:'pending',error:'另一台设备刚刚更新，正在重新合并。'});this.queue(2000);}
      else this.emit({status:'offline',error:e instanceof Error?e.message:'同步失败，记录已保留在本机。'});
    }finally{if(generation===this.generation){this.busy=false;if(success&&!same(this.data,this.base))this.queue();}}
  }
  async sendEmailCode(email:string,purpose:'login'|'register'|'bind'){return this.api<{challengeId:string;retryAfter:number}>('/api/account/email/send','POST',{email,purpose});}
  resolve(prefer:'local'|'cloud'){
    if(!this.conflict)return;
    this.write('readspace.conflict.'+this.state.user!.id,this.conflict);
    // Resolve only the conflicting fields. Independent edits still merge.
    const resolved=mergeStudy(this.base,this.data,this.conflict.cloud,prefer);
    this.data=resolved.data as StudyData;this.base=this.conflict.cloud;this.conflict=null;
    this.persist();this.emit({status:'pending',conflicts:[],error:''});void this.flush();
  }
  conflictBackup(){return JSON.stringify(this.conflict||this.read('readspace.conflict.'+this.state.user?.id),null,2);}
  importGuest(){
    if(!this.state.user)return;const guest=this.read(GUEST);if(!validateData(guest))return;
    this.update(current=>mergeStudy(blank(),guest,current,'cloud').data as StudyData);
    this.dismissMigration();this.notify('旧记录已合并；相同记录的不同内容保留账号中的版本，原本机记录仍保留。');
  }
  dismissMigration(){if(this.state.user)this.write('readspace.migrated.'+this.state.user.id,true);this.emit({migrationPending:false});}
  clearRecovery(){this.emit({recoveryCode:''});}
  async logout(){
    if(this.state.authBusy)return;
    this.emit({authBusy:true,error:''});
    try{
      this.persist();await this.api('/api/account/logout','POST',{});
      if(this.stopped)return;this.generation++;this.busy=false;if(this.timer)clearTimeout(this.timer);this.timer=null;
      this.storage.removeItem(ACTIVE);this.base=blank();this.revision=0;const guest=this.read(GUEST);this.data=validateData(guest)?guest:blank();
      this.state={...initialAccount,available:true,status:'local'};this.emit();this.notify('已退出。未同步内容保留在该账号的本机缓存中。');
    }catch(e){this.emit({error:'退出未完成，请联网重试。账号缓存仍保留。'});throw e;}
    finally{this.emit({authBusy:false});}
  }
  refresh(){if(this.state.authRequired||!this.state.user||this.state.available===false)return this.checkSession();return this.flush();}
  storageChanged(key:string|null){
    if(key===ACTIVE){const active=this.read(ACTIVE);if(isUser(active)&&active.id!==this.state.user?.id){this.activate(active);void this.checkSession();}else if(!active&&this.state.user){this.generation++;this.busy=false;this.state={...initialAccount,available:true,status:'local'};const guest=this.read(GUEST);this.data=validateData(guest)?guest:blank();this.emit();}return;}
    const user=this.state.user;if(key!==(user?dataKey(user.id):GUEST))return;
    const incoming=this.read(key!);if(!validateData(incoming))return;
    // Never discard unsynced edits in a second tab.
    const merged=mergeStudy(this.base,this.data,incoming);if(!merged.conflicts.length){this.data=merged.data as StudyData;this.emit();this.queue();}
    else{this.conflict={local:structuredClone(this.data),cloud:incoming,at:new Date().toISOString()};this.emit({status:'conflict',conflicts:merged.conflicts,error:'另一个标签页修改了同一条记录，请处理冲突。'});}
  }
  dispose(){this.stopped=true;this.generation++;if(this.timer)clearTimeout(this.timer);for(const r of this.requests)r.abort();}
}
