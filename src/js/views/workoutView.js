import { coachAdvice } from "../core/coach.js";
import { formatDate, escapeHtml } from "../core/utils.js";
import { sessionStats } from "../core/workout.js";
import {
  normalizeExerciseMode,
  exerciseModeLabel,
  formatSetForMode,
  targetForExercise
} from "../core/exerciseModes.js";

function inputField({ label, field, value, exerciseIndex, setIndex, inputmode = "numeric", step = "1", disabled = false, placeholder = "—", extraClass = "" }) {
  return `
    <label class="set-field ${disabled ? "disabled-field" : ""} ${extraClass}">
      <span>${label}</span>
      <input
        class="set-input"
        data-action="edit-set"
        data-field="${field}"
        data-exercise-index="${exerciseIndex}"
        data-set-index="${setIndex}"
        inputmode="${inputmode}"
        type="number"
        min="0"
        step="${step}"
        value="${value ?? ""}"
        placeholder="${placeholder}"
        ${disabled ? "disabled" : ""}
      >
    </label>
  `;
}

function setControls(exercise, set, exerciseIndex, setIndex) {
  const mode = normalizeExerciseMode(exercise.mode);
  const done = Boolean(set.done);

  if (set.type === "warmup" || mode === "strength") {
    return `
      <div class="set-controls" data-control-mode="strength">
        ${inputField({ label: "kg", field: "weight", value: set.weight, exerciseIndex, setIndex, inputmode: "decimal", step: "0.5", disabled: done })}
        ${inputField({ label: "reps", field: "reps", value: set.reps, exerciseIndex, setIndex, disabled: done })}
        ${inputField({ label: "RIR", field: "rir", value: set.type === "warmup" ? "" : set.rir, exerciseIndex, setIndex, disabled: done || set.type === "warmup" })}
        ${completeButton(set, exerciseIndex, setIndex)}
      </div>
    `;
  }

  if (mode === "bodyweight") {
    return `
      <div class="set-controls" data-control-mode="bodyweight">
        ${inputField({ label: "reps", field: "reps", value: set.reps, exerciseIndex, setIndex, disabled: done })}
        ${inputField({ label: "RIR", field: "rir", value: set.rir, exerciseIndex, setIndex, disabled: done })}
        ${completeButton(set, exerciseIndex, setIndex)}
      </div>
    `;
  }

  if (mode === "maxreps") {
    return `
      <div class="set-controls" data-control-mode="maxreps">
        ${inputField({ label: "reps", field: "reps", value: set.reps, exerciseIndex, setIndex, disabled: done })}
        ${completeButton(set, exerciseIndex, setIndex)}
      </div>
    `;
  }

  if (mode === "time") {
    return `
      <div class="set-controls" data-control-mode="time">
        ${inputField({ label: "segundos", field: "seconds", value: set.seconds, exerciseIndex, setIndex, disabled: done, step: "1" })}
        ${completeButton(set, exerciseIndex, setIndex)}
      </div>
    `;
  }

  return `
    <div class="set-controls" data-control-mode="cardio">
      ${inputField({ label: "minutos", field: "durationMin", value: set.durationMin, exerciseIndex, setIndex, inputmode: "decimal", step: "0.5", disabled: done })}
      ${inputField({ label: "km", field: "distanceKm", value: set.distanceKm, exerciseIndex, setIndex, inputmode: "decimal", step: "0.01", disabled: done, placeholder: "opcional" })}
      ${completeButton(set, exerciseIndex, setIndex)}
    </div>
  `;
}

function completeButton(set, exerciseIndex, setIndex) {
  return `
    <button
      class="complete-set"
      data-action="toggle-set"
      data-exercise-index="${exerciseIndex}"
      data-set-index="${setIndex}"
      type="button"
      aria-label="${set.done ? "Desmarcar serie" : "Completar serie"}"
    >${set.done ? "✓" : "○"}</button>
  `;
}

function previousText(exercise, set) {
  if (!set.previous) return "—";
  return formatSetForMode(set.previous, set.type === "warmup" ? "strength" : exercise.mode);
}

function setRow(exercise, set, workNumber, warmupNumber, exerciseIndex, setIndex) {
  const mode = normalizeExerciseMode(exercise.mode);
  const label = set.type === "warmup"
    ? `C${warmupNumber}`
    : mode === "cardio"
      ? `B${workNumber}`
      : workNumber;

  return `
    <div class="set-row ${set.done ? "done" : ""}" data-set-kind="${set.type}" data-exercise-mode="${mode}">
      <div class="set-row-meta">
        <span class="set-type ${set.type}">${label}</span>

        <div class="set-reference">
          <span>Anterior</span>
          <strong>${escapeHtml(previousText(exercise, set))}</strong>
        </div>

        <div class="set-reference target-reference">
          <span>Objetivo</span>
          <strong>${escapeHtml(set.target || targetForExercise(exercise))}</strong>
        </div>
      </div>

      ${setControls(exercise, set, exerciseIndex, setIndex)}
    </div>
  `;
}

function guidanceText(exercise, workSets) {
  const mode = normalizeExerciseMode(exercise.mode);

  if (mode === "strength") {
    return exercise.failure
      ? `${workSets.length} series al fallo.`
      : `${workSets.length} series efectivas de ${exercise.min}-${exercise.max} reps${exercise.warmup ? ` · ${exercise.warmup} series de calentamiento antes` : ""}.`;
  }

  if (mode === "bodyweight") {
    return `${workSets.length} series con tu propio peso · guía ${exercise.min}-${exercise.max} reps. FORGE prioriza el total de reps y la técnica.`;
  }

  if (mode === "maxreps") {
    return `${workSets.length} series a máximas repeticiones técnicas. Sin rango fijo.`;
  }

  if (mode === "time") {
    return `${workSets.length} series por tiempo · referencia ${exercise.targetSeconds} s por serie.`;
  }

  return `${workSets.length} bloque${workSets.length === 1 ? "" : "s"} de cardio · referencia ${exercise.targetMinutes} min por bloque. Registra distancia si la conoces.`;
}

function exerciseCard(exercise, exerciseIndex, totalExercises) {
  const mode = normalizeExerciseMode(exercise.mode);
  const workSets = exercise.sets.filter(set => set.type === "work");
  const doneWork = workSets.filter(set => set.done).length;
  const complete = workSets.length > 0 && doneWork === workSets.length;

  let workNumber = 0;
  let warmupNumber = 0;

  const rows = exercise.sets.map((set, setIndex) => {
    if (set.type === "work") workNumber += 1;
    else warmupNumber += 1;
    return setRow(exercise, set, workNumber, warmupNumber, exerciseIndex, setIndex);
  }).join("");

  const lastCompleted = [...exercise.sets].reverse().find(set => set.done);
  const advice = coachAdvice(exercise, lastCompleted);
  const unitWord = mode === "cardio" ? "bloques" : "series";

  return `
    <article class="exercise-block ${complete ? "completed" : ""}" data-exercise-index="${exerciseIndex}" data-exercise-mode="${mode}">
      <div class="exercise-block-header">
        <div class="exercise-block-title">
          <div class="exercise-number">EJERCICIO ${exerciseIndex + 1} / ${totalExercises}</div>
          <button
            class="exercise-title-button"
            data-action="exercise-history"
            data-exercise-index="${exerciseIndex}"
            data-exercise-name="${escapeHtml(exercise.name)}"
            data-exercise-mode="${mode}"
            type="button"
            aria-label="Ver historial de ${escapeHtml(exercise.name)}"
          >
            <span>${escapeHtml(exercise.name)}</span>
            <small>${escapeHtml(exerciseModeLabel(mode))} · Historial ›</small>
          </button>
          <p class="muted">Última sesión: ${formatDate(exercise.historyDate)}</p>
        </div>
        <div class="exercise-status">${doneWork}/${workSets.length}</div>
      </div>

      <div class="exercise-guidance">
        <strong>Pauta</strong>
        <span>${escapeHtml(guidanceText(exercise, workSets))}</span>
      </div>

      <div class="sets-stack">${rows}</div>

      <div class="exercise-coach coach-grid" data-trend-kind="${advice.trendKind}">
        <div class="coach-section coach-reading">
          <div class="exercise-coach-label">LECTURA</div>
          <div>${escapeHtml(advice.reading)}</div>
        </div>
        <div class="coach-section coach-next-set">
          <div class="exercise-coach-label">SIGUIENTE ${mode === "cardio" ? "BLOQUE" : "SERIE"}</div>
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
      >+ Añadir ${mode === "cardio" ? "bloque" : "serie"}</button>
    </article>
  `;
}

export function renderWorkout(routine, state) {
  document.querySelector("#workoutName").textContent = `${routine.name} · ${routine.subtitle}`;

  const stats = sessionStats(state.exercises);
  document.querySelector("#workoutMeta").textContent =
    `${stats.completeExercises}/${stats.totalExercises} ejercicios · ${stats.completedSets} series/bloques completados`;

  document.querySelector("#workoutProgress").style.width =
    `${stats.totalSets ? Math.round(stats.completedSets / stats.totalSets * 100) : 0}%`;

  document.querySelector("#sessionSetsDone").textContent = stats.completedSets;
  document.querySelector("#sessionVolume").textContent = stats.volume > 0
    ? `${Math.round(stats.volume).toLocaleString("es-ES")} kg`
    : "—";
  document.querySelector("#sessionExercisesDone").textContent =
    `${stats.completeExercises}/${stats.totalExercises}`;

  document.querySelector("#exerciseList").innerHTML =
    state.exercises.map((exercise, index) =>
      exerciseCard(exercise, index, state.exercises.length)
    ).join("");
}
