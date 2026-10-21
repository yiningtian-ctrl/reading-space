import type { StudyData, ReviewHistory } from "./reading";
export function localDay(date=new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
export function recordReview(data:StudyData,kind:"words"|"sentences",id:string,mastered:boolean,date=new Date()):StudyData {
  if(!(kind==="words"?data.words:data.notes).some(item=>item.id===id))return data;
  const history:ReviewHistory=data.review||{words:{},sentences:{},days:[]};
  const mark={count:(history[kind][id]?.count||0)+1,lastReviewedAt:date.toISOString(),mastered};
  return {...data,words:kind==="words"?data.words.map(w=>w.id===id?{...w,mastered}:w):data.words,review:{...history,[kind]:{...history[kind],[id]:mark},days:Array.from(new Set([...history.days,localDay(date)])).slice(-10000)}};
}
export function currentWeek(date=new Date()) {
  const monday=new Date(date.getFullYear(),date.getMonth(),date.getDate());monday.setDate(monday.getDate()-(monday.getDay()+6)%7);
  return Array.from({length:7},(_,i)=>{const day=new Date(monday);day.setDate(day.getDate()+i);return localDay(day);});
}
