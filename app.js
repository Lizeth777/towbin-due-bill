// TOWBIN KIA — DUE BILL TRACKER — app.js

// ---- CONSTANTS ----
const TK_KEY    = "tk_auth_ts";
const TK_EXPIRY = 12 * 60 * 60 * 1000;
const SCRIPT_URL = localStorage.getItem("google_script_url") || "https://script.google.com/macros/s/AKfycbyTq072YxvYWJq-omI0t7z43MaBfGZYF8VOkErnVTWFqI-CN_GgGMLmzdNc3BTYO1EP/exec";

const ITEMS = [
  { id:"gps",       label:"GPS",           vendor:"Kia Service"    },
  { id:"redalert",  label:"Red Alert",     vendor:"Kia Service"    },
  { id:"polysteel", label:"Polysteel",     vendor:"Kia Service"    },
  { id:"tint",      label:"XPEL Tint",     vendor:"Fam Solutions"  },
  { id:"ppf",       label:"XPEL PPF",      vendor:"Fam Solutions"  },
  { id:"ceramic",   label:"Ceramic Coat",  vendor:"Fam Solutions"  },
  { id:"bodyshop",  label:"Body Work",     vendor:"Body Shop"      },
  { id:"detail",    label:"Detail",        vendor:"Detail"         },
  { id:"powder",    label:"Powder Wheels", vendor:"Powder Coating" },
  { id:"other",     label:"Other",         vendor:"Other Vendor"   },
];
const VENDOR_KEYS = [...new Set(ITEMS.map(i => i.vendor))];

const MAKES_MODELS = {
  'Acura':['CL','ILX','Integra','MDX','NSX','RDX','RLX','TL','TLX','TSX','ZDX'],
  'Alfa Romeo':['4C','Giulia','Giulietta','MiTo','Stelvio','Tonale'],
  'Audi':['A3','A4','A5','A6','A7','A8','e-tron','e-tron GT','Q3','Q4 e-tron','Q5','Q7','Q8','R8','RS3','RS5','RS6','RS7','S3','S4','S5','S6','S7','S8','SQ5','SQ7','TT'],
  'BMW':['1 Series','2 Series','3 Series','4 Series','5 Series','6 Series','7 Series','8 Series','i3','i4','i5','i7','iX','M2','M3','M4','M5','M8','X1','X2','X3','X4','X5','X6','X7','XM','Z4'],
  'Buick':['Cascada','Enclave','Encore','Encore GX','Envision','Envista','LaCrosse','Regal','Verano'],
  'Cadillac':['ATS','CT4','CT5','CT6','CTS','Escalade','Escalade ESV','Lyriq','SRX','XTS','XT4','XT5','XT6'],
  'Chevrolet':['Blazer','Bolt EUV','Bolt EV','Camaro','Colorado','Corvette','Cruze','Equinox','Express','Impala','Malibu','Silverado 1500','Silverado 2500HD','Silverado 3500HD','Sonic','Spark','Suburban','Tahoe','TrailBlazer','Traverse','Trax'],
  'Chrysler':['300','Pacifica','Pacifica Hybrid','Voyager'],
  'Dodge':['Challenger','Charger','Durango','Grand Caravan','Hornet','Journey'],
  'Ford':['Bronco','Bronco Sport','EcoSport','Edge','Escape','Expedition','Explorer','F-150','F-150 Lightning','F-250 Super Duty','F-350 Super Duty','Maverick','Mustang','Mustang Mach-E','Ranger','Transit'],
  'Genesis':['G70','G80','G90','GV60','GV70','GV80'],
  'GMC':['Acadia','Canyon','Sierra 1500','Sierra 2500HD','Sierra 3500HD','Terrain','Yukon','Yukon XL'],
  'Honda':['Accord','Accord Hybrid','CR-V','CR-V Hybrid','Fit','HR-V','Odyssey','Passport','Pilot','Ridgeline'],
  'Hyundai':['Accent','Elantra','Elantra N','Ioniq 5','Ioniq 6','Kona','Palisade','Santa Cruz','Santa Fe','Sonata','Tucson','Tucson Hybrid','Venue'],
  'Infiniti':['Q50','Q60','Q70','QX50','QX55','QX60','QX80'],
  'Jaguar':['E-Pace','F-Pace','F-Type','I-Pace','XE','XF','XJ'],
  'Jeep':['Cherokee','Compass','Gladiator','Grand Cherokee','Grand Cherokee 4xe','Grand Cherokee L','Renegade','Wrangler','Wrangler 4xe'],
  'Kia':['Cadenza','Carnival','EV6','EV9','Forte','K4','K5','K900','Niro','Niro EV','Optima','Rio','Seltos','Soul','Sorento','Sorento Hybrid','Sportage','Sportage Hybrid','Stinger','Telluride'],
  'Land Rover':['Defender','Discovery','Discovery Sport','Range Rover','Range Rover Evoque','Range Rover Sport','Range Rover Velar'],
  'Lexus':['ES 250','ES 300h','ES 350','GX 460','GX 550','IS 300','IS 350','IS 500','LC 500','LS 500','LX 600','NX 250','NX 350','NX 350h','RX 350','RX 350h','RX 450h','RZ 450e','UX 200','UX 250h'],
  'Lincoln':['Aviator','Continental','Corsair','Nautilus','Navigator','Navigator L'],
  'Mazda':['CX-3','CX-30','CX-5','CX-50','CX-90','Mazda3','Mazda6','MX-5 Miata'],
  'Mercedes-Benz':['A-Class','AMG GT','C-Class','CLA-Class','CLS-Class','E-Class','EQB','EQC','EQE','EQS','G-Class','GLA-Class','GLB-Class','GLC-Class','GLE-Class','GLS-Class','S-Class','SL-Class','Sprinter'],
  'MINI':['Clubman','Convertible','Cooper','Countryman','Hardtop 2 Door','Hardtop 4 Door'],
  'Mitsubishi':['Eclipse Cross','Outlander','Outlander PHEV','Outlander Sport'],
  'Nissan':['Altima','Armada','Ariya','Frontier','GT-R','Kicks','Leaf','Maxima','Murano','Pathfinder','Rogue','Rogue Sport','Sentra','Titan','Versa','Z'],
  'Porsche':['718 Boxster','718 Cayman','911','Cayenne','Macan','Panamera','Taycan'],
  'Ram':['1500','1500 Classic','2500','3500','ProMaster','ProMaster City'],
  'Rivian':['R1S','R1T','R2'],
  'Subaru':['Ascent','BRZ','Crosstrek','Forester','Impreza','Legacy','Outback','Solterra','WRX'],
  'Tesla':['Cybertruck','Model 3','Model S','Model X','Model Y'],
  'Toyota':['4Runner','Camry','Camry Hybrid','Corolla','Corolla Cross','Corolla Hybrid','Crown','GR86','GR Corolla','Highlander','Highlander Hybrid','Land Cruiser','Prius','Prius Prime','RAV4','RAV4 Hybrid','RAV4 Prime','Sequoia','Sienna','Tacoma','Tundra','Venza'],
  'Volkswagen':['Arteon','Atlas','Atlas Cross Sport','Golf GTI','Golf R','ID.4','ID.Buzz','Jetta','Passat','Taos','Tiguan'],
  'Volvo':['C40 Recharge','EX30','EX90','S60','S90','V60','XC40','XC40 Recharge','XC60','XC90'],
  'Other':['-- Type model below --'],
};
const ALL_MAKES = Object.keys(MAKES_MODELS).sort();

// ---- STATE ----
let _billsCache = null;
let currentFilter = "all";

// ---- AUTH ----
function isLoggedIn() {
  const ts = localStorage.getItem(TK_KEY);
  if (!ts) return false;
  return (Date.now() - parseInt(ts)) < TK_EXPIRY;
}
function setLoggedIn() { localStorage.setItem(TK_KEY, Date.now().toString()); }
function signOut() {
  localStorage.removeItem(TK_KEY);
  document.getElementById("passwordGate").style.display = "flex";
  document.getElementById("pwdInput").value = "";
  document.getElementById("pwdError").style.display = "none";
  setTimeout(() => { const el = document.getElementById("pwdInput"); if(el) el.focus(); }, 100);
}
async function checkPassword() {
  const input = document.getElementById("pwdInput").value;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  const hashed = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
  if (hashed === "6d46d54ffa54a5eb9554b1a62c1cc2f2897c79f311296e5c56147bdee8d7e908") {
    setLoggedIn();
    document.getElementById("passwordGate").style.display = "none";
    try { await Promise.all([fetchBills(), fetchVendors()]); updateOpenCount(); renderTracker(); } catch(e) { console.error(e); }
  } else {
    document.getElementById("pwdError").style.display = "block";
    document.getElementById("pwdInput").value = "";
    document.getElementById("pwdInput").focus();
  }
}
function togglePwd() {
  const i = document.getElementById("pwdInput");
  const e = document.getElementById("eyeIcon");
  if (!i || !e) return;
  if (i.type === "password") {
    i.type = "text";
    e.innerHTML = "<path d='M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24'/><line x1='1' y1='1' x2='23' y2='23'/>";
  } else {
    i.type = "password";
    e.innerHTML = "<path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'/><circle cx='12' cy='12' r='3'/>";
  }
}

// ---- API ----
async function apiGet(action) {
  const r = await fetch(SCRIPT_URL + "?action=" + action);
  return r.json();
}
async function apiPost(payload) {
  const r = await fetch(SCRIPT_URL, { method:"POST", headers:{"Content-Type":"text/plain"}, body:JSON.stringify(payload) });
  return r.json();
}

// ---- DATA ----
async function fetchBills() {
  const res = await apiGet("getBills");
  _billsCache = res.bills || [];
  return _billsCache;
}
function getBills() { return _billsCache || []; }
async function fetchVendors() {
  const res = await apiGet("getVendors");
  const vendors = res.vendors || {};
  Object.entries(vendors).forEach(([vendor, phone]) => {
    const key = "vendor_" + vendor.replace(/\s+/g,"_");
    const el = document.getElementById("vs_" + key);
    if (el) el.value = phone;
    localStorage.setItem(key, phone);
  });
}

// ---- NAVIGATION ----
function showTab(name) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
  const page = document.getElementById("page-" + name);
  if (page) page.classList.add("active");
  document.querySelectorAll(".nav-tab").forEach(t => {
    if ((t.getAttribute("onclick")||"").includes("'" + name + "'")) t.classList.add("active");
  });
  if (name === "tracker") { renderTracker(); updateOpenCount(); }
}

// ---- VEHICLE DROPDOWNS ----
function initYearDropdown() {
  const sel = document.getElementById("vehicleYear");
  if (!sel) return;
  const cur = new Date().getFullYear();
  for (let y = cur + 1; y >= 2000; y--) {
    const opt = document.createElement("option");
    opt.value = y; opt.textContent = y;
    if (y === cur) opt.selected = true;
    sel.appendChild(opt);
  }
}
function initMakeDropdown() {
  const sel = document.getElementById("vehicleMake");
  if (!sel) return;
  ALL_MAKES.forEach(make => {
    const opt = document.createElement("option");
    opt.value = make; opt.textContent = make;
    sel.appendChild(opt);
  });
}
function updateModelDropdown() {
  const make = document.getElementById("vehicleMake") ? document.getElementById("vehicleMake").value : "";
  const sel = document.getElementById("vehicleModel");
  if (!sel) return;
  sel.innerHTML = "<option value=''>Select Model</option>";
  const otherWrap = document.getElementById("vehicleOtherWrap");
  if (make === "Other") {
    sel.style.display = "none";
    if (otherWrap) otherWrap.style.display = "block";
  } else {
    sel.style.display = "block";
    if (otherWrap) otherWrap.style.display = "none";
    if (make && MAKES_MODELS[make]) {
      MAKES_MODELS[make].forEach(model => {
        const opt = document.createElement("option");
        opt.value = model; opt.textContent = model;
        sel.appendChild(opt);
      });
    }
  }
  buildVehicleDesc();
}
function buildVehicleDesc() {
  const year  = document.getElementById("vehicleYear")  ? document.getElementById("vehicleYear").value  : "";
  const make  = document.getElementById("vehicleMake")  ? document.getElementById("vehicleMake").value  : "";
  const model = document.getElementById("vehicleModel") ? document.getElementById("vehicleModel").value : "";
  const otherInput = document.getElementById("vehicleOther");
  const desc = document.getElementById("vehicleDesc");
  if (!desc) return;
  if (make === "Other") {
    desc.value = otherInput ? otherInput.value.trim() : "";
  } else {
    desc.value = [year, make, model].filter(Boolean).join(" ");
  }
  updatePreview();
}

// ---- FORM ----
function v(id) { const el = document.getElementById(id); return el ? el.value.trim() : ""; }

function buildItemsGrid() {
  const grid = document.getElementById("itemsGrid");
  if (!grid) return;
  ITEMS.forEach(item => {
    const div = document.createElement("div");
    div.className = "item-chip";
    div.id = "chip_" + item.id;
    div.innerHTML = `<input type="checkbox" id="chk_${item.id}"><div class="chip-check"><span class="chip-checkmark">✓</span></div><div class="chip-label">${item.label}</div><div class="chip-vendor">${item.vendor}</div>`;
    div.onclick = () => {
      const chk = document.getElementById("chk_" + item.id);
      chk.checked = !chk.checked;
      div.classList.toggle("checked", chk.checked);
      updatePreview();
    };
    grid.appendChild(div);
  });
}

function getCheckedByVendor() {
  const map = {};
  ITEMS.forEach(item => {
    const chk = document.getElementById("chk_" + item.id);
    if (chk && chk.checked) {
      if (!map[item.vendor]) map[item.vendor] = [];
      map[item.vendor].push(item.label);
    }
  });
  return map;
}

function buildMsg(vendor, items, stock, customer, vehicle, sales, date) {
  return "DUE BILL ALERT — Towbin Kia\nStock: " + stock + (vehicle ? " | " + vehicle : "") + "\nCustomer: " + customer + "\nWork Needed: " + items.join(", ") + "\nSalesperson: " + (sales||"") + (date ? "\nDate: " + date : "") + "\nPlease schedule ASAP. Call the store to coordinate.";
}

function updatePreview() {
  const map = getCheckedByVendor();
  const box = document.getElementById("previewBox");
  if (!box) return;
  if (!Object.keys(map).length) { box.textContent = "Select work items above to preview the vendor text messages."; return; }
  const stock = v("stockNum") || "N/A", customer = v("customerName") || "N/A";
  const vehicle = v("vehicleDesc"), sales = v("salesperson"), date = v("billDate");
  let txt = "";
  Object.entries(map).forEach(([vendor, items]) => {
    const num = localStorage.getItem("vendor_" + vendor.replace(/\s+/g,"_")) || "(no number saved)";
    txt += "TO: " + vendor + "  (" + num + ")\n" + buildMsg(vendor, items, stock, customer, vehicle, sales, date) + "\n\n" + "─".repeat(40) + "\n\n";
  });
  box.textContent = txt.trim();
}

function addLog(msg, type) {
  const log = document.getElementById("sendLog");
  if (!log) return;
  const div = document.createElement("div");
  div.className = "log-entry log-" + type;
  div.textContent = msg;
  log.prepend(div);
}

function resetForm() {
  ITEMS.forEach(item => {
    const chk = document.getElementById("chk_" + item.id);
    const chip = document.getElementById("chip_" + item.id);
    if (chk) chk.checked = false;
    if (chip) chip.classList.remove("checked");
  });
  ["stockNum","customerName","salesperson","licensePlate","dueDate","dealNotes"].forEach(id => { const el = document.getElementById(id); if(el) el.value = ""; });
  const yr = document.getElementById("vehicleYear"); if(yr) yr.value = new Date().getFullYear();
  const mk = document.getElementById("vehicleMake"); if(mk) mk.value = "";
  const mdl = document.getElementById("vehicleModel"); if(mdl) { mdl.innerHTML = "<option value=''>Select Model</option>"; mdl.style.display = "block"; }
  const desc = document.getElementById("vehicleDesc"); if(desc) desc.value = "";
  const pb = document.getElementById("previewBox"); if(pb) pb.textContent = "Select work items above to preview the vendor text messages.";
  const log = document.getElementById("sendLog"); if(log) log.innerHTML = "";
}

// ---- BILL ID ----
function generateBillId() {
  const now = new Date();
  const mm = String(now.getMonth()+1).padStart(2,"0"), dd = String(now.getDate()).padStart(2,"0"), yy = String(now.getFullYear()).slice(-2);
  const dateStr = mm + dd + yy;
  const seq = parseInt(localStorage.getItem("billSeq_"+dateStr)||"0") + 1;
  localStorage.setItem("billSeq_"+dateStr, seq);
  return "DB-" + dateStr + "-" + String(seq).padStart(3,"0");
}

function openNativeSMS(to, body) {
  const encoded = encodeURIComponent(body);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  window.location.href = "sms:" + to + (isIOS ? "&" : "?") + "body=" + encoded;
}

function buildBill(map, stock, customer, vehicle, sales, date, license, dueDate, notes) {
  const billId = generateBillId();
  const vendorStatuses = {};
  Object.entries(map).forEach(([vendor, items]) => {
    vendorStatuses[vendor] = { items, status:"open", phone: localStorage.getItem("vendor_"+vendor.replace(/\s+/g,"_"))||"", sentAt: new Date().toISOString() };
  });
  return { id:billId, date, stock, customer, vehicle, license, sales, dueDate, notes, vendorStatuses, createdAt: new Date().toISOString() };
}

async function saveBillAndNote(bill) {
  try {
    const res = await apiPost({ action:"saveBill", bill });
    if (res && res.success) {
      _billsCache = [bill, ...getBills()];
      updateOpenCount();
      addLog("✓ Saved to Google Sheets", "success");
      const ts = new Date().toLocaleDateString("en-US",{month:"2-digit",day:"2-digit",year:"2-digit"}) + " " + new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});
      const note = ts + " — Texted vendor to set up appt.";
      await apiPost({ action:"updateNote", billId:bill.id, note });
      if (_billsCache[0]) _billsCache[0].notes = note;
    } else { addLog("✗ Sheet error: " + JSON.stringify(res), "error"); }
  } catch(e) { addLog("✗ Save failed: " + e.message, "error"); }
}

// ---- SEND ALL (SMS) ----
async function sendAll() {
  const map = getCheckedByVendor();
  if (!Object.keys(map).length) { alert("Select at least one work item."); return; }
  const stock = v("stockNum"), customer = v("customerName");
  if (!stock || !customer) { alert("Stock # and Customer Name required."); return; }
  const bill = buildBill(map, stock, customer, v("vehicleDesc"), v("salesperson"), v("billDate"), v("licensePlate"), v("dueDate"), v("dealNotes"));
  document.getElementById("sendLog").innerHTML = "";
  await saveBillAndNote(bill);
  const vendors = Object.entries(map); let idx = 0;
  function next() {
    if (idx >= vendors.length) { toast("All texts opened."); resetForm(); return; }
    const [vendor, items] = vendors[idx];
    const to = bill.vendorStatuses[vendor].phone;
    if (!to) { addLog(vendor + ": No number — skipped.", "info"); idx++; setTimeout(next, 300); return; }
    openNativeSMS(to, buildMsg(vendor, items, bill.stock, bill.customer, bill.vehicle, bill.sales, bill.date));
    addLog("✓ Text opened for " + vendor, "success");
    idx++;
    if (idx < vendors.length) setTimeout(next, 1500); else setTimeout(() => { toast("All texts opened."); resetForm(); }, 500);
  }
  next();
}

// ---- WHATSAPP ALL ----
async function whatsappAll() {
  const map = getCheckedByVendor();
  if (!Object.keys(map).length) { alert("Select at least one work item."); return; }
  const stock = v("stockNum"), customer = v("customerName");
  if (!stock || !customer) { alert("Stock # and Customer Name required."); return; }
  const bill = buildBill(map, stock, customer, v("vehicleDesc"), v("salesperson"), v("billDate"), v("licensePlate"), v("dueDate"), v("dealNotes"));
  document.getElementById("sendLog").innerHTML = "";
  await saveBillAndNote(bill);
  const vendors = Object.entries(map); let idx = 0;
  function next() {
    if (idx >= vendors.length) { toast("WhatsApp opened for all vendors."); resetForm(); return; }
    const [vendor, items] = vendors[idx];
    const to = bill.vendorStatuses[vendor].phone;
    if (!to) { addLog(vendor + ": No number — skipped.", "info"); idx++; setTimeout(next, 300); return; }
    const phone = to.replace(/\D/g,"");
    window.open("https://wa.me/" + phone + "?text=" + encodeURIComponent(buildMsg(vendor, items, bill.stock, bill.customer, bill.vehicle, bill.sales, bill.date) + "\n\n📎 Please also attach the due bill photo."), "_blank");
    addLog("✓ WhatsApp opened for " + vendor, "success");
    idx++;
    if (idx < vendors.length) setTimeout(next, 1500); else setTimeout(() => { toast("WhatsApp opened."); resetForm(); }, 500);
  }
  next();
}

// ---- COPY & SAVE ----
async function copyAndSave() {
  try {
    const map = getCheckedByVendor();
    if (!Object.keys(map).length) { alert("Select at least one work item."); return; }
    const stock = v("stockNum"), customer = v("customerName");
    if (!stock || !customer) { alert("Stock # and Customer Name required."); return; }
    const bill = buildBill(map, stock, customer, v("vehicleDesc"), v("salesperson"), v("billDate"), v("licensePlate"), v("dueDate"), v("dealNotes"));
    document.getElementById("sendLog").innerHTML = "";
    await saveBillAndNote(bill);
    let all = "";
    Object.entries(map).forEach(([vendor, items]) => {
      const to = bill.vendorStatuses[vendor].phone;
      all += "TO: " + vendor + (to ? " (" + to + ")" : "") + "\n" + buildMsg(vendor, items, bill.stock, bill.customer, bill.vehicle, bill.sales, bill.date) + "\n\n" + "─".repeat(40) + "\n\n";
    });
    try { await navigator.clipboard.writeText(all.trim()); }
    catch(e) { const ta = document.createElement("textarea"); ta.value = all.trim(); ta.style.cssText = "position:fixed;opacity:0;"; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); }
    Object.keys(map).forEach(vendor => addLog("✓ Copied for " + vendor, "success"));
    toast("Messages copied — paste into your text app.");
    resetForm();
  } catch(e) { alert("Error: " + e.message); }
}

// ---- DAILY REMINDERS ----
async function sendDailyReminders() {
  const open = getBills().filter(b => getBillStatus(b) !== "done");
  if (!open.length) { toast("No open due bills."); return; }
  let count = 0;
  for (const bill of open) {
    for (const [vendor, vs] of Object.entries(bill.vendorStatuses)) {
      if (vs.status === "done" || !vs.phone) continue;
      openNativeSMS(vs.phone, "REMINDER — Towbin Kia\nStock: " + bill.stock + (bill.vehicle ? " | " + bill.vehicle : "") + "\nCustomer: " + bill.customer + "\nWork: " + (vs.items||[]).join(", ") + "\nStatus: " + (vs.status||"open").toUpperCase() + "\nPlease confirm your schedule.");
      count++;
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  toast(count + " reminder(s) opened.");
}

// ---- TRACKER ----
function getBillStatus(bill) {
  const s = Object.values(bill.vendorStatuses||{}).map(x => x.status);
  if (s.length === 0) return "open";
  if (s.every(x => x==="done")) return "done";
  if (s.some(x => x==="scheduled") && !s.some(x => x==="open")) return "scheduled";
  return "open";
}

function updateOpenCount() {
  const open = getBills().filter(b => Object.values(b.vendorStatuses||{}).some(v => v.status==="open")).length;
  const el = document.getElementById("openCount");
  if (el) { el.style.display = open > 0 ? "inline" : "none"; el.textContent = open; }
}

function renderStats() {
  const bills = getBills();
  const open  = bills.filter(b => Object.values(b.vendorStatuses||{}).some(v => v.status==="open")).length;
  const sched = bills.filter(b => getBillStatus(b)==="scheduled").length;
  const done  = bills.filter(b => getBillStatus(b)==="done").length;
  const el = document.getElementById("statsRow");
  if (!el) return;
  el.innerHTML = `
    <div class="stat-card"><div class="stat-num">${bills.length}</div><div class="stat-label">Total Bills</div></div>
    <div class="stat-card"><div class="stat-num warn">${open}</div><div class="stat-label">Open</div></div>
    <div class="stat-card"><div class="stat-num sched">${sched}</div><div class="stat-label">Scheduled</div></div>
    <div class="stat-card"><div class="stat-num green">${done}</div><div class="stat-label">Completed</div></div>`;
}

function setFilter(f, el) {
  currentFilter = f;
  document.querySelectorAll(".filter-pill").forEach(p => p.classList.remove("active"));
  el.classList.add("active");
  renderTracker();
}

function getDaysRemaining(dueDate) {
  if (!dueDate || !String(dueDate).trim() || String(dueDate)==="0") return null;
  const d = Math.ceil((new Date(String(dueDate).split("T")[0]) - new Date().setHours(0,0,0,0)) / 86400000);
  return isNaN(d) ? null : d;
}

function formatNotes(notes) {
  if (!notes) return '<em style="color:#9aa3b0;font-size:12px;">No notes yet.</em>';
  return notes.split("\n").map(line => `<div style="padding:4px 0;font-size:12px;color:#5a6474;border-bottom:1px solid #eef0f3;">${line}</div>`).join("");
}

function renderTracker() {
  renderStats();
  const search = (document.getElementById("trackerSearch")||{value:""}).value.toLowerCase();
  let bills = getBills().filter(b => {
    if (currentFilter==="done") return getBillStatus(b)==="done";
    if (currentFilter==="scheduled") return getBillStatus(b)==="scheduled";
    if (currentFilter==="open") return Object.values(b.vendorStatuses||{}).some(v => v.status==="open");
    return true;
  });
  if (search) bills = bills.filter(b =>
    (b.id||"").toLowerCase().includes(search) ||
    (b.stock||"").toLowerCase().includes(search) ||
    (b.customer||"").toLowerCase().includes(search) ||
    (b.vehicle||"").toLowerCase().includes(search)
  );
  const body = document.getElementById("trackerBody");
  if (!body) return;
  if (!bills.length) { body.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">No due bills found.</div></div>'; return; }

  const isMobile = window.innerWidth <= 700;
  let html = "";

  if (isMobile) {
    bills.forEach(bill => {
      const st = getBillStatus(bill);
      const badge = st==="done"?'<span class="badge badge-done">Completed</span>':st==="scheduled"?'<span class="badge badge-scheduled">Scheduled</span>':'<span class="badge badge-open">Open</span>';
      const days = getDaysRemaining(bill.dueDate);
      let daysHtml="", border="";
      if (days!==null && st!=="done") {
        if(days<0){daysHtml=`<span class="days-remaining overdue">OVERDUE ${Math.abs(days)}d</span>`;border="border-left:4px solid #c00;";}
        else if(days===0){daysHtml=`<span class="days-remaining overdue">DUE TODAY</span>`;border="border-left:4px solid #c00;";}
        else if(days<=3){daysHtml=`<span class="days-remaining due-soon">${days}d left</span>`;border="border-left:4px solid #a07000;";}
        else{daysHtml=`<span class="days-remaining ok">${days}d left</span>`;}
      }
      html += `<div style="background:#fff;border:1px solid #dde1e7;border-radius:10px;padding:14px 16px;margin-bottom:10px;${border}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
          <div><div style="font-size:10px;font-weight:700;color:#ea0029;">${bill.id||"—"}</div><div style="font-size:22px;font-weight:700;color:#05141f;">Stock #${bill.stock||"—"}</div></div>
          <div style="text-align:right;">${badge}${daysHtml?`<div style="margin-top:4px;">${daysHtml}</div>`:""}</div>
        </div>
        <div style="font-size:14px;font-weight:600;">${bill.customer||"—"}</div>
        <div style="font-size:12px;color:#9aa3b0;margin-top:2px;margin-bottom:12px;">${bill.vehicle||"—"} · ${bill.date?String(bill.date).split("T")[0]:"—"}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">
          <button class="btn-ghost" onclick="toggleDetail('${bill.id}')" style="text-align:center;font-size:12px;">Details</button>
          <button class="btn-ghost" onclick="printBill('${bill.id}')" style="text-align:center;font-size:12px;">Print</button>
          <button class="btn-ghost danger" onclick="deleteBill('${bill.id}')" style="text-align:center;font-size:12px;">Delete</button>
        </div>
        <div id="detail_${bill.id}" style="display:none;margin-top:12px;border-top:1px solid #eef0f3;padding-top:12px;">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#9aa3b0;margin-bottom:8px;">Note History</div>
          <div id="notesDisplay_${bill.id}" style="margin-bottom:10px;max-height:100px;overflow-y:auto;background:#f7f8fa;border-radius:6px;padding:8px 10px;">${formatNotes(bill.notes||"")}</div>
          <div style="display:flex;gap:8px;margin-bottom:14px;">
            <input type="text" id="note_${bill.id}" placeholder="Add a note..." style="flex:1;padding:10px;border:1.5px solid #dde1e7;border-radius:6px;font-size:14px;font-family:inherit;">
            <button class="btn-ghost" onclick="saveNote('${bill.id}')">Add</button>
          </div>
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#9aa3b0;margin-bottom:8px;">Vendor Status</div>
          ${Object.entries(bill.vendorStatuses||{}).map(([vendor,vs])=>`
            <div style="padding:10px 0;border-bottom:1px solid #eef0f3;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <div style="font-size:13px;font-weight:700;">${vendor}</div>
                ${vs.phone?`<div style="display:flex;gap:4px;"><button class="btn-ghost" style="font-size:11px;padding:4px 8px;" onclick="resendText('${bill.id}','${vendor.replace(/'/g,"\\'")}')">SMS</button><button class="btn-ghost" style="font-size:11px;padding:4px 8px;" onclick="resendWhatsApp('${bill.id}','${vendor.replace(/'/g,"\\'")}')">WA</button></div>`:""}
              </div>
              <div style="font-size:12px;color:#5a6474;margin-bottom:8px;">${(vs.items||[]).join(", ")}</div>
              <select class="item-status-select" style="width:100%;font-size:14px;padding:10px;" onchange="updateStatus('${bill.id}','${vendor.replace(/'/g,"\\'")}',this.value)">
                <option value="open" ${vs.status==="open"?"selected":""}>Open</option>
                <option value="scheduled" ${vs.status==="scheduled"?"selected":""}>Scheduled</option>
                <option value="done" ${vs.status==="done"?"selected":""}>Completed</option>
              </select>
            </div>`).join("")}
        </div>
      </div>`;
    });
    body.innerHTML = html;
  } else {
    html = '<table class="tracker-table"><thead><tr><th>Bill ID</th><th>Date</th><th>Stock #</th><th>Customer</th><th>Vehicle</th><th>Due Date</th><th>Status</th><th></th></tr></thead><tbody>';
    bills.forEach(bill => {
      const st = getBillStatus(bill);
      const badge = st==="done"?'<span class="badge badge-done">Completed</span>':st==="scheduled"?'<span class="badge badge-scheduled">Scheduled</span>':'<span class="badge badge-open">Open</span>';
      const days = getDaysRemaining(bill.dueDate);
      let daysHtml="—", rowClass="";
      if(days!==null && st!=="done"){
        if(days<0){daysHtml=`<span class="days-remaining overdue">OVERDUE ${Math.abs(days)}d</span>`;rowClass="overdue-row";}
        else if(days===0){daysHtml=`<span class="days-remaining overdue">DUE TODAY</span>`;rowClass="overdue-row";}
        else if(days<=3){daysHtml=`<span class="days-remaining due-soon">${days}d left</span>`;}
        else{daysHtml=`<span class="days-remaining ok">${days}d left</span>`;}
      }
      html += `<tr class="${rowClass}">
        <td style="font-size:11px;font-weight:700;color:#ea0029;white-space:nowrap;">${bill.id||"—"}</td>
        <td style="font-size:12px;color:#9aa3b0;white-space:nowrap;">${bill.date?String(bill.date).split("T")[0]:"—"}</td>
        <td style="font-weight:700;color:#05141f;">${bill.stock||"—"}</td>
        <td style="font-size:13px;">${bill.customer||"—"}</td>
        <td style="font-size:12px;color:#5a6474;">${bill.vehicle||"—"}</td>
        <td>${daysHtml}</td>
        <td>${badge}</td>
        <td style="white-space:nowrap;">
          <button class="btn-ghost" onclick="toggleDetail('${bill.id}')" style="margin-right:4px;">Details</button>
          <button class="btn-ghost" onclick="printBill('${bill.id}')" style="margin-right:4px;">Print</button>
          <button class="btn-ghost danger" onclick="deleteBill('${bill.id}')">Delete</button>
        </td>
      </tr>
      <tr class="detail-tr" id="detail_${bill.id}" style="display:none;"><td colspan="8">
        <div class="detail-inner">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#9aa3b0;margin-bottom:8px;">Note History</div>
          <div id="notesDisplay_${bill.id}" style="margin-bottom:10px;max-height:120px;overflow-y:auto;background:#f7f8fa;border-radius:6px;padding:8px 10px;">${formatNotes(bill.notes||"")}</div>
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:14px;">
            <input type="text" id="note_${bill.id}" placeholder="Add a new note..." style="flex:1;padding:7px 10px;border:1.5px solid #dde1e7;border-radius:6px;font-size:13px;font-family:inherit;">
            <button class="btn-ghost" onclick="saveNote('${bill.id}')">Add</button>
          </div>
          <div class="detail-title">Vendor Status</div>
          ${Object.entries(bill.vendorStatuses||{}).map(([vendor,vs])=>`
            <div class="item-status-row">
              <div class="item-status-name">${vendor}</div>
              <div class="item-status-items">${(vs.items||[]).join(", ")}</div>
              <select class="item-status-select" onchange="updateStatus('${bill.id}','${vendor.replace(/'/g,"\\'")}',this.value)">
                <option value="open" ${vs.status==="open"?"selected":""}>Open</option>
                <option value="scheduled" ${vs.status==="scheduled"?"selected":""}>Scheduled</option>
                <option value="done" ${vs.status==="done"?"selected":""}>Completed</option>
              </select>
              ${vs.phone?`<div style='display:flex;gap:4px;'><button class="btn-ghost" onclick="resendText('${bill.id}','${vendor.replace(/'/g,"\\'")}')">SMS</button><button class="btn-ghost" onclick="resendWhatsApp('${bill.id}','${vendor.replace(/'/g,"\\'")}')">WA</button></div>`:'<span style="font-size:11px;color:#9aa3b0;">No number</span>'}
            </div>`).join("")}
        </div>
      </td></tr>`;
    });
    html += "</tbody></table>";
    body.innerHTML = html;
  }
}

function toggleDetail(id) {
  const row = document.getElementById("detail_" + id);
  if (!row) return;
  row.style.display = row.style.display === "none" ? (window.innerWidth <= 700 ? "block" : "table-row") : "none";
}

async function updateStatus(billId, vendor, status) {
  await apiPost({ action:"updateStatus", billId, vendor, status });
  const bill = getBills().find(b => b.id === billId);
  if (bill && bill.vendorStatuses[vendor]) bill.vendorStatuses[vendor].status = status;
  renderStats(); updateOpenCount();
  toast("Status updated to " + status + ".");
}

async function deleteBill(billId) {
  if (!confirm("Delete this due bill? Cannot be undone.")) return;
  await apiPost({ action:"deleteBill", billId });
  _billsCache = getBills().filter(b => b.id !== billId);
  renderTracker(); updateOpenCount();
  toast("Due bill deleted.");
}

async function clearAllBills() {
  if (!confirm("Delete ALL due bills permanently?")) return;
  for (const b of getBills()) await apiPost({ action:"deleteBill", billId:b.id });
  _billsCache = [];
  renderTracker(); updateOpenCount();
  toast("All due bills cleared.");
}

async function saveNote(billId) {
  const input = document.getElementById("note_" + billId);
  const newText = input ? input.value.trim() : "";
  if (!newText) { toast("Type a note first."); return; }
  const bill = getBills().find(b => b.id === billId);
  const existing = bill && bill.notes ? bill.notes : "";
  const ts = new Date().toLocaleDateString("en-US",{month:"2-digit",day:"2-digit",year:"2-digit"}) + " " + new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});
  const combined = existing ? existing + "\n" + ts + " — " + newText : ts + " — " + newText;
  try {
    await apiPost({ action:"updateNote", billId, note:combined });
    if (bill) bill.notes = combined;
    if (input) input.value = "";
    const display = document.getElementById("notesDisplay_" + billId);
    if (display) display.innerHTML = formatNotes(combined);
    toast("Note saved.");
  } catch(e) { toast("Failed to save note: " + e.message); }
}

function resendText(billId, vendor) {
  const bill = getBills().find(b => b.id === billId);
  if (!bill) return;
  const vs = bill.vendorStatuses[vendor];
  if (!vs || !vs.phone) { toast("No phone number for this vendor."); return; }
  openNativeSMS(vs.phone, buildMsg(vendor, vs.items, bill.stock, bill.customer, bill.vehicle, bill.sales, bill.date));
}

function resendWhatsApp(billId, vendor) {
  const bill = getBills().find(b => b.id === billId);
  if (!bill) return;
  const vs = bill.vendorStatuses[vendor];
  if (!vs || !vs.phone) { toast("No phone number for this vendor."); return; }
  window.open("https://wa.me/" + vs.phone.replace(/\D/g,"") + "?text=" + encodeURIComponent(buildMsg(vendor, vs.items, bill.stock, bill.customer, bill.vehicle, bill.sales, bill.date)), "_blank");
}

// ---- SETTINGS ----
function buildVendorSettingsRows() {
  const container = document.getElementById("vendorSettingsRows");
  if (!container) return;
  VENDOR_KEYS.forEach(vnd => {
    const key = "vendor_" + vnd.replace(/\s+/g,"_");
    const saved = localStorage.getItem(key) || "";
    const row = document.createElement("div");
    row.className = "vendor-row";
    row.innerHTML = `<div><div class="vendor-name">${vnd}</div></div><input type="tel" id="vs_${key}" placeholder="+17025550100" value="${saved}" onblur="saveVendorNum('${key}')">`;
    container.appendChild(row);
  });
}
function saveVendorNum(key) {
  const el = document.getElementById("vs_" + key);
  if (el && el.value.trim()) { localStorage.setItem(key, el.value.trim()); syncVendorsToSheet(); }
}
async function syncVendorsToSheet() {
  const vendors = {};
  VENDOR_KEYS.forEach(vnd => { const v = localStorage.getItem("vendor_"+vnd.replace(/\s+/g,"_")); if(v) vendors[vnd]=v; });
  await apiPost({ action:"saveVendors", vendors });
}
function saveApiKey() {
  const url = document.getElementById("googleScriptUrl");
  if (url && url.value.trim()) localStorage.setItem("google_script_url", url.value.trim());
  const s = document.getElementById("apiKeyStatus");
  if (s) { s.textContent = "✓ URL saved"; setTimeout(() => s.textContent = "", 3000); }
}
function saveConfig() {}
function loadConfig() {
  const saved = localStorage.getItem("google_script_url");
  const el = document.getElementById("googleScriptUrl");
  if (saved && el) el.value = saved;
}
async function testConnection() {
  const el = document.getElementById("testResult");
  if (!el) return;
  el.style.color = "#9aa3b0"; el.textContent = "Testing...";
  try {
    const res = await apiGet("getBills");
    if (res.bills !== undefined) { el.style.color = "#0d6832"; el.textContent = "✓ Connected! Bills: " + res.bills.length; }
    else { el.style.color = "#ea0029"; el.textContent = "✗ Unexpected: " + JSON.stringify(res).substring(0,80); }
  } catch(e) { el.style.color = "#ea0029"; el.textContent = "✗ Failed: " + e.message; }
}

// ---- AI SCAN ----
async function handleFileUpload(input) { if(input.files[0]) processScanFile(input.files[0]); }
async function processScanFile(file) {
  const ss = document.getElementById("scanStatus"), sc = document.getElementById("scanSuccess"), se = document.getElementById("scanError"), st = document.getElementById("scanStatusText");
  if(ss) ss.style.display="block"; if(sc) sc.style.display="none"; if(se) se.style.display="none";
  if(st) st.textContent = "Reading due bill...";
  try {
    const base64 = await fileToBase64(file);
    const mediaType = file.type === "application/pdf" ? "application/pdf" : (file.type || "image/jpeg");
    if(st) st.textContent = "AI extracting fields...";
    window._lastDueBillFile = file;
    const res = await fetch(SCRIPT_URL, { method:"POST", headers:{"Content-Type":"text/plain"}, body:JSON.stringify({ action:"scanBill", base64, mediaType }) });
    if (!res.ok) throw new Error("Request failed: " + res.status);
    const result = await res.json();
    if (!result.success) throw new Error(result.error || "Scan failed");
    const p = result.data;
    if(p.date) document.getElementById("billDate").value = p.date;
    if(p.stock) document.getElementById("stockNum").value = p.stock;
    if(p.customer) document.getElementById("customerName").value = p.customer;
    if(p.license) document.getElementById("licensePlate").value = p.license;
    if(p.salesperson) document.getElementById("salesperson").value = p.salesperson;
    if(p.vehicle) {
      const ym = p.vehicle.match(/20\d{2}/);
      if(ym) { const s = document.getElementById("vehicleYear"); if(s) for(let o of s.options) if(o.value===ym[0]) { s.value=ym[0]; break; } }
      for(const make of ALL_MAKES) {
        if(p.vehicle.toLowerCase().includes(make.toLowerCase())) {
          const ms = document.getElementById("vehicleMake"); if(ms) ms.value = make;
          updateModelDropdown();
          if(MAKES_MODELS[make]) for(const model of MAKES_MODELS[make]) if(p.vehicle.toLowerCase().includes(model.toLowerCase())) { const ms2=document.getElementById("vehicleModel"); if(ms2) ms2.value=model; break; }
          break;
        }
      }
      buildVehicleDesc();
    }
    const ITEM_MAP = {"GPS":"gps","Red Alert":"redalert","Polysteel":"polysteel","XPEL Tint":"tint","XPEL PPF":"ppf","Body Work":"bodyshop","Detail":"detail","Ceramic Coat":"ceramic","Powder Wheels":"powder"};
    if(Array.isArray(p.items)) p.items.forEach(item => { const id=ITEM_MAP[item]; if(id){const chk=document.getElementById("chk_"+id),chip=document.getElementById("chip_"+id);if(chk&&chip){chk.checked=true;chip.classList.add("checked");}} });
    updatePreview();
    if(ss) ss.style.display="none"; if(sc) sc.style.display="block";
  } catch(e) {
    if(ss) ss.style.display="none";
    if(se) { se.style.display="block"; se.textContent="Scan failed: "+e.message; }
  }
}
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(",")[1]);
    r.onerror = () => reject(new Error("Failed to read file"));
    r.readAsDataURL(file);
  });
}

// ---- PRINT ----
function printBill(billId) {
  const bill = getBills().find(b => b.id === billId);
  if (!bill) return;
  const vendors = Object.entries(bill.vendorStatuses||{});
  const kiaImg = document.querySelector(".kia-logo img");
  const kiaLogo = kiaImg ? `<img src="${kiaImg.src}" alt="KIA" style="height:36px;width:auto;">` : `<span style="font-size:28px;font-weight:900;color:#ea0029;">KIA</span>`;
  const win = window.open("","_blank");
  win.document.write(`<html><head><title>Due Bill ${bill.id}</title><style>
    body{font-family:Arial,sans-serif;padding:30px;max-width:720px;margin:0 auto;}
    .hdr{display:flex;align-items:center;gap:20px;border-bottom:3px solid #ea0029;padding-bottom:16px;margin-bottom:20px;}
    .div{width:1px;height:40px;background:#ddd;}
    .ttl{font-size:20px;font-weight:900;text-transform:uppercase;color:#05141f;}
    .sub{font-size:12px;color:#888;margin-top:2px;}
    table{width:100%;border-collapse:collapse;margin-bottom:18px;}
    th{background:#05141f;color:#fff;padding:9px 12px;text-align:left;font-size:11px;text-transform:uppercase;}
    td{padding:9px 12px;border-bottom:1px solid #eee;font-size:13px;}
    .due{font-size:13px;margin-bottom:16px;padding:8px 12px;background:#f7f8fa;border-radius:5px;border-left:3px solid #ea0029;}
    .notes{font-size:12px;margin-bottom:20px;padding:10px 12px;background:#f7f8fa;border-radius:5px;}
    .disc{font-size:10px;color:#888;margin-bottom:30px;line-height:1.6;}
    .sigs{display:flex;justify-content:space-between;margin-top:40px;}
    .sig{border-top:1px solid #333;padding-top:6px;font-size:11px;color:#666;width:220px;}
    .ftr{text-align:center;font-size:11px;font-weight:700;letter-spacing:.05em;color:#333;border-top:2px solid #05141f;padding-top:12px;margin-top:20px;}
    .pbtn{margin-top:20px;padding:12px 24px;background:#ea0029;color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:700;cursor:pointer;}
    @media print{.pbtn{display:none;}}
  </style></head><body>
  <div class="hdr">${kiaLogo}<div class="div"></div><div><div class="ttl">Towbin Kia — Due Bill</div><div class="sub">Henderson, NV &nbsp;|&nbsp; (702) 567-8000 &nbsp;|&nbsp; 260 N Gibson Rd</div></div></div>
  <table><tr><th>Bill ID</th><th>Date</th><th>Stock #</th><th>Salesperson</th></tr>
    <tr><td><strong>${bill.id}</strong></td><td>${String(bill.date||"").split("T")[0]}</td><td><strong>${bill.stock||"—"}</strong></td><td>${bill.sales||"—"}</td></tr>
  </table>
  <table><tr><th>Customer</th><th>Vehicle</th><th>License</th></tr>
    <tr><td>${bill.customer||"—"}</td><td>${bill.vehicle||"—"}</td><td>${bill.license||"—"}</td></tr>
  </table>
  ${bill.dueDate&&String(bill.dueDate).trim()?`<div class="due"><strong>Customer Return Date:</strong> ${String(bill.dueDate).split("T")[0]}</div>`:""}
  <table><tr><th>#</th><th>Vendor</th><th>Work Promised</th><th>Status</th></tr>
    ${vendors.map(([vendor,vs],i)=>`<tr><td>${i+1}</td><td>${vendor}</td><td>${(vs.items||[]).join(", ")}</td><td style="text-transform:capitalize;">${vs.status||"Open"}</td></tr>`).join("")}
  </table>
  ${bill.notes?`<div class="notes"><strong>Notes:</strong> ${bill.notes}</div>`:""}
  <p class="disc">NOTE: The above promised work is the only work to be performed free of charge. All work must be done in our shop. You must make an advance appointment with the service department before the above work can be performed.</p>
  <div class="sigs"><div><div class="sig">Signed Sales Mgr. X</div></div><div><div class="sig">Signed Customer X</div></div></div>
  <div class="ftr">DUE TO INSURANCE REGULATIONS — NO LOAN CARS AVAILABLE</div>
  <button class="pbtn" onclick="window.print()">Print / Save as PDF</button>
  </body></html>`);
  win.document.close();
}

// ---- UTILITIES ----
function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg; el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3000);
}
function updateClock() {
  const el = document.getElementById("clock");
  if (el) el.textContent = new Date().toLocaleString("en-US",{weekday:"short",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
}

// ---- DRAG & DROP ----
document.addEventListener("DOMContentLoaded", () => {
  const dz = document.getElementById("dropZone");
  if (dz) {
    dz.addEventListener("dragover", e => { e.preventDefault(); dz.classList.add("dragover"); });
    dz.addEventListener("dragleave", () => dz.classList.remove("dragover"));
    dz.addEventListener("drop", e => { e.preventDefault(); dz.classList.remove("dragover"); if(e.dataTransfer.files[0]) processScanFile(e.dataTransfer.files[0]); });
  }
  // Preview listeners
  ["stockNum","customerName","salesperson","billDate","licensePlate","dueDate","dealNotes"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", updatePreview);
  });
});

// ---- INIT ----
document.addEventListener("DOMContentLoaded", () => {
  const bd = document.getElementById("billDate");
  if (bd) bd.value = new Date().toISOString().split("T")[0];
  initYearDropdown();
  initMakeDropdown();
  buildItemsGrid();
  buildVendorSettingsRows();
  loadConfig();
  updateClock();
  setInterval(updateClock, 30000);
  setInterval(() => {
    const gate = document.getElementById("passwordGate");
    if (!isLoggedIn() && gate && gate.style.display === "none") { signOut(); toast("Session expired."); }
  }, 60000);
  if (isLoggedIn()) {
    fetchBills().then(() => { fetchVendors(); updateOpenCount(); renderTracker(); }).catch(e => console.error(e));
  }
});
