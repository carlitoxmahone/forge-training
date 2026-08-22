export function renderRoutineSelector(routines, activeId) {
  const select = document.querySelector("#todayRoutineSelect");
  select.innerHTML = routines.map(routine =>
    `<option value="${routine.id}">${routine.name} · ${routine.subtitle}</option>`
  ).join("");
  select.value = activeId;
}

export function renderRoutineList(routines, activeId) {
  const container = document.querySelector("#routineList");
  container.innerHTML = routines.map(routine => {
    const effective = routine.exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
    const warmups = routine.exercises.reduce((sum, exercise) => sum + (exercise.warmup || 0), 0);

    return `
      <article class="routine-card ${routine.id === activeId ? "active" : ""}">
        <div class="routine-card-head">
          <div>
            <span class="tag">${routine.id === activeId ? "ACTIVA" : routine.name.toUpperCase()}</span>
            <h3>${routine.name}</h3>
            <p class="routine-meta">${routine.subtitle} · ${routine.exercises.length} ejercicios · ${effective} series efectivas${warmups ? ` + ${warmups} calentamiento` : ""}</p>
          </div>
          <div class="routine-card-actions">
            <button class="secondary routine-edit" data-edit-routine-id="${routine.id}" type="button">Editar</button>
            <button class="${routine.id === activeId ? "primary" : "secondary"} routine-open" data-routine-id="${routine.id}" type="button">
              ${routine.id === activeId ? "Entrenar" : "Abrir"}
            </button>
          </div>
        </div>

        <div class="exercise-preview">
          ${routine.exercises.map(exercise => `
            <div>
              <span>${exercise.name}</span>
              <span>${exercise.warmup ? `${exercise.warmup} cal. + ` : ""}${exercise.sets} × ${exercise.failure ? "fallo" : `${exercise.min}-${exercise.max}`}</span>
            </div>
          `).join("")}
        </div>
      </article>
    `;
  }).join("");
}
