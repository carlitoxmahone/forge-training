import { coachAdvice } from "../core/coach.js";
import { formatDate, escapeHtml } from "../core/utils.js";
import { sessionStats } from "../core/workout.js";

function setRow(set, workNumber, warmupNumber, exerciseIndex, setIndex) {
  const label = set.type === "warmup" ? `C${warmupNumber}` : workNumber;
  const previous = set.previous
    ? `${Number(set.previous.weight || 0)} × ${Number(set.previous.reps || 0)}`
    : "—";
  const rirDisabled = set.done || set.type === "warmup";

  return `
    <div class="set-row ${set.done ? "done" : ""}" data-set-kind="${set.type}">
      <div class="set-row-meta">
        <span class="set-type ${set.type}">${label}</span>

        <div class="set-reference">
          <span>Anterior</span>
          <strong>${previous}</strong>
        </div>

        <div class="set-reference target-reference">
          <span>Objetivo</span>
          <strong>${escapeHtml(set.target)}</strong>
        </div>
      </div>

      <div class="set-controls">
        <label class="set-field">
          <span>kg</span>
          <input
            class="set-input"
            data-action="edit-set"
            data-field="weight"
            data-exercise-index="${exerciseIndex}"
            data-set-index="${setIndex}"
            inputmode="decimal"
            type="number"
            step="0.5"
            value="${set.weight}"
            placeholder="0"
            ${set.done ? "disabled" : ""}
          >
        </label>

        <label class="set-field">
          <span>reps</span>
          <input
            class="set-input reps-input"
            data-action="edit-set"
            data-field="reps"
            data-exercise-index="${exerciseIndex}"
            data-set-index="${setIndex}"
            inputmode="numeric"
            type="number"
            min="0"
            value="${set.reps}"
            placeholder="—"
            ${set.done ? "disabled" : ""}
          >
        </label>

        <label class="set-field ${set.type === "warmup" ? "disabled-field" : ""}">
          <span>RIR</span>
          <input
            class="set-input rir-input"
            data-action="edit-set"
            data-field="rir"
            data-exercise-index="${exerciseIndex}"
            data-set-index="${setIndex}"
            inputmode="numeric"
            type="number"
            min="0"
            max="5"
            value="${set.type === "warmup" ? "" : set.rir}"
            placeholder="—"
            ${rirDisabled ? "disabled" : ""}
          >
        </label>

        <button
          class="complete-set"
          data-action="toggle-set"
          data-exercise-index="${exerciseIndex}"
          data-set-index="${setIndex}"
          type="button"
          aria-label="${set.done ? "Desmarcar serie" : "Completar serie"}"
        >${set.done ? "✓" : "○"}</button>
      </div>
    </div>
  `;
}

function exerciseCard(exercise, exerciseIndex, totalExercises) {
  const workSets = exercise.sets.filter(set => set.type === "work");
  const doneWork = workSets.filter(set => set.done).length;
  const complete = workSets.length > 0 && doneWork === workSets.length;

  const guidance = exercise.failure
    ? `${workSets.length} series al fallo.`
    : `${workSets.length} series efectivas de ${exercise.min}-${exercise.max} reps${exercise.warmup ? ` · ${exercise.warmup} series de calentamiento antes` : ""}.`;

  let workNumber = 0;
  let warmupNumber = 0;

  const rows = exercise.sets.map((set, setIndex) => {
    if (set.type === "work") workNumber += 1;
    else warmupNumber += 1;
    return setRow(set, workNumber, warmupNumber, exerciseIndex, setIndex);
  }).join("");

  const lastCompleted = [...exercise.sets].reverse().find(set => set.done);
  const advice = coachAdvice(exercise, lastCompleted);

  return `
    <article class="exercise-block ${complete ? "completed" : ""}" data-exercise-index="${exerciseIndex}">
      <div class="exercise-block-header">
        <div class="exercise-block-title">
          <div class="exercise-number">EJERCICIO ${exerciseIndex + 1} / ${totalExercises}</div>
          <button
            class="exercise-title-button"
            data-action="exercise-history"
            data-exercise-index="${exerciseIndex}"
            data-exercise-name="${escapeHtml(exercise.name)}"
            type="button"
            aria-label="Ver historial de ${escapeHtml(exercise.name)}"
          >
            <span>${escapeHtml(exercise.name)}</span>
            <small>Historial ›</small>
          </button>
          <p class="muted">Última sesión: ${formatDate(exercise.historyDate)}</p>
        </div>
        <div class="exercise-status">${doneWork}/${workSets.length}</div>
      </div>

      <div class="exercise-guidance">
        <strong>Pauta</strong>
        <span>${guidance}</span>
      </div>

      <div class="sets-stack">${rows}</div>

      <div class="exercise-coach coach-grid" data-trend-kind="${advice.trendKind}">
        <div class="coach-section coach-reading">
          <div class="exercise-coach-label">LECTURA</div>
          <div>${escapeHtml(advice.reading)}</div>
        </div>
        <div class="coach-section coach-next-set">
          <div class="exercise-coach-label">SIGUIENTE SERIE</div>
          <div>${escapeHtml(advice.nextSet)}</div>
        </div>
        <div class="coach-section coach-trend">
          <div class="exercise-coach-label">TENDENCIA · ${advice.historySessions} SES.</div>
          <div>${escapeHtml(advice.trend)}</div>
        </div>
        <div class="coach-section coach-next-session">
          <div class="exercise-coach-label">PRÓXIMA SESIÓN</div>
          <div>${escapeHtml(advice.nextSession)}</div>
        </div>
      </div>

      <button
        class="secondary exercise-add-set"
        data-action="add-set"
        data-exercise-index="${exerciseIndex}"
        type="button"
      >+ Añadir serie</button>
    </article>
  `;
}

export function renderWorkout(routine, state) {
  document.querySelector("#workoutName").textContent = `${routine.name} · ${routine.subtitle}`;

  const stats = sessionStats(state.exercises);
  document.querySelector("#workoutMeta").textContent =
    `${stats.completeExercises}/${stats.totalExercises} ejercicios · ${stats.completedSets} series efectivas`;

  document.querySelector("#workoutProgress").style.width =
    `${stats.totalSets ? Math.round(stats.completedSets / stats.totalSets * 100) : 0}%`;

  document.querySelector("#sessionSetsDone").textContent = stats.completedSets;
  document.querySelector("#sessionVolume").textContent =
    `${Math.round(stats.volume).toLocaleString("es-ES")} kg`;
  document.querySelector("#sessionExercisesDone").textContent =
    `${stats.completeExercises}/${stats.totalExercises}`;

  document.querySelector("#exerciseList").innerHTML =
    state.exercises.map((exercise, index) =>
      exerciseCard(exercise, index, state.exercises.length)
    ).join("");
}
