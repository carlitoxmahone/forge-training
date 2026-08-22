import { loadDB } from "./core/storage.js";
import { formatDate, escapeHtml } from "./core/utils.js";
import {
  normalizeExerciseMode,
  exerciseModeLabel,
  setHasPerformance,
  setPerformanceScore,
  sessionPerformanceScore,
  formatSetForMode
} from "./core/exerciseModes.js";

function ensureStyles() {
  if (document.querySelector('link[data-forge-history="true"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./src/css/history.css";
  link.dataset.forgeHistory = "true";
  document.head.appendChild(link);
}

function workSets(exercise, mode) {
  return (exercise?.sets || []).filter(set =>
    set.type !== "warmup" && setHasPerformance(set, mode)
  );
}

function exerciseSessions(exerciseName, modeValue) {
  const mode = normalizeExerciseMode(modeValue);

  return (loadDB().workouts || [])
    .map(workout => {
      const exercise = (workout.exercises || []).find(item =>
        item.name === exerciseName && normalizeExerciseMode(item.mode) === mode
      );
      if (!exercise) return null;

      const sets = workSets(exercise, mode);
      if (!sets.length) return null;

      const bestSet = [...sets].sort((a, b) =>
        setPerformanceScore(b, mode) - setPerformanceScore(a, mode)
      )[0];

      return {
        date: workout.date,
        workoutName: workout.name,
        sets,
        bestSet,
        score: sessionPerformanceScore(sets, mode),
        volume: mode === "strength"
          ? sets.reduce((sum, set) => sum + Number(set.weight || 0) * Number(set.reps || 0), 0)
          : 0,
        totalReps: sets.reduce((sum, set) => sum + Number(set.reps || 0), 0),
        totalSeconds: sets.reduce((sum, set) => sum + Number(set.seconds || 0), 0),
        totalMinutes: sets.reduce((sum, set) => sum + Number(set.durationMin || 0), 0),
        totalDistance: sets.reduce((sum, set) => sum + Number(set.distanceKm || 0), 0)
      };
    })
    .filter(Boolean);
}

function bestSetAcross(sessions, mode) {
  return sessions
    .flatMap(session => session.sets)
    .sort((a, b) => setPerformanceScore(b, mode) - setPerformanceScore(a, mode))[0] || null;
}

function trendText(sessions) {
  if (sessions.length < 2) return "Base creada";
  const first = sessions[0].score;
  const last = sessions.at(-1).score;
  if (!first) return "Base creada";

  const percent = (last / first - 1) * 100;
  if (Math.abs(percent) < 0.1) return "≈ estable";
  return `${percent > 0 ? "↑" : "↓"} ${Math.abs(percent).toFixed(1)} %`;
}

function accumulatedMetric(sessions, mode) {
  if (mode === "strength") {
    const total = sessions.reduce((sum, session) => sum + session.volume, 0);
    return { label: "Volumen acumulado", value: `${Math.round(total).toLocaleString("es-ES")} kg` };
  }

  if (mode === "bodyweight" || mode === "maxreps") {
    const total = sessions.reduce((sum, session) => sum + session.totalReps, 0);
    return { label: "Reps acumuladas", value: `${total.toLocaleString("es-ES")} reps` };
  }

  if (mode === "time") {
    const total = sessions.reduce((sum, session) => sum + session.totalSeconds, 0);
    return { label: "Tiempo acumulado", value: `${Math.round(total).toLocaleString("es-ES")} s` };
  }

  const distance = sessions.reduce((sum, session) => sum + session.totalDistance, 0);
  const minutes = sessions.reduce((sum, session) => sum + session.totalMinutes, 0);
  return distance > 0
    ? { label: "Distancia acumulada", value: `${distance.toFixed(2).replace(".", ",")} km` }
    : { label: "Cardio acumulado", value: `${Math.round(minutes)} min` };
}

function sessionMetric(session, mode) {
  if (mode === "strength") return `${Math.round(session.volume).toLocaleString("es-ES")} kg`;
  if (mode === "bodyweight" || mode === "maxreps") return `${session.totalReps} reps`;
  if (mode === "time") return `${Math.round(session.totalSeconds)} s`;
  if (session.totalDistance > 0) return `${session.totalDistance.toFixed(2).replace(".", ",")} km`;
  return `${session.totalMinutes.toFixed(1).replace(".", ",")} min`;
}

function createShell() {
  ensureStyles();
  if (document.querySelector("#exerciseHistoryOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "exerciseHistoryOverlay";
  overlay.className = "history-overlay hidden";
  overlay.innerHTML = `
    <section class="history-sheet" role="dialog" aria-modal="true" aria-labelledby="exerciseHistoryTitle">
      <div class="history-sheet-head">
        <div>
          <div class="eyebrow">HISTORIAL DEL EJERCICIO</div>
          <h2 id="exerciseHistoryTitle">Ejercicio</h2>
          <p id="exerciseHistoryMode" class="muted"></p>
        </div>
        <button id="closeExerciseHistory" class="icon-btn" type="button" aria-label="Cerrar historial">×</button>
      </div>
      <div id="exerciseHistoryContent"></div>
    </section>
  `;

  document.body.appendChild(overlay);
}

function renderEmpty(exerciseName, mode) {
  return `
    <div class="history-empty">
      <div class="history-empty-icon">↗</div>
      <h3>Aún no hay historial comparable</h3>
      <p>Cuando finalices una sesión de <strong>${escapeHtml(exerciseName)}</strong> como <strong>${escapeHtml(exerciseModeLabel(mode))}</strong>, aquí aparecerá su evolución.</p>
    </div>
  `;
}

function renderHistory(exerciseName, modeValue, sessions) {
  const mode = normalizeExerciseMode(modeValue);
  if (!sessions.length) return renderEmpty(exerciseName, mode);

  const best = bestSetAcross(sessions, mode);
  const accumulated = accumulatedMetric(sessions, mode);
  const recent = [...sessions].reverse().slice(0, 10);
  const maxScore = Math.max(...sessions.map(session => session.score), 1);

  return `
    <div class="exercise-history-stats">
      <div class="history-stat">
        <span>Sesiones</span>
        <strong>${sessions.length}</strong>
      </div>
      <div class="history-stat">
        <span>Mejor registro</span>
        <strong>${best ? escapeHtml(formatSetForMode(best, mode)) : "—"}</strong>
      </div>
      <div class="history-stat">
        <span>${escapeHtml(accumulated.label)}</span>
        <strong>${escapeHtml(accumulated.value)}</strong>
      </div>
      <div class="history-stat">
        <span>Tendencia</span>
        <strong>${trendText(sessions)}</strong>
      </div>
    </div>

    <div class="exercise-history-chart">
      <div class="history-chart-head">
        <span>Rendimiento por sesión</span>
        <small>métrica adaptada al tipo</small>
      </div>
      <div class="history-mini-bars">
        ${sessions.slice(-10).map(session => {
          const height = Math.max(18, Math.round(session.score / maxScore * 100));
          return `<i style="height:${height}%" title="${formatDate(session.date)}"></i>`;
        }).join("")}
      </div>
    </div>

    <div class="exercise-history-list">
      ${recent.map(session => `
        <article class="exercise-history-session">
          <div class="history-session-head">
            <div>
              <strong>${formatDate(session.date)}</strong>
              <small>${escapeHtml(session.workoutName || "Entrenamiento")}</small>
            </div>
            <span>${escapeHtml(sessionMetric(session, mode))}</span>
          </div>
          <div class="history-set-chips">
            ${session.sets.map(set => `<span>${escapeHtml(formatSetForMode(set, mode))}</span>`).join("")}
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function openHistory(exerciseName, modeValue) {
  createShell();
  const mode = normalizeExerciseMode(modeValue);
  const overlay = document.querySelector("#exerciseHistoryOverlay");
  const title = document.querySelector("#exerciseHistoryTitle");
  const modeLabel = document.querySelector("#exerciseHistoryMode");
  const content = document.querySelector("#exerciseHistoryContent");

  title.textContent = exerciseName;
  modeLabel.textContent = exerciseModeLabel(mode);
  content.innerHTML = renderHistory(exerciseName, mode, exerciseSessions(exerciseName, mode));
  overlay.classList.remove("hidden");
  document.body.classList.add("history-open");
}

function closeHistory() {
  document.querySelector("#exerciseHistoryOverlay")?.classList.add("hidden");
  document.body.classList.remove("history-open");
}

document.addEventListener("DOMContentLoaded", createShell);

document.addEventListener("click", event => {
  const trigger = event.target.closest('[data-action="exercise-history"]');
  if (trigger) {
    event.preventDefault();
    openHistory(trigger.dataset.exerciseName || "Ejercicio", trigger.dataset.exerciseMode || "strength");
    return;
  }

  if (event.target.closest("#closeExerciseHistory")) {
    closeHistory();
    return;
  }

  const overlay = event.target.closest("#exerciseHistoryOverlay");
  if (overlay && event.target === overlay) closeHistory();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeHistory();
});
