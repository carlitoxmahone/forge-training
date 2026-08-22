export const EXERCISE_MODE_OPTIONS = [
  { value: "strength", label: "Musculación" },
  { value: "bodyweight", label: "Peso corporal" },
  { value: "maxreps", label: "Reps máximas" },
  { value: "time", label: "Tiempo / isométrico" },
  { value: "cardio", label: "Cardio" }
];

const VALID_MODES = new Set(EXERCISE_MODE_OPTIONS.map(option => option.value));

export function normalizeExerciseMode(value) {
  return VALID_MODES.has(value) ? value : "strength";
}

export function exerciseModeLabel(value) {
  const mode = normalizeExerciseMode(value);
  return EXERCISE_MODE_OPTIONS.find(option => option.value === mode)?.label || "Musculación";
}

export function isRepMode(value) {
  return ["strength", "bodyweight", "maxreps"].includes(normalizeExerciseMode(value));
}

export function targetForExercise(exercise) {
  const mode = normalizeExerciseMode(exercise?.mode);

  if (mode === "strength") {
    return exercise?.failure ? "Fallo" : `${exercise?.min ?? 8}-${exercise?.max ?? 12} reps`;
  }

  if (mode === "bodyweight") {
    return `${exercise?.min ?? 8}-${exercise?.max ?? 12} reps`;
  }

  if (mode === "maxreps") return "Máx. reps";
  if (mode === "time") return `${Number(exercise?.targetSeconds || 30)} s`;
  return `${Number(exercise?.targetMinutes || 20)} min`;
}

export function setHasPerformance(set, modeValue) {
  const mode = normalizeExerciseMode(modeValue);
  if (mode === "time") return Number(set?.seconds || 0) > 0;
  if (mode === "cardio") return Number(set?.durationMin || 0) > 0;
  return Number(set?.reps || 0) > 0;
}

export function setPerformanceScore(set, modeValue) {
  const mode = normalizeExerciseMode(modeValue);

  if (mode === "strength") {
    const weight = Number(set?.weight || 0);
    const reps = Number(set?.reps || 0);
    return weight > 0 ? weight * (1 + reps / 30) : reps;
  }

  if (mode === "bodyweight" || mode === "maxreps") {
    return Number(set?.reps || 0);
  }

  if (mode === "time") return Number(set?.seconds || 0);

  const minutes = Number(set?.durationMin || 0);
  const distance = Number(set?.distanceKm || 0);
  if (distance > 0 && minutes > 0) return distance / minutes * 60;
  return minutes;
}

export function sessionPerformanceScore(sets, modeValue) {
  const mode = normalizeExerciseMode(modeValue);
  const valid = (sets || []).filter(set => setHasPerformance(set, mode));
  if (!valid.length) return 0;

  if (mode === "strength") {
    return Math.max(...valid.map(set => setPerformanceScore(set, mode)));
  }

  if (mode === "bodyweight" || mode === "maxreps") {
    return valid.reduce((sum, set) => sum + Number(set.reps || 0), 0);
  }

  if (mode === "time") {
    return valid.reduce((sum, set) => sum + Number(set.seconds || 0), 0);
  }

  const totalDistance = valid.reduce((sum, set) => sum + Number(set.distanceKm || 0), 0);
  const totalMinutes = valid.reduce((sum, set) => sum + Number(set.durationMin || 0), 0);
  if (totalDistance > 0 && totalMinutes > 0) return totalDistance / totalMinutes * 60;
  return totalMinutes;
}

function formatNumber(value, digits = 1) {
  const number = Number(value || 0);
  if (Number.isInteger(number)) return String(number);
  return number.toFixed(digits).replace(".", ",");
}

export function formatSetForMode(set, modeValue) {
  const mode = normalizeExerciseMode(modeValue);

  if (mode === "strength") {
    const weight = Number(set?.weight || 0);
    const reps = Number(set?.reps || 0);
    const rir = set?.rir === null || set?.rir === undefined ? null : Number(set.rir);
    const main = weight > 0 ? `${formatNumber(weight)} kg × ${reps}` : `${reps} reps`;
    return rir === null || Number.isNaN(rir) ? main : `${main} · RIR ${rir}`;
  }

  if (mode === "bodyweight") {
    const reps = Number(set?.reps || 0);
    const rir = set?.rir === null || set?.rir === undefined ? null : Number(set.rir);
    return rir === null || Number.isNaN(rir) ? `${reps} reps` : `${reps} reps · RIR ${rir}`;
  }

  if (mode === "maxreps") return `${Number(set?.reps || 0)} reps`;
  if (mode === "time") return `${formatNumber(set?.seconds || 0)} s`;

  const minutes = Number(set?.durationMin || 0);
  const distance = Number(set?.distanceKm || 0);
  if (distance > 0) return `${formatNumber(minutes)} min · ${formatNumber(distance, 2)} km`;
  return `${formatNumber(minutes)} min`;
}

export function modeMetricName(modeValue) {
  const mode = normalizeExerciseMode(modeValue);
  if (mode === "bodyweight" || mode === "maxreps") return "repeticiones totales";
  if (mode === "time") return "tiempo total";
  if (mode === "cardio") return "ritmo / trabajo cardiovascular";
  return "rendimiento";
}
