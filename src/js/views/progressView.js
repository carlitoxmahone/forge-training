import { formatDate } from "../core/utils.js";
import { totalWorkoutVolume } from "../core/workout.js";

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
    `${formatDate(last.date)} · ${(last.exercises || []).length} ejercicios · ${lastSets} series · ${Math.round((last.durationSec || 0) / 60)} min`;

  history.innerHTML = [...workouts].reverse().slice(0, 10).map(workout => `
    <article class="history-item">
      <strong>${workout.name}</strong>
      <small>${formatDate(workout.date)} · ${Math.round(totalWorkoutVolume(workout)).toLocaleString("es-ES")} kg de volumen</small>
    </article>
  `).join("");

  const exerciseName = routine.exercises[0].name;
  document.querySelector("#trendExerciseLabel").textContent = `${exerciseName} · tendencia`;

  const scores = workouts.map(workout => {
    const exercise = workout.exercises?.find(item => item.name === exerciseName);
    if (!exercise) return null;

    const workSets = exercise.sets.filter(set => set.type !== "warmup" && Number(set.reps || 0) > 0);
    if (!workSets.length) return null;

    return Math.max(...workSets.map(set => {
      const weight = Number(set.weight || 0);
      const reps = Number(set.reps || 0);
      return weight > 0 ? weight * (1 + reps / 30) : reps;
    }));
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
    document.querySelector("#trendText").textContent = "Necesitamos otra sesión comparable.";
    return;
  }

  const percent = (scores.at(-1) / scores[0] - 1) * 100;
  document.querySelector("#trendValue").textContent =
    `${percent >= 0 ? "↑" : "↓"} ${Math.abs(percent).toFixed(1)} %`;
  document.querySelector("#trendText").textContent =
    percent >= 0
      ? "Tendencia de rendimiento positiva."
      : "Tendencia inferior a la referencia inicial.";
}
