const state = {
  session: null,
  wines: [],
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---------- Auth ----------

async function initAuth() {
  const { data } = await supabaseClient.auth.getSession();
  state.session = data.session;
  applyAuthView();

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    state.session = session;
    applyAuthView();
    if (session) loadWines();
  });

  if (state.session) loadWines();
}

function applyAuthView() {
  const isLoggedIn = !!state.session;
  $("#auth-view").classList.toggle("hidden", isLoggedIn);
  $("#app-view").classList.toggle("hidden", !isLoggedIn);
}

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("#login-email").value.trim();
  const msg = $("#auth-message");
  msg.textContent = "전송 중...";
  const { error } = await supabaseClient.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href },
  });
  msg.textContent = error
    ? `오류: ${error.message}`
    : "이메일로 로그인 링크를 보냈습니다. 메일함을 확인하세요.";
});

$("#logout-btn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
});

// ---------- Tabs ----------

$$(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$(".tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    $$(".tab-panel").forEach((p) => p.classList.add("hidden"));
    $(`#tab-${btn.dataset.tab}`).classList.remove("hidden");
  });
});

// ---------- Wines: load & render ----------

async function loadWines() {
  const { data, error } = await supabaseClient
    .from("wines")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }
  state.wines = data;
  renderWineTable();
  renderDrinkWindowAlert();
}

function renderDrinkWindowAlert() {
  const currentYear = new Date().getFullYear();
  const urgent = state.wines.filter(
    (w) => w.drink_window_end != null && w.drink_window_end - currentYear <= 1
  );
  const alertEl = $("#drink-window-alert");
  if (urgent.length === 0) {
    alertEl.classList.add("hidden");
    return;
  }
  alertEl.classList.remove("hidden");
  const items = urgent
    .map((w) => {
      const status = w.drink_window_end < currentYear ? "적정 시기 지남" : "적정 시기 임박";
      return `<li>${escapeHtml(w.name)} (${escapeHtml(w.vintage)}) — ${status} (~${w.drink_window_end})</li>`;
    })
    .join("");
  alertEl.innerHTML = `<strong>⚠ 음용 시기 확인 필요</strong><ul>${items}</ul>`;
}

function renderWineTable() {
  const body = $("#wine-table-body");
  const emptyMsg = $("#empty-msg");
  body.innerHTML = "";

  if (state.wines.length === 0) {
    emptyMsg.classList.remove("hidden");
    return;
  }
  emptyMsg.classList.add("hidden");

  for (const w of state.wines) {
    const tr = document.createElement("tr");
    tr.dataset.id = w.id;
    const drinkWindow =
      w.drink_window_start || w.drink_window_end
        ? `${w.drink_window_start ?? "?"}–${w.drink_window_end ?? "?"}`
        : "-";
    tr.innerHTML = `
      <td>${escapeHtml(w.name)}</td>
      <td>${escapeHtml(w.vintage ?? "-")}</td>
      <td>${escapeHtml(w.quantity)}</td>
      <td>${escapeHtml(w.storage_location ?? "-")}</td>
      <td>${escapeHtml(drinkWindow)}</td>
      <td><button class="ghost-btn view-btn">보기</button></td>
    `;
    tr.querySelector(".view-btn").addEventListener("click", () => openWineDetail(w.id));
    body.appendChild(tr);
  }
}

// ---------- Add wine ----------

$("#wine-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const msg = $("#add-message");

  const tags = fd.get("food_pairing_tags");
  const payload = {
    owner_id: state.session.user.id,
    name: fd.get("name"),
    vintage: fd.get("vintage") ? Number(fd.get("vintage")) : null,
    producer: fd.get("producer") || null,
    variety: fd.get("variety") || null,
    region: fd.get("region") || null,
    country: fd.get("country") || null,
    style: fd.get("style") || null,
    quantity: fd.get("quantity") ? Number(fd.get("quantity")) : 1,
    storage_location: fd.get("storage_location") || null,
    purchase_date: fd.get("purchase_date") || null,
    price: fd.get("price") ? Number(fd.get("price")) : null,
    drink_window_start: fd.get("drink_window_start") ? Number(fd.get("drink_window_start")) : null,
    drink_window_end: fd.get("drink_window_end") ? Number(fd.get("drink_window_end")) : null,
    food_pairing_tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : null,
    my_rating: fd.get("my_rating") ? Number(fd.get("my_rating")) : null,
  };

  const { error } = await supabaseClient.from("wines").insert(payload);
  if (error) {
    msg.textContent = `오류: ${error.message}`;
    return;
  }
  msg.textContent = "저장되었습니다.";
  form.reset();
  loadWines();
});

// ---------- Wine detail modal & tasting notes ----------

let currentWineId = null;

async function openWineDetail(wineId) {
  currentWineId = wineId;
  const w = state.wines.find((x) => x.id === wineId);
  if (!w) return;

  $("#wine-detail-body").innerHTML = `
    <h2>${escapeHtml(w.name)} ${w.vintage ? `(${escapeHtml(w.vintage)})` : ""}</h2>
    <p><strong>생산자:</strong> ${escapeHtml(w.producer ?? "-")}</p>
    <p><strong>품종:</strong> ${escapeHtml(w.variety ?? "-")}</p>
    <p><strong>원산지:</strong> ${escapeHtml([w.region, w.country].filter(Boolean).join(", ") || "-")}</p>
    <p><strong>스타일:</strong> ${escapeHtml(w.style ?? "-")}</p>
    <p><strong>수량:</strong> ${escapeHtml(w.quantity)} · <strong>보관위치:</strong> ${escapeHtml(w.storage_location ?? "-")}</p>
    <p><strong>나의 평점:</strong> ${escapeHtml(w.my_rating ?? "-")}</p>
    <p><strong>페어링 태그:</strong> ${escapeHtml((w.food_pairing_tags || []).join(", ") || "-")}</p>
  `;
  $("#tasting-form [name=wine_id]").value = wineId;
  $("#tasting-form [name=note_date]").value = new Date().toISOString().slice(0, 10);
  $("#wine-detail-modal").classList.remove("hidden");
  await loadTastingNotes(wineId);
}

$("#close-modal-btn").addEventListener("click", () => {
  $("#wine-detail-modal").classList.add("hidden");
  currentWineId = null;
});

async function loadTastingNotes(wineId) {
  const { data, error } = await supabaseClient
    .from("tasting_notes")
    .select("*")
    .eq("wine_id", wineId)
    .order("note_date", { ascending: false });

  const list = $("#tasting-notes-list");
  list.innerHTML = "";
  if (error) {
    console.error(error);
    return;
  }
  if (data.length === 0) {
    list.innerHTML = `<li class="muted">기록된 시음노트가 없습니다.</li>`;
    return;
  }
  for (const n of data) {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${escapeHtml(n.note_date)}</strong> — 평점: ${escapeHtml(n.my_rating ?? "-")}<br/>
      향: ${escapeHtml(n.aroma ?? "-")} / 맛: ${escapeHtml(n.taste ?? "-")} / 바디: ${escapeHtml(n.body ?? "-")} / 여운: ${escapeHtml(n.finish ?? "-")}<br/>
      ${n.comment ? escapeHtml(n.comment) : ""}
    `;
    list.appendChild(li);
  }
}

$("#tasting-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = {
    wine_id: currentWineId,
    owner_id: state.session.user.id,
    note_date: fd.get("note_date") || new Date().toISOString().slice(0, 10),
    aroma: fd.get("aroma") || null,
    taste: fd.get("taste") || null,
    body: fd.get("body") || null,
    finish: fd.get("finish") || null,
    my_rating: fd.get("my_rating") ? Number(fd.get("my_rating")) : null,
    comment: fd.get("comment") || null,
  };
  const { error } = await supabaseClient.from("tasting_notes").insert(payload);
  if (error) {
    alert(`오류: ${error.message}`);
    return;
  }
  e.target.reset();
  $("#tasting-form [name=wine_id]").value = currentWineId;
  loadTastingNotes(currentWineId);
});

initAuth();
