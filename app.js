import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  enableIndexedDbPersistence,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

const $ = id => document.getElementById(id);
const status = $("status");

const extraStyle = document.createElement("style");

extraStyle.textContent = `
  .hidden { display:none !important; }

  .container-card {
    min-height:185px;
    padding:14px 10px;
    border:2px solid #354526;
    border-radius:15px;
    background:linear-gradient(145deg,#78834c,#45552f 65%,#303d25);
    color:white;
    text-align:center;
    cursor:pointer;
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    gap:9px;
    box-shadow:0 7px 0 #26331e, 0 11px 18px rgba(0,0,0,.22);
    transition:transform .15s, box-shadow .15s;
  }

  .container-card:active {
    transform:translateY(4px);
    box-shadow:0 3px 0 #26331e, 0 6px 10px rgba(0,0,0,.2);
  }

  .container-card b {
    font-size:22px;
    color:#fff;
    letter-spacing:2px;
  }

  .container-card > div:not(.container-art) {
    color:#f3f4e9;
  }

  .container-art {
    position:relative;
    width:100%;
    max-width:155px;
    height:72px;
    border:2px solid #27351f;
    border-radius:4px;
    overflow:hidden;
    background:repeating-linear-gradient(
      90deg,
      #78864b 0px,
      #78864b 5px,
      #56683a 6px,
      #87935a 8px,
      #465832 10px
    );
    box-shadow:
      inset 0 5px 8px rgba(255,255,255,.22),
      inset 0 -7px 9px rgba(0,0,0,.25),
      4px 5px 0 #26331e;
    transform:perspective(260px) rotateY(-9deg);
  }

  .container-art:before {
    content:"";
    position:absolute;
    inset:0;
    background:repeating-linear-gradient(
      90deg,
      transparent 0 17px,
      rgba(25,35,20,.35) 18px,
      rgba(255,255,255,.18) 20px,
      transparent 22px
    );
  }

  .container-art:after {
    content:"";
    position:absolute;
    top:5px;
    right:7px;
    bottom:5px;
    width:20%;
    border-left:3px solid rgba(31,43,25,.65);
    border-right:3px solid rgba(31,43,25,.65);
    background:repeating-linear-gradient(
      90deg,
      rgba(30,42,24,.25) 0 3px,
      transparent 3px 7px
    );
  }

  .container-card .found-label {
    color:#fff4b8;
    font-weight:800;
    font-size:13px;
  }

  .container-card button {
    width:100%;
    min-height:40px;
    background:#e8eadb;
    color:#344326;
    border:1px solid #c5c9ae;
  }

  .container-card.active {
    outline:3px solid #c4d18a;
  }

  .row {
    display:flex;
    flex-wrap:wrap;
    gap:8px;
    margin-top:12px;
  }

  .row button {
    flex:1;
    min-width:100px;
  }

  .row button[data-act="in"] {
    background:#168653;
    color:white;
  }

  .row button[data-act="out"] {
    background:#c83d48;
    color:white;
  }

  .row button[data-act="edit"] {
    background:#e8eef5;
    color:#123b68;
  }

  .row button[data-act="del"] {
    background:#7c2630;
    color:white;
  }

  .pill {
    display:inline-block;
    background:#e8eadb;
    color:#45552f;
    padding:4px 8px;
    border-radius:20px;
    margin-left:6px;
  }

  .muted {
    color:#65758a;
    font-size:14px;
    margin-top:6px;
  }

  .container-back,
  .container-action {
    width:100%;
    margin-bottom:10px;
    min-height:43px;
    border-radius:9px;
    font-weight:700;
  }

  .container-back {
    background:#e8eadb;
    color:#354526;
  }

  .container-action.add {
    background:#168653;
    color:white;
  }

  .container-action.history {
    background:#1d5b96;
    color:white;
  }

  .container-heading {
    font-size:22px;
    font-weight:700;
    color:#45552f;
    margin:8px 0;
  }

  button:focus-visible,
  .container-card:focus-visible {
    outline:3px solid #e5b942;
    outline-offset:3px;
  }

  @media(max-width:380px) {
    .container-card { min-height:165px; }
    .container-art { height:60px; }
  }
`;

document.head.appendChild(extraStyle);

let app;
let auth;
let db;

let materials = [];
let movements = [];

let unsubM;
let unsubH;

let selectedContainer = "";
let containerView = false;
let historyVisible = false;

const show = id => {
  ["auth", "pin", "app"].forEach(x => {
    const element = $(x);
    if (element) {
      element.classList.toggle("hidden", x !== id);
    }
  });
};

show("auth");

const configured =
  firebaseConfig &&
  firebaseConfig.apiKey &&
  !firebaseConfig.apiKey.startsWith("INSERISCI");

if (!configured) {
  status.textContent = "Configura prima firebase-config.js";

  $("authmsg").textContent =
    "Il file firebase-config.js contiene ancora i valori segnaposto.";
} else {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  enableIndexedDbPersistence(db).catch(() => {});

  onAuthStateChanged(auth, user => {
    if (user) {
      status.textContent = "Collegato a Firebase";
      startPin();
    } else {
      status.textContent = "Non collegato";
      show("auth");
    }
  });
}

/* ACCESSO */

$("login").onclick = async () => {
  try {
    await signInWithEmailAndPassword(
      auth,
      $("email").value.trim(),
      $("password").value
    );

    $("authmsg").textContent = "Accesso riuscito.";
  } catch (e) {
    $("authmsg").textContent =
      "Accesso non riuscito: controlla email e password.";
  }
};

/* PIN */

function startPin() {
  const saved = localStorage.getItem("magazzino_pin_v1");

  $("pin2").classList.toggle("hidden", !!saved);

  $("pintitle").textContent = saved
    ? "Inserisci il PIN"
    : "Crea il PIN del magazzino";

  $("pinhelp").textContent = saved
    ? "Inserisci il PIN di 6 cifre per aprire il magazzino."
    : "Scegli un PIN di 6 cifre. Sarà memorizzato solo su questo dispositivo.";

  $("pinmsg").textContent = "";
  $("pin1").value = "";
  $("pin2").value = "";

  show("pin");
}

$("pinbtn").onclick = () => {
  const a = $("pin1").value;
  const b = $("pin2").value;
  const saved = localStorage.getItem("magazzino_pin_v1");

  if (!/^\d{6}$/.test(a)) {
    $("pinmsg").textContent =
      "Il PIN deve contenere esattamente 6 cifre.";
    return;
  }

  if (saved) {
    if (a !== saved) {
      $("pinmsg").textContent = "PIN non corretto.";
      return;
    }
  } else {
    if (a !== b) {
      $("pinmsg").textContent = "I due PIN non coincidono.";
      return;
    }

    localStorage.setItem("magazzino_pin_v1", a);
  }

  openApp();
};

function openApp() {
  show("app");
  listen();
  render();
}

/* DATI FIREBASE */

function listen() {
  if (unsubM) unsubM();
  if (unsubH) unsubH();

  unsubM = onSnapshot(
    collection(db, "materials"),
    snapshot => {
      materials = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      render();
    },
    error => {
      status.textContent =
        "Errore materiali: " + error.message;
    }
  );

  const movementsQuery = query(
    collection(db, "movements"),
    orderBy("createdAt", "desc"),
    limit(50)
  );

  unsubH = onSnapshot(
    movementsQuery,
    snapshot => {
      movements = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      renderMovements();
    },
    error => {
      status.textContent =
        "Errore storico: " + error.message;
    }
  );
}

const val = id => $(id).value.trim();

/* SALVATAGGIO MATERIALE */

$("save").onclick = async () => {
  if (!val("name")) {
    alert("Inserisci il nome del materiale.");
    return;
  }

  const quantity = Number(val("qty") || 0);

  if (!Number.isFinite(quantity) || quantity < 0) {
    alert("Inserisci una quantità valida e non negativa.");
    return;
  }

  const data = {
    name: val("name"),
    code: val("code"),
    quantity,
    unit: val("unit"),
    container: val("container"),
    zone: val("zone"),
    box: val("box"),
    shelf: val("shelf"),
    rack: val("rack"),
    notes: val("notes"),
    updatedAt: serverTimestamp()
  };

  try {
    const id = val("docid");

    if (id) {
      await updateDoc(doc(db, "materials", id), data);
    } else {
      data.createdAt = serverTimestamp();

      await addDoc(
        collection(db, "materials"),
        data
      );
    }

    clearForm();

    if (containerView) {
      $("formtitle").parentElement.classList.add("hidden");
    }
  } catch (e) {
    alert("Salvataggio non riuscito: " + e.message);
  }
};

function clearForm() {
  [
    "docid",
    "name",
    "code",
    "qty",
    "unit",
    "zone",
    "box",
    "shelf",
    "rack",
    "notes"
  ].forEach(id => {
    $(id).value = "";
  });

  $("formtitle").textContent = "Aggiungi materiale";
  $("cancel").classList.add("hidden");
}

$("cancel").onclick = clearForm;

/* MODIFICA MATERIALE */

function edit(m) {
  $("docid").value = m.id;

  [
    "name",
    "code",
    "qty",
    "unit",
    "container",
    "zone",
    "box",
    "shelf",
    "rack",
    "notes"
  ].forEach(key => {
    $(key).value = m[key] ?? "";
  });

  $("formtitle").textContent = "Modifica materiale";
  $("cancel").classList.remove("hidden");

  $("formtitle").parentElement.classList.remove("hidden");

  $("formtitle").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

/* CARICO E SCARICO */

async function move(m, delta) {
  const action = delta > 0 ? "caricare" : "scaricare";

  const answer = prompt(
    "Quantità da " + action + ":"
  );

  if (answer === null) return;

  const amount = Number(answer.replace(",", "."));

  if (!Number.isFinite(amount) || amount <= 0) {
    alert("Inserisci una quantità valida.");
    return;
  }

  const currentQuantity = Number(m.quantity || 0);

  if (delta < 0 && amount > currentQuantity) {
    alert("Quantità insufficiente. Disponibili: " + currentQuantity);
    return;
  }

  try {
    const materialRef = doc(db, "materials", m.id);
    const movementRef = doc(collection(db, "movements"));

    await runTransaction(db, async transaction => {
      const materialSnapshot =
        await transaction.get(materialRef);

      if (!materialSnapshot.exists()) {
        throw new Error("Materiale non trovato.");
      }

      const current = materialSnapshot.data();
      const actualQuantity = Number(current.quantity || 0);
      const newQuantity = actualQuantity + delta * amount;

      if (newQuantity < 0) {
        throw new Error("Quantità insufficiente.");
      }

      transaction.update(materialRef, {
        quantity: newQuantity,
        updatedAt: serverTimestamp()
      });

      transaction.set(movementRef, {
        materialId: m.id,
        name: current.name || m.name,
        code: current.code || "",
        type: delta > 0 ? "Carico" : "Scarico",
        amount,
        unit: current.unit || "",
        container: current.container || "",
        createdAt: serverTimestamp()
      });
    });

    status.textContent =
      (delta > 0 ? "Carico" : "Scarico") +
      " registrato correttamente.";
  } catch (e) {
    alert("Movimento non riuscito: " + e.message);
  }
}

/* ELIMINAZIONE */

async function remove(m) {
  if (!confirm("Eliminare " + m.name + "?")) return;

  try {
    await deleteDoc(doc(db, "materials", m.id));
  } catch (e) {
    alert("Eliminazione non riuscita: " + e.message);
  }
}

/* RICERCA */

function matchesTerm(m, term) {
  const searchable = [
    m.name,
    m.code,
    m.container,
    m.zone,
    m.box,
    m.shelf,
    m.rack,
    m.notes,
    m.unit
  ].join(" ").toLocaleLowerCase("it");

  return searchable.includes(term);
}

/* VISUALIZZAZIONE MATERIALI E CONTAINER */

function render() {
  const term = val("search").toLocaleLowerCase("it");

  const list = materials.filter(m => {
    const matchesContainer =
      !selectedContainer || m.container === selectedContainer;

    return matchesContainer &&
      (!term || matchesTerm(m, term));
  });

  $("materials").innerHTML = list.length
    ? list.map(m => `
      <div class="item">
        <b>${esc(m.name)}</b>
        <span class="pill">${esc(m.container || "")}</span>

        <div>
          ${esc(m.code || "")} ·
          ${Number(m.quantity || 0)}
          ${esc(m.unit || "")}
        </div>

        <div class="muted">
          Zona ${esc(m.zone || "—")} ·
          Scatola ${esc(m.box || "—")} ·
          Scaffale ${esc(m.shelf || "—")} ·
          Ripiano ${esc(m.rack || "—")}
        </div>

        ${
          m.notes
            ? `<div class="muted">Note: ${esc(m.notes)}</div>`
            : ""
        }

        <div class="row">
          <button data-act="in" data-id="${esc(m.id)}">
            CARICO
          </button>

          <button data-act="out" data-id="${esc(m.id)}">
            SCARICO
          </button>

          <button data-act="edit" data-id="${esc(m.id)}">
            MODIFICA
          </button>

          <button data-act="del" data-id="${esc(m.id)}">
            ELIMINA
          </button>
        </div>
      </div>
    `).join("")
    : "Nessun materiale trovato.";

  $("resultcount").textContent =
    `${list.length} material${list.length === 1 ? "e" : "i"} visualizzati`;

  $("containers").innerHTML = Array.from(
    { length: 8 },
    (_, i) => {
      const container =
        "C" + String(i + 1).padStart(2, "0");

      const count = materials.filter(
        m => m.container === container
      ).length;

      const foundCount = term
        ? materials.filter(
            m =>
              m.container === container &&
              matchesTerm(m, term)
          ).length
        : 0;

      const active =
        selectedContainer === container ? " active" : "";

      return `
        <div
          class="container-card${active}"
          data-container="${container}"
          role="button"
          tabindex="0"
          aria-label="Apri il container ${container}"
        >
          <div class="container-art" aria-hidden="true"></div>

          <b>${container}</b>

          ${
            foundCount > 0
              ? `<div class="found-label">TROVATO · ${foundCount}</div>`
              : ""
          }

          <div>
            ${count} material${count === 1 ? "e" : "i"}
          </div>

          <button type="button" data-container="${container}">
            APRI
          </button>
        </div>
      `;
    }
  ).join("");
}

/* APERTURA CONTAINER */

function openContainer(container) {
  selectedContainer = container;
  containerView = true;
  historyVisible = false;

  $("search").value = "";

  const searchSection = $("search").parentElement;
  const containersSection = $("containers").parentElement;
  const materialsSection = $("materials").parentElement;
  const formSection = $("formtitle").parentElement;
  const movementsSection = $("movements").parentElement;
  const backupSection = $("export").parentElement;

  searchSection.classList.add("hidden");
  containersSection.classList.add("hidden");
  formSection.classList.add("hidden");
  movementsSection.classList.add("hidden");
  backupSection.classList.add("hidden");

  let toolbar = $("containerToolbar");

  if (!toolbar) {
    toolbar = document.createElement("div");
    toolbar.id = "containerToolbar";

    const back = document.createElement("button");
    back.className = "container-back";
    back.textContent = "← TORNA AI CONTAINER";
    back.onclick = closeContainer;

    const add = document.createElement("button");
    add.className = "container-action add";
    add.textContent = "＋ AGGIUNGI MATERIALE";

    add.onclick = () => {
      $("container").value = selectedContainer;
      $("formtitle").textContent = "Aggiungi materiale";
      $("docid").value = "";

      clearForm();

      $("container").value = selectedContainer;

      formSection.classList.remove("hidden");

      formSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    };

    const history = document.createElement("button");
    history.className = "container-action history";
    history.textContent = "STORICO MOVIMENTI";

    history.onclick = () => {
      historyVisible = !historyVisible;

      movementsSection.classList.toggle(
        "hidden",
        !historyVisible
      );

      if (historyVisible) {
        movementsSection.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
    };

    toolbar.append(back, add, history);

    materialsSection.insertBefore(
      toolbar,
      $("materials")
    );
  }

  materialsSection.querySelector("h2").textContent =
    "Container " + container;

  render();

  materialsSection.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

/* CHIUSURA CONTAINER */

function closeContainer() {
  containerView = false;
  historyVisible = false;

  $("formtitle").parentElement.classList.remove("hidden");
  $("search").parentElement.classList.remove("hidden");
  $("containers").parentElement.classList.remove("hidden");
  $("movements").parentElement.classList.remove("hidden");
  $("export").parentElement.classList.remove("hidden");

  if ($("containerToolbar")) {
    $("containerToolbar").remove();
  }

  selectedContainer = "";

  $("materials").parentElement.querySelector("h2").textContent =
    "Materiali";

  render();

  $("containers").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

/* STORICO MOVIMENTI */

function renderMovements() {
  $("movements").innerHTML = movements.length
    ? movements.map(m => `
      <div class="item">
        ${esc(m.type || "Movimento")} ·
        ${esc(m.name || "")} ·
        ${m.amount ?? ""}
        ${esc(m.unit || "")}

        <span class="muted">
          ${esc(m.container || "")}
        </span>
      </div>
    `).join("")
    : "Nessun movimento registrato.";
}

/* AZIONI SUI MATERIALI */

$("materials").onclick = e => {
  const button = e.target.closest("button[data-act]");

  if (!button) return;

  const material = materials.find(
    x => x.id === button.dataset.id
  );

  if (!material) return;

  const actions = {
    in: () => move(material, 1),
    out: () => move(material, -1),
    edit: () => edit(material),
    del: () => remove(material)
  };

  actions[button.dataset.act]?.();
};

/* AZIONI SUI CONTAINER */

$("containers").onclick = e => {
  const card = e.target.closest("[data-container]");

  if (!card) return;

  openContainer(card.dataset.container);
};

$("containers").onkeydown = e => {
  if (e.key !== "Enter" && e.key !== " ") return;

  const card = e.target.closest(".container-card");

  if (!card) return;

  e.preventDefault();

  openContainer(card.dataset.container);
};

/* RICERCA MATERIALI */

function runSearch() {
  selectedContainer = "";

  render();

  $("materials").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

$("searchBtn").onclick = runSearch;

$("search").addEventListener("keydown", e => {
  if (e.key === "Enter") {
    runSearch();
  }
});

$("clearSearch").onclick = () => {
  $("search").value = "";
  selectedContainer = "";
  render();
};

$("search").oninput = render;

/* BLOCCO MAGAZZINO */

$("logout").onclick = async () => {
  if (
    confirm("Bloccare il magazzino su questo dispositivo?")
  ) {
    show("pin");

    $("pin1").value = "";
    $("pinmsg").textContent =
      "Inserisci il PIN per rientrare.";

    $("pin2").classList.add("hidden");
    $("pintitle").textContent = "Inserisci il PIN";
  }
};

/* BACKUP JSON */

$("export").onclick = () => {
  const backup = {
    materials,
    movements,
    exportedAt: new Date().toISOString()
  };

  const blob = new Blob(
    [JSON.stringify(backup, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "backup-magazzino.json";

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
};

/* PROTEZIONE TESTI HTML */

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));
}
