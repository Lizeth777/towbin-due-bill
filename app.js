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
      body { font-family: Arial, sans-serif; padding: 30px; max-width: 720px; margin: 0 auto; color: #1a1a1a; }
      .header { display: flex; align-items: center; gap: 20px; border-bottom: 3px solid #ea0029; padding-bottom: 16px; margin-bottom: 20px; }
      .header img { height: 36px; width: auto; }
      .header-divider { width: 1px; height: 40px; background: #ddd; }
      .title { font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.06em; color: #05141f; }
      .subtitle { font-size: 12px; color: #888; margin-top: 2px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
      th { background: #05141f; color: #fff; padding: 9px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
      td { padding: 9px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
      .due-date { font-size: 13px; margin-bottom: 16px; padding: 8px 12px; background: #f7f8fa; border-radius: 5px; border-left: 3px solid #ea0029; }
      .notes { font-size: 12px; margin-bottom: 20px; padding: 10px 12px; background: #f7f8fa; border-radius: 5px; }
      .disclaimer { font-size: 10px; color: #888; margin-bottom: 30px; line-height: 1.6; }
      .sig-row { display: flex; justify-content: space-between; margin-top: 40px; }
      .sig-line { border-top: 1px solid #333; padding-top: 6px; font-size: 11px; color: #666; width: 220px; }
      .footer { text-align: center; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; color: #333; border-top: 2px solid #05141f; padding-top: 12px; margin-top: 20px; }
      .print-btn { margin-top: 20px; padding: 12px 24px; background: #ea0029; color: #fff; border: none; border-radius: 6px; font-size: 14px; font-weight: 700; cursor: pointer; }
      @media print { .print-btn { display: none; } }
    </style></head><body>
    <div class="header">
      <img src="data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAA0AKwDASIAAhEBAxEB/8QAHAABAAICAwEAAAAAAAAAAAAAAAQHBggCAwUJ/8QAMRAAAQMEAQMCBAMJAAAAAAAAAQACAwQFBhEHEiExCEEiUWFxFRZCCRMyMzZDUnSy/8QAFwEBAQEBAAAAAAAAAAAAAAAAAAIDBP/EABkRAQEBAQEBAAAAAAAAAAAAAAABEQISIf/aAAwDAQACEQMRAD8A1NREXa4hERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAVgcH8VX/lfJZbVZ5qakp6VjZa2snO2wsJ0NNHdzjo6HYdu5HlV+tsP2c39QZj/q0v/cinu5NVxNuKd9SfHlr4xz6mxi1VdVWRi2QzzT1GuqSVznhxAHZo7DQ76+Z8rFOP8HynPL220YtaKi4VHYyOaNRwtP6pHn4WD7nv4Gyt0Oe+GcfyfkyTkLP8pprLidFQQwPjEnRLM9rnktLiNNB2AA3qc7uAB2Kn8EcycQVmQv46wq2/gNIzQt0kkYiZcH+Ha2errOgQXnqd9D2Ue75+L8T19VBduGeIeJcVFTy3klVdshqGdcVstMvQfswfxEb/ALj+lvbQG/OdYb6d+JMr4xoctgtV4oH3C3mqji/EzIYSWkgb6QHa+ypz1acNX7Cclqstgqq684/cp+o1lRI6Wamkce0czjskezXnz2B7+duOBgXenHGA0Ek2JoAHv8BU9W5squZNyx8zVlXGvH2Wch3sWnFrVJVvBH76d3ww07T+qR57NHnt5OuwKt3ir05Svs/5z5cuQxLGYWiUwTPEdTMPYO3/ACgfGtF58Bo2CpfJHqLorPZDhPCNpjxuxRAsNxEXTUTexcwHu0n/ADdt58/CQtL1vyM5zn2rOwz0h4GyziHIsgudzu0TumrfQzsiiieWh3QGlrnDQcDtx2QQdDelqPyzj9FinJmRY5bnzPo7dcJaeB0xBf0Nd26iAATr30tuvRnllnx3gG8ZFlt7hoqf8wVD5qqrl26R5hhJ87c9579hslakcv36hyjlHJchthkNDX3GaenMjelzmFx6SR7bHfSnjfV1XeZMYoiItWQiIgIiICIiAiIgIiIClW65XG2yOkt1fVUb3jpc6CZ0ZcPkSCFFRBNuN3utyYxlxudbWNYdsE87pA0/TZOlEje+ORskb3Me0hzXNOiCPBBXFEHp1eQ3+rp309VfLnPC8afHLVvc1w+oJ0UpMhv9JTspqS+XOngYNMjiq3ta0fQA6C8xEE643i73KNsVxutdWRsPU1s9Q+QA/MAk91BREHY6ed1OymdNIYY3OeyMuPS1x1sgeATobP0C60RAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREH/2Q==" alt="KIA">
      <div class="header-divider"></div>
      <div>
        <div class="title">Towbin Kia — Due Bill</div>
        <div class="subtitle">Henderson, NV &nbsp;|&nbsp; (702) 567-8000 &nbsp;|&nbsp; 260 N Gibson Rd</div>
      </div>
    </div>
    <table>
      <tr><th>Bill ID</th><th>Date</th><th>Stock #</th><th>Salesperson</th></tr>
      <tr><td><strong>${bill.id}</strong></td><td>${String(bill.date||"").split("T")[0]}</td><td><strong>${bill.stock||"—"}</strong></td><td>${bill.sales||"—"}</td></tr>
    </table>
    <table>
      <tr><th>Customer</th><th>Vehicle</th><th>License</th></tr>
      <tr><td>${bill.customer||"—"}</td><td>${bill.vehicle||"—"}</td><td>${bill.license||"—"}</td></tr>
    </table>
    ${bill.dueDate && String(bill.dueDate).trim() ? `<div class="due-date"><strong>Customer Return Date:</strong> ${String(bill.dueDate).split("T")[0]}</div>` : ""}
    <table>
      <tr><th>#</th><th>Vendor</th><th>Work Promised</th><th>Status</th></tr>
      ${vendors.map(([vendor, vs], i) => `<tr><td>${i+1}</td><td>${vendor}</td><td>${(vs.items||[]).join(", ")}</td><td style="text-transform:capitalize;">${vs.status||"Open"}</td></tr>`).join("")}
    </table>
    ${bill.notes ? `<div class="notes"><strong>Notes:</strong> ${bill.notes}</div>` : ""}
    <p class="disclaimer">NOTE: The above promised work is the only work to be performed free of charge. Any additional work will be charged in accordance with the type of warranty issued at time of sale. All work must be done in our shop. You must make an advance appointment with the service department before the above work can be performed.</p>
    <div class="sig-row">
      <div><div class="sig-line">Signed Sales Mgr. X</div></div>
      <div><div class="sig-line">Signed Customer X</div></div>
    </div>
    <div class="footer">DUE TO INSURANCE REGULATIONS — NO LOAN CARS AVAILABLE</div>
    <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
    </body></html>
  `);
  win.document.close();
}
