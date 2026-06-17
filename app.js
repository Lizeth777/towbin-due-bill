// ============================================================
// TOWBIN KIA — DUE BILL TRACKER
// Password Gate & Authentication
// ============================================================

const TK_KEY = "tk_auth_ts";
const TK_EXPIRY = 12 * 60 * 60 * 1000; // 12 hours in ms

function isLoggedIn() {
  const ts = localStorage.getItem(TK_KEY);
  if (!ts) return false;
  return (Date.now() - parseInt(ts)) < TK_EXPIRY;
}

function setLoggedIn() {
  localStorage.setItem(TK_KEY, Date.now().toString());
}

function signOut() {
  localStorage.removeItem(TK_KEY);
  document.getElementById("passwordGate").style.display = "flex";
  document.getElementById("pwdInput").value = "";
  document.getElementById("pwdError").style.display = "none";
  setTimeout(() => { document.getElementById("pwdInput").focus(); }, 100);
}

async function checkPassword() {
  const input = document.getElementById("pwdInput").value;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  const hashed = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
  const PWD_HASH = "6d46d54ffa54a5eb9554b1a62c1cc2f2897c79f311296e5c56147bdee8d7e908";
  if (hashed === PWD_HASH) {
    setLoggedIn();
    document.getElementById("passwordGate").style.display = "none";
    // Load data now that user is signed in
    try {
      await Promise.all([fetchBills(), fetchVendors()]);
      updateOpenCount();
    } catch(e) {
      console.error("Sheet load failed:", e);
    }
  } else {
    document.getElementById("pwdError").style.display = "block";
    document.getElementById("pwdInput").value = "";
    document.getElementById("pwdInput").focus();
  }
}

function togglePwd() {
  const i = document.getElementById("pwdInput");
  const e = document.getElementById("eyeIcon");
  if (i.type === "password") {
    i.type = "text";
    e.innerHTML = "<path d='M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24'/><line x1='1' y1='1' x2='23' y2='23'/>";
  } else {
    i.type = "password";
    e.innerHTML = "<path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'/><circle cx='12' cy='12' r='3'/>";
  }
}

// Check on load
if (isLoggedIn()) {
  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("passwordGate").style.display = "none";
  });
}


// ============================================================
// App Logic
// ============================================================

const ITEMS = [
  { id:"gps",       label:"GPS",          vendor:"Kia Service" },
  { id:"redalert",  label:"Red Alert",    vendor:"Kia Service" },
  { id:"polysteel", label:"Polysteel",    vendor:"Kia Service" },
  { id:"tint",      label:"XPEL Tint",    vendor:"Fam Solutions" },
  { id:"ppf",       label:"XPEL PPF",     vendor:"Fam Solutions" },
  { id:"bodyshop",  label:"Body Work",   vendor:"Body Shop" },
  { id:"detail",    label:"Detail",      vendor:"Detail" },
  { id:"ceramic",   label:"Ceramic Coat", vendor:"Fam Solutions" },
  { id:"powder",    label:"Powder Wheels",vendor:"Powder Coating" },
  { id:"other",     label:"Other",        vendor:"Other Vendor" },
];
const VENDOR_KEYS = [...new Set(ITEMS.map(i => i.vendor))];
let currentFilter = "all";

const SCRIPT_URL = localStorage.getItem("google_script_url") || "https://script.google.com/macros/s/AKfycbyTq072YxvYWJq-omI0t7z43MaBfGZYF8VOkErnVTWFqI-CN_GgGMLmzdNc3BTYO1EP/exec";

// ---- API HELPERS ----
async function apiGet(action) {
  const r = await fetch(SCRIPT_URL + "?action=" + action);
  return r.json();
}
async function apiPost(payload) {
  const r = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(payload)
  });
  return r.json();
}

// ---- LOCAL CACHE (for speed) ----
let _billsCache = null;
let _vendorsCache = null;

async function fetchBills() {
  const res = await apiGet("getBills");
  _billsCache = res.bills || [];
  return _billsCache;
}
function getBills() { return _billsCache || []; }

async function fetchVendors() {
  const res = await apiGet("getVendors");
  _vendorsCache = res.vendors || {};
  // Populate vendor inputs
  Object.entries(_vendorsCache).forEach(([vendor, phone]) => {
    const key = "vendor_" + vendor.replace(/\s+/g,"_");
    const el = document.getElementById("vs_" + key);
    if (el) el.value = phone;
    localStorage.setItem(key, phone);
  });
  return _vendorsCache;
}

function showTab(name) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
  document.getElementById("page-" + name).classList.add("active");
  document.querySelectorAll(".nav-tab").forEach(t => {
    if ((t.getAttribute("onclick")||"").includes("'"+name+"'")) t.classList.add("active");
  });
  if (name === "tracker") { fetchBills().then(() => { renderTracker(); updateOpenCount(); }); }
}

function buildItemsGrid() {
  const grid = document.getElementById("itemsGrid");
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
  let msg = "DUE BILL ALERT — Towbin Kia\n";
  msg += "Stock: " + stock;
  if (vehicle) msg += " | " + vehicle;
  msg += "\nCustomer: " + customer;
  msg += "\nWork Needed: " + items.join(", ");
  msg += "\nSalesperson: " + sales;
  if (date) msg += "\nDate: " + date;
  msg += "\nPlease schedule ASAP. Call the store to coordinate.";
  return msg;
}

function updatePreview() {
  const map = getCheckedByVendor();
  const box = document.getElementById("previewBox");
  if (!Object.keys(map).length) { box.textContent = "Select work items above to preview the vendor text messages."; return; }
  const stock = v("stockNum") || "N/A", customer = v("customerName") || "N/A";
  const vehicle = v("vehicleDesc"), sales = v("salesperson"), date = v("billDate");
  let txt = "";
  Object.entries(map).forEach(([vendor, items]) => {
    const key = "vendor_" + vendor.replace(/\s+/g,"_");
    const num = localStorage.getItem(key) || "(no number saved — go to Setup)";
    txt += "TO: " + vendor + "  (" + num + ")\n" + buildMsg(vendor, items, stock, customer, vehicle, sales, date) + "\n\n" + "─".repeat(42) + "\n\n";
  });
  box.textContent = txt.trim();
}

function v(id) { const el = document.getElementById(id); return el ? el.value.trim() : ""; }

["stockNum","customerName","salesperson","billDate","licensePlate","dueDate","dealNotes"].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("input", updatePreview);
});

function openNativeSMS(to, body) {
  const encoded = encodeURIComponent(body);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const sep = isIOS ? "&" : "?";
  window.location.href = "sms:" + to + sep + "body=" + encoded;
}

function addLog(msg, type) {
  const log = document.getElementById("sendLog");
  const div = document.createElement("div");
  div.className = "log-entry log-" + type;
  div.textContent = msg;
  log.prepend(div);
}

async function whatsappAll() {
  const map = getCheckedByVendor();
  if (!Object.keys(map).length) { alert("Please select at least one promised work item."); return; }
  const stock = v("stockNum"), customer = v("customerName");
  if (!stock || !customer) { alert("Stock # and Customer Name are required before sending."); return; }

  const vehicle = v("vehicleDesc"), sales = v("salesperson"), date = v("billDate"), license = v("licensePlate");
  const dueDate = v("dueDate"), notes = v("dealNotes");
  const billId = generateBillId();
  const vendorStatuses = {};

  // Save to sheet
  for (const [vendor, items] of Object.entries(map)) {
    const key = "vendor_" + vendor.replace(/\s+/g,"_");
    const to = localStorage.getItem(key) || "";
    vendorStatuses[vendor] = { items, status:"open", phone:to, sentAt:new Date().toISOString() };
  }
  const bill = { id:billId, date, stock, customer, vehicle, license, sales, dueDate, notes, vendorStatuses, createdAt:new Date().toISOString() };
  try {
    await apiPost({ action:"saveBill", bill });
    _billsCache = [bill, ...getBills()];
    updateOpenCount();
    addLog("✓ Saved to Google Sheets", "success");
  } catch(e) {
    addLog("✗ Sheet save failed: " + e.message, "error");
  }

  // Auto-note
  const autoTs = new Date().toLocaleDateString("en-US",{month:"2-digit",day:"2-digit",year:"2-digit"}) + " " + new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});
  const autoNoteText = autoTs + " — Texted vendor to set up appt.";
  try { await apiPost({ action:"updateNote", billId, note: autoNoteText }); if(_billsCache[0]) _billsCache[0].notes = autoNoteText; } catch(e) {}

  // Open WhatsApp for each vendor
  const vendors = Object.entries(map);
  let idx = 0;
  document.getElementById("sendLog").innerHTML = "";

  function openNextWhatsApp() {
    if (idx >= vendors.length) {
      toast("WhatsApp opened for all vendors. Due bill saved.");
      ITEMS.forEach(item => { const chk = document.getElementById("chk_" + item.id); if(chk){chk.checked=false; document.getElementById("chip_"+item.id).classList.remove("checked");} });
      ["stockNum","customerName","vehicleDesc","salesperson","licensePlate","dueDate","dealNotes"].forEach(id => { const el=document.getElementById(id); if(el) el.value=""; });
      document.getElementById("previewBox").textContent = "Select work items above to preview the vendor text messages.";
      return;
    }
    const [vendor, items] = vendors[idx];
    const key = "vendor_" + vendor.replace(/\s+/g,"_");
    const to = localStorage.getItem(key) || "";
    if (!to) {
      addLog(vendor + ": No number saved — skipped.", "info");
      idx++; setTimeout(openNextWhatsApp, 300); return;
    }
    const body = buildMsg(vendor, items, stock, customer, vehicle, sales, date);
    const phone = to.replace(/\D/g,"");
    const waNote = window._lastDueBillFile ? "\n\n📎 Please also attach the due bill photo from this conversation." : "";
    window.open("https://wa.me/" + phone + "?text=" + encodeURIComponent(body + waNote), "_blank");
    addLog("✓ WhatsApp opened for " + vendor + (window._lastDueBillFile ? " (attach photo manually)" : ""), "success");
    idx++;
    if (idx < vendors.length) setTimeout(openNextWhatsApp, 1500);
    else setTimeout(() => toast("WhatsApp opened for all vendors."), 500);
  }
  openNextWhatsApp();
}

async function sendAll() {
  const map = getCheckedByVendor();
  if (!Object.keys(map).length) { alert("Please select at least one promised work item."); return; }
  const stock = v("stockNum"), customer = v("customerName");
  if (!stock || !customer) { alert("Stock # and Customer Name are required before sending."); return; }

  const vehicle = v("vehicleDesc"), sales = v("salesperson"), date = v("billDate"), license = v("licensePlate");
  const dueDate = v("dueDate"), notes = v("dealNotes");
  const billId = generateBillId();
  const vendorStatuses = {};

  // Save to tracker first
  for (const [vendor, items] of Object.entries(map)) {
    const key = "vendor_" + vendor.replace(/\s+/g,"_");
    const to = localStorage.getItem(key) || "";
    vendorStatuses[vendor] = { items, status:"open", phone:to, sentAt:new Date().toISOString() };
  }
  const bill = { id:billId, date, stock, customer, vehicle, license, sales, dueDate, notes, vendorStatuses, createdAt:new Date().toISOString() };
  try {
    const saveRes = await apiPost({ action:"saveBill", bill });
    if (!saveRes.success) throw new Error(saveRes.error || "Save failed");
    _billsCache = [bill, ...getBills()];
    updateOpenCount();
    addLog("✓ Saved to Google Sheets", "success");
  } catch(e) {
    addLog("✗ Sheet save failed: " + e.message, "error");
  }

  // Auto-note
  const autoTs = new Date().toLocaleDateString("en-US",{month:"2-digit",day:"2-digit",year:"2-digit"}) + " " + new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});
  const autoNoteText = autoTs + " — Texted vendor to set up appt.";
  try { await apiPost({ action:"updateNote", billId, note: autoNoteText }); if(_billsCache[0]) _billsCache[0].notes = autoNoteText; } catch(e) {}

  // Open native texts one by one
  const vendors = Object.entries(map);
  let idx = 0;

  function openNext() {
    if (idx >= vendors.length) {
      toast("All texts opened. Due bill saved to tracker.");
      ITEMS.forEach(item => { const chk = document.getElementById("chk_" + item.id); if(chk){chk.checked=false; document.getElementById("chip_"+item.id).classList.remove("checked");} });
      ["stockNum","customerName","vehicleDesc","salesperson","licensePlate","dueDate","dealNotes"].forEach(id => { const el=document.getElementById(id); if(el) el.value=""; });
      document.getElementById("vehicleYear").value = new Date().getFullYear();
      document.getElementById("vehicleMake").value = "";
      document.getElementById("vehicleModel").innerHTML = "<option value=''>Select Model</option>";
      document.getElementById("previewBox").textContent = "Select work items above to preview the vendor text messages.";
      return;
    }

    const [vendor, items] = vendors[idx];
    const key = "vendor_" + vendor.replace(/\s+/g,"_");
    const to = localStorage.getItem(key) || "";

    if (!to) {
      addLog(vendor + ": No number saved — skipped.", "info");
      idx++;
      setTimeout(openNext, 300);
      return;
    }

    const body = buildMsg(vendor, items, stock, customer, vehicle, sales, date);
    openNativeSMS(to, body);
    addLog("✓ Text opened for " + vendor, "success");
    idx++;

    if (idx < vendors.length) {
      // Small delay between opening texts
      setTimeout(openNext, 1500);
    } else {
      setTimeout(() => {
        toast("All texts opened. Due bill saved to tracker.");
        ITEMS.forEach(item => { const chk = document.getElementById("chk_" + item.id); if(chk){chk.checked=false; document.getElementById("chip_"+item.id).classList.remove("checked");} });
        ["stockNum","customerName","vehicleDesc","salesperson","licensePlate"].forEach(id => { const el=document.getElementById(id); if(el) el.value=""; });
        document.getElementById("previewBox").textContent = "Select work items above to preview the vendor text messages.";
      }, 500);
    }
  }

  document.getElementById("sendLog").innerHTML = "";
  openNext();
}

async function sendDailyReminders() {
  const open = getBills().filter(b => getBillStatus(b) !== "done");
  if (!open.length) { toast("No open due bills to remind vendors about."); return; }

  let count = 0;
  for (const bill of open) {
    for (const [vendor, vs] of Object.entries(bill.vendorStatuses)) {
      if (vs.status === "done" || !vs.phone) continue;
      const msg = "REMINDER — Towbin Kia Due Bill\nStock: " + bill.stock + (bill.vehicle ? " | " + bill.vehicle : "") + "\nCustomer: " + bill.customer + "\nWork: " + vs.items.join(", ") + "\nStatus: " + vs.status.toUpperCase() + "\nPlease confirm your schedule. Call (702) 567-8000.";
      openNativeSMS(vs.phone, msg);
      count++;
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  toast(count + " reminder(s) opened.");
}

function buildVendorSettingsRows() {
  const container = document.getElementById("vendorSettingsRows");
  VENDOR_KEYS.forEach(v => {
    const key = "vendor_" + v.replace(/\s+/g,"_");
    const saved = localStorage.getItem(key) || "";
    const row = document.createElement("div");
    row.className = "vendor-row";
    row.innerHTML = `<div><div class="vendor-name">${v}</div></div>
      <input type="tel" id="vs_${key}" placeholder="+17025550100" value="${saved}" onblur="saveVendorNum('${key}')">`;
    container.appendChild(row);
  });
}

function saveVendorNum(key) {
  const el = document.getElementById("vs_" + key);
  if (el && el.value.trim()) {
    localStorage.setItem(key, el.value.trim());
    syncVendorsToSheet();
  }
}

async function syncVendorsToSheet() {
  const vendors = {};
  VENDOR_KEYS.forEach(v => {
    const key = "vendor_" + v.replace(/\s+/g,"_");
    const val = localStorage.getItem(key);
    if (val) vendors[v] = val;
  });
  await apiPost({ action:"saveVendors", vendors });
}

function saveApiKey() {
  const url = document.getElementById("googleScriptUrl").value.trim();
  if (url) localStorage.setItem("google_script_url", url);
  const s = document.getElementById("apiKeyStatus");
  s.textContent = "✓ URL saved";
  setTimeout(() => s.textContent = "", 3000);
}

function saveConfig() {}

function loadConfig() {
  const savedScriptUrl = localStorage.getItem("google_script_url");
  if (savedScriptUrl) document.getElementById("googleScriptUrl").value = savedScriptUrl;

}

async function clearAllBills() {
  if (!confirm("Delete ALL due bills permanently?")) return;
  const bills = getBills();
  for (const b of bills) await apiPost({ action:"deleteBill", billId:b.id });
  _billsCache = [];
  renderTracker(); updateOpenCount();
  toast("All due bills cleared.");
}

async function updateStatus(billId, vendor, status) {
  await apiPost({ action:"updateStatus", billId, vendor, status });
  const bill = getBills().find(b => b.id === billId);
  if (bill && bill.vendorStatuses[vendor]) {
    bill.vendorStatuses[vendor].status = status;
  }
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

async function testConnection() {
  const el = document.getElementById("testResult");
  el.style.color = "var(--gray-400)";
  el.textContent = "Testing...";
  try {
    const res = await apiGet("getBills");
    if (res.success !== undefined || res.bills !== undefined || res.status) {
      el.style.color = "var(--success)";
      el.textContent = "✓ Connected! Google Sheets is working. Bills found: " + (res.bills ? res.bills.length : 0);
    } else {
      el.style.color = "var(--red)";
      el.textContent = "✗ Connected but unexpected response: " + JSON.stringify(res).substring(0, 100);
    }
  } catch(e) {
    el.style.color = "var(--red)";
    el.textContent = "✗ Failed: " + e.message;
  }
}

async function copyAndSave() {
  try {
  const map = getCheckedByVendor();
  if (!Object.keys(map).length) { alert("Please select at least one promised work item."); return; }
  const stock = v("stockNum"), customer = v("customerName");
  if (!stock || !customer) { alert("Stock # and Customer Name are required before sending."); return; }

  const vehicle = v("vehicleDesc"), sales = v("salesperson"), date = v("billDate"), license = v("licensePlate");
  const dueDate = v("dueDate"), notes = v("dealNotes");
  const billId = generateBillId();
  const vendorStatuses = {};

  let allMessages = "";
  for (const [vendor, items] of Object.entries(map)) {
    const key = "vendor_" + vendor.replace(/\s+/g,"_");
    const to = localStorage.getItem(key) || "";
    vendorStatuses[vendor] = { items, status:"open", phone:to, sentAt:new Date().toISOString() };
    const body = buildMsg(vendor, items, stock, customer, vehicle, sales, date);
    allMessages += "TO: " + vendor + (to ? " (" + to + ")" : "") + "\n" + body + "\n\n" + "─".repeat(40) + "\n\n";
  }

  // Save to sheet
  const bill = { id:billId, date, stock, customer, vehicle, license, sales, dueDate, notes, vendorStatuses, createdAt:new Date().toISOString() };
  try {
    const saveRes = await apiPost({ action:"saveBill", bill });
    if (saveRes && saveRes.success) {
      _billsCache = [bill, ...getBills()];
      updateOpenCount();
      addLog("✓ Saved to Google Sheets", "success");
    } else {
      addLog("✗ Sheet error: " + JSON.stringify(saveRes), "error");
    }
  } catch(saveErr) {
    addLog("✗ Sheet save failed: " + saveErr.message, "error");
  }

  // Auto-note
  const autoTs = new Date().toLocaleDateString("en-US",{month:"2-digit",day:"2-digit",year:"2-digit"}) + " " + new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});
  const autoNoteText = autoTs + " — Texted vendor to set up appt.";
  try { await apiPost({ action:"updateNote", billId, note: autoNoteText }); if(_billsCache[0]) _billsCache[0].notes = autoNoteText; } catch(e) {}

  // Copy to clipboard
  try {
    await navigator.clipboard.writeText(allMessages.trim());
    toast("All messages copied to clipboard — paste into your text app.");
  } catch(e) {
    // Fallback for browsers that block clipboard
    const ta = document.createElement("textarea");
    ta.value = allMessages.trim();
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    toast("Messages copied — paste into your text app.");
  }

  document.getElementById("sendLog").innerHTML = "";
  Object.keys(map).forEach(vendor => {
    addLog("✓ Message copied for " + vendor, "success");
  });

  // Reset form
  ITEMS.forEach(item => { const chk = document.getElementById("chk_" + item.id); if(chk){chk.checked=false; document.getElementById("chip_"+item.id).classList.remove("checked");} });
  ["stockNum","customerName","vehicleDesc","salesperson","licensePlate","dueDate","dealNotes"].forEach(id => { const el=document.getElementById(id); if(el) el.value=""; });
  document.getElementById("previewBox").textContent = "Select work items above to preview the vendor text messages.";
  } catch(err) { alert("Error: " + err.message); }
}

function generateBillId() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const dateStr = mm + dd + yy;
  // Get sequence number for today
  const seqKey = "billSeq_" + dateStr;
  const seq = parseInt(localStorage.getItem(seqKey) || "0") + 1;
  localStorage.setItem(seqKey, seq);
  return "DB-" + dateStr + "-" + String(seq).padStart(3, '0');
}

function renderStats() {
  const bills = getBills();
  const open = bills.filter(b => Object.values(b.vendorStatuses||{}).some(v => v.status==="open")).length;
  const sched = bills.filter(b => getBillStatus(b)==="scheduled" && !Object.values(b.vendorStatuses||{}).some(v => v.status==="open")).length;
  const done = bills.filter(b => getBillStatus(b)==="done").length;
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
  if (!dueDate) return null;
  const due = new Date(String(dueDate).split("T")[0]);
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.ceil((due - today) / (1000 * 60 * 60 * 24));
}

function renderTracker() {
  renderStats();
  const search = (document.getElementById("trackerSearch")?.value || "").toLowerCase();
  let bills = getBills().filter(b => {
    if (currentFilter === "done") return getBillStatus(b) === "done";
    if (currentFilter === "scheduled") return getBillStatus(b) === "scheduled" && !Object.values(b.vendorStatuses||{}).some(v => v.status === "open");
    if (currentFilter === "open") return Object.values(b.vendorStatuses||{}).some(v => v.status === "open");
    return true;
  });
  if (search) {
    bills = bills.filter(b =>
      (b.id||"").toLowerCase().includes(search) ||
      (b.stock||"").toLowerCase().includes(search) ||
      (b.customer||"").toLowerCase().includes(search) ||
      (b.vehicle||"").toLowerCase().includes(search) ||
      (b.sales||"").toLowerCase().includes(search)
    );
  }
  const body = document.getElementById("trackerBody");
  if (!bills.length) {
    body.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">No due bills found.</div></div>';
    return;
  }
  const isMobile = window.innerWidth <= 700;
  if (isMobile) {
    let html = "";
    bills.forEach(bill => {
      const st = getBillStatus(bill);
      const badge = st==="done" ? '<span class="badge badge-done">Completed</span>' : st==="scheduled" ? '<span class="badge badge-scheduled">Scheduled</span>' : '<span class="badge badge-open">Open</span>';
      const days = (bill.dueDate && String(bill.dueDate).trim() && String(bill.dueDate) !== "0") ? getDaysRemaining(bill.dueDate) : null;
      let daysHtml = "";
      let cardBorder = "";
      if (days !== null && !isNaN(days) && st !== "done") {
        if (days < 0) { daysHtml = `<span class="days-remaining overdue">OVERDUE ${Math.abs(days)}d</span>`; cardBorder = "border-left:4px solid #c00;"; }
        else if (days === 0) { daysHtml = `<span class="days-remaining overdue">DUE TODAY</span>`; cardBorder = "border-left:4px solid #c00;"; }
        else if (days <= 3) { daysHtml = `<span class="days-remaining due-soon">${days}d left</span>`; cardBorder = "border-left:4px solid #a07000;"; }
        else { daysHtml = `<span class="days-remaining ok">${days}d left</span>`; }
      }
      html += `<div style="background:var(--white);border:1px solid var(--gray-200);border-radius:10px;padding:14px 16px;margin-bottom:10px;${cardBorder}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
          <div>
            <div style="font-size:10px;font-weight:700;color:var(--red);">${bill.id||"—"}</div>
            <div style="font-size:22px;font-weight:700;color:var(--navy);margin-top:1px;">Stock #${bill.stock||"—"}</div>
          </div>
          <div style="text-align:right;">${badge}${daysHtml ? `<div style="margin-top:4px;">${daysHtml}</div>` : ""}</div>
        </div>
        <div style="font-size:14px;font-weight:600;color:var(--gray-800);">${bill.customer||"—"}</div>
        <div style="font-size:12px;color:var(--gray-400);margin-top:2px;margin-bottom:12px;">${bill.vehicle||"—"}&nbsp;·&nbsp;${bill.date ? String(bill.date).split("T")[0] : "—"}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">
          <button class="btn-ghost" onclick="toggleDetail('${bill.id}')" style="text-align:center;padding:9px 4px;font-size:12px;">Details</button>
          <button class="btn-ghost" onclick="printBill('${bill.id}')" style="text-align:center;padding:9px 4px;font-size:12px;">Print</button>
          <button class="btn-ghost danger" onclick="deleteBill('${bill.id}')" style="text-align:center;padding:9px 4px;font-size:12px;">Delete</button>
        </div>
        <div id="detail_${bill.id}" style="display:none;margin-top:12px;border-top:1px solid var(--gray-100);padding-top:12px;">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--gray-400);margin-bottom:8px;">Note History</div>
          <div id="notesDisplay_${bill.id}" style="margin-bottom:10px;max-height:100px;overflow-y:auto;background:var(--gray-50);border-radius:6px;padding:8px 10px;">${formatNotes(bill.notes||"")}</div>
          <div style="display:flex;gap:8px;margin-bottom:14px;">
            <input type="text" id="note_${bill.id}" placeholder="Add a note..." style="flex:1;padding:10px;border:1.5px solid var(--gray-200);border-radius:6px;font-size:14px;font-family:inherit;">
            <button class="btn-ghost" onclick="saveNote('${bill.id}')">Add</button>
          </div>
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--gray-400);margin-bottom:8px;">Vendor Status</div>
          ${Object.entries(bill.vendorStatuses||{}).map(([vendor, vs]) => `
            <div style="padding:10px 0;border-bottom:1px solid var(--gray-100);">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <div style="font-size:13px;font-weight:700;">${vendor}</div>
                ${vs.phone ? `<div style="display:flex;gap:4px;"><button class="btn-ghost" style="font-size:11px;padding:4px 8px;" onclick="resendText('${bill.id}','${vendor.replace(/'/g,"\'")}')">SMS</button><button class="btn-ghost" style="font-size:11px;padding:4px 8px;" onclick="resendWhatsApp('${bill.id}','${vendor.replace(/'/g,"\'")}')">WA</button></div>` : ""}
              </div>
              <div style="font-size:12px;color:var(--gray-600);margin-bottom:8px;">${(vs.items||[]).join(", ")}</div>
              <select class="item-status-select" style="width:100%;font-size:14px;padding:10px;" onchange="updateStatus('${bill.id}','${vendor.replace(/'/g,"\'")}',this.value)">
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
    let html = '<table class="tracker-table"><thead><tr><th>Bill ID</th><th>Date</th><th>Stock #</th><th>Customer</th><th>Vehicle</th><th>Due Date</th><th>Status</th><th></th></tr></thead><tbody>';
    bills.forEach(bill => {
      const st = getBillStatus(bill);
      const badge = st==="done" ? '<span class="badge badge-done">Completed</span>' : st==="scheduled" ? '<span class="badge badge-scheduled">Scheduled</span>' : '<span class="badge badge-open">Open</span>';
      const days = (bill.dueDate && String(bill.dueDate).trim() && String(bill.dueDate) !== "0") ? getDaysRemaining(bill.dueDate) : null;
      let daysHtml = "—"; let rowClass = "";
      if (days !== null && !isNaN(days) && st !== "done") {
        if (days < 0) { daysHtml = `<span class="days-remaining overdue">OVERDUE ${Math.abs(days)}d</span>`; rowClass = "overdue-row"; }
        else if (days === 0) { daysHtml = `<span class="days-remaining overdue">DUE TODAY</span>`; rowClass = "overdue-row"; }
        else if (days <= 3) { daysHtml = `<span class="days-remaining due-soon">${days}d left</span>`; }
        else { daysHtml = `<span class="days-remaining ok">${days}d left</span>`; }
      }
      html += `<tr class="${rowClass}">
        <td style="font-size:11px;font-weight:700;color:var(--red);white-space:nowrap;">${bill.id||"—"}</td>
        <td style="font-size:12px;color:var(--gray-400);white-space:nowrap;">${bill.date ? String(bill.date).split("T")[0] : "—"}</td>
        <td style="font-weight:700;color:var(--navy);">${bill.stock||"—"}</td>
        <td style="font-size:13px;">${bill.customer||"—"}</td>
        <td style="font-size:12px;color:var(--gray-600);">${bill.vehicle||"—"}</td>
        <td>${daysHtml}</td>
        <td>${badge}</td>
        <td style="white-space:nowrap;">
          <button class="btn-ghost" onclick="toggleDetail('${bill.id}')" style="margin-right:4px;">Details</button>
          <button class="btn-ghost" onclick="printBill('${bill.id}')" style="margin-right:4px;">Print</button>
          <button class="btn-ghost danger" onclick="deleteBill('${bill.id}')">Delete</button>
        </td>
      </tr>
      <tr class="detail-tr" id="detail_${bill.id}" style="display:none;">
        <td colspan="8">
          <div class="detail-inner">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--gray-400);margin-bottom:8px;">Note History</div>
            <div id="notesDisplay_${bill.id}" style="margin-bottom:10px;max-height:120px;overflow-y:auto;background:var(--gray-50);border-radius:6px;padding:8px 10px;">${formatNotes(bill.notes||"")}</div>
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:14px;">
              <input type="text" id="note_${bill.id}" placeholder="Add a new note..." style="flex:1;padding:7px 10px;border:1.5px solid var(--gray-200);border-radius:6px;font-size:13px;font-family:inherit;">
              <button class="btn-ghost" onclick="saveNote('${bill.id}')">Add</button>
            </div>
            <div class="detail-title">Vendor Status</div>
            ${Object.entries(bill.vendorStatuses||{}).map(([vendor, vs]) => `
              <div class="item-status-row">
                <div class="item-status-name">${vendor}</div>
                <div class="item-status-items">${(vs.items||[]).join(", ")}</div>
                <select class="item-status-select" onchange="updateStatus('${bill.id}','${vendor.replace(/'/g,"\'")}',this.value)">
                  <option value="open" ${vs.status==="open"?"selected":""}>Open</option>
                  <option value="scheduled" ${vs.status==="scheduled"?"selected":""}>Scheduled</option>
                  <option value="done" ${vs.status==="done"?"selected":""}>Completed</option>
                </select>
                ${vs.phone ? `<div style='display:flex;gap:4px;'><button class="btn-ghost" onclick="resendText('${bill.id}','${vendor.replace(/'/g,"\'")}')">SMS</button><button class="btn-ghost" onclick="resendWhatsApp('${bill.id}','${vendor.replace(/'/g,"\'")}')">WA</button></div>` : '<span style="font-size:11px;color:var(--gray-400);">No number</span>'}
              </div>`).join("")}
          </div>
        </td>
      </tr>`;
    });
    html += "</tbody></table>";
    body.innerHTML = html;
  }
}

function toggleDetail(id) {
  const row = document.getElementById("detail_" + id);
  if (row) row.style.display = row.style.display === "none" ? "table-row" : "none";
}

function printBill(billId) {
  const bill = getBills().find(b => b.id === billId);
  if (!bill) return;
  const vendors = Object.entries(bill.vendorStatuses||{});
  const win = window.open("", "_blank");
  win.document.write(`
    <html><head><title>Due Bill ${bill.id}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 30px; max-width: 700px; margin: 0 auto; }
      .header { display: flex; align-items: center; gap: 16px; border-bottom: 3px solid #c8102e; padding-bottom: 14px; margin-bottom: 20px; }
      .kia-logo { font-size: 32px; font-weight: 900; color: #c8102e; letter-spacing: -2px; }
      .title { font-size: 22px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
      .subtitle { font-size: 12px; color: #888; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      th { background: #0d1b2a; color: #fff; padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
      td { padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
      .item-row { padding: 10px 0; border-bottom: 1px solid #eee; font-size: 14px; font-weight: 600; }
      .footer { margin-top: 30px; font-size: 11px; color: #888; text-align: center; }
      .sig-line { border-top: 1px solid #333; margin-top: 40px; padding-top: 6px; font-size: 11px; color: #888; display: inline-block; width: 200px; }
      @media print { button { display: none; } }
    </style></head><body>
    <div class="header">
      <div class="kia-logo">KIA</div>
      <div style="border-left:1px solid #ddd;padding-left:16px;">
        <div class="title">Towbin Kia — Due Bill</div>
        <div class="subtitle">Henderson, NV &nbsp;|&nbsp; (702) 567-8000 &nbsp;|&nbsp; 260 N Gibson Rd</div>
      </div>
    </div>
    <table>
      <tr><th>Bill ID</th><th>Date</th><th>Stock #</th><th>Salesperson</th></tr>
      <tr><td><strong>${bill.id}</strong></td><td>${String(bill.date||"").split("T")[0]}</td><td><strong>${bill.stock||"—"}</strong></td><td>${bill.sales||"—"}</td></tr>
    </table>
    <table>
      <tr><th>Customer</th><th>Phone</th><th>Vehicle</th><th>License</th></tr>
      <tr><td>${bill.customer||"—"}</td><td>${bill.phone||"—"}</td><td>${bill.vehicle||"—"}</td><td>${bill.license||"—"}</td></tr>
    </table>
    ${bill.dueDate ? `<p style="font-size:13px;margin-bottom:16px;"><strong>Customer Return Date:</strong> ${String(bill.dueDate).split("T")[0]}</p>` : ""}
    <table>
      <tr><th>#</th><th>Work Promised</th><th>Vendor</th><th>Status</th></tr>
      ${vendors.map(([vendor, vs], i) => `<tr><td>${i+1}</td><td>${(vs.items||[]).join(", ")}</td><td>${vendor}</td><td style="text-transform:capitalize;">${vs.status||"Open"}</td></tr>`).join("")}
    </table>
    ${bill.notes ? `<p style="font-size:13px;margin-bottom:20px;"><strong>Notes:</strong> ${bill.notes}</p>` : ""}
    <p style="font-size:11px;color:#888;margin-bottom:30px;">NOTE: The above promised work is the only work to be performed free of charge. All work must be done in our shop. You must make an advance appointment with the service department before the above work can be performed.</p>
    <div style="display:flex;justify-content:space-between;">
      <div><div class="sig-line">Signed Sales Mgr. X</div></div>
      <div><div class="sig-line">Signed Customer X</div></div>
    </div>
    <div class="footer">DUE TO INSURANCE REGULATIONS — NO LOAN CARS AVAILABLE</div>
    <br><button onclick="window.print()" style="padding:10px 20px;background:#c8102e;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:14px;font-weight:700;">Print / Save as PDF</button>
    </body></html>
  `);
  win.document.close();
}

async function saveNote(billId) {
  const input = document.getElementById("note_" + billId);
  const newText = input ? input.value.trim() : "";
  if (!newText) { toast("Type a note first."); return; }

  const bill = getBills().find(b => b.id === billId);
  const existing = (bill && bill.notes) ? bill.notes : "";
  const timestamp = new Date().toLocaleDateString("en-US",{month:"2-digit",day:"2-digit",year:"2-digit"}) + " " + new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});

  // Append new note with timestamp
  const combined = existing
    ? existing + "\n" + timestamp + " — " + newText
    : timestamp + " — " + newText;

  try {
    await apiPost({ action:"updateNote", billId, note: combined });
    if (bill) bill.notes = combined;
    if (input) input.value = "";
    // Re-render the notes display
    const display = document.getElementById("notesDisplay_" + billId);
    if (display) display.innerHTML = formatNotes(combined);
    toast("Note saved.");
  } catch(e) {
    toast("Failed to save note: " + e.message);
  }
}

function formatNotes(notes) {
  if (!notes) return "<em style=\"color:var(--gray-400);font-size:12px;\">No notes yet.</em>";
  return notes.split("\n").map(line => `<div style="padding:4px 0;font-size:12px;color:var(--gray-600);border-bottom:1px solid var(--gray-100);">${line}</div>`).join("");
}

function resendWhatsApp(billId, vendor) {
  const bill = getBills().find(b => b.id === billId);
  if (!bill) return;
  const vs = bill.vendorStatuses[vendor];
  if (!vs || !vs.phone) { toast("No phone number saved for this vendor."); return; }
  const msg = buildMsg(vendor, vs.items, bill.stock, bill.customer, bill.vehicle, bill.sales, bill.date);
  const phone = vs.phone.replace(/\D/g,"");
  window.open("https://wa.me/" + phone + "?text=" + encodeURIComponent(msg), "_blank");
  toast("WhatsApp opened for " + vendor + ".");
}

function resendText(billId, vendor) {
  const bill = getBills().find(b => b.id === billId);
  if (!bill) return;
  const vs = bill.vendorStatuses[vendor];
  if (!vs || !vs.phone) { toast("No phone number saved for this vendor."); return; }
  const msg = buildMsg(vendor, vs.items, bill.stock, bill.customer, bill.vehicle, bill.sales, bill.date);
  openNativeSMS(vs.phone, msg);
  toast("Text opened for " + vendor + ".");
}

function getBillStatus(bill) {
  const s = Object.values(bill.vendorStatuses).map(x => x.status);
  if (s.every(x => x==="done")) return "done";
  if (s.some(x => x==="scheduled")) return "scheduled";
  return "open";
}

function updateOpenCount() {
  const open = getBills().filter(b => getBillStatus(b) !== "done").length;
  const el = document.getElementById("openCount");
  el.style.display = open > 0 ? "inline" : "none";
  el.textContent = open;
}

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg; el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3000);
}

function updateClock() {
  const el = document.getElementById("clock");
  if (el) el.textContent = new Date().toLocaleString("en-US", { weekday:"short", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
}

const MAKES_MODELS = {
  'Acura':         ['CL','ILX','Integra','MDX','NSX','RDX','RLX','TL','TLX','TSX','ZDX'],
  'Alfa Romeo':    ['4C','Giulia','Giulietta','MiTo','Stelvio','Tonale'],
  'Aston Martin':  ['DB11','DB9','DBS','DBX','Rapide','Vantage','Virage'],
  'Audi':          ['A3','A4','A4 Allroad','A5','A6','A6 Allroad','A7','A8','e-tron','e-tron GT','e-tron S','e-tron Sportback','Q3','Q4 e-tron','Q5','Q5 Sportback','Q7','Q8','Q8 e-tron','R8','RS3','RS4','RS5','RS6','RS7','RS e-tron GT','S3','S4','S5','S6','S7','S8','SQ5','SQ7','SQ8','TT','TTS'],
  'Bentley':       ['Bentayga','Continental GT','Flying Spur','Mulsanne'],
  'BMW':           ['1 Series','2 Series','3 Series','4 Series','5 Series','6 Series','7 Series','8 Series','i3','i4','i5','i7','i8','iX','iX1','iX3','M2','M3','M4','M5','M6','M8','X1','X2','X3','X3 M','X4','X4 M','X5','X5 M','X6','X6 M','X7','XM','Z4'],
  'Buick':         ['Cascada','Enclave','Encore','Encore GX','Envision','Envista','LaCrosse','LeSabre','Lucerne','Rainier','Regal','Regal TourX','Terraza','Verano'],
  'Cadillac':      ['ATS','ATS-V','CT4','CT4-V','CT5','CT5-V','CT6','CTS','CTS-V','DeVille','DTS','Eldorado','ELR','Escalade','Escalade ESV','Lyriq','SRX','STS','XTS','XT4','XT5','XT6'],
  'Chevrolet':     ['Astro','Avalanche','Aveo','Blazer','Blazer EV','Bolt EUV','Bolt EV','Camaro','Captiva','City Express','Colorado','Corvette','Cruze','Equinox','Equinox EV','Express','HHR','Impala','Malibu','Monte Carlo','Orlando','Silverado 1500','Silverado 2500HD','Silverado 3500HD','Silverado EV','Sonic','Spark','Suburban','Tahoe','Tracker','TrailBlazer','Traverse','Trax','Trax EV','Uplander','Volt'],
  'Chrysler':      ['200','300','Aspen','Crossfire','Pacifica','Pacifica Hybrid','PT Cruiser','Sebring','Town & Country','Voyager'],
  'Dodge':         ['Avenger','Caliber','Challenger','Charger','Dakota','Dart','Durango','Grand Caravan','Hornet','Journey','Magnum','Neon','Nitro','Ram 1500','Viper'],
  'Ferrari':       ['296','458','488','812','California','F8','LaFerrari','Portofino','Roma','SF90'],
  'Fiat':          ['124 Spider','500','500L','500X','Bravo','Doblo','Freemont','Fullback','Panda','Tipo'],
  'Ford':          ['Bronco','Bronco Sport','C-Max','C-Max Energi','C-Max Hybrid','E-Transit','EcoSport','Edge','Escape','Escape Plug-In Hybrid','Expedition','Expedition Max','Explorer','F-150','F-150 Lightning','F-250 Super Duty','F-350 Super Duty','F-450 Super Duty','Fiesta','Five Hundred','Flex','Focus','Focus Electric','Freestar','Freestyle','Fusion','Fusion Energi','Fusion Hybrid','GT','Maverick','Mustang','Mustang Mach-E','Ranger','Taurus','Taurus X','Transit','Transit Connect'],
  'Genesis':       ['Electrified G80','Electrified GV70','G70','G80','G90','GV60','GV70','GV80'],
  'GMC':           ['Acadia','Canyon','Envoy','Envoy XL','Jimmy','Safari','Savana','Sierra 1500','Sierra 2500HD','Sierra 3500HD','Sierra EV','Sonoma','Terrain','Yukon','Yukon XL'],
  'Honda':         ['Accord','Accord Hybrid','Clarity','Clarity Electric','Clarity Plug-In Hybrid','CR-V','CR-V Hybrid','CR-Z','Crosstour','Element','Fit','HR-V','Insight','Odyssey','Passport','Pilot','Prologue','Ridgeline','S2000'],
  'Hyundai':       ['Accent','Azera','Elantra','Elantra GT','Elantra N','Elantra Touring','Entourage','Equus','Genesis','Genesis Coupe','Ioniq','Ioniq 5','Ioniq 5 N','Ioniq 6','Kona','Kona Electric','Nexo','Palisade','Santa Cruz','Santa Fe','Santa Fe Sport','Santa Fe XL','Sonata','Sonata Hybrid','Sonata Plug-In Hybrid','Tiburon','Tucson','Tucson Hybrid','Tucson Plug-In Hybrid','Veloster','Veloster N','Venue','Veracruz'],
  'Infiniti':      ['EX35','EX37','FX35','FX37','FX50','G25','G35','G37','JX35','M35','M35h','M37','M56','Q40','Q45','Q50','Q60','Q70','QX30','QX50','QX55','QX56','QX60','QX70','QX80'],
  'Jaguar':        ['E-Pace','F-Pace','F-Type','I-Pace','S-Type','XE','XF','XJ','XK'],
  'Jeep':          ['Cherokee','Commander','Compass','Gladiator','Grand Cherokee','Grand Cherokee 4xe','Grand Cherokee L','Grand Wagoneer','Liberty','Patriot','Renegade','Wagoneer','Wrangler','Wrangler 4xe','Wrangler Unlimited'],
  'Kia':           ['Amanti','Borrego','Cadenza','Carnival','EV6','EV9','Forte','Forte Koup','K4','K5','K900','Niro','Niro EV','Niro Plug-In Hybrid','Optima','Rio','Rondo','Sedona','Seltos','Soul','Soul EV','Sorento','Sorento Hybrid','Sorento Plug-In Hybrid','Sportage','Sportage Hybrid','Sportage Plug-In Hybrid','Stinger','Telluride'],
  'Lamborghini':   ['Aventador','Huracan','Revuelto','Urus'],
  'Land Rover':    ['Defender','Defender 90','Defender 110','Discovery','Discovery Sport','Freelander','LR2','LR4','Range Rover','Range Rover Evoque','Range Rover Sport','Range Rover Velar'],
  'Lexus':         ['CT 200h','ES 250','ES 300h','ES 350','GS 200t','GS 300','GS 350','GS 450h','GS 460','GS F','GX 460','GX 550','IS 200t','IS 250','IS 300','IS 350','IS 500','IS F','LC 500','LC 500h','LFA','LS 460','LS 500','LS 500h','LS 600h','LX 470','LX 570','LX 600','NX 200t','NX 250','NX 300','NX 300h','NX 350','NX 350h','NX 450h+','RC 200t','RC 300','RC 350','RC F','RX 300','RX 330','RX 350','RX 350h','RX 350L','RX 400h','RX 450h','RX 450h+','RX 500h','RZ 300e','RZ 450e','SC 430','TX 350','TX 500h','TX 550h+','UX 200','UX 250h'],
  'Lincoln':       ['Aviator','Aviator Grand Touring','Continental','Corsair','Corsair Grand Touring','Mark LT','MKC','MKS','MKT','MKX','MKZ','MKZ Hybrid','Nautilus','Navigator','Navigator L','Town Car','Zephyr'],
  'Lucid':         ['Air','Air Grand Touring','Air Pure','Air Sapphire','Gravity'],
  'Maserati':      ['Ghibli','GranCabrio','GranTurismo','Grecale','Levante','MC20','Quattroporte'],
  'Mazda':         ['CX-3','CX-30','CX-5','CX-50','CX-70','CX-70 PHEV','CX-90','CX-90 PHEV','CX-9','Mazda2','Mazda3','Mazda5','Mazda6','MX-30','MX-5 Miata','RX-8','Speed3','Speed6'],
  'McLaren':       ['540C','570S','600LT','620R','650S','675LT','720S','750S','765LT','Artura','GT','MP4-12C','Senna'],
  'Mercedes-Benz': ['A-Class','AMG GT','B-Class','C-Class','CL-Class','CLA-Class','CLK-Class','CLS-Class','E-Class','EQB','EQC','EQE','EQE SUV','EQS','EQS SUV','G-Class','GL-Class','GLA-Class','GLB-Class','GLC-Class','GLC Coupe','GLE-Class','GLE Coupe','GLK-Class','GLS-Class','Maybach GLS','Maybach S-Class','ML-Class','R-Class','S-Class','SL-Class','SLC-Class','SLK-Class','SLS AMG','Sprinter'],
  'MINI':          ['Clubman','Convertible','Cooper','Cooper S','Countryman','Coupe','Hardtop 2 Door','Hardtop 4 Door','John Cooper Works','Paceman','Roadster'],
  'Mitsubishi':    ['Eclipse','Eclipse Cross','Endeavor','Galant','i-MiEV','Lancer','Lancer Evolution','Mirage','Mirage G4','Outlander','Outlander PHEV','Outlander Sport','Raider'],
  'Nissan':        ['Altima','Armada','Ariya','Cube','Frontier','GT-R','Juke','Kicks','Leaf','Maxima','Murano','Murano CrossCabriolet','NV1500','NV200','NV2500','NV3500','Pathfinder','Quest','Rogue','Rogue Select','Rogue Sport','Sentra','Titan','Titan XD','Versa','Xterra','Z'],
  'Porsche':       ['718 Boxster','718 Cayman','911','918 Spyder','Boxster','Cayenne','Cayenne Coupe','Cayman','Macan','Macan Electric','Panamera','Taycan','Taycan Cross Turismo','Taycan Sport Turismo'],
  'Ram':           ['1500','1500 Classic','2500','3500','4500','5500','C/V','ProMaster','ProMaster City','ProMaster Window Van'],
  'Rivian':        ['EDV','R1S','R1T','R2'],
  'Rolls-Royce':   ['Cullinan','Dawn','Ghost','Phantom','Silver Shadow','Silver Spur','Spectre','Wraith'],
  'Subaru':        ['Ascent','BRZ','Crosstrek','Crosstrek Hybrid','Crosstrek Plug-In Hybrid','Forester','Impreza','Legacy','Outback','Solterra','Tribeca','WRX','WRX STI'],
  'Tesla':         ['Cybertruck','Model 3','Model S','Model X','Model Y','Roadster'],
  'Toyota':        ['4Runner','Avalon','Avalon Hybrid','bZ4X','C-HR','Camry','Camry Hybrid','Corolla','Corolla Cross','Corolla Cross Hybrid','Corolla Hybrid','Crown','Crown Plug-In Hybrid','FJ Cruiser','GR86','GR Corolla','GR Supra','Highlander','Highlander Hybrid','Land Cruiser','Matrix','Mirai','Prius','Prius C','Prius Plug-In Hybrid','Prius Prime','Prius V','RAV4','RAV4 Hybrid','RAV4 Prime','Sequoia','Sienna','Sienna Hybrid','Supra','Tacoma','Tundra','Tundra Hybrid','Venza','Venza Hybrid','Yaris'],
  'Volkswagen':    ['Arteon','Atlas','Atlas Cross Sport','Beetle','CC','e-Golf','Golf','Golf Alltrack','Golf GTI','Golf R','Golf SportWagen','ID.4','ID.4 AWD Pro','ID.4 Pro','ID.4 Pro S','ID.Buzz','Jetta','Jetta GLI','Jetta Hybrid','Passat','Routan','Taos','Tiguan','Touareg'],
  'Volvo':         ['C30','C40 Recharge','C70','EX30','EX90','S40','S60','S60 Recharge','S80','S90','S90 Recharge','V40','V60','V60 Cross Country','V60 Recharge','V90','V90 Cross Country','V90 Recharge','XC40','XC40 Recharge','XC60','XC60 Recharge','XC70','XC90','XC90 Recharge'],
  'Other':         ['-- Type model manually below --'],
};

const ALL_MAKES = Object.keys(MAKES_MODELS).sort();

function initYearDropdown() {
  const sel = document.getElementById('vehicleYear');
  const cur = new Date().getFullYear();
  for (let y = cur + 1; y >= 2000; y--) {
    const opt = document.createElement('option');
    opt.value = y; opt.textContent = y;
    if (y === cur) opt.selected = true;
    sel.appendChild(opt);
  }
}

function initMakeDropdown() {
  const sel = document.getElementById('vehicleMake');
  ALL_MAKES.forEach(make => {
    const opt = document.createElement('option');
    opt.value = make; opt.textContent = make;
    sel.appendChild(opt);
  });
}

function updateModelDropdown() {
  const make = document.getElementById('vehicleMake').value;
  const sel = document.getElementById('vehicleModel');
  sel.innerHTML = '<option value="">Select Model</option>';
  if (make === 'Other') {
    sel.style.display = 'none';
  } else {
    sel.style.display = 'block';
    if (make && MAKES_MODELS[make]) {
      MAKES_MODELS[make].forEach(model => {
        const opt = document.createElement('option');
        opt.value = model; opt.textContent = model;
        sel.appendChild(opt);
      });
    }
  }
  buildVehicleDesc();
}

function buildVehicleDesc() {
  const year = document.getElementById('vehicleYear').value;
  const make = document.getElementById('vehicleMake').value;
  const model = document.getElementById('vehicleModel').value;
  const otherWrap = document.getElementById('vehicleOtherWrap');
  const otherInput = document.getElementById('vehicleOther');
  if (make === 'Other') {
    otherWrap.style.display = 'block';
    document.getElementById('vehicleDesc').value = otherInput.value.trim();
  } else {
    otherWrap.style.display = 'none';
    document.getElementById('vehicleDesc').value = [year, make, model].filter(Boolean).join(' ');
  }
  updatePreview();
}

/* ---- DRAG & DROP ---- */
const dz = document.getElementById("dropZone");
if (dz) {
  dz.addEventListener("dragover", e => { e.preventDefault(); dz.classList.add("dragover"); });
  dz.addEventListener("dragleave", () => dz.classList.remove("dragover"));
  dz.addEventListener("drop", e => {
    e.preventDefault(); dz.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file) processScanFile(file);
  });
}

async function handleFileUpload(input) {
  const file = input.files[0];
  if (!file) return;
  processScanFile(file);
}

async function processScanFile(file) {
  document.getElementById("scanStatus").style.display = "block";
  document.getElementById("scanSuccess").style.display = "none";
  document.getElementById("scanError").style.display = "none";
  document.getElementById("scanStatusText").textContent = "Reading due bill...";

  try {
    const scriptUrl = SCRIPT_URL;

    const base64 = await fileToBase64(file);
    const mediaType = file.type === "application/pdf" ? "application/pdf" : (file.type || "image/jpeg");

    document.getElementById("scanStatusText").textContent = "AI extracting fields...";

    // Use no-cors iframe trick — post via form to avoid CORS
    // Instead use fetch with mode no-cors then poll, OR use a callback approach
    // Best approach for GAS: encode as URL param and use GET with jsonp-style callback
    const params = new URLSearchParams({
      base64: base64,
      mediaType: mediaType
    });

    const response = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "scanBill", base64, mediaType })
    });

    if (!response.ok) throw new Error("Request failed: " + response.status);

    const result = await response.json();
    if (!result.success) throw new Error(result.error || "Scan failed");
    const parsed = result.data;

    if (parsed.date) document.getElementById("billDate").value = parsed.date;
    if (parsed.stock) document.getElementById("stockNum").value = parsed.stock;
    if (parsed.customer) document.getElementById("customerName").value = parsed.customer;
    if (parsed.license) document.getElementById("licensePlate").value = parsed.license;
    if (parsed.salesperson) document.getElementById("salesperson").value = parsed.salesperson;

    if (parsed.vehicle) {
      const vStr = parsed.vehicle;
      const yearMatch = vStr.match(/20\d{2}/);
      if (yearMatch) {
        const yrSel = document.getElementById('vehicleYear');
        for (let o of yrSel.options) { if (o.value === yearMatch[0]) { yrSel.value = yearMatch[0]; break; } }
      }
      for (const make of ALL_MAKES) {
        if (vStr.toLowerCase().includes(make.toLowerCase())) {
          document.getElementById('vehicleMake').value = make;
          updateModelDropdown();
          if (MAKES_MODELS[make]) {
            for (const model of MAKES_MODELS[make]) {
              if (vStr.toLowerCase().includes(model.toLowerCase())) {
                document.getElementById('vehicleModel').value = model; break;
              }
            }
          }
          break;
        }
      }
      buildVehicleDesc();
    }

    const ITEM_LABELS = {"GPS":"gps","Red Alert":"redalert","Polysteel":"polysteel","XPEL Tint":"tint","XPEL PPF":"ppf","Body Work":"bodyshop","Detail":"detail","Ceramic Coat":"ceramic","Powder Wheels":"powder"};
    if (Array.isArray(parsed.items)) {
      parsed.items.forEach(item => {
        const id = ITEM_LABELS[item];
        if (id) {
          const chk = document.getElementById("chk_" + id);
          const chip = document.getElementById("chip_" + id);
          if (chk && chip) { chk.checked = true; chip.classList.add("checked"); }
        }
      });
    }

    updatePreview();
    document.getElementById("scanStatus").style.display = "none";
    document.getElementById("scanSuccess").style.display = "block";
    // Store image preview URL for sharing
    window._lastDueBillImage = URL.createObjectURL(file);
    window._lastDueBillFile = file;

  } catch(e) {
    document.getElementById("scanStatus").style.display = "none";
    const errEl = document.getElementById("scanError");
    errEl.style.display = "block";
    errEl.textContent = "Scan failed: " + e.message;
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}


// ---- PASSWORD GATE ----
const PWD_HASH = "6d46d54ffa54a5eb9554b1a62c1cc2f2897c79f311296e5c56147bdee8d7e908";
const SESSION_KEY = "tk_auth";

function togglePwdVisibility() {
  const input = document.getElementById("pwdInput");
  const icon = document.getElementById("eyeIcon");
  if (input.type === "password") {
    input.type = "text";
    icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
  } else {
    input.type = "password";
    icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  }
}

// checkPassword and hashString defined in early script block above

// Check auth on load + auto-expire check every minute
if (isLoggedIn()) {
  document.getElementById("passwordGate").style.display = "none";
} else {
  setTimeout(() => { const el = document.getElementById("pwdInput"); if(el) el.focus(); }, 100);
}
// Auto sign-out check every 60 seconds
setInterval(() => {
  if (!isLoggedIn() && document.getElementById("passwordGate").style.display === "none") {
    signOut();
    toast("Session expired — please sign in again.");
  }
}, 60000);

document.getElementById('billDate').value = new Date().toISOString().split('T')[0];
initYearDropdown();
initMakeDropdown();
buildItemsGrid();
buildVendorSettingsRows();
loadConfig();
updateClock();
setInterval(updateClock, 30000);

// Data loads after login via checkPassword()
// If already logged in on page load, load now
if (isLoggedIn()) {
  (async () => {
    try {
      await Promise.all([fetchBills(), fetchVendors()]);
      updateOpenCount();
    } catch(e) { console.error("Sheet load failed:", e); }
  })();
}