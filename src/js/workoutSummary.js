import { loadDB, loadDraft } from "./core/storage.js";
import { formatClock, escapeHtml } from "./core/utils.js";

let pendingFinish = null;

function workSets(exercise) {
  return (exercise?.sets || []).filter(set =>
    set.type !== "warmup" && Number(set.reps || 0) > 0
  );
}

function setScore(set) {
  const weight = Number(set.weight || 0);
  const reps = Number(set.reps || 0);
  return weight > 0 ? weight * (1 + reps / 30) : reps;
}

function formatWeight(value) {
  const weight = Number(value || 0);
  if (!weight) return "0";
  return Number.isInteger(weight)
    ? String(weight)
    : weight.toFixed(1).replace(".", ",");
}

function formatSet(set) {
  const weight = Number(set.weight || 0);
  const reps = Number(set.reps || 0);
  if (weight > 0) return `${formatWeight(weight)} kg × ${reps}`;
  return `${reps} reps`;
}

function workoutVolume(workout) {
  return (workout?.exercises || []).reduce((total, exercise) =>
    total + workSets(exercise).reduce((sum, set) =>
      sum + Number(set.weight || 0) * Number(set.reps || 0), 0), 0);
}

function effectiveSetCount(workout) {
  return (workout?.exercises || []).reduce(
    (total, exercise) => total + workSets(exercise).length,
    0
  );
}

function previousSetsForExercise(previousWorkouts, exerciseName) {
  return previousWorkouts.flatMap(workout => {
    const exercise = (workout.exercises || []).find(item => item.name === exerciseName);
    return exercise ? workSets(exercise) : [];
  });
}

function bestRepsAtWeight(sets, weight) {
  return sets
    .filter(set => Number(set.weight || 0) === weight)
    .reduce((best, set) => Math.max(best, Number(set.reps || 0)), 0);
}

function analyseExercise(exercise, previousWorkouts) {
  const current = workSets(exercise);
  if (!current.length) return null;

  const previous = previousSetsForExercise(previousWorkouts, exercise.name);
  const currentBest = [...current].sort((a, b) => setScore(b) - setScore(a))[0];

  if (!previous.length) {
    return {
      exercise: exercise.name,
      kind: "baseline",
      title: "Referencia inicial",
      detail: `Primera referencia guardada: ${formatSet(currentBest)}.`
    };
  }

  const previousBestScore = Math.max(...previous.map(setScore));
  const currentBestScore = setScore(currentBest);
  const previousMaxWeight = Math.max(...previous.map(set => Number(set.weight || 0)));
  const currentMaxWeight = Math.max(...current.map(set => Number(set.weight || 0)));

  const reasons = [];

  if (currentBestScore > previousBestScore + 0.0001) {
    reasons.push(`mejor rendimiento: ${formatSet(currentBest)}`);
  }

  if (currentMaxWeight > previousMaxWeight) {
    reasons.push(`carga más alta: ${formatWeight(currentMaxWeight)} kg`);
  }

  let bestRepImprovement = null;
  for (const set of current) {
    const weight = Number(set.weight || 0);
    const reps = Number(set.reps || 0);
    const oldBest = bestRepsAtWeight(previous, weight);
    const difference = reps - oldBest;

    if (oldBest > 0 && difference > 0) {
      if (!bestRepImprovement || difference > bestRepImprovement.difference) {
        bestRepImprovement = { weight, reps, oldBest, difference };
      }
    }
  }

  if (bestRepImprovement) {
    const item = bestRepImprovement;
    reasons.push(
      `récord de reps con ${formatWeight(item.weight)} kg: ${item.oldBest} → ${item.reps}`
    );
  }

  if (!reasons.length) return null;

  return {
    exercise: exercise.name,
    kind: "pr",
    title: "Nuevo PR",
    detail: reasons.join(" · ")
  };
}

function analyseWorkout(workout, previousWorkouts) {
  const improvements = (workout.exercises || [])
    .map(exercise => analyseExercise(exercise, previousWorkouts))
    .filter(Boolean);

  const prs = improvements.filter(item => item.kind === "pr");
  const baselines = improvements.filter(item => item.kind === "baseline");

  const previousSameRoutine = [...previousWorkouts]
    .reverse()
    .find(item => item.routineId === workout.routineId);

  const volume = workoutVolume(workout);
  const previousVolume = previousSameRoutine ? workoutVolume(previousSameRoutine) : null;
  const volumeDelta = previousVolume && previousVolume > 0
    ? (volume / previousVolume - 1) * 100
    : null;

  return { prs, baselines, volume, previousVolume, volumeDelta };
}

function createShell() {
  if (document.querySelector("#workoutSummaryOverlay")) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./src/css/summary.css";
  document.head.appendChild(link);

  const overlay = document.createElement("div");
  overlay.id = "workoutSummaryOverlay";
  overlay.className = "summary-overlay hidden";
  overlay.innerHTML = `
    <section class="summary-sheet" role="dialog" aria-modal="true" aria-labelledby="summaryTitle">
      <div class="summary-head">
        <div>
          <div class="eyebrow">ENTRENAMIENTO GUARDADO</div>
          <h2 id="summaryTitle">Sesión completada</h2>
          <p id="summarySubtitle" class="muted"></p>
        </div>
        <button id="closeWorkoutSummary" class="icon-btn" type="button" aria-label="Cerrar resumen">×</button>
      </div>
      <div id="workoutSummaryContent"></div>
      <div class="summary-actions">
        <button id="summaryProgressBtn" class="secondary" type="button">Ver progreso</button>
        <button id="summaryDoneBtn" class="primary" type="button">Terminar</button>
      </div>
    </section>
  `;
  document.body.appendChild(overlay);
}

function renderImprovement(item) {
  return `
    <article class="summary-improvement ${item.kind}">
      <div class="summary-improvement-icon">${item.kind === "pr" ? "★" : "↗"}</div>
      <div>
        <span>${escapeHtml(item.title)}</span>
        <strong>${escapeHtml(item.exercise)}</strong>
        <p>${escapeHtml(item.detail)}</p>
      </div>
    </article>
  `;
}

function showSummary(workout, previousWorkouts, draftBeforeSave) {
  createShell();

  const analysis = analyseWorkout(workout, previousWorkouts);
  const setCount = effectiveSetCount(workout);
  const exerciseCount = (workout.exercises || []).filter(exercise => workSets(exercise).length).length;
  const draftTotalExercises = (draftBeforeSave?.exercises || []).length || exerciseCount;
  const duration = Number(workout.durationSec || 0);

  document.querySelector("#summaryTitle").textContent =
    analysis.prs.length
      ? `${analysis.prs.length} PR${analysis.prs.length === 1 ? "" : "s"} en esta sesión`
      : "Sesión completada";

  document.querySelector("#summarySubtitle").textContent = workout.name || "Entrenamiento";

  const volumeComparison = analysis.volumeDelta === null
    ? "Primera referencia de volumen para este día."
    : `${analysis.volumeDelta >= 0 ? "+" : ""}${analysis.volumeDelta.toFixed(1)} % frente a la última vez que hiciste este día.`;

  const improvements = [...analysis.prs, ...analysis.baselines];

  document.querySelector("#workoutSummaryContent").innerHTML = `
    <div class="summary-stats">
      <div><span>Duración</span><strong>${formatClock(duration)}</strong></div>
      <div><span>Series</span><strong>${setCount}</strong></div>
      <div><span>Volumen</span><strong>${Math.round(analysis.volume).toLocaleString("es-ES")} kg</strong></div>
      <div><span>Ejercicios</span><strong>${exerciseCount}/${draftTotalExercises}</strong></div>
    </div>

    <div class="summary-volume-note">
      <div class="eyebrow">VOLUMEN DE LA SESIÓN</div>
      <p>${escapeHtml(volumeComparison)}</p>
    </div>

    <div class="summary-section-head">
      <div>
        <div class="eyebrow">MEJORAS</div>
        <h3>${analysis.prs.length ? "Lo que has mejorado hoy" : "Registro de rendimiento"}</h3>
      </div>
      ${analysis.prs.length ? `<span class="summary-pr-count">${analysis.prs.length} PR</span>` : ""}
    </div>

    <div class="summary-improvements">
      ${improvements.length
        ? improvements.map(renderImprovement).join("")
        : `<div class="summary-no-pr"><strong>Sin nuevos PRs comparables.</strong><p>La sesión queda guardada y seguirá alimentando el historial y el COACH.</p></div>`}
    </div>
  `;

  document.querySelector("#workoutSummaryOverlay").classList.remove("hidden");
  document.body.classList.add("summary-open");
}

function closeSummary() {
  document.querySelector("#workoutSummaryOverlay")?.classList.add("hidden");
  document.body.classList.remove("summary-open");
}

function goToProgress() {
  closeSummary();
  document.querySelector('.bottom-nav button[data-tab="progress"]')?.click();
}

function captureFinish() {
  const db = loadDB();
  pendingFinish = {
    workoutCount: (db.workouts || []).length,
    previousWorkouts: structuredClone ? structuredClone(db.workouts || []) : JSON.parse(JSON.stringify(db.workouts || [])),
    draft: loadDraft()
  };

  setTimeout(() => {
    if (!pendingFinish) return;

    const after = loadDB();
    if ((after.workouts || []).length <= pendingFinish.workoutCount) {
      pendingFinish = null;
      return;
    }

    const savedWorkout = after.workouts.at(-1);
    const snapshot = pendingFinish;
    pendingFinish = null;
    showSummary(savedWorkout, snapshot.previousWorkouts, snapshot.draft);
  }, 80);
}

document.addEventListener("DOMContentLoaded", createShell);

document.addEventListener("click", event => {
  if (event.target.closest("#finishWorkoutBtn")) {
    captureFinish();
    return;
  }

  if (event.target.closest("#closeWorkoutSummary") || event.target.closest("#summaryDoneBtn")) {
    closeSummary();
    return;
  }

  if (event.target.closest("#summaryProgressBtn")) {
    goToProgress();
    return;
  }

  const overlay = event.target.closest("#workoutSummaryOverlay");
  if (overlay && event.target === overlay) closeSummary();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeSummary();
});
