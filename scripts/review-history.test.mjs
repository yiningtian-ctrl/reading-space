import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultData,validateData} from '../lib/reading.ts';
import {recordReview,currentWeek,localDay} from '../lib/review-history.ts';
const old={...structuredClone(defaultData),words:[{id:'w1',word:'benefit',meaning:'益处',pos:'n.',sentence:'A benefit of reading.',articleId:'green-spaces',articleTitle:'Green spaces',addedAt:'2026-10-18T00:00:00Z',mastered:false}],notes:[{id:'n1',articleId:'green-spaces',quote:'A benefit of reading.',text:'我的理解',paragraph:0,addedAt:'2026-10-18T00:00:00Z'}],saved:['green-spaces'],records:{'green-spaces':{progress:30,seconds:80,lastReadAt:'2026-10-18T00:00:00Z'}}};
test('Old backups remain valid and a review preserves existing articles, annotations and reading progress',()=>{
 assert.ok(validateData(old));assert.equal(old.review,undefined);
 const next=recordReview(old,'words','w1',true,new Date(2026,9,19,12));
 assert.ok(validateData(next));assert.equal(next.words[0].mastered,true);assert.equal(next.review.words.w1.count,1);
 for(const key of ['saved','notes','records','imported','external','settings'])assert.deepEqual(next[key],old[key]);
 assert.equal(old.words[0].mastered,false);assert.equal(old.review,undefined);
});
test('Sentence answers have their own mastery, keep original notes and only count actual distinct local review days',()=>{
 const day=new Date(2026,9,19,23,50),nextDay=new Date(2026,9,20,0,10);
 let next=recordReview(old,'sentences','n1',false,day);next=recordReview(next,'sentences','n1',true,day);
 assert.equal(next.review.sentences.n1.count,2);assert.equal(next.review.sentences.n1.mastered,true);assert.deepEqual(next.notes,old.notes);assert.deepEqual(next.review.days,[localDay(day)]);
 next=recordReview(next,'words','w1',false,nextDay);assert.equal(next.review.days.length,2);assert.ok(validateData(JSON.parse(JSON.stringify(next))));
 assert.equal(recordReview(next,'sentences','deleted',true),next);
});
test('Weeks run Monday through Sunday across year boundaries without fabricated activity',()=>{
 assert.deepEqual(currentWeek(new Date(2027,0,1)),['2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03']);
 assert.equal(new Set(recordReview(old,'words','w1',true,new Date(2027,0,1)).review.days).size,1);
});
test('Backup validation rejects malformed review histories and invalid phonetic fields',()=>{
 const next=recordReview(old,'sentences','n1',false);
 for(const review of [null,{...next.review,days:['invalid']},{...next.review,words:[]},{...next.review,sentences:{n1:{count:-1,lastReviewedAt:'x',mastered:'yes'}}}])assert.equal(validateData({...next,review}),false);
 assert.equal(validateData({...old,words:[{...old.words[0],phonetic:12}]}),false);
});
