// Firebase authentication and account management for CampusFlow.
(()=>{
'use strict';
let session=null,config=null,inflightConfig=null,busy=false;
const box=document.createElement('section');
box.className='account-shell card';
box.id='cloudAccountPanel';
box.innerHTML=`
  <div class="account-brand"><span class="account-mark">C</span><div><strong>CampusFlow</strong><small>YOUR CAMPUS, IN SYNC</small></div></div>
  <section id="authLoginView" class="auth-view">
    <div class="auth-eyebrow">WELCOME BACK</div>
    <h1>다시 만나서 반가워요.</h1>
    <p class="auth-lead">로그인하고 나만의 캠퍼스 일정을 이어가세요.</p>
    <form id="authLoginForm">
      <div class="field"><label for="cloudEmail">이메일</label><input id="cloudEmail" type="email" autocomplete="username" maxlength="254" placeholder="name@example.com" required></div>
      <div class="field"><label for="cloudPassword">비밀번호</label><input id="cloudPassword" type="password" autocomplete="current-password" minlength="8" maxlength="128" placeholder="비밀번호를 입력하세요" required></div>
      <div class="auth-links"><button id="cloudResetOpen" class="text-button" type="button">비밀번호를 잊으셨나요?</button></div>
      <button id="cloudLogin" class="primary auth-submit" type="submit">로그인</button>
    </form>
    <div class="auth-switch">아직 계정이 없으신가요? <button id="cloudSignupOpen" class="text-button" type="button">회원가입</button></div>
  </section>
  <section id="authSignupView" class="auth-view hide">
    <div class="auth-eyebrow">CREATE ACCOUNT</div>
    <h1>CampusFlow 시작하기</h1>
    <p class="auth-lead">이메일 인증 후 안전하게 계정을 사용할 수 있어요.</p>
    <form id="authSignupForm">
      <div class="field"><label for="signupEmail">이메일</label><input id="signupEmail" type="email" autocomplete="email" maxlength="254" placeholder="name@example.com" required></div>
      <div class="field"><label for="signupPassword">비밀번호</label><input id="signupPassword" type="password" autocomplete="new-password" minlength="8" maxlength="128" placeholder="8자 이상 입력하세요" required></div>
      <div class="field"><label for="signupPasswordConfirm">비밀번호 확인</label><input id="signupPasswordConfirm" type="password" autocomplete="new-password" minlength="8" maxlength="128" placeholder="비밀번호를 다시 입력하세요" required></div>
      <button class="primary auth-submit" type="submit">회원가입하고 인증 메일 받기</button>
    </form>
    <p class="auth-note">가입 후 이메일로 인증 링크를 보내드립니다. 메일을 확인한 뒤 로그인해 주세요.</p>
    <div class="auth-switch">이미 계정이 있으신가요? <button id="cloudLoginOpen" class="text-button" type="button">로그인</button></div>
  </section>
  <section id="authResetView" class="auth-view hide">
    <div class="auth-eyebrow">PASSWORD RESET</div>
    <h1>비밀번호 재설정</h1>
    <p class="auth-lead">가입한 이메일을 입력하면 재설정 링크를 보내드려요.</p>
    <form id="authResetForm">
      <div class="field"><label for="resetEmail">이메일</label><input id="resetEmail" type="email" autocomplete="email" maxlength="254" placeholder="가입한 이메일" required></div>
      <button class="primary auth-submit" type="submit">재설정 이메일 보내기</button>
    </form>
    <div class="auth-switch"><button id="resetBack" class="text-button" type="button">로그인으로 돌아가기</button></div>
  </section>
  <section id="authResetCompleteView" class="auth-view hide">
    <div class="auth-eyebrow">NEW PASSWORD</div>
    <h1>새 비밀번호 설정</h1>
    <p class="auth-lead">이메일 인증 링크가 확인됐어요. 새 비밀번호를 입력해 주세요.</p>
    <form id="authResetCompleteForm">
      <div class="field"><label for="newPassword">새 비밀번호</label><input id="newPassword" type="password" autocomplete="new-password" minlength="8" maxlength="128" placeholder="8자 이상 입력하세요" required></div>
      <div class="field"><label for="newPasswordConfirm">새 비밀번호 확인</label><input id="newPasswordConfirm" type="password" autocomplete="new-password" minlength="8" maxlength="128" placeholder="한 번 더 입력하세요" required></div>
      <button class="primary auth-submit" type="submit">새 비밀번호 저장</button>
    </form>
  </section>
  <section id="authAccountView" class="auth-view hide">
    <div class="auth-eyebrow">ACCOUNT SETTINGS</div>
    <h2>계정 관리</h2>
    <p class="auth-lead">로그인된 계정과 보안 설정을 관리합니다.</p>
    <div class="account-email"><span class="account-avatar">✓</span><div><small>로그인된 계정</small><strong id="accountEmailLabel"></strong></div><span class="verified-label">인증 완료</span></div>
    <div id="accountStatus" class="auth-status" role="status" aria-live="polite">로그인 상태가 자동으로 확인되었습니다.</div>
    <div class="account-actions"><button id="cloudLogout" class="ghost" type="button">로그아웃</button><button id="cloudDelete" class="danger" type="button">계정 삭제</button></div>
    <p class="auth-note">로그아웃해도 시간표와 일정은 유지됩니다. 계정 삭제 시 클라우드 동기화 데이터와 Firebase 로그인 계정이 삭제됩니다. 현재 기기에 남은 로컬 데이터는 별도로 초기화해야 합니다.</p>
  </section>
  <p id="cloudStatus" class="auth-status" role="status" aria-live="polite"></p>
  <p class="auth-privacy"><a href="privacy.html" target="_blank" rel="noopener noreferrer">개인정보 및 데이터 처리 안내</a></p>`;
document.body.append(box);
document.body.classList.add('authLocked');

const el=id=>document.getElementById(id);
const say=t=>{const target=el('cloudStatus');target.textContent=t;target.classList.toggle('is-visible',!!t);};
const accountSay=t=>{el('accountStatus').textContent=t;};
const views=['authLoginView','authSignupView','authResetView','authResetCompleteView','authAccountView'];
function showView(id){views.forEach(v=>el(v).classList.toggle('hide',v!==id));say('');}
function showGate(view='authLoginView'){document.body.classList.add('authLocked');document.body.append(box);box.classList.add('loginGate');showView(view);}
function showAccount(){document.body.classList.remove('authLocked');box.classList.remove('loginGate');el('accountEmailLabel').textContent=session?.email||'';showView('authAccountView');const settings=document.querySelector('#settings');if(settings&&!settings.contains(box))settings.prepend(box);}
function base(){const s=String(window.CAMPUSFLOW_CONFIG?.apiBase||'').replace(/\/+$/,'');let u;try{u=new URL(s);}catch{throw new Error('app-config.js에 배포한 HTTPS 서버 주소를 입력하세요.');}if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash||u.hostname.toLowerCase().includes('your-service'))throw new Error('app-config.js의 HTTPS 서버 주소를 확인하세요. 경로 없이 입력합니다.');return u.origin;}
const errors={EMAIL_EXISTS:'이미 가입된 이메일입니다.',INVALID_LOGIN_CREDENTIALS:'이메일 또는 비밀번호를 확인하세요.',EMAIL_NOT_FOUND:'이메일 또는 비밀번호를 확인하세요.',INVALID_PASSWORD:'이메일 또는 비밀번호를 확인하세요.',INVALID_EMAIL:'올바른 이메일을 입력하세요.',USER_DISABLED:'사용 중지된 계정입니다.',TOO_MANY_ATTEMPTS_TRY_LATER:'요청이 많습니다. 잠시 후 다시 시도하세요.',OPERATION_NOT_ALLOWED:'Firebase에서 이메일/비밀번호 로그인을 켜 주세요.',TOKEN_EXPIRED:'로그인이 만료되었습니다. 다시 로그인하세요.',INVALID_ID_TOKEN:'로그인이 만료되었습니다. 다시 로그인하세요.',CREDENTIAL_TOO_OLD_LOGIN_AGAIN:'다시 로그인한 직후 시도하세요.',PROJECT_NUMBER_MISMATCH:'Firebase 프로젝트 설정을 확인하세요.',CONFIGURATION_NOT_FOUND:'Firebase Authentication 설정을 확인하세요.',API_KEY_INVALID:'서버의 Firebase 웹 API 키를 확인하세요.'};
async function jsonFetch(url,options={}){let r;try{r=await fetch(url,{...options,signal:AbortSignal.timeout(140000)});}catch{throw new Error('서버에 연결할 수 없습니다. 인터넷을 확인하고 무료 서버가 깨어나도록 약 1분 후 다시 시도하세요.');}let j;try{j=await r.json();}catch{throw new Error('서버 응답을 읽을 수 없습니다. 서버 주소와 배포 상태를 확인하세요.');}if(!r.ok){const raw=typeof j.error==='object'?j.error.message:j.error;const name=String(raw||'').split(' : ')[0];throw Object.assign(new Error(errors[name]||(name.startsWith('WEAK_PASSWORD')?'비밀번호를 더 길고 복잡하게 입력하세요.':r.status===429?(typeof j.error==='string'?j.error:'인증 요청이 너무 많습니다. 잠시 후 다시 시도하세요.'):typeof j.error==='string'?j.error:'인증 요청에 실패했습니다. Firebase 설정을 확인하세요.')),{status:r.status,code:j.code});}return j;}
async function getConfig(){if(config)return config;if(!inflightConfig)inflightConfig=jsonFetch(base()+'/api/config').then(j=>{if(!j.firebaseApiKey||!j.projectId)throw new Error('서버의 Firebase 설정이 비어 있습니다.');config=j;return j;}).finally(()=>inflightConfig=null);return inflightConfig;}
async function firebase(action,data){const c=await getConfig();return jsonFetch('https://identitytoolkit.googleapis.com/v1/accounts:'+action+'?key='+encodeURIComponent(c.firebaseApiKey),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});}
function save(j){session={idToken:j.idToken,refreshToken:j.refreshToken,email:j.email,expires:Date.now()+Number(j.expiresIn||3600)*1000};}
async function token(){if(!session)throw new Error('로그인이 필요합니다.');if(session.expires<Date.now()+60000){const c=await getConfig();try{const j=await jsonFetch('https://securetoken.googleapis.com/v1/token?key='+encodeURIComponent(c.firebaseApiKey),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:session.refreshToken})});session.idToken=j.id_token;session.refreshToken=j.refresh_token;session.expires=Date.now()+Number(j.expires_in)*1000;}catch(e){showGate();session=null;throw e;}}return session.idToken;}
async function run(fn){if(busy)return;busy=true;box.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}catch(e){say(e.message);}finally{busy=false;box.querySelectorAll('button').forEach(b=>b.disabled=false);}}
function dispatchAuth(authed){window.dispatchEvent(new CustomEvent('campusflow:auth',{detail:{authenticated:authed,email:session?.email||''}}));}
function credentials(emailId,passwordId){const email=el(emailId).value.trim(),password=el(passwordId).value;if(!email||!password)throw new Error('이메일과 비밀번호를 입력하세요.');return{email,password,returnSecureToken:true};}

el('cloudSignupOpen').onclick=()=>{el('signupEmail').value=el('cloudEmail').value;showView('authSignupView');};
el('cloudLoginOpen').onclick=()=>{el('cloudEmail').value=el('signupEmail').value;showView('authLoginView');};
el('cloudResetOpen').onclick=()=>{el('resetEmail').value=el('cloudEmail').value;showView('authResetView');};
el('resetBack').onclick=()=>showView('authLoginView');
el('authLoginForm').onsubmit=e=>{e.preventDefault();run(async()=>{const j=await firebase('signInWithPassword',credentials('cloudEmail','cloudPassword'));save(j);const info=await firebase('lookup',{idToken:await token()});if(!info.users?.[0]?.emailVerified){say('이메일 인증이 아직 완료되지 않았습니다. 받은 편지함에서 인증 링크를 눌러 주세요.');await firebase('sendOobCode',{requestType:'VERIFY_EMAIL',idToken:await token()});say('이메일 인증이 필요합니다. 인증 메일을 다시 보냈으니 메일함을 확인한 뒤 로그인해 주세요.');session=null;return;}await window.CampusCloud?.login(info.users[0].localId);showAccount();accountSay('로그인 완료 · 계정 인증이 자동으로 확인되었습니다.');dispatchAuth(true);});};
el('authSignupForm').onsubmit=e=>{e.preventDefault();run(async()=>{const c=credentials('signupEmail','signupPassword');if(c.password.length<8)throw new Error('비밀번호는 8자 이상으로 입력하세요.');if(c.password!==el('signupPasswordConfirm').value)throw new Error('비밀번호 확인이 일치하지 않습니다.');if(!confirm('이메일 계정을 생성합니다. 개인정보 및 데이터 처리 안내를 확인했나요?'))return;const j=await firebase('signUp',c);save(j);await firebase('sendOobCode',{requestType:'VERIFY_EMAIL',idToken:await token()});session=null;el('cloudEmail').value=c.email;showView('authLoginView');say('회원가입이 완료되었습니다. 이메일로 인증 링크를 보냈습니다. 이메일을 확인한 뒤 로그인해 주세요. 스팸함도 확인해 주세요.');});};
el('authResetForm').onsubmit=e=>{e.preventDefault();run(async()=>{const email=el('resetEmail').value.trim();if(!email)throw new Error('가입한 이메일을 입력하세요.');const continueUrl=location.origin+location.pathname;await firebase('sendOobCode',{requestType:'PASSWORD_RESET',email,continueUrl,canHandleCodeInApp:true});say('비밀번호 재설정 이메일을 보냈습니다. 이메일의 링크를 열고 새 비밀번호를 설정해 주세요.');});};
el('authResetCompleteForm').onsubmit=e=>{e.preventDefault();run(async()=>{const p=el('newPassword').value;if(p.length<8)throw new Error('새 비밀번호는 8자 이상이어야 합니다.');if(p!==el('newPasswordConfirm').value)throw new Error('새 비밀번호 확인이 일치하지 않습니다.');const code=new URLSearchParams(location.search).get('oobCode');if(!code)throw new Error('재설정 링크가 만료되었거나 올바르지 않습니다. 이메일을 다시 요청해 주세요.');const result=await firebase('resetPassword',{oobCode:code,newPassword:p});history.replaceState({},'',location.pathname);el('cloudEmail').value=result.email||'';showView('authLoginView');say('비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.');});};
el('cloudLogout').onclick=()=>{if(!confirm('로그아웃할까요? 저장된 시간표와 일정은 유지됩니다.'))return;window.CampusCloud?.logout();session=null;dispatchAuth(false);el('cloudPassword').value='';showGate();say('로그아웃했습니다. 다시 로그인하면 저장된 정보를 불러옵니다.');};
el('cloudDelete').onclick=()=>run(async()=>{if(!confirm('계정을 영구 삭제할까요? 이 작업은 되돌릴 수 없습니다. 클라우드에 동기화된 CampusFlow 데이터도 함께 삭제됩니다. 현재 기기의 브라우저에 남아 있는 로컬 데이터는 별도로 초기화해야 합니다.'))return;await window.CampusCloud?.deleteData();await firebase('delete',{idToken:await token()});window.CampusCloud?.logout();session=null;dispatchAuth(false);showGate();say('계정이 삭제되었습니다. 시간표와 일정 데이터는 계정과 별도로 관리됩니다.');});
window.CampusAuth=Object.freeze({idToken:token,projectId:async()=>(await getConfig()).projectId,request:async(endpoint,body)=>{if(!['models','analyze','ask'].includes(endpoint))throw new Error('지원하지 않는 요청입니다.');const idToken=await token();try{return await jsonFetch(base()+'/api/'+endpoint,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+idToken,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});}catch(e){if(e.status===401){showGate();session=null;dispatchAuth(false);say('로그인이 만료되었습니다. 다시 로그인하세요.');}throw e;}}});
const params=new URLSearchParams(location.search);
if(params.get('mode')==='resetPassword'&&params.get('oobCode')){showGate('authResetCompleteView');}
else{showGate('authLoginView');}
})();