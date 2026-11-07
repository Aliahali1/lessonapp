/* ========== لوحة المعلمة ========== */
const Teacher = (function(){
const PINKEY = 'dd2_pin', TOK = 'dd2_unlocked';
let ctx = null, root = null;

function hash(s){ let h = 5381; for(let i=0;i<s.length;i++){ h = ((h<<5)+h) ^ s.charCodeAt(i); } return String(h>>>0); }
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function pinSet(){ try{ return localStorage.getItem(PINKEY); }catch(e){ return null; } }
function unlocked(){ try{ return sessionStorage.getItem(TOK)==='1'; }catch(e){ return false; } }

function render(container, c){
  ctx = c; root = container;
  if(!pinSet()) return viewSetPin();
  if(!unlocked()) return viewLogin();
  viewDash();
}

function shell(inner){
  root.innerHTML = `<div class="tp"><span class="chip">منطقة المعلمة</span>${inner}</div>`;
}
function viewSetPin(msg){
  shell(`<h2>👩‍🏫 لوحة المعلمة</h2><p class="lead">أنشئي رمز دخول للوحة (4 أرقام أو أكثر). يُحفظ على هذا الجهاز فقط.</p>
   <div class="card white" style="max-width:420px"><div class="field"><label for="p1">الرمز الجديد</label><input id="p1" type="password" inputmode="numeric" autocomplete="new-password" minlength="4"></div>
   <div class="field"><label for="p2">تأكيد الرمز</label><input id="p2" type="password" inputmode="numeric" autocomplete="new-password"></div>
   <div id="pmsg" class="fb no" ${msg?'':'hidden'}>${msg||''}</div>
   <button class="btn gold" id="psave" type="button">حفظ والدخول</button></div>
   <p class="note" style="margin-top:12px">تنبيه صريح: هذا الرمز يمنع الاطلاع العرضي فقط. لأن الموقع يعمل في المتصفح، لا يُعد حماية أمنية حقيقية، فلا تضعي في اللوحة بيانات حساسة.</p>`);
  root.querySelector('#psave').onclick = ()=>{
    const a = root.querySelector('#p1').value, b = root.querySelector('#p2').value;
    if(a.length<4) return viewSetPin('الرمز يجب ألا يقل عن 4 خانات.');
    if(a!==b) return viewSetPin('الرمزان غير متطابقين.');
    try{ localStorage.setItem(PINKEY, hash(a)); sessionStorage.setItem(TOK,'1'); }catch(e){}
    viewDash();
  };
}
function viewLogin(msg){
  shell(`<h2>👩‍🏫 لوحة المعلمة</h2><div class="card white" style="max-width:420px"><div class="field"><label for="pin">رمز الدخول</label><input id="pin" type="password" inputmode="numeric" autocomplete="current-password"></div>
   <div id="pmsg" class="fb no" ${msg?'':'hidden'}>${msg||''}</div>
   <button class="btn gold" id="plogin" type="button">دخول</button> <button class="btn ghost" id="pback" type="button">العودة للدرس</button></div>`);
  const go = ()=>{ if(hash(root.querySelector('#pin').value)===pinSet()){ try{ sessionStorage.setItem(TOK,'1'); }catch(e){} viewDash(); } else viewLogin('الرمز غير صحيح.'); };
  root.querySelector('#plogin').onclick = go;
  root.querySelector('#pin').addEventListener('keydown', e=>{ if(e.key==='Enter') go(); });
  root.querySelector('#pback').onclick = ()=>ctx.back();
}

/* ---------- حسابات ---------- */
function list(){ return Object.values(ctx.getRecords()).sort((a,b)=>(b.updated||'').localeCompare(a.updated||'')); }
const avg = a => a.length ? Math.round(a.reduce((x,y)=>x+y,0)/a.length*10)/10 : 0;
const decName = k => ({yes:'أنصح بالمتجر', no:'لا أنصح بالمتجر', more:'أحتاج أدلة إضافية'})[k] || '—';
/* ---------- لوحة المعلومات ---------- */
function viewDash(){
  const D = ctx.D, C = ctx.C, recs = list();
  const prog = recs.map(r=>r.progress||0);
  const simDone = recs.filter(r=>r.stores&&r.stores.A&&r.stores.A.final&&r.stores.B&&r.stores.B.final).length;
  const exitDone = recs.filter(r=>r.exit&&r.exit.done).length;
  const pts = recs.filter(r=>r.exit&&r.exit.points!=null).map(r=>r.exit.points);
  const evalN = recs.filter(r=>r.evalOpened).length;
  const dist = {A:{yes:0,no:0,more:0}, B:{yes:0,no:0,more:0}};
  recs.forEach(r=>['A','B'].forEach(s=>{ const d=r.stores&&r.stores[s]&&r.stores[s].decision; if(d) dist[s][d]++; }));
  const fa = ['A','B'].map(s=>avg(recs.filter(r=>r.stores&&r.stores[s]).map(r=>r.stores[s].firstCorrect)));

  const rowProg = r => `<tr><td class="l"><b>${esc(r.group)}</b><br><small>${new Date(r.updated).toLocaleString('ar-SA')}</small></td>
    <td><div class="bar"><i style="width:${r.progress||0}%"></i></div>${r.progress||0}%</td><td>${(r.tabsDone||[]).length} / ${D.tabs.length}</td>
    <td>${r.review||0} / ${D.review.length}</td><td>${r.quizFirst||0} / ${D.quiz.length}</td><td>${r.httpsSolved?'✔':'—'}</td><td>${r.clues||0} / 7</td><td>${r.life||0} / 3</td><td>${r.evalOpened?'✔':'—'}</td></tr>`;
  const rowStore = r => ['A','B'].map(s=>{ const x = r.stores&&r.stores[s]; if(!x) return '<td colspan="5">—</td>';
    return `<td>${x.firstCorrect}/5</td><td>${x.trust}/${x.warn}/${x.danger}</td><td>${decName(x.decision)}</td><td>${decName(x.sys)}</td><td>${x.final?(x.mismatch?'⚠ راجعت':'✔'):'…'}</td>`; }).join('');
  const rowReason = r => ['A','B'].map(s=>{ const x=r.stores&&r.stores[s]; return `<td class="l">${x&&x.reason?esc(x.reason)+'<br><small>الأدلة: '+(x.evidence||[]).map(id=>esc((D.checks.find(k=>k.id===id)||{}).short||id)).join('، ')+'</small>':'—'}</td>`; }).join('');

  shell(`<h2>👩‍🏫 لوحة المعلمة</h2>
  <div class="toolbar no-print">
    <button class="btn ghost sm" id="tBack" type="button">→ العودة للدرس</button>
    <button class="btn sm" id="tCsv" type="button">⬇ تصدير Excel (CSV)</button>
    <button class="btn sm" id="tPdf" type="button">🖨️ تصدير PDF (طباعة)</button>
    <button class="btn ghost sm" id="tJson" type="button">⬇ نسخة JSON</button>
    <label class="btn ghost sm" style="cursor:pointer">⬆ استيراد JSON<input id="tImp" type="file" accept="application/json,.json" hidden></label>
    ${C.SHEET_ENDPOINT?'<button class="btn ghost sm" id="tSync" type="button">☁ جلب من Google Sheets</button>':''}
    <button class="btn ghost sm" id="tPin" type="button">🔑 تغيير الرمز</button>
    <button class="btn ghost sm" id="tLock" type="button">🔒 قفل</button>
    <button class="btn ghost sm" id="tClear" type="button" style="color:var(--bad)">🗑 مسح بيانات الجهاز</button></div>
  <div id="tmsg" class="fb ok" hidden></div>
  <details class="card" style="margin:10px 0"><summary><b>ℹ حدود التكامل (مهم)</b></summary>
    <ul style="margin:6px 0"><li>البيانات هنا تخص <b>هذا الجهاز فقط</b>: كل مجموعة تعمل على جهازها، فاجمعي النتائج عبر «نسخة JSON» ثم «استيراد» على جهاز المعلمة، أو فعّلي ربط Google Sheets (<code>SHEET_ENDPOINT</code> + <code>Code.gs</code>).</li>
    <li><b>لعبة مهمة الخروج الكبرى:</b> تُقرأ نتيجتها تلقائيًا فقط عندما تُشغَّل اللعبة المضمّنة من الموقع نفسه (مثل GitHub Pages)، وإلا تُدخل المجموعة النقاط يدويًا. لا يوجد نقل تلقائي من نسخة Claude الخارجية.</li>
    <li><b>نموذج Microsoft Forms:</b> لا تنتقل إجاباته إلى هذه اللوحة؛ تُعرض ردوده في Microsoft Forms نفسه. تسجل اللوحة فقط أن المجموعة فتحت النموذج.</li>
    <li>تصدير Excel يتم بصيغة CSV (UTF-8) تفتح مباشرة في Excel، والـ PDF عبر نافذة الطباعة «حفظ كـ PDF».</li></ul></details>
  <div class="grid3" style="margin:12px 0">
    <div class="stat"><b>${recs.length}</b>مجموعات مسجلة</div>
    <div class="stat"><b>${avg(prog)}%</b>متوسط الإنجاز</div>
    <div class="stat"><b>${simDone}</b>أنهت محاكاة المتجرين</div>
    <div class="stat"><b>${exitDone}</b>أنهت مهمة الخروج</div>
    <div class="stat"><b>${pts.length?avg(pts)+' / 50':'—'}</b>متوسط نقاط مهمة الخروج</div>
    <div class="stat"><b>${evalN}</b>فتحت تقييم الدرس</div></div>
  <h3>📈 متابعة التقدم والأنشطة</h3><div class="scroll"><table><thead><tr><th>المجموعة</th><th>الإنجاز</th><th>التبويبات</th><th>مراجعة</th><th>التقويم المرحلي (أول محاولة)</th><th>HTTPS</th><th>أدلة الاحتيال</th><th>الربط بالحياة</th><th>فتحت التقييم</th></tr></thead><tbody>
    ${recs.map(rowProg).join('') || '<tr><td colspan="9">لا توجد بيانات بعد.</td></tr>'}</tbody></table></div>
  <h3 style="margin-top:18px">🛒 نتائج تقييم المتجرين</h3><div class="note">«أول محاولة» = عدد الأسئلة الصحيحة من أول مرة. «ثقة/تحذير/خطر» مؤشرات المتجر. قرار الطالبة مقابل توصية الأدلة.</div>
  <div class="scroll"><table><thead><tr><th rowspan="2">المجموعة</th><th colspan="5">${esc(D.stores.A.name)}</th><th colspan="5">${esc(D.stores.B.name)}</th></tr><tr>${'<th>أول محاولة</th><th>ثقة/تحذير/خطر</th><th>القرار</th><th>توصية الأدلة</th><th>الحالة</th>'.repeat(2)}</tr></thead><tbody>
    ${recs.map(r=>`<tr><td class="l"><b>${esc(r.group)}</b></td>${rowStore(r)}</tr>`).join('') || '<tr><td colspan="11">—</td></tr>'}</tbody></table></div>
  <div class="grid2" style="margin-top:12px"><div class="card white"><b>${esc(D.stores.A.name)}:</b> متوسط الإجابات الصحيحة من أول محاولة ${fa[0]} / 5<br>القرارات: أنصح ${dist.A.yes} · لا أنصح ${dist.A.no} · أدلة إضافية ${dist.A.more}</div>
   <div class="card white"><b>${esc(D.stores.B.name)}:</b> متوسط الإجابات الصحيحة من أول محاولة ${fa[1]} / 5<br>القرارات: أنصح ${dist.B.yes} · لا أنصح ${dist.B.no} · أدلة إضافية ${dist.B.more}</div></div>
  <h3 style="margin-top:18px">📝 قرارات الطالبات ومبرراتها</h3><div class="scroll"><table><thead><tr><th>المجموعة</th><th>${esc(D.stores.A.name)}</th><th>${esc(D.stores.B.name)}</th></tr></thead><tbody>
    ${recs.map(r=>`<tr><td class="l"><b>${esc(r.group)}</b></td>${rowReason(r)}</tr>`).join('') || '<tr><td colspan="3">—</td></tr>'}</tbody></table></div>
  <h3 style="margin-top:18px">🏆 نتائج مهمة الخروج الكبرى</h3><div class="scroll"><table><thead><tr><th>المجموعة</th><th>النقاط</th><th>إجابات صحيحة من المحاولة</th><th>الحالة</th><th>المصدر</th></tr></thead><tbody>
    ${recs.map(r=>{const e=r.exit||{}; return `<tr><td class="l"><b>${esc(r.group)}</b></td><td>${e.points==null?'—':e.points+' / 50'}</td><td>${e.correct==null?'—':e.correct+' / 5'}</td><td>${e.done?'مكتملة ✔':(e.points==null?'لم تبدأ':'قيد الحل')}</td><td>${e.points==null?'—':(e.auto?'تلقائي':'يدوي')}</td></tr>`;}).join('') || '<tr><td colspan="5">—</td></tr>'}</tbody></table></div>
  <h3 style="margin-top:18px">🎬 إجابات أسئلة الفيديو</h3>
  ${recs.map(r=>`<details class="card white" style="margin:6px 0"><summary><b>${esc(r.group)}</b></summary>${(r.videoAnswers||[]).map((v,i)=>`<p style="margin:6px 0"><b>${i+1}. ${esc(v.q)}</b><br>${v.a?esc(v.a):'<span style="color:var(--muted)">—</span>'}${v.oral?' <span class="tag good">نوقش شفهيًا</span>':''}</p>`).join('')}</details>`).join('') || '<p>—</p>'}`);

  const $ = s => root.querySelector(s), msg = t => { const m=$('#tmsg'); m.hidden=false; m.textContent=t; };
  $('#tBack').onclick = ()=>ctx.back();
  $('#tPdf').onclick = ()=>window.print();
  $('#tLock').onclick = ()=>{ try{ sessionStorage.removeItem(TOK); }catch(e){} viewLogin(); };
  $('#tPin').onclick = ()=>{ try{ localStorage.removeItem(PINKEY); sessionStorage.removeItem(TOK); }catch(e){} viewSetPin(); };
  $('#tClear').onclick = ()=>{ if(confirm('سيتم حذف نتائج جميع المجموعات المحفوظة على هذا الجهاز نهائيًا. هل أنتِ متأكدة؟')){ ctx.setRecords({}); try{ localStorage.removeItem('dd2_state'); }catch(e){} viewDash(); } };
  $('#tJson').onclick = ()=>download('dd-results-'+stamp()+'.json', JSON.stringify(ctx.getRecords(), null, 2), 'application/json');
  $('#tCsv').onclick = ()=>download('dd-results-'+stamp()+'.csv', '﻿'+toCsv(recs), 'text/csv;charset=utf-8');
  $('#tImp').onchange = ev=>{
    const f = ev.target.files[0]; if(!f) return;
    const rd = new FileReader();
    rd.onload = ()=>{ try{ const n = merge(JSON.parse(rd.result)); viewDash(); const m=root.querySelector('#tmsg'); m.hidden=false; m.textContent='تم استيراد '+n+' مجموعة.'; }catch(e){ msg('تعذر قراءة الملف: تأكدي أنه ملف JSON صادر من هذه اللوحة.'); } };
    rd.readAsText(f);
  };
  const sy = $('#tSync');
  if(sy) sy.onclick = ()=>{ msg('جارٍ الجلب...'); fetch(C.SHEET_ENDPOINT).then(r=>r.json()).then(arr=>{ const n = merge(arr); viewDash(); const m=root.querySelector('#tmsg'); m.hidden=false; m.textContent='تم جلب '+n+' مجموعة.'; }).catch(()=>msg('تعذر الجلب. تأكدي من نشر تطبيق الويب للجميع وصحة الرابط.')); };
}
function stamp(){ return new Date().toISOString().slice(0,16).replace(/[:T]/g,'-'); }
function download(name, text, type){
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text],{type})); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function merge(src){
  const cur = ctx.getRecords(); let n = 0;
  const arr = Array.isArray(src) ? src : Object.values(src||{});
  arr.forEach(r=>{ if(!r || !r.group) return; const o = cur[r.group]; if(!o || (r.updated||'') > (o.updated||'')){ cur[r.group] = r; n++; } });
  ctx.setRecords(cur); return n;
}
function toCsv(recs){
  const D = ctx.D;
  const cols = ['المجموعة','آخر تحديث','الإنجاز %','التبويبات المكتملة','مراجعة (من 3)','تقويم مرحلي أول محاولة (من 5)','HTTPS','أدلة الاحتيال (من 7)','الربط بالحياة (من 3)','فتحت التقييم'];
  ['A','B'].forEach(s=>{ const n = D.stores[s].name; cols.push(n+' - إجابات صحيحة أول محاولة', n+' - ثقة', n+' - تحذير', n+' - خطر', n+' - القرار', n+' - توصية الأدلة', n+' - المبررات', n+' - الأدلة المختارة'); });
  cols.push('نقاط مهمة الخروج (من 50)','صحيحة من المحاولة','حالة المهمة','مصدر النتيجة');
  D.videoQs.forEach((q,i)=>cols.push('فيديو '+(i+1)));
  const q = v => '"'+String(v==null?'':v).replace(/"/g,'""')+'"';
  const rows = recs.map(r=>{
    const c = [r.group, r.updated, r.progress, (r.tabsDone||[]).length, r.review, r.quizFirst, r.httpsSolved?'نعم':'لا', r.clues, r.life, r.evalOpened?'نعم':'لا'];
    ['A','B'].forEach(s=>{ const x = (r.stores||{})[s]||{}; c.push(x.firstCorrect, x.trust, x.warn, x.danger, decName(x.decision), decName(x.sys), x.reason, (x.evidence||[]).map(id=>(D.checks.find(k=>k.id===id)||{}).short||id).join(' | ')); });
    const e = r.exit||{}; c.push(e.points==null?'':e.points, e.correct==null?'':e.correct, e.done?'مكتملة':(e.points==null?'لم تبدأ':'قيد الحل'), e.points==null?'':(e.auto?'تلقائي':'يدوي'));
    (r.videoAnswers||[]).forEach(v=>c.push((v.a||'')+(v.oral?' [نوقش شفهيًا]':'')));
    return c.map(q).join(',');
  });
  return [cols.map(q).join(','), ...rows].join('\r\n');
}
return {render};
})();
