// Tout le front est ici. Il n'y a ni framework ni étape de compilation pour plus de légèreté :
// le navigateur interprète directement app.js (ce fichier).
const $ = (selector) => document.querySelector(selector);
const groupSelect = $("#group-select");
const nextCard = $("#next-card");
const weekGrid = $("#week-grid");
const weekLabel = $("#week-label");
const syncStatus = $("#sync-status");

const PARIS = "Europe/Paris";
const DAY_START = 7 * 60;
const DAY_END = 19 * 60;
const SLOT = 15;
const HOUR_HEIGHT = 84;
const GRID_HEIGHT = ((DAY_END - DAY_START) / 60) * HOUR_HEIGHT;
const parisParts = new Intl.DateTimeFormat("en-CA", { timeZone: PARIS, year: "numeric", month: "2-digit", day: "2-digit" });
const dayName = new Intl.DateTimeFormat("fr-FR", { timeZone: PARIS, weekday: "short" });
const shortDate = new Intl.DateTimeFormat("fr-FR", { timeZone: PARIS, day: "numeric", month: "short" });
const time = new Intl.DateTimeFormat("fr-FR", { timeZone: PARIS, hour: "2-digit", minute: "2-digit" });
const clock = new Intl.DateTimeFormat("en-GB", { timeZone: PARIS, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

let groupId = localStorage.getItem("edt-group") || "";
let weekStart = monday(new Date());
let events = [];
let staticSite = false;

function parisDate(value) {
  const parts = Object.fromEntries(parisParts.formatToParts(new Date(value)).filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function monday(date) {
  const result = new Date(date);
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  result.setHours(12, 0, 0, 0);
  return result;
}

function addDays(date, number) {
  const result = new Date(date);
  result.setDate(result.getDate() + number);
  return result;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[character]);
}

async function getJson(url) {
  const response = await fetch(url, { cache: staticSite ? "no-store" : "default" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Impossible de charger l’emploi du temps.");
  return data;
}

// GitHub Pages ne possède pas d’API. Le workflow y dépose ce calendrier en JSON.
async function staticSchedule(from, to) {
  const calendar = await getJson("data/schedule.json");
  return {
    events: calendar.events.filter((event) => parisDate(event.startsAt) >= from && parisDate(event.startsAt) <= to),
    fetchedAt: calendar.updatedAt,
    stale: false
  };
}

function colorFor(title) {
  const hue = Math.abs([...title].reduce((total, letter) => total * 31 + letter.charCodeAt(0), 0)) % 360;
  return `${hue} 58% 38%`;
}

function minutesInParis(value) {
  const parts = Object.fromEntries(clock.formatToParts(new Date(value)).filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]));
  return Number(parts.hour) * 60 + Number(parts.minute);
}

function eventPosition(event) {
  if (event.allDay) return "grid-row: 1 / span 3";
  const start = Math.max(minutesInParis(event.startsAt), DAY_START);
  const end = Math.min(Math.max(minutesInParis(event.endsAt), start + 30), DAY_END);
  const row = Math.floor((start - DAY_START) / SLOT) + 1;
  const span = Math.max(3, Math.ceil((end - start) / SLOT));
  return `grid-row: ${row} / span ${span}`;
}

function eventCard(event, compact = false) {
  const hours = event.allDay ? "Toute la journée" : `${time.format(new Date(event.startsAt))} — ${time.format(new Date(event.endsAt))}`;
  const location = event.location ? `<p class="text-body-secondary small mb-0">⌖ ${escapeHtml(event.location)}</p>` : "";
  const details = !compact && event.details?.length ? `<details class="mt-2 small text-body-secondary"><summary>Informations</summary><p class="mb-0 mt-1">${event.details.map(escapeHtml).join("<br>")}</p></details>` : "";
  const position = compact ? "" : `; ${eventPosition(event)}`;
  return `<article class="event card border-0 shadow-sm${compact ? " event-compact" : ""}" style="--tone: ${colorFor(event.title)}${position}"><div class="card-body p-2"><p class="event-time small fw-semibold mb-1">${hours}</p><h3 class="h6 mb-2">${escapeHtml(event.title)}</h3>${location}${details}</div></article>`;
}

function timeRail() {
  const hours = Array.from({ length: 13 }, (_, index) => `<span style="top: ${index * HOUR_HEIGHT}px">${String(index + 7).padStart(2, "0")}h</span>`).join("");
  return `<aside class="time-rail" aria-hidden="true" style="height: ${GRID_HEIGHT}px">${hours}</aside>`;
}

function renderNextCourse() {
  const now = new Date();
  const course = events.find((event) => new Date(event.endsAt) > now);
  nextCard.innerHTML = course ? eventCard(course, true) : '<p class="empty-next">Rien de prévu dans les deux prochaines semaines.</p>';
}

function renderWeek() {
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  weekLabel.textContent = `${shortDate.format(days[0])} — ${shortDate.format(days[6])}`;
  const today = parisDate(new Date());
  weekGrid.innerHTML = timeRail() + days.map((day) => {
    const date = parisDate(day);
    const courses = events.filter((event) => parisDate(event.startsAt) === date);
    const content = courses.length ? courses.map((event) => eventCard(event)).join("") : '<p class="empty-day small text-body-secondary mb-0">Libre</p>';
    return `<section class="day${date === today ? " is-today" : ""}" data-date="${date}"><header class="d-flex justify-content-between align-items-baseline border-bottom pb-2 mb-2 small text-body-secondary"><span class="text-capitalize">${dayName.format(day)}</span><strong class="text-body fw-semibold">${day.getDate()}</strong></header><div class="day-events" style="--hour-height: ${HOUR_HEIGHT}px; --slot-height: ${HOUR_HEIGHT / 4}px">${content}</div></section>`;
  }).join("");

  if (matchMedia("(max-width: 720px)").matches) {
    weekGrid.querySelector(`[data-date="${today}"]`)?.scrollIntoView({ block: "nearest", inline: "start" });
  }
}

async function loadSchedule() {
  if (!groupId) return;
  const from = parisDate(weekStart);
  const to = parisDate(addDays(weekStart, 13));
  syncStatus.textContent = "Mise à jour…";
  try {
    const schedule = staticSite ? await staticSchedule(from, to) : await getJson(`./api/schedule?group=${encodeURIComponent(groupId)}&from=${from}&to=${to}`);
    events = schedule.events;
    renderNextCourse();
    renderWeek();
    const updated = time.format(new Date(schedule.fetchedAt));
    syncStatus.textContent = schedule.stale ? `Dernière version disponible — synchronisée à ${updated}` : `Synchronisé à ${updated}`;
  } catch (error) {
    const message = escapeHtml(error.message);
    nextCard.innerHTML = `<p class="error-message">${message}</p>`;
    weekGrid.innerHTML = '<p class="error-message">Réessaie dans quelques instants.</p>';
    syncStatus.textContent = "Synchronisation indisponible";
  }
}

async function start() {
  try {
    let groups;
    if (window.EDT_STATIC_SITE) {
      groups = await getJson("data/groups.json");
      staticSite = true;
    } else {
      groups = await getJson("./api/groups");
    }
    groupSelect.innerHTML = groups.map((group) => `<option value="${escapeHtml(group.id)}">${escapeHtml(group.label)}</option>`).join("");
    groupId = groups.some((group) => group.id === groupId) ? groupId : groups[0]?.id;
    groupSelect.value = groupId;
    await loadSchedule();
  } catch (error) {
    nextCard.innerHTML = `<p class="error-message">${escapeHtml(error.message)}</p>`;
  }
}

groupSelect.addEventListener("change", () => { groupId = groupSelect.value; localStorage.setItem("edt-group", groupId); loadSchedule(); });
$("#refresh-button").addEventListener("click", loadSchedule);
$("#previous-week").addEventListener("click", () => { weekStart = addDays(weekStart, -7); loadSchedule(); });
$("#next-week").addEventListener("click", () => { weekStart = addDays(weekStart, 7); loadSchedule(); });
$("#current-week").addEventListener("click", () => { weekStart = monday(new Date()); loadSchedule(); });

start();
