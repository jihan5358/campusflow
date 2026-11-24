// Firestore REST sync; user identity comes from a verified Firebase ID token.
// Requires the Firestore rules shipped in firestore.rules.
(()=>{
'use strict';
let uid=null,revision=null,dirty=false,writing=false,timer=null,loading=false,conflict=false;
const localKey='campusflow-demo-v2';
const status=document.createElement('div');status.id='cloudSyncStatus';status.className='note';status.textContent='로그인하면 계정별 클라우드 저장을 확인합니다.';
const panel=document.getElementById('cloudAccountPanel');panel?.append(status);
const note=t=>{status.textContent='☁ '+t};
function url(project,user){return 'https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(project)+'/databases/(default)/documents/campusflowUsers/'+encodeURIComponent(user)}
async function request(method,body,precondition){
 const project=await window.CampusAuth.projectId(),token=await window.CampusAuth.idToken();
 const u=new URL(url(project,uid));if(precondition)u.searchParams.set('currentDocument.updateTime',precondition);else if(method==='PATCH')u.searchParams.set('currentDocument.exists','false');
 const res=await fetch(u.toString(),{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 if(res.status===404)return null;
 const j=await res.json().catch(()=>({}));if(!res.ok){const err=new Error(j.error?.message||'클라우드 저장 실패 ('+res.status+')');err.status=res.status;throw err}return j;
}
const docState=d=>{try{return JSON.parse(d.fields.payload.stringValue)}catch{throw new Error('클라우드 데이터 형식이 올바르지 않습니다.')}};
function backup(){try{const current=localStorage.getItem(localKey);if(current)localStorage.setItem('campusflow-backup-'+Date.now(),current)}catch{}}
async function login(user){
 if(!/^[a-zA-Z0-9_-]{1,128}$/.test(user||''))throw new Error('사용자 식별자를 확인할 수 없습니다.');
 if(uid&&uid!==user){logout();}
 uid=user;conflict=false;loading=true;note('계정 데이터 불러오는 중…');
 try{
  const doc=await request('GET');
  if(doc){backup();window.CampusFlowState.set(docState(doc));revision=doc.updateTime;dirty=false;note('동기화 완료 · 다른 기기에서도 동일한 데이터 사용');}
  else {
   const previous=localStorage.getItem('campusflow-last-uid');
   const hasLocal=window.CampusFlowState.hasData();
   if(hasLocal&&previous&&previous!==user){backup();window.CampusFlowState.set({courses:[],tasks:[],plans:[],changes:[],settings:{start:9,end:19}})}
   else if(hasLocal&&!previous&&!confirm('이 브라우저의 기존 시간표를 지금 로그인한 계정에 처음 업로드할까요?\n취소하면 로컬 데이터를 백업하고 빈 계정으로 시작합니다.')){backup();window.CampusFlowState.set({courses:[],tasks:[],plans:[],changes:[],settings:{start:9,end:19}})}
   revision=null;dirty=true;loading=false;await flush();note('새 계정 데이터 생성 및 저장 완료');
  }
  localStorage.setItem('campusflow-last-uid',user);
 }catch(e){uid=null;note('동기화 실패: '+e.message+' · 로그인하지 않았습니다.');throw new Error('클라우드 동기화 실패: '+e.message+' (Firestore 활성화 및 보안 규칙을 확인하세요.)')}
 finally{loading=false}
}
function queueSave(){if(!uid||loading)return;dirty=true;note('변경사항 저장 대기…');clearTimeout(timer);timer=setTimeout(()=>{timer=null;flush().catch(e=>note('저장 실패: '+e.message))},850)}
async function flush(){if(!uid||loading||writing||!dirty)return;writing=true;dirty=false;
 try{
  const snapshot=window.CampusFlowState.get();const payload=JSON.stringify(snapshot);
  if(payload.length>900000)throw new Error('동기화 데이터가 900KB를 초과했습니다.');
  const body={fields:{payload:{stringValue:payload},updatedAt:{timestampValue:new Date().toISOString()}}};
  const result=await request('PATCH',body,revision);revision=result.updateTime;note('클라우드 저장 완료');
 }catch(e){dirty=true;if(e.status===400||e.status===409||e.status===412){conflict=true;note('다른 기기에서 먼저 변경했습니다. 새로고침하여 최신 데이터를 확인하세요.');}else note('저장 실패: '+e.message);throw e}
 finally{writing=false;if(dirty&&uid&&revision&&!timer&&!(typeof conflict==='boolean'&&conflict)){timer=setTimeout(()=>{timer=null;flush().catch(()=>{})},3000)}}
}
async function deleteData(){if(!uid)return;clearTimeout(timer);timer=null;if(dirty)await flush();await request('DELETE');uid=null;revision=null;dirty=false;loading=false;conflict=false;note('클라우드 계정 데이터 삭제 완료')}
function logout(){clearTimeout(timer);timer=null;uid=null;revision=null;dirty=false;loading=false;conflict=false;note('로그아웃 · 계정 동기화 중지')}
window.CampusCloud=Object.freeze({login,logout,deleteData,queueSave});
})();
