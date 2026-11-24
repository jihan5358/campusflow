// Development AI extension: never put the Gemini API key here.
(()=>{
const panel=document.createElement('div');panel.className='card';panel.innerHTML=`<h2>강의계획서 AI</h2><p>PDF·텍스트 분석 → 근거 확인 → 선택한 정보 등록. 아래 CampusFlow 도우미에서 분석한 여러 과목의 정보를 질문하세요.</p><p id="realStatus" class="ai-connection-status" role="status" aria-live="polite">로그인하면 사용 가능한 AI 모델을 자동으로 불러옵니다.</p><div class="field"><label for="realModel">AI 모델</label><select id="realModel" disabled><option value="">로그인 후 자동으로 불러옵니다</option></select></div><p class="disclaimer">공개 베타 · Gemini 무료 한도와 GPT 유료 사용량 제한이 적용됩니다. 서버가 절전 상태면 첫 연결에 약 1분이 걸릴 수 있습니다. 원문과 AI 질문은 선택한 AI 제공업체로 전송됩니다. Gemini 및 OpenAI의 데이터 처리·보관 조건을 확인하고 민감정보·비공개 문서는 전송하지 마세요. <a href="privacy.html" target="_blank" rel="noopener noreferrer">데이터 처리 안내</a></p><div class="field"><label>저장된 강의계획서 분석 (시험 주차 질문 가능)</label><select id="realLibrary"></select><button id="realLoad" type="button">저장된 분석 불러오기</button></div><div class="field"><label>강의계획서 (PDF 20MB 이하 / UTF-8 TXT)</label><input id="realFile" type="file" accept=".pdf,.txt,application/pdf,text/plain"></div><div class="field"><label>또는 원문 붙여넣기 (파일 선택 시 파일 우선)</label><textarea id="realText" rows="5" placeholder="강의계획서 원문"></textarea></div><label><input type="checkbox" id="realConsent" style="width:auto"> 선택한 AI 제공업체로 문서와 질문을 전송하는 데 동의합니다.</label><p><button class="primary" id="realAnalyze">AI 분석</button> <button id="realClear">문서·결과 지우기</button></p><p id="realBusyHint" role="alert" style="color:#b45309;font-weight:700" hidden></p><div id="realResult"></div><hr><p><b>질문은 아래 CampusFlow 도우미 채팅에서 해 주세요.</b> 분석한 교수명·이메일·수업·교재·시험 주차·과제를 연결해 답변합니다. <button id="realGoChat" type="button">CampusFlow 도우미로 이동 ↓</button></p>`;
document.querySelector('#llm').prepend(panel);
const el=id=>document.getElementById(id),status=t=>el('realStatus').textContent=t;

let doc=null,result=null,working=false,imported=false,currentAnalysisId=null;
function normalize(r){r.course=r.course||{};for(const k of ['meetings','events','books','facts','warnings'])r[k]=Array.isArray(r[k])?r[k]:[];r.meetings=r.meetings.map(m=>({...m,day:Number(m.day),start:String(m.start||'').padStart(5,'0'),end:String(m.end||'').padStart(5,'0')}));return r;}
// AI 분류는 명시적인 근거가 있을 때만 사용하고, 사용자가 최종 확인합니다.
function categoryFromAnalysis(r){
 const c=r?.course||{};
 const candidates=[c.category,c.courseType,c.classification,c.type,
   ...(r?.facts||[]).filter(f=>/이수\s*구분|교과\s*구분|교과목\s*구분|과목\s*구분|전공\s*여부|교양\s*여부|교과\s*영역/i.test(f.field||'')).map(f=>f.value)];
 for(const v of candidates){
  const t=String(v||'').trim();
  if(/^(major|전공|전공필수|전공선택|전필|전선)(\s*과목)?$/i.test(t))return 'major';
  if(/^(general|교양|교양필수|교양선택|교필|교선|핵심교양|기초교양)(\s*과목)?$/i.test(t))return 'general';
 }
 return 'unset';
}
const aiCategoryColor={major:'#5472df',general:'#18a28e',unset:'#64748b'};
function remember(r){state.syllabusLibrary=state.syllabusLibrary||[];const data=JSON.parse(JSON.stringify(r));const id=uid();state.syllabusLibrary.unshift({id,data,created:new Date().toISOString()});state.syllabusLibrary=state.syllabusLibrary.slice(0,30);try{localStorage.setItem(key,JSON.stringify(state));}catch{status('기기 저장 공간이 부족합니다. 분석 기록 저장에 실패했습니다.');}refreshLibrary();return id;}
function refreshLibrary(){el('realLibrary').innerHTML='<option value="">저장된 분석 선택</option>'+ (state.syllabusLibrary||[]).map(x=>`<option value="${esc(x.id)}">${esc(x.data.course?.name||'과목 미상')} · ${esc(x.created?.slice(0,10)||'')}</option>`).join('');}
function examAnswer(question,r){if(!r||!/중간|기말|시험/.test(question))return null;const filter=/중간/.test(question)&&!/기말/.test(question)?'중간':/기말/.test(question)&&!/중간/.test(question)?'기말':null;const events=r.events.filter(e=>(/시험|고사/.test(e.type||'')||/고사/.test(e.title||''))&&(!filter||(e.title||'').includes(filter)));if(!events.length)return null;return events.map(e=>`${e.title}: ${e.date||e.scheduleText||'일정 미명시'}\n근거: ${e.evidence||'분석 결과에 기록됨'} / 페이지: ${e.page??'미확인'}`).join('\n\n')+'\n\n주차만 있는 시험은 실제 날짜로 환산하지 않았습니다. 원문을 확인하세요.';}

function pricing(m=''){return m.startsWith('openai:')?{tier:'paid',label:'OpenAI API · 사용량에 따라 과금'}:{tier:'free',label:'Gemini · 무료 등급 한도 적용'};}
function isCongestion(e){return e.code==='MODEL_BUSY'||/currently experiencing high demand|spikes in demand|model (?:is )?overloaded|server (?:is )?overloaded/i.test(e.message||'');}
const storedModel=localStorage.getItem('cf-ai-model');
async function request(endpoint,body){
 if(!window.CampusAuth)throw new Error('로그인 모듈을 확인하세요.');
 return window.CampusAuth.request(endpoint,body);
}

async function run(fn){if(working)return;el('realBusyHint').hidden=true;el('realBusyHint').textContent='';working=true;['realAnalyze','realClear','realFile'].forEach(id=>el(id).disabled=true);try{await fn();}catch(e){if(isCongestion(e)){el('realBusyHint').textContent='서버가 혼잡하여 다른 무료 버전을 이용해주세요. 다른 무료 모델도 혼잡하거나 계정에서 이용할 수 없다면 잠시 후 다시 시도해주세요.';el('realBusyHint').hidden=false;}status('오류: '+(e.message==='Failed to fetch'?'인터넷 연결을 확인하세요. 무료 서버가 깨어나는 중이면 약 1분 뒤 다시 시도하세요.':e.message));}finally{working=false;['realAnalyze','realClear','realFile'].forEach(id=>el(id).disabled=false);}}
async function loadModels(){if(!window.CampusAuth)return;status('사용 가능한 AI 모델을 불러오는 중…');try{const j=await request('models');el('realModel').innerHTML='<option value="">모델을 선택하세요</option>'+j.models.map(m=>`<option value="${esc(m)}">${esc(m.replace(/^gemini:/,'Gemini · ').replace(/^openai:/,'GPT · '))} — ${esc(pricing(m).label)}</option>`).join('');if(j.models.includes(storedModel))el('realModel').value=storedModel;else if(storedModel&&j.models.includes('gemini:'+storedModel))el('realModel').value='gemini:'+storedModel;el('realModel').disabled=false;status('AI 모델을 불러왔습니다. 사용할 모델을 선택해 주세요.');}catch(e){el('realModel').disabled=true;status('AI 모델을 불러오지 못했습니다: '+e.message);}}
window.addEventListener('campusflow:auth',e=>{if(e.detail?.authenticated)loadModels();else{el('realModel').disabled=true;el('realModel').innerHTML='<option value="">로그인 후 자동으로 불러옵니다</option>';status('로그인하면 사용 가능한 AI 모델을 자동으로 불러옵니다.');}});
function invalidate(){doc=null;result=null;imported=false;el('realResult').replaceChildren();}
el('realFile').onchange=invalidate;el('realText').oninput=invalidate;
async function documentInput(){if(!el('realConsent').checked)throw new Error('문서 전송 동의에 체크하세요.');const file=el('realFile').files[0];if(file){if(file.size>20*1024*1024)throw new Error('파일은 20MB 이하로 선택하세요.');if(file.name.toLowerCase().endsWith('.pdf')){const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(file);});return{mime:'application/pdf',data};}if(!file.name.toLowerCase().endsWith('.txt'))throw new Error('PDF/TXT만 지원합니다.');return{text:await file.text()};}const text=el('realText').value.trim();if(!text&&result)return{text:'이 자료는 원문이 아닌 저장된 분석 결과입니다. 여기 없는 정보는 확인할 수 없습니다.\n'+JSON.stringify(result)};if(!text||text.length>100000)throw new Error('원문을 1~10만 자로 입력하세요.');return{text};}
function model(){const m=el('realModel').value;if(!m)throw new Error('로그인 후 불러온 AI 모델을 선택하세요.');const p=pricing(m);if(p.tier!=='free'&&!confirm('GPT API를 호출합니다. OpenAI 계정의 모델별 입력·출력 토큰 요금에 따라 비용이 발생합니다. 계속할까요?'))throw new Error('모델 선택을 취소했습니다. 무료 등급 제공 모델을 선택하세요.');localStorage.setItem('cf-ai-model',m);return m;}
const timeValid=s=>typeof s==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const meetingOK=m=>Number.isInteger(m.day)&&m.day>=0&&m.day<5&&timeValid(m.start)&&timeValid(m.end)&&m.start<m.end&&m.start>='09:00'&&m.end<='20:00';
const dateValid=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(new Date(s+'T00:00:00').getTime())&&iso(new Date(s+'T00:00:00'))===s;
function showResult(){const r=result;el('realResult').innerHTML=`<h3>분석 결과 — 원문과 대조하세요</h3><p>강의명: <b>${esc(r.course.name||'미명시')}</b> / 교수: ${esc(r.course.prof||'미명시')} / 이메일: ${esc(r.course.email||'미명시')} / 강의실: ${esc(r.course.room||'미명시')}</p><div class="field"><label>AI 추출 강의 구분 (확인 후 변경 가능)<select id="realCourseCategory"><option value="unset" ${categoryFromAnalysis(r)==='unset'?'selected':''}>미지정 · 직접 선택</option><option value="major" ${categoryFromAnalysis(r)==='major'?'selected':''}>전공 · 파란색</option><option value="general" ${categoryFromAnalysis(r)==='general'?'selected':''}>교양 · 초록색</option></select></label><small>분류가 확실하지 않으면 미지정으로 둡니다. 색상은 강의 수정에서 개별 변경할 수 있습니다.</small></div><p class="disclaimer">시간표는 기존 앱의 평일 반복 구조에 맞춰 등록됩니다. 학기 경계·주말·휴일은 자동 반영하지 않습니다. 겹치는 수업은 등록을 막습니다.</p><h4>수업 시간 선택</h4><p><b>체크는 등록 대상 선택입니다.</b> 아래의 ‘선택한 수업을 시간표에 등록’ 버튼을 눌러야 저장됩니다. 유효한 평일 수업은 기본 선택됩니다.</p>${r.meetings.map((m,i)=>`<p><label><input class="aiMeeting" data-index="${i}" type="checkbox" style="width:auto" ${meetingOK(m)?'checked':'disabled'}> ${esc(['월','화','수','목','금','토','일'][m.day]||'?')} ${esc(m.start)}~${esc(m.end)} ${meetingOK(m)?'':'(등록 불가: 주말·09~20시 밖·시간 불명확)'}</label><br><small>${esc(m.evidence)} · 페이지 ${esc(m.page??'해당 없음')}</small></p>`).join('')}<h4>시험·과제 선택</h4>${r.events.map((e,i)=>`<p><label><input class="aiEvent" data-index="${i}" type="checkbox" style="width:auto" ${dateValid(e.date)?'':'disabled'}> ${esc(e.type)} · ${esc(e.title)} · ${esc(e.date||e.scheduleText||'미정')}</label><br><small>${esc(e.evidence)} · 페이지 ${esc(e.page??'해당 없음')}</small></p>`).join('')}<h4>교재·참고도서</h4>${r.books.map(b=>`<p>${esc(b.kind)}: ${esc(b.title)}<br><small>${esc(b.evidence)} · 페이지 ${esc(b.page??'해당 없음')}</small></p>`).join('')||'<p>명시되지 않음</p>'}<h4>추출 근거</h4>${r.facts.map(f=>`<p>${esc(f.field)}: ${esc(f.value)}<br><small>${esc(f.evidence)} · 페이지 ${esc(f.page??'해당 없음')}</small></p>`).join('')}<h4>확인 필요</h4>${r.warnings.map(w=>`<p>${esc(w)}</p>`).join('')}<p>주차만 있는 시험도 분석 기록에 보관되어 질문할 수 있습니다. 실제 날짜를 확인한 뒤 과제·시험 메뉴에서 추가하세요.</p><button id="realImport" class="primary">선택한 수업을 시간표에 등록</button>`;el('realImport').onclick=importResult;el('realImport').disabled=imported;addCorrectionUI();}
function addCorrectionUI(){
 const box=document.createElement('details');box.innerHTML=`<summary>잘못 읽었거나 누락된 정보 수정하기</summary><p>원문을 확인한 뒤 수정하세요. 요일 행을 추가하면 기존 수업과 함께 표시됩니다. 주말은 등록되지 않습니다.</p>${['name','prof','email','room'].map((k,i)=>`<div class="field"><label>${['강의명','교수','이메일','강의실'][i]}</label><input data-edit-field="${k}" value="${esc(result.course[k]||'')}"></div>`).join('')}<div id="realEditMeetings"></div><button type="button" id="realAddMeeting">＋ 수업 요일 추가</button> <button type="button" id="realApplyEdit">수정 결과 적용</button>`;
 el('realResult').prepend(box);
 function row(m={day:0,start:'12:00',end:'13:30'},index=-1){const r=document.createElement('div');r.className='row';r.dataset.editRow='1';r.dataset.sourceIndex=index;r.innerHTML=`<select aria-label="수업 요일" style="width:85px">${['월','화','수','목','금','토','일'].map((d,i)=>`<option value="${i}" ${m.day===i?'selected':''}>${d}</option>`).join('')}</select><input aria-label="시작 시간" type="time" value="${esc(m.start)}" style="width:120px"><input aria-label="종료 시간" type="time" value="${esc(m.end)}" style="width:120px"><button type="button">행 제거</button>`;r.querySelector('button').onclick=()=>r.remove();el('realEditMeetings').append(r);}
 result.meetings.forEach((m,i)=>row(m,i));el('realAddMeeting').onclick=()=>row();
 el('realApplyEdit').onclick=()=>{
  const meetings=[...box.querySelectorAll('[data-edit-row]')].map(r=>{const ts=r.querySelectorAll('input');const prev=result.meetings[Number(r.dataset.sourceIndex)];return {day:Number(r.querySelector('select').value),start:ts[0].value,end:ts[1].value,evidence:prev?.evidence||'사용자 직접 입력 — 원문 대조 필요',page:prev?.page??null};});
  if(meetings.some(m=>!timeValid(m.start)||!timeValid(m.end)||m.start>=m.end)){status('수업 시작·종료 시간을 확인하세요.');return;}
  for(const input of box.querySelectorAll('[data-edit-field]'))result.course[input.dataset.editField]=input.value.trim();
  result.course.category=el('realCourseCategory')?.value||categoryFromAnalysis(result);result.meetings=meetings;result.warnings=[...new Set([...result.warnings,'사용자가 결과를 수정했습니다. 기존 근거는 수정값을 검증하지 않으며 원문 대조가 필요합니다.'])];const saved=(state.syllabusLibrary||[]).find(x=>x.id===currentAnalysisId);if(saved){saved.data=JSON.parse(JSON.stringify(result));try{localStorage.setItem(key,JSON.stringify(state));}catch{status('저장 공간이 부족합니다.');}refreshLibrary();}showResult();status('수정 적용 완료. CampusFlow 도우미에도 반영했습니다. 등록하려면 수업을 확인하고 등록 버튼을 누르세요.');
 };
}

function importResult(){try{
 if(imported)throw new Error('이미 등록한 결과입니다.');
 if(!result.course.name)throw new Error('강의명이 없어 등록할 수 없습니다.');
 const meetings=[...panel.querySelectorAll('.aiMeeting:checked')].map(x=>result.meetings[Number(x.dataset.index)]);
 const events=[...panel.querySelectorAll('.aiEvent:checked')].map(x=>result.events[Number(x.dataset.index)]);
 if(!meetings.length)throw new Error('선택된 수업이 없습니다. 시간표에 넣을 수업을 체크하거나 수정 영역에서 요일·시간을 입력하세요.');
 if(!meetings.every(meetingOK)||!events.every(e=>dateValid(e.date)))throw new Error('요일·날짜·시간을 확인하세요.');
 if(meetings.some(m=>state.courses.some(c=>c.days.includes(m.day)&&m.start<c.end&&m.end>c.start)))throw new Error('기존 시간표와 겹칩니다. 기존 수업을 수정하거나 해당 시간을 선택 해제하세요.');
 if(meetings.some((m,i)=>meetings.some((n,j)=>i!==j&&m.day===n.day&&m.start<n.end&&m.end>n.start)))throw new Error('추출된 수업끼리 겹칩니다. 하나만 선택하세요.');
 if(!confirm('선택한 수업·일정을 등록하고 추출 정보를 이 기기에 저장할까요? 원문을 먼저 확인하세요.'))return;
 const ids=[];
 const selectedCategory=el('realCourseCategory')?.value||'unset';
 result.course.category=selectedCategory;
 const selectedColor=aiCategoryColor[selectedCategory]||aiCategoryColor.unset;
 const groups=[];
 for(const m of meetings){let g=groups.find(x=>x.start===m.start&&x.end===m.end);if(!g){g={start:m.start,end:m.end,days:[]};groups.push(g);}if(!g.days.includes(m.day))g.days.push(m.day);}
 const rows=groups.length?groups:[null];
 for(const m of rows){const id=uid();ids.push(id);state.courses.push({id,name:result.course.name,prof:result.course.prof||'',email:result.course.email||'',room:result.course.room||'',category:selectedCategory,color:selectedColor,days:m?m.days:[],start:m?.start||'09:00',end:m?.end||'10:00',source:'AI 분석 · 사용자 확인',credits:Number(result.course.credits)||3});}
 for(const e of events)state.tasks.push({id:uid(),course:ids[0],title:e.title||'일정',due:e.date,hours:1,done:false,type:e.type==='시험'?'시험':'과제'});
 state.syllabusAI=state.syllabusAI||[];state.syllabusAI.push({id:uid(),course:ids[0],data:result,created:new Date().toISOString()});
 imported=true;save();el('realImport').disabled=true;week=monday(today);tab('home');render();toast('시간표에 '+meetings.length+'개 수업 시간을 등록했습니다.');status('시간표 등록 완료. 시험 주차는 저장된 분석에서 질문할 수 있습니다.');
 }catch(e){status(e.message);}}
el('realAnalyze').onclick=()=>run(async()=>{if(el('realModel').disabled)throw new Error('로그인 후 AI 모델이 자동으로 연결됩니다.');const m=model();doc=await documentInput();result=null;el('realResult').replaceChildren();status('AI 분석 중…');const j=await request('analyze',{model:m,document:doc});result=normalize(j.data);imported=false;currentAnalysisId=remember(result);showResult();status('분석 완료. AI가 틀릴 수 있으므로 원문을 확인한 다음 등록하세요.');});
el('realClear').onclick=()=>{invalidate();el('realFile').value='';el('realText').value='';el('realConsent').checked=false;status('현재 문서와 결과를 지웠습니다. 이미 등록한 일정은 유지됩니다.');};
refreshLibrary();
el('realLoad').onclick=()=>{const item=(state.syllabusLibrary||[]).find(x=>x.id===el('realLibrary').value);if(!item){status('저장된 분석을 선택하세요.');return;}doc=null;currentAnalysisId=item.id;result=normalize(JSON.parse(JSON.stringify(item.data)));imported=false;el('realFile').value='';el('realText').value='';showResult();status('저장된 분석을 불러왔습니다. 시험 주차는 API 없이 질문할 수 있습니다. 재등록은 기존 수업과 중복될 수 있습니다.');};
const reset=document.getElementById('resetData');if(reset)reset.textContent='빈 시간표로 초기화';
const prompt=document.createElement('div');prompt.className='note';prompt.innerHTML='강의계획서를 분석하고 수업을 등록하면 시간표에 표시됩니다. <button type="button" id="realGoUpload">강의계획서 넣기</button>';document.getElementById('home').prepend(prompt);document.getElementById('realGoUpload').onclick=()=>tab('llm');
window.CampusAI={request,model};
el('realGoChat').onclick=()=>{document.querySelector('.chatbox').scrollIntoView({behavior:'smooth',block:'start'});document.getElementById('chatInput').focus();};
const badge=document.querySelector('.top .pill');if(badge)badge.textContent='공개 베타 · 클라우드 AI';
})();
