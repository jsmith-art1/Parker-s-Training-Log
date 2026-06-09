const STORAGE_KEY = "parkerTrainingLogEntries";
const SUPABASE_URL = "https://xbqhtcqvbcndikuqsesz.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhicWh0Y3F2YmNuZGlrdXFzZXN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzExOTEsImV4cCI6MjA5NjI0NzE5MX0.nmXeAvGQMfsamFDapBzO0JJiMXCqov7LNEyuUlnSJA8";
const SUPABASE_TABLE = "training_log_entries";
const db = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const state = {
  entries: loadEntries(),
  activeTab: "today",
  syncReady: false
};

const fields = {
  date: document.querySelector("#entryDate"),
  bedtime: document.querySelector("#bedtime"),
  wakeTime: document.querySelector("#wakeTime"),
  sleepHours: document.querySelector("#sleepHours"),
  sleepQuality: document.querySelector("#sleepQuality"),
  energy: document.querySelector("#energy"),
  mood: document.querySelector("#mood"),
  soreness: document.querySelector("#soreness"),
  workoutType: document.querySelector("#workoutType"),
  duration: document.querySelector("#duration"),
  effort: document.querySelector("#effort"),
  workoutNotes: document.querySelector("#workoutNotes"),
  dailyWin: document.querySelector("#dailyWin")
};

const entryForm = document.querySelector("#entryForm");
const deleteEntryButton = document.querySelector("#deleteEntryButton");
const newEntryButton = document.querySelector("#newEntryButton");
const usualSleepButton = document.querySelector("#usualSleepButton");
const historyList = document.querySelector("#historyList");
const statsGrid = document.querySelector("#statsGrid");
const insightList = document.querySelector("#insightList");
const readinessScore = document.querySelector("#readinessScore");
const trendChart = document.querySelector("#trendChart");
const toast = document.querySelector("#toast");

const scaleLabels = {
  1: "Low",
  2: "Light",
  3: "Okay",
  4: "Good",
  5: "Great"
};

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function persistEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
}

function toRemoteEntry(entry) {
  return {
    date: entry.date,
    sleep_hours: entry.sleepHours || 0,
    bedtime: entry.bedtime || null,
    wake_time: entry.wakeTime || null,
    sleep_quality: entry.sleepQuality || 3,
    energy: entry.energy || 3,
    mood: entry.mood || 3,
    soreness: entry.soreness || 2,
    workout_type: entry.workoutType || "Rest",
    duration: entry.duration || 0,
    effort: entry.effort || 4,
    workout_notes: entry.workoutNotes || "",
    daily_win: entry.dailyWin || "",
    updated_at: entry.updatedAt || new Date().toISOString()
  };
}

function fromRemoteEntry(row) {
  return {
    date: row.date,
    sleepHours: Number(row.sleep_hours || 0),
    bedtime: row.bedtime ? row.bedtime.slice(0, 5) : "",
    wakeTime: row.wake_time ? row.wake_time.slice(0, 5) : "",
    sleepQuality: Number(row.sleep_quality || 3),
    energy: Number(row.energy || 3),
    mood: Number(row.mood || 3),
    soreness: Number(row.soreness || 2),
    workoutType: row.workout_type || "Rest",
    duration: Number(row.duration || 0),
    effort: Number(row.effort || 4),
    workoutNotes: row.workout_notes || "",
    dailyWin: row.daily_win || "",
    updatedAt: row.updated_at || row.created_at || new Date().toISOString()
  };
}

function mergeEntries(localEntries, remoteEntries) {
  const byDate = new Map();
  [...localEntries, ...remoteEntries].forEach((entry) => {
    const existing = byDate.get(entry.date);
    if (!existing || new Date(entry.updatedAt || 0) >= new Date(existing.updatedAt || 0)) {
      byDate.set(entry.date, entry);
    }
  });
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

async function syncFromSupabase() {
  if (!db) return;
  try {
    if (state.entries.length) {
      const { error: upsertError } = await db.from(SUPABASE_TABLE).upsert(state.entries.map(toRemoteEntry), { onConflict: "date" });
      if (upsertError) throw upsertError;
    }
    const { data, error } = await db.from(SUPABASE_TABLE).select("*").order("date", { ascending: true });
    if (error) throw error;
    state.entries = mergeEntries(state.entries, (data || []).map(fromRemoteEntry));
    state.syncReady = true;
    persistEntries();
    showToast("Synced with Supabase");
  } catch (error) {
    console.error(error);
    state.syncReady = false;
    showToast("Using local save until Supabase table is ready");
  }
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

function numberValue(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function rounded(value, digits = 1) {
  if (!Number.isFinite(value)) return "--";
  return value.toFixed(digits).replace(/\.0$/, "");
}

function minutesFromTime(value) {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function sleepHoursFromTimes(bedtime, wakeTime) {
  const bed = minutesFromTime(bedtime);
  const wake = minutesFromTime(wakeTime);
  if (bed == null || wake == null) return 0;
  const minutes = wake >= bed ? wake - bed : wake + 1440 - bed;
  return Math.round((minutes / 60) * 100) / 100;
}

function formatSleepHours(hours) {
  if (!hours) return "--";
  const totalMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${wholeHours}h ${minutes}m` : `${wholeHours}h`;
}

function sortedEntries() {
  return [...state.entries].sort((a, b) => b.date.localeCompare(a.date));
}

function entryByDate(date) {
  return state.entries.find((entry) => entry.date === date);
}

function readiness(entry) {
  if (!entry) return null;
  const sleepScore = Math.min(5, Math.max(1, (entry.sleepHours || 0) / 2));
  const sorenessPenalty = 6 - entry.soreness;
  return Math.round(((sleepScore + entry.sleepQuality + entry.energy + entry.mood + sorenessPenalty) / 25) * 100);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 1800);
}

function renderRating(name) {
  const group = document.querySelector(`[data-rating="${name}"]`);
  const value = numberValue(fields[name].value);
  group.querySelectorAll(".star-row button").forEach((button) => {
    const isActive = numberValue(button.dataset.value) <= value;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-checked", String(numberValue(button.dataset.value) === value));
  });
}

function renderEffort() {
  const value = numberValue(fields.effort.value, 4);
  document.querySelectorAll(".effort-row button").forEach((button) => {
    const isSelected = numberValue(button.dataset.value) === value;
    button.classList.toggle("active", isSelected);
    button.setAttribute("aria-checked", String(isSelected));
  });
}

function updateSleepSummary() {
  const calculatedHours = sleepHoursFromTimes(fields.bedtime.value, fields.wakeTime.value);
  const existingHours = numberValue(fields.sleepHours.value);
  if (calculatedHours) {
    fields.sleepHours.value = calculatedHours;
  }
  const summary = document.querySelector("#sleepSummary");
  const hint = document.querySelector("#sleepHint");
  const displayedHours = calculatedHours || existingHours;
  summary.textContent = displayedHours ? `${formatSleepHours(displayedHours)} sleep` : "Add bedtime and wake-up";

  if (!displayedHours) {
    hint.textContent = "The app will calculate sleep automatically.";
  } else if (!calculatedHours) {
    hint.textContent = "Add times to make tracking easier.";
  } else if (calculatedHours < 8) {
    hint.textContent = "A little short for a teen training day.";
  } else if (calculatedHours <= 10) {
    hint.textContent = "Right in the teen target zone.";
  } else {
    hint.textContent = "Big sleep. Nice recovery deposit.";
  }
}

function updateRangeLabels() {
  document.querySelector("#sleepQualityValue").textContent = fields.sleepQuality.value;
  document.querySelector("#energyValue").textContent = fields.energy.value;
  document.querySelector("#moodValue").textContent = fields.mood.value;
  document.querySelector("#sorenessValue").textContent = fields.soreness.value;
  document.querySelector("#effortValue").textContent = fields.effort.value;
  renderRating("sleepQuality");
  renderRating("energy");
  renderRating("mood");
  renderRating("soreness");
  renderEffort();
}

function readForm() {
  return {
    date: fields.date.value,
    sleepHours: numberValue(fields.sleepHours.value),
    bedtime: fields.bedtime.value,
    wakeTime: fields.wakeTime.value,
    sleepQuality: numberValue(fields.sleepQuality.value, 3),
    energy: numberValue(fields.energy.value, 3),
    mood: numberValue(fields.mood.value, 3),
    soreness: numberValue(fields.soreness.value, 2),
    workoutType: fields.workoutType.value,
    duration: numberValue(fields.duration.value),
    effort: numberValue(fields.effort.value, 4),
    workoutNotes: fields.workoutNotes.value.trim(),
    dailyWin: fields.dailyWin ? fields.dailyWin.value.trim() : "",
    updatedAt: new Date().toISOString()
  };
}

function writeForm(entry) {
  fields.date.value = entry.date || todayString();
  fields.bedtime.value = entry.bedtime || "";
  fields.wakeTime.value = entry.wakeTime || "";
  fields.sleepHours.value = entry.sleepHours || "";
  fields.sleepQuality.value = entry.sleepQuality || 3;
  fields.energy.value = entry.energy || 3;
  fields.mood.value = entry.mood || 3;
  fields.soreness.value = entry.soreness || 2;
  fields.workoutType.value = entry.workoutType || "Rest";
  fields.duration.value = entry.duration || "";
  fields.effort.value = entry.effort || 4;
  fields.workoutNotes.value = entry.workoutNotes || "";
  fields.dailyWin.value = entry.dailyWin || "";
  updateSleepSummary();
  updateRangeLabels();
  updateReadiness();
}

function blankEntry(date = todayString()) {
  return {
    date,
    bedtime: "22:30",
    wakeTime: "06:30",
    sleepHours: 8,
    sleepQuality: 3,
    energy: 3,
    mood: 3,
    soreness: 2,
    workoutType: "Rest",
    effort: 4
  };
}

async function saveEntry(entry) {
  const existingIndex = state.entries.findIndex((item) => item.date === entry.date);
  if (existingIndex >= 0) {
    state.entries[existingIndex] = entry;
  } else {
    state.entries.push(entry);
  }
  persistEntries();

  if (!db) return;
  try {
    const { error } = await db.from(SUPABASE_TABLE).upsert(toRemoteEntry(entry), { onConflict: "date" });
    if (error) throw error;
    state.syncReady = true;
  } catch (error) {
    console.error(error);
    state.syncReady = false;
    showToast("Saved locally; Supabase sync failed");
  }
}

async function deleteEntry(date) {
  state.entries = state.entries.filter((entry) => entry.date !== date);
  persistEntries();

  if (!db) return;
  try {
    const { error } = await db.from(SUPABASE_TABLE).delete().eq("date", date);
    if (error) throw error;
    state.syncReady = true;
  } catch (error) {
    console.error(error);
    state.syncReady = false;
    showToast("Deleted locally; Supabase sync failed");
  }
}

function updateReadiness() {
  const score = readiness(readForm());
  readinessScore.textContent = score == null ? "--" : `${score}%`;
}

function switchTab(tabName) {
  state.activeTab = tabName;
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });
  document.querySelector("#todayPanel").hidden = tabName !== "today";
  document.querySelector("#historyPanel").hidden = tabName !== "history";
  document.querySelector("#insightsPanel").hidden = tabName !== "insights";
  renderAll();
}

function renderStats() {
  const entries = state.entries;
  const workouts = entries.filter((entry) => entry.workoutType !== "Rest" && entry.duration > 0);
  const avgSleep = entries.length ? entries.reduce((sum, entry) => sum + entry.sleepHours, 0) / entries.length : 0;
  const avgEnergy = entries.length ? entries.reduce((sum, entry) => sum + entry.energy, 0) / entries.length : 0;
  const avgMood = entries.length ? entries.reduce((sum, entry) => sum + entry.mood, 0) / entries.length : 0;
  const totalMinutes = workouts.reduce((sum, entry) => sum + entry.duration, 0);

  const stats = [
    ["Entries", entries.length],
    ["Workouts", workouts.length],
    ["Avg sleep", `${rounded(avgSleep)} hr`],
    ["Avg energy", `${rounded(avgEnergy)} / 5`],
    ["Avg mood", `${rounded(avgMood)} / 5`],
    ["Training time", `${totalMinutes} min`]
  ];

  statsGrid.innerHTML = stats
    .map(([label, value]) => `
      <article class="stat-card">
        <span>${label}</span>
        <strong>${value}</strong>
      </article>
    `)
    .join("");
}

function renderHistory() {
  const entries = sortedEntries();
  if (!entries.length) {
    historyList.innerHTML = '<p class="empty-state">No entries yet. Save today&apos;s check-in to start the log.</p>';
    return;
  }

  historyList.innerHTML = entries
    .map((entry) => {
      const score = readiness(entry);
      const note = entry.workoutNotes || entry.dailyWin || "No notes added.";
      return `
        <article class="history-card">
          <div>
            <span class="history-meta">${formatDate(entry.date)} · ${score}% readiness</span>
            <h3>${entry.workoutType} · ${entry.duration || 0} min · RPE ${entry.effort}</h3>
            <p>Sleep ${rounded(entry.sleepHours)} hr · Energy ${entry.energy}/5 · Mood ${entry.mood}/5 · Soreness ${entry.soreness}/5</p>
            <p>${note}</p>
          </div>
          <button type="button" data-edit-date="${entry.date}">Open</button>
        </article>
      `;
    })
    .join("");
}

function recentEntries(days = 14) {
  return [...state.entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-days);
}

function drawChart() {
  const ctx = trendChart.getContext("2d");
  const width = trendChart.width;
  const height = trendChart.height;
  const entries = recentEntries();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#dfe5de";
  ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i += 1) {
    const y = 32 + ((height - 64) / 4) * i;
    ctx.beginPath();
    ctx.moveTo(44, y);
    ctx.lineTo(width - 20, y);
    ctx.stroke();
  }

  if (!entries.length) {
    ctx.fillStyle = "#69756f";
    ctx.font = "700 18px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Save entries to see trends", width / 2, height / 2);
    return;
  }

  const series = [
    ["Sleep", "#267a59", (entry) => Math.min(5, (entry.sleepHours || 0) / 2)],
    ["Energy", "#2f6fa3", (entry) => entry.energy],
    ["Mood", "#d99b2b", (entry) => entry.mood],
    ["Effort", "#cf6254", (entry) => entry.effort / 2]
  ];
  const plotWidth = width - 74;
  const plotHeight = height - 72;
  const xFor = (index) => 44 + (entries.length === 1 ? plotWidth / 2 : (plotWidth / (entries.length - 1)) * index);
  const yFor = (value) => 24 + plotHeight - ((Math.max(1, Math.min(5, value)) - 1) / 4) * plotHeight;

  series.forEach(([label, color, accessor], seriesIndex) => {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    entries.forEach((entry, index) => {
      const x = xFor(index);
      const y = yFor(accessor(entry));
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    entries.forEach((entry, index) => {
      ctx.beginPath();
      ctx.arc(xFor(index), yFor(accessor(entry)), 4, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.font = "800 13px system-ui";
    ctx.fillText(label, 52 + seriesIndex * 122, height - 16);
  });

  ctx.fillStyle = "#69756f";
  ctx.font = "700 12px system-ui";
  ctx.textAlign = "center";
  entries.forEach((entry, index) => {
    const label = entry.date.slice(5).replace("-", "/");
    ctx.fillText(label, xFor(index), height - 38);
  });
  ctx.textAlign = "left";
}

function renderInsights() {
  const entries = sortedEntries();
  if (!entries.length) {
    insightList.innerHTML = '<p class="empty-state">Insights will appear after a few saved entries.</p>';
    drawChart();
    return;
  }

  const avgSleep = entries.reduce((sum, entry) => sum + entry.sleepHours, 0) / entries.length;
  const bestEnergy = [...entries].sort((a, b) => b.energy - a.energy)[0];
  const hardDays = entries.filter((entry) => entry.effort >= 8);
  const restDays = entries.filter((entry) => entry.workoutType === "Rest");
  const lowSleepHardDays = hardDays.filter((entry) => entry.sleepHours < 7);

  const cards = [
    {
      label: "Sleep pattern",
      title: `${rounded(avgSleep)} hours average`,
      body: avgSleep >= 8 ? "Sleep is supporting training well. Keep protecting bedtime." : "A little more sleep would probably help energy and recovery."
    },
    {
      label: "Best energy",
      title: bestEnergy ? `${formatDate(bestEnergy.date)} felt strongest` : "No energy data yet",
      body: bestEnergy ? `Energy was ${bestEnergy.energy}/5 after ${rounded(bestEnergy.sleepHours)} hours of sleep.` : "Save a few entries to find high-energy patterns."
    },
    {
      label: "Load check",
      title: `${hardDays.length} hard day${hardDays.length === 1 ? "" : "s"} logged`,
      body: lowSleepHardDays.length ? `${lowSleepHardDays.length} hard day${lowSleepHardDays.length === 1 ? "" : "s"} happened after less than 7 hours of sleep.` : "Hard days are not stacking on low sleep so far."
    },
    {
      label: "Recovery",
      title: `${restDays.length} rest day${restDays.length === 1 ? "" : "s"}`,
      body: restDays.length ? "Rest days are in the log, which makes the training picture more honest." : "Add rest days too; they matter for the pattern."
    }
  ];

  insightList.innerHTML = cards
    .map((card) => `
      <article class="insight-card">
        <span>${card.label}</span>
        <strong>${card.title}</strong>
        <p>${card.body}</p>
      </article>
    `)
    .join("");
  drawChart();
}

function renderAll() {
  updateReadiness();
  renderStats();
  renderHistory();
  renderInsights();
}

entryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  updateSleepSummary();
  const entry = readForm();
  if (!entry.date) return;
  await saveEntry(entry);
  showToast(state.syncReady ? "Entry saved to Supabase" : "Entry saved locally");
  renderAll();
});

deleteEntryButton.addEventListener("click", async () => {
  const date = fields.date.value;
  const existing = entryByDate(date);
  if (!existing) {
    showToast("No saved entry for this date");
    return;
  }
  await deleteEntry(date);
  writeForm(blankEntry(date));
  showToast(state.syncReady ? "Entry deleted from Supabase" : "Entry deleted locally");
  renderAll();
});

newEntryButton.addEventListener("click", () => {
  writeForm(blankEntry(todayString()));
  showToast("Ready for a new entry");
});

usualSleepButton.addEventListener("click", () => {
  fields.bedtime.value = "22:30";
  fields.wakeTime.value = "06:30";
  updateSleepSummary();
  updateReadiness();
  showToast("Usual sleep filled in");
});

fields.date.addEventListener("change", () => {
  writeForm(entryByDate(fields.date.value) || blankEntry(fields.date.value));
});

[fields.bedtime, fields.wakeTime].forEach((field) => {
  field.addEventListener("input", () => {
    updateSleepSummary();
    updateRangeLabels();
    updateReadiness();
  });
});

document.querySelector(".effort-row").addEventListener("click", (event) => {
  const button = event.target.closest("[data-value]");
  if (!button) return;
  fields.effort.value = button.dataset.value;
  updateRangeLabels();
});

document.querySelectorAll("[data-rating]").forEach((group) => {
  group.addEventListener("click", (event) => {
    const button = event.target.closest("[data-value]");
    if (!button) return;
    const name = group.dataset.rating;
    fields[name].value = button.dataset.value;
    updateRangeLabels();
    updateReadiness();
  });
});

historyList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-edit-date]");
  if (!button) return;
  const entry = entryByDate(button.dataset.editDate);
  if (!entry) return;
  writeForm(entry);
  switchTab("today");
});

document.querySelectorAll(".tab-button").forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});

async function init() {
  writeForm(entryByDate(todayString()) || blankEntry(todayString()));
  renderAll();
  await syncFromSupabase();
  writeForm(entryByDate(fields.date.value) || blankEntry(fields.date.value));
  renderAll();
}

init();
