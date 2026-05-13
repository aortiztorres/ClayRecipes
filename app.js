// ═══════════════════════════════════════════════════════════════
// Clay Recipes — app.js
// ═══════════════════════════════════════════════════════════════
// IMPORT/EXPORT FORMAT (Excel / CSV):
//
// FORMULAS sheet / CSV columns:
//   nombre | tipo | color | temp | metodo | notas | tags | resultado |
//   ing_1_material | ing_1_pct | ing_2_material | ing_2_pct | ... (up to 20 ingredients)
//
// COCCIONES sheet / CSV columns:
//   nombre | tipo | tempmax | mant | horno | notas |
//   seg_1_desde | seg_1_hasta | seg_1_ritmo | ... (up to 10 segments)
//
// When importing CSV, use semicolon (;) or comma (,) as delimiter.
// Date columns are informational and ignored on import.
// ═══════════════════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, sendPasswordResetEmail,
  sendEmailVerification, updatePassword,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, getDocs, updateDoc,
  deleteDoc, doc, query, orderBy, setDoc, getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
// ── Cloudinary config (replaces Firebase Storage) ───────────────
const CLOUDINARY_CLOUD = "dpc4yjryl";
const CLOUDINARY_PRESET = "ml_default";
import { T, LANGUAGES, detectLang, t } from "./i18n.js";

// ── Firebase config ──────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyAYau-c1KBTgkp4p9sZK9zZZviiyKFvD7s",
  authDomain: "clayrecipes-e7658.firebaseapp.com",
  projectId: "clayrecipes-e7658",
  storageBucket: "clayrecipes-e7658.firebasestorage.app",
  messagingSenderId: "785679342201",
  appId: "1:785679342201:web:944067487211ce0bded2a8",
};
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

// ── State ────────────────────────────────────────────────────────
let currentUser = null;
let formulas = [];
let cocciones = [];
let currentFilter = "all";
let activeTagFilter = null;
let expanded = null;
let currentType = null;
let editingId = null;
let formTags = [];
let showCalc = false;
let lang = detectLang();
let prefs = { dark: false, textSize: "normal", cardSize: "comfortable" };

// ── Auth listener ────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (user && user.emailVerified) {
    currentUser = user;
    await loadPrefs();
    applyPrefs();
    await loadData();
    showApp();
  } else {
    currentUser = null;
    showAuth();
  }
});

// ── Screens ──────────────────────────────────────────────────────
function showApp() {
  document.getElementById("loading-screen").style.display = "none";
  document.getElementById("auth-screen").style.display = "none";
  document.getElementById("app-screen").style.display = "block";
  document.getElementById("profile-email").value = currentUser.email;
  applyLang();
  renderAll();
}
function showAuth() {
  document.getElementById("loading-screen").style.display = "none";
  document.getElementById("auth-screen").style.display = "flex";
  document.getElementById("app-screen").style.display = "none";
  buildLangButtons();
  applyLang();
}

// ── i18n ─────────────────────────────────────────────────────────
function tr(key) { return t(lang, key); }

window.changeLang = (code) => {
  lang = code;
  localStorage.setItem("clayrecipes_lang", code);
  applyLang();
  renderAll();
  // Sync lang selector in header
  const sel = document.getElementById("lang-select-app");
  if (sel) sel.value = code;
};

function buildLangSelector() {
  const sel = document.getElementById("lang-select-app");
  if (!sel) return;
  sel.innerHTML = LANGUAGES.map(l => `<option value="${l.code}">${l.label}</option>`).join("");
  sel.value = lang;
}

function buildLangButtons() {
  const container = document.getElementById("lang-auth-btns");
  if (!container) return;
  container.innerHTML = LANGUAGES.map(l =>
    `<button class="lang-btn-auth ${l.code === lang ? 'active' : ''}" onclick="changeLang('${l.code}')">${l.label}</button>`
  ).join("");
}

function applyLang() {
  // Auth
  setText("auth-sub-text", tr("appSub"));
  setText("tab-login-btn", tr("login"));
  setText("tab-register-btn", tr("register"));
  setText("lbl-email-l", tr("email")); setText("lbl-email-r", tr("email"));
  setText("lbl-pass-l", tr("password")); setText("lbl-pass-r", tr("password"));
  setText("btn-login", tr("loginBtn")); setText("btn-register", tr("registerBtn"));
  setText("btn-forgot", tr("forgotPass"));
  setPlaceholder("reg-pass", tr("minPass"));
  // Nav
  setText("nav-formulas", tr("tabFormulas")); setText("nav-cocciones", tr("tabFirings"));
  setText("nav-gallery", tr("tabGallery")); setText("nav-resultados", tr("tabResults"));
  setText("nav-profile", tr("tabProfile"));
  // Filters
  setText("filter-all", tr("filterAll")); setText("filter-engobe", tr("filterEngobe"));
  setText("filter-esmalte", tr("filterEsmalte"));
  // Search
  setPlaceholder("search-input", tr("search"));
  // Modal
  setText("lbl-entry-type", tr("entryType"));
  setText("tbtn-engobe", tr("btnEngobe")); setText("tbtn-esmalte", tr("btnEsmalte")); setText("tbtn-coccion", tr("btnFiring"));
  setText("lbl-f-name", tr("name")); setPlaceholder("f-nombre", tr("namePlaceholder"));
  setText("lbl-f-color", tr("resultColor")); setPlaceholder("f-color", tr("colorPlaceholder"));
  setText("lbl-f-temp", tr("useTemp"));
  setText("lbl-f-ingredients", tr("ingredients")); setText("lbl-material", tr("material"));
  setText("btn-add-ingredient", tr("addIngredient"));
  setText("lbl-total-weight", tr("totalWeight")); setText("btn-calculator", tr("calculator"));
  setText("lbl-f-method", tr("appMethod"));
  setText("opt-select", tr("select")); setText("opt-immersion", tr("immersion"));
  setText("opt-brush", tr("brush")); setText("opt-spray", tr("spray")); setText("opt-pour", tr("pour"));
  setText("lbl-f-tags", tr("tags")); setPlaceholder("tag-input", tr("tagPlaceholder")); setText("btn-add-tag", tr("addTag"));
  setText("lbl-f-notes", tr("notes")); setPlaceholder("f-notas", tr("notesPlaceholder"));
  setText("lbl-c-name", tr("name")); setPlaceholder("c-nombre", tr("firingNamePlaceholder"));
  setText("lbl-c-type", tr("firingType"));
  setText("copt-select", tr("select")); setText("copt-bisque", tr("bisque"));
  setText("copt-glaze", tr("glaze")); setText("copt-single", tr("singleFire")); setText("copt-third", tr("thirdFire"));
  setText("lbl-c-maxtemp", tr("maxTemp")); setText("lbl-c-hold", tr("holdTime"));
  setText("lbl-c-curve", tr("tempCurve")); setText("lbl-from", tr("from"));
  setText("lbl-to", tr("to")); setText("lbl-rate", tr("rate"));
  setText("btn-add-step", tr("addStep")); setText("lbl-c-kiln", tr("kilnType"));
  setText("kopt-select", tr("select")); setText("kopt-electric", tr("electric"));
  setText("kopt-gas", tr("gas")); setText("kopt-wood", tr("wood")); setText("kopt-raku", tr("raku"));
  setText("lbl-c-notes", tr("notes")); setPlaceholder("c-notas", tr("firingNotesPlaceholder"));
  setText("btn-save", tr("save")); setText("btn-cancel-modal", tr("cancel"));
  // Profile
  setText("lbl-profile", tr("profile")); setText("lbl-display-name", tr("displayName"));
  setText("lbl-change-photo", tr("changePhoto"));
  setText("lbl-change-password", tr("changePassword")); setText("lbl-new-password", tr("newPassword"));
  setText("btn-change-pass", tr("changePassword")); setText("btn-save-profile", tr("saveProfile"));
  setText("btn-delete-account", tr("deleteAccount"));
  setText("lbl-appearance", tr("appearance")); setText("lbl-dark-mode", tr("darkMode"));
  setText("lbl-text-size", tr("textSize")); setText("lbl-card-size", tr("cardSize"));
  setText("ts-small", tr("small")); setText("ts-normal", tr("normal")); setText("ts-large", tr("large"));
  setText("cs-compact", tr("compact")); setText("cs-comfortable", tr("comfortable")); setText("cs-spacious", tr("spacious"));
  setText("lbl-export-import", tr("exportImport"));
  setText("btn-export", tr("exportExcel")); setText("btn-import", tr("importFile"));
  setText("btn-logout", "⏏");
  buildLangSelector();
  buildLangButtons();
}

function setText(id, text) { const el = document.getElementById(id); if (el && text) el.textContent = text; }
function setPlaceholder(id, text) { const el = document.getElementById(id); if (el && text) el.placeholder = text; }

// ── Auth ─────────────────────────────────────────────────────────
window.switchAuthTab = (tab, btn) => {
  document.querySelectorAll(".auth-tab").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById("login-form").style.display = tab === "login" ? "block" : "none";
  document.getElementById("register-form").style.display = tab === "register" ? "block" : "none";
  hideMsg();
};

function showMsg(text, type = "error") {
  const el = document.getElementById("auth-msg");
  el.textContent = text; el.className = `auth-msg ${type}`; el.style.display = "block";
}
function hideMsg() { document.getElementById("auth-msg").style.display = "none"; }
function setAuthLoading(id, loading, label) {
  const btn = document.getElementById(id);
  if (btn) { btn.disabled = loading; btn.textContent = loading ? "..." : label; }
}

window.doLogin = async () => {
  const email = document.getElementById("login-email").value.trim();
  const pass = document.getElementById("login-pass").value;
  if (!email || !pass) return showMsg(tr("fillFields"));
  setAuthLoading("btn-login", true, tr("loginBtn"));
  try {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    if (!result.user.emailVerified) {
      await signOut(auth);
      showMsg(tr("verifyEmail"));
      setAuthLoading("btn-login", false, tr("loginBtn"));
    }
  } catch (e) { showMsg(tradAuthError(e.code)); setAuthLoading("btn-login", false, tr("loginBtn")); }
};

window.doRegister = async () => {
  const email = document.getElementById("reg-email").value.trim();
  const pass = document.getElementById("reg-pass").value;
  if (!email || !pass) return showMsg(tr("fillFields"));
  if (pass.length < 6) return showMsg(tr("minPass"));
  setAuthLoading("btn-register", true, tr("registerBtn"));
  try {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    await sendEmailVerification(result.user);
    await signOut(auth);
    showMsg(tr("verifyEmail"), "success");
    setAuthLoading("btn-register", false, tr("registerBtn"));
  } catch (e) { showMsg(tradAuthError(e.code)); setAuthLoading("btn-register", false, tr("registerBtn")); }
};

window.doLogout = async () => {
  await signOut(auth); formulas = []; cocciones = [];
};

window.doResetPassword = async () => {
  const email = document.getElementById("login-email").value.trim();
  if (!email) return showMsg(tr("fillFields"));
  try { await sendPasswordResetEmail(auth, email); showMsg(tr("emailSent"), "success"); }
  catch (e) { showMsg(tradAuthError(e.code)); }
};

function tradAuthError(code) {
  const map = {
    "auth/invalid-credential": tr("fillFields"),
    "auth/user-not-found": "No existe ninguna cuenta con ese email",
    "auth/wrong-password": "Contraseña incorrecta",
    "auth/email-already-in-use": "Ya existe una cuenta con ese email",
    "auth/invalid-email": "El email no es válido",
    "auth/weak-password": tr("minPass"),
    "auth/too-many-requests": "Demasiados intentos. Espera unos minutos.",
    "auth/network-request-failed": "Error de red. Comprueba tu conexión.",
  };
  return map[code] || "Error inesperado.";
}

// ── Preferences ───────────────────────────────────────────────────
async function loadPrefs() {
  try {
    const snap = await getDoc(doc(db, "usuarios", currentUser.uid, "meta", "prefs"));
    if (snap.exists()) {
      prefs = { ...prefs, ...snap.data() };
      if (prefs.lang) { lang = prefs.lang; localStorage.setItem("clayrecipes_lang", lang); }
    }
  } catch (_) {}
}

async function savePrefs() {
  try {
    await setDoc(doc(db, "usuarios", currentUser.uid, "meta", "prefs"), { ...prefs, lang });
  } catch (_) {}
}

function applyPrefs() {
  applyDarkMode(prefs.dark, false);
  setTextSize(prefs.textSize || "normal", null, false);
  setCardSize(prefs.cardSize || "comfortable", null, false);
  const td = document.getElementById("toggle-dark");
  if (td) td.checked = prefs.dark;
}

window.applyDarkMode = (on, save = true) => {
  document.documentElement.setAttribute("data-theme", on ? "dark" : "");
  prefs.dark = on;
  if (save) savePrefs();
};

window.setTextSize = (size, btn, save = true) => {
  const scales = { small: 0.85, normal: 1, large: 1.35 };
  document.documentElement.style.setProperty("--font-scale", scales[size] || 1);
  prefs.textSize = size;
  document.querySelectorAll("[id^='ts-']").forEach(b => b.classList.remove("active"));
  const active = document.getElementById("ts-" + size);
  if (active) active.classList.add("active");
  if (save) savePrefs();
};

window.setCardSize = (size, btn, save = true) => {
  const pads = { compact: "10px", comfortable: "16px", spacious: "26px" };
  document.documentElement.style.setProperty("--card-pad", pads[size] || "14px");
  prefs.cardSize = size;
  document.querySelectorAll("[id^='cs-']").forEach(b => b.classList.remove("active"));
  const active = document.getElementById("cs-" + size);
  if (active) active.classList.add("active");
  if (save) savePrefs();
};

// ── Profile ───────────────────────────────────────────────────────
window.saveProfile = async () => {
  const name = document.getElementById("profile-name").value.trim();
  prefs.displayName = name;
  await savePrefs();
  const btn = document.getElementById("btn-save-profile");
  btn.textContent = tr("saved");
  setTimeout(() => { btn.textContent = tr("saveProfile"); }, 2000);
};

window.changePassword = async () => {
  const pass = document.getElementById("new-password").value;
  if (pass.length < 6) return alert(tr("minPass"));
  try { await updatePassword(currentUser, pass); alert(tr("saved")); }
  catch (e) { alert(e.message); }
};

window.deleteAccount = async () => {
  if (!confirm(tr("deleteAccountConfirm"))) return;
  try { await currentUser.delete(); }
  catch (e) { alert(e.message); }
};

window.uploadAvatar = async (input) => {
  const file = input.files[0]; if (!file) return;
  setSyncStatus("syncing");
  try {
    const compressed = await compressImage(file, 256);
    const url = await uploadToCloudinary(compressed, `avatar_${currentUser.uid}`);
    prefs.avatarUrl = url;
    await savePrefs();
    updateAvatarUI(url);
    setSyncStatus("ok");
  } catch (e) { console.error(e); setSyncStatus("error"); }
};

function updateAvatarUI(url) {
  const img = document.getElementById("avatar-img");
  const placeholder = document.getElementById("avatar-placeholder");
  if (url) { img.src = url; img.style.display = "block"; placeholder.style.display = "none"; }
}

// ── Firestore helpers ─────────────────────────────────────────────
function userCol(colName) { return collection(db, "usuarios", currentUser.uid, colName); }

function setSyncStatus(status) {
  const dot = document.getElementById("sync-dot");
  if (!dot) return;
  dot.className = "sync-dot" + (status === "syncing" ? " syncing" : status === "error" ? " error" : "");
}

async function loadData() {
  setSyncStatus("syncing");
  try {
    const [fSnap, cSnap] = await Promise.all([
      getDocs(query(userCol("formulas"), orderBy("createdAt", "desc"))),
      getDocs(query(userCol("cocciones"), orderBy("createdAt", "desc"))),
    ]);
    formulas = fSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    cocciones = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (prefs.avatarUrl) updateAvatarUI(prefs.avatarUrl);
    if (prefs.displayName) document.getElementById("profile-name").value = prefs.displayName;
    setSyncStatus("ok");
  } catch (e) { console.error(e); setSyncStatus("error"); }
}

// ── Navigation ────────────────────────────────────────────────────
window.showTab = (tabId, btn) => {
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
  document.querySelectorAll("nav button").forEach(b => b.classList.remove("active"));
  document.getElementById("tab-" + tabId).classList.add("active");
  if (btn) btn.classList.add("active");
  if (tabId === "gallery") renderGallery();
  renderAll();
};

window.filterFormulas = (f, btn) => {
  currentFilter = f;
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderFormulas();
};

window.toggleExpand = (id) => { expanded = expanded === id ? null : id; renderAll(); };

// ── Render ────────────────────────────────────────────────────────
function renderAll() { renderFormulas(); renderCocciones(); renderResultados(); renderTagsFilter(); }

function esc(str) {
  if (!str) return "";
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function getAllTags() {
  const tags = new Set();
  formulas.forEach(f => (f.tags || []).forEach(t => tags.add(t)));
  return [...tags];
}

function renderTagsFilter() {
  const row = document.getElementById("tags-filter-row");
  if (!row) return;
  const tags = getAllTags();
  row.innerHTML = tags.map(tag =>
    `<button class="tag-filter-btn ${activeTagFilter === tag ? 'active' : ''}" onclick="setTagFilter('${esc(tag)}')">#${esc(tag)}</button>`
  ).join("");
}

window.setTagFilter = (tag) => {
  activeTagFilter = activeTagFilter === tag ? null : tag;
  renderTagsFilter();
  renderFormulas();
};

function getFilteredFormulas() {
  const q = (document.getElementById("search-input")?.value || "").toLowerCase();
  return formulas.filter(f => {
    if (currentFilter !== "all" && f.tipo !== currentFilter) return false;
    if (activeTagFilter && !(f.tags || []).includes(activeTagFilter)) return false;
    if (q && !f.nombre?.toLowerCase().includes(q) && !f.color?.toLowerCase().includes(q) &&
        !(f.tags || []).some(t => t.toLowerCase().includes(q))) return false;
    return true;
  });
}

function renderFormulas() {
  const list = document.getElementById("formulas-list");
  const filtered = getFilteredFormulas();
  const q = document.getElementById("search-input")?.value || "";

  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">🏺</div><p>${q ? tr("noResults") + ' "' + esc(q) + '"' : tr("emptyFormulas")}</p></div>`;
    return;
  }

  list.innerHTML = filtered.map(f => `
    <div class="card" style="border-left:3px solid var(--arcilla)" onclick="toggleExpand('f${f.id}')">
      <div class="card-header">
        <div class="card-title">${esc(f.nombre)}</div>
        <span class="tag tag-${f.tipo}">${f.tipo}</span>
      </div>
      <div class="card-meta">
        ${f.fecha ? `<span>📅 ${esc(f.fecha)}</span>` : ""}
        ${f.temp ? `<span>🌡️ ${esc(f.temp)}°C</span>` : ""}
        ${f.color ? `<span>🎨 ${esc(f.color)}</span>` : ""}
        ${f.metodo ? `<span>🖌️ ${esc(f.metodo)}</span>` : ""}
      </div>
      ${f.tags?.length ? `<div class="tags-row" style="margin-top:6px">${f.tags.map(t => `<span class="tag-chip">#${esc(t)}</span>`).join("")}</div>` : ""}
      <div class="card-detail ${expanded === "f" + f.id ? "open" : ""}">
        ${f.ingredients?.length ? `
          <div class="detail-label">${tr("ingredients")}</div>
          ${f.ingredients.map(i => `<div class="ing-row"><span>${esc(i.material)}</span><span class="ing-pct">${esc(i.pct)}%</span></div>`).join("")}
        ` : ""}
        ${f.notas ? `<div class="detail-label">${tr("notes")}</div><p class="notes-text">${esc(f.notas)}</p>` : ""}
        ${f.resultado ? `<div class="detail-label">${tr("rateResult")}</div><div class="stars">${"⭐".repeat(f.resultado)}</div>` : ""}

        ${f.photos?.length ? `
          <div class="detail-label">${tr("photos")}</div>
          <div class="photos-grid">
            ${f.photos.map((url, idx) => `
              <div class="photo-thumb">
                <img src="${url}" onclick="openLightbox('${url}', event)">
                <button class="photo-thumb-del" onclick="deletePhoto('${f.id}', ${idx}, event)">✕</button>
              </div>`).join("")}
            <button class="photo-upload-btn" onclick="triggerPhotoUpload('${f.id}', event)">+</button>
          </div>
        ` : `
          <div class="detail-label">${tr("photos")}</div>
          <button class="photo-upload-btn" style="width:60px;height:60px" onclick="triggerPhotoUpload('${f.id}', event)">📷</button>
        `}
        <input type="file" id="photo-input-${f.id}" accept="image/*" style="display:none" onchange="uploadPhoto('${f.id}', this)">

        <div class="detail-label">${tr("rateResult")}</div>
        <select onchange="setResultado('${f.id}', this.value)" onclick="event.stopPropagation()">
          <option value="">${tr("select")}</option>
          ${[5,4,3,2,1].map(n => `<option value="${n}">${"⭐".repeat(n)} ${tr(["","bad","regular","ok","good","excellent"][n])}</option>`).join("")}
        </select>

        <div class="card-actions">
          <button class="btn-secondary" onclick="editFormula('${f.id}', event)">${tr("edit")}</button>
          <button class="btn-secondary" onclick="duplicateFormula('${f.id}', event)">${tr("duplicate")}</button>
          <button class="btn-danger" onclick="deleteFormula('${f.id}', event)">${tr("delete")}</button>
        </div>
      </div>
    </div>`).join("");
}

function renderCocciones() {
  const list = document.getElementById("cocciones-list");
  if (!list) return;
  if (cocciones.length === 0) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">🔥</div><p>${tr("emptyFirings")}</p></div>`;
    return;
  }
  list.innerHTML = cocciones.map(c => `
    <div class="card" style="border-left:3px solid var(--verde)" onclick="toggleExpand('c${c.id}')">
      <div class="card-header">
        <div class="card-title" style="color:var(--verde)">${esc(c.nombre)}</div>
        <span class="tag tag-coccion">${esc(c.tipo) || "cocción"}</span>
      </div>
      <div class="card-meta">
        ${c.fecha ? `<span>📅 ${esc(c.fecha)}</span>` : ""}
        ${c.tempmax ? `<span>🌡️ ${esc(c.tempmax)}°C</span>` : ""}
        ${c.mant ? `<span>⏱️ ${esc(c.mant)} min</span>` : ""}
        ${c.horno ? `<span>🏭 ${esc(c.horno)}</span>` : ""}
      </div>
      <div class="card-detail ${expanded === "c" + c.id ? "open" : ""}">
        ${c.curva?.length ? `
          <div class="detail-label">${tr("tempCurve")}</div>
          <div class="curva-scroll">
            ${c.curva.map(s => `<div class="curva-step"><div class="curva-temp">${esc(s.desde)}→${esc(s.hasta)}°</div><div class="curva-rate">${esc(s.ritmo)}°/h</div></div>`).join("")}
          </div>` : ""}
        ${c.notas ? `<div class="detail-label">${tr("notes")}</div><p class="notes-text">${esc(c.notas)}</p>` : ""}
        <div class="card-actions">
          <button class="btn-secondary" onclick="editCoccion('${c.id}', event)">${tr("edit")}</button>
          <button class="btn-danger" onclick="deleteCoccion('${c.id}', event)">${tr("delete")}</button>
        </div>
      </div>
    </div>`).join("");
}

function renderResultados() {
  const list = document.getElementById("resultados-list");
  if (!list) return;
  const con = formulas.filter(f => f.resultado).sort((a, b) => b.resultado - a.resultado);
  if (con.length === 0) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">📊</div><p>${tr("emptyResults")}</p></div>`;
    return;
  }
  list.innerHTML = con.map((f, i) => `
    <div class="rank-card" style="border-left:3px solid ${i===0?"var(--dorado)":i===1?"var(--arcilla)":"var(--border)"}">
      <div>
        <div class="rank-num">#${i+1} · <span class="tag tag-${f.tipo}" style="font-size:9px">${f.tipo}</span></div>
        <div style="font-family:'Playfair Display',serif;font-size:clamp(13px,3.5vw,15px);color:var(--tierra);margin-top:3px">${esc(f.nombre)}</div>
        ${f.color ? `<div style="font-size:11px;color:var(--subtext);margin-top:2px">🎨 ${esc(f.color)}</div>` : ""}
      </div>
      <div class="stars">${"⭐".repeat(f.resultado)}</div>
    </div>`).join("");
}

// ── Gallery ───────────────────────────────────────────────────────
function renderGallery() {
  const container = document.getElementById("global-gallery");
  if (!container) return;
  const items = [];
  formulas.forEach(f => {
    (f.photos || []).forEach(url => items.push({ url, nombre: f.nombre, tipo: f.tipo }));
  });
  if (items.length === 0) {
    container.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="empty-icon">🖼️</div><p>${tr("noPhotosGlobal")}</p></div>`;
    return;
  }
  container.innerHTML = items.map(item => `
    <div class="gallery-item" onclick="openLightbox('${item.url}')">
      <img src="${item.url}" loading="lazy">
      <div class="gallery-item-label">${esc(item.nombre)}</div>
    </div>`).join("");
}

window.openLightbox = (url, e) => {
  if (e) e.stopPropagation();
  document.getElementById("lightbox-img").src = url;
  document.getElementById("lightbox").classList.add("open");
};
window.closeLightbox = () => document.getElementById("lightbox").classList.remove("open");

// ── Photos ────────────────────────────────────────────────────────
window.triggerPhotoUpload = (id, e) => {
  e.stopPropagation();
  document.getElementById("photo-input-" + id)?.click();
};

window.uploadPhoto = async (formulaId, input) => {
  const file = input.files[0]; if (!file) return;
  input.value = "";
  setSyncStatus("syncing");
  try {
    const compressed = await compressImage(file, 1200);
    const publicId = `clayrecipes/${currentUser.uid}/${formulaId}/${Date.now()}`;
    const url = await uploadToCloudinary(compressed, publicId);
    const formula = formulas.find(f => f.id === formulaId);
    const photos = [...(formula.photos || []), url];
    await updateDoc(doc(db, "usuarios", currentUser.uid, "formulas", formulaId), { photos });
    formulas = formulas.map(f => f.id === formulaId ? { ...f, photos } : f);
    setSyncStatus("ok");
    renderAll();
  } catch (e) { console.error(e); setSyncStatus("error"); }
};

window.deletePhoto = async (formulaId, idx, e) => {
  e.stopPropagation();
  if (!confirm("¿Eliminar esta foto?")) return;
  // Note: Cloudinary unsigned preset doesn't support client-side delete.
  // The photo URL is removed from Firestore; the image remains in Cloudinary storage.
  const formula = formulas.find(f => f.id === formulaId);
  const photos = formula.photos.filter((_, i) => i !== idx);
  await updateDoc(doc(db, "usuarios", currentUser.uid, "formulas", formulaId), { photos });
  formulas = formulas.map(f => f.id === formulaId ? { ...f, photos } : f);
  renderAll();
};

// ── Cloudinary upload ─────────────────────────────────────────────
async function uploadToCloudinary(blob, publicId) {
  const formData = new FormData();
  formData.append("file", blob);
  formData.append("upload_preset", CLOUDINARY_PRESET);
  formData.append("public_id", publicId);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Cloudinary upload failed");
  const data = await res.json();
  return data.secure_url;
}

// Compress image before upload (max width/height, quality 0.75)
async function compressImage(file, maxSize) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => resolve(blob), "image/jpeg", 0.75);
    };
    img.src = url;
  });
}

// ── Actions ───────────────────────────────────────────────────────
window.setResultado = async (id, val) => {
  if (!val) return;
  setSyncStatus("syncing");
  await updateDoc(doc(db, "usuarios", currentUser.uid, "formulas", id), { resultado: parseInt(val) });
  formulas = formulas.map(f => f.id === id ? { ...f, resultado: parseInt(val) } : f);
  setSyncStatus("ok"); renderAll();
};

window.deleteFormula = async (id, e) => {
  e.stopPropagation();
  if (!confirm(tr("delete") + "?")) return;
  setSyncStatus("syncing");
  await deleteDoc(doc(db, "usuarios", currentUser.uid, "formulas", id));
  formulas = formulas.filter(f => f.id !== id);
  expanded = null; setSyncStatus("ok"); renderAll();
};

window.deleteCoccion = async (id, e) => {
  e.stopPropagation();
  if (!confirm(tr("delete") + "?")) return;
  setSyncStatus("syncing");
  await deleteDoc(doc(db, "usuarios", currentUser.uid, "cocciones", id));
  cocciones = cocciones.filter(c => c.id !== id);
  expanded = null; setSyncStatus("ok"); renderAll();
};

window.duplicateFormula = async (id, e) => {
  e.stopPropagation();
  const f = formulas.find(x => x.id === id); if (!f) return;
  setSyncStatus("syncing");
  const copy = { ...f, nombre: `${tr("copyOf")} ${f.nombre}`, resultado: null, photos: [], createdAt: Date.now(), fecha: new Date().toLocaleDateString("es-ES") };
  delete copy.id;
  const ref2 = await addDoc(userCol("formulas"), copy);
  formulas = [{ id: ref2.id, ...copy }, ...formulas];
  setSyncStatus("ok"); renderAll();
};

// ── Edit ──────────────────────────────────────────────────────────
window.editFormula = (id, e) => {
  e.stopPropagation();
  const f = formulas.find(x => x.id === id); if (!f) return;
  editingId = id;
  openModal(f.tipo);
  document.getElementById("f-nombre").value = f.nombre || "";
  document.getElementById("f-color").value = f.color || "";
  document.getElementById("f-temp").value = f.temp || "";
  document.getElementById("f-metodo").value = f.metodo || "";
  document.getElementById("f-notas").value = f.notas || "";
  document.getElementById("ing-container").innerHTML = "";
  (f.ingredients || []).forEach(i => addIngredient(i.material, i.pct));
  formTags = [...(f.tags || [])];
  renderFormTagsRow();
  document.getElementById("modal-title").textContent = tr("editEntry");
};

window.editCoccion = (id, e) => {
  e.stopPropagation();
  const c = cocciones.find(x => x.id === id); if (!c) return;
  editingId = id;
  openModal("coccion");
  document.getElementById("c-nombre").value = c.nombre || "";
  document.getElementById("c-tipo").value = c.tipo || "";
  document.getElementById("c-tempmax").value = c.tempmax || "";
  document.getElementById("c-mant").value = c.mant || "";
  document.getElementById("c-horno").value = c.horno || "";
  document.getElementById("c-notas").value = c.notas || "";
  document.getElementById("curva-container").innerHTML = "";
  (c.curva || []).forEach(s => addCurvaStep(s.desde, s.hasta, s.ritmo));
  document.getElementById("modal-title").textContent = tr("editEntry");
};

// ── Modal ─────────────────────────────────────────────────────────
window.openModal = (type = null) => {
  if (!type) {
    editingId = null; currentType = null; formTags = [];
    document.querySelectorAll(".type-btn").forEach(b => b.className = "type-btn");
    document.getElementById("form-mezcla").classList.remove("active");
    document.getElementById("form-coccion").classList.remove("active");
    document.getElementById("btn-save").style.display = "none";
    document.getElementById("modal-title").textContent = tr("newEntry");
    clearForms();
  } else { selectType(type); }
  document.getElementById("modal").classList.add("open");
};
window.closeModal = () => { document.getElementById("modal").classList.remove("open"); editingId = null; };
window.handleModalClick = e => { if (e.target === document.getElementById("modal")) closeModal(); };

window.selectType = (type) => {
  currentType = type;
  document.querySelectorAll(".type-btn").forEach(b => b.className = "type-btn");
  document.getElementById("tbtn-" + type).classList.add("sel-" + type);
  document.getElementById("form-mezcla").classList.toggle("active", type === "engobe" || type === "esmalte");
  document.getElementById("form-coccion").classList.toggle("active", type === "coccion");
  document.getElementById("btn-save").style.display = "block";
  if ((type === "engobe" || type === "esmalte") && document.getElementById("ing-container").children.length === 0) addIngredient();
  if (type === "coccion" && document.getElementById("curva-container").children.length === 0) { addCurvaStep(); addCurvaStep(); addCurvaStep(); }
};

function clearForms() {
  ["f-nombre","f-color","f-temp","f-notas","c-nombre","c-tempmax","c-mant","c-notas"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  ["f-metodo","c-tipo","c-horno"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  document.getElementById("ing-container").innerHTML = "";
  document.getElementById("curva-container").innerHTML = "";
  document.getElementById("calc-section").style.display = "none";
  showCalc = false; formTags = [];
  renderFormTagsRow();
}

window.addIngredient = (material = "", pct = "") => {
  const row = document.createElement("div"); row.className = "ing-builder-row";
  row.innerHTML = `
    <input type="text" placeholder="${tr("material")}" value="${esc(material)}">
    <input type="number" placeholder="%" min="0" max="100" value="${esc(pct)}" oninput="renderCalc()">
    <button class="btn-remove-ing" onclick="this.parentElement.remove();renderCalc()">×</button>`;
  document.getElementById("ing-container").appendChild(row);
};

window.addCurvaStep = (desde = "", hasta = "", ritmo = "") => {
  const row = document.createElement("div"); row.className = "curva-builder-row";
  row.innerHTML = `
    <input type="number" placeholder="20" value="${esc(desde)}">
    <input type="number" placeholder="600" value="${esc(hasta)}">
    <input type="number" placeholder="60" value="${esc(ritmo)}">`;
  document.getElementById("curva-container").appendChild(row);
};

// ── Tags ──────────────────────────────────────────────────────────
window.addTag = () => {
  const input = document.getElementById("tag-input");
  const val = input.value.trim().toLowerCase().replace(/\s+/g, "-");
  if (!val || formTags.includes(val)) { input.value = ""; return; }
  formTags.push(val); input.value = "";
  renderFormTagsRow();
};

function renderFormTagsRow() {
  const row = document.getElementById("form-tags-row");
  if (!row) return;
  row.innerHTML = formTags.map((tag, i) =>
    `<span class="tag-chip">#${esc(tag)}<button class="tag-chip-remove" onclick="removeFormTag(${i})">×</button></span>`
  ).join("");
}

window.removeFormTag = (i) => { formTags.splice(i, 1); renderFormTagsRow(); };

// ── Calculator ────────────────────────────────────────────────────
window.toggleCalc = () => {
  showCalc = !showCalc;
  document.getElementById("calc-section").style.display = showCalc ? "block" : "none";
  if (showCalc) renderCalc();
};

window.renderCalc = () => {
  if (!showCalc) return;
  const total = parseFloat(document.getElementById("calc-weight")?.value) || 0;
  const rows = document.querySelectorAll("#ing-container .ing-builder-row");
  const results = document.getElementById("calc-results");
  if (!results) return;
  if (!total) { results.innerHTML = ""; return; }
  let html = `<div style="font-size:11px;font-weight:700;color:var(--subtext);margin-bottom:6px;text-transform:uppercase">${tr("calcResult")}</div>`;
  rows.forEach(row => {
    const inputs = row.querySelectorAll("input");
    const mat = inputs[0]?.value.trim();
    const pct = parseFloat(inputs[1]?.value) || 0;
    if (mat && pct) html += `<div class="calc-result-row"><span>${esc(mat)}</span><span class="calc-grams">${(total * pct / 100).toFixed(1)} g</span></div>`;
  });
  results.innerHTML = html;
};

// ── Save ──────────────────────────────────────────────────────────
window.saveEntry = async () => {
  if (!currentType) return alert(tr("entryType"));
  setSyncStatus("syncing");

  if (currentType === "engobe" || currentType === "esmalte") {
    const nombre = document.getElementById("f-nombre").value.trim();
    if (!nombre) { setSyncStatus("ok"); return alert(tr("addName")); }
    const ings = [];
    document.querySelectorAll("#ing-container .ing-builder-row").forEach(row => {
      const inputs = row.querySelectorAll("input");
      if (inputs[0].value.trim()) ings.push({ material: inputs[0].value.trim(), pct: inputs[1].value || "?" });
    });
    const data = {
      nombre, tipo: currentType,
      color: document.getElementById("f-color").value,
      temp: document.getElementById("f-temp").value,
      metodo: document.getElementById("f-metodo").value,
      notas: document.getElementById("f-notas").value,
      ingredients: ings, tags: formTags,
      fecha: new Date().toLocaleDateString("es-ES"),
      createdAt: editingId ? (formulas.find(f => f.id === editingId)?.createdAt || Date.now()) : Date.now(),
    };
    if (editingId) {
      await updateDoc(doc(db, "usuarios", currentUser.uid, "formulas", editingId), data);
      formulas = formulas.map(f => f.id === editingId ? { ...f, ...data } : f);
    } else {
      const ref2 = await addDoc(userCol("formulas"), data);
      formulas = [{ id: ref2.id, ...data }, ...formulas];
    }
  } else {
    const nombre = document.getElementById("c-nombre").value.trim();
    if (!nombre) { setSyncStatus("ok"); return alert(tr("addName")); }
    const curva = [];
    document.querySelectorAll("#curva-container .curva-builder-row").forEach(row => {
      const inputs = row.querySelectorAll("input");
      if (inputs[0].value || inputs[1].value) curva.push({ desde: inputs[0].value, hasta: inputs[1].value, ritmo: inputs[2].value });
    });
    const data = {
      nombre, tipo: document.getElementById("c-tipo").value,
      tempmax: document.getElementById("c-tempmax").value,
      mant: document.getElementById("c-mant").value,
      horno: document.getElementById("c-horno").value,
      notas: document.getElementById("c-notas").value,
      curva, fecha: new Date().toLocaleDateString("es-ES"),
      createdAt: editingId ? (cocciones.find(c => c.id === editingId)?.createdAt || Date.now()) : Date.now(),
    };
    if (editingId) {
      await updateDoc(doc(db, "usuarios", currentUser.uid, "cocciones", editingId), data);
      cocciones = cocciones.map(c => c.id === editingId ? { ...c, ...data } : c);
    } else {
      const ref2 = await addDoc(userCol("cocciones"), data);
      cocciones = [{ id: ref2.id, ...data }, ...cocciones];
    }
  }
  setSyncStatus("ok"); closeModal(); renderAll();
};

// ── Export / Import ───────────────────────────────────────────────
window.exportToExcel = () => {
  const wb = XLSX.utils.book_new();

  // Formulas sheet
  const maxIngs = Math.max(0, ...formulas.map(f => f.ingredients?.length || 0));
  const fHeaders = ["nombre","tipo","color","temp","metodo","notas","tags","resultado","fecha"];
  for (let i = 1; i <= Math.min(maxIngs, 20); i++) fHeaders.push(`ing_${i}_material`, `ing_${i}_pct`);
  const fRows = formulas.map(f => {
    const row = {
      nombre: f.nombre, tipo: f.tipo, color: f.color, temp: f.temp,
      metodo: f.metodo, notas: f.notas, tags: (f.tags || []).join(", "),
      resultado: f.resultado || "", fecha: f.fecha,
    };
    (f.ingredients || []).forEach((ing, i) => { row[`ing_${i+1}_material`] = ing.material; row[`ing_${i+1}_pct`] = ing.pct; });
    return row;
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fRows, { header: fHeaders }), "Formulas");

  // Cocciones sheet
  const maxSegs = Math.max(0, ...cocciones.map(c => c.curva?.length || 0));
  const cHeaders = ["nombre","tipo","tempmax","mant","horno","notas","fecha"];
  for (let i = 1; i <= Math.min(maxSegs, 10); i++) cHeaders.push(`seg_${i}_desde`, `seg_${i}_hasta`, `seg_${i}_ritmo`);
  const cRows = cocciones.map(c => {
    const row = { nombre: c.nombre, tipo: c.tipo, tempmax: c.tempmax, mant: c.mant, horno: c.horno, notas: c.notas, fecha: c.fecha };
    (c.curva || []).forEach((s, i) => { row[`seg_${i+1}_desde`] = s.desde; row[`seg_${i+1}_hasta`] = s.hasta; row[`seg_${i+1}_ritmo`] = s.ritmo; });
    return row;
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cRows, { header: cHeaders }), "Cocciones");

  XLSX.writeFile(wb, `ClayRecipes_${new Date().toISOString().slice(0,10)}.xlsx`);
};

window.importFromFile = async (input) => {
  const file = input.files[0]; input.value = "";
  if (!file) return;
  const msg = document.getElementById("import-msg");
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });

    let imported = 0;

    // Import Formulas
    const fSheet = wb.Sheets["Formulas"] || wb.Sheets[wb.SheetNames[0]];
    if (fSheet) {
      const rows = XLSX.utils.sheet_to_json(fSheet);
      for (const row of rows) {
        if (!row.nombre) continue;
        const ings = [];
        for (let i = 1; i <= 20; i++) {
          const mat = row[`ing_${i}_material`];
          const pct = row[`ing_${i}_pct`];
          if (mat) ings.push({ material: String(mat), pct: String(pct || "") });
        }
        const data = {
          nombre: String(row.nombre || ""), tipo: String(row.tipo || "engobe"),
          color: String(row.color || ""), temp: String(row.temp || ""),
          metodo: String(row.metodo || ""), notas: String(row.notas || ""),
          tags: row.tags ? String(row.tags).split(",").map(t => t.trim()).filter(Boolean) : [],
          resultado: parseInt(row.resultado) || null,
          ingredients: ings, photos: [],
          fecha: new Date().toLocaleDateString("es-ES"), createdAt: Date.now(),
        };
        const ref2 = await addDoc(userCol("formulas"), data);
        formulas = [{ id: ref2.id, ...data }, ...formulas];
        imported++;
      }
    }

    // Import Cocciones
    if (wb.SheetNames.length > 1) {
      const cSheet = wb.Sheets["Cocciones"] || wb.Sheets[wb.SheetNames[1]];
      if (cSheet) {
        const rows = XLSX.utils.sheet_to_json(cSheet);
        for (const row of rows) {
          if (!row.nombre) continue;
          const curva = [];
          for (let i = 1; i <= 10; i++) {
            const desde = row[`seg_${i}_desde`];
            const hasta = row[`seg_${i}_hasta`];
            const ritmo = row[`seg_${i}_ritmo`];
            if (desde || hasta) curva.push({ desde: String(desde || ""), hasta: String(hasta || ""), ritmo: String(ritmo || "") });
          }
          const data = {
            nombre: String(row.nombre || ""), tipo: String(row.tipo || ""),
            tempmax: String(row.tempmax || ""), mant: String(row.mant || ""),
            horno: String(row.horno || ""), notas: String(row.notas || ""),
            curva, fecha: new Date().toLocaleDateString("es-ES"), createdAt: Date.now(),
          };
          const ref2 = await addDoc(userCol("cocciones"), data);
          cocciones = [{ id: ref2.id, ...data }, ...cocciones];
          imported++;
        }
      }
    }

    msg.textContent = `${tr("importSuccess")}: ${imported} entradas`;
    msg.style.display = "block";
    setTimeout(() => { msg.style.display = "none"; }, 4000);
    renderAll();
  } catch (e) {
    console.error(e);
    msg.textContent = tr("importError");
    msg.style.color = "var(--rojo)";
    msg.style.display = "block";
  }
};

// ── Service Worker ────────────────────────────────────────────────
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
