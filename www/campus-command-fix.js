'use strict';
// Handle explicit creation commands before the syllabus Q&A router.
(()=>{
 const prior=chatSend;
 function clean(s){return String(s||'').replace(/\s+/g,'').toLowerCase()}
 function handle(raw){const q=String(raw||'').trim();if(!/(추가|등록|넣어|만들어)/.test(q)||!/(과제|시험|일정)/.test(q)||/(휴강|보강|수정|변경|삭제|알려|보여|목록|조회)/.test(q))return false;
  const m=q.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);if(!m)return false;
  const due=`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  const quoted=q.match(/["“'‘]([^"”'’]+)["”'’]/)?.[1];
  const matches=state.courses.filter(c=>clean(q).includes(clean(c.name)));
  const unique=[...new Map(matches.map(c=>[clean(c.name),c])).values()];
  let title=quoted||q.replace(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/g,'').replace(/(?:에서|에|의)?\s*(?:일정에|일정|과제|시험)?\s*(?:추가|등록|넣어|만들어).*$/,'').trim();
  if(!quoted&&unique.length)for(const c of unique)title=title.replace(c.name,'').replace(/^\s*(에서|에|의)\s*/,'').trim();
  if(!title)title=/시험/.test(q)?'시험':'과제';
  const type=/시험/.test(title)?'시험':'과제';
  say('user',q);$('#chatInput').value='';hideChatAction();
  if(!validDate(due)){say('assistant','올바른 날짜를 입력해 주세요.');return true}
  if(unique.length!==1){say('assistant','등록할 과목을 하나 지정해 주세요. 예: 컴퓨터프로그래밍2에서 '+due+' 일정에 "'+title+'" 추가해줘');return true}
  const c=unique[0];say('assistant',`[${c.name}] ${due}에 “${title}” ${type}를 등록할까요?`);
  chatAction(`<p><b>${esc(c.name)}</b> · ${esc(type)}<br>${esc(title)} · ${esc(due)}</p><button type="button" class="primary" id="cfTaskConfirm">확인하고 등록</button> <button type="button" class="ghost" id="cfTaskCancel">취소</button>`,()=>{
   $('#cfTaskConfirm').onclick=()=>{if(state.tasks.some(t=>clean(t.title)===clean(title)&&t.due===due&&clean(course(t.course)?.name)===clean(c.name))){say('assistant','이미 같은 과제·시험이 등록되어 있어요.');hideChatAction();return}state.tasks.push({id:uid(),title,course:c.id,type,due,hours:3,done:false});save();hideChatAction();say('assistant','등록 완료! 과제·시험 목록과 공부 계획에서 확인할 수 있어요.')};
   $('#cfTaskCancel').onclick=()=>{hideChatAction();say('assistant','등록을 취소했어요.')};
  });return true;
 }
 chatSend=function(raw){if(handle(raw))return;return prior(raw)};
 $('#chatForm').onsubmit=e=>{e.preventDefault();chatSend($('#chatInput').value)};
 $('#chatInput').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();chatSend(e.target.value)}};
})();
