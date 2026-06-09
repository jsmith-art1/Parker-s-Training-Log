/* ─────────────────────────────────────────────
   Smith Family Training Log — app.js v4.1
   Multi-user: Parker · Justin · Shelby
───────────────────────────────────────────── */

// ── User config ───────────────────────────────
const USERS = {
  parker: { label: 'Parker', emoji: '🏃', sleepTarget: [8, 10] },
  justin: { label: 'Justin', emoji: '💪', sleepTarget: [7, 9]  },
  shelby: { label: 'Shelby', emoji: '⚡', sleepTarget: [7, 9]  },
};

let currentUser = localStorage.getItem('activeUser') || 'parker';

// ── Storage helpers ───────────────────────────
function storageKey(suffix) {
  return `trainingLog_${currentUser}_${suffix}`;
}
function loadEntries() {
  try { return JSON.parse(localStorage.getItem(storageKey('entries'))) || {}; }
  catch { return {}; }
}
function saveEntries(entries) {
  localStorage.setItem(storageKey('entries'), JSON.stringify(entries));
}

// ── Utility helpers ───────────────────────────
function today() {
  return new Date().toISOString().slice(0, 10);
}
function calcSleep(bedtime, wakeTime) {
  if (!bedtime || !wakeTime) return null;
  const [bh, bm] = bedtime.split(':').map(Number);
  const [wh, wm] = wakeTime.split(':').map(Number);
  let mins = (wh * 60 + wm) - (bh * 60 + bm);
  if (mins <= 0) mins += 24 * 60;
  return +(mins / 60).toFixed(1);
}
function sleepHint(hours) {
  const [lo, hi] = USERS[currentUser].sleepTarget;
  if (hours === null) return '';
  if (hours < lo) return `${lo - hours}h short of target.`;
  if (hours > hi) return `${hours - hi}h over the top — still good!`;
  return 'Right in the target zone.';
}
function calcReadiness(entry) {
  const { sleepHours, sleepQuality, energy, mood, soreness } = entry;
  if (!sleepHours) return null;
  const sleepScore = Math.min(sleepHours / 9, 1) * 5;
  const raw = (sleepScore + +sleepQuality + +energy + +mood + (6 - +soreness)) / 5;
  return Math.round(raw * 10) / 10;
}
function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
let toastTimer;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

// ── Ratings ───────────────────────────────────
function setRating(name, val) {
  document.getElementById(name).value = val;
  document.getElementById(name + 'Value').textContent = val;
  document.querySelector(`[data-rating="${name}"] .star-row`)
    .querySelectorAll('button').forEach(b => {
      b.classList.toggle('active', +b.dataset.value <= val);
      b.setAttribute('aria-checked', +b.dataset.value === val ? 'true' : 'false');
    });
}
function setEffort(val) {
  document.getElementById('effort').value = val;
  document.getElementById('effortValue').textContent = val;
  document.querySelectorAll('.effort-row button').forEach(b => {
    b.classList.toggle('active', +b.dataset.value <= val);
    b.setAttribute('aria-checked', +b.dataset.value === val ? 'true' : 'false');
  });
}

// ── Sleep display ─────────────────────────────
function updateSleepDisplay() {
  const bedtime  = document.getElementById('bedtime').value;
  const wakeTime = document.getElementById('wakeTime').value;
  const hours    = calcSleep(bedtime, wakeTime);
  document.getElementById('sleepHours').value       = hours !== null ? hours : 8;
  document.getElementById('sleepSummary').textContent = hours !== null ? `${hours}h sleep` : '-- sleep';
  document.getElementById('sleepHint').textContent    = sleepHint(hours);
  updateReadiness();
}

// ── Readiness ─────────────────────────────────
function updateReadiness() {
  const entry = readFormValues();
  const score = calcReadiness(entry);
  document.getElementById('readinessScore').textContent = score !== null ? score.toFixed(1) : '--';
}

// ── Form ──────────────────────────────────────
function readFormValues() {
  return {
    date:         document.getElementById('entryDate').value,
    bedtime:      document.getElementById('bedtime').value,
    wakeTime:     document.getElementById('wakeTime').value,
    sleepHours:   +document.getElementById('sleepHours').value,
    sleepQuality: +document.getElementById('sleepQuality').value,
    energy:       +document.getElementById('energy').value,
    mood:         +document.getElementById('mood').value,
    soreness:     +document.getElementById('soreness').value,
    workoutType:  document.getElementById('workoutType').value,
    duration:     +document.getElementById('duration').value || 0,
    effort:       +document.getElementById('effort').value,
    notes:        document.getElementById('workoutNotes').value.trim(),
  };
}
function populateForm(entry) {
  document.getElementById('entryDate').value  = entry.date     || today();
  document.getElementById('bedtime').value    = entry.bedtime  || '';
  document.getElementById('wakeTime').value   = entry.wakeTime || '';
  document.getElementById('sleepHours').value = entry.sleepHours || 8;
  updateSleepDisplay();
  setRating('sleepQuality', entry.sleepQuality || 3);
  setRating('energy',       entry.energy       || 3);
  setRating('mood',         entry.mood         || 3);
  setRating('soreness',     entry.soreness     || 2);
  setEffort(entry.effort || 4);
  document.getElementById('workoutType').value  = entry.workoutType || 'Rest';
  document.getElementById('duration').value     = entry.duration    || '';
  document.getElementById('workoutNotes').value = entry.notes       || '';
  updateReadiness();
}
function resetForm() {
  populateForm({ date: today() });
}
function loadTodayEntry() {
  const entries = loadEntries();
  const d = today();
  entries[d] ? populateForm(entries[d]) : resetForm();
}

// ── Tab switching ─────────────────────────────
let activeTab = 'today';

function showTab(name) {
  activeTab = name;
  document.querySelectorAll('.tab-button').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === name)
  );
  ['today', 'history', 'insights'].forEach(key => {
    const panel = document.getElementById(key + 'Panel');
    if (panel) panel.hidden = key !== name;
  });
  if (name === 'history')  renderHistory();
  if (name === 'insights') renderInsights();
}

// ── User switching ────────────────────────────
function switchUser(user) {
  currentUser = user;
  localStorage.setItem('activeUser', user);

  // Update user button states
  document.querySelectorAll('.user-button').forEach(b =>
    b.classList.toggle('active', b.dataset.user === user)
  );

  // Update header
  const info = USERS[user];
  document.getElementById('headerTitle').textContent = `${info.label}'s Training Log`;
  document.title = `${info.label} Training Log`;

  // Reload data for this user
  loadTodayEntry();

  // Re-render whichever tab is open
  showTab(activeTab);
}

// ── History ───────────────────────────────────
function calcStreak(sortedEntries) {
  if (!sortedEntries.length) return 0;
  const dates = sortedEntries.map(e => e.date).sort().reverse();
  let streak = 0;
  let cursor = new Date(today());
  for (const d of dates) {
    const dd   = new Date(d);
    const diff = Math.round((cursor - dd) / 86400000);
    if (diff <= 1) { streak++; cursor = dd; } else break;
  }
  return streak;
}

function renderHistory() {
  const entries = loadEntries();
  const sorted  = Object.values(entries).sort((a, b) => b.date.localeCompare(a.date));

  const totalWorkouts = sorted.filter(e => e.workoutType !== 'Rest').length;
  const avgSleep  = sorted.length ? (sorted.reduce((s,e) => s + (e.sleepHours||0), 0) / sorted.length).toFixed(1) : '--';
  const avgEnergy = sorted.length ? (sorted.reduce((s,e) => s + (e.energy||0),     0) / sorted.length).toFixed(1) : '--';
  const streak    = calcStreak(sorted);

  document.getElementById('statsGrid').innerHTML = `
    <div class="stat-card"><span>Entries</span><strong>${sorted.length}</strong></div>
    <div class="stat-card"><span>Workouts</span><strong>${totalWorkouts}</strong></div>
    <div class="stat-card"><span>Avg sleep</span><strong>${avgSleep}h</strong></div>
    <div class="stat-card"><span>Avg energy</span><strong>${avgEnergy}/5</strong></div>
    <div class="stat-card"><span>Streak</span><strong>${streak}d</strong></div>
  `;

  const historyList = document.getElementById('historyList');
  if (!sorted.length) {
    historyList.innerHTML = '<p class="empty-state">No entries yet. Log your first day!</p>';
    return;
  }

  historyList.innerHTML = sorted.map(e => `
    <div class="history-card" data-date="${e.date}">
      <div class="history-date">
        <strong>${formatDate(e.date)}</strong>
        <span class="workout-badge">${e.workoutType || 'Rest'}</span>
      </div>
      <div class="history-metrics">
        <span>😴 ${e.sleepHours||'--'}h</span>
        <span>⚡ ${e.energy||'--'}/5</span>
        <span>😊 ${e.mood||'--'}/5</span>
        <span>💪 ${e.soreness||'--'}/5</span>
        ${e.duration ? `<span>⏱ ${e.duration}m</span>` : ''}
        ${e.effort   ? `<span>🔥 RPE ${e.effort}</span>` : ''}
      </div>
      ${e.notes ? `<p class="history-notes">${escapeHtml(e.notes)}</p>` : ''}
    </div>
  `).join('');

  historyList.querySelectorAll('.history-card').forEach(card => {
    card.addEventListener('click', () => {
      const entry = loadEntries()[card.dataset.date];
      if (entry) { populateForm(entry); showTab('today'); }
    });
  });
}

// ── Insights ──────────────────────────────────
function renderInsights() {
  const entries = loadEntries();
  const sorted  = Object.values(entries).sort((a, b) => a.date.localeCompare(b.date));
  drawChart(sorted.slice(-14));
  renderInsightCards(sorted);
}

function drawChart(entries) {
  const canvas = document.getElementById('trendChart');
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (!entries.length) {
    ctx.fillStyle = '#888';
    ctx.font = '16px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('No data yet — log some entries!', w / 2, h / 2);
    return;
  }

  const padL = 40, padR = 20, padT = 20, padB = 40;
  const cw = w - padL - padR, ch = h - padT - padB;
  const n  = entries.length;

  ctx.strokeStyle = 'rgba(128,128,128,0.15)';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 5; i++) {
    const y = padT + ch - (i / 5) * ch;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + cw, y); ctx.stroke();
    ctx.fillStyle = '#888'; ctx.font = '11px system-ui'; ctx.textAlign = 'right';
    ctx.fillText(i, padL - 6, y + 4);
  }

  ctx.fillStyle = '#888'; ctx.font = '11px system-ui'; ctx.textAlign = 'center';
  entries.forEach((e, i) => {
    if (i % Math.ceil(n / 7) === 0 || i === n - 1) {
      const x = padL + (n > 1 ? i * cw / (n - 1) : 0);
      ctx.fillText(e.date.slice(5), x, h - padB + 16);
    }
  });

  const lines = [
    { key: 'sleepQuality', label: 'Sleep',  color: '#6366f1' },
    { key: 'energy',       label: 'Energy', color: '#f59e0b' },
    { key: 'mood',         label: 'Mood',   color: '#10b981' },
    { key: 'effort',       label: 'Effort', color: '#ef4444', scale: 0.5 },
  ];

  lines.forEach(({ key, color, scale = 1 }) => {
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    entries.forEach((e, i) => {
      const val = (e[key] || 0) * scale;
      const x   = padL + (n > 1 ? i * cw / (n - 1) : 0);
      const y   = padT + ch - (val / 5) * ch;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  });

  lines.forEach(({ label, color }, i) => {
    const lx = padL + i * 100;
    ctx.fillStyle = color; ctx.fillRect(lx, padT + 4, 18, 3);
    ctx.fillStyle = '#888'; ctx.textAlign = 'left';
    ctx.fillText(label, lx + 22, padT + 9);
  });
}

function renderInsightCards(entries) {
  const insightList = document.getElementById('insightList');
  if (entries.length < 3) {
    insightList.innerHTML = '<p class="empty-state">Log at least 3 days for insights.</p>';
    return;
  }
  const recent7 = entries.slice(-7), prev7 = entries.slice(-14, -7);
  const avg = (arr, key) => arr.length ? arr.reduce((s,e) => s + (e[key]||0), 0) / arr.length : 0;
  const insights = [];

  const energyDelta = avg(recent7,'energy')     - avg(prev7,'energy');
  const sleepDelta  = avg(recent7,'sleepHours') - avg(prev7,'sleepHours');
  const moodDelta   = avg(recent7,'mood')        - avg(prev7,'mood');

  if (Math.abs(energyDelta) >= 0.4) insights.push({ icon:'⚡', text:`Energy is ${energyDelta>0?'up':'down'} ${Math.abs(energyDelta).toFixed(1)} pts vs. last week.` });
  if (Math.abs(sleepDelta)  >= 0.3) insights.push({ icon:'😴', text:`Averaging ${Math.abs(sleepDelta).toFixed(1)}h ${sleepDelta>0?'more':'less'} sleep than last week.` });
  if (Math.abs(moodDelta)   >= 0.4) insights.push({ icon:'😊', text:`Mood is ${moodDelta>0?'improving':'dipping'} this week.` });

  const highSoreness = recent7.filter(e => (e.soreness||0) >= 4).length;
  if (highSoreness >= 3) insights.push({ icon:'💪', text:`${highSoreness} high-soreness days — consider extra recovery.` });

  const workouts = recent7.filter(e => e.workoutType !== 'Rest').length;
  if (workouts >= 6)                      insights.push({ icon:'🔥', text:`${workouts} workout days this week — great consistency!` });
  else if (workouts <= 2 && entries.length > 7) insights.push({ icon:'📅', text:`Only ${workouts} workouts this week — easy week?` });

  if (!insights.length) insights.push({ icon:'✅', text:'All metrics look steady. Keep showing up!' });

  insightList.innerHTML = insights.map(i =>
    `<div class="insight-card"><span class="insight-icon">${i.icon}</span><p>${i.text}</p></div>`
  ).join('');
}

// ── Boot — wire everything up once DOM is ready ──
function init() {
  // User switcher buttons
  document.querySelectorAll('.user-button').forEach(btn =>
    btn.addEventListener('click', () => switchUser(btn.dataset.user))
  );

  // Tab buttons
  document.querySelectorAll('.tab-button').forEach(btn =>
    btn.addEventListener('click', () => showTab(btn.dataset.tab))
  );

  // Star rating buttons
  document.querySelectorAll('.star-row').forEach(row => {
    row.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = row.closest('[data-rating]').dataset.rating;
        setRating(name, +btn.dataset.value);
        updateReadiness();
      });
    });
  });

  // RPE buttons
  document.querySelectorAll('.effort-row button').forEach(btn =>
    btn.addEventListener('click', () => { setEffort(+btn.dataset.value); updateReadiness(); })
  );

  // Sleep inputs
  document.getElementById('bedtime').addEventListener('change', updateSleepDisplay);
  document.getElementById('wakeTime').addEventListener('change', updateSleepDisplay);

  // Same-as-usual sleep
  document.getElementById('usualSleepButton').addEventListener('click', () => {
    const usual = JSON.parse(localStorage.getItem(storageKey('usualSleep')) || 'null');
    if (!usual) { showToast('No usual sleep saved yet.'); return; }
    document.getElementById('bedtime').value  = usual.bedtime;
    document.getElementById('wakeTime').value = usual.wakeTime;
    updateSleepDisplay();
  });

  // Save entry
  document.getElementById('entryForm').addEventListener('submit', e => {
    e.preventDefault();
    const entry   = readFormValues();
    const entries = loadEntries();
    entries[entry.date] = entry;
    saveEntries(entries);
    if (entry.bedtime && entry.wakeTime) {
      localStorage.setItem(storageKey('usualSleep'), JSON.stringify({ bedtime: entry.bedtime, wakeTime: entry.wakeTime }));
    }
    showToast('Entry saved ✓');
  });

  // New day
  document.getElementById('newEntryButton').addEventListener('click', () => {
    resetForm();
    showToast('Ready for a new day.');
  });

  // Delete entry
  document.getElementById('deleteEntryButton').addEventListener('click', () => {
    const d = document.getElementById('entryDate').value;
    if (!d) return;
    const entries = loadEntries();
    if (!entries[d]) { showToast('Nothing to delete.'); return; }
    delete entries[d];
    saveEntries(entries);
    resetForm();
    showToast('Entry deleted.');
  });

  // Set initial user (triggers header, loads data, renders tab)
  switchUser(currentUser);
}

document.addEventListener('DOMContentLoaded', init);
