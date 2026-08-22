export function latestExerciseHistory(db, exerciseName) {
  const workouts = [...(db.workouts || [])].reverse();

  for (const workout of workouts) {
    const exercise = workout.exercises?.find(item => item.name === exerciseName);
    if (exercise?.sets?.length) {
      return {
        date: workout.date,
        sets: exercise.sets.filter(set => set.type !== "warmup")
      };
    }
  }

  return { date: null, sets: [] };
}

export function createExerciseState(definition, db) {
  const history = latestExerciseHistory(db, definition.name);
  const sets = [];

  for (let i = 0; i < (definition.warmup || 0); i++) {
    sets.push({
      type: "warmup",
      previous: null,
      target: "Calent.",
      weight: "",
      reps: "",
      rir: "",
      done: false
    });
  }

  for (let i = 0; i < definition.sets; i++) {
    const previous = history.sets[i] || null;

    sets.push({
      type: "work",
      previous,
      target: definition.failure ? "Fallo" : `${definition.min}-${definition.max}`,
      weight: previous?.weight ?? "",
      reps: "",
      rir: previous?.rir ?? 1,
      done: false
    });
  }

  return {
    ...definition,
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
  return completedWorkSets(exercises).reduce(
    (sum, set) => sum + Number(set.weight || 0) * Number(set.reps || 0),
    0
  );
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

  exercise.sets.push({
    type: "work",
    previous: null,
    target: exercise.failure ? "Fallo" : `${exercise.min}-${exercise.max}`,
    weight: previousWork?.weight ?? "",
    reps: "",
    rir: 1,
    done: false
  });
}

export function totalWorkoutVolume(workout) {
  return (workout.exercises || []).reduce((sum, exercise) => {
    const exerciseVolume = (exercise.sets || [])
      .filter(set => set.type !== "warmup")
      .reduce((setSum, set) => setSum + Number(set.weight || 0) * Number(set.reps || 0), 0);
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
      for (const set of (exercise.sets || []).filter(item => item.type !== "warmup")) {
        const weight = Number(set.weight || 0);
        const reps = Number(set.reps || 0);
        if (!reps) continue;

        const estimated = weight > 0 ? weight * (1 + reps / 30) : reps;
        if (best[exercise.name] === undefined) {
          best[exercise.name] = estimated;
        } else if (estimated > best[exercise.name]) {
          best[exercise.name] = estimated;
          improvements += 1;
        }
      }
    }
  }

  return improvements;
}
