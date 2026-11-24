// Personal study preferences, weighted planner and contextual encouragement.
(()=>{
'use strict';
const $=s=>document.querySelector(s);
const defaults={preferredTime:'any',sessionMinutes:60,breakMinutes:10,weekends:false,maxHoursPerDay:3,prioritizeDifficulty:true,deadlinePriority:true,includeReview:false,style:'balanced'};
state.settings??={start:9,end:19};
state.settings.profile={...defaults,...(state.settings.profile||{})};
const profile=()=>state.settings.profile;
const escText=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function renderProfile(){
 const host=$('#personalStudySettings');if(!host)return;const p=profile();
 host.innerHTML=`<div class="profile-grid">
 <div class="profile-field"><label for="prefTime">선호 공부 시간대</label><select id="prefTime"><option value="any">시간대 상관없음</option><option value="morning">아침 · 09~12시</option><option value="afternoon">오후 · 12~17시</option><option value="evening">저녁 · 17시 이후</option></select></div>
 <div class="profile-field"><label for="prefSession">한 번에 공부할 시간</label><select id="prefSession"><option value="30">30분</option><option value="60">1시간</option><option value="90">1시간 30분</option></select></div>
 <div class="profile-field"><label for="prefBreak">공부 사이 휴식</label><select id="prefBreak"><option value="0">별도 휴식 없음</option><option value="5">5분</option><option value="10">10분</option><option value="15">15분</option></select></div>
 <div class="profile-field"><label for="prefMaxHours">하루 최대 공부량</label><select id="prefMaxHours"><option value="2">2시간</option><option value="3">3시간</option><option value="4">4시간</option><option value="5">5시간</option><option value="8">8시간</option></select></div>
 <div class="profile-field"><label for="prefStyle">전체 학습 스타일</label><select id="prefStyle"><option value="balanced">균형형 · 과목을 골고루</option><option value="focused">집중형 · 중요 과목 우선</option><option value="deadline">마감 우선형 · 급한 일정 우선</option></select></div>
 <div class="profile-field"><label>공부 가능한 요일</label><label class="profile-check"><input id="prefWeekend" type="checkbox"> 토요일·일요일에도 공부 가능</label></div></div>
 <h3 class="profile-section-title">나의 학습 성향</h3><div class="profile-checks">
 <label class="profile-check"><input id="prefDifficulty" type="checkbox"> 어려운 과목을 집중이 잘 될 때 먼저 공부하고 싶어요.</label>
 <label class="profile-check"><input id="prefDeadline" type="checkbox"> 마감일이 가까운 과제·시험을 우선하고 싶어요.</label>
 <label class="profile-check"><input id="prefReview" type="checkbox"> 짧은 단위로 나누어 자주 복습하고 싶어요.</label>
 </div><div class="profile-summary" id="profileSummary"></div>`;
 $('#prefTime').value=p.preferredTime;$('#prefSession').value=String(p.sessionMinutes);$('#prefBreak').value=String(p.breakMinutes);$('#prefMaxHours').value=String(p.maxHoursPerDay);$('#prefStyle').value=p.style;$('#prefWeekend').checked=!!p.weekends;$('#prefDifficulty').checked=!!p.prioritizeDifficulty;$('#prefDeadline').checked=!!p.deadlinePriority;$('#prefReview').checked=!!p.includeReview;summary();
}
function readProfile(){return {preferredTime:$('#prefTime').value,sessionMinutes:Number($('#prefSession').value),breakMinutes:Number($('#prefBreak').value),maxHoursPerDay:Number($('#prefMaxHours').value),style:$('#prefStyle').value,weekends:$('#prefWeekend').checked,prioritizeDifficulty:$('#prefDifficulty').checked,deadlinePriority:$('#prefDeadline').checked,includeReview:$('#prefReview').checked};}
function summary(){const p=readProfile(),t={any:'상관없음',morning:'아침',afternoon:'오후',evening:'저녁'}[p.preferredTime];$('#profileSummary').textContent=`현재 설정: ${t} 시간대 · 1회 ${p.sessionMinutes}분 · 하루 최대 ${p.maxHoursPerDay}시간 · ${p.weekends?'주말 포함':'평일 중심'} · ${({balanced:'균형형',focused:'집중형',deadline:'마감 우선형'})[p.style]}`;}
function saveProfile(){state.settings.profile=readProfile();try{localStorage.setItem('campusflow-demo-v2',JSON.stringify(state));}catch(e){toast('맞춤 설정을 저장하지 못했습니다.');return;}$('#priorityResult').innerHTML='';summary();toast('나의 학습 성향을 저장했습니다. 다음 계획부터 반영됩니다.');}
$('#savePersonalProfile')?.addEventListener('click',saveProfile);
$('#resetPersonalProfile')?.addEventListener('click',()=>{state.settings.profile={...defaults};renderProfile();saveProfile();});
$('#personalStudySettings')?.addEventListener('change',summary);
renderProfile();
// Keep manual task/event entry available alongside the assistant.
const addTaskButton=$('#addTask');if(addTaskButton){addTaskButton.textContent='＋ 직접 일정 등록';addTaskButton.onclick=()=>taskForm();const aiButton=document.createElement('button');aiButton.type='button';aiButton.className='ghost';aiButton.textContent='AI 도우미에게 요청';aiButton.onclick=()=>{tab('llm');$('#chatInput').focus();};addTaskButton.insertAdjacentElement('afterend',aiButton);}

// Encouragement banner reacts to task creation/completion and deadlines.
function renderMotivation(){const banner=$('#motivationBanner');if(!banner)return;const dismissed=localStorage.getItem('cf-motivation-dismissed')===new Date().toISOString().slice(0,10);banner.classList.toggle('hide',dismissed);if(dismissed)return;
 const tasks=Array.isArray(state.tasks)?state.tasks:[],open=tasks.filter(t=>!t.done),done=tasks.filter(t=>t.done),today=new Date();today.setHours(0,0,0,0);const dayString=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;const soon=open.filter(t=>t.due).sort((a,b)=>a.due.localeCompare(b.due))[0];let title='오늘의 작은 목표부터 시작해요.',text='작은 실천이 모여 큰 결과를 만들어요.';
 const added=state.lastAddedSchedule,completedAt=Number(state.lastCompletedAt||0);if(added&&Date.now()-Number(added.at||0)<20000){title='새 일정을 등록했어요!';text=`${added.title} · ${added.type}. 계획한 일을 하나씩 해내도록 응원할게요.`;}
 else if(completedAt&&Date.now()-completedAt<20000){title='한 가지 일을 해냈어요!';text='작은 완료가 쌓여 큰 진전이 됩니다. 정말 잘했어요.';}
 else if(tasks.length&&done.length===tasks.length){title='오늘의 할 일을 모두 마쳤어요!';text='충분히 수고했어요. 잠깐 쉬면서 성취감을 누려 보세요.';}
 else if(soon){const days=Math.ceil((new Date(soon.due+'T00:00:00')-today)/86400000);if(soon.type==='개인 일정'){title='예정된 개인 일정이 있어요.';text=`${soon.title} · ${soon.due}. 오늘의 일정도 여유 있게 준비해 봐요.`;}else if(days<=0){title='오늘 마감 일정이 있어요.';text=`${soon.title}을(를) 조금씩 마무리해 볼까요? 끝까지 응원할게요.`;}else if(days<=2){title='마감일이 가까워지고 있어요.';text=`${soon.title} · ${soon.due} 마감. 지금 시작하면 더 여유롭게 준비할 수 있어요.`;}else if(done.length){title='하나씩 해내고 있어요!';text=`완료한 일정 ${done.length}개. 지금의 꾸준함이 좋은 결과로 이어질 거예요.`;}}
 else if(done.length){title='오늘도 한 걸음 나아갔어요.';text=`완료한 일정 ${done.length}개. 자신만의 속도로 계속해 봐요.`;}
 $('#motivationTitle').textContent=title;$('#motivationText').textContent=text;
}
$('#dismissMotivation')?.addEventListener('click',()=>{localStorage.setItem('cf-motivation-dismissed',new Date().toISOString().slice(0,10));$('#motivationBanner').classList.add('hide');});
const baseSave=save;save=function(){state.settings??={start:9,end:19};state.settings.profile={...defaults,...(state.settings.profile||{})};baseSave();renderProfile();renderMotivation();};
renderMotivation();

// Weighted planner: respects existing classes/plans, user-allowed days and daily study cap.
function durationMinutes(item){const [sh,sm]=String(item.start||'00:00').split(':').map(Number),[eh,em]=String(item.end||'00:00').split(':').map(Number);return Math.max(0,(eh*60+em)-(sh*60+sm));}
function urgencyScore(due,start){const delta=Math.ceil((date(due)-date(start))/86400000);return delta<=1?100:delta<=3?85:delta<=7?65:delta<=14?45:25;}
function taskPriority(task,start,p){const c=course(task.course)||{},importance=((Number(c.importance)||3)/5)*100,credits=((Number(c.credits)||3)/6)*100,urgency=urgencyScore(task.due,start);let w=p.style==='focused'?[.55,.25,.20]:p.style==='deadline'?[.25,.15,.60]:[.40,.20,.40];if(!p.deadlinePriority){w[0]+=w[2]*.65;w[1]+=w[2]*.35;w[2]=0;}if(!p.prioritizeDifficulty){w[0]*=.75;w[1]+=.10;}const total=w.reduce((a,b)=>a+b,0);w=w.map(x=>x/total);return importance*w[0]+credits*w[1]+urgency*w[2];}
function timeFit(d){const h=d.getHours(),p=profile();if(p.preferredTime==='morning')return h>=9&&h<12?100:30;if(p.preferredTime==='afternoon')return h>=12&&h<17?100:35;if(p.preferredTime==='evening')return h>=17?100:25;return 70;}
function allowedDay(d){const day=d.getDay();return day!==0&&day!==6||profile().weekends;}
function planner(){const ds=$('#priorityStart').value,p=profile();if(!validDate(ds)||ds<iso(today))return toast('오늘 이후 시작일을 선택하세요.');
 const tasks=plannerUniqueTasks().filter(t=>t.due>ds&&Number(t.hours)>0).map(t=>({...t,score:taskPriority(t,ds,p)})).sort((a,b)=>b.score-a.score||a.due.localeCompare(b.due));
 if(!tasks.length)return toast('시작일 이후의 미완료 과제·시험이 없습니다.');
 const proposal=[],summary=[];const dailyUsed={};state.plans.forEach(x=>{dailyUsed[x.date]=(dailyUsed[x.date]||0)+durationMinutes(x)/60;});
 const startMin=Number(state.settings.start||9)*60,endMin=Number(state.settings.end||19)*60,step=30,block=p.includeReview?Math.min(p.sessionMinutes,60):p.sessionMinutes;
 const slotCandidates=[];let cursor=date(ds),lastDue=Math.max(...tasks.map(t=>date(t.due).getTime()));let dayCount=0;
 while(cursor.getTime()<=lastDue&&dayCount<180){if(allowedDay(cursor)){const day=iso(cursor);for(let m=startMin;m+step<=endMin;m+=step){const d=new Date(cursor);d.setHours(Math.floor(m/60),m%60,0,0);if(day===iso(today)&&m<new Date().getHours()*60+new Date().getMinutes())continue;slotCandidates.push({date:day,start:clock(m),end:clock(m+step),fit:timeFit(d),day:cursor.getDay()});}}cursor=plus(cursor,1);dayCount++;}
 const selectedSlots=new Set();
 for(const task of tasks){let remaining=Math.max(0,Number(task.hours)*60-state.plans.filter(x=>x.task===task.id).reduce((n,x)=>n+durationMinutes(x),0));let allocated=0;const taskScore=task.score;
  while(remaining>0){// Max-hours, allowed days and rest interval are hard constraints.
   let choices=slotCandidates.filter(s=>!selectedSlots.has(s.date+' '+s.start)&&date(s.date)<date(task.due));
   choices=choices.filter(s=>{const used=dailyUsed[s.date]||0;if(used+step/60>p.maxHoursPerDay)return false;const candidateStart=mins(s.start),candidateEnd=candidateStart+Math.min(block,remaining);if(candidateEnd>endMin)return false;if(busy(s.date,s.start,clock(candidateEnd)))return false;if(p.breakMinutes>0&&state.plans.some(x=>x.date===s.date&&candidateStart<mins(x.end)+p.breakMinutes&&candidateEnd+p.breakMinutes>mins(x.start)))return false;if(proposal.some(x=>x.date===s.date&&candidateStart<mins(x.end)+p.breakMinutes&&candidateEnd+p.breakMinutes>mins(x.start)))return false;return true;});
   if(!choices.length)break;
   choices.sort((a,b)=>((b.fit*.35+taskScore*.65)-(a.fit*.35+taskScore*.65))||a.date.localeCompare(b.date)||a.start.localeCompare(b.start));
   const slot=choices[0],duration=Math.min(block,remaining),end=clock(mins(slot.start)+duration);const item={id:uid(),task:task.id,title:task.title,date:slot.date,start:slot.start,end,priorityScore:Math.round(taskScore),personalized:true};proposal.push(item);selectedSlots.add(slot.date+' '+slot.start);dailyUsed[slot.date]=(dailyUsed[slot.date]||0)+duration/60;remaining-=duration;allocated+=duration;
  }
  summary.push({task,allocated,remaining,score:Math.round(taskScore)});
 }
 if(!proposal.length)return toast('맞춤 설정에 맞는 빈 시간이 없습니다. 공부 가능 시간이나 하루 최대 공부량을 조정해 주세요.');
 const profileName={balanced:'균형형',focused:'집중형',deadline:'마감 우선형'}[p.style];
 $('#priorityResult').innerHTML=`<div class="result"><h3>나에게 맞춘 학습 계획</h3><p>학습 스타일: ${profileName} · 선호 시간: ${{any:'상관없음',morning:'아침',afternoon:'오후',evening:'저녁'}[p.preferredTime]} · 1회 ${p.sessionMinutes}분 · 하루 최대 ${p.maxHoursPerDay}시간</p>${summary.map((x,i)=>`<div class="planitem"><b>${i+1}. ${escText(x.task.title)}</b><span>${escText(course(x.task.course)?.name||'개인 일정')} · 배치 점수 ${x.score}점 · 마감 ${x.task.due}</span><br>${Math.round(x.allocated/60*10)/10}시간 배치 ${x.remaining?`· ${Math.ceil(x.remaining/60)}시간 미배치`:''}</div>`).join('')}<h3 style="margin-top:18px">제안 일정</h3>${proposal.map(x=>`<div class="planitem"><b>${escText(x.date)} · ${x.start}–${x.end}</b><span>${escText(x.title)}</span></div>`).join('')}<button id="priorityApply" class="primary">계획 확정 · 시간표에 반영</button></div>`;
 $('#priorityApply').onclick=()=>{if(proposal.some(x=>busy(x.date,x.start,x.end)||!state.tasks.some(t=>t.id===x.task&&!t.done&&x.date<t.due)))return toast('일정이 변경되었습니다. 계획을 다시 생성해 주세요.');state.plans.push(...proposal);week=monday(date(proposal[0].date));save();$('#priorityResult').innerHTML='';toast('개인 맞춤 학습 계획을 저장했습니다.');};
}
$('#priorityMake').onclick=planner;
})();
