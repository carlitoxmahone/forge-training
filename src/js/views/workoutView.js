import { coachMessage } from "../core/coach.js";
import { formatDate, escapeHtml } from "../core/utils.js";
import { sessionStats } from "../core/workout.js";

function setRow(set, workNumber, warmupNumber, exerciseIndex, setIndex) {
  const label = set.type === "warmup" ? `C${warmupNumber}` : workNumber;
  const previous = set.previous
    ? `${Number(set.previous.weight || 0)} × ${Number(set.previous.reps || 0)}`
    : "—";

  return `
    <tr class="${set.done ? "done" : ""}">
      <td><span class="set-type ${set.type}">${label}</span></td>
      <td class="prev-cell">${previous}</td>
      <td class="target-cell">${escapeHtml(set.target)}</td>
      <td>
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
          placeholder="kg"
          ${set.done ? "disabled" : ""}
        >
      </td>
      <td>
        <input
          class="set-input"
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
      </td>
      <td>
        <input
          class="set-input"
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
          ${set.done || set.type === "warmup" ? "disabled" : ""}
        >
      </td>
      <td>
        <button
          class="complete-set"
          data-action="toggle-set"
          data-exercise-index="${exerciseIndex}"
          data-set-index="${setIndex}"
          type="button"
          aria-label="${set.done ? "Desmarcar serie" : "Completar serie"}"
        >${set.done ? "✓" : "○"}</button>
      </td>
    </tr>
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

  return `
    <article class="exercise-block ${complete ? "completed" : ""}" data-exercise-index="${exerciseIndex}">
      <div class="exercise-block-header">
        <div class="exercise-block-title">
          <div class="exercise-number">EJERCICIO ${exerciseIndex + 1} / ${totalExercises}</div>
          <h3>${escapeHtml(exercise.name)}</h3>
          <p class="muted">Última sesión: ${formatDate(exercise.historyDate)}</p>
        </div>
        <div class="exercise-status">${doneWork}/${workSets.length}</div>
      </div>

      <div class="exercise-guidance">
        <strong>Pauta</strong>
        <span>${guidance}</span>
      </div>

      <div class="exercise-table-wrap">
        <table class="sets-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Anterior</th>
              <th>Objetivo</th>
              <th>kg</th>
              <th>reps</th>
              <th>RIR</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <div class="exercise-coach">
        <div class="exercise-coach-label">COACH</div>
        <div>${escapeHtml(coachMessage(exercise, lastCompleted))}</div>
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
