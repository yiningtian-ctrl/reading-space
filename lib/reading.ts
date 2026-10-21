export type Paragraph = { en: string; zh?: string; analysis?: string; hints?: string[] };
export type Article = {
  id: string; title: string; subtitle: string; topic: string; level: 1 | 2 | 3;
  source: string; sourceUrl?: string; kind: "original" | "external" | "imported";
  image: string; paragraphs: Paragraph[]; description: string; date?: string;
};
export type Word = { id: string; word: string; meaning: string; pos: string; sentence: string; articleId: string; articleTitle: string; addedAt: string; mastered: boolean; phonetic?: string; definition?: string; sourceUrl?: string; license?: { name: string; url: string }; definitionSource?: { source: string; sourceUrl?: string; license?: { name: string; url: string } } };
export type Note = { id: string; articleId: string; quote: string; text: string; paragraph: number; start?: number; end?: number; addedAt: string };
export type RecordItem = { progress: number; completedAt?: string; lastReadAt: string; seconds: number };
export type Settings = { fontSize: number; lineHeight: number; width: "normal" | "wide"; background: "paper" | "white" | "night"; dailyGoal: number };
export type ReviewMark = { count: number; lastReviewedAt: string; mastered: boolean };
export type ReviewHistory = { words: Record<string, ReviewMark>; sentences: Record<string, ReviewMark>; days: string[] };
export type StudyData = { version: 1; saved: string[]; words: Word[]; notes: Note[]; records: Record<string, RecordItem>; imported: Article[]; external: Article[]; settings: Settings; review?: ReviewHistory };
export const defaultData: StudyData = { version: 1, saved: [], words: [], notes: [], records: {}, imported: [], external: [], settings: { fontSize: 19, lineHeight: 1.95, width: "normal", background: "paper", dailyGoal: 20 } };
export function wordCount(a: Article) { return a.paragraphs.reduce((n, p) => n + (p.en.match(/[a-z]+(?:['’-][a-z]+)*/gi)?.length || 0), 0); }
export function readMinutes(a: Article) { return Math.max(3, Math.ceil(wordCount(a) / 75)); }
export function cleanWord(s: string) { return s.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, "").replace(/’/g, "'"); }
export function sourceLabel(a: Article) { return a.kind === "original" ? "ReadSpace 原创训练 · 非真题" : a.kind === "imported" ? "个人导入" : a.source; }
export function safeUrl(value: string): string | undefined { try { const u = new URL(value); return ["http:", "https:"].includes(u.protocol) ? u.href : undefined; } catch { return undefined; } }
export function validateData(value: unknown): value is StudyData {
  if (!value || typeof value !== "object") return false;
  const d = value as StudyData;
  const optionalString=(v:unknown,max=80000)=>v===undefined||(typeof v==="string"&&v.length<=max);
  if(Array.isArray(d.words)&&d.words.some(w=>!optionalString(w?.phonetic,300)))return false;
  if(d.review!==undefined){
    const r=d.review;
    if(!r||typeof r!=="object"||!Array.isArray(r.days)||r.days.length>10000||!r.days.every(day=>typeof day==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(day)))return false;
    for(const marks of [r.words,r.sentences])if(!marks||typeof marks!=="object"||Array.isArray(marks)||Object.values(marks).some(m=>!m||!Number.isInteger(m.count)||m.count<1||typeof m.mastered!=="boolean"||typeof m.lastReviewedAt!=="string"||!Number.isFinite(Date.parse(m.lastReviewedAt))))return false;
  }
  if(Array.isArray(d.words)&&d.words.some(w=>w?.definitionSource&&(typeof w.definitionSource.source!=="string"||!optionalString(w.definitionSource.sourceUrl,2000)||(w.definitionSource.sourceUrl&&!safeUrl(w.definitionSource.sourceUrl))||(w.definitionSource.license&&(typeof w.definitionSource.license.name!=="string"||typeof w.definitionSource.license.url!=="string"||!safeUrl(w.definitionSource.license.url))))))return false;
  if (d.settings && (typeof d.settings.fontSize!=="number"||typeof d.settings.lineHeight!=="number"||typeof d.settings.dailyGoal!=="number")) return false;
  if (Array.isArray(d.words) && (d.words.length>30000||d.words.some(w=>!w||typeof w.pos!=="string"||!optionalString(w.definition,4000)||!optionalString(w.sourceUrl,2000)||(w.sourceUrl&&!safeUrl(w.sourceUrl))||(w.license&&(typeof w.license.name!=="string"||typeof w.license.url!=="string"||!safeUrl(w.license.url)))))) return false;
  if (Array.isArray(d.notes) && d.notes.some(n=>!n||typeof n.addedAt!=="string"||(n.start!==undefined&&(!Number.isInteger(n.start)||n.start<0))||(n.end!==undefined&&(!Number.isInteger(n.end)||n.end<0)))) return false;
  if (d.records && typeof d.records==="object" && Object.values(d.records).some(r=>!r||!optionalString(r.completedAt,50))) return false;
  return d.version === 1 && Array.isArray(d.saved) && d.saved.every(x => typeof x === "string") && Array.isArray(d.words) && d.words.every(w => w && typeof w.id === "string" && typeof w.word === "string" && typeof w.meaning === "string" && typeof w.sentence === "string" && typeof w.mastered === "boolean" && typeof w.articleId === "string" && typeof w.articleTitle === "string" && typeof w.addedAt === "string") && Array.isArray(d.notes) && d.notes.every(n => n && typeof n.id === "string" && typeof n.articleId === "string" && typeof n.quote === "string" && typeof n.text === "string" && Number.isInteger(n.paragraph)) && Array.isArray(d.imported) && Array.isArray(d.external) && [...d.imported, ...d.external].every(a => a && typeof a.id === "string" && typeof a.title === "string" && typeof a.subtitle === "string" && typeof a.description === "string" && typeof a.topic === "string" && [1,2,3].includes(a.level) && ["original","external","imported"].includes(a.kind) && typeof a.source === "string" && typeof a.image === "string" && (!a.sourceUrl || !!safeUrl(a.sourceUrl)) && Array.isArray(a.paragraphs) && a.paragraphs.every(p => p && typeof p.en === "string" && (!p.zh || typeof p.zh === "string") && (!p.analysis || typeof p.analysis === "string") && (!p.hints || (Array.isArray(p.hints) && p.hints.every(h=>typeof h === "string"))))) && !!d.records && typeof d.records === "object" && !Array.isArray(d.records) && Object.values(d.records).every(r => r && typeof r.progress === "number" && r.progress >= 0 && r.progress <= 100 && typeof r.seconds === "number" && Number.isFinite(r.seconds) && r.seconds >= 0 && typeof r.lastReadAt === "string") && !!d.settings && ["normal", "wide"].includes(d.settings.width) && ["paper", "white", "night"].includes(d.settings.background) && d.settings.fontSize >= 16 && d.settings.fontSize <= 26 && d.settings.lineHeight >= 1.5 && d.settings.lineHeight <= 2.3 && d.settings.dailyGoal >= 5 && d.settings.dailyGoal <= 60;
}
