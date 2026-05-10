// ── Firebase setup ───────────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
let expanded = null;
let currentType = null;
let editingId = null; // null = nueva entrada, string = edición

// ── Auth state listener ──────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
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
  renderAll();
}

function showAuth() {
  document.getElementById("loading-screen").style.display = "none";
  document.getElementById("auth-screen").style.display = "flex";
  document.getElementById("app-screen").style.display = "none";
}

// ── Auth UI ──────────────────────────────────────────────────────
window.switchAuthTab = (tab, btn) => {
  document.querySelectorAll(".auth-tab").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById("login-form").style.display = tab === "login" ? "block" : "none";
  document.getElementById("register-form").style.display = tab === "register" ? "block" : "none";
  hideMsg();
};

function showMsg(text, type = "error") {
  const el = document.getElementById("auth-msg");
  el.textContent = text;
  el.className = `auth-msg ${type}`;
  el.style.display = "block";
}

function hideMsg() {
  document.getElementById("auth-msg").style.display = "none";
}

function setAuthLoading(btnId, loading, label) {
  const btn = document.getElementById(btnId);
  btn.disabled = loading;
  btn.textContent = loading ? "..." : label;
}

window.doLogin = async () => {
  const email = document.getElementById("login-email").value.trim();
  const pass = document.getElementById("login-pass").value;
  if (!email || !pass) return showMsg("Introduce email y contraseña");
  setAuthLoading("btn-login", true, "Entrar");
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    showMsg(tradAuthError(e.code));
    setAuthLoading("btn-login", false, "Entrar");
  }
};

window.doRegister = async () => {
  const email = document.getElementById("reg-email").value.trim();
  const pass = document.getElementById("reg-pass").value;
  if (!email || !pass) return showMsg("Introduce email y contraseña");
  if (pass.length < 6) return showMsg("La contraseña debe tener al menos 6 caracteres");
  setAuthLoading("btn-register", true, "Crear cuenta");
  try {
    await createUserWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    showMsg(tradAuthError(e.code));
    setAuthLoading("btn-register", false, "Crear cuenta");
  }
};

window.doLogout = async () => {
  await signOut(auth);
  formulas = [];
  cocciones = [];
};

window.doResetPassword = async () => {
  const email = document.getElementById("login-email").value.trim();
  if (!email) return showMsg("Introduce tu email primero");
  try {
    await sendPasswordResetEmail(auth, email);
    showMsg("Email de recuperación enviado. Revisa tu bandeja de entrada.", "success");
  } catch (e) {
    showMsg(tradAuthError(e.code));
  }
};

function tradAuthError(code) {
  const map = {
    "auth/invalid-credential": "Email o contraseña incorrectos",
    "auth/user-not-found": "No existe ninguna cuenta con ese email",
    "auth/wrong-password": "Contraseña incorrecta",
    "auth/email-already-in-use": "Ya existe una cuenta con ese email",
    "auth/invalid-email": "El email no es válido",
    "auth/weak-password": "La contraseña es demasiado débil",
    "auth/too-many-requests": "Demasiados intentos. Espera unos minutos.",
    "auth/network-request-failed": "Error de red. Comprueba tu conexión.",
  };
  return map[code] || "Error inesperado. Inténtalo de nuevo.";
}

// ── Firestore helpers ────────────────────────────────────────────
function userCol(colName) {
  return collection(db, "usuarios", currentUser.uid, colName);
}

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
    formulas = fSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    cocciones = cSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setSyncStatus("ok");
  } catch (e) {
    console.error(e);
    setSyncStatus("error");
  }
}

// ── Navigation ───────────────────────────────────────────────────
window.showTab = (tabId, btn) => {
  document.querySelectorAll(".section").forEach((s) => s.classList.remove("active"));
  document.querySelectorAll("nav button").forEach((b) => b.classList.remove("active"));
  document.getElementById("tab-" + tabId).classList.add("active");
  btn.classList.add("active");
  renderAll();
};

window.filterFormulas = (f, btn) => {
  currentFilter = f;
  document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  renderFormulas();
};

window.toggleExpand = (id) => {
  expanded = expanded === id ? null : id;
  renderAll();
};

// ── Render ───────────────────────────────────────────────────────
function renderAll() {
  renderFormulas();
  renderCocciones();
  renderResultados();
}

function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderFormulas() {
  const list = document.getElementById("formulas-list");
  const filtered =
    currentFilter === "all" ? formulas : formulas.filter((f) => f.tipo === currentFilter);

  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">🏺</div><p>Aún no hay fórmulas guardadas.<br>Toca <strong>+</strong> para añadir la primera.</p></div>`;
    return;
  }

  list.innerHTML = filtered
    .map(
      (f) => `
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
      <div class="card-detail ${expanded === "f" + f.id ? "open" : ""}">
        ${
          f.ingredients?.length
            ? `<div class="detail-label">Ingredientes</div>
               ${f.ingredients.map((i) => `<div class="ing-row"><span>${esc(i.material)}</span><span class="ing-pct">${esc(i.pct)}%</span></div>`).join("")}`
            : ""
        }
        ${f.notas ? `<div class="detail-label">Notas</div><p class="notes-text">${esc(f.notas)}</p>` : ""}
        ${f.resultado ? `<div class="detail-label">Valoración</div><div class="stars">${"⭐".repeat(f.resultado)}</div>` : ""}
        <div class="detail-label">Valorar resultado</div>
        <select onchange="setResultado('${f.id}', this.value)" onclick="event.stopPropagation()">
          <option value="">Seleccionar...</option>
          ${[5, 4, 3, 2, 1].map((n) => `<option value="${n}">${"⭐".repeat(n)} ${["", "Malo", "Regular", "Aceptable", "Muy bueno", "Excelente"][n]}</option>`).join("")}
        </select>
        <div style="margin-top:10px">
          <button class="btn-edit" onclick="editFormula('${f.id}', event)">✏️ Editar</button>
          <button class="btn-danger" onclick="deleteFormula('${f.id}', event)">Eliminar</button>
        </div>
      </div>
    </div>`
    )
    .join("");
}

function renderCocciones() {
  const list = document.getElementById("cocciones-list");
  if (cocciones.length === 0) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">🔥</div><p>Aún no hay cocciones registradas.<br>Toca <strong>+</strong> para añadir la primera.</p></div>`;
    return;
  }

  list.innerHTML = cocciones
    .map(
      (c) => `
    <div class="card" style="border-left:3px solid var(--verde)" onclick="toggleExpand('c${c.id}')">
      <div class="card-header">
        <div class="card-title" style="color:var(--verde)">${esc(c.nombre)}</div>
        <span class="tag tag-coccion">${esc(c.tipo) || "cocción"}</span>
      </div>
      <div class="card-meta">
        ${c.fecha ? `<span>📅 ${esc(c.fecha)}</span>` : ""}
        ${c.tempmax ? `<span>🌡️ ${esc(c.tempmax)}°C máx</span>` : ""}
        ${c.mant ? `<span>⏱️ ${esc(c.mant)} min</span>` : ""}
        ${c.horno ? `<span>🏭 ${esc(c.horno)}</span>` : ""}
      </div>
      <div class="card-detail ${expanded === "c" + c.id ? "open" : ""}">
        ${
          c.curva?.length
            ? `<div class="detail-label">Curva de temperatura</div>
               <div class="curva-scroll">
                 ${c.curva.map((s) => `<div class="curva-step"><div class="curva-temp">${esc(s.desde)}→${esc(s.hasta)}°</div><div class="curva-rate">${esc(s.ritmo)}°/h</div></div>`).join("")}
               </div>`
            : ""
        }
        ${c.notas ? `<div class="detail-label">Notas</div><p class="notes-text">${esc(c.notas)}</p>` : ""}
        <div style="margin-top:10px">
          <button class="btn-edit" onclick="editCoccion('${c.id}', event)">✏️ Editar</button>
          <button class="btn-danger" onclick="deleteCoccion('${c.id}', event)">Eliminar</button>
        </div>
      </div>
    </div>`
    )
    .join("");
}

function renderResultados() {
  const list = document.getElementById("resultados-list");
  const con = formulas
    .filter((f) => f.resultado)
    .sort((a, b) => b.resultado - a.resultado);

  if (con.length === 0) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">📊</div><p>Valora tus fórmulas desde la pestaña <strong>Fórmulas</strong> para ver el ranking aquí.</p></div>`;
    return;
  }

  list.innerHTML = con
    .map(
      (f, i) => `
    <div class="rank-card" style="border-left:3px solid ${i === 0 ? "var(--dorado)" : i === 1 ? "var(--arcilla)" : "var(--hueso)"}">
      <div>
        <div class="rank-num">#${i + 1} · <span class="tag tag-${f.tipo}" style="font-size:9px">${f.tipo}</span></div>
        <div style="font-family:'Playfair Display',serif;font-size:14px;color:var(--tierra);margin-top:3px">${esc(f.nombre)}</div>
        ${f.color ? `<div style="font-size:11px;color:var(--gris);margin-top:2px">🎨 ${esc(f.color)}</div>` : ""}
      </div>
      <div class="stars">${"⭐".repeat(f.resultado)}</div>
    </div>`
    )
    .join("");
}

// ── Actions ──────────────────────────────────────────────────────
window.setResultado = async (id, val) => {
  if (!val) return;
  setSyncStatus("syncing");
  await updateDoc(doc(db, "usuarios", currentUser.uid, "formulas", id), {
    resultado: parseInt(val),
  });
  formulas = formulas.map((f) => (f.id === id ? { ...f, resultado: parseInt(val) } : f));
  setSyncStatus("ok");
  renderAll();
};

window.deleteFormula = async (id, e) => {
  e.stopPropagation();
  if (!confirm("¿Eliminar esta fórmula?")) return;
  setSyncStatus("syncing");
  await deleteDoc(doc(db, "usuarios", currentUser.uid, "formulas", id));
  formulas = formulas.filter((f) => f.id !== id);
  expanded = null;
  setSyncStatus("ok");
  renderAll();
};

window.deleteCoccion = async (id, e) => {
  e.stopPropagation();
  if (!confirm("¿Eliminar esta cocción?")) return;
  setSyncStatus("syncing");
  await deleteDoc(doc(db, "usuarios", currentUser.uid, "cocciones", id));
  cocciones = cocciones.filter((c) => c.id !== id);
  expanded = null;
  setSyncStatus("ok");
  renderAll();
};

// ── Edit ─────────────────────────────────────────────────────────
window.editFormula = (id, e) => {
  e.stopPropagation();
  const f = formulas.find((x) => x.id === id);
  if (!f) return;
  editingId = id;
  openModal(f.tipo);
  document.getElementById("f-nombre").value = f.nombre || "";
  document.getElementById("f-color").value = f.color || "";
  document.getElementById("f-temp").value = f.temp || "";
  document.getElementById("f-metodo").value = f.metodo || "";
  document.getElementById("f-notas").value = f.notas || "";
  document.getElementById("ing-container").innerHTML = "";
  (f.ingredients || []).forEach((i) => {
    addIngredient(i.material, i.pct);
  });
  document.getElementById("modal-title").textContent = "Editar fórmula";
};

window.editCoccion = (id, e) => {
  e.stopPropagation();
  const c = cocciones.find((x) => x.id === id);
  if (!c) return;
  editingId = id;
  openModal("coccion");
  document.getElementById("c-nombre").value = c.nombre || "";
  document.getElementById("c-tipo").value = c.tipo || "";
  document.getElementById("c-tempmax").value = c.tempmax || "";
  document.getElementById("c-mant").value = c.mant || "";
  document.getElementById("c-horno").value = c.horno || "";
  document.getElementById("c-notas").value = c.notas || "";
  document.getElementById("curva-container").innerHTML = "";
  (c.curva || []).forEach((s) => addCurvaStep(s.desde, s.hasta, s.ritmo));
  document.getElementById("modal-title").textContent = "Editar cocción";
};

// ── Modal ────────────────────────────────────────────────────────
window.openModal = (type = null) => {
  if (!type) {
    editingId = null;
    currentType = null;
    document.querySelectorAll(".type-btn").forEach((b) => (b.className = "type-btn"));
    document.getElementById("form-mezcla").classList.remove("active");
    document.getElementById("form-coccion").classList.remove("active");
    document.getElementById("btn-save").style.display = "none";
    document.getElementById("modal-title").textContent = "Nueva entrada";
    clearForms();
  } else {
    selectType(type);
  }
  document.getElementById("modal").classList.add("open");
};

window.closeModal = () => {
  document.getElementById("modal").classList.remove("open");
  editingId = null;
};

window.handleModalClick = (e) => {
  if (e.target === document.getElementById("modal")) closeModal();
};

window.selectType = (type) => {
  currentType = type;
  document.querySelectorAll(".type-btn").forEach((b) => (b.className = "type-btn"));
  document.getElementById("tbtn-" + type).classList.add("sel-" + type);
  document.getElementById("form-mezcla").classList.toggle("active", type === "engobe" || type === "esmalte");
  document.getElementById("form-coccion").classList.toggle("active", type === "coccion");
  document.getElementById("btn-save").style.display = "block";

  if ((type === "engobe" || type === "esmalte") && document.getElementById("ing-container").children.length === 0) {
    addIngredient();
  }
  if (type === "coccion" && document.getElementById("curva-container").children.length === 0) {
    addCurvaStep(); addCurvaStep(); addCurvaStep();
  }
};

function clearForms() {
  ["f-nombre", "f-color", "f-temp", "f-notas", "c-nombre", "c-tempmax", "c-mant", "c-notas"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  ["f-metodo", "c-tipo", "c-horno"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("ing-container").innerHTML = "";
  document.getElementById("curva-container").innerHTML = "";
}

window.addIngredient = (material = "", pct = "") => {
  const row = document.createElement("div");
  row.className = "ing-builder-row";
  row.innerHTML = `
    <input type="text" placeholder="Material" value="${esc(material)}">
    <input type="number" placeholder="%" min="0" max="100" value="${esc(pct)}">
    <button class="btn-remove-ing" onclick="this.parentElement.remove()">×</button>
  `;
  document.getElementById("ing-container").appendChild(row);
};

window.addCurvaStep = (desde = "", hasta = "", ritmo = "") => {
  const row = document.createElement("div");
  row.className = "curva-builder-row";
  row.innerHTML = `
    <input type="number" placeholder="20" value="${esc(desde)}">
    <input type="number" placeholder="600" value="${esc(hasta)}">
    <input type="number" placeholder="60" value="${esc(ritmo)}">
  `;
  document.getElementById("curva-container").appendChild(row);
};

window.saveEntry = async () => {
  if (!currentType) return alert("Selecciona el tipo de entrada");
  setSyncStatus("syncing");

  if (currentType === "engobe" || currentType === "esmalte") {
    const nombre = document.getElementById("f-nombre").value.trim();
    if (!nombre) { setSyncStatus("ok"); return alert("Añade un nombre"); }

    const ings = [];
    document.querySelectorAll("#ing-container .ing-builder-row").forEach((row) => {
      const inputs = row.querySelectorAll("input");
      if (inputs[0].value.trim()) ings.push({ material: inputs[0].value.trim(), pct: inputs[1].value || "?" });
    });

    const data = {
      nombre,
      tipo: currentType,
      color: document.getElementById("f-color").value,
      temp: document.getElementById("f-temp").value,
      metodo: document.getElementById("f-metodo").value,
      notas: document.getElementById("f-notas").value,
      ingredients: ings,
      fecha: new Date().toLocaleDateString("es-ES"),
      createdAt: editingId ? (formulas.find(f => f.id === editingId)?.createdAt || Date.now()) : Date.now(),
    };

    if (editingId) {
      await updateDoc(doc(db, "usuarios", currentUser.uid, "formulas", editingId), data);
      formulas = formulas.map((f) => (f.id === editingId ? { ...f, ...data } : f));
    } else {
      const ref = await addDoc(userCol("formulas"), data);
      formulas = [{ id: ref.id, ...data }, ...formulas];
    }
  } else {
    const nombre = document.getElementById("c-nombre").value.trim();
    if (!nombre) { setSyncStatus("ok"); return alert("Añade un nombre"); }

    const curva = [];
    document.querySelectorAll("#curva-container .curva-builder-row").forEach((row) => {
      const inputs = row.querySelectorAll("input");
      if (inputs[0].value || inputs[1].value) curva.push({ desde: inputs[0].value, hasta: inputs[1].value, ritmo: inputs[2].value });
    });

    const data = {
      nombre,
      tipo: document.getElementById("c-tipo").value,
      tempmax: document.getElementById("c-tempmax").value,
      mant: document.getElementById("c-mant").value,
      horno: document.getElementById("c-horno").value,
      notas: document.getElementById("c-notas").value,
      curva,
      fecha: new Date().toLocaleDateString("es-ES"),
      createdAt: editingId ? (cocciones.find(c => c.id === editingId)?.createdAt || Date.now()) : Date.now(),
    };

    if (editingId) {
      await updateDoc(doc(db, "usuarios", currentUser.uid, "cocciones", editingId), data);
      cocciones = cocciones.map((c) => (c.id === editingId ? { ...c, ...data } : c));
    } else {
      const ref = await addDoc(userCol("cocciones"), data);
      cocciones = [{ id: ref.id, ...data }, ...cocciones];
    }
  }

  setSyncStatus("ok");
  closeModal();
  renderAll();
};

// ── Service Worker ───────────────────────────────────────────────
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
