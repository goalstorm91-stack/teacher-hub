/* =========================================================
   일기장 화면 (Firebase 버전)
   - 구글 로그인(Firebase Authentication)
   - 일기 저장: Firestore의 users/{내 uid}/entries
   - 보안 규칙(firestore.rules) 덕분에 로그인한 본인만 자기 일기를 읽고 쓸 수 있어요.
   ========================================================= */
import { firebaseConfig } from "./firebase-config.js";

const SDK = "https://www.gstatic.com/firebasejs/10.12.2";
const MOODS = ["😊", "🤩", "😌", "😐", "😴", "😢", "😠"];
const DOW = ["일", "월", "화", "수", "목", "금", "토"];

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pad = n => String(n).padStart(2, "0");
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => ymd(new Date());

const state = {
  entries: new Map(),            // id -> 일기
  month: todayStr().slice(0, 7), // 달력에 보이는 달
  current: null,                 // 편집 중인 일기 (없으면 새 일기)
  mood: "",
  dirty: false,
  tag: "",
  user: null,
};
let fb = null;           // Firebase 함수 모음
let unsubscribe = null;  // 실시간 동기화 해제 함수

/* ---------- 화면 전환 ---------- */
function show(which) {
  ["loading", "setup", "login", "app"].forEach(id => { $(id).hidden = id !== which; });
}

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2200);
}

function friendlyError(err) {
  const code = err?.code || "";
  if (code.includes("permission-denied")) return "권한이 없어요. Firestore 보안 규칙을 확인해 주세요.";
  if (code.includes("unauthorized-domain")) return "이 주소가 Firebase 승인 도메인에 없어요. README의 설정 순서를 확인해 주세요.";
  if (code.includes("popup-closed") || code.includes("cancelled-popup")) return "로그인 창이 닫혔어요. 다시 눌러 주세요.";
  if (code.includes("popup-blocked")) return "팝업이 막혔어요. 주소창 오른쪽에서 팝업을 허용해 주세요.";
  if (code.includes("unavailable") || code.includes("network")) return "인터넷 연결을 확인해 주세요.";
  return err?.message || "알 수 없는 오류가 났어요.";
}

/* ---------- Firebase 준비 ---------- */
async function boot() {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) return show("setup");
  if (location.protocol === "file:") {
    show("setup");
    $("setup").querySelector("h1").textContent = "인터넷 주소로 열어 주세요";
    $("setup").querySelector("p").innerHTML = "구글 로그인은 파일을 더블클릭해 연 화면(file://)에서는 동작하지 않아요. GitHub Pages 주소(https://…github.io/teacher-hub/)로 열어 주세요.";
    return;
  }
  const [appMod, authMod, fsMod] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`),
  ]);
  const app = appMod.initializeApp(firebaseConfig);
  fb = { ...authMod, ...fsMod, auth: authMod.getAuth(app), db: fsMod.getFirestore(app) };

  fb.onAuthStateChanged(fb.auth, user => {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    state.user = user;
    state.entries.clear();
    if (!user) {
      $("userBox").hidden = true;
      return show("login");
    }
    $("userBox").hidden = false;
    $("userName").textContent = user.displayName || user.email || "";
    $("userPhoto").hidden = !user.photoURL;
    if (user.photoURL) $("userPhoto").src = user.photoURL;
    show("loading");
    let first = true;
    unsubscribe = fb.onSnapshot(entriesCol(), snap => {
      state.entries.clear();
      snap.forEach(d => state.entries.set(d.id, { id: d.id, ...d.data() }));
      if (first) {
        first = false;
        show("app");
        openDate(todayStr(), true);
      } else {
        if (state.current && !state.entries.has(state.current.id)) fillForm({ date: $("fDate").value });
        renderSameDay();
      }
      renderAll();
    }, err => { toast(friendlyError(err)); show("login"); $("loginError").textContent = friendlyError(err); });
  });
}

function entriesCol() {
  return fb.collection(fb.db, "users", state.user.uid, "entries");
}

$("loginBtn").onclick = async () => {
  $("loginError").textContent = "";
  try {
    const provider = new fb.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await fb.signInWithPopup(fb.auth, provider);
  } catch (err) {
    $("loginError").textContent = friendlyError(err);
  }
};
$("logoutBtn").onclick = async () => {
  if (!okToLeave()) return;
  state.dirty = false;
  await fb.signOut(fb.auth);
  toast("로그아웃했어요.");
};

/* ---------- 데이터 계산 ---------- */
const allEntries = () => [...state.entries.values()]
  .sort((a, b) => (b.date.localeCompare(a.date)) || ((b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
const entriesOn = ds => allEntries().filter(e => e.date === ds).reverse(); // 먼저 쓴 순서

function calcStreak() {
  const days = new Set(allEntries().map(e => e.date));
  const d = new Date();
  if (!days.has(ymd(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(ymd(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

function renderAll() {
  const list = allEntries();
  $("stStreak").textContent = calcStreak();
  $("stMonth").textContent = list.filter(e => e.date.startsWith(todayStr().slice(0, 7))).length;
  $("stTotal").textContent = list.length;
  renderCal();
  renderTags();
  renderList();
}

/* ---------- 달력 ---------- */
function renderCal() {
  const [y, m] = state.month.split("-").map(Number);
  $("monthTitle").textContent = `${y}년 ${m}월`;
  const first = new Date(y, m - 1, 1).getDay();
  const last = new Date(y, m, 0).getDate();
  const today = todayStr();
  const sel = $("fDate").value;
  const days = {};
  allEntries().slice().reverse().forEach(e => {
    if (e.date.startsWith(state.month)) days[e.date] = e.mood || days[e.date] || "✏️";
  });
  let html = DOW.map(d => `<div class="dow">${d}</div>`).join("");
  for (let i = 0; i < first; i++) html += `<div class="day blank"></div>`;
  for (let d = 1; d <= last; d++) {
    const ds = `${y}-${pad(m)}-${pad(d)}`;
    const cls = ["day", days[ds] ? "has" : "", ds === today ? "today" : "", ds === sel ? "sel" : "", ds > today ? "future" : ""].join(" ");
    html += `<button class="${cls}" data-date="${ds}"><span>${d}</span><span class="m">${esc(days[ds] || "")}</span></button>`;
  }
  $("cal").innerHTML = html;
}

$("cal").addEventListener("click", e => {
  const b = e.target.closest(".day[data-date]");
  if (b) openDate(b.dataset.date);
});
$("prevMonth").onclick = () => shiftMonth(-1);
$("nextMonth").onclick = () => shiftMonth(1);
$("todayBtn").onclick = () => openDate(todayStr());

function shiftMonth(n) {
  const [y, m] = state.month.split("-").map(Number);
  state.month = ymd(new Date(y, m - 1 + n, 1)).slice(0, 7);
  renderCal();
}

/* ---------- 쓰기 ---------- */
function renderMoods() {
  $("moods").innerHTML = MOODS.map(m =>
    `<button class="mood ${m === state.mood ? "on" : ""}" data-m="${m}" title="오늘의 기분">${m}</button>`).join("");
}
$("moods").addEventListener("click", e => {
  const b = e.target.closest(".mood");
  if (!b) return;
  state.mood = state.mood === b.dataset.m ? "" : b.dataset.m;
  renderMoods();
  markDirty();
});

function updateDow() {
  const v = $("fDate").value;
  $("fDow").textContent = v ? DOW[new Date(v + "T00:00").getDay()] + "요일" : "";
}

function fillForm(e) {
  state.current = e && e.id ? e : null;
  $("fDate").value = e?.date || todayStr();
  $("fTitle").value = e?.title || "";
  $("fBody").value = e?.body || "";
  $("fWeather").value = e?.weather || "";
  $("fTags").value = (e?.tags || []).join(", ");
  state.mood = e?.mood || "";
  state.dirty = false;
  $("deleteBtn").hidden = !state.current;
  $("saveState").textContent = state.current ? "저장됨" : "새 일기";
  $("saveState").className = "badge " + (state.current ? "green" : "");
  renderMoods();
  updateDow();
}

function markDirty() {
  state.dirty = true;
  $("saveState").textContent = "저장 안 됨";
  $("saveState").className = "badge amber";
}
["fTitle", "fBody", "fTags", "fWeather"].forEach(id => $(id).addEventListener("input", markDirty));
$("fDate").addEventListener("change", () => { updateDow(); markDirty(); renderCal(); });

function okToLeave() {
  return !state.dirty || confirm("저장하지 않은 내용이 있어요. 버리고 이동할까요?");
}

function openDate(ds, force) {
  if (!force && !okToLeave()) return;
  state.month = ds.slice(0, 7);
  const list = entriesOn(ds);
  fillForm(list.length ? list[list.length - 1] : { date: ds });
  renderSameDay();
  renderCal();
}

function openEntry(id) {
  if (!okToLeave()) return;
  const e = state.entries.get(id);
  if (!e) return;
  fillForm(e);
  state.month = e.date.slice(0, 7);
  renderSameDay();
  renderCal();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderSameDay() {
  const list = entriesOn($("fDate").value);
  const box = $("sameDay");
  if (list.length < 2) { box.innerHTML = ""; return; }
  box.innerHTML = `<span class="muted small">이 날의 일기 ${list.length}개:</span>` +
    list.map(e =>
      `<button class="btn sm ${state.current?.id === e.id ? "primary" : ""}" data-id="${esc(e.id)}">${esc(e.mood)} ${esc(e.title || "제목 없음")}</button>`).join("");
}
$("sameDay").addEventListener("click", e => {
  const b = e.target.closest("[data-id]");
  if (b) openEntry(b.dataset.id);
});

$("newBtn").onclick = () => {
  if (!okToLeave()) return;
  fillForm({ date: $("fDate").value || todayStr() });
  $("sameDay").innerHTML = "";
  $("fTitle").focus();
};

function cleanTags(raw) {
  const list = (Array.isArray(raw) ? raw : String(raw || "").split(","))
    .map(t => String(t).replace(/[,#]/g, "").trim().slice(0, 20)).filter(Boolean);
  return [...new Set(list)].slice(0, 10);
}

function toDoc(src) {
  return {
    date: src.date,
    title: String(src.title || "").trim().slice(0, 100),
    body: String(src.body || "").slice(0, 50000),
    mood: MOODS.includes(src.mood) ? src.mood : "",
    weather: String(src.weather || "").slice(0, 20),
    tags: cleanTags(src.tags),
  };
}

let saving = false;
async function save() {
  if (saving) return;
  const data = toDoc({
    date: $("fDate").value, title: $("fTitle").value, body: $("fBody").value,
    mood: state.mood, weather: $("fWeather").value, tags: $("fTags").value,
  });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) return toast("날짜를 골라 주세요.");
  if (!data.title && !data.body.trim()) return toast("제목이나 내용을 적어 주세요.");
  saving = true;
  $("saveBtn").disabled = true;
  try {
    const now = fb.serverTimestamp();
    let id;
    if (state.current) {
      id = state.current.id;
      await fb.setDoc(fb.doc(entriesCol(), id), { ...data, createdAt: state.current.createdAt || now, updatedAt: now });
    } else {
      const ref = fb.doc(entriesCol());
      id = ref.id;
      await fb.setDoc(ref, { ...data, createdAt: now, updatedAt: now });
    }
    state.dirty = false;
    fillForm(state.entries.get(id) || { ...data, id });
    state.month = data.date.slice(0, 7);
    renderSameDay();
    renderAll();
    toast("저장했어요 ✦");
  } catch (err) {
    toast(friendlyError(err));
  } finally {
    saving = false;
    $("saveBtn").disabled = false;
  }
}
$("saveBtn").onclick = save;
document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && !$("app").hidden) {
    e.preventDefault();
    save();
  }
});
window.addEventListener("beforeunload", e => { if (state.dirty) { e.preventDefault(); e.returnValue = ""; } });

$("deleteBtn").onclick = async () => {
  if (!state.current) return;
  if (!confirm("이 일기를 지울까요? 지운 일기는 되돌릴 수 없어요.")) return;
  const d = state.current.date;
  try {
    await fb.deleteDoc(fb.doc(entriesCol(), state.current.id));
    state.dirty = false;
    fillForm({ date: d });
    renderSameDay();
    renderAll();
    toast("삭제했어요.");
  } catch (err) {
    toast(friendlyError(err));
  }
};

/* ---------- 목록 ---------- */
function renderTags() {
  const count = {};
  allEntries().forEach(e => (e.tags || []).forEach(t => { count[t] = (count[t] || 0) + 1; }));
  const tags = Object.keys(count).sort((a, b) => count[b] - count[a]).slice(0, 12);
  if (state.tag && !tags.includes(state.tag)) state.tag = "";
  $("tagBar").innerHTML = tags.map(t => `<span class="badge tagchip ${t === state.tag ? "on" : ""}" data-t="${esc(t)}">#${esc(t)}</span>`).join("");
  $("tagBar").hidden = !tags.length;
}
$("tagBar").addEventListener("click", e => {
  const c = e.target.closest(".tagchip");
  if (!c) return;
  state.tag = state.tag === c.dataset.t ? "" : c.dataset.t;
  renderTags();
  renderList();
});

let searchTimer;
$("search").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(renderList, 200); });

function renderList() {
  const q = $("search").value.trim().toLowerCase();
  const list = allEntries().filter(e =>
    (!state.tag || (e.tags || []).includes(state.tag)) &&
    (!q || [e.title, e.body, ...(e.tags || [])].join(" ").toLowerCase().includes(q))
  ).slice(0, 100);
  if (!list.length) {
    $("list").innerHTML = `<div class="empty">${q || state.tag ? "찾는 일기가 없어요." : "아직 쓴 일기가 없어요. 오늘의 첫 일기를 남겨 보세요."}</div>`;
    return;
  }
  $("list").innerHTML = list.map(e => {
    const d = new Date(e.date + "T00:00");
    return `
      <div class="entry" data-id="${esc(e.id)}">
        <div class="d"><span class="muted small">${d.getFullYear()}.${d.getMonth() + 1}</span><b>${d.getDate()}</b><span class="muted small">${DOW[d.getDay()]}</span></div>
        <div style="min-width:0;flex:1">
          <h3>${esc(e.mood)} ${esc(e.title || "제목 없음")} <span class="muted small" style="font-weight:400">${esc(e.weather)}</span></h3>
          <div class="x">${esc((e.body || "").slice(0, 160))}</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">${(e.tags || []).map(t => `<span class="badge">#${esc(t)}</span>`).join("")}</div>
        </div>
      </div>`;
  }).join("");
}
$("list").addEventListener("click", e => {
  const row = e.target.closest(".entry");
  if (row) openEntry(row.dataset.id);
});

/* ---------- 백업 ---------- */
$("exportBtn").onclick = () => {
  const entries = allEntries().reverse().map(e => ({
    ...toDoc(e),
    created_at: e.createdAt?.toDate?.().toISOString() || null,
    updated_at: e.updatedAt?.toDate?.().toISOString() || null,
  }));
  const blob = new Blob([JSON.stringify({ app: "teacher-hub-diary", version: 2, exported_at: new Date().toISOString(), entries }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `일기장-백업-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast(`일기 ${entries.length}개를 백업했어요.`);
};
$("importBtn").onclick = () => $("importFile").click();
$("importFile").onchange = async e => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    const items = Array.isArray(data) ? data : data.entries;
    if (!Array.isArray(items)) throw new Error("백업 파일 형식이 아니에요.");
    const seen = new Set(allEntries().map(x => `${x.date}|${x.title}|${x.body}`));
    let added = 0, skipped = 0;
    let batch = fb.writeBatch(fb.db), inBatch = 0;
    for (const raw of items) {
      const d = toDoc(raw || {});
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date || "")) { skipped++; continue; }
      const key = `${d.date}|${d.title}|${d.body}`;
      if (seen.has(key)) { skipped++; continue; }
      seen.add(key);
      const created = raw.created_at ? new Date(raw.created_at) : null;
      batch.set(fb.doc(entriesCol()), {
        ...d,
        createdAt: created && !isNaN(created) ? fb.Timestamp.fromDate(created) : fb.serverTimestamp(),
        updatedAt: fb.serverTimestamp(),
      });
      added++;
      if (++inBatch === 400) { await batch.commit(); batch = fb.writeBatch(fb.db); inBatch = 0; }
    }
    if (inBatch) await batch.commit();
    toast(`${added}개 불러옴${skipped ? ` · ${skipped}개는 건너뜀` : ""}`);
  } catch (err) {
    toast("불러오지 못했어요: " + friendlyError(err));
  }
};

/* ---------- 시작 ---------- */
boot().catch(err => {
  show("login");
  $("loginError").textContent = "Firebase를 불러오지 못했어요. 인터넷 연결을 확인해 주세요. (" + friendlyError(err) + ")";
});
