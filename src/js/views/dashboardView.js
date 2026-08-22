import {
  allWorkoutsVolume,
  countEffectiveSets,
  countPRImprovements
} from "../core/workout.js";
import { formatDate } from "../core/utils.js";

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

  document.querySelector("#draftTitle").textContent =
    draftWorkSets > 0 ? `${routine.name} en curso` : "Preparado para empezar";
  document.querySelector("#draftMeta").textContent =
    draftWorkSets > 0
      ? `${draftWorkSets} series efectivas guardadas automáticamente.`
      : "FORGE guarda automáticamente cada cambio.";
}
