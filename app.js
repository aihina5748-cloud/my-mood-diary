const STORAGE_KEY = "maeumgyeol.entries.v1";

const moods = {
  happy: { label: "행복", emoji: "😊", color: "#f0ad62" },
  calm: { label: "평온", emoji: "🙂", color: "#6fb8a6" },
  sad: { label: "울적", emoji: "😔", color: "#7398cf" },
  angry: { label: "답답", emoji: "😤", color: "#d97882" },
};

const today = startOfDay(new Date());
let selectedDate = new Date(today);
let visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let selectedMood = null;
let analysisDays = 7;
let toastTimer;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
  todayBadge: $("#todayBadge"),
  calendarTitle: $("#calendarTitle"),
  calendarGrid: $("#calendarGrid"),
  selectedDateLabel: $("#selectedDateLabel"),
  moodButtons: $$(".mood-button"),
  diaryInput: $("#diaryInput"),
  charCount: $("#charCount"),
  saveEntry: $("#saveEntry"),
  clearEntry: $("#clearEntry"),
  homeScreen: $("#homeScreen"),
  insightScreen: $("#insightScreen"),
  navButtons: $$(".nav-button"),
  moodBars: $("#moodBars"),
  recordList: $("#recordList"),
  moodFilter: $("#moodFilter"),
  toast: $("#toast"),
  confirmLayer: $("#confirmLayer"),
};

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatKoreanDate(date, includeYear = false) {
  const options = { month: "long", day: "numeric", weekday: "long" };
  if (includeYear) options.year = "numeric";
  return new Intl.DateTimeFormat("ko-KR", options).format(date);
}

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}

function persistEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function renderCalendar() {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const entries = loadEntries();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  elements.calendarTitle.textContent = `${year}년 ${month + 1}월`;
  elements.calendarGrid.innerHTML = "";

  for (let index = 0; index < firstWeekday; index += 1) {
    const spacer = document.createElement("span");
    spacer.className = "calendar-spacer";
    spacer.setAttribute("aria-hidden", "true");
    elements.calendarGrid.append(spacer);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const key = dateKey(date);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";
    button.textContent = day;
    button.setAttribute("aria-label", `${month + 1}월 ${day}일`);
    button.disabled = date > today;

    if (key === dateKey(today)) button.classList.add("is-today");
    if (key === dateKey(selectedDate)) {
      button.classList.add("is-selected");
      button.setAttribute("aria-pressed", "true");
    }
    if (entries[key]) {
      button.classList.add("has-entry");
      button.title = `${moods[entries[key].mood].label} 기록 있음`;
    }

    button.addEventListener("click", () => {
      selectedDate = date;
      renderCalendar();
      loadSelectedEntry();
    });
    elements.calendarGrid.append(button);
  }
}

function loadSelectedEntry() {
  const entry = loadEntries()[dateKey(selectedDate)];
  selectedMood = entry?.mood ?? null;
  elements.diaryInput.value = entry?.text ?? "";
  elements.selectedDateLabel.textContent = formatKoreanDate(selectedDate, true);
  elements.clearEntry.hidden = !entry;
  updateEntryForm();
}

function updateEntryForm() {
  elements.moodButtons.forEach((button) => {
    const active = button.dataset.mood === selectedMood;
    button.classList.toggle("is-selected", active);
    button.setAttribute("aria-checked", String(active));
  });
  elements.charCount.textContent = elements.diaryInput.value.length;
  elements.saveEntry.disabled = !selectedMood;
}

function saveEntry() {
  if (!selectedMood) return;
  const entries = loadEntries();
  entries[dateKey(selectedDate)] = {
    mood: selectedMood,
    text: elements.diaryInput.value.trim(),
    updatedAt: new Date().toISOString(),
  };
  persistEntries(entries);
  elements.clearEntry.hidden = false;
  renderCalendar();
  showToast("오늘의 마음을 소중히 저장했어요.");
}

function clearEntry() {
  const entries = loadEntries();
  delete entries[dateKey(selectedDate)];
  persistEntries(entries);
  elements.confirmLayer.hidden = true;
  loadSelectedEntry();
  renderCalendar();
  showToast("선택한 기록을 지웠어요.");
}

function showScreen(name) {
  const isHome = name === "home";
  elements.homeScreen.hidden = !isHome;
  elements.insightScreen.hidden = isHome;
  elements.navButtons.forEach((button) => {
    const active = button.dataset.screen === name;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
  if (!isHome) renderInsights();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function getFilteredEntries() {
  const cutoff = analysisDays === "all"
    ? null
    : new Date(today.getFullYear(), today.getMonth(), today.getDate() - Number(analysisDays) + 1);

  return Object.entries(loadEntries())
    .map(([date, entry]) => ({ date, ...entry }))
    .filter((entry) => !cutoff || parseDate(entry.date) >= cutoff)
    .sort((a, b) => b.date.localeCompare(a.date));
}

function calculateStreak(entries) {
  const keys = new Set(Object.keys(entries));
  let cursor = new Date(today);
  if (!keys.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (keys.has(dateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function renderInsights() {
  const allEntries = loadEntries();
  const entries = getFilteredEntries();
  const counts = Object.fromEntries(Object.keys(moods).map((key) => [key, 0]));
  entries.forEach((entry) => { counts[entry.mood] += 1; });
  const maxCount = Math.max(...Object.values(counts), 1);

  elements.moodBars.innerHTML = Object.entries(moods).map(([key, mood]) => `
    <div class="bar-row">
      <span class="bar-label"><span>${mood.emoji}</span>${mood.label}</span>
      <div class="bar-track"><div class="bar-fill" style="--bar-color:${mood.color};width:${(counts[key] / maxCount) * 100}%"></div></div>
      <span class="bar-value">${counts[key]}회</span>
    </div>
  `).join("");

  const total = Object.keys(allEntries).length;
  const overallCounts = Object.fromEntries(Object.keys(moods).map((key) => [key, 0]));
  Object.values(allEntries).forEach((entry) => { overallCounts[entry.mood] += 1; });
  const favorite = total
    ? Object.entries(overallCounts).sort((a, b) => b[1] - a[1])[0][0]
    : null;

  $("#totalCount").textContent = total;
  $("#streakCount").textContent = `${calculateStreak(allEntries)}일`;
  $("#favoriteMood").textContent = favorite ? moods[favorite].label : "—";
  $("#summaryCopy").textContent = favorite
    ? `최근에는 ${moods[favorite].emoji} ${moods[favorite].label}한 마음이 가장 자주 찾아왔어요.`
    : "첫 기록을 남기면 마음의 흐름을 보여드릴게요.";

  renderRecords();
}

function renderRecords() {
  const filter = elements.moodFilter.value;
  const records = getFilteredEntries().filter((entry) => filter === "all" || entry.mood === filter);

  if (!records.length) {
    elements.recordList.innerHTML = '<div class="empty-state"><span>☁️</span>이 기간에는 아직 기록이 없어요.</div>';
    return;
  }

  elements.recordList.innerHTML = records.map((entry) => {
    const mood = moods[entry.mood];
    return `
      <article class="record-item">
        <div class="record-emoji">${mood.emoji}</div>
        <div class="record-copy">
          <strong>${mood.label}</strong>
          <span>${escapeHtml(entry.text || "말없이 마음만 남긴 날")}</span>
        </div>
        <time class="record-date" datetime="${entry.date}">${formatKoreanDate(parseDate(entry.date))}</time>
      </article>
    `;
  }).join("");
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[char]);
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 2200);
}

function bindEvents() {
  $("#prevMonth").addEventListener("click", () => {
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
    renderCalendar();
  });
  $("#nextMonth").addEventListener("click", () => {
    const next = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    if (next <= currentMonth) {
      visibleMonth = next;
      renderCalendar();
    } else {
      showToast("아직 오지 않은 달이에요.");
    }
  });

  elements.moodButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedMood = button.dataset.mood;
      updateEntryForm();
    });
  });
  elements.diaryInput.addEventListener("input", updateEntryForm);
  elements.saveEntry.addEventListener("click", saveEntry);
  elements.clearEntry.addEventListener("click", () => { elements.confirmLayer.hidden = false; });
  $("#cancelClear").addEventListener("click", () => { elements.confirmLayer.hidden = true; });
  $("#confirmClear").addEventListener("click", clearEntry);
  elements.confirmLayer.addEventListener("click", (event) => {
    if (event.target === elements.confirmLayer) elements.confirmLayer.hidden = true;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") elements.confirmLayer.hidden = true;
  });

  elements.navButtons.forEach((button) => button.addEventListener("click", () => showScreen(button.dataset.screen)));
  $$(".period-tabs button").forEach((button) => {
    button.addEventListener("click", () => {
      analysisDays = button.dataset.days === "all" ? "all" : Number(button.dataset.days);
      $$(".period-tabs button").forEach((item) => item.classList.toggle("is-selected", item === button));
      renderInsights();
    });
  });
  elements.moodFilter.addEventListener("change", renderRecords);
}

function init() {
  elements.todayBadge.textContent = formatKoreanDate(today);
  bindEvents();
  renderCalendar();
  loadSelectedEntry();
}

init();
