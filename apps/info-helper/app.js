/* =========================================================
   정보 담당 도우미
   - 모든 데이터는 브라우저 localStorage 한 곳(STORAGE_KEY)에 저장
   - 서버 없이 index.html만 열면 동작
   ========================================================= */
const STORAGE_KEY = "teacherHub.infoHelper.v1";

const DEVICE_TYPES = ["태블릿", "노트북", "크롬북", "데스크톱", "전자칠판", "프로젝터", "프린터", "네트워크 장비", "기타"];
const DEVICE_STATUS = ["정상", "고장", "수리중", "폐기"];
const MONTHS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2]; // 학년도 순서

// 처음 실행할 때 들어가는 연간 업무 예시
const DEFAULT_TASKS = {
  3: ["학생 스마트기기 배부 및 대여 대장 정리", "교직원·학생 에듀테크 계정 생성(전입·신입생)", "교직원 개인정보보호 연수 안내", "정보통신윤리교육 연간 계획 수립"],
  4: ["정보통신윤리교육(사이버폭력 예방) 실시", "개인정보 파일 보유 현황 점검"],
  5: ["학교 홈페이지 개인정보 노출 점검", "소프트웨어 라이선스 현황 점검"],
  6: ["1학기 스마트기기 일제 점검", "개인정보 처리 업무 담당자 점검"],
  7: ["방학 전 기기 회수·충전·업데이트", "방학 중 대여 기기 목록 정리"],
  8: ["2학기 기기 재배부", "무선망·전자칠판 작동 점검"],
  9: ["인터넷·스마트폰 과의존 예방교육", "2학기 신규 계정 생성(전입생)"],
  10: ["정보보호 교육 자료 안내(교직원)", "PC 백신·OS 업데이트 일제 점검"],
  11: ["노후 기기 교체 수요 조사", "다음 학년도 정보화 예산 요구"],
  12: ["보유기간 지난 개인정보 파기", "불용 기기 처리 계획 수립"],
  1: ["졸업·전출 학생 계정 정리 계획", "연간 정보 업무 평가 및 인수인계 자료 작성"],
  2: ["졸업생·전출 교직원 계정 삭제", "새 학년도 기기 배정 계획", "학교 홈페이지 신학년 메뉴·권한 정리"],
};
const MONTHLY_TASK = "정보보안 점검의 날(매월 셋째 수요일) PC 점검";

/* ---------- 저장소 ---------- */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function todayStr() { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
function currentSchoolYear() { const d = new Date(); return d.getMonth() + 1 >= 3 ? d.getFullYear() : d.getFullYear() - 1; }

function defaultData() {
  const tasks = [];
  MONTHS.forEach(m => {
    [MONTHLY_TASK, ...(DEFAULT_TASKS[m] || [])].forEach(t => tasks.push({ id: uid(), month: m, title: t, done: false }));
  });
  return { schoolYear: currentSchoolYear(), devices: [], loans: [], tasks, sites: [] };
}

let db = load();
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return Object.assign(defaultData(), JSON.parse(raw));
  } catch (e) { console.warn("저장된 데이터를 읽지 못했어요", e); }
  return defaultData();
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }
  catch (e) { toast("저장에 실패했어요. 브라우저 저장 공간을 확인하세요."); }
  renderAll();
}

/* ---------- 도우미 ---------- */
const $ = id => document.getElementById(id);
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2000); }
function activeLoan(deviceId) { return db.loans.find(l => l.deviceId === deviceId && !l.returnedDate); }
function deviceStatus(d) { return activeLoan(d.id) ? "대여중" : d.status; }
function deviceLabel(id) { const d = db.devices.find(x => x.id === id); return d ? `${d.code ? d.code + " · " : ""}${d.name}` : "(삭제된 기기)"; }
function statusBadge(s) {
  const cls = { 정상: "green", 대여중: "blue", 고장: "red", 수리중: "amber", 폐기: "" }[s] ?? "";
  return `<span class="badge ${cls}">${esc(s)}</span>`;
}
function isOverdue(l) { return !l.returnedDate && l.dueDate && l.dueDate < todayStr(); }

/* ---------- 모달 폼 ---------- */
let onModalSave = null;
function openForm(title, fields, values, onSave) {
  $("modalTitle").textContent = title;
  $("modalFields").innerHTML = fields.map(f => {
    const v = values[f.key] ?? f.default ?? "";
    let input;
    if (f.type === "select") input = `<select class="input" name="${f.key}">${f.options.map(o => {
      const [val, label] = Array.isArray(o) ? o : [o, o];
      return `<option value="${esc(val)}" ${val === v ? "selected" : ""}>${esc(label)}</option>`;
    }).join("")}</select>`;
    else if (f.type === "textarea") input = `<textarea class="input" name="${f.key}">${esc(v)}</textarea>`;
    else input = `<input class="input" name="${f.key}" type="${f.type || "text"}" value="${esc(v)}" ${f.required ? "required" : ""} placeholder="${esc(f.placeholder || "")}" />`;
    return `<label class="field ${f.full ? "full" : ""}"><span>${esc(f.label)}${f.required ? " *" : ""}</span>${input}</label>`;
  }).join("");
  onModalSave = onSave;
  $("modal").classList.add("open");
  const first = $("modalFields").querySelector("input,select,textarea"); if (first) first.focus();
}
function closeForm() { $("modal").classList.remove("open"); onModalSave = null; }
$("modalCancel").onclick = closeForm;
$("modal").addEventListener("click", e => { if (e.target.id === "modal") closeForm(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeForm(); });
$("modalForm").addEventListener("submit", e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  Object.keys(data).forEach(k => data[k] = data[k].trim());
  if (onModalSave && onModalSave(data) !== false) closeForm();
});

/* ---------- 탭 ---------- */
document.querySelectorAll(".tab").forEach(btn => btn.onclick = () => showPage(btn.dataset.page));
function showPage(name) {
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.page === name));
  document.querySelectorAll(".page").forEach(p => p.classList.toggle("active", p.id === "page-" + name));
  try { sessionStorage.setItem(STORAGE_KEY + ".tab", name); } catch (e) {}
}

/* =========================================================
   대시보드
   ========================================================= */
function renderDash() {
  const total = db.devices.filter(d => d.status !== "폐기").length;
  const onLoan = db.loans.filter(l => !l.returnedDate).length;
  const broken = db.devices.filter(d => d.status === "고장" || d.status === "수리중");
  const m = new Date().getMonth() + 1;
  const monthTasks = db.tasks.filter(t => t.month === m);
  const left = monthTasks.filter(t => !t.done).length;

  $("dashStats").innerHTML = `
    <div class="card navy"><div class="muted small">관리 기기</div><div class="big">${total}</div><div class="muted small">폐기 제외</div></div>
    <div class="card blue"><div class="muted small">대여 중</div><div class="big">${onLoan}</div><div class="muted small">연체 ${db.loans.filter(isOverdue).length}건</div></div>
    <div class="card"><div class="muted small">고장·수리중</div><div class="big" style="color:var(--red)">${broken.length}</div><div class="muted small">점검 필요</div></div>
    <div class="card green"><div class="muted small">${m}월 남은 업무</div><div class="big">${left}</div><div class="muted small">전체 ${monthTasks.length}개 중</div></div>`;

  $("dashTasks").innerHTML = monthTasks.length ? monthTasks.map(t => `
    <label class="task ${t.done ? "done" : ""}"><input type="checkbox" data-task="${t.id}" ${t.done ? "checked" : ""}/><span class="t">${esc(t.title)}</span></label>`).join("")
    : `<div class="empty">이번 달 업무가 없어요.</div>`;

  const open = db.loans.filter(l => !l.returnedDate).sort((a, b) => (a.dueDate || "9").localeCompare(b.dueDate || "9"));
  $("dashLoans").innerHTML = open.length ? open.slice(0, 8).map(l => `
    <div class="list-item"><div style="flex:1"><b>${esc(deviceLabel(l.deviceId))}</b><div class="muted small">${esc(l.borrower)}</div></div>
    <span class="small ${isOverdue(l) ? "overdue" : "muted"}">${l.dueDate ? (isOverdue(l) ? "연체 " : "~") + esc(l.dueDate) : "기한 없음"}</span>
    <button class="btn sm" data-return="${l.id}">반납</button></div>`).join("")
    : `<div class="empty">대여 중인 기기가 없어요.</div>`;

  $("dashBroken").innerHTML = broken.length ? broken.map(d => `
    <div class="list-item">${statusBadge(d.status)}<div style="flex:1"><b>${esc(d.name)}</b> <span class="muted small">${esc([d.code, d.location].filter(Boolean).join(" · "))}</span></div><span class="muted small">${esc(d.memo)}</span></div>`).join("")
    : `<div class="empty">모든 기기가 정상이에요 🎉</div>`;
}

/* =========================================================
   기기 대장
   ========================================================= */
const deviceFields = [
  { key: "code", label: "관리번호", placeholder: "예: TAB-001" },
  { key: "name", label: "기기명", required: true, placeholder: "예: 갤럭시탭 S9 1번" },
  { key: "type", label: "종류", type: "select", options: DEVICE_TYPES },
  { key: "status", label: "상태", type: "select", options: DEVICE_STATUS },
  { key: "location", label: "위치", placeholder: "예: 3-2 교실, 정보실" },
  { key: "serial", label: "시리얼 번호" },
  { key: "memo", label: "메모", type: "textarea", full: true },
];
$("devTypeFilter").innerHTML = `<option value="">모든 종류</option>` + DEVICE_TYPES.map(t => `<option>${t}</option>`).join("");
$("devStatusFilter").innerHTML = `<option value="">모든 상태</option>` + [...DEVICE_STATUS, "대여중"].map(t => `<option>${t}</option>`).join("");
["devSearch", "devTypeFilter", "devStatusFilter"].forEach(id => $(id).addEventListener("input", renderDevices));

$("addDevice").onclick = () => openForm("기기 추가", deviceFields, { status: "정상" }, data => {
  db.devices.push({ id: uid(), ...data }); save(); toast("기기를 추가했어요");
});
function editDevice(id) {
  const d = db.devices.find(x => x.id === id);
  openForm("기기 수정", deviceFields, d, data => { Object.assign(d, data); save(); toast("수정했어요"); });
}
function deleteDevice(id) {
  if (!confirm("이 기기를 삭제할까요? 대여 기록은 남아 있어요.")) return;
  db.devices = db.devices.filter(x => x.id !== id); save();
}

function filteredDevices() {
  const q = $("devSearch").value.trim().toLowerCase();
  const type = $("devTypeFilter").value, st = $("devStatusFilter").value;
  return db.devices.filter(d =>
    (!q || [d.name, d.code, d.location, d.serial, d.memo].join(" ").toLowerCase().includes(q)) &&
    (!type || d.type === type) && (!st || deviceStatus(d) === st)
  ).sort((a, b) => (a.code || a.name).localeCompare(b.code || b.name, "ko", { numeric: true }));
}
function renderDevices() {
  const list = filteredDevices();
  $("deviceCount").textContent = `${list.length} / ${db.devices.length}대`;
  $("deviceRows").innerHTML = list.length ? list.map(d => `
    <tr><td>${esc(d.code)}</td><td><b>${esc(d.name)}</b></td><td>${esc(d.type)}</td><td>${esc(d.location)}</td>
    <td>${statusBadge(deviceStatus(d))}</td><td class="muted small">${esc(d.memo)}</td>
    <td><div class="row-actions"><button class="btn sm" data-edit-device="${d.id}">수정</button><button class="btn sm danger" data-del-device="${d.id}">삭제</button></div></td></tr>`).join("")
    : `<tr><td colspan="7" class="empty">${db.devices.length ? "검색 결과가 없어요." : "아직 등록된 기기가 없어요. ‘+ 기기 추가’를 눌러 시작하세요."}</td></tr>`;
}

$("exportDevices").onclick = () => {
  const head = ["관리번호", "기기명", "종류", "위치", "상태", "시리얼 번호", "메모"];
  const rows = db.devices.map(d => [d.code, d.name, d.type, d.location, deviceStatus(d), d.serial, d.memo]);
  const csv = [head, ...rows].map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  download(`기기대장_${todayStr()}.csv`, "﻿" + csv, "text/csv"); // BOM: 엑셀 한글 깨짐 방지
};

/* =========================================================
   대여·반납
   ========================================================= */
["loanFilter", "loanClass", "loanSearch"].forEach(id => $(id).addEventListener("input", renderLoans));
$("addLoan").onclick = () => {
  const avail = db.devices.filter(d => d.status === "정상" && !activeLoan(d.id));
  if (!avail.length) { toast("대여 가능한 기기가 없어요. 기기 대장에서 먼저 등록하세요."); return; }
  const due = new Date(); due.setDate(due.getDate() + 7);
  const last = db.lastLoanInput || {};
  openForm("대여 등록 (학생 개인)", [
    { key: "deviceId", label: "기기", type: "select", full: true, options: avail.map(d => [d.id, deviceLabel(d.id)]) },
    { key: "grade", label: "학년", type: "number", required: true, default: last.grade },
    { key: "cls", label: "반", type: "number", required: true, default: last.cls },
    { key: "num", label: "번호", type: "number", required: true },
    { key: "name", label: "이름", required: true, placeholder: "예: 김민준" },
    { key: "outDate", label: "대여일", type: "date", default: todayStr() },
    { key: "dueDate", label: "반납 예정일", type: "date", default: due.toISOString().slice(0, 10) },
    { key: "memo", label: "메모", full: true, placeholder: "예: 충전기 포함" },
  ], {}, data => {
    const borrower = `${data.grade}-${data.cls}-${data.num} ${data.name}`;
    const dup = db.loans.find(l => !l.returnedDate && l.grade === data.grade && l.cls === data.cls && l.num === data.num);
    if (dup && !confirm(`${dup.borrower} 학생은 이미 ${deviceLabel(dup.deviceId)}을(를) 빌려 갔어요. 그래도 추가로 대여할까요?`)) return false;
    db.lastLoanInput = { grade: data.grade, cls: data.cls }; // 같은 반 연속 입력 편하게
    db.loans.push({ id: uid(), returnedDate: "", borrower, ...data });
    save(); toast("대여를 등록했어요");
  });
};
function studentKey(l) { return l.grade ? `${l.grade}-${l.cls}` : ""; }
function returnLoan(id) {
  const l = db.loans.find(x => x.id === id); if (!l) return;
  l.returnedDate = todayStr(); save(); toast("반납 처리했어요");
}
function deleteLoan(id) {
  if (!confirm("이 대여 기록을 삭제할까요?")) return;
  db.loans = db.loans.filter(x => x.id !== id); save();
}
function renderLoans() {
  const mode = $("loanFilter").value, cls = $("loanClass").value, q = $("loanSearch").value.trim();
  // 반 선택 목록 갱신 (기록에 있는 반만)
  const classes = [...new Set(db.loans.map(studentKey).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko", { numeric: true }));
  $("loanClass").innerHTML = `<option value="">모든 반</option>` + classes.map(c => `<option value="${c}" ${c === cls ? "selected" : ""}>${c.replace("-", "학년 ")}반</option>`).join("");
  const list = db.loans.filter(l => (mode === "all" || !l.returnedDate) && (!cls || studentKey(l) === cls) &&
      (!q || (l.borrower + deviceLabel(l.deviceId)).includes(q)))
    .sort((a, b) => (b.outDate || "").localeCompare(a.outDate || "") || (a.borrower || "").localeCompare(b.borrower || "", "ko", { numeric: true }));
  $("loanRows").innerHTML = list.length ? list.map(l => `
    <tr><td><b>${esc(deviceLabel(l.deviceId))}</b>${l.memo ? `<div class="muted small">${esc(l.memo)}</div>` : ""}</td>
    <td>${esc(l.borrower)}</td><td>${esc(l.outDate)}</td>
    <td class="${isOverdue(l) ? "overdue" : ""}">${esc(l.dueDate)}${isOverdue(l) ? " (연체)" : ""}</td>
    <td>${l.returnedDate ? `<span class="badge green">${esc(l.returnedDate)}</span>` : `<span class="badge blue">대여 중</span>`}</td>
    <td><div class="row-actions">${l.returnedDate ? "" : `<button class="btn sm primary" data-return="${l.id}">반납</button>`}<button class="btn sm danger" data-del-loan="${l.id}">삭제</button></div></td></tr>`).join("")
    : `<tr><td colspan="6" class="empty">${mode === "active" ? "대여 중인 기기가 없어요." : "대여 기록이 없어요."}</td></tr>`;
}

/* =========================================================
   연간 업무
   ========================================================= */
$("newTaskMonth").innerHTML = MONTHS.map(m => `<option value="${m}" ${m === new Date().getMonth() + 1 ? "selected" : ""}>${m}월</option>`).join("");
$("addTask").onclick = () => {
  const title = $("newTaskTitle").value.trim();
  if (!title) { $("newTaskTitle").focus(); return; }
  db.tasks.push({ id: uid(), month: Number($("newTaskMonth").value), title, done: false });
  $("newTaskTitle").value = ""; save(); toast("업무를 추가했어요");
};
$("newTaskTitle").addEventListener("keydown", e => { if (e.key === "Enter") $("addTask").click(); });
function toggleTask(id, done) { const t = db.tasks.find(x => x.id === id); if (t) { t.done = done; save(); } }
function deleteTask(id) { db.tasks = db.tasks.filter(x => x.id !== id); save(); }

function renderTasks() {
  const total = db.tasks.length, done = db.tasks.filter(t => t.done).length;
  const pct = total ? Math.round(done / total * 100) : 0;
  $("taskPct").textContent = `${pct}%`;
  $("taskBar").style.width = pct + "%";
  const now = new Date().getMonth() + 1;
  $("taskMonths").innerHTML = MONTHS.map(m => {
    const ts = db.tasks.filter(t => t.month === m);
    const d = ts.filter(t => t.done).length;
    const yr = m >= 3 ? db.schoolYear : db.schoolYear + 1;
    return `<div class="card month-block" ${m === now ? 'style="outline:2px solid var(--green)"' : ""}>
      <div class="month-title"><h3 style="margin:0">${yr}년 ${m}월</h3>${m === now ? '<span class="badge green">이번 달</span>' : ""}<div class="spacer"></div><span class="badge">${d}/${ts.length}</span></div>
      ${ts.map(t => `<div class="task ${t.done ? "done" : ""}">
        <input type="checkbox" data-task="${t.id}" ${t.done ? "checked" : ""}/><span class="t" style="flex:1">${esc(t.title)}</span>
        <button class="btn sm icon" title="삭제" data-del-task="${t.id}">✕</button></div>`).join("") || '<div class="muted small">업무 없음</div>'}
    </div>`;
  }).join("");
}

/* =========================================================
   사이트 목록
   ========================================================= */
const siteFields = [
  { key: "name", label: "이름", required: true, placeholder: "예: 학교 구글 워크스페이스 관리" },
  { key: "url", label: "주소(URL)", placeholder: "https://" },
  { key: "account", label: "관리 아이디 / 담당", placeholder: "비밀번호는 적지 마세요" },
  { key: "renew", label: "만료·갱신일", type: "date" },
  { key: "memo", label: "메모", type: "textarea", full: true, placeholder: "예: 학생 계정 일괄 생성은 CSV 업로드 메뉴에서" },
];
$("addSite").onclick = () => openForm("사이트 추가", siteFields, {}, data => { db.sites.push({ id: uid(), ...data }); save(); });
function editSite(id) { const s = db.sites.find(x => x.id === id); openForm("사이트 수정", siteFields, s, data => { Object.assign(s, data); save(); }); }
function deleteSite(id) { if (confirm("삭제할까요?")) { db.sites = db.sites.filter(x => x.id !== id); save(); } }
function safeUrl(u) { return /^https?:\/\//i.test(u || "") ? u : (u ? "https://" + u : ""); }
function renderSites() {
  $("siteCards").innerHTML = db.sites.length ? db.sites.map(s => `
    <div class="card">
      <div style="display:flex;gap:8px;align-items:flex-start"><h3 style="flex:1">${esc(s.name)}</h3>${s.renew ? `<span class="badge ${s.renew < todayStr() ? "red" : "amber"}">갱신 ${esc(s.renew)}</span>` : ""}</div>
      ${s.url ? `<a class="small" style="color:var(--blue);word-break:break-all" href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener">${esc(s.url)}</a>` : ""}
      ${s.account ? `<div class="small" style="margin-top:6px">👤 ${esc(s.account)}</div>` : ""}
      ${s.memo ? `<div class="muted small" style="margin-top:6px;white-space:pre-wrap">${esc(s.memo)}</div>` : ""}
      <div class="row-actions" style="margin-top:12px"><button class="btn sm" data-edit-site="${s.id}">수정</button><button class="btn sm danger" data-del-site="${s.id}">삭제</button></div>
    </div>`).join("")
    : `<div class="card empty" style="grid-column:1/-1">자주 쓰는 에듀테크·업무 사이트를 등록해 두세요.<br/>예: 학교 홈페이지 관리자, 구글/MS 관리 콘솔, 학습 플랫폼, MDM 관리 페이지</div>`;
}

/* =========================================================
   백업·설정
   ========================================================= */
function download(name, content, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$("backupBtn").onclick = () => {
  db.lastBackup = todayStr();
  download(`정보담당도우미_백업_${todayStr()}.json`, JSON.stringify(db, null, 2), "application/json");
  save(); toast("백업 파일을 받았어요");
};
function renderBackupNotice() {
  const has = db.devices.length || db.loans.length || db.sites.length;
  const days = db.lastBackup ? Math.floor((new Date(todayStr()) - new Date(db.lastBackup)) / 86400000) : null;
  const need = has && (days === null || days >= 14);
  $("backupNotice").style.display = need ? "flex" : "none";
  $("backupNoticeText").textContent = days === null ? "아직 백업한 적이 없어요." : `마지막 백업이 ${days}일 전이에요.`;
  $("lastBackupText").textContent = db.lastBackup ? `마지막 백업: ${db.lastBackup}` : "아직 백업한 적이 없어요.";
}
$("restoreFile").onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const data = JSON.parse(r.result);
      if (!Array.isArray(data.devices) || !Array.isArray(data.tasks)) throw new Error("형식 오류");
      if (!confirm("현재 데이터를 백업 파일 내용으로 바꿀까요?")) return;
      db = Object.assign(defaultData(), data); save(); toast("복원했어요");
    } catch (err) { alert("올바른 백업 파일이 아니에요."); }
    e.target.value = "";
  };
  r.readAsText(f);
};
$("saveYear").onclick = () => { const y = Number($("schoolYear").value); if (y > 2000) { db.schoolYear = y; save(); toast("저장했어요"); } };
$("resetTasks").onclick = () => {
  if (!confirm("모든 업무 체크를 해제하고 학년도를 올릴까요? (업무 항목은 그대로 남아요)")) return;
  db.tasks.forEach(t => t.done = false); db.schoolYear = currentSchoolYear(); save(); toast("새 학년도를 시작했어요");
};
$("wipeBtn").onclick = () => {
  if (!confirm("정말 모든 데이터를 지울까요? 되돌릴 수 없어요.")) return;
  db = defaultData(); save(); toast("초기화했어요");
};

/* ---------- 버튼 클릭 한곳에서 처리 ---------- */
document.addEventListener("click", e => {
  const el = e.target.closest("[data-edit-device],[data-del-device],[data-return],[data-del-loan],[data-del-task],[data-edit-site],[data-del-site]");
  if (!el) return;
  const ds = el.dataset;
  if (ds.editDevice) editDevice(ds.editDevice);
  else if (ds.delDevice) deleteDevice(ds.delDevice);
  else if (ds.return) returnLoan(ds.return);
  else if (ds.delLoan) deleteLoan(ds.delLoan);
  else if (ds.delTask) deleteTask(ds.delTask);
  else if (ds.editSite) editSite(ds.editSite);
  else if (ds.delSite) deleteSite(ds.delSite);
});
document.addEventListener("change", e => { if (e.target.dataset.task) toggleTask(e.target.dataset.task, e.target.checked); });

/* ---------- 시작 ---------- */
function renderAll() {
  $("yearBadge").textContent = `${db.schoolYear}학년도`;
  $("schoolYear").value = db.schoolYear;
  renderDash(); renderDevices(); renderLoans(); renderTasks(); renderSites(); renderBackupNotice();
}
renderAll();
try { const t = sessionStorage.getItem(STORAGE_KEY + ".tab"); if (t) showPage(t); } catch (e) {}
