/* ============================================================
   KIA DUE BILL TRACKER — app.js v1.1.8
   Towbin Kia · Telluride UI + Full Send/Vendor/Note Functionality
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {

  // ══════════════ PASSWORD GATE ══════════════
  const GATE_KEY    = 'kia_gate_ts';
  const GATE_EXPIRY = 12 * 60 * 60 * 1000; // 12 hours
  // To change password: get SHA-256 hash at sha256.online and replace CORRECT_HASH below
  const CORRECT_HASH = '8dc4cd568b81bb06592b5791049765e503cf43af74e5bb8c383124a1bf2cda9f';

  async function hashInput(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  function isAuthed() {
    const ts = localStorage.getItem(GATE_KEY);
    return ts && (Date.now() - parseInt(ts)) < GATE_EXPIRY;
  }

  function signOut() {
    localStorage.removeItem(GATE_KEY);
    const gate = document.getElementById('password-gate');
    const input = document.getElementById('gate-input');
    if (gate) gate.style.display = 'flex';
    if (input) { input.value = ''; setTimeout(()=>input.focus(), 100); }
  }
  window.signOut = signOut;

  window.checkGatePassword = async function() {
    const input = document.getElementById('gate-input');
    const errEl = document.getElementById('gate-error');
    const pwd   = input ? input.value : '';
    let hash;
    try {
      hash = await hashInput(pwd);
    } catch(e) {
      // crypto.subtle unavailable (file:// protocol) — hash manually
      hash = '';
    }
    if (hash === CORRECT_HASH) {
      localStorage.setItem(GATE_KEY, Date.now().toString());
      const gate = document.getElementById('password-gate');
      if (gate) gate.style.display = 'none';
      if (errEl) errEl.style.display = 'none';
    } else {
      if (errEl) errEl.style.display = 'block';
      if (input) { input.value = ''; input.focus(); }
    }
  };

  window.toggleGatePwd = function() {
    const input = document.getElementById('gate-input');
    const eyeEl = document.getElementById('gate-eye');
    if (!input || !eyeEl) return;
    if (input.type === 'password') {
      input.type = 'text';
      eyeEl.innerHTML = "<path d='M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24'/><line x1='1' y1='1' x2='23' y2='23'/>";
    } else {
      input.type = 'password';
      eyeEl.innerHTML = "<path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'/><circle cx='12' cy='12' r='3'/>";
    }
  };

  // Show or hide gate on load
  const gate = document.getElementById('password-gate');
  if (isAuthed()) {
    if (gate) gate.style.display = 'none';
  } else {
    if (gate) gate.style.display = 'flex';
    setTimeout(()=>{ const i=document.getElementById('gate-input'); if(i)i.focus(); },100);
  }

  // Session expiry check every minute
  setInterval(()=>{
    if (!isAuthed()) {
      const g=document.getElementById('password-gate');
      if (g) g.style.display='flex';
      const i=document.getElementById('gate-input'); if(i){i.value='';i.focus();}
    }
  }, 60000);
  const VENDOR_MAP = {
    'GPS':          { key: 'kia_service',    label: 'Kia Service' },
    'Red Alert':    { key: 'kia_service',    label: 'Kia Service' },
    'Polysteel':    { key: 'kia_service',    label: 'Kia Service' },
    'XPEL Tint':    { key: 'fam_solutions',  label: 'Fam Solutions' },
    'XPEL PPF':     { key: 'fam_solutions',  label: 'Fam Solutions' },
    'Ceramic Coat': { key: 'fam_solutions',  label: 'Fam Solutions' },
    'Body Work':    { key: 'body_shop',      label: 'Body Shop' },
    'Detail':       { key: 'detail',         label: 'Detail' },
    'Powder Wheels':{ key: 'powder_coating', label: 'Powder Coating' },
    'Other':        { key: 'other_vendor',   label: 'Other Vendor' }
  };

  // VENDOR PHONE BOOK — stored in localStorage as JSON array
  const PHONEBOOK_KEY = 'kia_phonebook_v1';
  function getPhonebook() {
    try { return JSON.parse(localStorage.getItem(PHONEBOOK_KEY)) || getDefaultPhonebook(); }
    catch(e) { return getDefaultPhonebook(); }
  }
  function getDefaultPhonebook() {
    return [
      { id:'pb1', label:'Kia Service',    phone:'' },
      { id:'pb2', label:'Fam Solutions',  phone:'' },
      { id:'pb3', label:'Body Shop',      phone:'' },
      { id:'pb4', label:'Detail',         phone:'' },
      { id:'pb5', label:'Powder Coating', phone:'' },
      { id:'pb6', label:'Other Vendor',   phone:'' }
    ];
  }
  function savePhonebook(pb) {
    localStorage.setItem(PHONEBOOK_KEY, JSON.stringify(pb));
    // Push to Sheets in background
    pushPhonebookToSheets(pb);
  }

  function pushPhonebookToSheets(pb) {
    if (!sheetScriptUrl) return;
    fetch(sheetScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'savePhonebook', phonebook: pb })
    }).catch(()=>{});
  }

  async function pullPhonebookFromSheets() {
    if (!sheetScriptUrl) return;
    try {
      const res = await fetch(sheetScriptUrl + '?action=getPhonebook', { redirect: 'follow' });
      const data = JSON.parse(await res.text());
      if (data.success && Array.isArray(data.phonebook) && data.phonebook.length > 0) {
        localStorage.setItem(PHONEBOOK_KEY, JSON.stringify(data.phonebook));
      }
    } catch(e) {}
  }
  // Keep VENDOR_KEYS for backward compat with VENDOR_MAP phone lookup
  function getVendorPhone(key) {
    // First check old localStorage keys
    const old = localStorage.getItem('vendor_phone_'+key);
    if (old) return old;
    // Check phonebook by matching label to vendor map
    const pb = getPhonebook();
    const labelMap = {
      'kia_service':'Kia Service','fam_solutions':'Fam Solutions',
      'body_shop':'Body Shop','detail':'Detail',
      'powder_coating':'Powder Coating','other_vendor':'Other Vendor'
    };
    const entry = pb.find(e=>e.label===labelMap[key]);
    return entry ? entry.phone : '';
  }

  const LS_KEY     = 'kia-duebills-v4';
  const INIT_KEY   = 'kia-init-v4';
  const GSHEET_KEY = 'kia-gsheet-url';

  const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwNAVNS7_6fzfCEttpDW1QsvHRPv14aM7aOfCR8yJ31-i_smDWNfIpVxB0TRxgwy0k-/exec';
  let sheetScriptUrl = localStorage.getItem(GSHEET_KEY) || DEFAULT_SCRIPT_URL;
  let syncState      = 'local';
  let soundEnabled   = true;
  let currentFilter  = 'all';
  let _scanFilling   = false;

  // UTILITIES
  function beep(freq=600, dur=0.08, type='sine') {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext||window.webkitAudioContext)();
      const o=ctx.createOscillator(), g=ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value=freq; o.type=type;
      g.gain.setValueAtTime(0.12,ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);
      o.start(); o.stop(ctx.currentTime+dur);
    } catch(e){}
  }

  function todayStr() {
    const d=new Date();
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }

  function nowTs() {
    const d=new Date();
    return (d.getMonth()+1)+'/'+d.getDate()+'/'+String(d.getFullYear()).slice(-2)+' '+d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
  }

  function fmtDate(ds) {
    if (!ds) return '';
    const d=new Date(ds+'T00:00:00');
    const m=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return m[d.getMonth()]+' '+d.getDate();
  }

  function getBills()       { try { return JSON.parse(localStorage.getItem(LS_KEY))||[]; } catch(e){ return []; } }
  function saveBills(bills) { localStorage.setItem(LS_KEY,JSON.stringify(bills)); }
  // getVendorPhone now handled by phonebook above

  function computeStatus(bill) {
    if (bill.completedAt) return 'completed';
    return 'scheduled'; // all active bills are scheduled
  }

  // VENDOR MESSAGE BUILDER
  function buildVendorGroups(serviceNames) {
    const groups={};
    const pb=getPhonebook();
    serviceNames.forEach(name=>{
      const info=VENDOR_MAP[name];
      if (!info) return;
      if (!groups[info.key]) {
        // Get phone from phonebook by matching label
        const labelMap={kia_service:'Kia Service',fam_solutions:'Fam Solutions',body_shop:'Body Shop',detail:'Detail',powder_coating:'Powder Coating',other_vendor:'Other Vendor'};
        const pbEntry=pb.find(e=>e.label===labelMap[info.key]);
        const phone=pbEntry?pbEntry.phone:(localStorage.getItem('vendor_phone_'+info.key)||'');
        groups[info.key]={label:info.label,key:info.key,items:[],phone};
      }
      groups[info.key].items.push(name);
    });
    return groups;
  }

  function buildMessage(vendorLabel, items, bill) {
    return 'DUE BILL — Towbin Kia\n'+
      'Stock: '+(bill.stockNumber||'N/A')+(bill.vehicleDescription?' | '+bill.vehicleDescription:'')+'\n'+
      'Customer: '+(bill.customerName||'N/A')+(bill.customerPhone?' | '+bill.customerPhone:'')+'\n'+
      'Work Needed: '+items.join(', ')+'\n'+
      'Salesperson: '+(bill.salesperson||'—')+'\n'+
      'Please schedule ASAP.';
  }

  function openSMS(phone, body) {
    const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
    window.location.href='sms:'+phone+(isIOS?'&':'?')+'body='+encodeURIComponent(body);
  }

  function openWhatsApp(phone, body) {
    window.open('https://wa.me/'+phone.replace(/\D/g,'')+'?text='+encodeURIComponent(body),'_blank');
  }

  function addNoteToBill(billId, text) {
    const bills=getBills();
    const bill=bills.find(b=>b.id===billId);
    if (!bill) return;
    const line=nowTs()+' — '+text;
    bill.notes=bill.notes?bill.notes+'\n'+line:line;
    saveBills(bills);
    pushToSheets('update',bill);
  }

  // GOOGLE SHEETS SYNC
  async function sheetGet(params) {
    if (!sheetScriptUrl) return null;
    const qs=Object.entries(params).map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(typeof v==='object'?JSON.stringify(v):String(v))).join('&');
    try {
      const res=await fetch(sheetScriptUrl+'?'+qs,{redirect:'follow'});
      return JSON.parse(await res.text());
    } catch(e){ return null; }
  }

  async function pullFromSheets() {
    if (!sheetScriptUrl){ updateSyncDot('local'); return; }
    updateSyncDot('syncing');
    const r=await sheetGet({action:'getAll'});
    if (r&&r.success&&Array.isArray(r.bills)){
      localStorage.setItem(LS_KEY,JSON.stringify(r.bills));
      updateSyncDot('live');
      updateHomeStats();
      if (document.getElementById('view-tracker').classList.contains('active-view')) renderTracker();
    } else { updateSyncDot('error'); }
  }

  function pushToSheets(action, payload) {
    if (!sheetScriptUrl) return;
    const params={action};
    if (action==='delete') params.id=payload; else params.data=payload;
    sheetGet(params).then(result=>{
      if(result&&result.success===false){
        showPushToast('⚠ Sheet sync failed — data saved locally');
      }
    }).catch(()=>{
      showPushToast('⚠ Sheet sync failed — data saved locally');
    });
  }

  function showPushToast(msg) {
    // Don't show on every keystroke — only on real failures
    const existing = document.getElementById('push-toast');
    if (existing) return; // already showing
    const t = document.createElement('div');
    t.id = 'push-toast';
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:60px;left:50%;transform:translateX(-50%);background:rgba(245,158,11,0.95);color:#000;padding:8px 18px;border-radius:20px;font-size:11px;font-weight:700;z-index:99999;pointer-events:none;white-space:nowrap;';
    document.body.appendChild(t);
    setTimeout(()=>{ if(t.parentNode)t.parentNode.removeChild(t); }, 4000);
  }

  function updateSyncDot(state) {
    syncState=state;
    const dot=document.getElementById('sync-status-dot');
    const lbl=document.getElementById('sync-status-label');
    const ws=document.getElementById('widget-sync');
    const map={live:['#10b981','LIVE','Last sync: just now'],syncing:['#f59e0b','SYNC','Syncing...'],error:['#ff4455','ERR','Sync error — check Settings'],local:['rgba(255,255,255,0.18)','LOCAL','Offline — data saved locally']};
    const [color,label,wsText]=map[state]||map.local;
    if (dot){ dot.style.background=color; dot.style.boxShadow=state==='live'?'0 0 6px #10b981':'none'; }
    if (lbl) lbl.textContent=label;
    if (ws)  ws.textContent=wsText;
  }

  function saveSheetUrl(url) {
    sheetScriptUrl=(url||'').trim();
    if (sheetScriptUrl){ localStorage.setItem(GSHEET_KEY,sheetScriptUrl); pullFromSheets(); }
    else { localStorage.removeItem(GSHEET_KEY); updateSyncDot('local'); }
  }

  // CLOCK
  function updateClock() {
    const now=new Date(), el=document.getElementById('clock');
    if (el) el.textContent=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  }
  setInterval(updateClock,1000); updateClock();

  function updateWidgetDate() {
    const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
    const now=new Date(), el=document.getElementById('widget-date');
    if (el) el.textContent=days[now.getDay()]+', '+months[now.getMonth()]+' '+now.getDate();
  }
  updateWidgetDate();

  // SEED DATA
  function seedData() {
    if (localStorage.getItem(INIT_KEY)) return;
    saveBills([
      { id:'b1',customerName:'Griselda Puentes Zavaleta',stockNumber:'T6189',vehicleDescription:'2026 Kia Telluride SX',licensePlate:'',vin:'',saleDate:'2026-05-25',salesperson:'Aaliyah Alvarado',salesManager:'',customerPhone:'',notified:false,services:[{id:'s1',name:'GPS',notes:'',status:'pending',completedAt:null},{id:'s2',name:'Red Alert',notes:'',status:'pending',completedAt:null},{id:'s3',name:'Polysteel',notes:'',status:'pending',completedAt:null},{id:'s4',name:'XPEL Tint',notes:'',status:'pending',completedAt:null}],priority:'high',notes:'',createdAt:'2026-05-25T10:00:00Z',completedAt:null },
      { id:'b2',customerName:'Marcus Thompson',stockNumber:'T6201',vehicleDescription:'2026 Kia Sportage LX',licensePlate:'',vin:'',saleDate:'2026-06-10',salesperson:'James Rivera',salesManager:'',customerPhone:'',notified:false,services:[{id:'s6',name:'Ceramic Coat',notes:'',status:'pending',completedAt:null},{id:'s7',name:'XPEL PPF',notes:'',status:'in-progress',completedAt:null}],priority:'medium',notes:'',createdAt:'2026-06-10T14:00:00Z',completedAt:null }
    ]);
    localStorage.setItem(INIT_KEY,'1');
  }
  seedData();

  // VIEW SYSTEM
  function showView(name) {
    document.querySelectorAll('.view').forEach(v=>{ v.classList.remove('active-view'); v.style.display='none'; });
    const el=document.getElementById('view-'+name);
    if (el){ el.style.display='flex'; el.classList.add('active-view'); }
    const lbl=document.getElementById('current-view-label');
    if (lbl) lbl.textContent=name.replace(/-/g,' ').toUpperCase();
    beep(700,0.07);
    if (name==='home')     updateHomeStats();
    if (name==='tracker')  { renderTracker(); pullFromSheets(); }
    if (name==='new-bill') initNewBillForm();
    if (name==='settings') renderVendorSettings();
    const det=document.getElementById('detail-overlay');
    if (det) det.classList.remove('show');
  }

  // HOME STATS + PHONEBOOK
  function updateHomeStats() {
    const bills=getBills(), today=todayStr();
    let scheduled=0, doneToday=0;
    bills.forEach(b=>{ const s=computeStatus(b); if(s!=='completed')scheduled++; if(b.completedAt&&b.completedAt.startsWith(today))doneToday++; });
    const srEl=document.getElementById('stat-overdue'), stEl=document.getElementById('stat-today'), hcEl=document.getElementById('home-chips');
    if(srEl)srEl.textContent=scheduled;
    if(stEl)stEl.textContent=doneToday;
    if(hcEl)hcEl.innerHTML='<span class="home-chip white">'+scheduled+' SCHEDULED</span>';
    renderHomePhonebook();
  }

  function renderHomePhonebook() {
    const container=document.getElementById('home-phonebook'); if(!container)return;
    const pb=getPhonebook();
    container.innerHTML=pb.map((v,idx)=>`
      <div style="display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
        <div>
          <input type="text" class="home-pb-label" data-idx="${idx}" value="${v.label||''}" placeholder="Vendor name"
            style="width:100%;background:transparent;border:none;color:rgba(255,255,255,0.8);font-size:11px;font-weight:600;font-family:inherit;outline:none;padding:0;margin-bottom:2px;">
          <input type="tel" class="home-pb-phone" data-idx="${idx}" value="${v.phone||''}" placeholder="Phone number"
            style="width:100%;background:transparent;border:none;color:rgba(255,255,255,0.4);font-size:10px;font-family:inherit;outline:none;padding:0;">
        </div>
        <button class="home-pb-delete" data-idx="${idx}"
          style="background:none;border:none;color:rgba(255,68,85,0.5);cursor:pointer;font-size:14px;padding:4px;flex-shrink:0;">✕</button>
      </div>`).join('');

    container.querySelectorAll('.home-pb-label,.home-pb-phone').forEach(input=>{
      input.addEventListener('blur',function(){
        const pb2=getPhonebook(), idx=parseInt(this.dataset.idx);
        if(this.classList.contains('home-pb-label')) pb2[idx].label=this.value.trim();
        else pb2[idx].phone=this.value.trim();
        savePhonebook(pb2);
      });
    });
    container.querySelectorAll('.home-pb-delete').forEach(btn=>{
      btn.addEventListener('click',function(){
        const pb2=getPhonebook(); pb2.splice(parseInt(this.dataset.idx),1);
        savePhonebook(pb2); renderHomePhonebook();
      });
    });
  }

  // Add vendor from home widget
  const homeAddVendor=document.getElementById('home-add-vendor');
  if(homeAddVendor)homeAddVendor.addEventListener('click',function(){
    const pb=getPhonebook();
    pb.push({id:'pb'+Date.now(),label:'',phone:''});
    savePhonebook(pb); renderHomePhonebook();
    setTimeout(()=>{
      const inputs=document.querySelectorAll('.home-pb-label');
      if(inputs.length)inputs[inputs.length-1].focus();
    },50);
  });

  updateHomeStats();

  // NAVIGATION
  document.getElementById('tile-new-bill').addEventListener('click',()=>showView('new-bill'));
  document.getElementById('tile-tracker').addEventListener('click', ()=>showView('tracker'));
  document.getElementById('tile-scan').addEventListener('click',    ()=>showView('scan'));
  document.getElementById('tile-settings').addEventListener('click',()=>showView('settings'));
  document.getElementById('close-new-bill').addEventListener('click',()=>showView('home'));
  document.getElementById('close-tracker').addEventListener('click', ()=>showView('home'));
  document.getElementById('close-scan').addEventListener('click',    ()=>showView('home'));
  document.getElementById('close-settings').addEventListener('click',()=>showView('home'));
  document.getElementById('close-detail').addEventListener('click',()=>document.getElementById('detail-overlay').classList.remove('show'));
  document.getElementById('key-back').addEventListener('click',()=>showView('home'));
  document.getElementById('key-home').addEventListener('click',()=>showView('home'));

  // NEW BILL FORM
  function initNewBillForm() {
    if (_scanFilling){ _scanFilling=false; return; }
    window._lastScannedImage = null; // clear photo when starting fresh
    const dateEl=document.getElementById('nb-date'); if(dateEl)dateEl.value=todayStr();
    ['nb-stock','nb-customer','nb-license','nb-model','nb-salesperson','nb-customer-phone','nb-notes'].forEach(id=>{ const el=document.getElementById(id); if(el)el.value=''; });
    const yearEl=document.getElementById('nb-year'); if(yearEl)yearEl.value=new Date().getFullYear();
    const makeEl=document.getElementById('nb-make'); if(makeEl)makeEl.selectedIndex=0;
    document.querySelectorAll('#work-grid .work-btn').forEach(btn=>btn.classList.remove('work-selected'));
    const flash=document.getElementById('scan-success-flash'); if(flash)flash.classList.remove('show');
    updateMessagePreview();
  }

  document.getElementById('work-grid').addEventListener('click',function(e){
    const btn=e.target.closest('.work-btn'); if(!btn)return;
    btn.classList.toggle('work-selected'); beep(700,0.05); updateMessagePreview();
  });

  function getSelectedServices() {
    const svcs=[];
    document.querySelectorAll('#work-grid .work-btn.work-selected').forEach(btn=>{
      const lbl=btn.querySelector('.work-label'); if(lbl)svcs.push(lbl.textContent.trim());
    });
    return svcs;
  }

  function buildVehicleDesc() {
    const year=document.getElementById('nb-year')?document.getElementById('nb-year').value.trim():'';
    const make=document.getElementById('nb-make')?document.getElementById('nb-make').value:'';
    const model=document.getElementById('nb-model')?document.getElementById('nb-model').value.trim():'';
    return [year,make,model].filter(Boolean).join(' ');
  }

  function updateMessagePreview() {
    const previewEl=document.getElementById('msg-preview'); if(!previewEl)return;
    const svcs=getSelectedServices();
    if (!svcs.length){ previewEl.textContent='Select promised work above to preview the vendor messages.'; previewEl.style.color='rgba(255,255,255,0.2)'; return; }
    const fakeBill={stockNumber:document.getElementById('nb-stock')?document.getElementById('nb-stock').value||'N/A':'N/A',vehicleDescription:buildVehicleDesc(),customerName:document.getElementById('nb-customer')?document.getElementById('nb-customer').value||'N/A':'N/A',salesperson:document.getElementById('nb-salesperson')?document.getElementById('nb-salesperson').value||'':'',customerPhone:document.getElementById('nb-customer-phone')?document.getElementById('nb-customer-phone').value||'':''};
    const groups=buildVendorGroups(svcs);
    let preview='';
    Object.values(groups).forEach(g=>{
      const phone=getVendorPhone(g.key);
      preview+='TO: '+g.label+(phone?' ('+phone+')':' — NO NUMBER SAVED')+'\n';
      preview+=buildMessage(g.label,g.items,fakeBill)+'\n\n'+'─────────────────────\n\n';
    });
    previewEl.textContent=preview.trim(); previewEl.style.color='rgba(255,255,255,0.6)';
  }

  ['nb-stock','nb-customer','nb-salesperson','nb-customer-phone','nb-year','nb-model'].forEach(id=>{
    const el=document.getElementById(id); if(el)el.addEventListener('input',updateMessagePreview);
  });
  const _makeEl=document.getElementById('nb-make'); if(_makeEl)_makeEl.addEventListener('change',updateMessagePreview);

  // SUBMIT + SEND TEXTS
  document.getElementById('submit-bill').addEventListener('click',function(){
    const customer=document.getElementById('nb-customer').value.trim();
    if(!customer){document.getElementById('nb-customer').focus();return;}
    const svcs=getSelectedServices();
    if(!svcs.length){alert('Select at least one promised work item.');return;}

    const newBill={
      id:'b'+Date.now(),customerName:customer,
      stockNumber:document.getElementById('nb-stock').value.trim(),
      vehicleDescription:buildVehicleDesc(),
      licensePlate:document.getElementById('nb-license').value.trim(),
      vin:'',saleDate:document.getElementById('nb-date').value,
      promisedDate:'',customerPhone:document.getElementById('nb-customer-phone').value.trim(),salesperson:document.getElementById('nb-salesperson').value.trim(),
      salesManager:'',priority:'medium',
      notes:document.getElementById('nb-notes').value.trim(),
      services:svcs.map((name,i)=>({id:'svc'+i,name,notes:'',status:'pending',completedAt:null})),
      createdAt:new Date().toISOString(),completedAt:null
    };

    // Mark notified immediately — bill reaches tracker after send modal
    newBill.notified = true;
    const bills=getBills(); bills.unshift(newBill); saveBills(bills); pushToSheets('add',newBill);
    const groups=buildVendorGroups(svcs);

    showSendModal(newBill,groups,function(mode){
      const groupList=Object.values(groups);
      const sentVendors=[];

      if (mode==='sms'){
        let idx=0;
        function sendNext(){
          if(idx>=groupList.length){
            if(sentVendors.length) addNoteToBill(newBill.id,'Texted '+sentVendors.join(', ')+' to schedule appointment.');
            beep(523,0.08); setTimeout(()=>beep(784,0.1),120);
            initNewBillForm(); showView('tracker'); return;
          }
          const g=groupList[idx];
          const phone=getVendorPhone(g.key);
          if(phone){ openSMS(phone,buildMessage(g.label,g.items,newBill)); sentVendors.push(g.label); }
          idx++;
          setTimeout(sendNext,phone?1800:200);
        }
        sendNext();
      } else if (mode==='whatsapp'){
        groupList.forEach(g=>{
          const phone=getVendorPhone(g.key);
          if(phone){ openWhatsApp(phone,buildMessage(g.label,g.items,newBill)); sentVendors.push(g.label); }
        });
        if(sentVendors.length) addNoteToBill(newBill.id,'WhatsApp sent to '+sentVendors.join(', ')+' to schedule appointment.');
        beep(523,0.08); setTimeout(()=>beep(784,0.1),120);
        initNewBillForm(); showView('tracker');
      } else {
        initNewBillForm(); showView('tracker');
      }
    });
  });

  // SEND MODAL
  function showSendModal(bill, groups, callback) {
    const overlay=document.getElementById('send-modal'), body=document.getElementById('send-modal-body');
    if(!overlay||!body){callback('skip');return;}

    const groupList=Object.values(groups);
    const sentVendors=[];

    function doNote() {
      if(sentVendors.length) addNoteToBill(bill.id,'Messaged vendor to setup appointment.');
    }

    const _vendorMessages={};
    groupList.forEach(g=>{ _vendorMessages[g.key]=buildMessage(g.label,g.items,bill); });

    window._trackSent=function(key,label) {
      if(!sentVendors.includes(label)){ sentVendors.push(label); doNote(); }
    };

    window._copyVendorMsg=function(key) {
      const msg=document.getElementById('msg_edit_'+key)?document.getElementById('msg_edit_'+key).value:_vendorMessages[key]; if(!msg)return;
      if(navigator.clipboard){ navigator.clipboard.writeText(msg).then(showCopyToast); }
      else { const ta=document.createElement('textarea');ta.value=msg;ta.style.cssText='position:fixed;opacity:0;';document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);showCopyToast(); }
      const g=groupList.find(g=>g.key===key);
      if(g&&!sentVendors.includes(g.label)){sentVendors.push(g.label);doNote();}
    };

    function showCopyToast(){
      const t=document.createElement('div');t.textContent='Message copied!';
      t.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#22cc88;color:#000;padding:8px 20px;border-radius:20px;font-size:12px;font-weight:700;z-index:99999;pointer-events:none;';
      document.body.appendChild(t);setTimeout(()=>document.body.removeChild(t),2000);
    }

    // Build editable messages per vendor
    const editableMsgs={};
    groupList.forEach(g=>{ editableMsgs[g.key]=buildMessage(g.label,g.items,bill); });
    window._vendorMessages=editableMsgs;

    const vendorRows=groupList.map(g=>{
      const phone=g.phone||getVendorPhone(g.key),hasPhone=phone&&phone.trim();
      const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
      // SMS/WA hrefs built dynamically from textarea at send time
      return `<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px 14px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div><div style="font-size:13px;font-weight:700;color:#fff;">${g.label}</div><div style="font-size:10px;color:rgba(255,255,255,0.4);margin-top:2px;">${g.items.join(', ')}</div></div>
          <div style="font-size:11px;${hasPhone?'color:#22cc88':'color:#ff4455'}">${hasPhone?phone:'No number — Settings'}</div>
        </div>
        <textarea id="msg_edit_${g.key}" style="width:100%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:10px;color:rgba(255,255,255,0.8);font-size:11px;font-family:inherit;line-height:1.6;resize:vertical;min-height:90px;outline:none;margin-bottom:8px;">${editableMsgs[g.key]}</textarea>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
          ${hasPhone?`
          <button onclick="window._sendSMS('${g.key}','${phone}','${g.label}')" style="padding:10px;background:#C8102E;border:none;border-radius:8px;color:#fff;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit;text-transform:uppercase;letter-spacing:1px;">📱 SMS</button>
          <button onclick="window._sendWA('${g.key}','${phone}','${g.label}')" style="padding:10px;background:#25D366;border:none;border-radius:8px;color:#fff;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit;text-transform:uppercase;letter-spacing:1px;">💬 WA</button>
          `:`
          <div style="padding:10px;background:rgba(255,255,255,0.03);border-radius:8px;color:rgba(255,255,255,0.2);font-size:10px;text-align:center;">No #</div>
          <div style="padding:10px;background:rgba(255,255,255,0.03);border-radius:8px;color:rgba(255,255,255,0.2);font-size:10px;text-align:center;">No #</div>
          `}
          <button onclick="window._copyVendorMsg('${g.key}')" style="padding:10px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:rgba(255,255,255,0.7);font-size:10px;font-weight:700;cursor:pointer;font-family:inherit;text-transform:uppercase;letter-spacing:1px;">📋 COPY</button>
        </div>
      </div>`;
    }).join('');

    // SMS/WA/Copy now read from editable textarea
    const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
    window._sendSMS=function(key,phone,label){
      const msg=document.getElementById('msg_edit_'+key)?document.getElementById('msg_edit_'+key).value:window._vendorMessages[key];
      window.location.href='sms:'+phone+(isIOS?'&':'?')+'body='+encodeURIComponent(msg);
      window._trackSent(key,label);
    };
    window._sendWA=function(key,phone,label){
      const msg=document.getElementById('msg_edit_'+key)?document.getElementById('msg_edit_'+key).value:window._vendorMessages[key];
      window.open('https://wa.me/'+phone.replace(/\D/g,'')+'?text='+encodeURIComponent(msg),'_blank');
      window._trackSent(key,label);
    };

    // Build photo section if we have a scanned image
    const scannedImg = window._lastScannedImage;
    const photoSection = scannedImg ? `
      <div style="margin-bottom:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px;text-align:center;">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.3);margin-bottom:10px;">DUE BILL PHOTO — ATTACH TO YOUR MESSAGE</div>
        <img src="${scannedImg.dataUrl}" style="max-width:100%;max-height:160px;border-radius:6px;object-fit:contain;display:block;margin:0 auto 10px;" alt="Due Bill">
        <button onclick="window._saveScanPhoto()" style="padding:8px 20px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:8px;color:#fff;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit;text-transform:uppercase;letter-spacing:1px;">⬇ SAVE PHOTO TO CAMERA ROLL</button>
        <div style="font-size:9px;color:rgba(255,255,255,0.2);margin-top:8px;">Save first, then attach it when your messaging app opens.</div>
      </div>` : '';

    window._saveScanPhoto = function() {
      if(!window._lastScannedImage) return;
      const a = document.createElement('a');
      a.href = window._lastScannedImage.dataUrl;
      a.download = 'due-bill-' + (bill.stockNumber || Date.now()) + '.jpg';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      // Flash the button green
      const btn = document.querySelector('[onclick="window._saveScanPhoto()"]');
      if(btn){ btn.textContent='✓ SAVED!'; btn.style.background='rgba(34,200,136,0.2)'; btn.style.borderColor='#22cc88'; btn.style.color='#22cc88'; setTimeout(()=>{ btn.textContent='⬇ SAVE PHOTO TO CAMERA ROLL'; btn.style.background='rgba(255,255,255,0.08)'; btn.style.borderColor='rgba(255,255,255,0.15)'; btn.style.color='#fff'; },2000); }
    };

    body.innerHTML=`${photoSection}<div style="font-size:9px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.3);margin-bottom:12px;">SEND TO VENDORS</div>${vendorRows}<div style="font-size:9px;color:rgba(255,255,255,0.2);margin-top:4px;font-style:italic;">A note is saved automatically when you send or copy.</div>`;
    overlay.style.display='flex';
    const smsBtn=document.getElementById('send-modal-sms');
    const waBtn=document.getElementById('send-modal-wa');
    if(smsBtn)smsBtn.style.display='none';
    if(waBtn)waBtn.style.display='none';
    const skipBtn=document.getElementById('send-modal-skip');
    if(skipBtn){skipBtn.textContent='Done — Close';skipBtn.onclick=()=>{overlay.style.display='none';callback('skip');};}
    const closeBtn=document.getElementById('send-modal-close');
    if(closeBtn)closeBtn.onclick=()=>{overlay.style.display='none';callback('skip');};
  }


  // TRACKER
  function renderTracker() {
    const bills=getBills();
    let open=0,notified=0,completed=0;
    bills.forEach(b=>{ const s=computeStatus(b); if(s!=='completed')open++; else completed++; notified=open; });
    const tsOpen=document.getElementById('ts-open'),tsOverdue=document.getElementById('ts-overdue'),tsDone=document.getElementById('ts-done');
    if(tsOpen)tsOpen.textContent=open; if(tsOverdue)tsOverdue.textContent=notified; if(tsDone)tsDone.textContent=completed;

    const search=(document.getElementById('tracker-search')||{value:''}).value.toLowerCase().trim();
    let filtered=currentFilter==='all'?bills:bills.filter(b=>computeStatus(b)===currentFilter);
    if(search)filtered=filtered.filter(b=>(b.customerName||'').toLowerCase().includes(search)||(b.stockNumber||'').toLowerCase().includes(search)||(b.customerPhone||'').toLowerCase().includes(search));
    const list=document.getElementById('bill-list'); if(!list)return;

    if(!filtered.length){
      list.innerHTML='<div class="empty-state"><div style="width:40px;height:40px;border:2px solid rgba(255,255,255,0.15);border-radius:50%;display:flex;align-items:center;justify-content:center;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg></div><div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.3);">NO DUE BILLS</div></div>';
      return;
    }

    list.innerHTML=filtered.map(b=>{
      const status=computeStatus(b);
      const borderColor=status==='overdue'?'#ff4455':status==='due-soon'||status==='in-progress'?'#f59e0b':status==='complete'?'#22cc88':'rgba(255,255,255,0.15)';
      const badgeMap={scheduled:['notified','SCHEDULED'],completed:['complete','COMPLETED']};
      const [badgeClass,badgeLabel]=badgeMap[status]||['notified','SCHEDULED'];
      const svcsHtml=b.services.slice(0,4).map(s=>{const cls=s.status==='in-progress'?'in-progress':s.status==='complete'?'complete':'pending';const short=s.name.length>12?s.name.slice(0,12)+'…':s.name;return`<span class="svc-tag ${cls}">${short}</span>`;}).join('');
      const lastNote=b.notes?(b.notes.split('\n').filter(Boolean).pop()||''):'';
      return `<div class="bill-card" data-bill-id="${b.id}" style="border-left:4px solid ${borderColor};">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:13px;font-weight:700;color:#fff;">${b.customerName}</span>
          ${b.stockNumber?`<span style="font-size:9px;border:1px solid rgba(200,16,46,0.4);color:#ff6677;padding:2px 8px;border-radius:4px;">${b.stockNumber}</span>`:''}
        </div>
        <div style="font-size:11px;color:rgba(255,255,255,0.45);margin-top:2px;">${b.vehicleDescription}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;"><div>${svcsHtml}</div>${b.customerPhone?`<span style="font-size:10px;color:rgba(255,255,255,0.4);">${b.customerPhone}</span>`:''}</div>
        ${lastNote?`<div style="font-size:9px;color:rgba(255,255,255,0.25);margin-top:6px;font-style:italic;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${lastNote}</div>`:''}
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
          <span style="font-size:9px;color:rgba(255,255,255,0.3);font-style:italic;">${b.salesperson||''}</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <span class="status-badge ${badgeClass}">${badgeLabel}</span>
            ${status!=='completed'?'<button class="action-btn btn-complete" data-action="complete" title="Mark Complete"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg></button>':'<button class="action-btn btn-undo" data-action="undo" title="Undo Complete" style="color:#f59e0b;border-color:rgba(245,158,11,0.3);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg></button>'}
            <button class="action-btn" data-action="view" title="View Detail"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
            <button class="action-btn" data-action="resend" title="Resend Texts"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
            <button class="action-btn btn-delete" data-action="delete" title="Delete"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  document.getElementById('filter-bar').addEventListener('click',function(e){
    const pill=e.target.closest('.filter-pill'); if(!pill)return;
    document.querySelectorAll('#filter-bar .filter-pill').forEach(p=>p.classList.remove('active'));
    pill.classList.add('active'); currentFilter=pill.dataset.filter; beep(700,0.05); renderTracker();
  });

  document.getElementById('bill-list').addEventListener('click',function(e){
    const btn=e.target.closest('[data-action]'); if(!btn)return;
    const card=btn.closest('[data-bill-id]'); const id=card?card.dataset.billId:null; if(!id)return;
    const action=btn.dataset.action;
    if(action==='complete')markComplete(id,card);
    if(action==='view')viewBill(id);
    if(action==='delete')deleteBill(id);
    if(action==='resend')resendTexts(id);
    if(action==='undo')undoComplete(id);
  });

  function markComplete(id,cardEl){
    const bills=getBills(), bill=bills.find(b=>b.id===id); if(!bill)return;
    bill.services.forEach(s=>{s.status='complete';s.completedAt=todayStr();}); bill.completedAt=todayStr();
    saveBills(bills); pushToSheets('update',bill);
    addNoteToBill(id,'All services marked complete.');
    beep(523,0.08); setTimeout(()=>beep(784,0.1),120);
    if(cardEl){cardEl.classList.add('flash-green');setTimeout(()=>{renderTracker();updateHomeStats();},600);}
    else{renderTracker();updateHomeStats();}
  }

  function undoComplete(id){
    const bills=getBills(), bill=bills.find(b=>b.id===id); if(!bill)return;
    bill.completedAt=null;
    bill.notified=true; // keep notified — vendor was still texted
    bill.services.forEach(s=>{s.status='pending';s.completedAt=null;});
    saveBills(bills); pushToSheets('update',bill);
    addNoteToBill(id,'Marked incomplete — reopened.');
    beep(400,0.1);
    renderTracker(); updateHomeStats();
  }

  function deleteBill(id){
    if(!confirm('Delete this due bill?'))return;
    saveBills(getBills().filter(b=>b.id!==id)); pushToSheets('delete',id);
    beep(300,0.1); renderTracker(); updateHomeStats();
  }

  function resendTexts(id){
    const bill=getBills().find(b=>b.id===id); if(!bill)return;
    const groups=buildVendorGroups(bill.services.map(s=>s.name));
    // showSendModal handles per-vendor SMS/WA/Copy links and auto-notes
    showSendModal(bill,groups,function(){ renderTracker(); });
  }

  // BILL DETAIL
  function viewBill(id){
    const bill=getBills().find(b=>b.id===id); if(!bill)return;
    const status=computeStatus(bill), body=document.getElementById('detail-body');
    const statusColor=status==='overdue'?'#ff4455':status==='complete'?'#22cc88':'#f59e0b';
    const svcRows=bill.services.map((s,i)=>{
      const dc=s.status==='in-progress'?'#f59e0b':s.status==='complete'?'#22cc88':'rgba(255,255,255,0.3)';
      return `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);"><span style="font-size:10px;color:rgba(255,255,255,0.3);width:16px;">${i+1}.</span><span style="width:8px;height:8px;border-radius:50%;background:${dc};flex-shrink:0;"></span><span style="font-size:12px;color:rgba(255,255,255,0.7);flex:1;">${s.name}</span><span style="font-size:9px;color:rgba(255,255,255,0.3);text-transform:uppercase;">${s.status.replace('-',' ')}</span></div>`;
    }).join('');

    const renderNotes=()=>{
      if(!bill.notes)return'<div style="font-size:10px;color:rgba(255,255,255,0.2);font-style:italic;">No notes yet.</div>';
      return bill.notes.split('\n').filter(Boolean).map(line=>`<div style="padding:5px 0;font-size:10px;color:rgba(255,255,255,0.5);border-bottom:1px solid rgba(255,255,255,0.04);">${line}</div>`).join('');
    };

    body.innerHTML=`
      <div style="text-align:center;margin-bottom:16px;"><div style="font-style:italic;font-weight:900;font-size:20px;color:#fff;letter-spacing:1px;">TOWBIN KIA</div><div style="font-size:24px;font-weight:800;color:#C8102E;letter-spacing:3px;margin-top:4px;">DUE BILL</div></div>
      <table class="detail-table">
        <tr><td>DATE</td><td>${fmtDate(bill.saleDate)}</td></tr>
        <tr><td>VEHICLE</td><td>${bill.vehicleDescription}</td></tr>
        <tr><td>STOCK #</td><td>${bill.stockNumber||'—'}</td></tr>
        <tr><td>CUSTOMER</td><td>${bill.customerName}</td></tr>
        <tr><td>SALESPERSON</td><td>${bill.salesperson||'—'}</td></tr>
        <tr><td>LICENSE</td><td>${bill.licensePlate||'—'}</td></tr>
        <tr><td>CUSTOMER PHONE</td><td>${bill.customerPhone||'—'}</td></tr>
        <tr><td>STATUS</td><td style="text-transform:uppercase;color:${statusColor};">${status.replace('-',' ')}</td></tr>
      </table>
      <div style="margin-top:16px;font-size:9px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.35);margin-bottom:8px;">PROMISED SERVICES</div>
      ${svcRows}
      <div style="margin-top:16px;font-size:9px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.35);margin-bottom:8px;">NOTE HISTORY</div>
      <div id="detail-notes-list" style="margin-bottom:10px;max-height:90px;overflow-y:auto;">${renderNotes()}</div>
      <div style="display:flex;gap:8px;margin-bottom:14px;">
        <input type="text" id="detail-note-input" placeholder="Add a note..." style="flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:7px 10px;color:#fff;font-size:12px;font-family:inherit;outline:none;">
        <button id="detail-note-save" style="padding:7px 14px;background:#C8102E;border:none;border-radius:6px;color:#fff;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit;">ADD</button>
      </div>
      <div class="notice-box">NOTHING ELSE PROMISED OR IMPLIED</div>
      <button class="btn-submit" id="btn-print-detail" style="margin-top:14px;">PRINT DUE BILL</button>`;

    document.getElementById('detail-note-save').addEventListener('click',function(){
      const input=document.getElementById('detail-note-input'), text=input?input.value.trim():'';
      if(!text)return;
      addNoteToBill(id,text); if(input)input.value='';
      const updated=getBills().find(b=>b.id===id);
      if(updated)bill.notes=updated.notes;
      const nl=document.getElementById('detail-notes-list'); if(nl)nl.innerHTML=renderNotes();
      beep(700,0.05);
    });
    document.getElementById('btn-print-detail').addEventListener('click',()=>printBill(bill));
    document.getElementById('detail-overlay').classList.add('show');
  }


  // PRINT BILL
  function printBill(bill) {
    const status = computeStatus(bill);
    const svcRows = bill.services.map((s,i) =>
      `<tr><td>${i+1}</td><td>${s.name}</td><td style="text-transform:capitalize;">${s.status.replace('-',' ')}</td></tr>`
    ).join('');

    const win = window.open('','_blank','width=800,height=600');
    win.document.write(`<!DOCTYPE html><html><head><title>Due Bill ${bill.id||''}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:40px;max-width:700px;margin:0 auto;color:#000;}
      .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #C8102E;padding-bottom:16px;margin-bottom:24px;}
      .kia{font-style:italic;font-weight:900;font-size:36px;color:#C8102E;letter-spacing:2px;}
      .title{font-size:22px;font-weight:900;text-transform:uppercase;color:#000;margin-top:4px;}
      .sub{font-size:11px;color:#666;margin-top:2px;}
      table{width:100%;border-collapse:collapse;margin-bottom:20px;}
      th{background:#C8102E;color:#fff;padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;}
      td{padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;}
      td:first-child{color:#666;font-size:11px;text-transform:uppercase;width:140px;}
      .notice{border:2px solid #000;padding:12px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:20px 0;}
      .sigs{display:flex;justify-content:space-between;margin-top:40px;}
      .sig{border-top:1px solid #000;padding-top:6px;font-size:11px;color:#666;width:200px;}
      .ftr{text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;border-top:2px solid #C8102E;padding-top:12px;margin-top:20px;color:#C8102E;}
      .print-btn{margin-top:20px;padding:12px 28px;background:#C8102E;color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:700;cursor:pointer;}
      @media print{.print-btn{display:none;}}
    </style></head><body>
    <div class="hdr">
      <div><div class="kia">KIA</div><div class="title">Due Bill</div><div class="sub">Towbin Kia · 260 N Gibson Rd, Henderson NV · (702) 567-8000</div></div>
      <div style="text-align:right;"><div style="font-size:11px;color:#666;">Bill ID</div><div style="font-size:18px;font-weight:900;color:#C8102E;">${bill.id||'—'}</div><div style="font-size:11px;color:#666;margin-top:4px;">${bill.saleDate||''}</div></div>
    </div>
    <table>
      <tr><td>Customer</td><td><strong>${bill.customerName||'—'}</strong></td></tr>
      <tr><td>Vehicle</td><td>${bill.vehicleDescription||'—'}</td></tr>
      <tr><td>Stock #</td><td>${bill.stockNumber||'—'}</td></tr>
      <tr><td>License Plate</td><td>${bill.licensePlate||'—'}</td></tr>
      <tr><td>Salesperson</td><td>${bill.salesperson||'—'}</td></tr>
      <tr><td>Customer Phone</td><td>${bill.customerPhone||'—'}</td></tr>
    </table>
    <table>
      <thead><tr><th>#</th><th>Promised Work</th><th>Status</th></tr></thead>
      <tbody>${svcRows}</tbody>
    </table>
    ${bill.notes?`<div style="margin-bottom:20px;font-size:12px;"><strong>Notes:</strong> ${bill.notes.split('\n').join('<br>')}</div>`:''}
    <div class="notice">NOTE: The above promised work is the ONLY work to be performed free of charge.<br>All work must be done in our shop. Appointment required.</div>
    <div class="sigs">
      <div><div class="sig">Sales Manager Signature</div></div>
      <div><div class="sig">Customer Signature</div></div>
    </div>
    <div class="ftr">Due to insurance regulations — No loan cars available</div>
    <br><button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
    </body></html>`);
    win.document.close();
  }

  // SCAN VIEW
  function handleScanFile(file){
    if(!file)return;
    const scanOverlay=document.getElementById('scan-overlay'); if(scanOverlay)scanOverlay.style.display='flex';
    const resultsEl=document.getElementById('scan-results'); if(resultsEl)resultsEl.innerHTML='';

    const reader=new FileReader();
    reader.onload=async function(e){
      const base64=e.target.result.split(',')[1], mimeType=file.type||'image/jpeg';

      if(!sheetScriptUrl){
        if(scanOverlay)scanOverlay.style.display='none';
        if(resultsEl)resultsEl.innerHTML='<div style="padding:12px;background:rgba(255,68,85,0.1);border:1px solid rgba(255,68,85,0.3);border-radius:8px;font-size:11px;color:#ff8899;line-height:1.6;"><strong>No Apps Script URL saved.</strong> Go to Settings, paste your URL and save first.</div>';
        return;
      }

      try {
        const res = await fetch(sheetScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ action: 'scanBill', base64, mimeType })
        });
        const result = await res.json();
        if(!result.success) throw new Error(result.error || 'Scan failed');
        if(scanOverlay)scanOverlay.style.display='none';
        // Store the scanned image for attaching in send modal
        window._lastScannedImage = { dataUrl: e.target.result, mimeType };
        _scanFilling=true; showView('new-bill'); setTimeout(()=>fillNewBillForm(result.data),80);
      } catch(err){
        if(scanOverlay)scanOverlay.style.display='none';
        // Still store image even if AI scan failed — staff filled form manually
        window._lastScannedImage = { dataUrl: e.target.result, mimeType };
        if(resultsEl)resultsEl.innerHTML=`<div style="padding:12px;background:rgba(255,68,85,0.1);border:1px solid rgba(255,68,85,0.3);border-radius:8px;font-size:11px;color:#ff8899;line-height:1.6;"><strong>Scan failed:</strong> ${err.message}<br><br>Fill in the form manually and hit ISSUE DUE BILL to send texts.</div>`;
        setTimeout(()=>{ _scanFilling=false; showView('new-bill'); },2500);
      }
    };
    reader.onerror=()=>{ if(scanOverlay)scanOverlay.style.display='none'; alert('Could not read file.'); };
    reader.readAsDataURL(file);
  }

  function fillNewBillForm(data){
    if(!data)return;
    const setField=(id,v)=>{ const el=document.getElementById(id); if(el&&v)el.value=v; };
    const toDate=str=>{ if(!str)return''; const p=str.split('/'); if(p.length===3)return p[2]+'-'+p[0].padStart(2,'0')+'-'+p[1].padStart(2,'0'); return/^\d{4}-\d{2}-\d{2}$/.test(str)?str:str; };
    setField('nb-date',toDate(data.date)); setField('nb-stock',data.stockNumber);
 setField('nb-customer',data.customerName);
    setField('nb-license',data.licensePlate); setField('nb-year',data.year); setField('nb-model',data.model);
    setField('nb-salesperson',data.salesperson); setField('nb-customer-phone',data.customerPhone||''); setField('nb-notes',data.notes);
    if(data.make){const mk=document.getElementById('nb-make');if(mk){const match=Array.from(mk.options).find(o=>o.value.toLowerCase()===data.make.toLowerCase()||o.value.toLowerCase().includes(data.make.toLowerCase())||data.make.toLowerCase().includes(o.value.toLowerCase()));if(match)mk.value=match.value;}}
    document.querySelectorAll('#work-grid .work-btn').forEach(btn=>btn.classList.remove('work-selected'));
    if(data.services&&Array.isArray(data.services)){document.querySelectorAll('#work-grid .work-btn').forEach(btn=>{const label=(btn.getAttribute('data-work')||'').toLowerCase();if(data.services.some(svc=>{ const s=svc.toLowerCase();return s.includes(label)||label.includes(s);}))btn.classList.add('work-selected');});}
    const flash=document.getElementById('scan-success-flash');if(flash){flash.classList.add('show');setTimeout(()=>flash.classList.remove('show'),4000);}
    updateMessagePreview(); beep(523,0.08); setTimeout(()=>beep(784,0.1),120);
  }

  const fileInput=document.getElementById('file-input'), cameraInput=document.getElementById('camera-input');
  if(fileInput)fileInput.addEventListener('change',function(){if(this.files[0])handleScanFile(this.files[0]);this.value='';});
  if(cameraInput)cameraInput.addEventListener('change',function(){
    const file=this.files[0]; if(!file)return;
    // Auto-save camera photo to device immediately
    const url=URL.createObjectURL(file);
    const a=document.createElement('a');
    a.href=url; a.download='due-bill-'+Date.now()+'.jpg';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    handleScanFile(file);
    this.value='';
  });

  document.getElementById('btn-browse').addEventListener('click',()=>{if(fileInput)fileInput.click();});
  document.getElementById('btn-camera').addEventListener('click',()=>{if(cameraInput)cameraInput.click();});
  document.getElementById('btn-retake').addEventListener('click',()=>{initNewBillForm();showView('scan');});

  const dropZone=document.getElementById('scan-drop-zone');
  if(dropZone){
    dropZone.addEventListener('dragover',e=>{e.preventDefault();dropZone.classList.add('dragover');});
    dropZone.addEventListener('dragleave',()=>dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop',e=>{e.preventDefault();dropZone.classList.remove('dragover');const f=e.dataTransfer&&e.dataTransfer.files[0];if(f)handleScanFile(f);});
    dropZone.addEventListener('click',()=>{if(fileInput)fileInput.click();});
  }

  // SETTINGS — VENDOR PHONEBOOK
  function renderVendorSettings(){
    const container=document.getElementById('vendor-phone-rows'); if(!container)return;
    const pb=getPhonebook();
    container.innerHTML=pb.map((v,idx)=>`
      <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
        <input type="text" class="field-input pb-label" data-idx="${idx}" placeholder="Vendor name" value="${v.label||''}" style="font-size:12px;">
        <input type="tel" class="field-input pb-phone" data-idx="${idx}" placeholder="+17025550100" value="${v.phone||''}" style="font-size:12px;">
        <button class="pb-delete" data-idx="${idx}" style="padding:8px 10px;background:rgba(255,68,85,0.1);border:1px solid rgba(255,68,85,0.3);border-radius:8px;color:#ff4455;cursor:pointer;font-size:12px;flex-shrink:0;">✕</button>
      </div>`).join('');

    // Save on blur
    container.querySelectorAll('.pb-label,.pb-phone').forEach(input=>{
      input.addEventListener('blur',function(){
        const pb2=getPhonebook();
        const idx=parseInt(this.dataset.idx);
        if(this.classList.contains('pb-label')) pb2[idx].label=this.value.trim();
        else pb2[idx].phone=this.value.trim();
        savePhonebook(pb2);
      });
    });
    // Delete vendor
    container.querySelectorAll('.pb-delete').forEach(btn=>{
      btn.addEventListener('click',function(){
        const pb2=getPhonebook();
        pb2.splice(parseInt(this.dataset.idx),1);
        savePhonebook(pb2);
        renderVendorSettings();
      });
    });
  }

  // Add vendor button
  const btnAddVendor=document.getElementById('btn-add-vendor');
  if(btnAddVendor)btnAddVendor.addEventListener('click',()=>openPhonebookModal());



  const toggleSound=document.getElementById('toggle-sound');
  if(toggleSound)toggleSound.addEventListener('click',function(){this.classList.toggle('on');soundEnabled=this.classList.contains('on');});


  const btnExport=document.getElementById('btn-export');
  if(btnExport)btnExport.addEventListener('click',function(){
    const blob=new Blob([JSON.stringify(getBills(),null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='kia-duebills-export.json';document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);beep(523,0.08);
  });

  const btnClear=document.getElementById('btn-clear');
  if(btnClear)btnClear.addEventListener('click',function(){
    if(!confirm('Clear ALL due bill data? Cannot be undone.'))return;
    localStorage.removeItem(LS_KEY);localStorage.removeItem(INIT_KEY);beep(300,0.15);updateHomeStats();
    if(document.getElementById('view-tracker').classList.contains('active-view'))renderTracker();
  });

  const sheetUrlInput=document.getElementById('sheet-url-input');
  if(sheetUrlInput&&sheetScriptUrl)sheetUrlInput.value=sheetScriptUrl;

  const btnSaveUrl=document.getElementById('btn-save-sheet-url');
  if(btnSaveUrl)btnSaveUrl.addEventListener('click',function(){
    const url=sheetUrlInput?sheetUrlInput.value:'';saveSheetUrl(url);
    const lbl=document.getElementById('sync-label-settings');if(lbl)lbl.textContent=url?'CONNECTING...':'NOT CONNECTED';
  });

  const btnSyncNow=document.getElementById('btn-sync-now');
  if(btnSyncNow)btnSyncNow.addEventListener('click',async function(){
    await pullFromSheets();
    const lbl=document.getElementById('sync-label-settings'),dot=document.getElementById('sync-status-dot-settings');
    if(syncState==='live'){if(dot)dot.style.background='#10b981';if(lbl)lbl.textContent='CONNECTED — Google Sheets is live ✓';}
    else if(syncState==='error'){if(dot)dot.style.background='#ff4455';if(lbl)lbl.textContent='ERROR — check URL and redeploy';}
  });

  // INJECT SYNC DOT
  (function(){
    const iconsEl=document.getElementById('status-icons-right');
    if(iconsEl&&iconsEl.parentNode){
      const badge=document.createElement('div');
      badge.style.cssText='display:flex;align-items:center;gap:5px;margin-left:10px;padding-left:10px;border-left:1px solid rgba(255,255,255,0.08);';
      badge.innerHTML='<div id="sync-status-dot" style="width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,0.18);flex-shrink:0;transition:background 0.3s,box-shadow 0.3s;"></div><span id="sync-status-label" style="font-size:8px;font-weight:700;letter-spacing:1.5px;color:rgba(255,255,255,0.3);text-transform:uppercase;">LOCAL</span>';
      iconsEl.parentNode.appendChild(badge);
    }
  })();

  // STARTUP SYNC
  updateSyncDot(sheetScriptUrl?'syncing':'local');
  if(sheetScriptUrl){
    const lbl=document.getElementById('sync-label-settings'),dot=document.getElementById('sync-status-dot-settings');
    if(lbl)lbl.textContent='CONNECTED — syncing...';if(dot)dot.style.background='#f59e0b';
    pullPhonebookFromSheets().then(()=>renderHomePhonebook());
    pullFromSheets().then(()=>{
      if(syncState==='live'){
        const l=document.getElementById('sync-label-settings'),d=document.getElementById('sync-status-dot-settings');
        if(l)l.textContent='CONNECTED — Google Sheets is live ✓';if(d)d.style.background='#10b981';
      }
    });
  }

}); // end DOMContentLoaded
