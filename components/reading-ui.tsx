"use client";
import {useEffect,useRef} from "react";
import {BookOpen,ArrowRight,X} from "lucide-react";
import type {LucideIcon} from "lucide-react";
export function Empty({icon:Icon=BookOpen,title,text,action,onAction}:{icon?:LucideIcon;title:string;text:string;action?:string;onAction?:()=>void}) { return <div className="empty"><div className="empty-icon"><Icon size={28}/></div><h3>{title}</h3><p>{text}</p>{action&&<button className="button primary" onClick={onAction}>{action}<ArrowRight size={16}/></button>}</div>; }
export function Modal({title,eyebrow,children,onClose,wide=false}:{title:string;eyebrow?:string;children:React.ReactNode;onClose:()=>void;wide?:boolean}) {
  const ref=useRef<HTMLDivElement>(null); const closeRef=useRef(onClose);closeRef.current=onClose;
  useEffect(()=>{const before=document.activeElement as HTMLElement;const overflow=document.body.style.overflow;document.body.style.overflow="hidden";const root=ref.current;root?.focus();
    const key=(e:KeyboardEvent)=>{if(e.key==="Escape") closeRef.current();if(e.key==="Tab"&&root){const items=Array.from(root.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]'));const first=items[0],last=items.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===root)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===root)){e.preventDefault();first?.focus();}}};document.addEventListener("keydown",key);return()=>{document.body.style.overflow=overflow;document.removeEventListener("keydown",key);before?.focus();};},[]);
  return <div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div className={`modal ${wide?"wide":""}`} role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}><header className="modal-head"><div>{eyebrow&&<span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div><button className="icon-button" aria-label="关闭" onClick={onClose}><X size={21}/></button></header>{children}</div></div>;
}

