import { ROUTINES, getRoutine } from "./data/routines.js";
import {
  migrateLegacyData,
  loadDB,
  saveDB,
  loadSettings,
  saveSettings,
  loadDraft,
  saveDraft,
  clearDraft,
  loadActiveRoutineId,
  saveActiveRoutineId,
  resetForgeData,
  makeBackup,
  restoreBackup
} from "./core/storage.js";
import {
  createRoutineState,
  addWorkSet,
  sessionStats
} from "./core/workout.js";
import { uid, formatClock } from "./core/utils.js";
import { renderDashboard } from "./views/dashboardView.js";
import { renderRoutineSelector, renderRoutineList } from "./views/routineView.js";
import { renderWorkout } from "./views/workoutView.js";
import { renderProgress } from "./views/progressView.js";

const state = {
  routineId: "dia1",
  workoutStart: null,
  exercises: [],
  restInterval: null,
  restRemaining: 0,
  restTotal: 0
};

function currentRoutine() {
  return getRoutine(state.routineId);
}

function draftPayload() {
  return {
    version: 1,
    routineId: state.routineId,
    workoutStart: state.workoutStart,
    exercises: state.exercises
  };
}

function persistDraft() {
  saveDraft(draftPayload());
}

function hasCompletedSets(exercises = []) {
  return exercises.some(exercise =>
    (exercise.sets || []).some(set => set.done)
  );
}

function loadOrCreateDraft() {
  const db = loadDB();
  const saved = loadDraft();

  if (
    saved?.version === 1 &&
    saved.routineId === state.routineId &&
    Array.isArray(saved.exercises) &&
    saved.exercises.length === currentRoutine().exercises.length
  ) {
    state.exercises = saved.exercises;

    // Compatibilidad con la versión anterior: si todavía no se había
    // registrado ninguna serie, el cronómetro debe seguir en 00:00.
    state.workoutStart = hasCompletedSets(saved.exercises)
      ? (saved.workoutStart || Date.now())
      : null;

    persistDraft();
    return;
  }

  state.workoutStart = null;
  state.exercises = createRoutineState(currentRoutine(), db);
  persistDraft();
}

function startWorkout() {
  if (state.workoutStart) return;
  state.workoutStart = Date.now();
  persistDraft();
}

function enterWorkout() {
  startWorkout();
  switchTab("train");
}

function renderAll() {
  const db = loadDB();
  const draft = loadDraft();

  renderRoutineSelector(ROUTINES, state.routineId);
  renderRoutineList(ROUTINES, state.routineId);
  renderDashboard(db, currentRoutine(), draft);
  renderWorkout(currentRoutine(), state);
  renderProgress(db, currentRoutine());
  applySettingsToUI();
}

function applySettingsToUI() {
  const settings = loadSettings();
  document.body.classList.toggle("light", settings.theme === "light");
  document.querySelector("#restSelect").value = String(settings.rest ?? 180);
}

function switchTab(name) {
  document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.add("hidden"));
  document.querySelector(`#tab-${name}`)?.classList.remove("hidden");

  document.querySelectorAll(".bottom-nav button").forEach(button => {
    button.classList.toggle("active", button.dataset.tab === name);
  });

  if (name === "today") {
    renderDashboard(loadDB(), currentRoutine(), loadDraft());
  } else if (name === "progress") {
    renderProgress(loadDB(), currentRoutine());
  } else if (name === "routines") {
    renderRoutineList(ROUTINES, state.routineId);
  }
}

function toast(message) {
  const element = document.querySelector("#toast");
  element.textContent = message;
  element.classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.add("hidden"), 2200);
}

function activateRoutine(id) {
  if (id === state.routineId) {
    enterWorkout();
    return;
  }

  const stats = sessionStats(state.exercises);
  if (stats.completedSets > 0) {
    const confirmed = confirm("Tienes una sesión en curso. ¿Cambiar de día y descartar esa sesión activa?");
    if (!confirmed) {
      renderRoutineSelector(ROUTINES, state.routineId);
      return;
    }
  }

  state.routineId = id;
  saveActiveRoutineId(id);
  clearDraft();
  loadOrCreateDraft();
  renderAll();
  enterWorkout();
}

function editSet(target) {
  const exerciseIndex = Number(target.dataset.exerciseIndex);
  const setIndex = Number(target.dataset.setIndex);
  const field = target.dataset.field;
  const set = state.exercises[exerciseIndex]?.sets[setIndex];
  if (!set || !["weight", "reps", "rir"].includes(field)) return;

  const raw = target.value;
  set[field] = raw === "" ? "" : Number(raw);
  persistDraft();

  if (field === "weight" || field === "reps") {
    const stats = sessionStats(state.exercises);
    document.querySelector("#sessionVolume").textContent =
      `${Math.round(stats.volume).toLocaleString("es-ES")} kg`;
  }
}

function toggleSet(exerciseIndex, setIndex) {
  const exercise = state.exercises[exerciseIndex];
  const set = exercise?.sets[setIndex];
  if (!set) return;

  if (set.done) {
    set.done = false;
    persistDraft();
    renderWorkout(currentRoutine(), state);
    renderDashboard(loadDB(), currentRoutine(), loadDraft());
    return;
  }

  if (!Number(set.reps || 0)) {
    toast("Introduce las repeticiones.");
    return;
  }

  // Seguridad: si por cualquier motivo se completa una serie sin haber
  // entrado mediante el botón Entrenar, aquí comienza la sesión.
  startWorkout();

  set.done = true;
  persistDraft();
  renderWorkout(currentRoutine(), state);
  renderDashboard(loadDB(), currentRoutine(), loadDraft());
  startRestIfEnabled();
}

function startRestIfEnabled() {
  const rest = Number(loadSettings().rest || 0);
  if (rest <= 0) return;

  state.restTotal = rest;
  state.restRemaining = rest;
  document.querySelector("#restOverlay").classList.remove("hidden");
  updateRestUI();

  clearInterval(state.restInterval);
  state.restInterval = setInterval(() => {
    state.restRemaining -= 1;
    updateRestUI();

    if (state.restRemaining <= 0) {
      stopRest();
      toast("Aviso de descanso terminado.");
      navigator.vibrate?.([120, 70, 120]);
    }
  }, 1000);
}

function updateRestUI() {
  document.querySelector("#restTime").textContent = formatClock(state.restRemaining);
  const percent = state.restTotal
    ? Math.max(0, Math.min(100, state.restRemaining / state.restTotal * 100))
    : 0;
  document.querySelector("#restProgress").style.width = `${percent}%`;
}

function stopRest() {
  clearInterval(state.restInterval);
  state.restInterval = null;
  document.querySelector("#restOverlay").classList.add("hidden");
}

function finishWorkout() {
  const stats = sessionStats(state.exercises);

  if (!stats.completedSets) {
    toast("No hay series efectivas completadas.");
    return;
  }

  if (stats.completedSets < stats.totalSets) {
    const confirmed = confirm(
      `Has completado ${stats.completedSets} de ${stats.totalSets} series efectivas. ¿Guardar el entrenamiento igualmente?`
    );
    if (!confirmed) return;
  }

  const exercises = state.exercises
    .map(exercise => ({
      name: exercise.name,
      sets: exercise.sets
        .filter(set => set.done)
        .map(set => ({
          type: set.type,
          weight: Number(set.weight || 0),
          reps: Number(set.reps || 0),
          rir: set.type === "work" ? Number(set.rir ?? 1) : null
        }))
    }))
    .filter(exercise => exercise.sets.length);

  const db = loadDB();
  db.workouts.push({
    id: uid(),
    date: new Date().toISOString(),
    routineId: state.routineId,
    name: `${currentRoutine().name} · ${currentRoutine().subtitle}`,
    durationSec: state.workoutStart
      ? Math.floor((Date.now() - state.workoutStart) / 1000)
      : 0,
    exercises
  });

  saveDB(db);
  clearDraft();
  state.workoutStart = null;
  state.exercises = createRoutineState(currentRoutine(), db);
  persistDraft();

  renderAll();
  switchTab("today");
  toast("Entrenamiento guardado ✓");
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(makeBackup(), null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `forge-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importBackup(file) {
  try {
    const payload = JSON.parse(await file.text());
    restoreBackup(payload);
    state.routineId = loadActiveRoutineId();
    clearDraft();
    loadOrCreateDraft();
    renderAll();
    toast("Copia importada ✓");
  } catch {
    toast("No se pudo importar la copia.");
  }
}

async function configureServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  const isLocal =
    location.hostname === "127.0.0.1" ||
    location.hostname === "localhost";

  if (isLocal) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.unregister()));

    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.filter(name => name.startsWith("forge-")).map(name => caches.delete(name)));
    }
    return;
  }

  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

function bindEvents() {
  document.querySelectorAll(".bottom-nav button").forEach(button => {
    button.addEventListener("click", () => {
      if (button.dataset.tab === "train") enterWorkout();
      else switchTab(button.dataset.tab);
    });
  });

  document.querySelector("#startWorkoutBtn").addEventListener("click", enterWorkout);
  document.querySelector("#resumeWorkoutBtn").addEventListener("click", enterWorkout);

  document.querySelector("#todayRoutineSelect").addEventListener("change", event => {
    activateRoutine(event.target.value);
  });

  document.querySelector("#routineList").addEventListener("click", event => {
    const button = event.target.closest("[data-routine-id]");
    if (button) activateRoutine(button.dataset.routineId);
  });

  document.querySelector("#exerciseList").addEventListener("input", event => {
    const target = event.target.closest('[data-action="edit-set"]');
    if (target) editSet(target);
  });

  document.querySelector("#exerciseList").addEventListener("click", event => {
    const target = event.target.closest("[data-action]");
    if (!target) return;

    const exerciseIndex = Number(target.dataset.exerciseIndex);

    if (target.dataset.action === "toggle-set") {
      toggleSet(exerciseIndex, Number(target.dataset.setIndex));
    } else if (target.dataset.action === "add-set") {
      addWorkSet(state.exercises[exerciseIndex]);
      persistDraft();
      renderWorkout(currentRoutine(), state);
    }
  });

  document.querySelector("#finishWorkoutBtn").addEventListener("click", finishWorkout);

  document.querySelector("#skipRestBtn").addEventListener("click", stopRest);
  document.querySelectorAll("[data-rest-add]").forEach(button => {
    button.addEventListener("click", () => {
      state.restRemaining = Math.max(0, state.restRemaining + Number(button.dataset.restAdd));
      state.restTotal = Math.max(state.restTotal, state.restRemaining);
      updateRestUI();
    });
  });

  document.querySelector("#restSelect").addEventListener("change", event => {
    const settings = loadSettings();
    settings.rest = Number(event.target.value);
    saveSettings(settings);
    toast(settings.rest ? "Aviso de descanso actualizado." : "Temporizador desactivado.");
  });

  document.querySelector("#themeBtn").addEventListener("click", () => {
    const settings = loadSettings();
    settings.theme = settings.theme === "light" ? "dark" : "light";
    saveSettings(settings);
    applySettingsToUI();
  });

  document.querySelector("#exportBtn").addEventListener("click", exportBackup);
  document.querySelector("#importInput").addEventListener("change", event => {
    const file = event.target.files?.[0];
    if (file) importBackup(file);
    event.target.value = "";
  });

  document.querySelector("#resetBtn").addEventListener("click", () => {
    const confirmed = confirm("¿Borrar todo el historial y la sesión activa de FORGE?");
    if (!confirmed) return;

    resetForgeData();
    state.routineId = "dia1";
    saveActiveRoutineId(state.routineId);
    state.workoutStart = null;
    loadOrCreateDraft();
    renderAll();
    toast("Datos borrados.");
  });
}

function startWorkoutClock() {
  const tick = () => {
    const elapsed = state.workoutStart
      ? (Date.now() - state.workoutStart) / 1000
      : 0;

    document.querySelector("#workoutClock").textContent = formatClock(elapsed);
  };

  tick();
  setInterval(tick, 1000);
}

async function init() {
  migrateLegacyData();

  state.routineId = loadActiveRoutineId();
  loadOrCreateDraft();

  bindEvents();
  renderAll();
  switchTab("today");
  startWorkoutClock();
  await configureServiceWorker();
}

document.addEventListener("DOMContentLoaded", init);
