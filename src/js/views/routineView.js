import { escapeHtml } from "../core/utils.js";

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
        <p class="routine-meta">Crea un entrenamiento desde cero y después podrás seleccionarlo como cualquier otro día.</p>
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
            <p class="routine-meta">${escapeHtml(routine.subtitle)} · ${routine.exercises.length} ejercicios · ${effective} series efectivas${warmups ? ` + ${warmups} calentamiento` : ""}</p>
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
              <span>${escapeHtml(exercise.name)}</span>
              <span>${exercise.warmup ? `${exercise.warmup} cal. + ` : ""}${exercise.sets} × ${exercise.failure ? "fallo" : `${exercise.min}-${exercise.max}`}</span>
            </div>
          `).join("")}
        </div>
      </article>
    `;
  }).join("");

  container.innerHTML = createCard + cards;
}
