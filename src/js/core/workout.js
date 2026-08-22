import {
  normalizeExerciseMode,
  targetForExercise,
  setHasPerformance,
  sessionPerformanceScore
} from "./exerciseModes.js";

export function latestExerciseHistory(db, exerciseName, modeValue = "strength") {
  const mode = normalizeExerciseMode(modeValue);
  const workouts = [...(db.workouts || [])].reverse();

  for (const workout of workouts) {
    const exercise = workout.exercises?.find(item =>
      item.name === exerciseName && normalizeExerciseMode(item.mode) === mode
    );

    if (exercise?.sets?.length) {
      return {
        date: workout.date,
        sets: exercise.sets.filter(set => set.type !== "warmup")
      };
    }
  }

  return { date: null, sets: [] };
}

function emptyWorkSet(definition, previous = null) {
  const mode = normalizeExerciseMode(definition.mode);
  const base = {
    type: "work",
    previous,
    target: targetForExercise(definition),
    weight: "",
    reps: "",
    rir: "",
    seconds: "",
    durationMin: "",
    distanceKm: "",
    done: false
  };

  if (mode === "strength") {
    base.weight = previous?.weight ?? "";
    base.rir = previous?.rir ?? 1;
  } else if (mode === "bodyweight") {
    base.rir = previous?.rir ?? 1;
  }

  return base;
}

export function createExerciseState(definition, db) {
  const mode = normalizeExerciseMode(definition.mode);
  const normalized = { ...definition, mode };
  const history = latestExerciseHistory(db, definition.name, mode);
  const sets = [];

  for (let i = 0; i < (mode === "strength" ? (definition.warmup || 0) : 0); i++) {
    sets.push({
      type: "warmup",
      previous: null,
      target: "Calent.",
      weight: "",
      reps: "",
      rir: "",
      seconds: "",
      durationMin: "",
      distanceKm: "",
      done: false
    });
  }

  for (let i = 0; i < definition.sets; i++) {
    sets.push(emptyWorkSet(normalized, history.sets[i] || null));
  }

  return {
    ...normalized,
    historyDate: history.date,
    sets
  };
}

export function createRoutineState(routine, db) {
  return routine.exercises.map(definition => createExerciseState(definition, db));
}

export function completedWorkSets(exercises) {
  return exercises.flatMap(exercise =>
    exercise.sets.filter(set => set.type === "work" && set.done)
  );
}

export function sessionVolume(exercises) {
  return (exercises || []).reduce((total, exercise) => {
    if (normalizeExerciseMode(exercise.mode) !== "strength") return total;

    const exerciseVolume = (exercise.sets || [])
      .filter(set => set.type === "work" && set.done)
      .reduce((sum, set) =>
        sum + Number(set.weight || 0) * Number(set.reps || 0), 0);

    return total + exerciseVolume;
  }, 0);
}

export function sessionStats(exercises) {
  const effectiveSets = exercises.flatMap(exercise =>
    exercise.sets.filter(set => set.type === "work")
  );

  const completedSets = effectiveSets.filter(set => set.done).length;
  const completeExercises = exercises.filter(exercise => {
    const work = exercise.sets.filter(set => set.type === "work");
    return work.length > 0 && work.every(set => set.done);
  }).length;

  return {
    completedSets,
    totalSets: effectiveSets.length,
    completeExercises,
    totalExercises: exercises.length,
    volume: sessionVolume(exercises)
  };
}

export function addWorkSet(exercise) {
  const previousWork = [...exercise.sets].reverse().find(set => set.type === "work");
  const next = emptyWorkSet(exercise, null);

  if (normalizeExerciseMode(exercise.mode) === "strength") {
    next.weight = previousWork?.weight ?? "";
  }

  exercise.sets.push(next);
}

export function totalWorkoutVolume(workout) {
  return (workout.exercises || []).reduce((sum, exercise) => {
    if (normalizeExerciseMode(exercise.mode) !== "strength") return sum;

    const exerciseVolume = (exercise.sets || [])
      .filter(set => set.type !== "warmup")
      .reduce((setSum, set) =>
        setSum + Number(set.weight || 0) * Number(set.reps || 0), 0);

    return sum + exerciseVolume;
  }, 0);
}

export function allWorkoutsVolume(workouts) {
  return workouts.reduce((sum, workout) => sum + totalWorkoutVolume(workout), 0);
}

export function countEffectiveSets(workouts) {
  return workouts.reduce((sum, workout) => {
    return sum + (workout.exercises || []).reduce((exerciseSum, exercise) => {
      return exerciseSum + (exercise.sets || []).filter(set => set.type !== "warmup").length;
    }, 0);
  }, 0);
}

export function countPRImprovements(workouts) {
  const best = {};
  let improvements = 0;

  for (const workout of workouts) {
    for (const exercise of workout.exercises || []) {
      const mode = normalizeExerciseMode(exercise.mode);
      const sets = (exercise.sets || []).filter(set =>
        set.type !== "warmup" && setHasPerformance(set, mode)
      );
      if (!sets.length) continue;

      const score = sessionPerformanceScore(sets, mode);
      const key = `${exercise.name}::${mode}`;

      if (best[key] === undefined) {
        best[key] = score;
      } else if (score > best[key] + 0.0001) {
        best[key] = score;
        improvements += 1;
      }
    }
  }

  return improvements;
}
