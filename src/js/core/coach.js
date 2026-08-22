import { loadDB } from "./storage.js";

function workSets(exercise) {
  return exercise.sets.filter(set => set.type === "work");
}

function completedWorkSets(exercise) {
  return workSets(exercise).filter(set => set.done);
}

function nextPendingWorkSet(exercise) {
  return workSets(exercise).find(set => !set.done) || null;
}

function formatWeight(value) {
  const weight = Number(value || 0);
  return Number.isInteger(weight) ? String(weight) : weight.toFixed(1).replace(".", ",");
}

function formatRepTarget(min, max) {
  if (min === max) return `${min} reps`;
  return `${min}-${max} reps`;
}

function setScore(set) {
  const weight = Number(set.weight || 0);
  const reps = Number(set.reps || 0);
  return weight > 0 ? weight * (1 + reps / 30) : reps;
}

function historySessions(exerciseName) {
  return (loadDB().workouts || [])
    .map(workout => {
      const exercise = (workout.exercises || []).find(item => item.name === exerciseName);
      if (!exercise) return null;

      const sets = (exercise.sets || []).filter(set =>
        set.type !== "warmup" && Number(set.reps || 0) > 0
      );
      if (!sets.length) return null;

      const bestScore = Math.max(...sets.map(setScore));
      const maxWeight = Math.max(...sets.map(set => Number(set.weight || 0)));
      const volume = sets.reduce((sum, set) =>
        sum + Number(set.weight || 0) * Number(set.reps || 0), 0);

      return { date: workout.date, sets, bestScore, maxWeight, volume };
    })
    .filter(Boolean)
    .slice(-5);
}

function historicalStatus(exercise) {
  const sessions = historySessions(exercise.name);

  if (!sessions.length) {
    return {
      kind: "none",
      sessions,
      message: "Sin historial todavía. FORGE necesita sesiones guardadas antes de detectar una tendencia."
    };
  }

  if (sessions.length === 1) {
    return {
      kind: "baseline",
      sessions,
      message: "1 sesión guardada. Ya hay una referencia, pero todavía no suficiente para hablar de tendencia."
    };
  }

  const scores = sessions.map(session => session.bestScore);
  const last = scores.at(-1);
  const previous = scores.at(-2);
  const previousTwo = scores.slice(-3, -1);
  const previousAverage = previousTwo.reduce((sum, value) => sum + value, 0) / previousTwo.length;
  const recentThree = scores.slice(-3);
  const recentMax = Math.max(...recentThree);
  const recentMin = Math.min(...recentThree);
  const spread = recentMax > 0 ? (recentMax - recentMin) / recentMax : 0;

  if (sessions.length >= 3) {
    const nonDecreasing = recentThree[1] >= recentThree[0] * 0.995 &&
      recentThree[2] >= recentThree[1] * 0.995;
    const totalGain = recentThree[0] > 0
      ? recentThree[2] / recentThree[0] - 1
      : 0;

    if (nonDecreasing && totalGain >= 0.03) {
      return {
        kind: "progress",
        sessions,
        message: `Progresión sostenida: el rendimiento ha subido aproximadamente ${(totalGain * 100).toFixed(1)} % en las últimas 3 sesiones.`
      };
    }

    if (spread <= 0.025) {
      return {
        kind: "stagnant",
        sessions,
        message: "Estancamiento detectado: llevas 3 sesiones con un rendimiento prácticamente igual. Conviene buscar una pequeña mejora antes de aumentar carga."
      };
    }
  }

  if (previousAverage > 0 && last < previousAverage * 0.94) {
    const drop = (1 - last / previousAverage) * 100;
    return {
      kind: "decline",
      sessions,
      message: `Caída reciente de rendimiento: la última sesión quedó aproximadamente ${drop.toFixed(1)} % por debajo de tus referencias previas.`
    };
  }

  if (previous > 0 && last > previous * 1.015) {
    const gain = (last / previous - 1) * 100;
    return {
      kind: "improving",
      sessions,
      message: `Última sesión en mejora: tu mejor serie subió aproximadamente ${gain.toFixed(1)} % respecto a la anterior.`
    };
  }

  return {
    kind: "stable",
    sessions,
    message: `${sessions.length} sesiones analizadas. Rendimiento estable, sin una señal clara de estancamiento ni caída.`
  };
}

function sameWeightImprovement(set) {
  if (!set.previous) return "";
  if (Number(set.weight || 0) !== Number(set.previous.weight || 0)) return "";

  const difference = Number(set.reps || 0) - Number(set.previous.reps || 0);
  if (difference > 0) {
    return ` +${difference} rep${difference === 1 ? "" : "s"} frente a la sesión anterior.`;
  }
  if (difference === 0) return " Iguala tu marca anterior.";
  return ` ${Math.abs(difference)} rep${Math.abs(difference) === 1 ? "" : "s"} menos que la sesión anterior.`;
}

function reading(exercise, set) {
  if (!set) {
    const warmups = exercise.sets.filter(item => item.type === "warmup");
    const warmupsDone = warmups.filter(item => item.done).length;

    if (warmups.length && warmupsDone < warmups.length) {
      return `Calentamiento ${warmupsDone}/${warmups.length}. No cuenta como serie efectiva.`;
    }

    if (exercise.failure) {
      return "Las series efectivas están pautadas al fallo, manteniendo técnica y recorrido completo.";
    }

    return `Rango de trabajo: ${exercise.min}-${exercise.max} reps. Registra la primera serie para que FORGE ajuste el objetivo.`;
  }

  if (set.type === "warmup") {
    return "Calentamiento registrado. No cuenta como serie efectiva.";
  }

  const reps = Number(set.reps || 0);
  const rir = Number(set.rir ?? 1);
  let message = "";

  if (exercise.failure) {
    message = "Serie al fallo registrada.";
  } else if (reps < exercise.min) {
    message = `Has quedado por debajo del rango ${exercise.min}-${exercise.max}.`;
  } else if (reps > exercise.max) {
    message = `Has superado el rango ${exercise.min}-${exercise.max}.`;
  } else if (reps === exercise.max) {
    message = `Has tocado el techo del rango (${exercise.max} reps).`;
  } else {
    message = `Serie válida dentro del rango ${exercise.min}-${exercise.max}.`;
  }

  if (!exercise.failure) {
    if (rir <= 1) message += " Intensidad alta y bien alineada con el plan.";
    else if (rir >= 3) message += " Parece que todavía había bastante margen.";
  }

  return message + sameWeightImprovement(set);
}

function nextSetAdvice(exercise, set) {
  const next = nextPendingWorkSet(exercise);
  if (!next) return "Ejercicio terminado. La decisión pasa a la próxima sesión.";

  if (!set || set.type === "warmup") {
    if (exercise.failure) return "Primera serie efectiva: usa una carga que te permita llegar al fallo con técnica limpia.";
    return `Primera serie efectiva: busca ${exercise.min}-${exercise.max} reps con una carga controlable.`;
  }

  const reps = Number(set.reps || 0);
  const rir = Number(set.rir ?? 1);
  const weight = Number(set.weight || 0);
  const weightText = weight > 0 ? `${formatWeight(weight)} kg` : "la misma carga";

  if (exercise.failure) {
    return `Mantén ${weightText} si la técnica fue buena. No persigas más repeticiones sacrificando recorrido.`;
  }

  if (reps < exercise.min) {
    if (rir <= 1) {
      return `No subas. Mantén ${weightText}; si vuelves a quedar por debajo de ${exercise.min} reps, baja un poco la carga.`;
    }
    return `Mantén ${weightText}. Había margen: intenta entrar en ${exercise.min}-${exercise.max} reps en la siguiente.`;
  }

  if (reps > exercise.max) {
    return `Mantén ${weightText} durante este ejercicio. No hace falta subir carga a mitad de la sesión.`;
  }

  if (reps === exercise.max && rir <= 1) {
    const lower = Math.max(exercise.min, exercise.max - 1);
    return `Mantén ${weightText} y busca ${formatRepTarget(lower, exercise.max)}. Si repites el techo, confirmamos progresión.`;
  }

  if (rir >= 3) {
    const target = Math.min(exercise.max, reps + 1);
    return `Mantén ${weightText} y busca al menos ${target} reps, acercándote más al fallo con buena técnica.`;
  }

  const lowerTarget = reps <= exercise.min
    ? exercise.min
    : Math.max(exercise.min, reps - 1);
  const upperTarget = reps <= exercise.min
    ? Math.min(exercise.max, exercise.min + 1)
    : Math.min(exercise.max, reps);

  return `Mantén ${weightText} y busca ${formatRepTarget(lowerTarget, upperTarget)}. La caída ligera entre series es normal.`;
}

function nextSessionAdvice(exercise, history) {
  const completed = completedWorkSets(exercise);
  const all = workSets(exercise);

  if (!completed.length) {
    if (history.kind === "stagnant") {
      return "Historial estancado: hoy intenta mejorar al menos una repetición con la misma carga antes de plantear una subida."
    }
    if (history.kind === "decline") {
      return "El historial viene a la baja: hoy prioriza recuperar tu rendimiento habitual antes de aumentar carga."
    }
    return "Pendiente de datos de esta sesión. FORGE decidirá al completar las series efectivas.";
  }

  if (exercise.failure) {
    if (completed.length < all.length) {
      return "Aún no hay decisión final: completa el ejercicio y compara rendimiento entre series.";
    }
    return history.kind === "decline"
      ? "Próxima sesión: mantén la carga. Primero confirma que recuperas el rendimiento antes de progresar."
      : "Mantén la carga si el fallo fue técnico y controlado; sube solo si claramente sobró margen.";
  }

  const allCompleted = completed.length === all.length;
  const belowRange = completed.some(set => Number(set.reps || 0) < exercise.min);
  const allAtTop = completed.every(set => Number(set.reps || 0) >= exercise.max);
  const averageRir = completed.reduce((sum, set) => sum + Number(set.rir ?? 1), 0) / completed.length;
  const topSets = completed.filter(set => Number(set.reps || 0) >= exercise.max).length;

  if (!allCompleted) {
    if (belowRange) {
      return history.kind === "decline"
        ? "Mantén carga. La sesión y el historial apuntan a fatiga o pérdida de rendimiento; no progreses todavía."
        : "De momento: mantener carga. Necesitamos ver si recuperas el rango en las series restantes.";
    }
    if (topSets > 0 && averageRir <= 1.5) {
      return "Candidata a progresión, pero espera a terminar todas las series antes de subir carga la próxima vez.";
    }
    return "De momento: mantener carga y seguir sumando repeticiones dentro del rango.";
  }

  if (belowRange) {
    if (history.kind === "decline") {
      return "Próxima sesión: mantén la carga y busca recuperar el rango. Si la caída se repite, considera reducir el mínimo incremento disponible."
    }
    return "Próxima sesión: mantén la carga. Si vuelves a salirte por abajo del rango, considera reducir el mínimo incremento disponible.";
  }

  if (allAtTop && averageRir <= 1.5) {
    if (history.kind === "decline") {
      return "Hoy has cumplido el criterio de progresión pese a la caída previa. Repetiría esta carga una sesión más para confirmar antes de subir."
    }
    if (history.kind === "stagnant") {
      return "Has roto el estancamiento alcanzando el techo en todas las series: próxima sesión sube con el incremento mínimo disponible."
    }
    if (["progress", "improving"].includes(history.kind)) {
      return "Progresión confirmada por sesión e historial: sube la carga con el incremento mínimo disponible y vuelve a construir desde la parte baja del rango."
    }
    return "Próxima sesión: sube la carga con el incremento mínimo disponible y vuelve a construir desde la parte baja del rango.";
  }

  if (allAtTop && averageRir > 1.5) {
    return "Próxima sesión: probablemente puedes subir carga, pero confirma que las series estén realmente cerca del fallo.";
  }

  if (history.kind === "stagnant") {
    return "Llevas varias sesiones estable: mantén la carga y busca una mejora pequeña y medible, idealmente +1 rep total, antes de subir."
  }

  if (history.kind === "decline") {
    return "Próxima sesión: mantén la carga. El objetivo principal es recuperar tu nivel habitual antes de perseguir una progresión."
  }

  return "Próxima sesión: mantén la carga e intenta sumar repeticiones hasta dominar el techo del rango en todas las series.";
}

export function coachAdvice(exercise, set) {
  const history = historicalStatus(exercise);

  return {
    reading: reading(exercise, set),
    nextSet: nextSetAdvice(exercise, set),
    nextSession: nextSessionAdvice(exercise, history),
    trend: history.message,
    trendKind: history.kind,
    historySessions: history.sessions.length
  };
}

export function coachMessage(exercise, set) {
  return coachAdvice(exercise, set).reading;
}
