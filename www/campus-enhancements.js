'use strict';
// Non-destructive view-level deduplication: do not erase imported or cloud-synced records.
(()=>{
 const normalize=s=>String(s||'').replace(/\s+/g,'').toLowerCase();
 const oldSessions=sessions;
 sessions=function(d){const seen=new Set();return oldSessions(d).filter(s=>{const k=[normalize(s.course.name),s.start,s.end,s.type,s.cancelled].join('|');if(seen.has(k))return false;seen.add(k);return true})};
 const oldSchedule=renderSchedule;
 renderSchedule=function(){oldSchedule();const g=$('#grid');if(!g)return;const events=[...g.querySelectorAll('button.event')];
  // Combine overlapping blocks into one selectable stack, instead of overprinting labels.
  for(let day=0;day<5;day++){
   const items=events.filter(e=>{const m=/calc\((\d+)%/.exec(e.style.left);return m&&Number(m[1])===day*20}).map(e=>({el:e,start:parseFloat(e.style.top),end:parseFloat(e.style.top)+parseFloat(e.style.height)})).sort((a,b)=>a.start-b.start);
   let groups=[],group=[],end=-Infinity;
   for(const item of items){if(group.length&&item.start>=end){groups.push(group);group=[];end=-Infinity}group.push(item);end=Math.max(end,item.end)}if(group.length)groups.push(group);
   for(const group of groups.filter(a=>a.length>1)){
    const first=group[0],start=Math.min(...group.map(x=>x.start)),finish=Math.max(...group.map(x=>x.end));
    const button=document.createElement('button');button.type='button';button.className='event cf-overlap';button.style.cssText=`left:calc(${day*20}% + 3px);width:calc(20% - 6px);top:${start}px;height:${Math.max(25,finish-start)}px;background:#e6eefc;color:#244a89;border-color:#7498df;z-index:5`;
    button.innerHTML=`<strong>일정 ${group.length}개 겹침</strong><span>눌러서 각각 확인</span>`;
    const entries=group.map(x=>({title:x.el.querySelector('strong')?.textContent||'일정',detail:x.el.textContent,open:x.el.onclick}));
    button.onclick=()=>{modal('겹치는 일정',`<p>같은 시간대에 ${entries.length}개 일정이 있습니다. 항목을 선택하면 상세 정보를 확인할 수 있어요.</p><div id="cfOverlapItems"></div>`);const list=$('#cfOverlapItems');entries.forEach((entry,i)=>{const b=document.createElement('button');b.type='button';b.className='ghost';b.style.cssText='display:block;width:100%;text-align:left;margin:8px 0;white-space:normal';b.textContent=entry.detail;b.onclick=()=>entry.open?.();list.appendChild(b)})};
    group.forEach(x=>x.el.remove());g.appendChild(button);
   }
  }
 };
 // Keep the regular task form reachable from the planner and the tasks page.
 const taskButton=document.createElement('button');taskButton.type='button';taskButton.className='ghost';taskButton.textContent='＋ 과제·시험 등록';taskButton.style.margin='10px 0';taskButton.onclick=()=>taskForm();
 $('#planTask')?.closest('.field')?.before(taskButton);
 const priorityButton=document.createElement('button');priorityButton.type='button';priorityButton.className='ghost';priorityButton.textContent='＋ 과제·시험 등록하기';priorityButton.style.margin='12px 0';priorityButton.onclick=()=>taskForm();$('#priorityRows')?.before(priorityButton);
 render();
})();
