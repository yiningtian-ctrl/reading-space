"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {defaultData} from '@/lib/reading';
import type {StudyData} from '@/lib/reading';
import {initialAccount,StudySync} from '@/lib/study-sync-client';
export function useStudyAccount(toast:(text:string)=>void){
  const [snapshot,setSnapshot]=useState({data:defaultData,state:initialAccount,ready:false});
  const controller=useRef<StudySync|null>(null),dataRef=useRef(defaultData);
  useEffect(()=>{
    let storage:Storage;
    try{storage=window.localStorage;}catch{storage={length:0,clear(){},key(){return null;},getItem(){return null;},removeItem(){},setItem(){throw new Error('Browser storage unavailable');}};}
    const sync=new StudySync(storage,(data,state,ready)=>{dataRef.current=data;setSnapshot({data,state,ready});},toast);controller.current=sync;void sync.start();
    const refresh=()=>{if(document.visibilityState==='visible')void sync.refresh();};
    const onStorage=(e:StorageEvent)=>sync.storageChanged(e.key);
    const interval=setInterval(refresh,30000);window.addEventListener('online',refresh);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);window.addEventListener('storage',onStorage);
    return()=>{clearInterval(interval);window.removeEventListener('online',refresh);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('storage',onStorage);sync.dispose();controller.current=null;};
  },[toast]);
  const update=useCallback((fn:(data:StudyData)=>StudyData)=>controller.current?.update(fn),[]);
  return{...snapshot,dataRef,update,controller};
}
