import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, limit, serverTimestamp, enableIndexedDbPersistence, runTransaction } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const $ = id => document.getElementById(id);
const status = $("status");
let app, auth, db, materials = [], movements = [], unsubM, unsubH;
let selectedContainer = "", containerView = false, activeScreen = "home", historyVisible = false;
const sectionIds = ["logout-section","search-section","containers-section","form-section","materials-section","movements-section","backup-section"];
const val = id => $(id).value.trim();

function show(id) {
  ["auth","pin","app"].forEach(x => $(x).classList.toggle("hidden", x !== id));
  $("bottom-nav").style.display = id === "app" ? "grid" : "none";
}
function setScreen(screen) {
  activeScreen = screen;
  containerView = false; historyVisible = false; selectedContainer = "";
  $("containerToolbar")?.remove();
  $("materials-title").textContent = "Materiali";
  const visible = {
    home: ["logout-section","search-section","containers-section"],
    materials: ["logout-section","search-section","form-section","materials-section"],
    history: ["logout-section","movements-section"],
    backup: ["logout-section","backup-section"]
  }[screen] || ["logout-section","search-section","containers-section"];
  sectionIds.forEach(id => $(id).classList.toggle("hidden", !visible.includes(id)));
  $("bottom-nav").querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.go === screen));
  render();
  window.scrollTo({top:0,behavior:"smooth"});
}
function showContainer(container) {
  selectedContainer = container; containerView = true; historyVisible = false;
  $("search").value = "";
  sectionIds.forEach(id => $(id).classList.add("hidden"));
  $("logout-section").classList.remove("hidden");
  $("materials-section").classList.remove("hidden");
  $("materials-title").textContent = "Container " + container;
  let toolbar = $("containerToolbar");
  if (!toolbar) {
    toolbar = document.createElement("div"); toolbar.id = "containerToolbar";
    const back = document.createElement("button");
    back.className = "container-back"; back.textContent = "← TORNA AI CONTAINER";
    back.onclick = () => setScreen("home");
    const add = document.createElement("button");
    add.className = "container-action add"; add.textContent = "＋ AGGIUNGI MATERIALE";
    add.onclick = () => {
      clearForm(); $("container").value = selectedContainer;
      $("formtitle").textContent = "Aggiungi materiale";
      $("form-section").classList.remove("hidden");
      $("form-section").scrollIntoView({behavior:"smooth",block:"start"});
    };
    const history = document.createElement("button");
    history.className = "container-action history"; history.textContent = "STORICO MOVIMENTI";
    history.onclick = () => {
      historyVisible = !historyVisible;
      $("movements-section").classList.toggle("hidden", !historyVisible);
      if (historyVisible) $("movements-section").scrollIntoView({behavior:"smooth",block:"start"});
    };
    toolbar.append(back,add,history);
    $("materials-section").insertBefore(toolbar,$("materials"));
  }
  render();
  $("materials-section").scrollIntoView({behavior:"smooth",block:"start"});
}
function startPin() {
  const saved = localStorage.getItem("magazzino_pin_v1");
  $("pin2").classList.toggle("hidden", !!saved);
  $("pintitle").textContent = saved ? "Inserisci il PIN" : "Crea il PIN del magazzino";
  $("pinhelp").textContent = saved ? "Inserisci il PIN di 6 cifre per aprire il magazzino." : "Scegli un PIN di 6 cifre. Sarà memorizzato solo su questo dispositivo.";
  $("pinmsg").textContent = ""; $("pin1").value = ""; $("pin2").value = "";
  show("pin");
}
function openApp() { show("app"); setScreen("home"); listen(); }
const configured = firebaseConfig && firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("INSERISCI");
if (!configured) {
  status.textContent = "Configura prima firebase-config.js";
  $("authmsg").textContent = "Il file firebase-config.js contiene ancora i valori segnaposto.";
} else {
  app = initializeApp(firebaseConfig); auth = getAuth(app); db = getFirestore(app);
  enableIndexedDbPersistence(db).catch(() => {});
  onAuthStateChanged(auth, user => {
    if (user) { status.textContent = "Collegato a Firebase"; startPin(); }
    else { status.textContent = "Non collegato"; show("auth"); }
  });
}
$("login").onclick = async () => {
  try { await signInWithEmailAndPassword(auth,$("email").value.trim(),$("password").value); $("authmsg").textContent = "Accesso riuscito."; }
  catch { $("authmsg").textContent = "Accesso non riuscito: controlla email e password."; }
};
$("pinbtn").onclick = () => {
  const a = $("pin1").value, b = $("pin2").value, saved = localStorage.getItem("magazzino_pin_v1");
  if (!/^\d{6}$/.test(a)) { $("pinmsg").textContent = "Il PIN deve contenere esattamente 6 cifre."; return; }
  if (saved) { if (a !== saved) { $("pinmsg").textContent = "PIN non corretto."; return; } }
  else { if (a !== b) { $("pinmsg").textContent = "I due PIN non coincidono."; return; } localStorage.setItem("magazzino_pin_v1",a); }
  openApp();
};
function listen() {
  if (unsubM) unsubM(); if (unsubH) unsubH();
  unsubM = onSnapshot(collection(db,"materials"), snap => { materials = snap.docs.map(d => ({id:d.id,...d.data()})); render(); }, e => status.textContent = "Errore materiali: " + e.message);
  unsubH = onSnapshot(query(collection(db,"movements"),orderBy("createdAt","desc"),limit(50)), snap => { movements = snap.docs.map(d => ({id:d.id,...d.data()})); renderMovements(); }, e => status.textContent = "Errore storico: " + e.message);
}
$("save").onclick = async () => {
  if (!val("name")) { alert("Inserisci il nome del materiale."); return; }
  const quantity = Number(val("qty") || 0);
  if (!Number.isFinite(quantity) || quantity < 0) { alert("Inserisci una quantità valida e non negativa."); return; }
  const data = {name:val("name"),code:val("code"),quantity,unit:val("unit"),container:val("container"),zone:val("zone"),box:val("box"),shelf:val("shelf"),rack:val("rack"),notes:val("notes"),updatedAt:serverTimestamp()};
  try {
    const id = val("docid");
    if (id) await updateDoc(doc(db,"materials",id),data);
    else { data.createdAt = serverTimestamp(); await addDoc(collection(db,"materials"),data); }
    clearForm();
    if (containerView) $("form-section").classList.add("hidden");
    else setScreen("materials");
  } catch(e) { alert("Salvataggio non riuscito: " + e.message); }
};
function clearForm() {
  ["docid","name","code","qty","unit","zone","box","shelf","rack","notes"].forEach(id => $(id).value = "");
  $("formtitle").textContent = "Aggiungi materiale"; $("cancel").classList.add("hidden");
}
$("cancel").onclick = clearForm;
function edit(m) {
  $("docid").value = m.id;
  ["name","code","qty","unit","container","zone","box","shelf","rack","notes"].forEach(k => $(k).value = m[k] ?? "");
  $("formtitle").textContent = "Modifica materiale"; $("cancel").classList.remove("hidden");
  $("form-section").classList.remove("hidden");
  $("form-section").scrollIntoView({behavior:"smooth",block:"start"});
}
async function move(m,delta) {
  const answer = prompt("Quantità da " + (delta > 0 ? "caricare" : "scaricare") + ":");
  if (answer === null) return;
  const amount = Number(answer.replace(",","."));
  if (!Number.isFinite(amount) || amount <= 0) { alert("Inserisci una quantità valida."); return; }
  if (delta < 0 && amount > Number(m.quantity || 0)) { alert("Quantità insufficiente. Disponibili: " + m.quantity); return; }
  try {
    const materialRef = doc(db,"materials",m.id), movementRef = doc(collection(db,"movements"));
    await runTransaction(db,async tx => {
      const snap = await tx.get(materialRef);
      if (!snap.exists()) throw new Error("Materiale non trovato.");
      const current = snap.data(), actual = Number(current.quantity || 0), next = actual + delta * amount;
      if (next < 0) throw new Error("Quantità insufficiente.");
      tx.update(materialRef,{quantity:next,updatedAt:serverTimestamp()});
      tx.set(movementRef,{materialId:m.id,name:current.name || m.name,code:current.code || "",type:delta > 0 ? "Carico" : "Scarico",amount,unit:current.unit || "",container:current.container || "",createdAt:serverTimestamp()});
    });
    status.textContent = (delta > 0 ? "Carico" : "Scarico") + " registrato correttamente.";
  } catch(e) { alert("Movimento non riuscito: " + e.message); }
}
async function remove(m) {
  if (!confirm("Eliminare " + m.name + "?")) return;
  try { await deleteDoc(doc(db,"materials",m.id)); } catch(e) { alert("Eliminazione non riuscita: " + e.message); }
}
function matchesTerm(m,term) {
  return [m.name,m.code,m.container,m.zone,m.box,m.shelf,m.rack,m.notes,m.unit].join(" ").toLocaleLowerCase("it").includes(term);
}
function render() {
  const term = val("search").toLocaleLowerCase("it");
  const list = materials.filter(m => (!selectedContainer || m.container === selectedContainer) && (!term || matchesTerm(m,term)));
  $("materials").innerHTML = list.length ? list.map(m => `<div class="item"><b>${esc(m.name)}</b> <span class="pill">${esc(m.container || "")}</span><div>${esc(m.code || "")} · ${Number(m.quantity || 0)} ${esc(m.unit || "")}</div><div class="muted">Zona ${esc(m.zone || "—")} · Scatola ${esc(m.box || "—")} · Scaffale ${esc(m.shelf || "—")} · Ripiano ${esc(m.rack || "—")}</div>${m.notes ? `<div class="muted">Note: ${esc(m.notes)}</div>` : ""}<div class="row"><button data-act="in" data-id="${esc(m.id)}">CARICO</button><button data-act="out" data-id="${esc(m.id)}">SCARICO</button><button data-act="edit" data-id="${esc(m.id)}">MODIFICA</button><button data-act="del" data-id="${esc(m.id)}">ELIMINA</button></div></div>`).join("") : "Nessun materiale trovato.";
  $("resultcount").textContent = `${list.length} material${list.length === 1 ? "e" : "i"} visualizzati`;
  $("containers").innerHTML = Array.from({length:8},(_,i) => {
    const c = "C" + String(i+1).padStart(2,"0"), count = materials.filter(m => m.container === c).length;
    const found = term ? materials.filter(m => m.container === c && matchesTerm(m,term)).length : 0;
    return `<div class="container-card" data-container="${c}" role="button" tabindex="0" aria-label="Apri il container ${c}"><div class="container-art" aria-hidden="true"></div><b>${c}</b>${found ? `<div class="found-label">TROVATO · ${found}</div>` : ""}<div>${count} material${count === 1 ? "e" : "i"}</div><button type="button" data-container="${c}">APRI</button></div>`;
  }).join("");
}
function renderMovements() {
  $("movements").innerHTML = movements.length ? movements.map(m => `<div class="item">${esc(m.type || "Movimento")} · ${esc(m.name || "")} · ${m.amount ?? ""} ${esc(m.unit || "")}<div class="muted">${esc(m.container || "")}</div></div>`).join("") : "Nessun movimento registrato.";
}
$("materials").onclick = e => {
  const b = e.target.closest("button[data-act]"); if (!b) return;
  const m = materials.find(x => x.id === b.dataset.id); if (!m) return;
  ({in:() => move(m,1),out:() => move(m,-1),edit:() => edit(m),del:() => remove(m)})[b.dataset.act]?.();
};
$("containers").onclick = e => { const card = e.target.closest("[data-container]"); if (card) showContainer(card.dataset.container); };
$("containers").onkeydown = e => { if (e.key !== "Enter" && e.key !== " ") return; const card = e.target.closest(".container-card"); if (card) { e.preventDefault(); showContainer(card.dataset.container); } };
function runSearch() {
  // Mostra la schermata Materiali e i risultati anche quando la ricerca parte dalla HOME.
  setScreen("materials");
  $("materials-section").scrollIntoView({behavior:"smooth",block:"start"});
}
$("searchBtn").onclick = runSearch;
$("search").addEventListener("keydown",e => { if (e.key === "Enter") runSearch(); });
$("search").oninput = render;
$("clearSearch").onclick = () => { $("search").value = ""; selectedContainer = ""; render(); };
$("bottom-nav").onclick = e => { const b = e.target.closest("button[data-go]"); if (b) setScreen(b.dataset.go); };
$("logout").onclick = () => {
  if (confirm("Bloccare il magazzino su questo dispositivo?")) {
    show("pin"); $("pin1").value = ""; $("pinmsg").textContent = "Inserisci il PIN per rientrare.";
    $("pin2").classList.add("hidden"); $("pintitle").textContent = "Inserisci il PIN";
  }
};
$("export").onclick = () => {
  const blob = new Blob([JSON.stringify({materials,movements,exportedAt:new Date().toISOString()},null,2)],{type:"application/json"});
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = "backup-magazzino.json"; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
};
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g,c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
