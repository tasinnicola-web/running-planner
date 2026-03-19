// ══ CONSTANTS ══════════════════════════════════════════════════════
const MONTHS    = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
const DAY_NAMES = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
const LONG_DAY  = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'];
const TYPE_COLORS = {easy:'#639922',tempo:'#BA7517',interval:'#D85A30',long:'#185FA5',rest:'#888'};
const TYPE_BADGE  = {easy:'b-easy',tempo:'b-tempo',interval:'b-interval',long:'b-long',rest:'b-rest'};
const TYPE_LABEL  = {easy:'Facile',tempo:'Tempo',interval:'Interval',long:'Lungo',rest:'Riposo'};
const DIST_LABEL  = {'5K':'5K','10K':'10K','HM':'Mezza','M':'Maratona','UM':'Ultra','custom':''};
const DIST_CLS    = {'5K':'rd-5k','10K':'rd-10k','HM':'rd-hm','M':'rd-m','UM':'rd-um','custom':'rd-cu'};
const PB_COLORS   = {'5K':'#1D9E75','10K':'#185FA5','HM':'#BA7517','M':'#D85A30','UM':'#7F77DD','custom':'#888'};
const PB_FULL     = {'5K':'5 km','10K':'10 km','HM':'Mezza maratona','M':'Maratona','UM':'Ultra','custom':''};
const DIST_ORDER  = ['5K','10K','HM','M','UM','custom'];

// ══ STATE ══════════════════════════════════════════════════════════
let sessions     = {};
let races        = [];
let pbs          = [];
let profile      = {};
let historyRaces = [];
let doneDays     = {};

let weekOffset    = 0;
let selectedDate  = null;
let editingDate   = null;
let editSteps     = [];
let selectedPbDist = '5K';
let chartKm = null, chartElev = null, chartTypes = null;
let drawerOpen = false;
let cdIntervals = {};

// ══ BOOT (chiamato da firebase.js dopo il login) ════════════════════
window.bootApp = function() {
  const d = window._userData;
  profile      = d.prof   || {};
  sessions     = d.sess   || {};
  doneDays     = d.done   || {};
  races        = (d.rcList   || []).sort((a,b) => new Date(a.date) - new Date(b.date));
  pbs          = d.pbList  || [];
  historyRaces = (d.histList || []).sort((a,b) => new Date(b.date) - new Date(a.date));

  renderWeek();
  renderRaces();
  renderProfile();
};

// ══ AUTH UI ════════════════════════════════════════════════════════
let authMode = 'login';

function switchAuthTab(mode) {
  authMode = mode;
  document.getElementById('tab-login').classList.toggle('active', mode === 'login');
  document.getElementById('tab-register').classList.toggle('active', mode === 'register');
  document.getElementById('register-extra').style.display = mode === 'register' ? 'block' : 'none';
  document.getElementById('auth-label').textContent = mode === 'login' ? 'Accedi' : 'Registrati';
  document.getElementById('forgot-wrap').style.display = mode === 'login' ? 'block' : 'none';
  hideAuthError();
}
window.switchAuthTab = switchAuthTab;

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.classList.remove('hidden');
  el.style.background = '';
  el.style.color      = '';
  el.style.borderColor = '';
}
function hideAuthError() {
  document.getElementById('auth-error').classList.add('hidden');
}

window.doAuth = async function() {
  const email = document.getElementById('a-email').value.trim();
  const pass  = document.getElementById('a-pass').value;
  if (!email || !pass) { showAuthError('Inserisci email e password.'); return; }

  const btn  = document.getElementById('auth-submit');
  const icon = document.getElementById('auth-icon');
  btn.disabled = true;
  icon.className = 'spinner';
  hideAuthError();

  try {
    if (authMode === 'register') {
      const nome    = document.getElementById('a-nome').value.trim();
      const cognome = document.getElementById('a-cognome').value.trim();
      const nick    = document.getElementById('a-nick').value.trim();
      const cred = await window._fb.createUser(email, pass);
      await window._fb.saveProfile(cred.user.uid, { nome, cognome, nickname: nick, email });
    } else {
      await window._fb.signIn(email, pass);
    }
    // onAuthStateChanged in firebase.js gestisce il resto
  } catch(e) {
    const msgs = {
      'auth/email-already-in-use': 'Email già registrata.',
      'auth/invalid-email':        'Email non valida.',
      'auth/weak-password':        'Password troppo corta (min. 6 caratteri).',
      'auth/user-not-found':       'Nessun account con questa email.',
      'auth/wrong-password':       'Password errata.',
      'auth/invalid-credential':   'Email o password errati.',
      'auth/too-many-requests':    'Troppi tentativi. Riprova tra qualche minuto.',
    };
    showAuthError(msgs[e.code] || 'Errore: ' + e.message);
  }
  btn.disabled = false;
  icon.className = '';
  icon.textContent = '→';
};

window.resetPassword = async function() {
  const email = document.getElementById('a-email').value.trim();
  if (!email) { showAuthError('Inserisci la tua email nel campo sopra.'); return; }
  try {
    await window._fb.resetPwd(email);
    const el = document.getElementById('auth-error');
    el.textContent = '✓ Email di reset inviata. Controlla la casella di posta.';
    el.classList.remove('hidden');
    el.style.background  = '#eaf3de';
    el.style.color       = '#3b6d11';
    el.style.borderColor = '#c0dd97';
  } catch(e) {
    showAuthError('Errore: ' + e.message);
  }
};

window.doLogout = async function() {
  await window._fb.signOut();
  // Resetta stato
  sessions = {}; races = []; pbs = []; profile = {};
  historyRaces = []; doneDays = {};
  weekOffset = 0; selectedDate = null;
  // Torna a schermata training quando si riaccede
  document.querySelectorAll('.nav-btn').forEach((b,i) => b.classList.toggle('active', i === 0));
  document.querySelectorAll('.screen').forEach((s,i) => s.classList.toggle('active', i === 0));
};

// ══ NAVIGATION ═════════════════════════════════════════════════════
function showScreen(name, btn) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  if (btn) btn.classList.add('active');
  const fab = document.getElementById('fab-btn');
  if (fab) fab.classList.toggle('visible', name === 'races');
  if (name !== 'races' && drawerOpen) toggleRaceDrawer();
  if (name === 'profile')  { renderProfile(); renderHistory(); }
  if (name === 'progress') renderProgressScreen();
}
window.showScreen = showScreen;

// ══ WEEK ═══════════════════════════════════════════════════════════
function getWeekStart(off) {
  const now = new Date(); now.setHours(0,0,0,0);
  const mon = new Date(now);
  mon.setDate(now.getDate() - (now.getDay()+6)%7 + off*7);
  return mon;
}
function dateKey(d) { return d.toISOString().slice(0,10); }
function todayRome() { return new Date().toLocaleDateString('en-CA', {timeZone:'Europe/Rome'}); }
function changeWeek(dir) { weekOffset += dir; renderWeek(); }
window.changeWeek = changeWeek;

function renderWeek() {
  const mon  = getWeekStart(weekOffset);
  const days = Array.from({length:7}, (_,i) => { const d=new Date(mon); d.setDate(mon.getDate()+i); return d; });
  const fmt  = d => d.getDate()+' '+MONTHS[d.getMonth()];
  document.getElementById('week-label').textContent = fmt(days[0])+' – '+fmt(days[6])+' '+days[6].getFullYear();
  const today = todayRome();

  let totalKm=0, totalElev=0, sessCnt=0, restCnt=0, doneCnt=0, plannedCnt=0;
  days.forEach(d => {
    const key = dateKey(d); const s = sessions[key];
    if (!s) return;
    if (s.type==='rest') { restCnt++; return; }
    plannedCnt++;
    totalKm   += parseFloat(s.dist)||0;
    totalElev += parseInt(s.elev)||0;
    sessCnt++;
    if (doneDays[key]) doneCnt++;
  });
  document.getElementById('m-vol').innerHTML       = (totalKm||'—')+(totalKm?'<span class="munit"> km</span>':'');
  document.getElementById('m-elev-week').innerHTML = (totalElev||'—')+(totalElev?'<span class="munit"> m</span>':'');
  document.getElementById('m-sess').textContent    = sessCnt||'—';
  document.getElementById('m-rest').textContent    = restCnt||'—';

  const pct = plannedCnt > 0 ? Math.round(doneCnt/plannedCnt*100) : 0;
  document.getElementById('completion-fill').style.width = pct+'%';
  document.getElementById('completion-pct').textContent  = pct+'%';

  // Desktop grid
  document.getElementById('week-grid').innerHTML = days.map((d,i) => {
    const key  = dateKey(d); const s = sessions[key];
    const isDone = doneDays[key];
    const type = s ? s.type : 'empty';
    return `<div class="day-card ${key===today?'today':''} ${key===selectedDate?'selected':''} ${isDone?'done-day':''}" onclick="selectDay('${key}',${i})">
      ${isDone ? '<div class="done-flag"></div>' : ''}
      <div class="day-name">${DAY_NAMES[i]}</div>
      <div class="day-num">${d.getDate()}</div>
      ${s ? `<span class="badge ${TYPE_BADGE[type]||'b-empty'}">${TYPE_LABEL[type]||'—'}</span>` : '<span class="badge b-empty">Vuoto</span>'}
      <div class="day-dist">${s&&s.dist?s.dist:'—'}</div>
    </div>`;
  }).join('');

  // Mobile list
  document.getElementById('week-list').innerHTML = days.map((d,i) => {
    const key    = dateKey(d);
    const s      = sessions[key];
    const isDone = doneDays[key];
    const isToday= key === today;
    const isSel  = key === selectedDate;
    const type   = s ? s.type : 'empty';
    const color  = TYPE_COLORS[type] || '#aaa';

    let detailHTML = '';
    if (isSel) {
      if (!s) {
        detailHTML = `<div style="font-size:13px;color:#aaa;text-align:center;padding:8px 0">Nessuna sessione — <button class="btn btn-outline btn-sm" onclick="openModal('${key}')">+ Aggiungi</button></div>`;
      } else {
        detailHTML =
          (s.steps||[]).map(st => `
            <div class="wli-session-row">
              <div class="wli-session-dot" style="background:${st.color||color}"></div>
              <div style="flex:1">
                <div class="wli-session-title">${st.title}</div>
                ${st.desc?`<div class="wli-session-desc">${st.desc}</div>`:''}
              </div>
              <div class="wli-session-meta">${st.meta||''}</div>
            </div>`).join('') +
          (s.notes ? `<div style="font-size:12px;color:#888;padding:8px 0 4px;border-top:0.5px solid rgba(0,0,0,0.05);margin-top:4px">📝 ${s.notes}</div>` : '') +
          `<div class="wli-done-toggle">
            <button class="toggle-track ${isDone?'on':''}" onclick="event.stopPropagation();toggleDone('${key}')">
              <div class="toggle-thumb"></div>
            </button>
            <span style="font-size:13px;color:#555">${isDone?'✓ Completato':'Segna come completato'}</span>
            <div style="margin-left:auto;display:flex;gap:6px">
              <button class="btn btn-outline btn-sm" onclick="event.stopPropagation();openModal('${key}')">Modifica</button>
              <button class="btn-icon" onclick="event.stopPropagation();deleteSession('${key}')">×</button>
            </div>
          </div>`;
      }
    }

    return `<div class="week-list-item ${isSel?'selected':''} ${isToday?'today-item':''} ${isDone?'done-item':''}">
      <div class="wli-row" onclick="selectMobileDay('${key}',${i})">
        <div class="wli-date">
          <div class="wli-dayname">${DAY_NAMES[i]}</div>
          <div class="wli-daynum">${d.getDate()}</div>
        </div>
        <div class="wli-body">
          <div class="wli-type">${s?(s.title||TYPE_LABEL[type]):'Nessuna sessione'}</div>
          <div class="wli-dist">${s&&s.dist?s.dist:'—'}${s&&s.elev?' · ↑'+s.elev+'m':''}</div>
        </div>
        <div class="wli-right">
          <span class="wli-badge ${TYPE_BADGE[type]||'b-empty'}">${TYPE_LABEL[type]||'Vuoto'}</span>
          ${isDone?'<div class="wli-done-dot"></div>':''}
        </div>
        <span class="wli-chevron">▾</span>
      </div>
      <div class="wli-detail">${detailHTML}</div>
    </div>`;
  }).join('');

  if (selectedDate) renderDetail(selectedDate);
}
window.renderWeek = renderWeek;

function selectMobileDay(key, idx) {
  selectedDate = selectedDate === key ? null : key;
  renderWeek();
}
window.selectMobileDay = selectMobileDay;

function selectDay(key, idx) { selectedDate=key; renderWeek(); renderDetail(key,idx); }
window.selectDay = selectDay;

function renderDetail(key, dayIdx) {
  const s = sessions[key]; const d = new Date(key);
  const dIdx    = dayIdx!==undefined ? dayIdx : (d.getDay()+6)%7;
  const dateStr = LONG_DAY[dIdx]+' '+d.getDate()+' '+MONTHS[d.getMonth()]+' '+d.getFullYear();
  const isDone  = !!doneDays[key];

  if (!s) {
    document.getElementById('detail-area').innerHTML = `<div class="detail-panel">
      <div class="detail-header"><div class="detail-title">${dateStr}</div>
        <div class="detail-actions"><button class="btn btn-outline btn-sm" onclick="openModal('${key}')">+ Aggiungi sessione</button></div>
      </div><div style="text-align:center;padding:2rem;color:#aaa;font-size:14px">Nessuna sessione programmata.</div></div>`;
    return;
  }

  const elevStr = s.elev ? ` · ↑${s.elev}m` : '';
  document.getElementById('detail-area').innerHTML = `<div class="detail-panel">
    <div class="detail-header">
      <div>
        <div class="detail-title">${s.title||dateStr}</div>
        <div style="font-size:12px;color:#888;margin-top:3px">${dateStr}${s.dist?' · '+s.dist:''}${elevStr}</div>
      </div>
      <div class="detail-actions">
        <button class="btn btn-outline btn-sm" onclick="openModal('${key}')">Modifica</button>
        <button class="btn-icon" onclick="deleteSession('${key}')">×</button>
      </div>
    </div>
    ${(s.steps||[]).map(st=>`<div class="session-row">
      <div class="session-dot" style="background:${st.color||TYPE_COLORS[s.type]||'#888'}"></div>
      <div><div class="session-title">${st.title}</div><div class="session-desc">${st.desc||''}</div></div>
      <div class="session-meta">${st.meta||''}</div>
    </div>`).join('')}
    ${s.notes?`<div style="font-size:13px;color:#888;padding:10px 0;border-top:0.5px solid rgba(0,0,0,0.06);margin-top:4px">📝 ${s.notes}</div>`:''}
    <div class="done-toggle-wrap">
      <button class="toggle-track ${isDone?'on':''}" onclick="toggleDone('${key}')">
        <div class="toggle-thumb"></div>
      </button>
      <span class="done-toggle-label">${isDone ? '✓ Allenamento completato' : 'Segna come completato'}</span>
    </div>
  </div>`;
}

async function toggleDone(key) {
  if (doneDays[key]) delete doneDays[key]; else doneDays[key] = true;
  await window._fb.saveDoneDays(window._uid, doneDays);
  renderWeek();
}
window.toggleDone = toggleDone;

async function deleteSession(key) {
  if (!confirm('Eliminare questa sessione?')) return;
  delete sessions[key];
  await window._fb.saveSessions(window._uid, sessions);
  selectedDate=null; document.getElementById('detail-area').innerHTML=''; renderWeek();
}
window.deleteSession = deleteSession;

// ══ MODAL ══════════════════════════════════════════════════════════
function openModal(key) {
  editingDate=key; const s=sessions[key];
  document.getElementById('modal-title').textContent = s?'Modifica sessione':'Nuova sessione';
  document.getElementById('m-title').value = s?(s.title||''):'';
  document.getElementById('m-type').value  = s?(s.type||'easy'):'easy';
  document.getElementById('m-dist').value  = s?(s.dist||''):'';
  document.getElementById('m-elev').value  = s?(s.elev||''):'';
  document.getElementById('m-notes').value = s?(s.notes||''):'';
  editSteps = s&&s.steps ? JSON.parse(JSON.stringify(s.steps)) : [
    {title:'Riscaldamento',desc:'',meta:'',color:TYPE_COLORS['easy']},
    {title:'Corpo principale',desc:'',meta:'',color:TYPE_COLORS['easy']},
    {title:'Defaticamento',desc:'',meta:'',color:TYPE_COLORS['easy']}
  ];
  renderStepsEditor();
  document.getElementById('modal-overlay').classList.remove('hidden');
}
window.openModal = openModal;

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  editingDate=null; editSteps=[];
}
window.closeModal = closeModal;

function renderStepsEditor() {
  document.getElementById('steps-editor').innerHTML = editSteps.map((st,i) => `
    <div class="step-row">
      <div class="step-row-header">
        <div class="step-color" style="background:${st.color}"></div>
        <input value="${st.title}" placeholder="Titolo step" onchange="editSteps[${i}].title=this.value" style="flex:1">
        <input value="${st.meta||''}" placeholder="es. 10 km · 45'" onchange="editSteps[${i}].meta=this.value" style="width:130px">
        <button class="step-del" onclick="removeStep(${i})">×</button>
      </div>
      <input class="step-desc-input" value="${st.desc||''}" placeholder="Descrizione…" onchange="editSteps[${i}].desc=this.value">
    </div>`).join('');
}

function addStep() {
  editSteps.push({title:'Nuovo step',desc:'',meta:'',color:TYPE_COLORS[document.getElementById('m-type').value]||'#888'});
  renderStepsEditor();
}
window.addStep = addStep;

function removeStep(i) { editSteps.splice(i,1); renderStepsEditor(); }
window.removeStep = removeStep;

async function saveSession() {
  const title = document.getElementById('m-title').value.trim();
  const type  = document.getElementById('m-type').value;
  const dist  = document.getElementById('m-dist').value.trim();
  const elev  = document.getElementById('m-elev').value;
  const notes = document.getElementById('m-notes').value.trim();
  if (!title) { alert('Inserisci un titolo.'); return; }
  const color = TYPE_COLORS[type]||'#888';
  sessions[editingDate] = {title,type,dist,elev,steps:editSteps.map(st=>({...st,color})),notes};
  await window._fb.saveSessions(window._uid, sessions);
  closeModal(); renderWeek(); renderDetail(editingDate);
}
window.saveSession = saveSession;

// ══ RACES ══════════════════════════════════════════════════════════
function toggleCustomDist(v) {
  const show = v==='custom'||v==='UM';
  document.getElementById('custom-dist-group').style.display = show?'flex':'none';
  document.getElementById('custom-dist-label').textContent = v==='UM'?'Km ultramaratona':'Km personalizzati';
}
window.toggleCustomDist = toggleCustomDist;

function toggleHCustomDist(v) {
  document.getElementById('h-custom-dist-group').style.display = (v==='custom'||v==='UM')?'flex':'none';
}
window.toggleHCustomDist = toggleHCustomDist;

function toggleRaceDrawer() {
  drawerOpen = !drawerOpen;
  document.getElementById('race-drawer').classList.toggle('open', drawerOpen);
  document.getElementById('drawer-backdrop').classList.toggle('visible', drawerOpen);
  document.getElementById('fab-btn').classList.toggle('open', drawerOpen);
}
window.toggleRaceDrawer = toggleRaceDrawer;

async function addRace() {
  const name = document.getElementById('r-name').value.trim();
  const date = document.getElementById('r-date').value;
  if (!name||!date) { alert('Inserisci almeno nome e data.'); return; }
  const dist     = document.getElementById('r-dist').value;
  const customKm = document.getElementById('r-custom-km').value;
  const elev     = parseInt(document.getElementById('r-elev').value)||0;
  const goal     = document.getElementById('r-goal').value.trim();
  const loc      = document.getElementById('r-loc').value.trim();
  const done     = new Date(date) < new Date();
  const raceData = {name,date,dist,customKm,elev,goal:goal||'—',loc,done};
  const docRef   = await window._fb.addRace(window._uid, raceData);
  races.push({_id: docRef.id, ...raceData});
  races.sort((a,b)=>new Date(a.date)-new Date(b.date));
  ['r-name','r-date','r-goal','r-loc','r-elev','r-custom-km'].forEach(id=>document.getElementById(id).value='');
  toggleRaceDrawer();
  renderRaces();
}
window.addRace = addRace;

async function deleteRace(id) {
  if (!confirm('Eliminare questa gara?')) return;
  await window._fb.deleteRace(window._uid, id);
  races = races.filter(r => r._id !== id);
  renderRaces();
}
window.deleteRace = deleteRace;

let cdIntervals2 = {};

function updateCountdown(idx, date) {
  const el = document.getElementById(`cd-${idx}`);
  if (!el) { clearInterval(cdIntervals2[idx]); return; }
  const now  = new Date();
  const diff = new Date(date).getTime() - now.getTime();
  if (diff <= 0) { el.innerHTML='<span style="font-size:12px;color:#3b6d11;font-weight:500">Gara oggi! 🎉</span>'; clearInterval(cdIntervals2[idx]); return; }
  const days = Math.floor(diff/(1000*60*60*24));
  const hrs  = Math.floor((diff%(1000*60*60*24))/(1000*60*60));
  const mins = Math.floor((diff%(1000*60*60))/(1000*60));
  const secs = Math.floor((diff%(1000*60))/1000);
  el.innerHTML = `
    <div class="cd-unit"><div class="cd-val">${days}</div><div class="cd-label">giorni</div></div>
    <div class="cd-unit"><div class="cd-val">${String(hrs).padStart(2,'0')}</div><div class="cd-label">ore</div></div>
    <div class="cd-unit"><div class="cd-val">${String(mins).padStart(2,'0')}</div><div class="cd-label">min</div></div>
    <div class="cd-unit"><div class="cd-val">${String(secs).padStart(2,'0')}</div><div class="cd-label">sec</div></div>`;
}

function renderRaces() {
  Object.values(cdIntervals2).forEach(clearInterval);
  cdIntervals2 = {};

  const el = document.getElementById('race-list');
  if (!races.length) {
    el.innerHTML = `<div class="empty-state" style="padding-top:3rem">
      <div style="font-size:36px;margin-bottom:12px">🏁</div>
      <div style="font-size:15px;font-weight:500;margin-bottom:6px">Nessuna gara aggiunta</div>
      <div style="font-size:13px">Premi il <strong>+</strong> in basso a destra per aggiungerne una</div>
    </div>`;
    return;
  }

  const upcoming = races.filter(r=>!r.done);
  const done     = races.filter(r=>r.done);
  let html = '';

  if (upcoming.length) {
    html += `<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#888;margin-bottom:10px">Prossime gare</div>`;
    html += upcoming.map((r, rawIdx) => {
      const d   = new Date(r.date);
      const lbl = (r.dist==='custom'||r.dist==='UM')?(r.customKm+' km'):(DIST_LABEL[r.dist]||r.dist);
      const elevStr = r.elev?` · ↑${r.elev}m`:'';
      const dateStr = d.getDate()+' '+MONTHS[d.getMonth()]+' '+d.getFullYear();
      return `<div style="background:#fff;border:0.5px solid rgba(0,0,0,0.08);border-radius:14px;padding:1rem 1.25rem;margin-bottom:12px;border-left:3px solid #185fa5">
        <div style="display:flex;align-items:flex-start;gap:12px">
          <div style="text-align:center;min-width:44px">
            <div class="rday">${String(d.getDate()).padStart(2,'0')}</div>
            <div class="rmon">${MONTHS[d.getMonth()]}</div>
          </div>
          <div style="flex:1">
            <div class="rname">${r.name}</div>
            <div class="rloc">${dateStr}${r.loc?' · '+r.loc:''}${elevStr}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
            <span class="race-badge ${DIST_CLS[r.dist]||'rd-cu'}">${lbl}</span>
            ${r.goal&&r.goal!=='—'?`<div class="race-goal"><span style="font-size:11px;color:#aaa">Obiettivo</span><strong>${r.goal}</strong></div>`:''}
            <button class="btn-icon" onclick="deleteRace('${r._id}')">×</button>
          </div>
        </div>
        <div class="countdown-wrap" id="cd-${rawIdx}"></div>
      </div>`;
    }).join('');

    setTimeout(() => {
      upcoming.forEach((r, rawIdx) => {
        updateCountdown(rawIdx, r.date);
        cdIntervals2[rawIdx] = setInterval(() => updateCountdown(rawIdx, r.date), 1000);
      });
    }, 50);
  }

  if (done.length) {
    html += `<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#888;margin:1.25rem 0 10px">Gare completate</div>`;
    html += done.map(r => {
      const d   = new Date(r.date);
      const lbl = (r.dist==='custom'||r.dist==='UM')?(r.customKm+' km'):(DIST_LABEL[r.dist]||r.dist);
      const elevStr = r.elev?` · ↑${r.elev}m`:'';
      return `<div style="background:#fff;border:0.5px solid rgba(0,0,0,0.08);border-radius:14px;padding:1rem 1.25rem;margin-bottom:10px;opacity:0.65">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="text-align:center;min-width:44px">
            <div class="rday">${String(d.getDate()).padStart(2,'0')}</div>
            <div class="rmon">${MONTHS[d.getMonth()]}</div>
          </div>
          <div style="flex:1"><div class="rname">${r.name}</div><div class="rloc">${r.loc||''}${elevStr}</div></div>
          <span class="race-badge ${DIST_CLS[r.dist]||'rd-cu'}">${lbl}</span>
          <div class="race-goal"><span style="font-size:11px;color:#aaa">Obiettivo</span><strong>${r.goal}</strong></div>
          <button class="btn-icon" onclick="deleteRace('${r._id}')">×</button>
        </div>
      </div>`;
    }).join('');
  }

  el.innerHTML = html;
}
window.renderRaces = renderRaces;

// ══ PROGRESS ═══════════════════════════════════════════════════════
function renderProgressScreen() {
  const year = new Date().getFullYear();
  let totalKm=0, totalElev=0;
  const monthKm   = new Array(12).fill(0);
  const monthElev = new Array(12).fill(0);
  const typeCounts = {};

  Object.entries(sessions).forEach(([k,s]) => {
    if (!k.startsWith(String(year))) return;
    if (s.type==='rest') return;
    const mo = parseInt(k.split('-')[1])-1;
    const km = parseFloat(s.dist)||0; const el = parseInt(s.elev)||0;
    totalKm += km; totalElev += el;
    monthKm[mo]   += km; monthElev[mo] += el;
    typeCounts[s.type] = (typeCounts[s.type]||0)+1;
  });

  document.getElementById('p-km').textContent    = Math.round(totalKm)||'—';
  document.getElementById('p-elev').innerHTML    = (totalElev||'—')+(totalElev?'<span style="font-size:14px;font-weight:400;color:#888"> m</span>':'');
  document.getElementById('p-races').textContent = (races.filter(r=>r.done).length + historyRaces.length)||'—';

  document.getElementById('bar-labels-km').innerHTML   = MONTHS.map(m=>`<div class="bar-lb">${m}</div>`).join('');
  document.getElementById('bar-labels-elev').innerHTML = MONTHS.map(m=>`<div class="bar-lb">${m}</div>`).join('');

  if (chartKm) chartKm.destroy();
  chartKm = new Chart(document.getElementById('chart-km'), {
    type:'bar',
    data:{labels:MONTHS,datasets:[{data:monthKm.map(v=>Math.round(v)),
      backgroundColor:monthKm.map((_,i)=>i===new Date().getMonth()?'#FC4C02':'#e0dfd8'),
      borderRadius:3,borderSkipped:false}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
      scales:{x:{grid:{display:false},ticks:{font:{size:10}}},y:{grid:{color:'rgba(0,0,0,0.05)'},ticks:{font:{size:10}}}}}
  });

  if (chartElev) chartElev.destroy();
  chartElev = new Chart(document.getElementById('chart-elev'), {
    type:'bar',
    data:{labels:MONTHS,datasets:[{data:monthElev.map(v=>Math.round(v)),
      backgroundColor:monthElev.map((_,i)=>i===new Date().getMonth()?'#185FA5':'#c5d8f0'),
      borderRadius:3,borderSkipped:false}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
      scales:{x:{grid:{display:false},ticks:{font:{size:10}}},y:{grid:{color:'rgba(0,0,0,0.05)'},ticks:{font:{size:10}}}}}
  });

  const typeKeys = Object.keys(typeCounts);
  const typeVals = typeKeys.map(k=>typeCounts[k]);
  const typeClrs = typeKeys.map(k=>TYPE_COLORS[k]||'#888');
  if (chartTypes) chartTypes.destroy();
  if (typeKeys.length) {
    chartTypes = new Chart(document.getElementById('chart-types'), {
      type:'doughnut',
      data:{labels:typeKeys.map(k=>TYPE_LABEL[k]||k),datasets:[{data:typeVals,backgroundColor:typeClrs,borderWidth:0}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},cutout:'65%'}
    });
    document.getElementById('chart-types-legend').innerHTML = typeKeys.map((k,i)=>`
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:10px;height:10px;border-radius:2px;background:${typeClrs[i]};flex-shrink:0"></div>
        <span>${TYPE_LABEL[k]||k} <strong>${typeVals[i]}</strong></span>
      </div>`).join('');
  } else {
    document.getElementById('chart-types-legend').innerHTML = '<span style="color:#aaa;font-size:13px">Nessuna sessione registrata.</span>';
  }

  renderPbList('pb-list-progress', false);
}
window.renderProgressScreen = renderProgressScreen;

// ══ PROFILE ════════════════════════════════════════════════════════
function renderProfile() {
  const nome=profile.nome||'', cognome=profile.cognome||'', nick=profile.nickname||'';
  const initials=((nome[0]||'')+(cognome[0]||'')).toUpperCase()||'?';
  document.getElementById('prof-avatar').textContent   = initials;
  document.getElementById('avatar-btn').textContent    = initials;
  document.getElementById('prof-name-big').textContent = (nome+' '+cognome).trim()||'Il mio profilo';
  document.getElementById('prof-nick-big').textContent = nick?('@'+nick):'';
  document.getElementById('prof-email-disp').textContent = window._email||'';
  document.getElementById('pv-nome').textContent    = nome||'—';
  document.getElementById('pv-cognome').textContent = cognome||'—';
  document.getElementById('pv-nick').textContent    = nick||'—';
  document.getElementById('pv-city').textContent    = profile.city||'—';
  document.getElementById('pv-year').textContent    = profile.year||'—';
  document.getElementById('pv-club').textContent    = profile.club||'—';
  renderPbList('pb-list-profile', true);
}
window.renderProfile = renderProfile;

function toggleEditProfile() {
  const view=document.getElementById('profile-view'), edit=document.getElementById('profile-edit');
  const btn=document.getElementById('edit-profile-btn'), isEditing=edit.style.display!=='none';
  if (!isEditing) {
    document.getElementById('pe-nome').value    = profile.nome||'';
    document.getElementById('pe-cognome').value = profile.cognome||'';
    document.getElementById('pe-nick').value    = profile.nickname||'';
    document.getElementById('pe-city').value    = profile.city||'';
    document.getElementById('pe-year').value    = profile.year||'';
    document.getElementById('pe-club').value    = profile.club||'';
  }
  view.style.display=isEditing?'block':'none';
  edit.style.display=isEditing?'none':'block';
  btn.textContent=isEditing?'Modifica':'Annulla';
}
window.toggleEditProfile = toggleEditProfile;

async function saveProfile() {
  profile.nome     = document.getElementById('pe-nome').value.trim();
  profile.cognome  = document.getElementById('pe-cognome').value.trim();
  profile.nickname = document.getElementById('pe-nick').value.trim();
  profile.city     = document.getElementById('pe-city').value.trim();
  profile.year     = document.getElementById('pe-year').value;
  profile.club     = document.getElementById('pe-club').value.trim();
  await window._fb.saveProfile(window._uid, profile);
  toggleEditProfile(); renderProfile();
}
window.saveProfile = saveProfile;

// ══ PERSONAL BEST ══════════════════════════════════════════════════
function togglePbForm() { document.getElementById('pb-add-form').classList.toggle('show'); }
window.togglePbForm = togglePbForm;

function selectPbDist(el) {
  document.querySelectorAll('.pb-pill').forEach(p=>p.classList.remove('on')); el.classList.add('on');
  selectedPbDist=el.dataset.dist;
  document.getElementById('pb-custom-wrap').style.display=selectedPbDist==='custom'?'block':'none';
}
window.selectPbDist = selectPbDist;

async function savePb() {
  const time     = document.getElementById('pb-time').value.trim();
  const date     = document.getElementById('pb-date').value;
  const race     = document.getElementById('pb-race-name').value.trim();
  const customKm = document.getElementById('pb-custom-km').value;
  if (!time||!date) { alert('Inserisci almeno tempo e data.'); return; }
  const pbData = {dist:selectedPbDist,customKm,time,date,race};
  const docRef = await window._fb.addPb(window._uid, pbData);
  pbs.push({_id: docRef.id, ...pbData});
  ['pb-time','pb-date','pb-race-name'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('pb-add-form').classList.remove('show');
  renderPbList('pb-list-profile',true); renderPbList('pb-list-progress',false);
}
window.savePb = savePb;

async function deletePb(id) {
  if (!confirm('Eliminare questo PB?')) return;
  await window._fb.deletePb(window._uid, id);
  pbs = pbs.filter(p=>p._id!==id);
  renderPbList('pb-list-profile',true); renderPbList('pb-list-progress',false);
}
window.deletePb = deletePb;

function renderPbList(containerId, withDelete) {
  const el=document.getElementById(containerId); if(!el) return;
  if(!pbs.length){el.innerHTML='<div style="font-size:13px;color:#aaa;padding:8px 0">Nessun PB inserito.</div>';return;}
  const sorted=[...pbs].sort((a,b)=>DIST_ORDER.indexOf(a.dist)-DIST_ORDER.indexOf(b.dist));
  el.innerHTML=sorted.map(p=>{
    const color=PB_COLORS[p.dist]||'#888';
    const lbl=p.dist==='custom'?(p.customKm+' km'):(PB_FULL[p.dist]||p.dist);
    const d=new Date(p.date);
    return `<div class="pb-row">
      <div class="pb-dist-label" style="color:${color}">${lbl}</div>
      <div class="pb-bar-wrap"><div class="pb-bar" style="background:${color};width:80%"></div></div>
      <div class="pb-time">${p.time}</div>
      <div class="pb-date-label">${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}</div>
      ${p.race?`<div style="font-size:11px;color:#888;width:100%">${p.race}</div>`:''}
      ${withDelete?`<button class="btn-icon" onclick="deletePb('${p._id}')">×</button>`:''}
    </div>`;
  }).join('');
}

// ══ HISTORY ════════════════════════════════════════════════════════
function toggleAddHistory() { document.getElementById('add-history-form').classList.toggle('show'); }
window.toggleAddHistory = toggleAddHistory;

async function saveHistoryRace() {
  const name=document.getElementById('h-name').value.trim(), date=document.getElementById('h-date').value;
  if (!name||!date) { alert('Inserisci almeno nome e data.'); return; }
  const dist=document.getElementById('h-dist').value, customKm=document.getElementById('h-custom-km').value;
  const time=document.getElementById('h-time').value.trim(), goal=document.getElementById('h-goal').value.trim();
  const pos=document.getElementById('h-pos').value, posCat=document.getElementById('h-pos-cat').value;
  const elev=document.getElementById('h-elev').value, meteo=document.getElementById('h-meteo').value.trim();
  const loc=document.getElementById('h-loc').value.trim(), notes=document.getElementById('h-notes').value.trim();
  const hData = {name,date,dist,customKm,time,goal,pos,posCat,elev,meteo,loc,notes};
  const docRef = await window._fb.addHistory(window._uid, hData);
  historyRaces.push({_id: docRef.id, ...hData});
  historyRaces.sort((a,b)=>new Date(b.date)-new Date(a.date));
  ['h-name','h-date','h-time','h-goal','h-pos','h-pos-cat','h-elev','h-meteo','h-loc','h-notes','h-custom-km']
    .forEach(id=>document.getElementById(id).value='');
  document.getElementById('add-history-form').classList.remove('show');
  renderHistory();
}
window.saveHistoryRace = saveHistoryRace;

async function deleteHistoryRace(id) {
  if (!confirm('Eliminare questa gara dallo storico?')) return;
  await window._fb.deleteHistory(window._uid, id);
  historyRaces = historyRaces.filter(h=>h._id!==id);
  renderHistory();
}
window.deleteHistoryRace = deleteHistoryRace;

function renderHistory() {
  const el=document.getElementById('history-list');
  const doneFromRaces = races.filter(r=>r.done).map(r=>({
    _id:'r_'+r._id, name:r.name, date:r.date, dist:r.dist, customKm:r.customKm,
    loc:r.loc, elev:r.elev, goal:r.goal, time:'—', manual:false
  }));
  const all = [...historyRaces.map(h=>({...h,manual:true})), ...doneFromRaces]
    .sort((a,b)=>new Date(b.date)-new Date(a.date));

  if (!all.length) { el.innerHTML='<div style="font-size:13px;color:#aaa;padding:8px 0">Nessuna gara completata ancora.</div>'; return; }

  el.innerHTML = all.map(r => {
    const d=new Date(r.date);
    const dateStr=d.getDate()+' '+MONTHS[d.getMonth()]+' '+d.getFullYear();
    const lbl=(r.dist==='custom'||r.dist==='UM')?(r.customKm+' km'):(DIST_LABEL[r.dist]||r.dist);
    const raceTs=new Date(r.date).getTime(), twelveWks=12*7*24*3600*1000;
    const relSess = !r.manual ? Object.entries(sessions)
      .filter(([k,s])=>{ const t=new Date(k).getTime(); return t<=raceTs&&t>=(raceTs-twelveWks)&&s.type!=='rest'; })
      .sort((a,b)=>new Date(a[0])-new Date(b[0])) : [];
    const metaItems = [
      r.time&&r.time!=='—'?`⏱ ${r.time}`:'',
      r.goal&&r.goal!=='—'?`Target: ${r.goal}`:'',
      r.pos?`Pos. assoluta: ${r.pos}°`:'',
      r.posCat?`Pos. cat.: ${r.posCat}°`:'',
      r.elev?`↑${r.elev}m`:'',
      r.meteo||'', r.loc||''
    ].filter(Boolean).join(' · ');

    return `<div class="history-item">
      <div class="history-race-header">
        <div style="flex:1">
          <div class="history-race-name">${r.name}</div>
          <div class="history-race-meta">${dateStr}${metaItems?' · '+metaItems:''}</div>
          ${r.notes?`<div style="font-size:13px;color:#555;margin-top:6px;line-height:1.5">📝 ${r.notes}</div>`:''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
          <span class="race-badge ${DIST_CLS[r.dist]||'rd-cu'}">${lbl}</span>
          ${r.manual?`<button class="btn-icon" style="font-size:14px" onclick="deleteHistoryRace('${r._id}')">×</button>`:''}
        </div>
      </div>
      ${relSess.length?`
        <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">${relSess.length} sessioni di preparazione</div>
        ${relSess.slice(0,8).map(([k,s])=>{
          const sd=new Date(k);
          return `<div class="history-sess-row">
            <div class="history-sess-dot" style="background:${TYPE_COLORS[s.type]||'#888'}"></div>
            <div style="flex:1;font-weight:500">${s.title||TYPE_LABEL[s.type]||'—'}</div>
            <div style="color:#888">${s.dist||'—'}</div>
            <div style="font-size:11px;color:#aaa;margin-left:10px">${sd.getDate()} ${MONTHS[sd.getMonth()]}</div>
          </div>`;
        }).join('')}
        ${relSess.length>8?`<div style="font-size:12px;color:#aaa;padding:6px 10px">+${relSess.length-8} altre sessioni</div>`:''}
      `:''}
    </div>`;
  }).join('');
}
window.renderHistory = renderHistory;
