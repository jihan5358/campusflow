// Extract selectable PDF text locally; scan-only PDFs still require model vision.
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
const pdfRoot=path.dirname(require.resolve('pdfjs-dist/package.json'));
export async function pdfPages(data){
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const pdf=await getDocument({data:new Uint8Array(Buffer.from(data,'base64')),useSystemFonts:true,isEvalSupported:false,cMapUrl:path.join(pdfRoot,'cmaps')+path.sep,cMapPacked:true,standardFontDataUrl:path.join(pdfRoot,'standard_fonts')+path.sep}).promise;
 try{if(pdf.numPages>40)throw new Error('PDF는 40페이지 이하로 나누어 주세요.');const pages=[];
 for(let n=1;n<=pdf.numPages;n++){const p=await pdf.getPage(n);const content=await p.getTextContent();const rows=[];
 for(const it of content.items){if(!it.str?.trim())continue;const y=it.transform[5];let row=rows.find(r=>Math.abs(r.y-y)<3);if(!row){row={y,items:[]};rows.push(row);}row.items.push({x:it.transform[4],text:it.str});}
 pages.push({page:n,text:rows.sort((a,b)=>b.y-a.y).map(r=>r.items.sort((a,b)=>a.x-b.x).map(i=>i.text).join(' ')).join('\n')});}
 return pages;}finally{await pdf.destroy();}
}
export function sourceFields(pages){
 const out={course:{},meetings:[],events:[],facts:[]};
 for(const p of pages){const lines=p.text.split('\n').map(l=>l.replace(/\s+/g,''));
 for(let i=0;i<lines.length;i++){
  const line=lines[i];
  const name=line.match(/과목명\(국문\)(.+?)(?:과목번호|개설학과|$)/);if(name&&name[1]){out.course.name=name[1];out.facts.push({field:'국문 과목명',value:name[1],evidence:line,page:p.page});}
  const prof=line.match(/^성명(.+?)(?:교수소속|$)/);if(prof&&prof[1]){out.course.prof=prof[1];out.facts.push({field:'교수 성명',value:prof[1],evidence:line,page:p.page});}
  if(line.includes('강의시간표')){const source=line+((lines[i+1]||'').match(/^[월화수목금토일]\d/)?lines[i+1]:'');
   const re=/([월화수목금토일])(?:요일)?(\d{1,2}:\d{2})[~～〜–−-](\d{1,2}:\d{2})(?:\(([^)]+)\))?/g;let m;
   while((m=re.exec(source))){const start=m[2].padStart(5,'0'),end=m[3].padStart(5,'0');if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(end)||start>=end)continue;
   out.meetings.push({day:'월화수목금토일'.indexOf(m[1]),start,end,room:m[4]||'',evidence:m[0],page:p.page});}
  }
 }
 // Week headers bound each section; preserve week-only exams, never invent dates.
 const text=lines.join('\n');
 for(const block of text.split(/학습목표/).slice(1)){const week=block.match(/(\d{1,2})주차/);if(!week)continue;for(const title of ['중간고사','기말고사'])if(block.includes(title))out.events.push({title,type:'시험',date:null,scheduleText:week[1]+'주차',evidence:week[0]+' · '+title,page:p.page});}
 const re=/(\d{1,2})주차/g;const matches=[...text.matchAll(re)];
 for(let i=0;i<matches.length;i++){const m=matches[i],segment=text.slice(m.index,matches[i+1]?.index??text.length);for(const title of ['중간고사','기말고사'])if(segment.includes(title)&&!out.events.some(e=>e.title===title&&e.page===p.page))out.events.push({title,type:'시험',date:null,scheduleText:m[1]+'주차',evidence:segment.split('\n').filter(x=>x.includes('주차')||x.includes(title)).join(' ').slice(0,400),page:p.page});}
 }
 return out;
}
export function mergeSource(data,source){
 data.course={...(data.course||{}),...source.course};data.meetings=Array.isArray(data.meetings)?data.meetings:[];
 if(source.meetings.length){for(const m of source.meetings)if(!data.meetings.some(x=>x.day===m.day&&x.start===m.start&&x.end===m.end))data.meetings.push(m);
 // A source-listed block supersedes unsupported guesses with the same times.
 const times=new Set(source.meetings.map(m=>m.start+'-'+m.end));data.meetings=data.meetings.filter(m=>!times.has(m.start+'-'+m.end)||source.meetings.some(s=>s.day===m.day&&s.start===m.start&&s.end===m.end));
 const rooms=[...new Set(source.meetings.map(m=>m.room).filter(Boolean))];if(rooms.length)data.course.room=rooms.join(' / ');}
 for(const e of source.events){const index=data.events.findIndex(x=>x.title===e.title);if(index<0)data.events.push(e);else if(!data.events[index].date)data.events[index]={...data.events[index],...e};}
 data.facts.push(...source.facts);
 // Remove only absence/guess warnings for fields independently recovered from PDF text.
 data.warnings=data.warnings.filter(w=>!(source.course.name&&/국문|과목명/.test(w)&&/없|누락|미기재|명확|않/.test(w))&&!(source.course.prof&&/교수|성명/.test(w)&&/없|누락|미기재/.test(w))&&!(source.meetings.length&&/요일|OCR/.test(w)&&/유실|공백|추정|누락|미명시/.test(w)));
 data.warnings.push('선택 가능한 PDF 텍스트와 대조했습니다. 원문 표와 등록값을 최종 확인하세요.');return data;
}
