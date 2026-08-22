import { formatDate } from "../core/utils.js";
import { totalWorkoutVolume } from "../core/workout.js";
import {
  normalizeExerciseMode,
  exerciseModeLabel,
  setHasPerformance,
  sessionPerformanceScore
} from "../core/exerciseModes.js";

function workoutMetricText(workout) {
  const volume = totalWorkoutVolume(workout);
  const sets = (workout.exercises || []).reduce((sum, exercise) =>
    sum + (exercise.sets || []).filter(set => set.type !== "warmup").length, 0);

  if (volume > 0) {
    return `${sets} registros · ${Math.round(volume).toLocaleString("es-ES")} kg de volumen`;
  }
  return `${sets} registros · sesión sin volumen de carga`;
}

export function renderProgress(db, routine) {
  const workouts = db.workouts || [];
  const history = document.querySelector("#historyList");
  history.innerHTML = "";

  if (!workouts.length) {
    document.querySelector("#trendExerciseLabel").textContent = "Tendencia";
    document.querySelector("#trendValue").textContent = "Sin datos";
    document.querySelector("#trendText").textContent = "Completa entrenamientos para generar tendencia.";
    document.querySelector("#trendBars").innerHTML = "";
    document.querySelector("#lastWorkoutTitle").textContent = "—";
    document.querySelector("#lastWorkoutMeta").textContent = "Todavía no hay sesiones finalizadas.";
    return;
  }

  const last = workouts.at(-1);
  const lastSets = (last.exercises || []).reduce((sum, exercise) =>
    sum + (exercise.sets || []).filter(set => set.type !== "warmup").length, 0);

  document.querySelector("#lastWorkoutTitle").textContent = last.name;
  document.querySelector("#lastWorkoutMeta").textContent =
    `${formatDate(last.date)} · ${(last.exercises || []).length} ejercicios · ${lastSets} registros · ${Math.round((last.durationSec || 0) / 60)} min`;

  history.innerHTML = [...workouts].reverse().slice(0, 10).map(workout => `
    <article class="history-item">
      <strong>${workout.name}</strong>
      <small>${formatDate(workout.date)} · ${workoutMetricText(workout)}</small>
    </article>
  `).join("");

  const firstDefinition = routine.exercises[0];
  const exerciseName = firstDefinition.name;
  const mode = normalizeExerciseMode(firstDefinition.mode);
  document.querySelector("#trendExerciseLabel").textContent =
    `${exerciseName} · ${exerciseModeLabel(mode)} · tendencia`;

  const scores = workouts.map(workout => {
    const exercise = workout.exercises?.find(item =>
      item.name === exerciseName && normalizeExerciseMode(item.mode) === mode
    );
    if (!exercise) return null;

    const workSets = exercise.sets.filter(set =>
      set.type !== "warmup" && setHasPerformance(set, mode)
    );
    if (!workSets.length) return null;

    return sessionPerformanceScore(workSets, mode);
  }).filter(value => value !== null).slice(-8);

  const bars = document.querySelector("#trendBars");
  bars.innerHTML = "";

  if (!scores.length) {
    document.querySelector("#trendValue").textContent = "Sin datos";
    document.querySelector("#trendText").textContent = `Registra ${exerciseName} para generar tendencia.`;
    return;
  }

  const min = Math.min(...scores);
  const max = Math.max(...scores);

  for (const score of scores) {
    const bar = document.createElement("span");
    const height = max === min ? 72 : 24 + ((score - min) / (max - min)) * 64;
    bar.style.height = `${height}%`;
    bars.appendChild(bar);
  }

  if (scores.length < 2) {
    document.querySelector("#trendValue").textContent = "Base creada";
    document.querySelector("#trendText").textContent = "Necesitamos otra sesión comparable del mismo tipo.";
    return;
  }

  const percent = (scores.at(-1) / scores[0] - 1) * 100;
  document.querySelector("#trendValue").textContent =
    `${percent >= 0 ? "↑" : "↓"} ${Math.abs(percent).toFixed(1)} %`;
  document.querySelector("#trendText").textContent =
    percent >= 0
      ? "Tendencia de rendimiento positiva para este tipo de ejercicio."
      : "Tendencia inferior a la referencia inicial.";
}
