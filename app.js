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
  const password = $("#login-password").value;
  const msg = $("#auth-message");
  msg.textContent = "로그인 중...";
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  msg.textContent = error ? `오류: ${error.message}` : "";
});

$("#signup-btn").addEventListener("click", async () => {
  const email = $("#login-email").value.trim();
  const password = $("#login-password").value;
  const msg = $("#auth-message");
  if (!email || password.length < 6) {
    msg.textContent = "이메일과 6자 이상의 비밀번호를 입력하세요.";
    return;
  }
  msg.textContent = "계정 생성 중...";
  const { data, error } = await supabaseClient.auth.signUp({ email, password });
  if (error) {
    msg.textContent = `오류: ${error.message}`;
    return;
  }
  msg.textContent = data.session
    ? "계정이 생성되었습니다."
    : "계정이 생성되었습니다. 이메일 확인이 필요하면 메일함을 확인하세요.";
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
    if (btn.dataset.tab === "log") searchTastingLog();
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
let editingNoteId = null;
const selectedAroma = { primary: new Set(), secondary: new Set() };

const RATING_LABELS = {
  acidity: ["매우 낮음", "낮음", "보통", "높음", "매우 높음"],
  tannin: ["매우 부드러움", "부드러움", "보통", "강함", "매우 강함"],
  body_level: ["라이트", "라이트-미디엄", "미디엄", "미디엄-풀", "풀바디"],
};

const AROMA_WHEEL = {
  primary: [
    { name: "과일향", tags: ["시트러스/레몬", "사과", "배", "복숭아", "열대과일", "체리", "딸기", "라즈베리", "블랙베리", "자두", "무화과", "건포도"] },
    { name: "꽃향", tags: ["장미", "제비꽃", "아카시아", "오렌지 블러섬", "라벤더"] },
    { name: "허브·식물향", tags: ["풀", "피망", "민트", "유칼립투스"] },
    { name: "향신료향", tags: ["후추", "정향", "아니스"] },
  ],
  secondary: [
    { name: "오크향", tags: ["바닐라", "카라멜", "훈연", "토스트", "코코넛"] },
    { name: "효모·유제품향", tags: ["버터", "요거트", "빵/이스트", "치즈"] },
    { name: "숙성향", tags: ["견과류", "가죽", "담배", "버섯/흙", "꿀"] },
  ],
};

function populateRatingSelects() {
  for (const field of ["acidity", "tannin", "body_level"]) {
    const select = $(`#tasting-form [name=${field}]`);
    RATING_LABELS[field].forEach((label, i) => {
      const opt = document.createElement("option");
      opt.value = i + 1;
      opt.textContent = `${label} (${i + 1})`;
      select.appendChild(opt);
    });
  }
}
populateRatingSelects();

function populateAromaFilterSelect() {
  const select = $("#log-filter-aroma");
  const allTags = [
    ...AROMA_WHEEL.primary.flatMap((c) => c.tags),
    ...AROMA_WHEEL.secondary.flatMap((c) => c.tags),
  ];
  for (const tag of allTags) {
    const opt = document.createElement("option");
    opt.value = tag;
    opt.textContent = tag;
    select.appendChild(opt);
  }
}
populateAromaFilterSelect();

function renderAromaPicker(containerId, tier) {
  const container = $(`#${containerId}`);
  container.innerHTML = "";
  for (const category of AROMA_WHEEL[tier]) {
    const group = document.createElement("div");
    group.className = "aroma-category";
    const label = document.createElement("div");
    label.className = "aroma-category-label";
    label.textContent = category.name;
    const row = document.createElement("div");
    row.className = "chip-row";
    for (const tag of category.tags) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = tag;
      chip.classList.toggle("active", selectedAroma[tier].has(tag));
      chip.addEventListener("click", () => {
        if (selectedAroma[tier].has(tag)) {
          selectedAroma[tier].delete(tag);
          chip.classList.remove("active");
        } else {
          selectedAroma[tier].add(tag);
          chip.classList.add("active");
        }
      });
      row.appendChild(chip);
    }
    group.appendChild(label);
    group.appendChild(row);
    container.appendChild(group);
  }
}

function resetTastingForm() {
  editingNoteId = null;
  selectedAroma.primary.clear();
  selectedAroma.secondary.clear();
  $("#tasting-form").reset();
  $("#tasting-form [name=wine_id]").value = currentWineId;
  $("#tasting-form [name=note_id]").value = "";
  $("#tasting-form [name=note_date]").value = new Date().toISOString().slice(0, 10);
  $("#tasting-form-title").textContent = "시음노트 추가";
  $("#tasting-submit-btn").textContent = "시음노트 저장";
  $("#tasting-cancel-edit-btn").classList.add("hidden");
  renderAromaPicker("aroma-primary-picker", "primary");
  renderAromaPicker("aroma-secondary-picker", "secondary");
}

function startEditNote(note) {
  editingNoteId = note.id;
  selectedAroma.primary = new Set(note.aroma_primary || []);
  selectedAroma.secondary = new Set(note.aroma_secondary || []);
  const form = $("#tasting-form");
  form.elements.note_id.value = note.id;
  form.elements.note_date.value = note.note_date;
  form.elements.acidity.value = note.acidity ?? "";
  form.elements.tannin.value = note.tannin ?? "";
  form.elements.body_level.value = note.body_level ?? "";
  form.elements.finish.value = note.finish ?? "";
  form.elements.food_pairing.value = note.food_pairing ?? "";
  form.elements.my_rating.value = note.my_rating ?? "";
  form.elements.comment.value = note.comment ?? "";
  $("#tasting-form-title").textContent = "시음노트 수정";
  $("#tasting-submit-btn").textContent = "수정 저장";
  $("#tasting-cancel-edit-btn").classList.remove("hidden");
  renderAromaPicker("aroma-primary-picker", "primary");
  renderAromaPicker("aroma-secondary-picker", "secondary");
  form.scrollIntoView({ behavior: "smooth" });
}

$("#tasting-cancel-edit-btn").addEventListener("click", resetTastingForm);

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
  resetTastingForm();
  $("#wine-detail-modal").classList.remove("hidden");
  await loadTastingNotes(wineId);
}

$("#close-modal-btn").addEventListener("click", () => {
  $("#wine-detail-modal").classList.add("hidden");
  currentWineId = null;
});

function ratingLabel(field, value) {
  if (!value) return "-";
  const label = RATING_LABELS[field]?.[value - 1];
  return label ? `${label}(${value})` : String(value);
}

function renderTastingNoteItem(n, { showWineName = false, wine = null } = {}) {
  const li = document.createElement("li");
  const aromaText = [...(n.aroma_primary || []), ...(n.aroma_secondary || [])].join(", ") || "-";
  const wineHeader = showWineName
    ? `<div class="log-wine-title">${escapeHtml(wine?.name ?? "")} ${wine?.vintage ? `(${escapeHtml(wine.vintage)})` : ""}</div>`
    : "";
  li.innerHTML = `
    ${wineHeader}
    <strong>${escapeHtml(n.note_date)}</strong> — 평점: ${escapeHtml(n.my_rating ?? "-")}<br/>
    산도: ${escapeHtml(ratingLabel("acidity", n.acidity))} / 타닌: ${escapeHtml(ratingLabel("tannin", n.tannin))} / 바디: ${escapeHtml(ratingLabel("body_level", n.body_level))} / 여운: ${escapeHtml(n.finish ?? "-")}<br/>
    향: ${escapeHtml(aromaText)}<br/>
    ${n.food_pairing ? `함께 먹은 음식: ${escapeHtml(n.food_pairing)}<br/>` : ""}
    ${n.comment ? escapeHtml(n.comment) + "<br/>" : ""}
  `;
  if (!showWineName) {
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "ghost-btn";
    editBtn.textContent = "수정";
    editBtn.addEventListener("click", () => startEditNote(n));
    li.appendChild(editBtn);
  }
  return li;
}

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
    list.appendChild(renderTastingNoteItem(n));
  }
}

$("#tasting-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = {
    wine_id: currentWineId,
    owner_id: state.session.user.id,
    note_date: fd.get("note_date") || new Date().toISOString().slice(0, 10),
    acidity: fd.get("acidity") ? Number(fd.get("acidity")) : null,
    tannin: fd.get("tannin") ? Number(fd.get("tannin")) : null,
    body_level: fd.get("body_level") ? Number(fd.get("body_level")) : null,
    aroma_primary: [...selectedAroma.primary],
    aroma_secondary: [...selectedAroma.secondary],
    finish: fd.get("finish") || null,
    food_pairing: fd.get("food_pairing") || null,
    my_rating: fd.get("my_rating") ? Number(fd.get("my_rating")) : null,
    comment: fd.get("comment") || null,
  };

  const { error } = editingNoteId
    ? await supabaseClient.from("tasting_notes").update(payload).eq("id", editingNoteId)
    : await supabaseClient.from("tasting_notes").insert(payload);

  if (error) {
    alert(`오류: ${error.message}`);
    return;
  }
  resetTastingForm();
  loadTastingNotes(currentWineId);
});

// ---------- Tasting log search ----------

function withinPeriod(noteDateStr, period) {
  if (!period) return true;
  const noteDate = new Date(noteDateStr);
  const now = new Date();
  if (period === "1m") {
    const from = new Date(now);
    from.setMonth(from.getMonth() - 1);
    return noteDate >= from;
  }
  if (period === "3m") {
    const from = new Date(now);
    from.setMonth(from.getMonth() - 3);
    return noteDate >= from;
  }
  if (period === "year") {
    return noteDate.getFullYear() === now.getFullYear();
  }
  return true;
}

async function searchTastingLog() {
  const list = $("#tasting-log-list");
  const emptyMsg = $("#tasting-log-empty");

  const { data, error } = await supabaseClient
    .from("tasting_notes")
    .select("*, wines(name, producer, vintage, variety, country, region, style)");

  list.innerHTML = "";
  if (error) {
    console.error(error);
    return;
  }

  const keyword = $("#log-filter-keyword").value.trim().toLowerCase();
  const varietyTerm = $("#log-filter-variety").value.trim().toLowerCase();
  const countryTerm = $("#log-filter-country").value.trim().toLowerCase();
  const regionTerm = $("#log-filter-region").value.trim().toLowerCase();
  const styleTerm = $("#log-filter-style").value;
  const foodTerm = $("#log-filter-food").value.trim().toLowerCase();
  const aromaTerm = $("#log-filter-aroma").value;
  const minRating = Number($("#log-filter-rating").value || 0);
  const period = $("#log-filter-period").value;
  const sortBy = $("#log-filter-sort").value;

  let results = (data || []).filter((n) => {
    const w = n.wines || {};
    if (keyword && !`${w.name ?? ""} ${w.producer ?? ""}`.toLowerCase().includes(keyword)) return false;
    if (varietyTerm && !(w.variety ?? "").toLowerCase().includes(varietyTerm)) return false;
    if (countryTerm && !(w.country ?? "").toLowerCase().includes(countryTerm)) return false;
    if (regionTerm && !(w.region ?? "").toLowerCase().includes(regionTerm)) return false;
    if (styleTerm && w.style !== styleTerm) return false;
    if (foodTerm && !(n.food_pairing ?? "").toLowerCase().includes(foodTerm)) return false;
    if (aromaTerm && ![...(n.aroma_primary || []), ...(n.aroma_secondary || [])].includes(aromaTerm)) return false;
    if (minRating && !(n.my_rating >= minRating)) return false;
    if (!withinPeriod(n.note_date, period)) return false;
    return true;
  });

  results.sort((a, b) => {
    if (sortBy === "rating_desc") return (b.my_rating ?? -1) - (a.my_rating ?? -1);
    if (sortBy === "rating_asc") return (a.my_rating ?? 99) - (b.my_rating ?? 99);
    return new Date(b.note_date) - new Date(a.note_date);
  });

  if (results.length === 0) {
    emptyMsg.classList.remove("hidden");
    return;
  }
  emptyMsg.classList.add("hidden");
  for (const n of results) {
    list.appendChild(renderTastingNoteItem(n, { showWineName: true, wine: n.wines }));
  }
}

$("#log-filter-form").addEventListener("submit", (e) => {
  e.preventDefault();
  searchTastingLog();
});

$("#log-reset-btn").addEventListener("click", () => {
  $("#log-filter-form").reset();
  searchTastingLog();
});

$("#cleanup-comment-btn").addEventListener("click", async () => {
  const msg = $("#cleanup-comment-message");
  const textarea = $("#tasting-form [name=comment]");
  const raw = textarea.value.trim();
  if (!raw) {
    msg.textContent = "정리할 코멘트를 먼저 입력해주세요.";
    return;
  }
  msg.textContent = "정리 중...";
  try {
    const cleaned = await cleanupTastingComment(raw);
    textarea.value = cleaned;
    msg.textContent = "정리되었습니다. 필요하면 직접 수정하세요.";
  } catch (err) {
    msg.textContent = `오류: ${err.message}`;
  }
});

// ---------- AI settings & assist ----------

function refreshApiKeyStatus() {
  const status = $("#api-key-status");
  status.textContent = getGeminiApiKey() ? "API 키가 저장되어 있습니다." : "저장된 API 키가 없습니다.";
}

$("#api-key-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const val = $("#api-key-input").value.trim();
  if (!val) return;
  setGeminiApiKey(val);
  $("#api-key-input").value = "";
  refreshApiKeyStatus();
});

$("#clear-api-key-btn").addEventListener("click", () => {
  setGeminiApiKey(null);
  refreshApiKeyStatus();
});

refreshApiKeyStatus();

$("#analyze-label-btn").addEventListener("click", async () => {
  const fileInput = $("#label-photo-input");
  const msg = $("#label-ai-message");
  const file = fileInput.files[0];
  if (!file) {
    msg.textContent = "먼저 사진을 선택해주세요.";
    return;
  }
  msg.textContent = "라벨 분석 중...";
  try {
    const base64 = await fileToBase64(file);
    const result = await analyzeWineLabel(base64, file.type || "image/jpeg");
    const form = $("#wine-form");
    if (result.name) form.elements.name.value = result.name;
    if (result.vintage) form.vintage.value = result.vintage;
    if (result.producer) form.producer.value = result.producer;
    if (result.variety) form.variety.value = result.variety;
    if (result.region) form.region.value = result.region;
    if (result.country) form.country.value = result.country;
    if (result.style) form.elements.style.value = result.style;
    msg.textContent = result.uncertain_fields?.length
      ? `채워졌습니다. 확인 필요: ${result.uncertain_fields.join(", ")}`
      : "채워졌습니다. 내용을 확인 후 저장하세요.";
  } catch (err) {
    msg.textContent = `오류: ${err.message}`;
  }
});

$("#lookup-info-btn").addEventListener("click", async () => {
  const msg = $("#lookup-ai-message");
  const form = $("#wine-form");
  const name = form.elements.name.value.trim();
  if (!name) {
    msg.textContent = "먼저 와인명을 입력해주세요.";
    return;
  }
  msg.textContent = "확인 중...";
  try {
    const result = await lookupVarietyAndDrinkWindow({
      name,
      producer: form.producer.value.trim(),
      vintage: form.vintage.value.trim(),
    });
    if (result.confidence === "알고있음") {
      if (result.variety) form.variety.value = result.variety;
      if (result.drink_window_start) form.drink_window_start.value = result.drink_window_start;
      if (result.drink_window_end) form.drink_window_end.value = result.drink_window_end;
      msg.textContent = `AI 지식 기반으로 채웠습니다. ${result.note || ""}`;
    } else {
      msg.textContent = `${result.confidence}: ${result.note || "확실하지 않아 채우지 않았습니다."}`;
    }
  } catch (err) {
    msg.textContent = `오류: ${err.message}`;
  }
});

initAuth();
