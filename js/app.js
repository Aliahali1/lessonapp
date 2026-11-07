/* ========== التطبيق الرئيسي ========== */
const App = (function(){
const C = CONFIG, D = DATA;
const KEY = 'dd2_state', RKEY = 'dd2_records';
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pick = a => a[Math.floor(Math.random()*a.length)];

/* ---------- الحالة ---------- */
function newStore(){ return {ans:{}, tries:{}, first:{}, wrong:{}, dec:'', why:'', ev:[], dtries:0, final:false, mismatch:false, firstDec:'', msg:''}; }
function fresh(){
  return {v:2, group:'', started:false, cur:'home', seen:{}, mcq:{}, videoEnded:false, vAns:{}, vOral:{},
    clues:[], plain:[], lifeOpen:[], lifeSel:null,
    sim:{step:0, A:newStore(), B:newStore(), issued:false, exited:false},
    exit:{points:null, correct:null, done:false, auto:false}, evalOpened:false, lumaHidden:false};
}
let S = load();
function load(){
  try{ const d = JSON.parse(localStorage.getItem(KEY)||'null'); if(d && d.v===2 && d.sim && d.exit){ if(d.sim.issued===undefined) d.sim.issued = (d.sim.step===5 && d.sim.A.final && d.sim.B.final); if(d.sim.exited===undefined) d.sim.exited=false; return d; } }catch(e){}
  return fresh();
}
function save(){
  try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){}
  try{ upsertRecord(); }catch(e){}
}

/* ---------- سجلات المجموعات (للوحة المعلمة) ---------- */
function getRecords(){ try{ return JSON.parse(localStorage.getItem(RKEY)||'{}')||{}; }catch(e){ return {}; } }
function setRecords(r){ try{ localStorage.setItem(RKEY, JSON.stringify(r)); }catch(e){} }
function counts(sid){
  const st = S.sim[sid], tr = D.stores[sid].truth; let trust=0, warn=0, danger=0;
  D.checks.forEach(c=>{
    if(st.ans[c.id] === undefined) return;
    const v = tr[c.id];
    if(c.id==='otp'){ if(v) danger++; else trust++; } else { if(v) trust++; else warn++; }
  });
  return {trust, warn, danger, answered:Object.keys(st.ans).length};
}
function sysRec(sid){ const c = counts(sid); if(c.danger>0) return 'no'; if(c.trust>=4) return 'yes'; return 'more'; }
function decText(k){ return (D.decisionOpts.find(o=>o.k===k)||{}).t || '—'; }
function quizFirst(){ return D.quiz.filter(q=>S.mcq[q.id] && S.mcq[q.id].first).length; }
function buildRecord(){
  const rec = {group:S.group, updated:new Date().toISOString(), progress:progressPct(), tabsDone:D.tabs.filter(t=>tabDone(t.id)).map(t=>t.id),
    review: D.review.filter(q=>S.mcq[q.id]&&S.mcq[q.id].solved).length,
    videoAnswers: D.videoQs.map((q,i)=>({q, a:S.vAns[i]||'', oral:!!S.vOral[i]})),
    quizFirst: quizFirst(), quizSolved: D.quiz.filter(q=>S.mcq[q.id]&&S.mcq[q.id].solved).length,
    httpsSolved: !!(S.mcq.https&&S.mcq.https.solved), clues: S.clues.length, life: S.lifeOpen.length,
    exit: S.exit, evalOpened: S.evalOpened, certificatesIssued: !!S.sim.issued, exited: !!S.sim.exited, stores:{}};
  ['A','B'].forEach(sid=>{
    const st=S.sim[sid], c=counts(sid);
    rec.stores[sid] = {name:D.stores[sid].name, answered:c.answered, firstCorrect:D.checks.filter(k=>st.first[k.id]).length,
      trust:c.trust, warn:c.warn, danger:c.danger, decision:st.dec, firstDecision:st.firstDec, sys:sysRec(sid), mismatch:st.mismatch,
      reason:st.why, evidence:st.ev, final:st.final, answers:D.checks.map(k=>({id:k.id, v:st.ans[k.id]===undefined?null:st.ans[k.id]}))};
  });
  return rec;
}
function upsertRecord(){
  const name = (S.group||'').trim(); if(!name) return;
  const r = getRecords(); r[name] = buildRecord(); setRecords(r);
}
let pushT = null;
function pushRecord(){
  if(!C.SHEET_ENDPOINT || !S.group) return;
  clearTimeout(pushT);
  pushT = setTimeout(()=>{ try{ fetch(C.SHEET_ENDPOINT,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(buildRecord())}).catch(()=>{}); }catch(e){} }, 600);
}

/* ---------- الإنجاز والتقدم ---------- */
function tabDone(id){
  switch(id){
    case 'home': return !!S.started;
    case 'goals': return !!S.seen.goals;
    case 'review': return D.review.every(q=>S.mcq[q.id]&&S.mcq[q.id].solved);
    case 'video': return !!S.videoEnded && D.videoQs.every((q,i)=>(S.vAns[i]||'').trim().length>0 || S.vOral[i]);
    case 'learn': return D.quiz.every(q=>S.mcq[q.id]&&S.mcq[q.id].solved);
    case 'secure': return !!(S.mcq.https&&S.mcq.https.solved);
    case 'fraud': return S.clues.length>=5;
    case 'life': return S.lifeOpen.length>=3;
    case 'sim': return !!(S.sim.A.final && S.sim.B.final && S.sim.issued);
    case 'exit': return !!S.exit.done;
    case 'eval': return !!S.evalOpened;
  }
  return false;
}
function progressPct(){ return Math.round(D.tabs.filter(t=>tabDone(t.id)).length / D.tabs.length * 100); }
function updateProgress(){
  const pct = progressPct();
  document.querySelectorAll('[data-pg-text]').forEach(el=>{ el.textContent = 'تقدّمك ' + pct + '٪'; });
  document.querySelectorAll('[data-pg-bar]').forEach(el=>{ el.style.width = pct + '%'; });
  document.querySelectorAll('.tile[data-id]').forEach(b=>{ b.classList.toggle('done', tabDone(b.dataset.id)); });
}
function renderTabs(){ /* لا يوجد شريط تبويبات: التنقل عبر مربعات الواجهة الرئيسة */ }

/* ---------- لمى ---------- */
const IMG = {welcome:'assets/luma/luma-welcome.png', thinking:'assets/luma/luma-thinking.png', clue:'assets/luma/luma-clue-detection.png',
  encourage:'assets/luma/luma-encouragement.png', achieve:'assets/luma/luma-achievement.png', goodbye:'assets/luma/luma-goodbye.png', main:'assets/luma/luma-main.png'};
function lumaImg(k){ return `<img src="${IMG[k]}" alt="لمى المحققة" onerror="this.outerHTML='<div class=&quot;luma-fallback&quot;>🕵️‍♀️</div>'">`; }
function luma(k, text){
  $('#lumaImg').innerHTML = lumaImg(k);
  const b = $('#lumaBubble'); b.textContent = text;
  b.classList.remove('swap'); void b.offsetWidth; b.classList.add('swap');
}
function setLumaHidden(h){
  S.lumaHidden = h; save();
  $('#lumaCol').style.display = h ? 'none' : '';
  $('#layout').classList.toggle('no-luma', h);
  $('#lumaShow').classList.toggle('visible', h);
}
const ENTER = {
  bye:{i:'goodbye', t:'إلى اللقاء أيتها المحققة! نلتقي في مغامرة جديدة.'},
  home:{i:'welcome', t:'مرحبًا بكِ أيتها المحققة الرقمية! تنتظركِ اليوم مغامرة لاكتشاف المتاجر الموثوقة وكشف علامات الاحتيال.'},
  goals:{i:'thinking', t:'هذه أهدافنا اليوم. اقرئيها جيدًا، ففي نهاية المغامرة سنعود إليها.'},
  review:{i:'thinking', t:'قبل أن نبدأ، لننعش ذاكرة المحققة بثلاثة أسئلة سريعة.'},
  video:{i:'clue', t:'شاهدي الفيديو بانتباه، وانتبهي للفرق بين المتجرين. ثم ناقشي الأسئلة مع مجموعتك.'},
  learn:{i:'thinking', t:'هذه مفاهيم المحققة. تعلّميها ثم جرّبي التقويم المرحلي.'},
  secure:{i:'clue', t:'لاحظي وجود HTTPS، لكن تذكري أن تشفير الاتصال لا يعني بالضرورة أن المتجر موثوق.'},
  fraud:{i:'clue', t:'توقفي قليلًا! هل تحققتِ من عنوان الموقع وبيانات البائع؟'},
  life:{i:'thinking', t:'التعلم يصبح أجمل حين نربطه بديننا وبالرياضيات وبحياتنا اليومية.'},
  sim:{i:'clue', t:'المحققة المتميزة لا تتسرع في الحكم؛ بل تجمع الأدلة أولًا.'},
  exit:{i:'encourage', t:'اقتربتِ من إنهاء المهمة! أجيبي عن الأسئلة لتكتشفي مدى تمكنكِ من مهارات المحققة الرقمية.'},
  eval:{i:'goodbye', t:'شكرًا لمرافقتي في هذه الرحلة. رأيكِ يساعدنا على تطوير التجربة!'}
};

/* ---------- أدوات واجهة ---------- */
function burst(n){
  if(window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  const c = document.createElement('div'); c.className = 'confetti';
  const cols = ['#7b3fbf','#d9a441','#a77ad8','#f5d98a','#dccaf3','#f7b8dc'];
  for(let k=0;k<n;k++){ const i=document.createElement('i'); i.style.left=Math.random()*100+'%'; i.style.background=cols[k%cols.length]; i.style.animationDuration=(2+Math.random()*2)+'s'; i.style.animationDelay=(Math.random()*.4)+'s'; c.appendChild(i); }
  document.body.appendChild(c); setTimeout(()=>c.remove(), 4500);
}
function mcqHtml(q){
  const st = S.mcq[q.id] || {};
  const opts = q.o.map((t,idx)=>{
    let cls='opt';
    if(st.solved && idx===q.a) cls+=' ok';
    else if(st.sel===idx && st.checked && !st.solved) cls+=' no';
    else if(st.sel===idx) cls+=' sel';
    return `<button class="${cls}" type="button" data-act="pick" data-q="${q.id}" data-i="${idx}" ${st.solved?'disabled':''}>${esc(t)}</button>`;
  }).join('');
  let fb='';
  if(st.solved) fb = `<div class="fb ok">✔ ${st.revealed?'الإجابة الصحيحة موضحة أعلاه. ':'إجابة صحيحة. '}${esc(q.e)}</div>`;
  else if(st.hint) fb = `<div class="fb no">💡 ${esc(st.hint)}</div>`;
  const btn = st.solved ? '' : `<button class="btn" type="button" data-act="check" data-q="${q.id}" ${st.sel===undefined?'disabled':''}>تحققي</button>`;
  return `<div class="mcq"><p><b>${esc(q.q)}</b></p><div class="opts">${opts}</div>${btn}${fb}</div>`;
}
function allMcq(){ return [D.httpsQ, ...D.review, ...D.quiz]; }
function checkMcq(q){
  const st = S.mcq[q.id] || (S.mcq[q.id]={});
  st.tries = (st.tries||0)+1; st.checked = true;
  if(st.sel===q.a){
    st.solved = true; st.hint = ''; if(st.tries===1) st.first = true;
    luma('encourage', pick(['أحسنتِ! إجابة صحيحة، استمري.','رائع! هكذا تفكر المحققة.','ممتاز، دليلك سليم!'])); burst(10);
  }else if(st.tries>=3){
    st.solved = true; st.hint = ''; st.revealed = true; st.sel = q.a;
    luma('encourage','لا بأس، المحققات يتعلمن من المحاولة. راجعي الشرح وتابعي.');
  }else{
    st.hint = q.h[Math.min(st.tries-1, q.h.length-1)];
    luma('encourage', st.tries===1 ? 'قريبة! جرّبي مرة أخرى بعد هذا التلميح.' : 'لا تيأسي، لديكِ توجيه إضافي الآن.');
  }
}
function nav(prev, next){
  const a = prev ? `<button class="btn ghost" type="button" data-act="goto" data-id="${prev}">→ السابق</button>` : '<span></span>';
  const b = next ? `<button class="btn gold" type="button" data-act="goto" data-id="${next}">التالي ←</button>` : '<span></span>';
  return `<div class="navrow no-print">${a}${b}</div>`;
}
const head = (n, t, lead) => `<span class="chip">${n}</span><h2>${t}</h2>${lead?`<p class="lead">${lead}</p>`:''}`;

/* ---------- العروض (التبويبات) ---------- */
const V = {};

V.home = () => `<div class="home">
  <section class="shop-hero" aria-label="الترحيب">
    <div class="sh-luma">${lumaImg('welcome')}</div>
    <div class="sh-txt">
      <span class="sh-kicker">${esc(C.subject)} · ${esc(C.grade)}</span>
      <h1>${esc(C.lessonTitle)}</h1>
      <div class="sh-sub">${esc(C.siteTitle)}</div>
      <div class="sh-bubble"><b>لمى:</b> «مرحبًا بكِ في مغامرتنا! هيا نكتشف كيف نتسوق بأمان ونميز المتاجر الموثوقة».</div>
    </div>
    <ul class="sh-meta" aria-label="بيانات الدرس">
      <li><span>المعلمة</span><b>${esc(C.teacher)}</b></li>
      <li><span>مديرة المدرسة</span><b>${esc(C.principal)}</b></li>
      <li class="sh-go"><button class="btn gold sm" type="button" data-act="start">ابدئي المغامرة ✨</button></li>
    </ul>
  </section>
  <div class="shop-title"><h2>تجوّلي في محطات المغامرة</h2><span class="sh-pg"><span data-pg-text></span><i class="bar"><b data-pg-bar></b></i></span></div>
  <nav class="tiles" aria-label="محطات المغامرة">
    ${D.tabs.filter(t=>t.id!=='home').map(t=>`<button type="button" class="tile ${t.featured?'feat':''} ${tabDone(t.id)?'done':''}" data-act="goto" data-id="${t.id}">
      <span class="tile-ico" aria-hidden="true">${t.ico}</span>
      <span class="tile-title">${esc(t.label)}</span>
      <span class="tile-desc">${esc(t.desc||'')}</span>
      <span class="tile-open"><span>افتحي المحطة</span> <i aria-hidden="true">←</i></span>
    </button>`).join('')}
  </nav>
  <div class="home-foot"><button class="btn purple sm homeexit" type="button" data-act="togate"><span aria-hidden="true">🚪</span> الخروج</button><a href="#/teacher">🔐 دخول المعلمة</a></div>
</div>`;

V.bye = () => `<div class="bye">
  <div class="bye-ico" aria-hidden="true">🌟</div>
  <h2>انتهت المغامرة بنجاح</h2>
  <p class="lead">شكرًا لكِ يا ${S.group?('مجموعة «'+esc(S.group)+'»'):'محققة'}! نتائجكِ وبطاقتا «قرار المحققة الرقمية» محفوظتان على هذا الجهاز.</p>
  <div class="grid2" style="margin:14px 0">${['A','B'].map(sid=>`<div class="card white"><b>${esc(D.stores[sid].name)}</b><br>قراركِ: <b>${decText(S.sim[sid].dec)}</b></div>`).join('')}</div>
  <div class="navrow no-print"><button class="btn ghost" type="button" data-act="goto" data-id="sim">🔎 مراجعة البطاقتين</button>
  <button class="btn purple" type="button" data-act="togate">↩ العودة إلى صفحة البداية</button></div>
</div>`;

V.goals = () => head('أهداف الدرس','🎯 أهداف الدرس','في نهاية هذا الدرس:') +
  `<div class="gridauto" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))">${D.goals.map(g=>`<div class="concept"><div class="ico">${g.ico}</div><p style="color:var(--ink);font-weight:500">${esc(g.t)}</p></div>`).join('')}</div>` + nav('home','review');

V.review = () => head('مراجعة','🔁 مراجعة الدرس السابق', esc(C.PREV_LESSON_TITLE)) +
  `<figure class="card white" style="margin:0 0 14px;padding:10px"><img src="assets/review-prev-lesson.jpg" alt="شريحة الدرس السابق: مهمة الخروج الكبرى، لعبة بعجلة الأسماء بخمس محطات وشارات، مع لمى المحققة" style="width:100%;height:auto;border-radius:12px;display:block"></figure>` +
  D.review.map(q=>`<div class="card white" style="margin-bottom:12px">${mcqHtml(q)}</div>`).join('') + nav('goals','video');

V.video = () => {
  const ended = S.videoEnded;
  const qs = D.videoQs.map((q,i)=>`<div class="qcard"><b>${i+1}. ${esc(q)}</b>
    <textarea data-bind="vans" data-i="${i}" placeholder="اكتبي إجابتك أو ناقشيها مع مجموعتك" maxlength="500" aria-label="إجابة السؤال ${i+1}">${esc(S.vAns[i]||'')}</textarea>
    <label style="display:block;margin-top:6px"><input type="checkbox" data-bind="voral" data-i="${i}" ${S.vOral[i]?'checked':''}> ناقشنا هذا السؤال شفهيًا</label></div>`).join('');
  return head('التهيئة','🎬 التهيئة بالفيديو','شاهدي الفيديو، ثم ناقشي الأسئلة. لا توجد إجابات جاهزة هنا؛ المطلوب أن تفكري وتستقصي.') +
  `<video id="vid" controls preload="metadata" playsinline aria-label="فيديو مقدمة الدرس"><source src="assets/intro-video.mp4" type="video/mp4">متصفحك لا يدعم تشغيل الفيديو.</video>
   <div id="vidErr" class="note" hidden style="margin-top:8px">تعذّر تشغيل الفيديو. تأكدي أن الملف assets/intro-video.mp4 موجود، أو اضغطي الزر أدناه لعرض الأسئلة.</div>
   <div style="margin-top:10px"><button id="vidDone" class="btn ghost sm" type="button" data-act="vidshow" ${ended?'hidden':'hidden'}>انتهيتُ من المشاهدة ← عرض الأسئلة</button></div>
   <div id="vidQs" ${ended?'':'hidden'}><h3 style="margin-top:14px">🗣️ أسئلة للنقاش</h3><p class="note">لا تكتبي أسماءً أو أرقامًا شخصية في الإجابات.</p>${qs}</div>` + nav('review','learn');
};

V.learn = () => head('التعلم','📚 التعلم وشرح المفاهيم') +
  `<div class="gridauto">${D.concepts.map(c=>`<div class="concept"><div class="ico">${c.ico}</div><h3>${esc(c.t)}</h3><p>${esc(c.d)}</p></div>`).join('')}</div>
   <div class="card" style="margin:16px 0;background:var(--gold-soft);border-color:var(--gold)"><b>💡 تذكري:</b> HTTPS ورمز القفل يدلان على <b>اتصال مشفر</b> فقط، لكنهما لا يثبتان وحدهما أن المتجر موثوق أو أن البائع غير محتال.</div>
   <h3>📝 تقويم مرحلي</h3>` +
  D.quiz.map(q=>`<div class="card white" style="margin-bottom:12px">${mcqHtml(q)}</div>`).join('') + nav('video','secure');

function browserMock(url, ok, label){
  const sch = url.startsWith('https') ? `<span class="g">🔒</span> ` : `<span class="r">⚠</span> `;
  return `<div class="browser"><div class="bar"><div class="dots"><i></i><i></i><i></i></div><div class="lock">${sch}${esc(url)}</div>${ok?'':'<span class="badge">غير آمن</span>'}</div><div class="shop-note">${esc(label)}</div></div>`;
}
V.secure = () => head('الأمان','🔒 مؤشرات الأمان والخصوصية','انظري إلى شريط العنوان في الموقعين.') +
  `<div class="grid2">${browserMock('https://nasma-boutique.com.sa', true, 'الموقع الأول')}${browserMock('https://supperr-deal99.shopp-xyz.top', true, 'الموقع الثاني (يعرض قفلًا كذلك)')}</div>
   <div class="card white" style="margin:12px 0">${mcqHtml(D.httpsQ)}</div>
   <h3>ماذا تعني المؤشرات؟ وماذا لا تعني؟</h3>
   <div class="gridauto">${D.indicators.map(x=>`<div class="concept ind"><div class="ico">${x.ico}</div><h3>${esc(x.t)}</h3><p><span class="yes">✔ تعني:</span> ${esc(x.yes)}</p><p><span class="no">✖ لا تعني:</span> ${esc(x.no)}</p></div>`).join('')}</div>` + nav('learn','fraud');

V.fraud = () => {
  const n = S.clues.length;
  const H = (id, inner) => `<button class="hot ${S.clues.includes(id)?'found':S.plain.includes(id)?'plain-hit':''}" type="button" data-act="clue" data-id="${id}">${inner}${S.clues.includes(id)?' <span class="tag bad">دليل ✔</span>':''}</button>`;
  return head('الاحتيال','🕵️ كشف الاحتيال الإلكتروني','انقري على العناصر في صفحة المتجر المشبوه لتكتشفي الأدلة. المطلوب 5 أدلة على الأقل (يوجد 7).') +
  `<div class="counter">الأدلة المكتشفة: ${n} / 7</div><div class="pbar"><i style="width:${n/7*100}%"></i></div>
  <div class="fake"><div class="bar"><span>⚠</span><span>http://stars-d1scounts.example</span></div><div class="page">
    ${H('domain','<b>⭐ متجر خصومات النجوم</b> — عنوان الموقع في الأعلى')}
    <div class="grid2">${H('logo','🛍️ شعار المتجر')}${H('menu','📂 الأقسام: هواتف · حواسيب · ساعات')}</div>
    ${H('disc','<span class="big-badge">-90%</span> على كل الأجهزة')}
    ${H('timer','⏰ ينتهي العرض خلال <b>09:59</b>')}
    <div class="grid2">${H('seller','🏢 من نحن: «نحن أفضل متجر»')}${H('ret','↩️ الاسترجاع')}</div>
    ${H('rev','⭐⭐⭐⭐⭐ «ممتاز جدا اشتريت وعجبني» ×12')}
    ${H('pay','💳 الدفع: حوّلي المبلغ إلى الحساب الشخصي المذكور')}
  </div></div>
  <p class="note" style="margin-top:8px">هذه صفحة تدريبية وهمية، وليست متجرًا حقيقيًا.</p>
  ${n>=5?`<div class="fb ok">أحسنتِ! جمعتِ ما يكفي من الأدلة. أهم علامات الاحتيال: عنوان مشبوه، خصم مبالغ فيه، عدّاد ضغط، دفع غير محمي، غموض البائع، غياب الإرجاع.</div>`:''}` + nav('secure','life');
};

V.life = () => {
  const sel = S.lifeSel;
  const cards = D.life.map(l=>`<a class="lifecard ${sel===l.id?'open':''}" href="#/life/${l.id}" style="text-decoration:none;color:inherit;display:block" data-act="life" data-id="${l.id}" aria-label="${esc(l.t)}">
    <div class="ico">${l.ico}</div><h3>${esc(l.t)}</h3><p style="margin:0;color:var(--muted)">${esc(l.d)}</p>
    <span class="tag ${S.lifeOpen.includes(l.id)?'good':''}">${S.lifeOpen.includes(l.id)?'تم الاطلاع ✔':'اضغطي للعرض'}</span></a>`).join('');
  let panel = '';
  const cur = D.life.find(l=>l.id===sel);
  if(cur){
    panel = `<div style="margin-top:16px" id="lifePanel"><h3>${cur.ico} ${esc(cur.t)}</h3><img class="slide" src="${cur.img}" alt="${esc(cur.alt)}">`;
    if(cur.id==='math') panel += `<div class="card white" style="margin-top:12px"><b>🧮 جرّبي بنفسك: احسبي نسبة الخصم</b>
      <div class="calc"><div class="field" style="margin:0"><label for="cOld">السعر الأصلي</label><input id="cOld" type="number" min="1" inputmode="decimal" value="1899"></div>
      <div class="field" style="margin:0"><label for="cNew">السعر بعد الخصم</label><input id="cNew" type="number" min="0" inputmode="decimal" value="99"></div>
      <button class="btn" type="button" data-act="calc">احسبي</button></div><div id="calcOut" class="fb ok" style="display:none"></div></div>`;
    panel += `</div>`;
  }
  return head('الربط','🌍 الربط بالحياة','ثلاثة ارتباطات تجعل الدرس أقرب إلى حياتك. افتحي كل بطاقة.') +
    `<div class="grid3">${cards}</div>${panel}` + nav('fraud','sim');
};

/* ----- محاكاة المتجرين ----- */
function storeMock(sid){
  if(sid==='A') return `<div class="browser"><div class="bar"><div class="dots"><i></i><i></i><i></i></div><div class="lock"><span class="g">🔒</span> https://www.nasma-boutique.com.sa</div></div>
  <div class="shop sa"><h4>بوتيك نسمة</h4><div class="banner a"><b>تشكيلة الخريف وصلت</b><br><small>شحن خلال 3 أيام · إرجاع خلال 14 يومًا</small></div>
  <div class="prods"><div class="prod"><i></i>عباءة كريب<div class="price">189 ر.س</div></div><div class="prod"><i></i>حقيبة جلد<div class="price">240 ر.س</div><s>بدل 282 (خصم 15%)</s></div><div class="prod"><i></i>وشاح حرير<div class="price">95 ر.س</div></div></div>
  <div class="foot"><span>سياسة الخصوصية</span><span>الإرجاع والاستبدال</span><span>اتصل بنا: 800 123 4567</span><span>info@nasma-boutique.com.sa</span><span>سجل تجاري موثّق</span><span>Visa · Apple Pay · مدى</span></div></div>
  <div class="shop-note">صورة توضيحية لمتجر وهمي صُمّم للتدريب فقط.</div></div>`;
  return `<div class="browser"><div class="bar"><div class="dots"><i></i><i></i><i></i></div><div class="lock"><span class="r">⚠</span> http://supperr-deal99.shopp-xyz.top</div><span class="badge">غير آمن</span></div>
  <div class="shop sb"><h4 style="color:#b3141b">سوبر ديل 99</h4><div class="banner b"><span style="font-size:1.2rem">خصم 90% لأول 50 زبونة فقط!!</span><br><small>ينتهي العرض بعد 09:59 · اشتري الآن وفّري الكثير</small></div>
  <div class="prods"><div class="prod"><i></i>حقيبة ماركة<div class="price">99 ر.س</div><s>بدل 1,899</s></div><div class="prod"><i></i>ساعة ذكية<div class="price">49 ر.س</div><s>بدل 899</s></div><div class="prod"><i></i>عطر فاخر<div class="price">29 ر.س</div><s>بدل 750</s></div></div>
  <div class="foot"><span>واتساب فقط: 05xxxxxxxx</span></div><div class="scam">مبروك! أرسلي رمز التحقق الذي وصلك على واتساب لتأكيد جائزتك.</div></div>
  <div class="shop-note">صورة توضيحية لمتجر وهمي صُمّم للتدريب فقط.</div></div>`;
}
function meterHtml(sid){
  const c = counts(sid);
  return `<div class="meter"><div class="m t">✔ مؤشرات الثقة: ${c.trust}</div><div class="m w">⚠ مؤشرات التحذير: ${c.warn}</div><div class="m d">⛔ مؤشرات خطرة: ${c.danger}</div></div>`;
}
function storeStep(sid){
  const store = D.stores[sid], st = S.sim[sid], c = counts(sid);
  const rows = D.checks.map((k,i)=>{
    const a = st.ans[k.id], w = st.wrong[k.id];
    let fb = '';
    if(a !== undefined){ const tv = store.truth[k.id]; const kind = k.id==='otp' ? (tv?'danger':'ok') : (tv?'ok':'no'); fb = `<div class="fb ${kind}">${esc(store.notes[k.id])} ${effectTag(sid,k.id)}</div>`; }
    else if(w !== undefined) fb = `<div class="fb no">💡 ${esc(store.hints[k.id])}</div>`;
    const cls = v => { if(a!==undefined) return a===v?'ok':''; return (w===v)?'no':''; };
    return `<div class="yn"><div class="row"><b>${i+1}. ${esc(k.q)}</b><div class="btns">
      <button class="pill ${cls(true)}" type="button" data-act="ans" data-s="${sid}" data-c="${k.id}" data-v="1" ${a!==undefined?'disabled':''}>نعم</button>
      <button class="pill ${cls(false)}" type="button" data-act="ans" data-s="${sid}" data-c="${k.id}" data-v="0" ${a!==undefined?'disabled':''}>لا</button></div></div>${fb}</div>`;
  }).join('');
  const done = c.answered === 5;
  return `<h3>المتجر ${sid==='A'?'الأول':'الثاني'}: ${esc(store.name)}</h3>${storeMock(sid)}${meterHtml(sid)}${rows}
  ${done?`<div class="fb ok">✅ أنهيتِ فحص ${esc(store.name)}.</div>`:'<p class="gate">أجيبي عن الأسئلة الخمسة لتتابعي.</p>'}
  <div class="navrow no-print"><button class="btn ghost" type="button" data-act="simgo" data-n="${sid==='A'?0:1}">→ السابق</button>
  <button class="btn gold" type="button" data-act="simgo" data-n="${sid==='A'?2:3}" ${done?'':'disabled'}>${sid==='A'?'إلى المتجر الثاني ←':'إلى المقارنة ←'}</button></div>`;
}
function effectTag(sid, cid){
  const v = D.stores[sid].truth[cid];
  if(cid==='otp') return v ? '<span class="tag bad">⛔ مؤشر خطر</span>' : '<span class="tag good">✔ مؤشر ثقة</span>';
  return v ? '<span class="tag good">✔ مؤشر ثقة</span>' : '<span class="tag bad">⚠ مؤشر تحذير</span>';
}
function compareStep(){
  const row = k => `<tr><td class="l"><b>${esc(k.short)}</b></td>${['A','B'].map(sid=>{
    const v = S.sim[sid].ans[k.id]; const t = D.stores[sid].truth[k.id]; const good = (k.id==='otp') ? !t : t;
    return `<td class="${good?'yes':'no'}">${v?'نعم':'لا'} ${good?'✔':(k.id==='otp'&&t?'⛔':'⚠')}</td>`; }).join('')}</tr>`;
  const cA = counts('A'), cB = counts('B');
  return `<h3>📊 مقارنة المتجرين</h3><div class="scroll" style="overflow-x:auto"><table class="cmp"><thead><tr><th>المعيار</th><th>${esc(D.stores.A.name)}</th><th>${esc(D.stores.B.name)}</th></tr></thead><tbody>
   ${D.checks.map(row).join('')}
   <tr><td class="l"><b>مؤشرات الثقة</b></td><td class="yes">${cA.trust}</td><td class="yes">${cB.trust}</td></tr>
   <tr><td class="l"><b>مؤشرات التحذير</b></td><td class="no">${cA.warn}</td><td class="no">${cB.warn}</td></tr>
   <tr><td class="l"><b>مؤشرات خطرة</b></td><td class="no">${cA.danger}</td><td class="no">${cB.danger}</td></tr></tbody></table></div>
   <div class="card" style="margin-top:12px"><b>🔎 لاحظي:</b> وجود HTTPS أو سياسة خصوصية وحده لا يكفي للحكم، وطلب رمز التحقق أو كلمة المرور بطريقة مريبة علامة تحذير قوية تغلب بقية المؤشرات.</div>
   <div class="navrow no-print"><button class="btn ghost" type="button" data-act="simgo" data-n="2">→ السابق</button><button class="btn gold" type="button" data-act="simgo" data-n="4">إصدار القرار ←</button></div>`;
}
function decisionStep(){
  const card = sid => {
    const st = S.sim[sid], store = D.stores[sid];
    const opts = D.decisionOpts.map(o=>`<button class="opt ${st.dec===o.k?'sel':''}" type="button" data-act="dec" data-s="${sid}" data-k="${o.k}" ${st.final?'disabled':''}>${o.t}</button>`).join('');
    const ev = D.checks.map(k=>`<label><input type="checkbox" data-bind="ev" data-s="${sid}" data-c="${k.id}" ${st.ev.includes(k.id)?'checked':''} ${st.final?'disabled':''}>${esc(k.short)}</label>`).join('');
    const ok = st.dec && st.ev.length>0 && st.why.trim().length>=15;
    return `<div class="card white" style="margin-bottom:14px"><h3>${esc(store.name)}</h3>${meterHtml(sid)}
      <div class="opts">${opts}</div>
      <p style="margin:8px 0 4px"><b>الأدلة التي استندتِ إليها:</b></p><div class="checks">${ev}</div>
      <div class="field"><label for="why-${sid}">اكتبي سبب قرارك (15 حرفًا على الأقل)</label><textarea id="why-${sid}" rows="3" data-bind="why" data-s="${sid}" maxlength="500" ${st.final?'disabled':''} placeholder="قراري هو ... لأنني وجدت أن ...">${esc(st.why)}</textarea></div>
      ${st.msg?`<div class="fb ${st.final?'ok':'no'}">${st.msg}</div>`:''}
      ${st.final?'':`<button class="btn gold" type="button" id="sub-${sid}" data-act="submitdec" data-s="${sid}" ${ok?'':'disabled'}>أصدري القرار ✅</button>`}</div>`;
  };
  const both = S.sim.A.final && S.sim.B.final;
  return `<h3>⚖️ قرار المحققة الرقمية</h3><p class="lead">اتخذي قرارًا لكل متجر، واستندي إلى الأدلة.</p>${card('A')}${card('B')}
   <div class="navrow no-print"><button class="btn ghost" type="button" data-act="simgo" data-n="3">→ السابق</button><button class="btn gold" type="button" data-act="simgo" data-n="5" ${both?'':'disabled'}>عرض بطاقة القرار ←</button></div>`;
}
function finalStep(){
  const cardOf = sid => {
    const st = S.sim[sid], store = D.stores[sid], c = counts(sid), rec = sysRec(sid);
    const ans = D.checks.map(k=>`${esc(k.short)}: <b>${st.ans[k.id]?'نعم':'لا'}</b>`).join(' · ');
    return `<div class="decision"><h3>🏅 قرار المحققة الرقمية</h3><dl>
      <dt>المتجر الافتراضي</dt><dd><b>${esc(store.name)}</b></dd>
      <dt>إجاباتكِ</dt><dd>${ans}</dd>
      <dt>مؤشرات الثقة والتحذير</dt><dd>ثقة: <b>${c.trust}</b> · تحذير: <b>${c.warn}</b> · خطرة: <b>${c.danger}</b></dd>
      <dt>قراركِ</dt><dd><b>${decText(st.dec)}</b></dd>
      <dt>التوصية النهائية</dt><dd><b>${rec==='yes'?'يمكن الاعتماد على المتجر مع بقاء الحذر':rec==='no'?'لا ينصح بالتعامل مع المتجر (يوجد مؤشر خطر)':'تلزم أدلة إضافية قبل القرار'}</b>${st.mismatch?'<br><small>قراركِ الأول اختلف عن توصية الأدلة، وقد راجعتِه.</small>':''}</dd>
      <dt>مبررات القرار</dt><dd>${esc(st.why)}<br><small>الأدلة: ${st.ev.map(id=>esc((D.checks.find(k=>k.id===id)||{}).short)).join('، ')}</small></dd></dl></div>`;
  };
  return `<div class="no-print" style="text-align:center"><div style="height:220px;display:flex;justify-content:center">${lumaImg('achieve').replace('<img','<img style="max-height:100%;object-fit:contain"')}</div></div>
   <h3 style="text-align:center">أحسنتِ أيتها المحققة! أنهيتِ مهمة المتجرين 🎉</h3>${cardOf('A')}${cardOf('B')}
   <div class="navrow no-print"><button class="btn ghost" type="button" data-act="print">🖨️ طباعة البطاقتين</button><button class="btn gold" type="button" data-act="goto" data-id="exit">إلى مهمة الخروج الكبرى ←</button></div>
   <div class="exitrow no-print">${S.sim.issued
     ? `<button class="btn purple exitbtn" type="button" data-act="exitask"><span aria-hidden="true">🚪</span> إنهاء المغامرة والخروج</button>`
     : `<button class="btn purple exitbtn" type="button" disabled aria-disabled="true"><span aria-hidden="true">🚪</span> إنهاء المغامرة والخروج</button><p class="note">يتفعّل الزر بعد إتمام تقييم المتجرين وإصدار البطاقتين.</p>`}
     <p class="exit-hint">تبقى نتائجكِ وبطاقتاكِ محفوظتين عند الخروج.</p></div>`;
}
V.sim = () => {
  const step = S.sim.step;
  const names = ['اسم المجموعة','المتجر الأول','المتجر الثاني','المقارنة','القرار','البطاقة'];
  const sub = `<div class="substeps">${names.map((n,i)=>`<span class="${i===step?'on':(i<step?'dn':'')}">${i+1}. ${n}</span>`).join('')}</div>`;
  let body = '';
  if(step===0){
    body = `<div class="card white"><div class="field"><label for="grp">اسم المجموعة (يُحفظ في لوحة المعلمة)</label><input id="grp" data-bind="group" value="${esc(S.group)}" maxlength="30" placeholder="مثال: مجموعة المحققات الذكيات"></div>
      <p class="note">استخدمي اسمًا للمجموعة فقط، ولا تكتبي بيانات شخصية. هذه متاجر محاكاة تعليمية ولا تطلب أي بيانات بنكية.</p>
      <div class="navrow no-print"><button class="btn ghost" type="button" data-act="goto" data-id="life">→ السابق</button>
      <button class="btn gold" id="grpGo" type="button" data-act="simgo" data-n="1" ${S.group.trim().length>=2?'':'disabled'}>ابدئي فحص المتجر الأول ←</button></div>
      ${S.group?`<button class="btn ghost sm" type="button" data-act="newgroup">🔄 بدء مجموعة جديدة على هذا الجهاز</button>`:''}</div>`;
  } else if(step===1) body = storeStep('A');
  else if(step===2) body = storeStep('B');
  else if(step===3) body = compareStep();
  else if(step===4) body = decisionStep();
  else body = finalStep();
  return head('التطبيق الجماعي','🛒 التطبيق الجماعي: محققة المتجر الإلكتروني', S.group?`المجموعة: <b>${esc(S.group)}</b>`:'اعملي مع مجموعتك لفحص متجرين افتراضيين وإصدار قرار.') + sub + body;
};

/* ----- مهمة الخروج ----- */
V.exit = () => {
  const e = S.exit;
  return head('المهمة الختامية','🏆 مهمة الخروج الكبرى – محققة المتجر الإلكتروني','أجيبي عن الأسئلة داخل اللعبة لتثبتي أنكِ محققة رقمية متمكنة.') +
  `<div class="featured" style="margin-bottom:12px"><b>📋 نتيجة مجموعتكن:</b> <span id="gameStat">${gameStatText()}</span>
    <details style="margin-top:6px"><summary>لم تظهر النتيجة تلقائيًا؟ أدخليها يدويًا</summary>
      <div class="calc" style="grid-template-columns:1fr auto"><div class="field" style="margin:0"><label for="mp">النقاط من 50</label><input id="mp" type="number" min="0" max="50" inputmode="numeric" value="${e.points==null?'':e.points}"></div><button class="btn sm" type="button" data-act="savepoints">حفظ</button></div></details></div>
  <div class="gamebox"><iframe id="gameFrame" src="${esc(C.GAME_LOCAL)}" title="لعبة مهمة الخروج الكبرى" loading="lazy" allow="fullscreen"></iframe></div>
  <p style="margin-top:10px"><a class="btn ghost sm" href="${esc(C.GAME_ARTIFACT_URL)}" target="_blank" rel="noopener noreferrer">↗ فتح اللعبة في نافذة جديدة</a>
  <span class="gate">إن لم تظهر اللعبة داخل الصفحة فافتحيها من هذا الزر.</span></p>` + nav('sim','eval');
};
function gameStatText(){
  const e = S.exit;
  if(e.points==null) return 'لم تبدأ اللعبة بعد، أو لم تظهر نتيجتها بعد.';
  return `${e.points} / 50 نقطة${e.correct!=null?' · إجابات صحيحة من المحاولة: '+e.correct+' من 5':''}${e.done?' · اكتملت المهمة ✔':' · قيد الحل'}${e.auto?'':' (أُدخلت يدويًا)'}`;
}
function readGame(){
  try{
    const raw = localStorage.getItem(C.GAME_STORE_KEY); if(!raw) return null;
    const d = JSON.parse(raw); if(!d || !Array.isArray(d.q)) return null;
    return {points:Math.min(50, d.q.reduce((n,x)=>n+(x.pts||0),0)), correct:d.q.filter(x=>x.status==='correct').length, done:d.screen==='results'};
  }catch(e){ return null; }
}
let poll = null;
function startPoll(){
  stopPoll();
  poll = setInterval(()=>{
    const g = readGame(); if(!g) return;
    const e = S.exit; const was = e.done;
    if(e.points!==g.points || e.correct!==g.correct || e.done!==g.done || !e.auto){
      e.points=g.points; e.correct=g.correct; e.done=g.done; e.auto=true; save();
      const el = $('#gameStat'); if(el) el.textContent = gameStatText();
      updateProgress();
      if(g.done && !was){ burst(40); luma('achieve','أحسنتِ أيتها المحققة! أنهيتِ مهمة الخروج الكبرى.'); pushRecord(); }
    }
  }, 1500);
}
function stopPoll(){ if(poll){ clearInterval(poll); poll=null; } }

/* ----- التقييم ----- */
V.eval = () => head('التقييم','⭐ تقييم الدرس التطبيقي') +
  `<div class="evalcard"><div class="big">⭐</div><h2 style="margin:.1em 0">رأيك يهمنا</h2>
   <p style="font-size:1.1rem">نسعد بمشاركتك في تقييم الدرس التطبيقي؛ فملاحظاتك تسهم في تطوير التجربة التعليمية.</p>
   <a class="btn gold" href="${esc(C.EVAL_URL)}" target="_blank" rel="noopener noreferrer" data-act="evalopen">ابدئي تقييم الدرس 📝</a>
   <p style="margin-top:12px"><button class="btn ghost sm" type="button" data-act="evalembed">عرض النموذج هنا داخل الصفحة</button></p>
   ${S.evalOpened?'<div class="fb ok">شكرًا لكِ! تم فتح نموذج التقييم.</div>':''}</div>
   <div class="evalframe" id="evalFrame"></div>
   <p class="note" style="margin-top:12px">إذا ظهر النموذج فارغًا داخل الصفحة (بعض إعدادات Microsoft Forms تمنع التضمين) فاستخدمي زر «ابدئي تقييم الدرس» ليفتح في نافذة جديدة.</p>` + nav('exit','');

/* ---------- التنقل ---------- */
function go(id, sub){
  if(id==='teacher') return openTeacher();
  if(!V[id]) id = 'home';
  stopPoll();
  S.cur = id; S.seen[id] = true;
  if(id==='life'){ if(sub && D.life.some(l=>l.id===sub)){ S.lifeSel = sub; if(!S.lifeOpen.includes(sub)) S.lifeOpen.push(sub); } }
  $('#layout').classList.remove('teacher-mode');
  const e = ENTER[id]; if(e) luma(e.i, e.t);
  save(); render();
  const h = id==='life' && sub ? '#/life/'+sub : '#/'+id;
  if(location.hash !== h) history.replaceState(null,'',h);
  if(!sub || id!=='life') window.scrollTo({top:0,behavior:'smooth'});
  if(id==='exit') startPoll();
}
function backbar(){
  const t = D.tabs.find(x=>x.id===S.cur); if(!t) return '';
  return `<div class="backbar no-print"><button class="back" type="button" data-act="goto" data-id="home">→ الرئيسية</button><span class="crumb">${t.ico} ${esc(t.label)}</span><span class="mini-pg"><span data-pg-text></span><i class="bar"><b data-pg-bar></b></i></span></div>`;
}
function render(){
  $('#stage').innerHTML = (S.cur==='home' ? '' : backbar()) + V[S.cur]();
  document.body.classList.toggle('is-home', S.cur==='home');
  renderTabs(); updateProgress();
  afterRender();
}
function afterRender(){
  if(S.cur==='video'){
    const v = $('#vid'); if(!v) return;
    const show = () => { if(!S.videoEnded){ S.videoEnded = true; save(); } const q=$('#vidQs'); if(q) q.hidden=false; const b=$('#vidDone'); if(b) b.hidden=true; updateProgress(); };
    v.addEventListener('ended', show);
    v.addEventListener('timeupdate', ()=>{ if(v.duration && v.currentTime/v.duration>0.9 && !S.videoEnded) show(); });
    v.addEventListener('error', ()=>{ const e=$('#vidErr'); if(e) e.hidden=false; const b=$('#vidDone'); if(b && !S.videoEnded) b.hidden=false; }, true);
    const src = v.querySelector('source'); if(src) src.addEventListener('error', ()=>{ const e=$('#vidErr'); if(e) e.hidden=false; const b=$('#vidDone'); if(b && !S.videoEnded) b.hidden=false; });
  }
  if(S.cur==='life' && S.lifeSel){ const p=$('#lifePanel'); if(p) setTimeout(()=>p.scrollIntoView({behavior:'smooth',block:'start'}),50); }
}
const GATE_KEY = 'dd2_in';
function entered(){ try{ return sessionStorage.getItem(GATE_KEY)==='1'; }catch(e){ return true; } }
function showGate(msg){
  stopPoll(); closeExitDlg();
  document.body.classList.add('gated');
  let g = $('#gate'); if(!g){ g = document.createElement('div'); g.id='gate'; document.body.appendChild(g); }
  const prev = S.group ? `<p class="gate-prev">آخر مجموعة على هذا الجهاز: <b>${esc(S.group)}</b>. اكتبي الاسم نفسه لمتابعة تقدّمكم، أو اسمًا جديدًا لبدء تجربة جديدة.</p>` : '';
  g.innerHTML = `<div class="gate-card" role="dialog" aria-modal="true" aria-labelledby="gT">
    <div class="gate-luma">${lumaImg('welcome')}</div>
    <div class="gate-body">
      <span class="gate-chip">${esc(C.subject)} · ${esc(C.grade)}</span>
      <h1 id="gT">أهلًا بكِ في الدرس التطبيقي</h1>
      <div class="gate-lesson"><span>اسم الدرس</span><b>${esc(C.lessonTitle)}</b></div>
      <p class="gate-ask">يشرفنا التعرّف باسمكِ أو اسم مجموعتكِ</p>
      <div class="field"><label for="gateName" class="sr">اسمك أو اسم مجموعتك</label>
        <input id="gateName" maxlength="30" autocomplete="off" value="${esc(S.group)}" placeholder="مثال: مجموعة المحققات الذكيات"></div>
      <p class="note">اكتبي اسمًا للمجموعة أو الاسم الأول فقط، ولا تكتبي بيانات شخصية أخرى.</p>
      ${prev}
      <div id="gateMsg" class="fb no" ${msg?'':'hidden'}>${esc(msg||'')}</div>
      <button class="btn purple gate-go" id="gateGo" type="button">ادخلي إلى المغامرة ✨</button>
      <div class="gate-foot"><a href="#/teacher" id="gateT">🔐 دخول المعلمة</a></div>
    </div></div>`;
  const inp = g.querySelector('#gateName'); setTimeout(()=>inp.focus(),50);
  const go1 = ()=>{
    const name = inp.value.trim();
    if(name.length<2) return showGate('اكتبي اسمًا لا يقل عن حرفين.');
    if(name!==S.group){ const lh=S.lumaHidden; S = fresh(); S.lumaHidden=lh; S.group=name; }
    S.started = true; save();
    try{ sessionStorage.setItem(GATE_KEY,'1'); }catch(e){}
    hideGate(); luma('welcome','أهلًا '+name+'! هيا نبدأ المغامرة.'); go('home'); pushRecord();
  };
  g.querySelector('#gateGo').onclick = go1;
  inp.addEventListener('keydown', e=>{ if(e.key==='Enter') go1(); });
  g.querySelector('#gateT').addEventListener('click', ()=>{ hideGate(); });
}
function hideGate(){ const g=$('#gate'); if(g) g.remove(); document.body.classList.remove('gated'); }
function leave(){ try{ sessionStorage.removeItem(GATE_KEY); sessionStorage.removeItem('dd2_unlocked'); }catch(e){} history.replaceState(null,'',location.pathname+location.search); showGate(); }
function route(){
  const m = (location.hash||'').replace(/^#\/?/,'').split('/');
  if(m[0]!=='teacher' && !entered()) return showGate();
  hideGate();
  const id = m[0] || S.cur || 'home';
  go(id, m[1]);
}

/* ---------- الأحداث ---------- */
document.addEventListener('click', e=>{
  const t = e.target.closest('[data-act]'); if(!t) return;
  const a = t.dataset.act;
  if(a==='goto'){ e.preventDefault(); return go(t.dataset.id); }
  if(a==='start'){ S.started = true; return go('goals'); }
  if(a==='life'){ e.preventDefault(); return go('life', t.dataset.id); }
  if(a==='pick'){ const st = S.mcq[t.dataset.q] || (S.mcq[t.dataset.q]={}); st.sel = +t.dataset.i; st.checked = false; save(); return render(); }
  if(a==='check'){ const q = allMcq().find(x=>x.id===t.dataset.q); checkMcq(q); save(); render(); if(q.id==='https'||S.mcq[q.id].solved) pushRecord(); return; }
  if(a==='clue'){
    const c = D.clues.find(x=>x.id===t.dataset.id);
    if(c.real){ if(!S.clues.includes(c.id)){ S.clues.push(c.id); burst(5); } luma('clue', c.text); }
    else{ if(!S.plain.includes(c.id)) S.plain.push(c.id); luma('encourage', c.text); }
    save(); return render();
  }
  if(a==='calc'){
    const o = parseFloat($('#cOld').value), n = parseFloat($('#cNew').value), out = $('#calcOut');
    out.style.display = 'block';
    if(!(o>0) || !(n>=0) || n>o){ out.className='fb no'; out.textContent='أدخلي سعرًا أصليًا أكبر من صفر وسعرًا بعد الخصم لا يتجاوزه.'; return; }
    const d = o-n, p = Math.round(d/o*1000)/10;
    out.className = 'fb ' + (p>=70?'danger':'ok');
    out.textContent = `مقدار الخصم = ${o} − ${n} = ${d}. نسبة الخصم = ${d} ÷ ${o} × 100 = ${p}%. ` + (p>=70?'خصم كبير جدًا قد يكون مؤشرًا على الاحتيال!':'خصم يبدو أقرب إلى المعقول، لكن افحصي بقية الأدلة.');
    luma('thinking', p>=70?'انتبهي! خصم بهذا الحجم يستدعي التحقق قبل أي خطوة.':'جيد! والآن قارني ذلك ببقية المؤشرات.'); return;
  }
  if(a==='vidshow'){ S.videoEnded = true; save(); const q=$('#vidQs'); if(q) q.hidden=false; t.hidden=true; updateProgress(); return; }
  /* المحاكاة */
  if(a==='simgo'){
    const n = +t.dataset.n;
    if(n>=1 && S.group.trim().length<2){ return; }
    S.sim.step = n; save();
    if(n===5){ if(S.sim.A.final && S.sim.B.final){ S.sim.issued = true; save(); } burst(40); luma('achieve','أحسنتِ أيتها المحققة! لقد جمعتِ الأدلة، وحللتِ المؤشرات، واتخذتِ قرارًا واعيًا.'); pushRecord(); }
    else if(n===1||n===2) luma('clue', n===1 ? 'ابدئي بفحص واجهة المتجر. هل وجدتِ معلومات واضحة عن البائع؟' : 'متجر جديد وأدلة جديدة! تحققي من وسائل الدفع وسياسة الخصوصية.');
    else if(n===3) luma('thinking','سجلي ملاحظاتك، ولا تعتمدي على الانطباع وحده. قارني المتجرين.');
    else if(n===4) luma('thinking','ما الدليل الأقوى الذي استندتِ إليه في قرارك؟');
    render(); window.scrollTo({top:0,behavior:'smooth'}); return;
  }
  if(a==='ans'){
    const sid = t.dataset.s, cid = t.dataset.c, v = t.dataset.v==='1', st = S.sim[sid];
    st.tries[cid] = (st.tries[cid]||0)+1;
    if(v === D.stores[sid].truth[cid]){
      st.ans[cid] = v; delete st.wrong[cid]; if(st.tries[cid]===1) st.first[cid] = true;
      luma(cid==='otp'&&v ? 'clue':'encourage', cid==='otp'&&v ? 'انتبهي! هذه أخطر علامة. لا نشارك رمز التحقق مع أحد.' : pick(['إجابة موفقة! سجلي الدليل.','أحسنتِ، ملاحظة دقيقة.','هكذا تفحص المحققة!']));
    } else { st.wrong[cid] = v; luma('encourage','أعيدي النظر في المتجر بعناية؛ هذا تلميح يساعدكِ.'); }
    save(); return render();
  }
  if(a==='dec'){ const st = S.sim[t.dataset.s]; st.dec = t.dataset.k; save(); return render(); }
  if(a==='submitdec'){
    const sid = t.dataset.s, st = S.sim[sid]; if(!st.dec) return;
    if(!st.firstDec) st.firstDec = st.dec;
    const rec = sysRec(sid), c = counts(sid); st.dtries++;
    if(st.dec === rec){ st.final = true; st.msg = '✔ قرار مدعوم بالأدلة. أحسنتِ!'; luma('encourage','قرار واعٍ ومبني على الأدلة!'); burst(14); }
    else if(st.dtries >= 2){ st.final = true; st.mismatch = true; st.msg = 'سُجّل قراركِ. لاحظي أن الأدلة تقود إلى: «'+decText(rec)+'». ستجدين التفاصيل في البطاقة الختامية.'; luma('encourage','لا بأس، راجعي الأدلة في البطاقة الختامية.'); }
    else{
      st.msg = '💡 ' + (rec==='no' ? 'لاحظي وجود مؤشر خطر (طلب رمز التحقق). هذا مؤشر لا يمكن تجاهله مهما بدت بقية الأمور.' :
                rec==='yes' ? 'راجعي مؤشرات الثقة: ما عددها؟ وهل ظهر أي مؤشر خطر؟' : 'هل الأدلة التي جمعتِها كافية لقرار؟ راجعي عدد مؤشرات الثقة (' + c.trust + ') والتحذير (' + c.warn + ').');
      luma('encourage','فكري مجددًا؛ الأدلة تتحدث بوضوح. جرّبي قرارًا آخر.');
    }
    save(); render(); if(S.sim.A.final && S.sim.B.final) pushRecord(); return;
  }
  if(a==='togate'){ return leave(); }
  if(a==='exitask'){ if(S.sim.issued) showExitDlg(); return; }
  if(a==='exitclose'){ closeExitDlg(); return; }
  if(a==='exithome'){ closeExitDlg(); return go('home'); }
  if(a==='exitend'){ closeExitDlg(); S.sim.exited = true; save(); pushRecord(); burst(24); return go('bye'); }
  if(a==='newgroup'){ if(confirm('سيتم بدء مجموعة جديدة ومسح تقدم هذا الجهاز الحالي (نتائج المجموعة السابقة تبقى محفوظة في لوحة المعلمة). هل تريدين المتابعة؟')){ const lh = S.lumaHidden; S = fresh(); S.started = true; S.lumaHidden = lh; save(); go('sim'); } return; }
  if(a==='print'){ window.print(); return; }
  if(a==='savepoints'){
    const v = parseInt($('#mp').value,10);
    if(isNaN(v) || v<0 || v>50){ luma('encourage','أدخلي رقمًا بين 0 و50.'); return; }
    S.exit.points = v; S.exit.auto = false; S.exit.done = true; save(); const el=$('#gameStat'); if(el) el.textContent = gameStatText(); updateProgress(); luma('achieve','تم تسجيل نتيجتكن. أحسنتن!'); pushRecord(); return;
  }
  if(a==='evalopen'){ S.evalOpened = true; save(); updateProgress(); luma('goodbye','شكرًا لكِ! رأيكِ يهمنا.'); burst(20); pushRecord(); return; }
  if(a==='evalembed'){
    const f = $('#evalFrame'); S.evalOpened = true; save(); updateProgress();
    f.innerHTML = `<iframe src="${esc(C.EVAL_URL)}" title="نموذج تقييم الدرس" referrerpolicy="no-referrer"></iframe>`; return;
  }
});
document.addEventListener('input', e=>{
  const t = e.target, b = t.dataset && t.dataset.bind; if(!b) return;
  if(b==='vans'){ S.vAns[t.dataset.i] = t.value; save(); updateProgress(); }
  else if(b==='group'){ S.group = t.value; const g=$('#grpGo'); if(g) g.disabled = S.group.trim().length<2; save(); }
  else if(b==='why'){ const st = S.sim[t.dataset.s]; st.why = t.value; const sub=$('#sub-'+t.dataset.s); if(sub) sub.disabled = !(st.dec && st.ev.length>0 && st.why.trim().length>=15); save(); }
});
document.addEventListener('change', e=>{
  const t = e.target, b = t.dataset && t.dataset.bind; if(!b) return;
  if(b==='voral'){ S.vOral[t.dataset.i] = t.checked; save(); updateProgress(); }
  else if(b==='ev'){ const st = S.sim[t.dataset.s]; const i = st.ev.indexOf(t.dataset.c);
    if(t.checked && i<0) st.ev.push(t.dataset.c); if(!t.checked && i>=0) st.ev.splice(i,1);
    const sub=$('#sub-'+t.dataset.s); if(sub) sub.disabled = !(st.dec && st.ev.length>0 && st.why.trim().length>=15); save(); }
});
window.addEventListener('hashchange', route);

/* ---------- المعلمة ---------- */
function openTeacher(){
  stopPoll(); S.cur = 'teacher';
  $('#layout').classList.add('teacher-mode');
  document.body.classList.remove('is-home');
  Teacher.render($('#stage'), {getRecords, setRecords, C, D, esc, back:()=>{ location.hash='#/home'; route(); }, exit:()=>leave()});
  window.scrollTo({top:0});
}

function showExitDlg(){
  closeExitDlg();
  const d = document.createElement('div'); d.className='exitdlg'; d.id='exitDlg';
  d.innerHTML = `<div class="exitdlg-box" role="dialog" aria-modal="true" aria-labelledby="exT">
    <div class="exitdlg-luma">${lumaImg('achieve')}</div>
    <h3 id="exT">لمى المحققة</h3>
    <p>أحسنتِ أيتها المحققة! أتممتِ مهمتك بنجاح، وأصبحتِ أكثر وعيًا بالتسوق الآمن عبر الإنترنت. نلتقي في مغامرة جديدة!</p>
    <div class="exitdlg-btns">
      <button class="btn ghost" type="button" data-act="exithome">🏠 العودة إلى الصفحة الرئيسة</button>
      <button class="btn purple" type="button" data-act="exitend" id="exFirst">🚪 إنهاء التجربة</button>
    </div>
    <button class="exitdlg-x" type="button" data-act="exitclose" aria-label="إغلاق">×</button></div>`;
  document.body.appendChild(d);
  const f = d.querySelector('#exFirst'); if(f) f.focus();
  d.addEventListener('keydown', e=>{ if(e.key==='Escape') closeExitDlg(); });
}
function closeExitDlg(){ const d=$('#exitDlg'); if(d) d.remove(); }

function start(){
  $('#lumaHide').addEventListener('click', ()=>setLumaHidden(true));
  $('#lumaShow').addEventListener('click', ()=>setLumaHidden(false));
  setLumaHidden(!!S.lumaHidden);
  route();
}
return {start, state:()=>S, go, tabDone, progressPct, counts, sysRec, readGame, buildRecord};
})();
