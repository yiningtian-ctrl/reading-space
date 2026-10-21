import { ArticleImporter } from "../lib/article-import-service.mjs";
import { defaultData, validateData } from "../lib/reading.ts";
const importer=new ArticleImporter();
for(const url of ["https://learningenglish.voanews.com/a/wilbur-and-orville-wright-the-first-airplane/7998765.html","https://www.sciencenews.org/article/horned-dinosaur-skull-forces-combat"]){const a=await importer.import(url);if(!validateData({...defaultData,imported:[a]}))throw new Error("Invalid article");console.log(JSON.stringify({source:a.source,paragraphs:a.paragraphs.length,words:a.paragraphs.reduce((n,p)=>n+(p.en.match(/[a-z]+/gi)||[]).length,0),valid:true}));}
