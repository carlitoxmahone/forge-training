import {
  allWorkoutsVolume,
  countEffectiveSets,
  countPRImprovements
} from "../core/workout.js";
import { formatDate } from "../core/utils.js";

function hasActiveDraft(draft) {
  if (!draft) return false;
  if (draft.workoutStart) return true;

  return (draft.exercises || []).some(exercise =>
    (exercise.sets || []).some(set => set.done)
  );
}

export function renderDashboard(db, routine, draft) {
  const workouts = db.workouts || [];
  document.querySelector("#statSessions").textContent = workouts.length;
  document.querySelector("#statSets").textContent = countEffectiveSets(workouts);
  document.querySelector("#statVolume").textContent =
    `${Math.round(allWorkoutsVolume(workouts)).toLocaleString("es-ES")} kg`;
  document.querySelector("#statPRs").textContent = countPRImprovements(workouts);

  const last = workouts.at(-1);
  document.querySelector("#todaySummary").textContent = last
    ? `Última sesión ${formatDate(last.date)} · ${Math.round((last.durationSec || 0) / 60)} min.`
    : `Seleccionado: ${routine.name} · ${routine.subtitle}.`;

  const draftWorkSets = (draft?.exercises || [])
    .flatMap(exercise => exercise.sets || [])
    .filter(set => set.type === "work" && set.done).length;

  const active = hasActiveDraft(draft);

  document.querySelector("#draftTitle").textContent = active
    ? `${routine.name} en curso`
    : "Preparado para empezar";

  document.querySelector("#draftMeta").textContent = active
    ? (draftWorkSets > 0
        ? `${draftWorkSets} serie${draftWorkSets === 1 ? "" : "s"} efectiva${draftWorkSets === 1 ? "" : "s"} guardada${draftWorkSets === 1 ? "" : "s"} automáticamente.`
        : "Sesión iniciada. Todavía no hay series efectivas completadas.")
    : "FORGE guarda automáticamente cada cambio.";

  const startButton = document.querySelector("#startWorkoutBtn");
  const resumeButton = document.querySelector("#resumeWorkoutBtn");
  const discardButton = document.querySelector("#discardWorkoutBtn");

  if (startButton) startButton.textContent = active ? "Reanudar" : "Entrenar";
  if (resumeButton) resumeButton.textContent = active ? "Reanudar entrenamiento" : "Abrir entrenamiento";
  if (discardButton) discardButton.classList.toggle("hidden", !active);
}
