import {initializeApp} from 'firebase/app';
import {getAuth,GoogleAuthProvider,signInWithPopup,signInWithRedirect,getRedirectResult,onAuthStateChanged,signOut} from 'firebase/auth';
import {getFirestore,doc,setDoc,getDoc,getDocs,collection,query,orderBy,limit,deleteDoc} from 'firebase/firestore';
import {initializeAppCheck,ReCaptchaEnterpriseProvider,getToken} from 'firebase/app-check';
import {getAI,getGenerativeModel,GoogleAIBackend} from 'firebase/ai';
import {firebaseConfig,recaptchaSiteKey,geminiModel} from './config.js';
const $=s=>document.querySelector(s);
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
const appCheck=(recaptchaSiteKey && !recaptchaSiteKey.startsWith('REPLACE_')) ? initializeAppCheck(app,{provider:new ReCaptchaEnterpriseProvider(recaptchaSiteKey),isTokenAutoRefreshEnabled:true}) : null;
const model=getGenerativeModel(getAI(app,{backend:new GoogleAIBackend()}),{model:geminiModel||'gemini-3.1-flash-lite'});
const pad=n=>String(n).padStart(2,'0');
const localDate=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
const fmt=n=>Number.isFinite(n)?n.toLocaleString('ko-KR'): '—';
const numberOrNull=v=>v===''?null:Number(v);
const text=(s)=>String(s??'');
let uid=null,profile={},days={},currentDate=localDate();
const emptyDay=date=>({date,weight:null,waist:null,steps:null,water:null,mood:'',notes:'',exercises:[],meals:[]});
const dayPath=date=>doc(db,'users',uid,'days',date);
const pPath=()=>doc(db,'users',uid);
const status=(id,msg,error=false)=>{const e=$(id);e.textContent=msg;e.classList.toggle('error',error)};
const safeErr=e=>e?.code==='permission-denied'?'저장 권한이 없습니다. Firestore 보안 규칙을 확인하세요.':e?.message||'알 수 없는 오류';
const day=()=>days[currentDate]||(days[currentDate]=emptyDay(currentDate));
async function saveDay(){const d=day();await setDoc(dayPath(currentDate),{...d,updatedAt:new Date().toISOString()});render();}
function setTodayInputs(){const d=day();for(const id of ['weight','waist','steps','water','mood','notes'])$(`#${id}`).value=d[id]??'';renderLists();}
function escapeHTML(s){return text(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function renderLists(){const d=day();$('#exercise-list').innerHTML=d.exercises.length?d.exercises.map((x,i)=>`<div class="entry"><span>${escapeHTML(x.type)} · ${x.minutes}분 ${x.distance?`· ${x.distance}km`:''} · ${escapeHTML(x.effort)}</span><button class="outline" data-del-ex="${i}">삭제</button></div>`).join(''):'<p class="muted small">운동 기록이 없습니다.</p>';
$('#meal-list').innerHTML=d.meals.length?d.meals.map((m,i)=>`<div class="entry"><span>${escapeHTML(m.slot)} · ${escapeHTML(m.headline)} · 약 ${fmt(Number(m.total?.kcal||0))}kcal</span><button class="outline" data-del-meal="${i}">삭제</button></div>`).join(''):'<p class="muted small">음식 기록이 없습니다.</p>';
}
// 성인 기준 Mifflin-St Jeor 기반 참고용 추정치. 의료적 처방이 아닙니다.
function calorieEstimate(){
  const height=Number($('#height').value),age=Number($('#age').value);
  const weight=Number($('#profile-weight').value),activity=Number($('#activity').value)||1.2;
  if(!(height>=90&&height<=250&&age>=18&&age<=120&&weight>=25&&weight<=350))return null;
  const base=10*weight+6.25*height-5*age;
  const sex=$('#sex').value;
  const bmr=base+(sex==='male'?5:sex==='female'?-161:-78);
  const goal=$('#goal').value;
  const adjustment=goal==='체중 감량'?-300:goal==='근육 강화'?200:0;
  return Math.round(Math.max(1200,Math.min(4500,bmr*activity+adjustment))/50)*50;
}
function chosenCalorieTarget(){
  const manual=Number(profile.manualCalorieTarget);
  if(manual>=1000&&manual<=5000)return manual;
  return Number(profile.calorieTarget)||null;
}
function updateTargetPreview(){
  const estimate=calorieEstimate();const manual=Number($('#manual-calorie-target').value);
  const target=manual>=1000&&manual<=5000?manual:estimate;
  $('#target-preview-value').textContent=target?`${fmt(target)} kcal/일`:'계산 정보 부족';
  $('#target-preview-description').textContent=Number($('#age').value)>0&&Number($('#age').value)<18?'18세 미만은 자동 권장량을 제공하지 않습니다. 전문가와 상담하세요.':estimate?'기초대사량×활동계수에 목표 조정치를 반영한 추정치이며 언제든 수정할 수 있습니다.':'나이(18세 이상), 키, 현재 체중을 입력해 주세요.';
}
function renderNutrition(){
 const target=chosenCalorieTarget(),meals=day().meals||[];
 const sum=k=>meals.reduce((total,m)=>total+(Number(m.total?.[k])||0),0);
 const kcal=Math.max(0,sum('kcal')),remaining=target?Math.round(target-kcal):null;
 const pct=target?Math.min(100,Math.max(0,kcal/target*100)):0;
 $('#calorie-ring').style.setProperty('--progress',`${pct}%`);
 $('#calorie-left').textContent=remaining===null?'—':fmt(Math.abs(remaining));
 $('#calorie-label').textContent=remaining===null?'목표 미설정':remaining<0?'kcal 초과':'kcal 남음';
 $('#calorie-target-text').textContent=target?`하루 목표 ${fmt(target)} kcal (${profile.manualCalorieTarget?'직접 설정':'자동 계산'})`:'내 정보에서 나이·키·체중·활동량을 입력하세요.';
 $('#calorie-intake-text').textContent=`선택한 날짜 섭취량: 약 ${fmt(Math.round(kcal))} kcal`;
 const macroTarget=target?{protein:target*.25/4,carb:target*.5/4,fat:target*.25/9}:null;
 $('#macro-bars').innerHTML=[['protein','단백질','g'],['carb','탄수화물','g'],['fat','지방','g']].map(([key,label,unit])=>{
 const value=sum(key),max=macroTarget?.[key],ratio=max?Math.min(100,value/max*100):0;
 return `<div class="macro-row"><span>${label}</span><div class="macro-track"><div style="width:${ratio}%"></div></div><b>${fmt(Math.round(value))}${unit}${max?' / '+fmt(Math.round(max))+unit:''}</b></div>`;
 }).join('');
}
function render(){const ds=Object.values(days).sort((a,b)=>a.date.localeCompare(b.date)),latest=[...ds].reverse();const lastWeight=latest.find(x=>x.weight!=null)?.weight,lastWaist=latest.find(x=>x.waist!=null)?.waist;
$('#stat-weight').textContent=lastWeight!=null?`${lastWeight} kg`:'—';$('#stat-waist').textContent=lastWaist!=null?`${lastWaist} cm`:'—';const weekAgo=new Date();weekAgo.setDate(weekAgo.getDate()-6);const start=`${weekAgo.getFullYear()}-${pad(weekAgo.getMonth()+1)}-${pad(weekAgo.getDate())}`;$('#stat-exercise').textContent=`${ds.filter(x=>x.date>=start&&x.exercises?.length).length}일`;
$('#history-list').innerHTML=latest.slice(0,30).map(x=>`<div class="entry"><span>${x.date} · 체중 ${x.weight??'—'}kg · 허리 ${x.waist??'—'}cm</span><small>운동 ${x.exercises?.length||0}건</small></div>`).join('')||'<p class="muted">기록이 아직 없습니다.</p>';drawChart(latest.slice(0,30).reverse());renderLists();renderNutrition();}
function drawChart(list){const el=$('#history-chart'),series=list.filter(x=>Number.isFinite(x.weight));if(!series.length){el.innerHTML='<p class="muted">체중 데이터를 기록하면 추이가 나타납니다.</p>';return;}const vals=series.map(x=>x.weight),lo=Math.min(...vals)-1,hi=Math.max(...vals)+1;const pts=series.map((x,i)=>`${35+(i/Math.max(series.length-1,1))*570},${170-(x.weight-lo)/(hi-lo)*135}`).join(' ');el.innerHTML=`<svg viewBox="0 0 640 205" role="img" aria-label="체중 추이 그래프"><line x1="35" y1="170" x2="605" y2="170" stroke="#bdcfc2"/><polyline fill="none" stroke="#0e5e46" stroke-width="3" points="${pts}"/>${series.map((x,i)=>`<circle cx="${35+(i/Math.max(series.length-1,1))*570}" cy="${170-(x.weight-lo)/(hi-lo)*135}" r="3.5" fill="#0e5e46"/>`).join('')}<text x="35" y="195" font-size="11" fill="#65756b">${series[0].date}</text><text x="600" y="195" text-anchor="end" font-size="11" fill="#65756b">${series.at(-1).date}</text></svg>`;}
async function loadUser(u){uid=u.uid;$('#login').hidden=true;$('#app').hidden=false;$('#logout').hidden=false;$('#user-name').textContent=u.displayName||u.email||'사용자';days={};const p=await getDoc(pPath());profile=p.exists()?p.data():{};for(const [id,key] of [['height','height'],['age','age'],['goal','goal'],['target-days','targetDays'],['profile-weight','weight'],['sex','sex'],['activity','activity'],['target-weight','targetWeight'],['manual-calorie-target','manualCalorieTarget']])if(profile[key]!=null)$(`#${id}`).value=profile[key];const snapshot=await getDocs(query(collection(db,'users',uid,'days'),orderBy('date','desc'),limit(180)));snapshot.forEach(d=>days[d.id]=d.data());$('#date').value=currentDate;setTodayInputs();updateTargetPreview();render();}
onAuthStateChanged(auth,async u=>{if(!u){uid=null;profile={};days={};$('#login').hidden=false;$('#app').hidden=true;$('#logout').hidden=true;return;}try{await loadUser(u)}catch(e){status('#auth-error',`데이터 연결 실패: ${safeErr(e)}`,true);$('#app').hidden=true;$('#login').hidden=false;$('#logout').hidden=false;}});
$('#sign-in').onclick=async()=>{status('#auth-error','');try{await signInWithPopup(auth,new GoogleAuthProvider());}catch(e){if(e.code==='auth/popup-blocked')await signInWithRedirect(auth,new GoogleAuthProvider());else status('#auth-error',safeErr(e),true);}};
getRedirectResult(auth).catch(e=>status('#auth-error',safeErr(e),true));
$('#logout').onclick=()=>signOut(auth);
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.panel').forEach(p=>p.hidden=p.id!==`tab-${b.dataset.tab}`)}));
$('#date').onchange=e=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(e.target.value))return;currentDate=e.target.value;setTodayInputs();status('#daily-status','');};
$('#save-day').onclick=async()=>{if(!uid)return;const d=day();for(const id of ['weight','waist','steps','water']){const v=numberOrNull($(`#${id}`).value);if(v!=null&&(!Number.isFinite(v)||v<0)){status('#daily-status','숫자 입력을 확인하세요.',true);return;}d[id]=v;}d.mood=$('#mood').value;d.notes=$('#notes').value.trim();try{await saveDay();status('#daily-status','클라우드에 저장했습니다.')}catch(e){status('#daily-status',safeErr(e),true)}};
$('#add-exercise').onclick=async()=>{const minutes=Number($('#exercise-minutes').value),distance=numberOrNull($('#exercise-distance').value);if(!Number.isFinite(minutes)||minutes<1||minutes>1440||distance!=null&&(!Number.isFinite(distance)||distance<0)){status('#exercise-status','운동 시간과 거리를 확인하세요.',true);return;}day().exercises.push({id:crypto.randomUUID(),type:$('#exercise-type').value,minutes,distance,effort:$('#exercise-effort').value});try{await saveDay();status('#exercise-status','운동을 저장했습니다.');$('#exercise-minutes').value='';$('#exercise-distance').value='';}catch(e){status('#exercise-status',safeErr(e),true)}};
$('#exercise-list').onclick=async e=>{const b=e.target.closest('[data-del-ex]');if(!b)return;day().exercises.splice(Number(b.dataset.delEx),1);try{await saveDay()}catch(err){status('#exercise-status',safeErr(err),true)}};
$('#meal-list').onclick=async e=>{const b=e.target.closest('[data-del-meal]');if(!b)return;day().meals.splice(Number(b.dataset.delMeal),1);try{await saveDay()}catch(err){status('#ai-status',safeErr(err),true)}};
$('#save-profile').onclick=async()=>{const height=numberOrNull($('#height').value),age=numberOrNull($('#age').value);if(height!=null&&(height<90||height>250)||age!=null&&(age<13||age>120)){status('#profile-status','키 또는 나이 입력을 확인하세요.',true);return;}const weight=numberOrNull($('#profile-weight').value),targetWeight=numberOrNull($('#target-weight').value),manualCalorieTarget=numberOrNull($('#manual-calorie-target').value);
if(weight!=null&&(weight<25||weight>350)||targetWeight!=null&&(targetWeight<25||targetWeight>350)||manualCalorieTarget!=null&&(manualCalorieTarget<1000||manualCalorieTarget>5000)){status('#profile-status','체중 또는 칼로리 입력 범위를 확인하세요.',true);return;}
if(age!=null&&age<18){status('#profile-status','현재 자동 칼로리 계산은 18세 이상만 지원합니다.',true);return;}
const estimate=calorieEstimate();profile={height,age,weight,sex:$('#sex').value,activity:Number($('#activity').value),targetWeight,manualCalorieTarget,calorieTarget:estimate,goal:$('#goal').value,targetDays:Number($('#target-days').value)};try{await setDoc(pPath(),profile,{merge:true});render();status('#profile-status','프로필과 칼로리 목표를 저장했습니다.')}catch(e){status('#profile-status',safeErr(e),true)}};
$('#meal-image').onchange=e=>{const file=e.target.files?.[0],img=$('#meal-preview');if(!file){img.hidden=true;return;}img.src=URL.createObjectURL(file);img.hidden=false;};
function parseJson(txt){const s=txt.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();return JSON.parse(s)}
async function imagePart(file){if(file.size>5*1024*1024)throw Error('이미지 크기는 5MB 이하로 해주세요.');if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('JPG, PNG, WEBP만 지원합니다.');const b64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]);r.onerror=rej;r.readAsDataURL(file)});return {inlineData:{mimeType:file.type,data:b64}};}
$('#analyze').onclick=async()=>{const file=$('#meal-image').files?.[0],memo=$('#meal-description').value.trim();if(!file&&!memo){status('#ai-status','사진 또는 음식 설명을 입력하세요.',true);return;}const btn=$('#analyze');btn.disabled=true;status('#ai-status',`인증 확인 후 Gemini 분석 중… (모델: ${geminiModel||'gemini-3.1-flash-lite'})`);$('#ai-result').innerHTML='';try{
const prompt=`당신은 한국어로 답하는 일반 영양정보 도우미입니다. 제공된 설명/사진에서 음식 종류와 양 및 대략적인 영양소를 추정하되 정확하다고 주장하지 마세요. 건강 진단이나 단정적인 의학 조언을 하지 마세요. 목표: ${profile.goal||'건강 습관 유지'}. 음식 설명: ${memo||'사진 참조'}. 반드시 JSON 객체 한 개만 출력하세요. 형식 {"foods":[{"name":"음식명","amount":"추정량","kcal":123,"protein":12,"carb":12,"fat":4}],"total":{"kcal":123,"protein":12,"carb":12,"fat":4},"headline":"한 줄 요약","advice":["권장 행동1","권장 행동2"]}. 수치는 숫자이며 불확실하면 추정값으로.`;
if(!appCheck) throw new Error('App Check 사이트 키가 비어 있습니다. src/config.js의 recaptchaSiteKey를 확인하세요.');
let check;
try { check=await getToken(appCheck, true); }
catch(tokenError) { throw new Error('App Check 토큰 발급 실패 ('+(tokenError?.code||'unknown')+'): '+(tokenError?.message||'사이트 키·등록 도메인을 확인하세요.')); }
if(!check?.token) throw new Error('App Check 토큰을 발급받지 못했습니다. 등록 도메인과 사이트 키를 확인하세요.');
const parts=[prompt];if(file)parts.push(await imagePart(file));const result=await model.generateContent(parts);const parsed=parseJson(result.response.text());if(!parsed.total||!Array.isArray(parsed.foods))throw Error('AI 응답을 이해할 수 없습니다. 다시 시도하세요.');const meal={id:crypto.randomUUID(),slot:$('#meal-slot').value,description:memo,headline:text(parsed.headline).slice(0,200),foods:parsed.foods.slice(0,15).map(f=>({name:text(f.name).slice(0,100),amount:text(f.amount).slice(0,100),kcal:Number(f.kcal)||0,protein:Number(f.protein)||0,carb:Number(f.carb)||0,fat:Number(f.fat)||0})),total:Object.fromEntries(['kcal','protein','carb','fat'].map(k=>[k,Number(parsed.total[k])||0])),advice:Array.isArray(parsed.advice)?parsed.advice.slice(0,4).map(text):[]};day().meals.push(meal);await saveDay();$('#ai-result').innerHTML=`<div class="result"><b>${escapeHTML(meal.headline)}</b><p>약 ${fmt(meal.total.kcal)} kcal · 단백질 ${fmt(meal.total.protein)}g</p><ul>${meal.foods.map(f=>`<li>${escapeHTML(f.name)} (${escapeHTML(f.amount)}) 약 ${fmt(f.kcal)}kcal</li>`).join('')}</ul><ul>${meal.advice.map(a=>`<li>${escapeHTML(a)}</li>`).join('')}</ul><p class="small muted">AI 추정치이며 의료적 판단 근거가 아닙니다.</p></div>`;status('#ai-status','분석 결과가 저장되었습니다.');
}catch(e){status('#ai-status',`분석 실패: ${safeErr(e)}. Firebase AI Logic / App Check / 모델 설정을 확인하세요.`,true)}finally{btn.disabled=false}};
$('#export-csv').onclick=()=>{const rows=[['날짜','체중(kg)','허리(cm)','걸음','물(잔)','운동(건)','운동(분)','메모'],...Object.values(days).sort((a,b)=>a.date.localeCompare(b.date)).map(d=>[d.date,d.weight??'',d.waist??'',d.steps??'',d.water??'',d.exercises?.length||0,(d.exercises||[]).reduce((s,e)=>s+Number(e.minutes||0),0),d.notes||''])];const csv='\ufeff'+rows.map(r=>r.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='health-records.csv';a.click();URL.revokeObjectURL(url)};
$('#delete-data').onclick=async()=>{if(!uid||!confirm('모든 건강 기록과 프로필을 삭제합니다. 계속하시겠습니까?'))return;const typed=prompt('최종 확인: 삭제를 입력하세요');if(typed!=='삭제')return;try{const records=await getDocs(collection(db,'users',uid,'days'));for(const record of records.docs)await deleteDoc(record.ref);await deleteDoc(pPath());days={};profile={};setTodayInputs();render();status('#profile-status','Firestore 건강 데이터가 삭제되었습니다. (로그인 계정은 유지됩니다.)')}catch(e){status('#profile-status',safeErr(e),true)}};

for(const id of ['height','age','profile-weight','sex','activity','goal','manual-calorie-target'])$('#'+id).addEventListener('input',updateTargetPreview);
