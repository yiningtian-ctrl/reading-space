import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultData} from '../lib/reading.ts';
import {mergeStudy} from '../lib/study-merge.mjs';
import {StudySync} from '../lib/study-sync-client.ts';
import {TestD1,MemoryStorage,device,password,word,note} from './account-test-helpers.mjs';
const blank=()=>structuredClone(defaultData);
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function settled(sync){for(let i=0;i<100;i++){if(!['pending','syncing'].includes(sync.state.status))return;await pause(30);}throw new Error('Sync did not settle');}

test('Three-way merge combines independent edits, bookmarks and review days, and preserves removals',()=>{
 const base=blank();base.words=[word('old')];base.saved=['old'];const local=structuredClone(base),cloud=structuredClone(base);
 local.words=[];local.saved=[];local.notes=[note('local')];cloud.words.push(word('cloud'));cloud.saved.push('cloud');cloud.settings.fontSize=22;
 const merged=mergeStudy(base,local,cloud);assert.deepEqual(merged.conflicts,[]);assert.deepEqual(merged.data.words.map(w=>w.id),['cloud']);assert.deepEqual(merged.data.saved,['cloud']);assert.equal(merged.data.notes.length,1);assert.equal(merged.data.settings.fontSize,22);
 base.review={words:{},sentences:{},days:['2026-10-28']};local.review={words:{},sentences:{},days:['2026-10-28','2026-10-29']};cloud.review={words:{},sentences:{},days:['2026-10-28','2026-10-30']};assert.equal(mergeStudy(base,local,cloud).data.review.days.length,3);
});
test('Simultaneous edits and delete-versus-edit require a decision, while independent fields still merge',()=>{
 const base=blank();base.words=[word('same')];const local=structuredClone(base),cloud=structuredClone(base);local.words[0].meaning='本机释义';cloud.words[0].meaning='云端释义';cloud.notes=[note('cloud')];
 assert.deepEqual(mergeStudy(base,local,cloud).conflicts,['words.same.meaning']);assert.equal(mergeStudy(base,local,cloud,'local').data.words[0].meaning,'本机释义');assert.equal(mergeStudy(base,local,cloud,'local').data.notes.length,1);
 local.words=[];assert.deepEqual(mergeStudy(base,local,cloud).conflicts,['words.same']);
});
test('Two device sessions sync without local files; old guest records require explicit migration and survive logout',async()=>{
 const db=new TestD1(),a=device(db),b=device(db,'192.0.2.2'),storage=new MemoryStorage();const old=blank();old.words=[word('guest')];old.imported=[{id:'import-guest',title:'A personal reading text',subtitle:'Personal import',source:'Personal',kind:'imported',topic:'科技与学习',level:2,image:'/images/study.jpg',description:'A private text',paragraphs:[{en:'This is my personal reading text.'}]}];old.review={words:{guest:{count:2,lastReviewedAt:'2026-10-29T12:00:00Z',mastered:false}},sentences:{},days:['2026-10-29']};storage.setItem('readspace.study.v1',JSON.stringify(old));
 const first=new StudySync(storage,()=>{},()=>{},a.fetch),second=new StudySync(new MemoryStorage(),()=>{},()=>{},b.fetch);
 try{
  await first.start();await first.authenticate('register','alice',password);assert.equal(first.state.migrationPending,true);assert.equal(first.data.words.length,0);
  assert.equal((await(await a.request('/api/study-sync')).json()).data,null);first.importGuest();await first.flush();await settled(first);
  await second.start();await second.authenticate('login','alice',password);assert.equal(second.data.words[0].id,'guest');assert.equal(second.data.imported[0].paragraphs[0].en,'This is my personal reading text.');assert.equal(second.data.review.words.guest.count,2);
  second.update(d=>({...d,notes:[note('phone')]}));await second.flush();await first.flush();assert.equal(first.data.notes[0].id,'phone');
  await first.logout();assert.equal(first.data.words[0].id,'guest');assert.equal(first.state.user,null);assert.equal(JSON.parse(storage.getItem('readspace.study.v1')).words.length,1);
  await first.authenticate('register','bob',password);assert.equal(first.data.notes.length,0);assert.equal(first.data.words.length,0);
  await first.authenticate('login','alice',password);assert.equal(first.data.notes[0].id,'phone');
 }finally{first.dispose();second.dispose();db.close();}
});
test('Offline changes survive closing the app, then upload after reconnecting without importing another user cache',async()=>{
 const db=new TestD1(),a=device(db),storage=new MemoryStorage();let sync=new StudySync(storage,()=>{},()=>{},a.fetch);
 try{
  await sync.start();await sync.authenticate('register','alice',password);const id=sync.state.user.id;a.offline=true;
  sync.update(d=>({...d,words:[word('offline')]}));await sync.flush();assert.equal(sync.state.status,'offline');sync.dispose();
  sync=new StudySync(storage,()=>{},()=>{},a.fetch);await sync.start();assert.equal(sync.data.words[0].id,'offline');assert.equal(sync.state.user.id,id);
  a.offline=false;await sync.refresh();assert.equal(sync.state.status,'synced');assert.equal((await(await a.request('/api/study-sync')).json()).data.words[0].id,'offline');
 }finally{sync.dispose();db.close();}
});
test('Two devices editing one definition stop at conflict; the chosen value keeps independent cloud notes',async()=>{
 const db=new TestD1(),a=device(db),b=device(db,'192.0.2.2'),first=new StudySync(new MemoryStorage(),()=>{},()=>{},a.fetch),second=new StudySync(new MemoryStorage(),()=>{},()=>{},b.fetch);
 try{
  await first.start();await first.authenticate('register','alice',password);first.update(d=>({...d,words:[word('shared')]}));await first.flush();
  await second.start();await second.authenticate('login','alice',password);
  first.update(d=>({...d,words:d.words.map(w=>({...w,meaning:'电脑释义'})),notes:[note('cloud-note')]}));await first.flush();
  second.update(d=>({...d,words:d.words.map(w=>({...w,meaning:'手机释义'}))}));await second.flush();assert.equal(second.state.status,'conflict');assert.equal((await(await a.request('/api/study-sync')).json()).data.words[0].meaning,'电脑释义');
  second.resolve('local');await settled(second);await first.flush();assert.equal(first.data.words[0].meaning,'手机释义');assert.equal(first.data.notes[0].id,'cloud-note');assert.equal(second.state.status,'synced');
 }finally{first.dispose();second.dispose();db.close();}
});
