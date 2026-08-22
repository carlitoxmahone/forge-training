import { escapeHtml } from "../core/utils.js";
import {
  exerciseModeLabel,
  normalizeExerciseMode
} from "../core/exerciseModes.js";

function exercisePreview(exercise) {
  const mode = normalizeExerciseMode(exercise.mode);

  if (mode === "strength") {
    return `${exercise.warmup ? `${exercise.warmup} cal. + ` : ""}${exercise.sets} × ${exercise.failure ? "fallo" : `${exercise.min}-${exercise.max}`}`;
  }

  if (mode === "bodyweight") return `${exercise.sets} × ${exercise.min}-${exercise.max} reps`;
  if (mode === "maxreps") return `${exercise.sets} × máximas reps`;
  if (mode === "time") return `${exercise.sets} × ${exercise.targetSeconds} s`;
  return `${exercise.sets} bloque${exercise.sets === 1 ? "" : "s"} · objetivo ${exercise.targetMinutes} min`;
}

export function renderRoutineSelector(routines, activeId) {
  const select = document.querySelector("#todayRoutineSelect");
  select.innerHTML = routines.map(routine =>
    `<option value="${escapeHtml(routine.id)}">${escapeHtml(routine.name)} · ${escapeHtml(routine.subtitle)}</option>`
  ).join("");
  select.value = activeId;
}

export function renderRoutineList(routines, activeId) {
  const container = document.querySelector("#routineList");

  const createCard = `
    <article class="routine-create-card">
      <div>
        <span class="tag">PERSONALIZA FORGE</span>
        <h3>Nueva rutina</h3>
        <p class="routine-meta">Crea un entrenamiento y mezcla musculación, peso corporal, isométricos o cardio.</p>
      </div>
      <button class="primary" data-create-routine type="button">+ Crear rutina</button>
    </article>
  `;

  const cards = routines.map(routine => {
    const effective = routine.exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
    const warmups = routine.exercises.reduce((sum, exercise) => sum + (exercise.warmup || 0), 0);
    const inactiveTag = routine.custom ? "PERSONALIZADA" : routine.name.toUpperCase();

    return `
      <article class="routine-card ${routine.id === activeId ? "active" : ""}">
        <div class="routine-card-head">
          <div>
            <span class="tag">${routine.id === activeId ? "ACTIVA" : escapeHtml(inactiveTag)}</span>
            <h3>${escapeHtml(routine.name)}</h3>
            <p class="routine-meta">${escapeHtml(routine.subtitle)} · ${routine.exercises.length} ejercicios · ${effective} series/bloques${warmups ? ` + ${warmups} calentamiento` : ""}</p>
          </div>
          <div class="routine-card-actions">
            <button class="secondary routine-edit" data-edit-routine-id="${escapeHtml(routine.id)}" type="button">Editar</button>
            <button class="${routine.id === activeId ? "primary" : "secondary"} routine-open" data-routine-id="${escapeHtml(routine.id)}" type="button">
              ${routine.id === activeId ? "Entrenar" : "Abrir"}
            </button>
          </div>
        </div>

        <div class="exercise-preview">
          ${routine.exercises.map(exercise => `
            <div>
              <span>${escapeHtml(exercise.name)} <small>· ${escapeHtml(exerciseModeLabel(exercise.mode))}</small></span>
              <span>${escapeHtml(exercisePreview(exercise))}</span>
            </div>
          `).join("")}
        </div>
      </article>
    `;
  }).join("");

  container.innerHTML = createCard + cards;
}
