import {
  getRoutine,
  saveRoutineConfiguration,
  createRoutineConfiguration,
  deleteRoutineConfiguration,
  resetRoutineToDefault,
  isDefaultRoutine
} from "./data/routines.js";
import {
  loadDraft,
  clearDraft,
  loadActiveRoutineId,
  saveActiveRoutineId
} from "./core/storage.js";
import {
  EXERCISE_MODE_OPTIONS,
  normalizeExerciseMode
} from "./core/exerciseModes.js";
import { escapeHtml } from "./core/utils.js";

let editing = null;
let creating = false;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureStyles() {
  if (document.querySelector('link[data-forge-routine-editor]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./src/css/routine-editor.css";
  link.dataset.forgeRoutineEditor = "true";
  document.head.appendChild(link);
}

function createShell() {
  if (document.querySelector("#routineEditorOverlay")) return;
  ensureStyles();

  const overlay = document.createElement("div");
  overlay.id = "routineEditorOverlay";
  overlay.className = "routine-editor-overlay hidden";
  overlay.innerHTML = `
    <section class="routine-editor-sheet" role="dialog" aria-modal="true" aria-labelledby="routineEditorTitle">
      <div class="routine-editor-head">
        <div>
          <div class="eyebrow">EDITOR DE RUTINA</div>
          <h2 id="routineEditorTitle">Editar día</h2>
          <p id="routineEditorIntro" class="muted">Los cambios se aplican al próximo entrenamiento.</p>
        </div>
        <button id="closeRoutineEditor" class="icon-btn" type="button" aria-label="Cerrar editor">×</button>
      </div>

      <div class="routine-editor-meta">
        <label>
          <span>Nombre de la rutina</span>
          <input id="routineEditorName" type="text" maxlength="60" placeholder="Ej. Full body">
        </label>
        <label>
          <span>Prioridad / subtítulo</span>
          <input id="routineEditorSubtitle" type="text" maxlength="60" placeholder="Ej. Cardio + core">
        </label>
      </div>

      <div class="routine-editor-section-head">
        <div>
          <div class="eyebrow">EJERCICIOS</div>
          <h3>Orden, tipo y pauta</h3>
        </div>
        <button id="addRoutineExercise" class="secondary" type="button">+ Ejercicio</button>
      </div>

      <p id="routineEditorHelp" class="routine-editor-help">El tipo de ejercicio decide qué datos registra FORGE y cómo razona el COACH.</p>
      <div id="routineEditorExercises" class="routine-editor-exercises"></div>

      <div class="routine-editor-footer">
        <button id="destructiveRoutineEditor" class="danger" type="button">Restaurar original</button>
        <div class="routine-editor-save-actions">
          <button id="cancelRoutineEditor" class="secondary" type="button">Cancelar</button>
          <button id="saveRoutineEditor" class="primary" type="button">Guardar cambios</button>
        </div>
      </div>
    </section>
  `;

  document.body.appendChild(overlay);
}

function numericInput(label, field, value, min, max, disabled = false, step = 1) {
  return `
    <label class="routine-number-field ${disabled ? "disabled" : ""}">
      <span>${label}</span>
      <input data-editor-field="${field}" type="number" min="${min}" max="${max}" step="${step}" value="${value ?? ""}" ${disabled ? "disabled" : ""}>
    </label>
  `;
}

function modeSelect(exercise) {
  const mode = normalizeExerciseMode(exercise.mode);
  return `
    <label class="routine-mode-field">
      <span>Tipo de ejercicio</span>
      <select data-editor-field="mode">
        ${EXERCISE_MODE_OPTIONS.map(option =>
          `<option value="${option.value}" ${option.value === mode ? "selected" : ""}>${option.label}</option>`
        ).join("")}
      </select>
    </label>
  `;
}

function modeFields(exercise) {
  const mode = normalizeExerciseMode(exercise.mode);

  if (mode === "strength") {
    const failure = Boolean(exercise.failure);
    return `
      ${numericInput("Calent.", "warmup", exercise.warmup ?? 0, 0, 8)}
      ${numericInput("Series", "sets", exercise.sets ?? 3, 1, 12)}
      ${numericInput("Rep mín.", "min", failure ? "" : exercise.min, 1, 100, failure)}
      ${numericInput("Rep máx.", "max", failure ? "" : exercise.max, 1, 100, failure)}
      <label class="routine-failure-field">
        <span>Al fallo</span>
        <input data-editor-field="failure" type="checkbox" ${failure ? "checked" : ""}>
      </label>
    `;
  }

  if (mode === "bodyweight") {
    return `
      ${numericInput("Series", "sets", exercise.sets ?? 3, 1, 12)}
      ${numericInput("Rep mín.", "min", exercise.min ?? 8, 1, 200)}
      ${numericInput("Rep máx.", "max", exercise.max ?? 12, 1, 200)}
      <div class="routine-mode-note">Sin kg. FORGE progresa por reps totales, calidad y RIR.</div>
    `;
  }

  if (mode === "maxreps") {
    return `
      ${numericInput("Series", "sets", exercise.sets ?? 3, 1, 12)}
      <div class="routine-mode-note">Cada serie se registra a máximas repeticiones técnicas. No hay rango fijo.</div>
    `;
  }

  if (mode === "time") {
    return `
      ${numericInput("Series", "sets", exercise.sets ?? 3, 1, 12)}
      ${numericInput("Objetivo (s)", "targetSeconds", exercise.targetSeconds ?? 30, 5, 7200)}
      <div class="routine-mode-note">Ideal para planchas, isométricos y ejercicios medidos por tiempo.</div>
    `;
  }

  return `
    ${numericInput("Bloques", "sets", exercise.sets ?? 1, 1, 12)}
    ${numericInput("Objetivo (min)", "targetMinutes", exercise.targetMinutes ?? 20, 1, 600, false, 0.5)}
    <div class="routine-mode-note">Durante el entrenamiento registrarás minutos y distancia. Sin kg, reps ni RIR.</div>
  `;
}

function exerciseRow(exercise, index) {
  const editableName = Boolean(exercise._isNew);

  return `
    <article class="routine-editor-exercise" data-editor-index="${index}">
      <div class="routine-editor-exercise-head">
        <span class="routine-editor-position">${index + 1}</span>
        <div class="routine-editor-exercise-name">
          ${editableName
            ? `<input data-editor-field="name" type="text" maxlength="90" value="${escapeHtml(exercise.name)}" placeholder="Nombre del ejercicio">`
            : `<strong>${escapeHtml(exercise.name)}</strong><small>Nombre protegido para conservar el historial</small>`}
        </div>
        <div class="routine-order-actions">
          <button data-editor-action="up" type="button" aria-label="Subir ejercicio" ${index === 0 ? "disabled" : ""}>↑</button>
          <button data-editor-action="down" type="button" aria-label="Bajar ejercicio" ${index === editing.exercises.length - 1 ? "disabled" : ""}>↓</button>
          <button data-editor-action="remove" class="remove" type="button" aria-label="Eliminar ejercicio">×</button>
        </div>
      </div>

      <div class="routine-editor-type-row">${modeSelect(exercise)}</div>
      <div class="routine-editor-fields mode-${normalizeExerciseMode(exercise.mode)}">
        ${modeFields(exercise)}
      </div>
    </article>
  `;
}

function renderExercises() {
  const container = document.querySelector("#routineEditorExercises");
  if (!container || !editing) return;
  container.innerHTML = editing.exercises.map(exerciseRow).join("");
}

function configureShell() {
  const destructive = document.querySelector("#destructiveRoutineEditor");
  const save = document.querySelector("#saveRoutineEditor");
  const intro = document.querySelector("#routineEditorIntro");
  const help = document.querySelector("#routineEditorHelp");

  if (creating) {
    document.querySelector("#routineEditorTitle").textContent = "Nueva rutina";
    intro.textContent = "Crea una rutina desde cero y mezcla musculación, peso corporal, tiempo o cardio.";
    help.textContent = "Elige el tipo de cada ejercicio: FORGE cambiará automáticamente los campos y la lógica del COACH.";
    destructive.classList.add("hidden");
    save.textContent = "Crear rutina";
    return;
  }

  document.querySelector("#routineEditorTitle").textContent = `Editar ${editing.name}`;
  intro.textContent = "Los cambios se aplican al próximo entrenamiento.";
  help.textContent = "Puedes cambiar el tipo de medición. El nombre de ejercicios existentes permanece protegido para no mezclar historiales.";
  destructive.classList.remove("hidden");
  destructive.textContent = isDefaultRoutine(editing.id) ? "Restaurar original" : "Eliminar rutina";
  save.textContent = "Guardar cambios";
}

function prepareExercise(exercise, isNew) {
  return {
    ...exercise,
    mode: normalizeExerciseMode(exercise.mode),
    _isNew: isNew
  };
}

function openEditor(id) {
  createShell();
  creating = false;
  const routine = getRoutine(id);
  editing = clone(routine);
  editing.exercises = editing.exercises.map(exercise => prepareExercise(exercise, false));

  document.querySelector("#routineEditorName").value = routine.name;
  document.querySelector("#routineEditorSubtitle").value = routine.subtitle;
  configureShell();
  renderExercises();

  document.querySelector("#routineEditorOverlay").classList.remove("hidden");
  document.body.classList.add("routine-editor-open");
}

function newExercise() {
  return {
    name: "",
    mode: "strength",
    warmup: 0,
    sets: 3,
    min: 8,
    max: 12,
    _isNew: true
  };
}

function openCreateEditor() {
  createShell();
  creating = true;
  editing = {
    id: null,
    name: "",
    subtitle: "",
    exercises: [newExercise()]
  };

  document.querySelector("#routineEditorName").value = "";
  document.querySelector("#routineEditorSubtitle").value = "";
  configureShell();
  renderExercises();

  document.querySelector("#routineEditorOverlay").classList.remove("hidden");
  document.body.classList.add("routine-editor-open");
  document.querySelector("#routineEditorName")?.focus();
}

function closeEditor() {
  document.querySelector("#routineEditorOverlay")?.classList.add("hidden");
  document.body.classList.remove("routine-editor-open");
  editing = null;
  creating = false;
}

function resetFieldsForMode(exercise, mode) {
  exercise.mode = mode;
  exercise.failure = false;
  exercise.warmup = 0;

  if (mode === "strength" || mode === "bodyweight") {
    exercise.sets = Math.max(1, Number(exercise.sets || 3));
    exercise.min = 8;
    exercise.max = 12;
  } else if (mode === "maxreps") {
    exercise.sets = Math.max(1, Number(exercise.sets || 3));
    exercise.min = null;
    exercise.max = null;
  } else if (mode === "time") {
    exercise.sets = Math.max(1, Number(exercise.sets || 3));
    exercise.targetSeconds = 30;
    exercise.min = null;
    exercise.max = null;
  } else {
    exercise.sets = 1;
    exercise.targetMinutes = 20;
    exercise.min = null;
    exercise.max = null;
  }
}

function updateExerciseField(target) {
  if (!editing) return;
  const row = target.closest("[data-editor-index]");
  if (!row) return;
  const index = Number(row.dataset.editorIndex);
  const exercise = editing.exercises[index];
  if (!exercise) return;

  const field = target.dataset.editorField;
  if (!field) return;

  if (field === "mode") {
    resetFieldsForMode(exercise, normalizeExerciseMode(target.value));
    renderExercises();
    return;
  }

  if (field === "failure") {
    exercise.failure = target.checked;
    if (exercise.failure) {
      exercise.min = null;
      exercise.max = null;
    } else {
      exercise.min = 8;
      exercise.max = 12;
    }
    renderExercises();
    return;
  }

  if (field === "name") {
    exercise.name = target.value;
    return;
  }

  const number = Number(target.value);
  if (["warmup", "sets", "min", "max", "targetSeconds", "targetMinutes"].includes(field)) {
    exercise[field] = number;
  }
}

function moveExercise(index, direction) {
  const nextIndex = index + direction;
  if (!editing || nextIndex < 0 || nextIndex >= editing.exercises.length) return;
  const [item] = editing.exercises.splice(index, 1);
  editing.exercises.splice(nextIndex, 0, item);
  renderExercises();
}

function removeExercise(index) {
  if (!editing || editing.exercises.length <= 1) {
    alert("La rutina debe conservar al menos un ejercicio.");
    return;
  }
  editing.exercises.splice(index, 1);
  renderExercises();
}

function addExercise() {
  if (!editing) return;
  editing.exercises.push(newExercise());
  renderExercises();
  document.querySelector('#routineEditorExercises article:last-child input[data-editor-field="name"]')?.focus();
}

function draftBelongsToRoutine(routineId) {
  return loadDraft()?.routineId === routineId;
}

function hasActiveProgress(routineId) {
  const draft = loadDraft();
  if (!draft || draft.routineId !== routineId) return false;
  return (draft.exercises || []).some(exercise =>
    (exercise.sets || []).some(set => set.done)
  );
}

function clearEditedRoutineDraft(routineId) {
  if (draftBelongsToRoutine(routineId)) clearDraft();
}

function validateEditor() {
  if (!editing) return false;

  editing.name = document.querySelector("#routineEditorName").value.trim();
  editing.subtitle = document.querySelector("#routineEditorSubtitle").value.trim();

  if (!editing.name || !editing.subtitle) {
    alert("Completa el nombre de la rutina y el subtítulo.");
    return false;
  }

  if (!editing.exercises.length) {
    alert("Añade al menos un ejercicio.");
    return false;
  }

  for (const exercise of editing.exercises) {
    exercise.name = String(exercise.name || "").trim();
    exercise.mode = normalizeExerciseMode(exercise.mode);

    if (!exercise.name) {
      alert("Hay un ejercicio sin nombre.");
      return false;
    }

    exercise.sets = Math.max(1, Number(exercise.sets || 1));

    if (exercise.mode === "strength") {
      exercise.warmup = Math.max(0, Number(exercise.warmup || 0));
      if (!exercise.failure) {
        exercise.min = Math.max(1, Number(exercise.min || 1));
        exercise.max = Math.max(1, Number(exercise.max || exercise.min));
        if (exercise.min > exercise.max) {
          alert(`En ${exercise.name}, las repeticiones mínimas no pueden superar las máximas.`);
          return false;
        }
      }
    }

    if (exercise.mode === "bodyweight") {
      exercise.min = Math.max(1, Number(exercise.min || 1));
      exercise.max = Math.max(1, Number(exercise.max || exercise.min));
      if (exercise.min > exercise.max) {
        alert(`En ${exercise.name}, las repeticiones mínimas no pueden superar las máximas.`);
        return false;
      }
    }

    if (exercise.mode === "time") {
      exercise.targetSeconds = Math.max(5, Number(exercise.targetSeconds || 30));
    }

    if (exercise.mode === "cardio") {
      exercise.targetMinutes = Math.max(1, Number(exercise.targetMinutes || 20));
    }
  }

  const names = editing.exercises.map(exercise => exercise.name.toLocaleLowerCase("es"));
  if (new Set(names).size !== names.length) {
    alert("No puede haber dos ejercicios con el mismo nombre dentro de la misma rutina.");
    return false;
  }

  return true;
}

function saveEditor() {
  if (!validateEditor()) return;

  const clean = clone(editing);
  clean.exercises.forEach(exercise => delete exercise._isNew);

  if (creating) {
    createRoutineConfiguration(clean);
    location.reload();
    return;
  }

  if (hasActiveProgress(editing.id)) {
    const confirmed = confirm(
      "Hay una sesión activa de esta rutina. Para aplicar los cambios hay que descartarla. ¿Continuar?"
    );
    if (!confirmed) return;
  }

  saveRoutineConfiguration(clean);
  clearEditedRoutineDraft(editing.id);
  location.reload();
}

function resetDefaultRoutine() {
  const confirmed = confirm(
    "¿Restaurar esta rutina exactamente a la versión original? El historial guardado no se borrará."
  );
  if (!confirmed) return;

  if (hasActiveProgress(editing.id)) {
    const discard = confirm("También se descartará la sesión activa de esta rutina. ¿Continuar?");
    if (!discard) return;
  }

  resetRoutineToDefault(editing.id);
  clearEditedRoutineDraft(editing.id);
  location.reload();
}

function deleteCustomRoutine() {
  const confirmed = confirm(
    `¿Eliminar “${editing.name}”? Los entrenamientos ya guardados seguirán en el historial.`
  );
  if (!confirmed) return;

  if (hasActiveProgress(editing.id)) {
    const discard = confirm("También se descartará la sesión activa de esta rutina. ¿Continuar?");
    if (!discard) return;
  }

  const wasActive = loadActiveRoutineId() === editing.id;
  deleteRoutineConfiguration(editing.id);
  clearEditedRoutineDraft(editing.id);

  if (wasActive) saveActiveRoutineId("dia1");
  location.reload();
}

function destructiveAction() {
  if (!editing || creating) return;
  if (isDefaultRoutine(editing.id)) resetDefaultRoutine();
  else deleteCustomRoutine();
}

function handleEditorAction(target) {
  const row = target.closest("[data-editor-index]");
  const index = row ? Number(row.dataset.editorIndex) : -1;

  if (target.dataset.editorAction === "up") moveExercise(index, -1);
  if (target.dataset.editorAction === "down") moveExercise(index, 1);
  if (target.dataset.editorAction === "remove") removeExercise(index);
}

createShell();

document.addEventListener("click", event => {
  const createButton = event.target.closest("[data-create-routine]");
  if (createButton) {
    event.preventDefault();
    openCreateEditor();
    return;
  }

  const editButton = event.target.closest("[data-edit-routine-id]");
  if (editButton) {
    event.preventDefault();
    event.stopPropagation();
    openEditor(editButton.dataset.editRoutineId);
    return;
  }

  const action = event.target.closest("[data-editor-action]");
  if (action) {
    handleEditorAction(action);
    return;
  }

  if (event.target.closest("#addRoutineExercise")) addExercise();
  if (event.target.closest("#saveRoutineEditor")) saveEditor();
  if (event.target.closest("#destructiveRoutineEditor")) destructiveAction();
  if (event.target.closest("#closeRoutineEditor") || event.target.closest("#cancelRoutineEditor")) closeEditor();

  const overlay = event.target.closest("#routineEditorOverlay");
  if (overlay && event.target === overlay) closeEditor();
});

document.addEventListener("input", event => {
  if (event.target.matches("[data-editor-field]")) updateExerciseField(event.target);
});

document.addEventListener("change", event => {
  if (event.target.matches('[data-editor-field="failure"], [data-editor-field="mode"]')) {
    updateExerciseField(event.target);
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && editing) closeEditor();
});
