import { loadDB } from "./core/storage.js";
import { formatDate, escapeHtml } from "./core/utils.js";

function workSets(exercise) {
  return (exercise?.sets || []).filter(set => set.type !== "warmup" && Number(set.reps || 0) > 0);
}

function setScore(set) {
  const weight = Number(set.weight || 0);
  const reps = Number(set.reps || 0);
  return weight > 0 ? weight * (1 + reps / 30) : reps;
}

function formatWeight(value) {
  const weight = Number(value || 0);
  if (!weight) return "—";
  return Number.isInteger(weight) ? `${weight}` : weight.toFixed(1).replace(".", ",");
}

function formatSet(set) {
  const weight = Number(set.weight || 0);
  const reps = Number(set.reps || 0);
  const rir = set.rir === null || set.rir === undefined ? null : Number(set.rir);
  const main = weight > 0 ? `${formatWeight(weight)} kg × ${reps}` : `${reps} reps`;
  return rir === null || Number.isNaN(rir) ? main : `${main} · RIR ${rir}`;
}

function exerciseSessions(exerciseName) {
  return (loadDB().workouts || [])
    .map(workout => {
      const exercise = (workout.exercises || []).find(item => item.name === exerciseName);
      if (!exercise) return null;

      const sets = workSets(exercise);
      if (!sets.length) return null;

      const bestSet = [...sets].sort((a, b) => setScore(b) - setScore(a))[0];
      const volume = sets.reduce((sum, set) =>
        sum + Number(set.weight || 0) * Number(set.reps || 0), 0);

      return {
        date: workout.date,
        workoutName: workout.name,
        sets,
        bestSet,
        score: setScore(bestSet),
        volume
      };
    })
    .filter(Boolean);
}

function bestSetAcross(sessions) {
  return sessions
    .flatMap(session => session.sets)
    .sort((a, b) => setScore(b) - setScore(a))[0] || null;
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

function createShell() {
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
        </div>
        <button id="closeExerciseHistory" class="icon-btn" type="button" aria-label="Cerrar historial">×</button>
      </div>
      <div id="exerciseHistoryContent"></div>
    </section>
  `;

  document.body.appendChild(overlay);
}

function renderEmpty(exerciseName) {
  return `
    <div class="history-empty">
      <div class="history-empty-icon">↗</div>
      <h3>Aún no hay historial</h3>
      <p>Cuando finalices una sesión con <strong>${escapeHtml(exerciseName)}</strong>, aquí aparecerán tus series, mejores marcas, volumen y evolución.</p>
    </div>
  `;
}

function renderHistory(exerciseName, sessions) {
  if (!sessions.length) return renderEmpty(exerciseName);

  const best = bestSetAcross(sessions);
  const totalVolume = sessions.reduce((sum, session) => sum + session.volume, 0);
  const recent = [...sessions].reverse().slice(0, 10);
  const maxScore = Math.max(...sessions.map(session => session.score), 1);

  return `
    <div class="exercise-history-stats">
      <div class="history-stat">
        <span>Sesiones</span>
        <strong>${sessions.length}</strong>
      </div>
      <div class="history-stat">
        <span>Mejor serie</span>
        <strong>${best ? escapeHtml(formatSet(best)) : "—"}</strong>
      </div>
      <div class="history-stat">
        <span>Volumen acumulado</span>
        <strong>${Math.round(totalVolume).toLocaleString("es-ES")} kg</strong>
      </div>
      <div class="history-stat">
        <span>Tendencia</span>
        <strong>${trendText(sessions)}</strong>
      </div>
    </div>

    <div class="exercise-history-chart">
      <div class="history-chart-head">
        <span>Rendimiento por sesión</span>
        <small>mejor serie estimada</small>
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
            <span>${Math.round(session.volume).toLocaleString("es-ES")} kg</span>
          </div>
          <div class="history-set-chips">
            ${session.sets.map(set => `<span>${escapeHtml(formatSet(set))}</span>`).join("")}
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function openHistory(exerciseName) {
  createShell();
  const overlay = document.querySelector("#exerciseHistoryOverlay");
  const title = document.querySelector("#exerciseHistoryTitle");
  const content = document.querySelector("#exerciseHistoryContent");

  title.textContent = exerciseName;
  content.innerHTML = renderHistory(exerciseName, exerciseSessions(exerciseName));
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
    openHistory(trigger.dataset.exerciseName || "Ejercicio");
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
