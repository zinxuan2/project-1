const moods = [
  { id: "radiant", label: "Radiant", face: "☀", color: "#f1b93f", tint: "#fff1c9", phrase: "A bright patch of sky" },
  { id: "good", label: "Good", face: "☺", color: "#e77b5d", tint: "#fae1d7", phrase: "A little warmth" },
  { id: "steady", label: "Steady", face: "◡", color: "#5a9a86", tint: "#d9eee5", phrase: "Somewhere in the middle" },
  { id: "low", label: "Low", face: "☁", color: "#7193b8", tint: "#dce7f1", phrase: "A softer, quieter day" },
  { id: "anxious", label: "Anxious", face: "〰", color: "#a27ba4", tint: "#eee1ef", phrase: "A few clouds passing through" },
];

const moodGrid = document.querySelector("#mood-grid");
const intensity = document.querySelector("#intensity");
const intensityValue = document.querySelector("#intensity-value");
const note = document.querySelector("#note");
const saveButton = document.querySelector("#save-button");
const undoButton = document.querySelector("#undo-button");
const saveStatus = document.querySelector("#save-status");
const dayDetail = document.querySelector("#day-detail");
const dayDetailDate = document.querySelector("#day-detail-date");
const dayDetailContent = document.querySelector("#day-detail-content");
let selectedMood = null;
let entries = [];
let savedToday = null;
let undoSnapshot = null;
let selectedDayOffset = 0;

function localDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function moodFor(id) {
  return moods.find((mood) => mood.id === id);
}

function renderMoodChoices() {
  moodGrid.innerHTML = moods.map((mood) => `
    <button class="mood-choice" type="button" data-mood="${mood.id}" aria-pressed="false" style="--mood-color:${mood.color};--mood-tint:${mood.tint}">
      <span class="mood-face" aria-hidden="true">${mood.face}</span>
      <span class="mood-name">${mood.label}</span>
    </button>
  `).join("");

  moodGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-mood]");
    if (!button) return;
    selectedMood = selectedMood === button.dataset.mood ? null : button.dataset.mood;
    moodGrid.querySelectorAll("[data-mood]").forEach((choice) => {
      choice.setAttribute("aria-pressed", String(choice.dataset.mood === selectedMood));
    });
    document.documentElement.style.setProperty("--selected-color", selectedMood ? moodFor(selectedMood).color : "#477b69");
    saveButton.disabled = !selectedMood;
    saveStatus.textContent = "";
  });
}

function weekDates() {
  const today = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return date;
  });
}

function renderWeek() {
  const byDay = new Map(entries.map((entry) => [entry.day, entry]));
  const days = weekDates();
  const filled = days.filter((day) => byDay.has(localDate(day))).length;
  document.querySelector("#week-count").innerHTML = `${filled} <small>of 7</small>`;

  document.querySelector("#week-chart").innerHTML = days.map((day, index) => {
    const entry = byDay.get(localDate(day));
    const mood = entry && moodFor(entry.mood);
    const isToday = localDate(day) === localDate(new Date());
    const label = day.toLocaleDateString(undefined, { weekday: "short" });
    const title = entry ? `${mood.label}, intensity ${entry.intensity} of 5` : "No check-in";
    const height = entry ? `${Math.max(18, entry.intensity * 16)}%` : "8%";
    const dateLabel = day.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    return `<button class="day-column ${isToday ? "is-today" : ""}" type="button" data-day-index="${index}" aria-label="${dateLabel}: ${title}" aria-pressed="${index === 6 - selectedDayOffset}">
      <div class="day-mark ${entry ? "has-entry" : ""}" style="--bar-color:${mood ? mood.color : "#dedbd1"};--bar-height:${height}">${entry ? `<span>${mood.face}</span>` : ""}</div>
      <span class="day-label">${label}</span>
    </button>`;
  }).join("");
  renderDayDetail();

  const todaysEntry = byDay.get(localDate(new Date()));
  if (todaysEntry) {
    const mood = moodFor(todaysEntry.mood);
    document.querySelector("#reflection").innerHTML = `<span class="reflection-mark" aria-hidden="true">↳</span><p>Today, you’re feeling<br><strong style="color:${mood.color}">${mood.label.toLowerCase()}.</strong> ${mood.phrase}.</p>`;
  } else if (filled > 0) {
    document.querySelector("#reflection").innerHTML = `<span class="reflection-mark" aria-hidden="true">↳</span><p>You showed up for yourself<br><strong>${filled} ${filled === 1 ? "day" : "days"}</strong> this week.</p>`;
  }

}

function oldestEntryOffset() {
  if (entries.length === 0) return 0;
  const oldestDay = entries.reduce((oldest, entry) => entry.day < oldest ? entry.day : oldest, entries[0].day);
  const oldestDate = new Date(`${oldestDay}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.max(0, Math.round((today - oldestDate) / 86400000));
}

function renderDayDetail() {
  const day = new Date();
  day.setDate(day.getDate() - selectedDayOffset);
  const dayKey = localDate(day);
  const entry = entries.find((item) => item.day === dayKey);
  dayDetailDate.textContent = day.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  document.querySelector("#previous-day").disabled = selectedDayOffset >= oldestEntryOffset();
  document.querySelector("#next-day").disabled = selectedDayOffset === 0;
  document.querySelectorAll("#week-chart [data-day-index]").forEach((button) => {
    button.setAttribute("aria-pressed", String(Number(button.dataset.dayIndex) === 6 - selectedDayOffset));
  });
  dayDetailContent.replaceChildren();

  const detail = document.createElement("p");
  if (entry) {
    const mood = moodFor(entry.mood);
    detail.className = "day-entry-summary";
    detail.textContent = `${mood.face} ${mood.label} · intensity ${entry.intensity} of 5`;
    dayDetailContent.append(detail);
    const entryNote = document.createElement("p");
    entryNote.className = "day-entry-note";
    entryNote.textContent = entry.note || "No note saved for this day.";
    dayDetailContent.append(entryNote);
  } else {
    detail.className = "day-entry-empty";
    detail.textContent = "No check-in saved for this day.";
    dayDetailContent.append(detail);
  }
}

function moveSelectedDay(offset) {
  selectedDayOffset = Math.max(0, Math.min(oldestEntryOffset(), selectedDayOffset + offset));
  renderDayDetail();
}

async function loadEntries() {
  try {
    const response = await fetch("/api/entries?all=1");
    if (!response.ok) throw new Error("Could not load check-ins");
    entries = await response.json();
    renderWeek();
    const todaysEntry = entries.find((entry) => entry.day === localDate(new Date()));
    if (todaysEntry) {
      savedToday = todaysEntry;
      selectedMood = todaysEntry.mood;
      const selectedButton = moodGrid.querySelector(`[data-mood="${selectedMood}"]`);
      selectedButton?.setAttribute("aria-pressed", "true");
      document.documentElement.style.setProperty("--selected-color", moodFor(selectedMood).color);
      intensity.value = todaysEntry.intensity;
      intensityValue.value = `${todaysEntry.intensity} / 5`;
      note.value = todaysEntry.note;
      saveButton.disabled = false;
      document.querySelector("#char-count").textContent = `${note.value.length} / 280`;
      undoButton.hidden = false;
    }
  } catch (error) {
    saveStatus.textContent = "Can’t reach the local server. Try refreshing.";
  }
}

document.querySelector("#week-chart").addEventListener("click", (event) => {
  const button = event.target.closest("[data-day-index]");
  if (!button) return;
  selectedDayOffset = 6 - Number(button.dataset.dayIndex);
  renderDayDetail();
});

document.querySelector("#previous-day").addEventListener("click", () => moveSelectedDay(1));
document.querySelector("#next-day").addEventListener("click", () => moveSelectedDay(-1));

let swipeStartX = null;
dayDetail.addEventListener("touchstart", (event) => {
  swipeStartX = event.changedTouches[0].screenX;
}, { passive: true });
dayDetail.addEventListener("touchend", (event) => {
  if (swipeStartX === null) return;
  const swipeDistance = event.changedTouches[0].screenX - swipeStartX;
  swipeStartX = null;
  if (Math.abs(swipeDistance) >= 40) moveSelectedDay(swipeDistance < 0 ? 1 : -1);
}, { passive: true });

intensity.addEventListener("input", () => {
  intensityValue.value = `${intensity.value} / 5`;
});

note.addEventListener("input", () => {
  document.querySelector("#char-count").textContent = `${note.value.length} / 280`;
});

saveButton.addEventListener("click", async () => {
  if (!selectedMood) return;
  saveButton.disabled = true;
  saveStatus.textContent = "Saving…";
  try {
    const response = await fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mood: selectedMood, intensity: Number(intensity.value), note: note.value }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not save check-in");
    undoSnapshot = savedToday ? { ...savedToday } : null;
    savedToday = result;
    entries = [...entries.filter((entry) => entry.day !== result.day), result];
    renderWeek();
    undoButton.hidden = false;
    saveStatus.textContent = "Saved for today. Be gentle with yourself.";
  } catch (error) {
    saveStatus.textContent = error.message;
    saveButton.disabled = false;
  }
});

undoButton.addEventListener("click", async () => {
  undoButton.disabled = true;
  saveStatus.textContent = "Undoing…";
  try {
    const hadPreviousEntry = Boolean(undoSnapshot);
    const response = await fetch("/api/entries", hadPreviousEntry ? {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(undoSnapshot),
    } : { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not undo save");
    savedToday = hadPreviousEntry ? result : null;
    undoSnapshot = null;
    entries = entries.filter((entry) => entry.day !== result.day);
    if (savedToday) entries.push(savedToday);
    selectedMood = savedToday?.mood || null;
    moodGrid.querySelectorAll("[data-mood]").forEach((choice) => {
      choice.setAttribute("aria-pressed", String(choice.dataset.mood === selectedMood));
    });
    document.documentElement.style.setProperty("--selected-color", selectedMood ? moodFor(selectedMood).color : "#477b69");
    intensity.value = savedToday?.intensity || 3;
    intensityValue.value = `${intensity.value} / 5`;
    note.value = savedToday?.note || "";
    document.querySelector("#char-count").textContent = `${note.value.length} / 280`;
    saveButton.disabled = !selectedMood;
    undoButton.hidden = true;
    renderWeek();
    saveStatus.textContent = "Last save undone.";
  } catch (error) {
    saveStatus.textContent = error.message;
    undoButton.disabled = false;
  }
});

document.querySelector("#today-label").textContent = new Date().toLocaleDateString(undefined, {
  weekday: "long", month: "long", day: "numeric",
});
renderMoodChoices();
loadEntries();
