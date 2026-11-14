/* =========================================================
   일기장 화면
   일기는 브라우저가 아니라 이 컴퓨터의 일기장 서버(server.py)에 저장돼요.
   서버 주소: http://127.0.0.1:8765  (이 컴퓨터에서만 접속 가능)
   ========================================================= */
const PORT = 8765;
const SAME_SERVER = ["localhost", "127.0.0.1"].includes(location.hostname) && location.port === String(PORT);
const API = SAME_SERVER ? "" : `http://127.0.0.1:${PORT}`;

const MOODS = ["😊", "🤩", "😌", "😐", "😴", "😢", "😠"];
const DOW = ["일", "월", "화", "수", "목", "금", "토"];

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pad = n => String(n).padStart(2, "0");
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => ymd(new Date());

const state = {
  month: todayStr().slice(0, 7), // 달력에 보이는 달
  current: null,                 // 편집 중인 일기 (없으면 새 일기)
  mood: "",
  dirty: false,
  tag: "",
  stats: null,
};

/* ---------- 서버 통신 ---------- */
async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "서버 오류가 났어요.");
  return data;
}

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2000);
}

function setOnline(on) {
  $("offline").hidden = on;
  $("app").hidden = !on;
  $("serverDot").classList.toggle("on", on);
  $("serverText").textContent = on ? "내 컴퓨터에 저장 중" : "서버 꺼짐";
  $("serverBadge").className = "badge " + (on ? "green" : "red");
}

async function connect() {
  try {
    const h = await api("/api/health");
    $("dbPath").textContent = h.db;
    setOnline(true);
    return true;
  } catch {
    setOnline(false);
    return false;
  }
}

/* ---------- 달력 ---------- */
async function loadStats() {
  state.stats = await api(`/api/stats?month=${state.month}`);
  $("stStreak").textContent = state.stats.streak;
  $("stMonth").textContent = state.stats.this_month;
  $("stTotal").textContent = state.stats.total;
  renderCal();
  renderTags();
}

function renderCal() {
  const [y, m] = state.month.split("-").map(Number);
  $("monthTitle").textContent = `${y}년 ${m}월`;
  const first = new Date(y, m - 1, 1).getDay();
  const last = new Date(y, m, 0).getDate();
  const today = todayStr();
  const sel = $("fDate").value;
  const days = state.stats?.days || {};
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
  const d = new Date(y, m - 1 + n, 1);
  state.month = ymd(d).slice(0, 7);
  loadStats();
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

async function openDate(ds) {
  if (!okToLeave()) return;
  if (ds.slice(0, 7) !== state.month) { state.month = ds.slice(0, 7); }
  const list = await api(`/api/entries?date=${ds}`);
  if (list.length) {
    await openEntry(list[list.length - 1].id, true);
  } else {
    fillForm({ date: ds });
  }
  renderSameDay(list);
  await loadStats();
}

async function openEntry(id, skipCheck) {
  if (!skipCheck && !okToLeave()) return;
  const e = await api(`/api/entries/${id}`);
  fillForm(e);
  if (!skipCheck) {
    if (e.date.slice(0, 7) !== state.month) state.month = e.date.slice(0, 7);
    renderSameDay(await api(`/api/entries?date=${e.date}`));
    await loadStats();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function renderSameDay(list) {
  const box = $("sameDay");
  if (list.length < 2) { box.innerHTML = ""; return; }
  box.innerHTML = `<span class="muted small">이 날의 일기 ${list.length}개:</span>` +
    list.slice().reverse().map(e =>
      `<button class="btn sm ${state.current?.id === e.id ? "primary" : ""}" data-id="${e.id}">${esc(e.mood)} ${esc(e.title || "제목 없음")}</button>`).join("");
}
$("sameDay").addEventListener("click", async e => {
  const b = e.target.closest("[data-id]");
  if (b) { await openEntry(Number(b.dataset.id)); }
});

$("newBtn").onclick = () => {
  if (!okToLeave()) return;
  fillForm({ date: $("fDate").value || todayStr() });
  $("sameDay").innerHTML = "";
  $("fTitle").focus();
};

async function save() {
  const body = {
    date: $("fDate").value,
    title: $("fTitle").value,
    body: $("fBody").value,
    mood: state.mood,
    weather: $("fWeather").value,
    tags: $("fTags").value.split(","),
  };
  if (!body.date) return toast("날짜를 골라 주세요.");
  if (!body.title.trim() && !body.body.trim()) return toast("제목이나 내용을 적어 주세요.");
  try {
    const saved = state.current
      ? await api(`/api/entries/${state.current.id}`, { method: "PUT", body: JSON.stringify(body) })
      : await api("/api/entries", { method: "POST", body: JSON.stringify(body) });
    fillForm(saved);
    state.month = saved.date.slice(0, 7);
    toast("저장했어요 ✦");
    renderSameDay(await api(`/api/entries?date=${saved.date}`));
    await Promise.all([loadStats(), loadList()]);
  } catch (err) {
    if (!(await connect())) return;
    toast(err.message);
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
  await api(`/api/entries/${state.current.id}`, { method: "DELETE" });
  state.dirty = false;
  toast("삭제했어요.");
  fillForm({ date: d });
  renderSameDay(await api(`/api/entries?date=${d}`));
  await Promise.all([loadStats(), loadList()]);
};

/* ---------- 목록 ---------- */
function renderTags() {
  const tags = state.stats?.tags || [];
  $("tagBar").innerHTML = tags.length
    ? tags.map(t => `<span class="badge tagchip ${t === state.tag ? "on" : ""}" data-t="${esc(t)}">#${esc(t)}</span>`).join("")
    : "";
  $("tagBar").hidden = !tags.length;
}
$("tagBar").addEventListener("click", e => {
  const c = e.target.closest(".tagchip");
  if (!c) return;
  state.tag = state.tag === c.dataset.t ? "" : c.dataset.t;
  renderTags();
  loadList();
});

let searchTimer;
$("search").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadList, 250); });

async function loadList() {
  const q = $("search").value.trim();
  const params = new URLSearchParams({ limit: "100" });
  if (q) params.set("q", q);
  if (state.tag) params.set("tag", state.tag);
  const list = await api(`/api/entries?${params}`);
  if (!list.length) {
    $("list").innerHTML = `<div class="empty">${q || state.tag ? "찾는 일기가 없어요." : "아직 쓴 일기가 없어요. 오늘의 첫 일기를 남겨 보세요."}</div>`;
    return;
  }
  $("list").innerHTML = list.map(e => {
    const d = new Date(e.date + "T00:00");
    return `
      <div class="entry" data-id="${e.id}">
        <div class="d"><span class="muted small">${d.getFullYear()}.${d.getMonth() + 1}</span><b>${d.getDate()}</b><span class="muted small">${DOW[d.getDay()]}</span></div>
        <div style="min-width:0;flex:1">
          <h3>${esc(e.mood)} ${esc(e.title || "제목 없음")} <span class="muted small" style="font-weight:400">${esc(e.weather)}</span></h3>
          <div class="x">${esc(e.excerpt)}</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">${e.tags.map(t => `<span class="badge">#${esc(t)}</span>`).join("")}</div>
        </div>
      </div>`;
  }).join("");
}
$("list").addEventListener("click", e => {
  const row = e.target.closest(".entry");
  if (row) openEntry(Number(row.dataset.id));
});

/* ---------- 백업 ---------- */
$("exportBtn").onclick = async () => {
  const data = await api("/api/export");
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `일기장-백업-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast(`일기 ${data.entries.length}개를 백업했어요.`);
};
$("importBtn").onclick = () => $("importFile").click();
$("importFile").onchange = async e => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    const r = await api("/api/import", { method: "POST", body: JSON.stringify(data) });
    toast(`${r.added}개 불러옴${r.skipped ? ` · 이미 있는 ${r.skipped}개는 건너뜀` : ""}`);
    await Promise.all([loadStats(), loadList()]);
  } catch (err) {
    toast("불러오지 못했어요: " + err.message);
  }
};

/* ---------- 시작 ---------- */
async function start() {
  if (!(await connect())) return;
  await openDate(todayStr());
  await loadList();
}
$("retryBtn").onclick = async () => {
  if (await connect()) { await openDate(todayStr()); await loadList(); }
  else toast("아직 서버가 꺼져 있어요.");
};
start();
