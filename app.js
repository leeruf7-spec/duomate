import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, signOut, reload } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy,
  onSnapshot, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, ALLOWED_DOMAINS, ADMIN_EMAILS, BANK, ADMIN_PIN_SHA256, CREDIT, FEE_WON, OPS_RATE, PRIZE_BASE, PRIZE_MAX } from "./firebase-config.js";
import { SPR } from "./sprites.js";

const fb = initializeApp(firebaseConfig);
const auth = getAuth(fb);
auth.languageCode = "ko";
const db = getFirestore(fb);

/* ================= constants ================= */
const ANIMALS={panda:"판다",rabbit:"토끼",elephant:"코끼리",lion:"사자",monkey:"원숭이",sheep:"양",tiger:"호랑이",pig:"돼지",giraffe:"기린",chick:"병아리"};
const FEE=0.08; // 운영 수수료 8% (10% 미만)
const CNU={midS:"2026-10-19",midE:"2026-10-23",finS:"2026-12-15",finE:"2026-12-21"};
const CNU_EVENTS=[
  ["2026-09-01","2026-09-01","2학기 개강"],["2026-10-19","2026-10-23","중간고사"],
  ["2026-12-08","2026-12-08","자체 보강일"],["2026-12-09","2026-12-09","보강 (개천절 대체휴일)"],
  ["2026-12-10","2026-12-11","보강 (추석 연휴)"],["2026-12-14","2026-12-14","보강 (한글날)"],
  ["2026-12-15","2026-12-21","기말고사"],["2026-12-21","2026-12-21","2학기 종강"],["2026-12-28","2027-01-22","동계 계절학기"]
];
const OPT={
  campus:["광주캠퍼스","여수캠퍼스"], year:["1학년","2학년","3학년","4학년","5학년 이상","대학원"],
  exam:["중간고사","기말고사","자격증","어학(토익 등)","공무원·고시","기타"], goal:[60,120,180,240,300], pass:[4,5,6,7], gender:["남","여","밝히지 않음"],
  slots:["아침 6~12시","오후 12~18시","저녁 18~24시","새벽 0~6시"],
  placesG:["백도","디도","단과대 라운지","학교 앞 카페","집·기숙사"], placesY:["문사","수해대 라운지","학교 앞 카페","집·기숙사"],
  talk:["타이머로만","하루 한 번 체크","자주 응원"], pref:["같은 학과","같은 단과대","상관없음"], deposit:[5000,10000]
};
const COLLEGES={"광주캠퍼스":["인문대학","사회과학대학","경영대학","자연과학대학","공과대학","AI융합대학","농업생명과학대학","사범대학","생활과학대학","예술대학","약학대학","간호대학","수의과대학","의과대학","치과대학","대학원","기타"],"여수캠퍼스":["공학대학","수산해양대학","문화사회과학대학","기타"]};
const REASONS=["욕설·비하","성희롱·불쾌한 연락","개인 연락 강요","타이머 조작·허위 기록","잠수·노쇼","계약금·금전 문제","기타"];

/* ================= helpers ================= */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const pad=n=>String(n).padStart(2,"0");
const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parse=s=>{const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)};
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const dayDiff=(a,b)=>Math.round((parse(ymd(b))-parse(ymd(a)))/864e5);
const won=n=>Number(n||0).toLocaleString("ko-KR")+"원";
const hm=m=>{m=Math.round(m);const h=Math.floor(m/60),r=m%60;return h?(r?`${h}시간 ${r}분`:`${h}시간`):`${r}분`};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function toast(msg){const t=$("#toast");t.textContent=msg;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(()=>t.hidden=true,2800)}
function shake(el){el.classList.remove("shake");void el.offsetWidth;el.classList.add("shake")}
const isJnu=e=>!!e&&(ALLOWED_DOMAINS.some(d=>e.toLowerCase().endsWith("@"+d))||isAdminEmail(e));
const isAdminEmail=e=>!!e&&ADMIN_EMAILS.map(x=>x.toLowerCase()).includes(e.toLowerCase());

/* ================= AUTH ================= */
let ME=null, authMode="signup";
$("#authImg").src=SPR.panda.fire;
function setAuthMode(m){
  authMode=m;
  $$("[data-auth]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.auth===m));
  $("#pw2Wrap").hidden=$("#termsWrap").hidden=m!=="signup";
  $("#forgotBtn").hidden=m!=="login";
  $("#pw").autocomplete=m==="signup"?"new-password":"current-password";
  $("#authBtn").textContent=m==="signup"?"인증 메일 받기":"로그인";
  $("#authErr").hidden=true;
}
$$("[data-auth]").forEach(b=>b.onclick=()=>setAuthMode(b.dataset.auth));
function authError(msg){const e=$("#authErr");e.textContent=msg;e.hidden=false;shake($("#authForm"))}
function readEmail(){let v=$("#emailId").value.trim().toLowerCase();if(v.includes("@"))return v;return v?`${v}@${ALLOWED_DOMAINS[0]}`:""}
const AUTH_MSG={"auth/email-already-in-use":"이미 가입한 메일이에요. 로그인 탭에서 들어와 주세요.","auth/invalid-credential":"메일 또는 비밀번호가 맞지 않아요.","auth/wrong-password":"비밀번호가 맞지 않아요.","auth/user-not-found":"가입하지 않은 메일이에요. 회원가입 탭을 이용해 주세요.","auth/weak-password":"비밀번호를 8자 이상으로 정해 주세요.","auth/too-many-requests":"시도가 너무 많아요. 잠시 뒤 다시 해 주세요.","auth/invalid-email":"메일 주소 형식을 확인해 주세요.","auth/network-request-failed":"인터넷 연결을 확인해 주세요."};
$("#authBtn").onclick=async()=>{
  const email=readEmail(), pw=$("#pw").value;
  if(!email) return authError("학교 메일 아이디를 적어 주세요");
  if(!isJnu(email)) return authError(`전남대 메일(@${ALLOWED_DOMAINS.join(", @")})로만 가입할 수 있어요`);
  if(pw.length<8) return authError("비밀번호는 8자 이상이에요");
  const btn=$("#authBtn"); btn.disabled=true;
  try{
    if(authMode==="signup"){
      if(pw!==$("#pw2").value) throw {code:"x",message:"비밀번호 확인이 일치하지 않아요"};
      if(!$("#terms").checked) throw {code:"x",message:"이메일 수집에 동의해 주세요"};
      const cred=await createUserWithEmailAndPassword(auth,email,pw);
      if(!isAdminEmail(email)) await sendEmailVerification(cred.user);
    }else{
      await signInWithEmailAndPassword(auth,email,pw);
    }
  }catch(e){authError(e.code==="x"?e.message:(AUTH_MSG[e.code]||"잠시 뒤 다시 시도해 주세요 ("+e.code+")"))}
  btn.disabled=false;
};
$("#forgotBtn").onclick=async()=>{
  const email=readEmail(); if(!isJnu(email)) return authError("학교 메일 아이디를 먼저 적어 주세요");
  try{await sendPasswordResetEmail(auth,email);toast("비밀번호 재설정 메일을 보냈어요")}catch(e){authError(AUTH_MSG[e.code]||"메일을 보내지 못했어요")}
};
$("#verifiedBtn").onclick=async()=>{
  try{await reload(auth.currentUser);await auth.currentUser.getIdToken(true)}catch(e){}
  if(auth.currentUser?.emailVerified) enterApp(auth.currentUser);
  else{const e=$("#verifyErr");e.textContent="아직 인증이 확인되지 않았어요. 메일 속 링크를 눌렀는지 확인해 주세요.";e.hidden=false;shake($("#verifyBox"))}
};
$("#resendBtn").onclick=async()=>{try{await sendEmailVerification(auth.currentUser);toast("인증 메일을 다시 보냈어요")}catch(e){toast(AUTH_MSG[e.code]||"잠시 뒤 다시 보내 주세요")}};
$("#logoutBtn2").onclick=()=>signOut(auth);
$("#logoutBtn").onclick=async()=>{if(running)stopTimer();await signOut(auth);toast("로그아웃했어요")};

function showAuth(){ $("#authView").hidden=false; $("#appView").hidden=true; $("#tabNav").hidden=true; $("#authForm").hidden=false; $("#verifyBox").hidden=true; setAuthMode(authMode) }
function showVerify(u){ $("#authView").hidden=false; $("#appView").hidden=true; $("#tabNav").hidden=true; $("#authForm").hidden=true; $("#verifyBox").hidden=false; $("#verifyMail").textContent=u.email; $("#verifyErr").hidden=true }

onAuthStateChanged(auth,u=>{
  unsubAll();
  if(!u){ME=null;showAuth();return}
  if(!isJnu(u.email)){signOut(auth);authError("전남대 메일 계정만 이용할 수 있어요");return}
  if(!u.emailVerified&&!isAdminEmail(u.email)){showVerify(u);return}
  enterApp(u);
});

/* ================= LOCAL STATE (per user) ================= */
let S=null, KEY="";
function practice(app){
  const t=new Date(), a=app?.animal||"panda", others=Object.keys(ANIMALS).filter(x=>x!==a), pa=others[(t.getDate()*7)%others.length];
  return {matchId:null,mode:"prize",deposit:0,goal:app?.goal||120,pass:app?.pass||5,animal:a,nick:app?.nick||"나",strict:app?.strict??true,start:ymd(t),
    partner:{nick:"연습 파트너 "+ANIMALS[pa],animal:pa,uid:null},log:{},plog:{},xp:0};
}
function loadState(uid){
  KEY="duomate.v3."+uid;
  try{S=JSON.parse(localStorage.getItem(KEY))}catch(e){S=null}
  if(!S||!S.ch) S={exams:{...CNU},app:null,ch:practice(null)};
}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}};

/* ================= FIRESTORE SUBSCRIPTIONS ================= */
let subs=[], adminSubs=[], MATCH=null, PARTNER=null, chatUrl="";
function unsubAll(){subs.forEach(f=>f());adminSubs.forEach(f=>f());subs=[];adminSubs=[];partnerUnsub?.();partnerUnsub=null}
let partnerUnsub=null;

async function enterApp(u){
  ME=u; loadState(u.uid);
  $("#authView").hidden=true; $("#appView").hidden=false; $("#tabNav").hidden=false;
  $("#myMail").textContent=u.email;
  // my application
  subs.push(onSnapshot(doc(db,"applications",u.uid),s=>{
    if(s.exists()){const a=s.data();S.app=a;if(!S.ch.matchId){const keepLog=S.ch.log,keepXp=S.ch.xp;S.ch=practice(a);S.ch.log=keepLog;S.ch.xp=keepXp}}else S.app=null;
    save();loadForm();render();
  },()=>{}));
  // my active match
  subs.push(onSnapshot(query(collection(db,"matches"),where("members","array-contains",u.uid)),s=>{
    const m=s.docs.find(d=>d.data().active===true); MATCH=m?{id:m.id,...m.data()}:null; applyMatch(); drawChatPanel(); render();
  },e=>console.warn(e)));
  subs.push(onSnapshot(doc(db,"config","public"),s=>{chatUrl=s.exists()?(s.data().chat||""):"";$("#chatUrl").value=chatUrl;drawChat()},()=>{}));
  const admin=isAdminEmail(u.email);
  $("[data-tab=admin]").hidden=!admin;
  if(admin) startAdmin();
  lastLv=null; checkLevel();
  render(); renderCal(); go("home");
  try{const r=JSON.parse(localStorage.getItem(RUNKEY()));if(r&&r.t0){running=r;startTimer()}}catch(e){}
  pushPresence(true);
}
function applyMatch(){
  if(!MATCH){partnerUnsub?.();partnerUnsub=null;PARTNER=null;if(S.ch.matchId){S.ch=practice(S.app);save()}return}
  const mine=MATCH.a.uid===ME.uid?MATCH.a:MATCH.b, other=MATCH.a.uid===ME.uid?MATCH.b:MATCH.a;
  if(S.ch.matchId!==MATCH.id){
    S.ch={matchId:MATCH.id,mode:"prize",deposit:0,goal:mine.goal,pass:mine.pass,animal:mine.animal,nick:mine.nick,strict:mine.strict,start:MATCH.start,
      partner:{nick:other.nick,animal:other.animal,uid:other.uid,msg:other.msg||""},log:{},plog:{},xp:0};
    save(); confetti(innerWidth/2,innerHeight*.3,90); toast(`${other.nick} 님과 듀오가 됐어요!`);
  }
  if(!partnerUnsub||partnerUnsub.uid!==other.uid){
    partnerUnsub?.();
    const f=onSnapshot(doc(db,"presence",other.uid),s=>{PARTNER=s.exists()?s.data():null;render()},()=>{});
    f.uid=other.uid; partnerUnsub=f;
  }
}
let lastPush=0;
async function pushPresence(force){
  if(!ME)return; const now=Date.now(); if(!force&&now-lastPush<20000)return; lastPush=now;
  const k=ymd(new Date()), r=S.ch.log[k]||{m:0,leave:0};
  try{await setDoc(doc(db,"presence",ME.uid),{studying:!!running,date:k,todayMin:Math.round(r.m+liveMinutes()),leave:r.leave,matchId:S.ch.matchId||null,tog:S.ch.tog||[],updatedAt:serverTimestamp()})}catch(e){}
}

/* ================= D-day ================= */
function nextExam(){
  const t=parse(ymd(new Date()));
  for(const [n,s,e] of [["중간고사",S.exams.midS,S.exams.midE],["기말고사",S.exams.finS,S.exams.finE]]){if(parse(e)>=t)return{name:n,d:dayDiff(t,parse(s))}}
  return null;
}
function renderDchip(){const x=nextExam();$("#dchipName").textContent=x?x.name:"시험";$("#dchipD").textContent=!x?"끝":x.d>0?`D-${x.d}`:x.d===0?"D-DAY":"시험 중"}

/* ================= CHALLENGE ================= */
let running=null, tick=null, wake=null, sadUntil=0;
function chDays(){const s=parse(S.ch.start);return [...Array(7)].map((_,i)=>addDays(s,i))}
function dayOk(k){const r=S.ch.log[k];return !!r&&r.m>=S.ch.goal&&!(S.ch.strict&&r.leave>=3)}
function okCount(){return chDays().filter(d=>dayOk(ymd(d))).length}
function liveMinutes(){return running?(Date.now()-running.t0)/6e4:0}
function todayMin(){const r=S.ch.log[ymd(new Date())];return (r?r.m:0)+liveMinutes()}
function partnerOnline(){
  if(S.ch.partner.uid){
    if(!PARTNER||!PARTNER.studying)return false;
    const t=PARTNER.updatedAt?.toMillis?.()||0; return Date.now()-t<3*60*1000;
  }
  const n=new Date(),slot=Math.floor(n.getTime()/6e5),base=n.getHours()>=9?0.62:0.15;
  return Math.abs(Math.sin(slot*12.9898)*43758.5453)%1<base;
}
const togDays=()=>{const mine=S.ch.tog||[],pt=PARTNER?.tog||[],wk=chDays().map(ymd);return wk.filter(d=>mine.includes(d)&&pt.includes(d))};
function drawTog(){
  const real=!!S.ch.partner.uid;$("#togBox").hidden=!real;if(!real)return;
  const k=ymd(new Date()),on=(S.ch.tog||[]).includes(k);
  $("#togBtn").setAttribute("aria-pressed",on);$("#togBtn").textContent=on?"체크됨 (취소)":"오늘 같이 공부했어요";
  $("#togTxt").textContent=`같은 장소 공부 ${togDays().length}일 · 서로 눌러야 인정 (주 1~2회 권장)`;
}
$("#togBtn").onclick=()=>{const k=ymd(new Date()),t=S.ch.tog||[];S.ch.tog=t.includes(k)?t.filter(x=>x!==k):[...t,k];save();pushPresence(true);drawTog();if(togDays().includes(k))confetti(innerWidth/2,innerHeight*.4,60)};
function partnerToday(){
  if(S.ch.partner.uid) return PARTNER&&PARTNER.date===ymd(new Date())?PARTNER.todayMin||0:0;
  return S.ch.plog[ymd(new Date())]||0;
}

function render(){
  if(!S||!ME)return;
  const c=S.ch, now=new Date(), tk=ymd(now), real=!!c.partner.uid;
  renderDchip(); drawTog();
  const w8=$("#waitPanel");
  if(real){w8.hidden=false;$("#waitTitle").textContent="매칭 완료";$("#waitNo").textContent=c.mode==="deposit"?"계약금 "+won(c.deposit):"상품 모드";$("#waitTxt").textContent=`${c.partner.nick} 님과 ${c.start.slice(5).replace("-","/")}부터 7일간 함께해요.`+(c.partner.msg?` 파트너 한마디: “${c.partner.msg}”`:"")}
  else if(S.app){w8.hidden=false;$("#waitTitle").textContent="매칭 대기 중";$("#waitNo").textContent="신청 #"+S.app.no;$("#waitTxt").textContent=`${S.app.campus} · 하루 ${hm(S.app.goal)} · ${S.app.slots.join(", ")}. 비슷한 학우를 찾으면 여기에 파트너가 나타나요. 그동안 연습 파트너와 타이머를 써 보세요.`}
  else w8.hidden=true;
  $("#demoNote").textContent=real?"참가비는 앱에서 결제되지 않아요. 안내된 계좌로 입금하면 운영진이 확인합니다.":S.app?"매칭 전까지는 연습 파트너가 함께해요.":"아직 신청 전이에요. ‘신청’ 탭에서 듀오 신청서를 내면 운영진이 파트너를 찾아 드려요.";
  $("#ptActions").hidden=!real;
  const dIdx=dayDiff(parse(c.start),now)+1;
  $("#chTitle").textContent=!real?"연습 모드":dIdx>=1&&dIdx<=7?`1주 챌린지 · ${dIdx}일차`:dIdx>7?"챌린지 종료":"시작 전";
  const mp=$("#chMode"); mp.textContent=c.mode==="deposit"?`계약금 ${won(c.deposit)}`:"상품 모드"; mp.className="pill "+(c.mode==="deposit"?"fire":"on");
  const pOn=partnerOnline(), meOn=!!running, myToday=todayMin(), myLeave=(c.log[tk]||{}).leave||0;
  const meState=meOn&&pOn?"fire":meOn?"study":myLeave>=1&&myToday<c.goal?"sad":myToday>=c.goal?"fire":"sleep";
  const pLeave=real?(PARTNER?.date===tk?PARTNER.leave||0:0):myLeave;
  const ptState=pOn&&meOn?"fire":pOn?"study":(pLeave>=1?"sad":partnerToday()>=c.goal?"fire":"sleep");
  $("#meImg").src=SPR[c.animal][meState]; $("#meImg").alt=ANIMALS[c.animal];
  $("#ptImg").src=SPR[c.partner.animal][ptState]; $("#ptImg").alt=ANIMALS[c.partner.animal];
  for(const [id,st] of [["#meSt",meState],["#ptSt",ptState]]){const el=$(id);el.className="sticker"+(st==="fire"?" burn":st==="sad"?" cry":"");el.dataset.s=st}
  $("#meNick").textContent=c.nick; $("#ptNick").textContent=c.partner.nick;
  $("#meStat").textContent=`오늘 ${hm(myToday)}`+(myLeave?` · 이탈 ${myLeave}회`:"");
  $("#ptStat").textContent=(pOn?"공부 중 · ":"오프라인 · ")+`오늘 ${hm(partnerToday())}`;
  $("#burnbar").hidden=!(pOn&&meOn);
  const xp=Math.round(curXP()), lv=Math.floor(xp/300)+1, into=xp%300;
  $("#lv").textContent=`Lv.${lv}`; $("#xpTxt").textContent=`${into} / 300 XP`; $("#xpFill").style.width=(into/3)+"%";
  $("#startBtn").textContent=running?"타이머로 돌아가기":"집중 시작";
  const w=$("#week"); w.innerHTML="";
  chDays().forEach(d=>{const k=ymd(d),r=c.log[k],past=d<parse(tk),el=document.createElement("div");
    el.className="wd"+(dayOk(k)?" ok":past&&real?" miss":"")+(k===tk?" today":"");
    el.innerHTML=`<span>${"일월화수목금토"[d.getDay()]}</span><b class="tnum">${d.getDate()}</b><span class="tnum">${r?Math.round(r.m/6)/10+"h":"–"}</span>`;w.appendChild(el)});
  $("#weekSum").textContent=`달성 ${okCount()} / ${c.pass}일 필요`;
  $("#todayGoal").textContent=hm(c.goal); $("#todayDone").textContent=hm(myToday);
  $("#todayFill").style.width=Math.min(100,myToday/c.goal*100)+"%";
  const left=7-Math.max(0,Math.min(7,dIdx-1)), need=Math.max(0,c.pass-okCount()), pill=$("#settlePill");
  if(need===0){pill.textContent="달성 확정";pill.className="pill on"}else if(need>left){pill.textContent="달성 불가";pill.className="pill bad"}else{pill.textContent=`남은 ${left}일 중 ${need}일 더`;pill.className="pill fire"}
  const prizeTier=g=>g>=240?"상위 상품 중 선택":g>=180?"중간 상품 중 선택":g>=120?"음료+간식 세트":"음료 쿠폰 1장";
  if(c.mode==="deposit"){const bonus=Math.round(c.deposit*(1-FEE)*0.35/100)*100;
    $("#sWin").textContent=won(c.deposit+bonus);$("#sWinSub").textContent=`계약금 + 보너스 약 ${won(bonus)}`;
    $("#sLose").textContent="0원";$("#sLoseSub").textContent=`${won(c.deposit)} 몰수`;
    $("#settleRule").textContent="보너스는 같은 주 실패자 비율에 따라 달라집니다. 위 금액은 실패율 35% 기준 예상치예요.";
  }else{$("#sWin").textContent="기프티콘";$("#sWinSub").textContent=`7일 중 ${c.pass}일 이상 달성 시 기프티콘 (최대 ${won(PRIZE_MAX)})`;$("#sLose").textContent="상품 없음";$("#sLoseSub").textContent=`참가비 ${won(FEE_WON)}는 환급되지 않아요`;$("#settleRule").textContent="목표일수를 채운 사람은 모두 받아요. 추첨이 아니고, 1인당 금액은 달성자 수에 따라 조정돼요."}
}

/* ================= CALENDAR ================= */
let calM=(()=>{const n=new Date();return new Date(n.getFullYear(),n.getMonth(),1)})(), selDay=null;
const inR=(d,s,e)=>d>=parse(s)&&d<=parse(e);
function eventsOn(d){
  const out=[], ex=S.exams;
  if(inR(d,ex.midS,ex.midE)) out.push({t:"중간고사"+(ex.midS!==CNU.midS||ex.midE!==CNU.midE?" (내 일정)":""),k:"mid"});
  if(inR(d,ex.finS,ex.finE)) out.push({t:"기말고사"+(ex.finS!==CNU.finS||ex.finE!==CNU.finE?" (내 일정)":""),k:"fin"});
  CNU_EVENTS.forEach(([s,e,t])=>{if(!/고사/.test(t)&&inR(d,s,e))out.push({t,k:"ev"})});
  for(const s of [ex.midS,ex.finS]){const x=dayDiff(d,parse(s));if(x>=1&&x<=14)out.push({t:`에너지 보급소 운영 (시험 D-${x})`,k:"sup"})}
  if(dayOk(ymd(d))) out.push({t:"공부 목표 달성",k:"ok"});
  return out;
}
function renderCal(){
  if(!S)return;
  $("#calTitle").textContent=`${calM.getFullYear()}년 ${calM.getMonth()+1}월`;
  const g=$("#cal"); g.innerHTML="";
  "일월화수목금토".split("").forEach(x=>{const h=document.createElement("div");h.className="h";h.textContent=x;g.appendChild(h)});
  const first=addDays(calM,-calM.getDay()), tk=ymd(new Date());
  const weeks=Math.ceil((calM.getDay()+new Date(calM.getFullYear(),calM.getMonth()+1,0).getDate())/7);
  for(let i=0;i<weeks*7;i++){
    const d=addDays(first,i),k=ymd(d),ev=eventsOn(d),c=document.createElement("button");
    let cls="c"; if(d.getMonth()!==calM.getMonth())cls+=" out";
    if(ev.some(e=>e.k==="mid"))cls+=" mid";else if(ev.some(e=>e.k==="fin"))cls+=" fin";else if(ev.some(e=>e.k==="ev"))cls+=" ev";
    if(ev.some(e=>e.k==="sup"))cls+=" sup"; if(k===tk)cls+=" today"; if(k===selDay)cls+=" sel";
    c.className=cls; c.type="button"; c.setAttribute("aria-label",`${d.getMonth()+1}월 ${d.getDate()}일`);
    c.innerHTML=`<span class="tnum">${d.getDate()}</span>`+(ev.some(e=>e.k==="ok")?'<i class="dot"></i>':"");
    c.onclick=()=>{selDay=k;const e=eventsOn(d);$("#dayNote").innerHTML=`<b>${d.getMonth()+1}월 ${d.getDate()}일 (${"일월화수목금토"[d.getDay()]})</b><br>`+(e.length?e.map(x=>esc(x.t)).join("<br>"):"일정 없음");renderCal()};
    g.appendChild(c);
  }
  const t=parse(tk), ul=$("#alerts"); ul.innerHTML=""; const ex=S.exams, items=[];
  [["중간고사",ex.midS,ex.midE],["기말고사",ex.finS,ex.finE]].forEach(([n,s,e])=>{
    const sd=parse(s);
    [[21,`${n} 3주 전 · 듀오 신청 마감, 매칭 시작`],[14,`${n} 2주 전 · 에너지 보급소 오픈`],[7,`${n} 1주 전 · 마지막 1주 챌린지 시작`],[1,`${n} 하루 전 · 오늘 목표만 채우고 일찍 자기`],[0,`${n} 시작 (${s.slice(5).replace("-","/")}~${e.slice(5).replace("-","/")})`]].forEach(([b,txt])=>items.push({date:addDays(sd,-b),b,txt}));
  });
  CNU_EVENTS.filter(e=>!/고사/.test(e[2])).forEach(([s,,txt])=>items.push({date:parse(s),b:null,txt}));
  items.sort((a,b)=>a.date-b.date);
  const upcoming=items.filter(it=>it.date>=t).slice(0,8), past=items.filter(it=>it.date<t).slice(-2);
  [...past,...upcoming].forEach(it=>{const li=document.createElement("li");if(it.date<t)li.className="past";const dd=dayDiff(t,it.date);
    li.innerHTML=`<span class="dd tnum">${it.b===null?(dd>0?"D-"+dd:dd===0?"오늘":"지남"):it.b?`D-${it.b}`:"D-DAY"}</span><span><span class="small muted tnum">${it.date.getMonth()+1}월 ${it.date.getDate()}일${ymd(it.date)===tk?" · 오늘":""}</span><br>${esc(it.txt)}</span>`;ul.appendChild(li)});
  for(const k of ["midS","midE","finS","finE"]) $("#"+k).value=ex[k];
  $("#calSrcPill").textContent=(ex.midS===CNU.midS&&ex.finS===CNU.finS&&ex.midE===CNU.midE&&ex.finE===CNU.finE)?"전남대 공식 · 2026-2":"내 과 일정 적용";
}
$("#pm").onclick=()=>{calM=new Date(calM.getFullYear(),calM.getMonth()-1,1);renderCal()};
$("#nm").onclick=()=>{calM=new Date(calM.getFullYear(),calM.getMonth()+1,1);renderCal()};
["midS","midE","finS","finE"].forEach(k=>$("#"+k).addEventListener("change",e=>{if(e.target.value){S.exams[k]=e.target.value;save();renderCal();renderDchip()}}));
$("#calReset").onclick=()=>{S.exams={...CNU};save();renderCal();renderDchip();toast("전남대 공식 일정으로 돌렸어요")};
function buildICS(){
  const ex=S.exams, stamp=new Date().toISOString().replace(/[-:]/g,"").slice(0,15)+"Z", dt=s=>s.replace(/-/g,""), nx=s=>dt(ymd(addDays(parse(s),1)));
  const evs=CNU_EVENTS.filter(e=>!/고사/.test(e[2])).map(e=>({s:e[0],e:e[1],t:e[2]}));
  evs.push({s:ex.midS,e:ex.midE,t:"중간고사",alarm:true},{s:ex.finS,e:ex.finE,t:"기말고사",alarm:true});
  for(const s of [ex.midS,ex.finS]){const d=ymd(addDays(parse(s),-14));evs.push({s:d,e:d,t:"듀오메이트 에너지 보급소 오픈"})}
  const L=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//DuoMate//CNU 2026-2//KO","CALSCALE:GREGORIAN","X-WR-CALNAME:전남대 2026-2 학사일정 (듀오메이트)"];
  evs.forEach((v,i)=>{L.push("BEGIN:VEVENT",`UID:duomate-${i}-${dt(v.s)}@duomate`,`DTSTAMP:${stamp}`,`DTSTART;VALUE=DATE:${dt(v.s)}`,`DTEND;VALUE=DATE:${nx(v.e)}`,`SUMMARY:${v.t}`);
    if(v.alarm)L.push("BEGIN:VALARM","ACTION:DISPLAY",`DESCRIPTION:${v.t} 1주 전 · 듀오 챌린지 시작!`,"TRIGGER:-P7D","END:VALARM","BEGIN:VALARM","ACTION:DISPLAY",`DESCRIPTION:내일 ${v.t}`,"TRIGGER:-P1D","END:VALARM");
    L.push("END:VEVENT")});
  L.push("END:VCALENDAR"); return L.join("\r\n");
}
$("#icsBtn").onclick=()=>{
  const url=URL.createObjectURL(new Blob([buildICS()],{type:"text/calendar"}));
  const a=document.createElement("a");a.href=url;a.download="전남대_2026-2_학사일정.ics";document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),4000); toast("받은 파일을 열면 캘린더에 추가돼요");
};

/* ================= APPLICATION FORM ================= */
const F={campus:"광주캠퍼스",gender:null,year:null,exam:["중간고사"],goal:120,pass:5,slots:[],places:[],talk:"하루 한 번 체크",pref:"상관없음",mode:"prize",deposit:10000,animal:"panda"};
let step=1;
const fmt={goal:hm,pass:v=>`${v}일`,deposit:won};
function drawSegs(){
  $$("[data-k]").forEach(el=>{
    const k=el.dataset.k, one=el.hasAttribute("data-one");
    const vals=k==="places"?(F.campus==="여수캠퍼스"?OPT.placesY:OPT.placesG):OPT[k];
    el.innerHTML="";
    vals.forEach(v=>{const b=document.createElement("button");b.type="button";b.textContent=fmt[k]?fmt[k](v):v;
      const on=one?F[k]===v:F[k].includes(v); b.setAttribute("aria-pressed",on);
      b.onclick=()=>{if(one)F[k]=v;else F[k]=on?F[k].filter(x=>x!==v):[...F[k],v];
        if(k==="campus"){F.places=[];fillColleges()} drawSegs(); if(step===5)drawContract()};
      el.appendChild(b)});
  });
  $$(".mode").forEach(b=>b.setAttribute("aria-pressed",b.dataset.mode===F.mode));
  $("#depField").hidden=F.mode!=="deposit";
}
function fillColleges(){const s=$("#aCollege"),cur=s.value;s.innerHTML='<option value="">선택하세요</option>'+COLLEGES[F.campus].map(c=>`<option>${c}</option>`).join("");if(COLLEGES[F.campus].includes(cur))s.value=cur}
function drawPicker(){
  const p=$("#picker"); p.innerHTML="";
  Object.keys(ANIMALS).forEach(a=>{const b=document.createElement("button");b.type="button";b.setAttribute("aria-pressed",F.animal===a);b.setAttribute("aria-label",ANIMALS[a]);
    b.innerHTML=`<img src="${SPR[a][F.animal===a?"fire":"study"]}" alt=""><span>${ANIMALS[a]}</span>`;
    b.onclick=()=>{F.animal=a;drawPicker();const r=b.getBoundingClientRect();confetti(r.left+r.width/2,r.top+r.height/2,14)};p.appendChild(b)});
}
$$(".mode").forEach(b=>b.onclick=()=>{F.mode=b.dataset.mode;drawSegs();showStep()});
function drawContract(){
  const dep=F.mode==="deposit";
  $("#contract").innerHTML=`<dl>
    <dt>닉네임</dt><dd>${esc($("#aNick").value||"-")} · ${ANIMALS[F.animal]}</dd>
    <dt>소속</dt><dd>${esc(F.campus)} ${esc($("#aCollege").value)} ${esc($("#aDept").value)} ${esc(F.year||"")}</dd>
    <dt>목표</dt><dd>하루 ${hm(F.goal)}, 7일 중 ${F.pass}일 이상 · ${esc(F.exam.join(", "))}</dd>
    <dt>시간·장소</dt><dd>${esc(F.slots.join(", ")||"-")}${F.places.length?" · "+esc(F.places.join(", ")):""}</dd>
    <dt>참가비</dt><dd>${won(FEE_WON)} (환급 없음 · 운영비 ${OPS_RATE*100}% 제외 후 상품 재원)</dd>
    <dt>달성 시</dt><dd>7일 중 ${F.pass}일 이상 달성하면 기프티콘 (1인당 최대 ${won(PRIZE_MAX)}, 달성자 수에 따라 조정)</dd>
    <dt>미달성 시</dt><dd>상품 없음 (참가비 환급 없음)</dd>
    <dt>집중 규칙</dt><dd>${$("#aStrict").checked?"엄격 모드 · 하루 3회 이탈 시 미달성":"일반 모드 · 이탈은 기록만"}</dd>
  </dl>`;
  $("#agreeDepWrap").hidden=!dep;$("#refundWrap").hidden=!dep;
  const bb=$("#bankBox");bb.style.display="";bb.hidden=false;bb.innerHTML=bankHtml(FEE_WON);
}
function bankHtml(amt){return `<b>참가비 입금 안내</b><br>${esc(BANK.name)} <b class="tnum">${esc(BANK.no)}</b> ${esc(BANK.holder)}<br>입금액 <b>${won(amt)}</b> · 입금자명은 <b>신청 번호</b>(제출 후 표시) 또는 본인 이름으로 보내 주세요.<br><span class="small muted">참가비는 환급되지 않아요. 운영비 ${OPS_RATE*100}%를 뺀 나머지는 달성자 기프티콘 재원에 보태고, 입금 확인이 된 분만 상품 지급 대상이에요.</span>`}
function validate(n){
  if(n===1){if(!$("#aNick").value.trim())return"닉네임을 적어 주세요";if(!$("#aCollege").value)return"단과대학을 골라 주세요";if(!F.year)return"학년을 골라 주세요";if(!F.gender)return"성별을 골라 주세요"}
  if(n===2&&!F.exam.length)return"준비하는 시험을 하나 이상 골라 주세요";
  if(n===3&&!F.slots.length)return"공부하는 시간대를 하나 이상 골라 주세요";
  if(n===5){if(!$("#aKakao").value.trim())return"매칭 연락 받을 카카오톡 ID를 적어 주세요";if(!$("#aAgreePriv").checked)return"개인정보 보관에 동의해야 신청할 수 있어요";if(F.mode==="deposit"&&!$("#aRefund").value.trim())return"환급 받을 계좌를 적어 주세요";if(F.mode==="deposit"&&!$("#aAgreeDep").checked)return"계약금 규칙에 동의해 주세요"}
  return null;
}
function showStep(){
  $$("fieldset[data-step]").forEach(f=>f.hidden=+f.dataset.step!==step);
  $$("#steps i").forEach((i,ix)=>i.classList.toggle("on",ix<step));
  $("#stepTxt").textContent=`${step} / 5`; $("#prevBtn").disabled=step===1;
  $("#nextBtn").textContent=step===5?(F.mode==="deposit"?`${won(F.deposit)} 걸고 신청`:"무료로 신청"):"다음";
  $("#nextBtn").className="btn "+(step===5?"primary":"dark");
  if(step===5)drawContract(); $("#formErr").hidden=true;
}
$("#prevBtn").onclick=()=>{if(step>1){step--;showStep()}};
$("#nextBtn").onclick=async()=>{
  const e=validate(step); if(e){$("#formErr").textContent=e;$("#formErr").hidden=false;shake($("#applyForm"));return}
  if(step<5){step++;showStep();scrollTo(0,0);return}
  await submitApp();
};
["#aNick","#aDept","#aCollege","#aStrict"].forEach(s=>$(s).addEventListener("input",()=>{if(step===5)drawContract()}));
async function submitApp(){
  if(S.ch.partner.uid){$("#formErr").textContent="진행 중인 듀오가 끝난 뒤에 다시 신청할 수 있어요";$("#formErr").hidden=false;return}
  const a={uid:ME.uid,email:ME.email,no:S.app?.no||String(Math.floor(1000+Math.random()*9000)),nick:$("#aNick").value.trim(),campus:F.campus,gender:F.gender,mailOk:$("#aAgreeMail").checked,paid:false,college:$("#aCollege").value,dept:$("#aDept").value.trim(),year:F.year,
    exam:F.exam,subject:$("#aSubject").value.trim(),goal:F.goal,pass:F.pass,slots:F.slots,places:F.places,talk:F.talk,pref:F.pref,mode:F.mode,deposit:F.mode==="deposit"?F.deposit:0,
    strict:$("#aStrict").checked,animal:F.animal,msg:$("#aMsg").value.trim(),kakao:$("#aKakao").value.trim(),refund:F.mode==="deposit"?$("#aRefund").value.trim():"",status:"wait",createdAt:serverTimestamp()};
  a.paid=S.app?.paid||false; if(S.app?.forfeit)a.forfeit=true;
  const btn=$("#nextBtn"); btn.disabled=true;
  try{await setDoc(doc(db,"applications",ME.uid),a)}
  catch(e){btn.disabled=false;$("#formErr").textContent="신청서를 저장하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.";$("#formErr").hidden=false;return}
  btn.disabled=false;
  $("#applyForm").hidden=true; $("#applyDone").hidden=false;
  $("#tNo").textContent="#"+a.no;
  $("#tSum").textContent=`${a.nick} · ${a.campus} · 하루 ${hm(a.goal)} · ${"참가비 "+won(FEE_WON)}`;
  const db2=$("#doneBank");db2.style.display="";db2.hidden=false;db2.innerHTML=bankHtml(FEE_WON).replace("(제출 후 표시)","(#"+a.no+")");
  drawChat(); confetti(innerWidth/2,innerHeight*.3,90);
}
function drawChat(){const l=$("#chatLink");if(chatUrl&&/^https:\/\//.test(chatUrl)){l.href=chatUrl;l.hidden=false}else l.hidden=true}
$("#reapply").onclick=()=>{$("#applyForm").hidden=false;$("#applyDone").hidden=true;step=1;showStep()};
$("#goHome").onclick=()=>go("home");
function loadForm(){
  if(!S.app)return; const a=S.app;
  Object.assign(F,{campus:a.campus,gender:a.gender||null,year:a.year,exam:a.exam,goal:a.goal,pass:a.pass,slots:a.slots,places:a.places,talk:a.talk,pref:a.pref,mode:"prize",deposit:10000,animal:a.animal});
  $("#aNick").value=a.nick;$("#aDept").value=a.dept||"";$("#aSubject").value=a.subject||"";$("#aMsg").value=a.msg||"";$("#aKakao").value=a.kakao||"";$("#aRefund").value=a.refund||"";$("#aStrict").checked=!!a.strict;
  fillColleges(); $("#aCollege").value=a.college;
}

/* ================= REPORT ================= */
let repCtx=null, repReason=null;
function openReport(ctx){
  repCtx=ctx; repReason=null; $("#repDetail").value=""; $("#repUnmatch").checked=false; $("#repErr").hidden=true;
  $("#repTarget").textContent=ctx.targetUid?`신고 대상: ${ctx.targetNick} (현재 파트너)`:"서비스 이용 중 겪은 문제를 알려 주세요.";
  $("#repUnmatchWrap").hidden=!ctx.targetUid;
  const r=$("#repReasons"); r.innerHTML="";
  REASONS.forEach(x=>{const b=document.createElement("button");b.type="button";b.textContent=x;b.setAttribute("aria-pressed","false");b.onclick=()=>{repReason=x;r.querySelectorAll("button").forEach(y=>y.setAttribute("aria-pressed",y===b))};r.appendChild(b)});
  $("#reportModal").hidden=false; $("#repDetail").focus();
}
$("#reportPartner").onclick=()=>openReport({targetUid:S.ch.partner.uid,targetNick:S.ch.partner.nick,matchId:S.ch.matchId});
$("#reportGeneral").onclick=()=>openReport({targetUid:null,targetNick:null,matchId:S.ch.matchId||null});
$("#repClose").onclick=()=>$("#reportModal").hidden=true;
$("#reportModal").addEventListener("click",e=>{if(e.target.id==="reportModal")$("#reportModal").hidden=true});
document.addEventListener("keydown",e=>{if(e.key==="Escape")$("#reportModal").hidden=true});
$("#repSend").onclick=async()=>{
  const detail=$("#repDetail").value.trim(), err=$("#repErr");
  if(!repReason){err.textContent="어떤 문제인지 골라 주세요";err.hidden=false;return}
  if(detail.length<5){err.textContent="자세한 내용을 5자 이상 적어 주세요";err.hidden=false;return}
  const btn=$("#repSend"); btn.disabled=true;
  try{
    await addDoc(collection(db,"reports"),{reporter:ME.uid,reporterEmail:ME.email,reporterNick:S.app?.nick||"",targetUid:repCtx.targetUid,targetNick:repCtx.targetNick,matchId:repCtx.matchId,
      reason:repReason,detail,unmatch:$("#repUnmatch").checked,status:"open",createdAt:serverTimestamp()});
    $("#reportModal").hidden=true; toast("신고가 접수됐어요. 운영진이 확인 후 연락드릴게요");
  }catch(e){err.textContent="접수하지 못했어요. 잠시 뒤 다시 눌러 주세요";err.hidden=false}
  btn.disabled=false;
};

/* ================= FOCUS TIMER ================= */
const RUNKEY=()=>KEY+".run";
async function startTimer(){
  try{actx=actx||new (window.AudioContext||window.webkitAudioContext)();actx.resume?.()}catch(e){}
  if(!running){running={t0:Date.now()};try{localStorage.setItem(RUNKEY(),JSON.stringify(running))}catch(e){}}
  $("#focus").hidden=false; $("#fWarn").hidden=true;
  $("#fLabel").textContent=S.ch.strict?"엄격 모드 · 허용 앱 없음":"일반 모드";
  try{wake=await navigator.wakeLock?.request("screen")}catch(e){}
  try{await document.documentElement.requestFullscreen?.()}catch(e){}
  clearInterval(tick); tick=setInterval(drawFocus,1000); if(!chk.at)schedChk(); drawFocus(); pushPresence(true);
}
const chk={at:0,dl:0};
let actx=null,beepT=null;
function beep(){try{actx=actx||new (window.AudioContext||window.webkitAudioContext)();actx.resume?.();
  [880,1175,880].forEach((f,i)=>{const o=actx.createOscillator(),g=actx.createGain();o.type="square";o.frequency.value=f;g.gain.value=.35;o.connect(g);g.connect(actx.destination);const t=actx.currentTime+i*.22;o.start(t);o.stop(t+.16)})}catch(e){}}
function alarmOn(){beep();clearInterval(beepT);beepT=setInterval(()=>{beep();navigator.vibrate?.([300,150,300])},1800)}
function alarmOff(){clearInterval(beepT);beepT=null}
function schedChk(){alarmOff();chk.at=Date.now()+(8+Math.random()*12)*60000;chk.dl=0;$("#chkBox").hidden=true}
function chkResult(ok){
  const k=ymd(new Date()),r=S.ch.log[k]||{m:0,leave:0};
  if(ok){r.chk=(r.chk||0)+1;toast("체크인 완료!")}
  else{r.miss=(r.miss||0)+1;r.leave=(r.leave||0)+1;$("#fWarn").textContent=`체크인을 놓쳤어요. 이탈 ${r.leave}회로 기록돼요.`;$("#fWarn").hidden=false;navigator.vibrate?.([120,60,120])}
  S.ch.log[k]=r;save();schedChk();pushPresence(true);
}
function chkTick(){
  if(!chk.dl&&Date.now()>=chk.at){chk.dl=Date.now()+60000;$("#chkBox").hidden=false;alarmOn()}
  if(chk.dl){const s=Math.ceil((chk.dl-Date.now())/1000);$("#chkSec").textContent=Math.max(0,s);if(s<=0)chkResult(false)}
}
$("#chkBtn").onclick=()=>chkResult(true);
function drawFocus(){
  if(!running)return; chkTick();
  const s=Math.floor((Date.now()-running.t0)/1000);
  $("#fClock").textContent=`${pad(Math.floor(s/3600))}:${pad(Math.floor(s/60)%60)}:${pad(s%60)}`;
  const pOn=partnerOnline(); $("#fBurn").hidden=!pOn;
  if(Date.now()>sadUntil){$("#fImg").src=SPR[S.ch.animal][pOn?"fire":"study"];$("#fSt").className="sticker"+(pOn?" burn":"");$("#fSt").dataset.s=pOn?"fire":"study"}
  if(s>0&&s%60===0){floatText(`+${pOn?2:1} XP`,$("#fSt"));checkLevel();pushPresence(true)}
  if(pOn) embers($("#fSt"),3);
}
function stopTimer(){
  if(!running)return;
  const m=(Date.now()-running.t0)/6e4, k=ymd(new Date()), mult=partnerOnline()?2:1;
  const r=S.ch.log[k]||{m:0,leave:0}; r.m=Math.round(r.m+m); S.ch.log[k]=r; S.ch.xp=Math.round(S.ch.xp+m*mult);
  alarmOff(); running=null; chk.at=0; chk.dl=0; $("#chkBox").hidden=true; clearInterval(tick); try{localStorage.removeItem(RUNKEY())}catch(e){}
  try{wake?.release()}catch(e){} wake=null;
  if(document.fullscreenElement) document.exitFullscreen?.().catch(()=>{});
  $("#focus").hidden=true; save(); render(); pushPresence(true);
  const ok=dayOk(k); toast(ok?"오늘 목표 달성! 파트너 캐릭터가 불타오르는 중":`${hm(m)} 기록했어요`);
  if(ok) confetti(innerWidth/2,innerHeight*.35,80);
  floatText(`+${Math.max(1,Math.round(m*mult))} XP`,$("#meSt")); checkLevel();
}
document.addEventListener("visibilitychange",()=>{
  if(!running)return;
  if(document.hidden){const k=ymd(new Date()),r=S.ch.log[k]||{m:0,leave:0};r.leave++;S.ch.log[k]=r;save();running.left=Date.now();pushPresence(true)}
  else{
    const r=S.ch.log[ymd(new Date())]||{leave:0}, away=running.left?Math.round((Date.now()-running.left)/1000):0;
    if(S.ch.strict){running.t0+=away*1000;$("#fWarn").textContent=`화면을 ${away}초 벗어났어요. 오늘 이탈 ${r.leave}회${r.leave>=3?" · 오늘은 미달성 처리돼요":` · ${3-r.leave}회 더 벗어나면 미달성`}. 파트너 캐릭터가 울고 있어요.`}
    else $("#fWarn").textContent=`화면을 ${away}초 벗어났어요. 이탈 ${r.leave}회 기록됨.`;
    $("#fWarn").hidden=false; $("#fImg").src=SPR[S.ch.animal].sad; $("#fSt").className="sticker cry"; $("#fSt").dataset.s="sad"; sadUntil=Date.now()+4000;
    shake($("#focus")); navigator.vibrate?.([120,60,120]); tears($("#fSt"),18);
    navigator.wakeLock?.request("screen").then(w=>wake=w).catch(()=>{});
  }
});
$("#startBtn").onclick=startTimer; $("#fStop").onclick=stopTimer;

/* ================= FX ================= */
const cv=$("#fx"), cx=cv.getContext("2d"); let P=[], fxOn=false;
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
function sizeFx(){const r=devicePixelRatio||1;cv.width=innerWidth*r;cv.height=innerHeight*r;cx.setTransform(r,0,0,r,0,0)}
addEventListener("resize",sizeFx); sizeFx();
function loop(){
  cx.clearRect(0,0,innerWidth,innerHeight); P=P.filter(p=>p.life>0);
  for(const p of P){p.vy+=p.g;p.x+=p.vx;p.y+=p.vy;p.life--;p.rot+=p.vr;cx.globalAlpha=Math.min(1,p.life/p.max*1.6);cx.fillStyle=p.c;
    if(p.k==="ember"){cx.beginPath();cx.arc(p.x,p.y,p.r*(p.life/p.max),0,7);cx.fill()}
    else if(p.k==="tear"){cx.beginPath();cx.ellipse(p.x,p.y,p.r*.7,p.r,0,0,7);cx.fill()}
    else{cx.save();cx.translate(p.x,p.y);cx.rotate(p.rot);cx.fillRect(-p.r,-p.r/2,p.r*2,p.r);cx.restore()}}
  cx.globalAlpha=1; if(P.length)requestAnimationFrame(loop);else fxOn=false;
}
function add(arr){if(reduce)return;P.push(...arr);if(!fxOn){fxOn=true;requestAnimationFrame(loop)}}
const rectOf=el=>el.getBoundingClientRect();
function embers(el,n){const r=rectOf(el);if(!r.width)return;add([...Array(n)].map(()=>({k:"ember",x:r.left+Math.random()*r.width,y:r.bottom-6,vx:(Math.random()-.5)*.6,vy:-1.2-Math.random()*1.8,g:-.01,r:2+Math.random()*3.5,life:60+Math.random()*40|0,max:100,rot:0,vr:0,c:["#FF7A3D","#FFB020","#EE5A1C","#FFD25A"][Math.random()*4|0]})))}
function tears(el,n){const r=rectOf(el);if(!r.width)return;add([...Array(n)].map(()=>({k:"tear",x:r.left+r.width*(.35+Math.random()*.3),y:r.top+r.height*.4,vx:(Math.random()-.5)*4,vy:-2-Math.random()*3,g:.25,r:3+Math.random()*3,life:70,max:70,rot:0,vr:0,c:"#5BB8F0"})))}
function confetti(x,y,n){add([...Array(n)].map(()=>{const a=Math.random()*Math.PI*2,s=3+Math.random()*7;return{k:"conf",x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-4,g:.18,r:3+Math.random()*4,life:90+Math.random()*50|0,max:140,rot:Math.random()*6,vr:(Math.random()-.5)*.4,c:["#EE5A1C","#17786B","#C98A06","#4FC3B1","#FF7A3D"][Math.random()*5|0]}}))}
function floatText(txt,el){if(reduce)return;const r=rectOf(el);if(!r.width)return;const d=document.createElement("div");d.className="float";d.textContent=txt;d.style.left=(r.left+r.width/2-30)+"px";d.style.top=(r.top+r.height*.3)+"px";document.body.appendChild(d);setTimeout(()=>d.remove(),1500)}
let lastLv=null;
function curXP(){return S.ch.xp+(running?liveMinutes()*(partnerOnline()?2:1):0)}
function levelSound(){try{actx=actx||new (window.AudioContext||window.webkitAudioContext)();actx.resume?.();
  [523,659,784,1047,1319].forEach((f,i)=>{const o=actx.createOscillator(),g=actx.createGain();o.type="triangle";o.frequency.value=f;const t=actx.currentTime+i*.11;
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.35,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.3);o.connect(g);g.connect(actx.destination);o.start(t);o.stop(t+.32)})}catch(e){}}
function checkLevel(){const lv=Math.floor(curXP()/300)+1;if(lastLv!==null&&lv>lastLv){const o=document.createElement("div");o.className="lvup";o.innerHTML=`<div>LEVEL UP!<br>Lv.${lv}</div>`;document.body.appendChild(o);setTimeout(()=>o.remove(),1900);confetti(innerWidth/2,innerHeight/2,120);navigator.vibrate?.(200);levelSound()}lastLv=lv}
const LINES={study:["같이 하자!","나 지금 집중 중","오늘 목표 반 넘었어","커피 한 잔 하고 옴"],fire:["불타오른다!!","버닝 모드 가자","2배 경험치 꿀"],sleep:["zzz…","5분만 더…"],sad:["왜 나갔어…","폰 내려놔ㅠ"]};
function say(st){const arr=LINES[st.dataset.s||"sleep"];st.querySelector(".bubble")?.remove();const b=document.createElement("div");b.className="bubble";b.textContent=arr[Math.random()*arr.length|0];st.appendChild(b);setTimeout(()=>b.remove(),2600)}
const homeVisible=()=>!$("#appView").hidden&&!$("[data-view=home]").hidden&&$("#focus").hidden;
setInterval(()=>{if(homeVisible())say($("#ptSt"))},7000);
setInterval(()=>{if(!homeVisible())return;for(const id of ["#meSt","#ptSt"]){const st=$(id);if(st.dataset.s==="fire")embers(st,2);if(st.dataset.s==="sad"&&Math.random()<.3)tears(st,2)}},400);
document.addEventListener("click",e=>{const st=e.target.closest(".stage .sticker");if(st){say(st);if(st.dataset.s==="fire")confetti(e.clientX,e.clientY,20);else embers(st,6)}});

/* ================= ADMIN ================= */
let APPS=[], MATCHES=[], REPORTS=[];
const jac=(a,b)=>{const A=new Set(a||[]),B=new Set(b||[]);if(!A.size&&!B.size)return .5;let i=0;A.forEach(x=>B.has(x)&&i++);return i/new Set([...A,...B]).size};
function score(a,b){
  if(a.campus!==b.campus) return null;
  const why=[]; let s=0;
  s+=Math.max(0,30-Math.abs(a.goal-b.goal)/60*10); if(a.goal===b.goal)why.push("목표 시간 같음");
  const t=jac(a.slots,b.slots); s+=25*t; if(t>0)why.push("시간대 "+Math.round(t*100)+"% 겹침");
  const p=jac(a.places,b.places); s+=10*p; if(p>0&&(a.places||[]).length)why.push("장소 겹침");
  if(a.mode===b.mode){s+=15;if(a.mode==="deposit"&&a.deposit===b.deposit){s+=5;why.push("같은 계약금")}else why.push(a.mode==="deposit"?"둘 다 계약금":"둘 다 상품 모드")}
  const sameDept=a.dept&&a.dept===b.dept, sameCol=a.college===b.college;
  for(const x of [a,b]){if(x.pref==="같은 학과"&&!sameDept)s-=15;if(x.pref==="같은 단과대"&&!sameCol)s-=10}
  if(sameDept){s+=5;why.push("같은 학과")}else if(sameCol){s+=3;why.push("같은 단과대")}
  if(a.strict===b.strict)s+=5; if(a.talk===b.talk)s+=5;
  return {s:Math.max(0,Math.min(100,Math.round(s))),why};
}
function suggest(){
  const waiting=APPS.filter(a=>a.status!=="matched"), cand=[];
  for(let i=0;i<waiting.length;i++)for(let j=i+1;j<waiting.length;j++){const r=score(waiting[i],waiting[j]);if(r)cand.push({a:waiting[i],b:waiting[j],...r})}
  cand.sort((x,y)=>y.s-x.s); const used=new Set(), out=[];
  for(const c of cand){if(used.has(c.a.uid)||used.has(c.b.uid))continue;used.add(c.a.uid);used.add(c.b.uid);out.push(c)}
  return out;
}
const side=a=>`<div class="side"><img src="${SPR[a.animal]?.study||SPR.panda.study}" alt=""><b>${esc(a.nick)}</b><span class="muted">${esc(a.college)} ${esc(a.year||"")}</span><span class="muted tnum">${hm(a.goal)} · ${a.mode==="deposit"?won(a.deposit):"상품"}</span></div>`;
const card=(a,extra="")=>`<div class="app-card"><img src="${SPR[a.animal]?.sleep||SPR.panda.sleep}" alt=""><div class="meta"><b>${esc(a.nick)}</b> <span class="muted">#${esc(a.no)}</span><div class="muted">${esc(a.campus)} · ${esc(a.college)} ${esc(a.dept)} ${esc(a.year||"")}</div><div class="muted">${hm(a.goal)} · ${esc((a.slots||[]).join(", "))}</div>${a.forfeit?'<div class="unpaid">상품 몰수 대상</div>':""}<div class="muted">${esc(a.gender||"-")} · 카톡 ${esc(a.kakao)} · ${esc(a.email)}</div>${a.mode==="deposit"?`<div class="muted">환급계좌 ${esc(a.refund||"미입력")}</div>`:""}${true?`<div class="${a.paid?"paid":"unpaid"}">${won(FEE_WON)} ${a.paid?"입금 완료":"입금 대기"} <button class="btn sm" data-paid="${a.uid}" data-v="${a.paid?0:1}" type="button">${a.paid?"취소":"입금 확인"}</button></div>`:""}</div>${extra}</div>`;
const pick=a=>({email:a.email,gender:a.gender||"",uid:a.uid,nick:a.nick,animal:a.animal,goal:a.goal,pass:a.pass,mode:a.mode,deposit:a.deposit||0,strict:!!a.strict,msg:a.msg||"",kakao:a.kakao,email:a.email});
function mailHref(m,kind){
  const to=[m.a.email,m.b.email].filter(Boolean).join(",");
  const dep=m.a.mode==="deposit";
  const subj=kind==="success"?"[듀오 메이트] 목표 달성을 축하해요!":"[듀오 메이트] 1주 챌린지 결과 안내";
  const body=kind==="success"
    ?`${m.a.nick}님, ${m.b.nick}님 안녕하세요. 듀오 메이트 운영진입니다.\n\n1주 챌린지 목표를 달성하셨어요! 기프티콘은 카카오톡으로 보내 드릴게요. 연락 주세요.\n\n전남대학교 창업동아리 미르`
    :`${m.a.nick}님, ${m.b.nick}님 안녕하세요. 듀오 메이트 운영진입니다.\n\n이번 챌린지는 목표에 조금 못 미쳤어요. 다음 주에 다시 도전해 주세요!\n\n전남대학교 창업동아리 미르`;
  return `mailto:${to}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
}
function renderAdmin(){
  const wait=APPS.filter(a=>a.status!=="matched"), open=REPORTS.filter(r=>r.status==="open");
  $("#stWait").textContent=wait.length; $("#stDone").textContent=MATCHES.length; $("#stRep").textContent=open.length;
  const dep=APPS.filter(a=>a.mode==="deposit").length, ys=APPS.filter(a=>a.campus==="여수캠퍼스").length;
  drawPool();
  $("#stMix").textContent=APPS.length?`전체 신청 ${APPS.length}명 · 계약금 ${dep} · 상품 ${APPS.length-dep} · 광주 ${APPS.length-ys} · 여수 ${ys}`:"";
  // reports
  $("#repList").innerHTML=open.length?open.map(r=>`<div class="report-card"><div class="row"><b>${esc(r.reason)}</b><span class="muted small">${r.createdAt?.toDate?r.createdAt.toDate().toLocaleString("ko-KR"):""}</span></div>
    <div>${esc(r.detail)}</div>
    <div class="muted">신고자 ${esc(r.reporterNick||"")} (${esc(r.reporterEmail)}) → 대상 ${esc(r.targetNick||"없음")}${r.unmatch?" · 매칭 해제 요청":""}</div>
    <div class="navrow">${r.unmatch&&r.matchId?`<button class="btn sm" data-endm="${esc(r.matchId)}" type="button">매칭 해제</button>`:""}${r.targetUid?`<button class="btn sm" data-forf="${r.targetUid}" type="button">상대 상품 몰수</button>`:""}<button class="btn dark sm" data-res="${r.id}" type="button">처리 완료</button></div></div>`).join(""):'<div class="empty">미처리 신고가 없어요.</div>';
  $("#repList").querySelectorAll("[data-res]").forEach(b=>b.onclick=async()=>{b.disabled=true;try{await updateDoc(doc(db,"reports",b.dataset.res),{status:"resolved",resolvedAt:serverTimestamp()});toast("처리 완료로 바꿨어요")}catch(e){b.disabled=false;toast("저장하지 못했어요")}});
  $$("#repList [data-forf]").forEach(b=>b.onclick=async()=>{if(!b.dataset.armed){b.dataset.armed=1;b.textContent="정말 몰수";b.className="btn dark sm";return}try{await updateDoc(doc(db,"applications",b.dataset.forf),{forfeit:true});b.textContent="몰수됨";b.disabled=true}catch(e){toast("저장하지 못했어요")}});
  $("#repList").querySelectorAll("[data-endm]").forEach(b=>b.onclick=()=>endMatch(b.dataset.endm,b));
  // pairs
  const pairs=suggest(), pe=$("#pairs");
  pe.innerHTML=pairs.length?pairs.map((p,i)=>`<div class="pair">${side(p.a)}<div class="score tnum">${p.s}<br><span class="small muted">점</span></div>${side(p.b)}<div class="why">${esc(p.why.join(" · ")||"조건이 비슷해요")}</div><div class="act"><button class="btn dark sm" data-pair="${i}" type="button">이 듀오로 확정</button></div></div>`).join(""):'<div class="empty">같은 캠퍼스에 대기 중인 신청자가 2명 이상이면 추천이 떠요.</div>';
  pe.querySelectorAll("[data-pair]").forEach(b=>b.onclick=()=>confirmPair(pairs[+b.dataset.pair],b));
  $("#waitList").innerHTML=wait.length?wait.map(a=>card(a,`<button class="btn sm" data-del="${a.uid}" type="button">삭제</button>`)).join(""):'<div class="empty">대기 중인 신청자가 없어요.</div>';
  $$("#waitList [data-paid]").forEach(b=>b.onclick=async()=>{try{await updateDoc(doc(db,"applications",b.dataset.paid),{paid:b.dataset.v==="1"})}catch(e){toast("저장하지 못했어요")}});
  $("#waitList").querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{if(!b.dataset.armed){b.dataset.armed=1;b.textContent="정말 삭제";b.className="btn dark sm";return}try{await deleteDoc(doc(db,"applications",b.dataset.del));toast("삭제했어요")}catch(e){toast("삭제하지 못했어요")}});
  $("#doneList").innerHTML=MATCHES.length?MATCHES.map(m=>`<div class="pair">${side(m.a)}<div class="score tnum">${m.score}</div>${side(m.b)}<div class="why">${esc(m.start)} 시작 · 카톡 ${esc(m.a.kakao)} / ${esc(m.b.kakao)}</div><div class="act"><a class="btn sm" style="text-decoration:none" href="${mailHref(m,"success")}">달성 안내 메일</a> <a class="btn sm" style="text-decoration:none" href="${mailHref(m,"fail")}">미달성 안내 메일</a> <button class="btn sm" data-endm="${m.id}" type="button">매칭 종료</button></div></div>`).join(""):'<div class="empty">진행 중인 듀오가 없어요.</div>';
  $("#doneList").querySelectorAll("[data-endm]").forEach(b=>b.onclick=()=>endMatch(b.dataset.endm,b));
}
async function confirmPair(p,btn){
  btn.disabled=true;
  try{
    const b=writeBatch(db), ref=doc(collection(db,"matches"));
    b.set(ref,{members:[p.a.uid,p.b.uid],a:pick(p.a),b:pick(p.b),score:p.s,start:ymd(addDays(new Date(),1)),active:true,createdAt:serverTimestamp()});
    b.update(doc(db,"applications",p.a.uid),{status:"matched",matchId:ref.id});
    b.update(doc(db,"applications",p.b.uid),{status:"matched",matchId:ref.id});
    await b.commit();
    confetti(innerWidth/2,innerHeight/2,100); toast(`${p.a.nick} · ${p.b.nick} 듀오 확정! 내일부터 시작해요`);
  }catch(e){btn.disabled=false;toast("저장하지 못했어요. 잠시 뒤 다시 눌러 주세요")}
}
async function endMatch(id,btn){
  if(!btn.dataset.armed){btn.dataset.armed=1;btn.textContent="정말 종료";btn.className="btn dark sm";return}
  btn.disabled=true;
  try{
    const m=(await getDoc(doc(db,"matches",id))).data();
    const b=writeBatch(db); b.update(doc(db,"matches",id),{active:false,endedAt:serverTimestamp()});
    for(const u of m.members){const ar=doc(db,"applications",u);if((await getDoc(ar)).exists())b.update(ar,{status:"done"})}
    await b.commit(); toast("매칭을 종료했어요");
  }catch(e){btn.disabled=false;toast("종료하지 못했어요")}
}
async function sha(t){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(t));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
function pinOk(){try{return sessionStorage.getItem("dm_pin")==="1"}catch(e){return false}}
function drawPin(){const ok=pinOk();$("#pinGate").hidden=ok;$("#adminBody").hidden=!ok}
$("#pinBtn").onclick=async()=>{if(await sha($("#pinIn").value.trim())===ADMIN_PIN_SHA256){try{sessionStorage.setItem("dm_pin","1")}catch(e){}$("#pinErr").hidden=true;$("#pinIn").value="";drawPin();renderAdmin()}else{$("#pinErr").hidden=false;shake($("#pinGate"))}};
$("#pinIn").addEventListener("keydown",e=>{if(e.key==="Enter")$("#pinBtn").click()});
$("#csvBtn").onclick=()=>{const cols=["no","nick","email","gender","campus","college","dept","year","goal","pass","mode","deposit","paid","kakao","refund","status"];
  const q=v=>`"${String(v??"").replace(/"/g,'""')}"`;const t=[cols.join(","),...APPS.map(a=>cols.map(c=>q(a[c])).join(","))].join("\n");
  const l=document.createElement("a");l.href=URL.createObjectURL(new Blob(["\ufeff"+t],{type:"text/csv"}));l.download="duomate_applications.csv";l.click()};
$("#credit").textContent=CREDIT;
function drawPool(){const paid=APPS.filter(a=>a.paid).length,ops=Math.round(paid*FEE_WON*OPS_RATE),pool=PRIZE_BASE+paid*FEE_WON-ops,n=+$("#achN").value||0;
  $("#poolTxt").innerHTML=`입금 확인 ${paid}명 · 참가비 ${won(paid*FEE_WON)} → 운영비 ${won(ops)} 제외<br>상품 재원 <b>${won(pool)}</b> (후원 ${won(PRIZE_BASE)} + 참가비분)`+(n?`<br>달성자 ${n}명 → 1인당 <b>${won(Math.min(PRIZE_MAX,Math.floor(pool/n/100)*100))}</b>`:"")}
$("#achN").addEventListener("input",drawPool);
$("#sampleBtn").onclick=()=>{const ppl=MATCHES.flatMap(m=>[m.a,m.b]);for(let i=ppl.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[ppl[i],ppl[j]]=[ppl[j],ppl[i]]}
  const p=ppl.slice(0,3);$("#sampleList").innerHTML=p.length?p.map(x=>`<div class="app-card"><div class="meta"><b>${esc(x.nick)}</b><div class="muted">카톡 ${esc(x.kakao)} · ${esc(x.email||"")}</div></div></div>`).join(""):'<div class="empty">진행 중인 듀오가 없어요.</div>'};
/* chat */
let chatUnsub=null,chatMatch=null;
function drawChatPanel(){
  const p=$("#chatPanel");p.hidden=!MATCH;
  if(!MATCH){chatUnsub?.();chatUnsub=null;chatMatch=null;return}
  if(chatMatch===MATCH.id)return; chatUnsub?.(); chatMatch=MATCH.id;
  chatUnsub=onSnapshot(query(collection(db,"matches",MATCH.id,"msgs"),orderBy("createdAt","asc")),s=>{
    const l=$("#chatLog");l.innerHTML=s.docs.map(d=>{const m=d.data();return `<div class="${m.uid===ME.uid?"me":""}">${esc(m.text)}</div>`}).join("");l.scrollTop=l.scrollHeight},()=>{});
}
$("#chatSend").onclick=async()=>{const t=$("#chatIn").value.trim();if(!t||!MATCH)return;$("#chatIn").value="";
  try{await addDoc(collection(db,"matches",MATCH.id,"msgs"),{uid:ME.uid,text:t.slice(0,300),createdAt:serverTimestamp()})}catch(e){toast("보내지 못했어요")}};
$("#chatIn").addEventListener("keydown",e=>{if(e.key==="Enter")$("#chatSend").click()});
$("#rematch").onclick=()=>{renderAdmin();toast("다시 계산했어요")};
$("#saveChat").onclick=async()=>{const v=$("#chatUrl").value.trim();if(v&&!/^https:\/\//.test(v)){toast("https:// 로 시작하는 주소를 넣어 주세요");return}try{await setDoc(doc(db,"config","public"),{chat:v});toast("저장했어요")}catch(e){toast("저장하지 못했어요")}};
function startAdmin(){
  adminSubs.push(onSnapshot(collection(db,"applications"),s=>{APPS=s.docs.map(d=>d.data());renderAdmin()},e=>console.warn(e)));
  adminSubs.push(onSnapshot(query(collection(db,"matches"),where("active","==",true)),s=>{MATCHES=s.docs.map(d=>({id:d.id,...d.data()}));renderAdmin()},e=>console.warn(e)));
  adminSubs.push(onSnapshot(query(collection(db,"reports"),where("status","==","open")),s=>{REPORTS=s.docs.map(d=>({id:d.id,...d.data()}));renderAdmin()},e=>console.warn(e)));
}

/* ================= TABS ================= */
function go(v){
  $$("[data-view]").forEach(s=>s.hidden=s.dataset.view!==v);
  $$("[data-tab]").forEach(b=>b.setAttribute("aria-current",b.dataset.tab===v));
  if(v==="home")render(); if(v==="cal")renderCal(); if(v==="apply"){drawSegs();drawPicker();showStep()} if(v==="admin"){drawPin();renderAdmin()}
  scrollTo(0,0);
}
$$("[data-tab]").forEach(b=>b.onclick=()=>go(b.dataset.tab));
fillColleges();
setInterval(()=>{if(homeVisible())render();if(running)pushPresence()},30000);
