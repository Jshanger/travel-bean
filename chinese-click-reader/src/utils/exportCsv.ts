import type { SavedWord } from '../types';
import { getWordSourceTextIds } from './wordSources';
const quote=(v:string)=>`"${v.replaceAll('"','""')}"`;
export function exportCsv(words:SavedWord[]){const rows=[['Chinese','Pinyin','English','Original meaning','User edited','Difficulty','Example','Date saved','Lesson IDs'],...words.map(w=>[w.chinese,w.pinyin,w.meaning,w.originalMeaning??'',w.userEditedMeaning?'Yes':'No',w.difficultyLabel,w.exampleSentence??'',new Date(w.createdAt).toLocaleDateString(),getWordSourceTextIds(w).join(' | ')])];const csv='\ufeff'+rows.map(r=>r.map(quote).join(',')).join('\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='chinese-click-reader-vocabulary.csv';a.click();URL.revokeObjectURL(url)}
export function exportJson(words:SavedWord[]){download(JSON.stringify(words,null,2),'chinese-click-reader-vocabulary.json','application/json')}
function download(content:string,name:string,type:string){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url)}
