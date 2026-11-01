import {createHmac} from 'node:crypto';
export function apiError(status,message,code){return Object.assign(new Error(message),{status,code});}
export const quotaLua=`
for i=1,#KEYS do
 if tonumber(redis.call('GET',KEYS[i]) or '0') >= tonumber(ARGV[i*2-1]) then return i end
end
for i=1,#KEYS do
 local n=redis.call('INCR',KEYS[i])
 if n==1 then redis.call('EXPIRE',KEYS[i],ARGV[i*2]) end
end
return 0`;
export function createSecurity(cfg,remote=fetch){
 const required=['FIREBASE_WEB_API_KEY','FIREBASE_PROJECT_ID','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','RATE_LIMIT_SALT'];
 for(const k of required)if(!cfg(k))throw new Error('필수 서버 환경변수 누락: '+k);
 if(cfg('RATE_LIMIT_SALT').length<32)throw new Error('RATE_LIMIT_SALT는 임의의 32자 이상 문자열이어야 합니다.');
 if(!/^https:\/\/[^/]+\.upstash\.io\/?$/.test(cfg('UPSTASH_REDIS_REST_URL')))throw new Error('올바른 Upstash HTTPS REST URL을 설정하세요.');
 const hash=s=>createHmac('sha256',cfg('RATE_LIMIT_SALT')).update(s).digest('hex').slice(0,40);
 const positive=(name,fallback)=>{const raw=cfg(name);const n=raw?Number(raw):fallback;if(!Number.isSafeInteger(n)||n<1||n>100000)throw new Error('잘못된 제한 설정: '+name);return n;};
 const limits={userDay:positive('USER_DAILY_LIMIT',5),globalDay:positive('GLOBAL_DAILY_LIMIT',50),userMinute:positive('USER_MINUTE_LIMIT',1),globalMinute:positive('GLOBAL_MINUTE_LIMIT',5),ipHour:positive('IP_HOURLY_LIMIT',120)};
 async function redis(command){
  let r,j;try{r=await remote(cfg('UPSTASH_REDIS_REST_URL'),{method:'POST',headers:{Authorization:'Bearer '+cfg('UPSTASH_REDIS_REST_TOKEN'),'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(10000)});j=await r.json();}catch{throw apiError(503,'호출량 제한 서비스를 확인할 수 없어 AI 요청을 차단했습니다. 잠시 후 다시 시도하세요.','QUOTA_UNAVAILABLE');}
  if(!r.ok||j.error)throw apiError(503,'호출량 제한 서비스의 무료 한도 또는 연결 상태를 확인해 주세요.','QUOTA_UNAVAILABLE');return j.result;
 }
 async function ingress(ip){
  const hour=Math.floor(Date.now()/3600000);
  const n=await redis(['EVAL',quotaLua,'1',`cf:ip:${hour}:${hash(ip)}`,String(limits.ipHour),'7200']);
  if(typeof n!=='number'||!Number.isInteger(n))throw apiError(503,'호출 한도를 확인할 수 없어 요청을 차단했습니다.','QUOTA_UNAVAILABLE');
  if(n!==0)throw apiError(429,'이 네트워크의 요청이 너무 많습니다. 다음 시간대에 다시 시도하세요.','IP_LIMIT');
 }
 async function authenticate(header){
  const token=/^Bearer ([A-Za-z0-9._-]{20,6000})$/.exec(header||'')?.[1];if(!token)throw apiError(401,'이메일 계정으로 로그인하세요.','AUTH_REQUIRED');
  let r,j;try{r=await remote('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+encodeURIComponent(cfg('FIREBASE_WEB_API_KEY')),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token}),signal:AbortSignal.timeout(10000)});j=await r.json();}catch{throw apiError(503,'로그인 인증 서버에 연결할 수 없습니다.');}
  if(r.status===429||r.status>=500)throw apiError(503,'인증 서비스가 혼잡하거나 무료 한도에 도달했습니다.');
  if(!r.ok||!j.users?.[0]||j.users[0].disabled)throw apiError(401,'로그인이 만료되었거나 사용할 수 없는 계정입니다. 다시 로그인하세요.','AUTH_REQUIRED');
  // accounts:lookup validates the ID token with Firebase, including expiry. Bind project as an extra check.
  let claims;try{claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());}catch{throw apiError(401,'로그인 토큰 형식이 올바르지 않습니다.');}
  if(claims.aud!==cfg('FIREBASE_PROJECT_ID')||claims.iss!=='https://securetoken.google.com/'+cfg('FIREBASE_PROJECT_ID')||!Number.isFinite(claims.exp)||claims.exp*1000<=Date.now())throw apiError(401,'다른 프로젝트 또는 만료된 로그인입니다.');
  const user=j.users[0];if(!user.emailVerified)throw apiError(403,'이메일 인증 후 다시 로그인하세요.','EMAIL_UNVERIFIED');
  if(claims.sub!==user.localId)throw apiError(401,'인증 정보가 일치하지 않습니다.');return user.localId;
 }
 async function reserve(uid){
  const now=Date.now(),day=new Date(now).toISOString().slice(0,10),minute=Math.floor(now/60000),u=hash(uid);
  const keys=[`cf:global:day:${day}`,`cf:user:day:${day}:${u}`,`cf:global:minute:${minute}`,`cf:user:minute:${minute}:${u}`];
  const n=await redis(['EVAL',quotaLua,'4',...keys,String(limits.globalDay),'172800',String(limits.userDay),'172800',String(limits.globalMinute),'120',String(limits.userMinute),'120']);
  if(typeof n!=='number'||!Number.isInteger(n))throw apiError(503,'호출 한도를 확인할 수 없어 요청을 차단했습니다.','QUOTA_UNAVAILABLE');
  if(n===1)throw apiError(429,'오늘 서비스 전체 AI 사용 한도에 도달했습니다. UTC 자정(한국 오전 9시) 이후 다시 이용하세요.','GLOBAL_LIMIT');
  if(n===2)throw apiError(429,'오늘 계정별 AI 사용 한도에 도달했습니다. UTC 자정(한국 오전 9시) 이후 다시 이용하세요.','USER_LIMIT');
  if(n===3||n===4)throw apiError(429,'분당 요청 한도에 도달했습니다. 1분 뒤 다시 시도하세요.','MINUTE_LIMIT');
  if(n!==0)throw apiError(503,'호출 한도를 확인할 수 없어 요청을 차단했습니다.');
 }
 return{authenticate,ingress,reserve,limits};
}
