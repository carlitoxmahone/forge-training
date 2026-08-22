import { loadDB } from "./storage.js";
import {
  normalizeExerciseMode,
  setHasPerformance,
  sessionPerformanceScore,
  modeMetricName
} from "./exerciseModes.js";

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

function formatNumber(value, digits = 1) {
  const number = Number(value || 0);
  return Number.isInteger(number) ? String(number) : number.toFixed(digits).replace(".", ",");
}

function formatRepTarget(min, max) {
  if (min === max) return `${min} reps`;
  return `${min}-${max} reps`;
}

function historySessions(exercise) {
  const mode = normalizeExerciseMode(exercise.mode);

  return (loadDB().workouts || [])
    .map(workout => {
      const found = (workout.exercises || []).find(item =>
        item.name === exercise.name && normalizeExerciseMode(item.mode) === mode
      );
      if (!found) return null;

      const sets = (found.sets || []).filter(set =>
        set.type !== "warmup" && setHasPerformance(set, mode)
      );
      if (!sets.length) return null;

      return {
        date: workout.date,
        sets,
        score: sessionPerformanceScore(sets, mode),
        totalReps: sets.reduce((sum, set) => sum + Number(set.reps || 0), 0),
        totalSeconds: sets.reduce((sum, set) => sum + Number(set.seconds || 0), 0),
        totalMinutes: sets.reduce((sum, set) => sum + Number(set.durationMin || 0), 0),
        totalDistance: sets.reduce((sum, set) => sum + Number(set.distanceKm || 0), 0)
      };
    })
    .filter(Boolean)
    .slice(-5);
}

function trendPhrase(mode, kind, percent, count) {
  const metric = modeMetricName(mode);

  if (kind === "none") {
    return "Sin historial todavía. FORGE necesita sesiones guardadas antes de detectar una tendencia.";
  }

  if (kind === "baseline") {
    return "1 sesión guardada. Ya hay una referencia, pero todavía no suficiente para hablar de tendencia.";
  }

  if (kind === "progress") {
    if (mode === "bodyweight" || mode === "maxreps") {
      return `Progresión sostenida: tus repeticiones totales han mejorado aproximadamente ${percent.toFixed(1)} % en las últimas 3 sesiones.`;
    }
    if (mode === "time") {
      return `Progresión sostenida: tu tiempo total ha mejorado aproximadamente ${percent.toFixed(1)} % en las últimas 3 sesiones.`;
    }
    if (mode === "cardio") {
      return `Progresión cardiovascular sostenida: la métrica comparable de ritmo/trabajo ha mejorado aproximadamente ${percent.toFixed(1)} % en las últimas 3 sesiones.`;
    }
    return `Progresión sostenida: el rendimiento ha subido aproximadamente ${percent.toFixed(1)} % en las últimas 3 sesiones.`;
  }

  if (kind === "stagnant") {
    if (mode === "bodyweight" || mode === "maxreps") {
      return "Estancamiento detectado: llevas 3 sesiones con prácticamente las mismas repeticiones totales. Busca +1-2 reps totales o una variante ligeramente más difícil.";
    }
    if (mode === "time") {
      return "Estancamiento detectado: el tiempo total lleva 3 sesiones prácticamente igual. Intenta sumar unos segundos sin perder la posición.";
    }
    if (mode === "cardio") {
      return "Estancamiento detectado: 3 sesiones con un resultado cardiovascular muy parecido. Mejora solo una variable: un poco más de distancia o el mismo recorrido en menos tiempo.";
    }
    return "Estancamiento detectado: llevas 3 sesiones con un rendimiento prácticamente igual. Conviene buscar una pequeña mejora antes de aumentar carga.";
  }

  if (kind === "decline") {
    return `Caída reciente de ${metric}: la última sesión quedó aproximadamente ${percent.toFixed(1)} % por debajo de tus referencias previas.`;
  }

  if (kind === "improving") {
    return `Última sesión en mejora: ${metric} subió aproximadamente ${percent.toFixed(1)} % respecto a la anterior.`;
  }

  return `${count} sesiones analizadas. ${metric.charAt(0).toUpperCase() + metric.slice(1)} estable, sin una señal clara de estancamiento ni caída.`;
}

function historicalStatus(exercise) {
  const mode = normalizeExerciseMode(exercise.mode);
  const sessions = historySessions(exercise);

  if (!sessions.length) {
    return { kind: "none", sessions, message: trendPhrase(mode, "none", 0, 0) };
  }

  if (sessions.length === 1) {
    return { kind: "baseline", sessions, message: trendPhrase(mode, "baseline", 0, 1) };
  }

  const scores = sessions.map(session => session.score);
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
    const totalGain = recentThree[0] > 0 ? recentThree[2] / recentThree[0] - 1 : 0;

    if (nonDecreasing && totalGain >= 0.03) {
      return {
        kind: "progress",
        sessions,
        message: trendPhrase(mode, "progress", totalGain * 100, sessions.length)
      };
    }

    if (spread <= 0.025) {
      return {
        kind: "stagnant",
        sessions,
        message: trendPhrase(mode, "stagnant", 0, sessions.length)
      };
    }
  }

  if (previousAverage > 0 && last < previousAverage * 0.94) {
    const drop = (1 - last / previousAverage) * 100;
    return {
      kind: "decline",
      sessions,
      message: trendPhrase(mode, "decline", drop, sessions.length)
    };
  }

  if (previous > 0 && last > previous * 1.015) {
    const gain = (last / previous - 1) * 100;
    return {
      kind: "improving",
      sessions,
      message: trendPhrase(mode, "improving", gain, sessions.length)
    };
  }

  return {
    kind: "stable",
    sessions,
    message: trendPhrase(mode, "stable", 0, sessions.length)
  };
}

function sameWeightImprovement(set) {
  if (!set.previous) return "";
  if (Number(set.weight || 0) !== Number(set.previous.weight || 0)) return "";

  const difference = Number(set.reps || 0) - Number(set.previous.reps || 0);
  if (difference > 0) return ` +${difference} rep${difference === 1 ? "" : "s"} frente a la sesión anterior.`;
  if (difference === 0) return " Iguala tu marca anterior.";
  return ` ${Math.abs(difference)} rep${Math.abs(difference) === 1 ? "" : "s"} menos que la sesión anterior.`;
}

function strengthReading(exercise, set) {
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

  if (set.type === "warmup") return "Calentamiento registrado. No cuenta como serie efectiva.";

  const reps = Number(set.reps || 0);
  const rir = Number(set.rir ?? 1);
  let message = "";

  if (exercise.failure) message = "Serie al fallo registrada.";
  else if (reps < exercise.min) message = `Has quedado por debajo del rango ${exercise.min}-${exercise.max}.`;
  else if (reps > exercise.max) message = `Has superado el rango ${exercise.min}-${exercise.max}.`;
  else if (reps === exercise.max) message = `Has tocado el techo del rango (${exercise.max} reps).`;
  else message = `Serie válida dentro del rango ${exercise.min}-${exercise.max}.`;

  if (!exercise.failure) {
    if (rir <= 1) message += " Intensidad alta y bien alineada con el plan.";
    else if (rir >= 3) message += " Parece que todavía había bastante margen.";
  }

  return message + sameWeightImprovement(set);
}

function bodyweightReading(exercise, set) {
  if (!set) {
    return `Peso corporal: ${exercise.min}-${exercise.max} reps es una guía por serie. FORGE prioriza reps totales, técnica y RIR; no necesitas introducir kg.`;
  }

  const reps = Number(set.reps || 0);
  const rir = Number(set.rir ?? 1);
  let message = `${reps} reps registradas. Esta serie suma al total de la sesión.`;
  if (rir <= 1) message += " Intensidad alta.";
  else if (rir >= 3) message += " Quedaba bastante margen.";
  message += " No necesitas clavar la misma cifra en todas las series.";
  return message;
}

function maxRepsReading(set) {
  if (!set) {
    return "Reps máximas: cada serie se mide por el número de repeticiones técnicas. No hay un rango fijo que debas mantener.";
  }
  return `${Number(set.reps || 0)} reps registradas. La referencia será tu mejor serie y el total acumulado del ejercicio.`;
}

function timeReading(exercise, set) {
  if (!set) {
    return `Ejercicio por tiempo: objetivo orientativo ${Number(exercise.targetSeconds || 30)} s por serie. La técnica manda sobre aguantar unos segundos más.`;
  }
  const seconds = Number(set.seconds || 0);
  const target = Number(exercise.targetSeconds || 30);
  if (seconds >= target) return `${formatNumber(seconds)} s registrados. Has alcanzado o superado el objetivo sin necesidad de contar repeticiones.`;
  return `${formatNumber(seconds)} s registrados. Faltaron ${formatNumber(target - seconds)} s para la referencia, pero solo compensa alargar si mantienes la posición.`;
}

function cardioReading(exercise, set) {
  if (!set) {
    return `Cardio: referencia ${formatNumber(exercise.targetMinutes || 20)} min. FORGE medirá duración y distancia; aquí no se usan kg, repeticiones ni RIR.`;
  }

  const minutes = Number(set.durationMin || 0);
  const distance = Number(set.distanceKm || 0);
  if (distance > 0 && minutes > 0) {
    const speed = distance / minutes * 60;
    return `${formatNumber(minutes)} min · ${formatNumber(distance, 2)} km registrados · media ${formatNumber(speed)} km/h.`;
  }
  return `${formatNumber(minutes)} min de cardio registrados. Añadir distancia permitirá comparar también el ritmo entre sesiones.`;
}

function reading(exercise, set) {
  const mode = normalizeExerciseMode(exercise.mode);
  if (mode === "bodyweight") return bodyweightReading(exercise, set);
  if (mode === "maxreps") return maxRepsReading(set);
  if (mode === "time") return timeReading(exercise, set);
  if (mode === "cardio") return cardioReading(exercise, set);
  return strengthReading(exercise, set);
}

function strengthNextSet(exercise, set) {
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

  if (exercise.failure) return `Mantén ${weightText} si la técnica fue buena. No persigas más repeticiones sacrificando recorrido.`;

  if (reps < exercise.min) {
    if (rir <= 1) return `No subas. Mantén ${weightText}; si vuelves a quedar por debajo de ${exercise.min} reps, baja un poco la carga.`;
    return `Mantén ${weightText}. Había margen: intenta entrar en ${exercise.min}-${exercise.max} reps en la siguiente.`;
  }

  if (reps > exercise.max) return `Mantén ${weightText} durante este ejercicio. No hace falta subir carga a mitad de la sesión.`;

  if (reps === exercise.max && rir <= 1) {
    const lower = Math.max(exercise.min, exercise.max - 1);
    return `Mantén ${weightText} y busca ${formatRepTarget(lower, exercise.max)}. Si repites el techo, confirmamos progresión.`;
  }

  if (rir >= 3) {
    const target = Math.min(exercise.max, reps + 1);
    return `Mantén ${weightText} y busca al menos ${target} reps, acercándote más al fallo con buena técnica.`;
  }

  const lowerTarget = reps <= exercise.min ? exercise.min : Math.max(exercise.min, reps - 1);
  const upperTarget = reps <= exercise.min ? Math.min(exercise.max, exercise.min + 1) : Math.min(exercise.max, reps);
  return `Mantén ${weightText} y busca ${formatRepTarget(lowerTarget, upperTarget)}. La caída ligera entre series es normal.`;
}

function contextualNextSet(exercise, set) {
  const mode = normalizeExerciseMode(exercise.mode);
  const next = nextPendingWorkSet(exercise);
  if (!next) return "Ejercicio terminado. La decisión pasa a la próxima sesión.";

  if (mode === "bodyweight") {
    if (!set) return "Primera serie: busca repeticiones limpias y deja que FORGE use el total del ejercicio como referencia.";
    const reps = Number(set.reps || 0);
    return `Siguiente serie: usa tu propio peso y busca una serie sólida. Si la fatiga aparece, quedar algo por debajo de ${reps} reps es normal; importa el total final.`;
  }

  if (mode === "maxreps") {
    return !set
      ? "Primera serie: haz el máximo de repeticiones con técnica limpia."
      : "Siguiente serie: vuelve a máximas repeticiones técnicas. No necesitas igualar la primera serie; la fatiga forma parte de la prueba.";
  }

  if (mode === "time") {
    const target = Number(exercise.targetSeconds || 30);
    return `Siguiente serie: intenta acercarte de nuevo a ${formatNumber(target)} s, pero corta si pierdes la posición correcta.`;
  }

  if (mode === "cardio") {
    const target = Number(exercise.targetMinutes || 20);
    return `Siguiente bloque: usa ${formatNumber(target)} min como referencia. Intenta mantener o mejorar el ritmo sin convertirlo en una prueba de repeticiones.`;
  }

  return strengthNextSet(exercise, set);
}

function compareCurrentToLast(exercise, history) {
  const mode = normalizeExerciseMode(exercise.mode);
  const completed = completedWorkSets(exercise).filter(set => setHasPerformance(set, mode));
  const last = history.sessions.at(-1);
  if (!completed.length || !last) return null;

  if (mode === "bodyweight" || mode === "maxreps") {
    const total = completed.reduce((sum, set) => sum + Number(set.reps || 0), 0);
    return { current: total, previous: last.totalReps, unit: "reps" };
  }

  if (mode === "time") {
    const total = completed.reduce((sum, set) => sum + Number(set.seconds || 0), 0);
    return { current: total, previous: last.totalSeconds, unit: "s" };
  }

  if (mode === "cardio") {
    const distance = completed.reduce((sum, set) => sum + Number(set.distanceKm || 0), 0);
    const minutes = completed.reduce((sum, set) => sum + Number(set.durationMin || 0), 0);
    if (distance > 0 && last.totalDistance > 0) {
      return { current: distance, previous: last.totalDistance, unit: "km" };
    }
    return { current: minutes, previous: last.totalMinutes, unit: "min" };
  }

  return null;
}

function contextualNextSession(exercise, history) {
  const mode = normalizeExerciseMode(exercise.mode);
  const completed = completedWorkSets(exercise);
  const all = workSets(exercise);

  if (!completed.length) {
    if (history.kind === "stagnant") return "El historial está estancado: hoy busca una mejora pequeña y medible, sin forzar una progresión artificial.";
    if (history.kind === "decline") return "El historial viene a la baja: hoy prioriza recuperar tu referencia habitual antes de exigir más.";
    return "Pendiente de datos de esta sesión. FORGE decidirá cuando completes el ejercicio.";
  }

  const allCompleted = completed.length === all.length;
  if (!allCompleted) return "Aún no hay decisión final: completa los bloques/series previstos para comparar la sesión completa.";

  const comparison = compareCurrentToLast(exercise, history);

  if (mode === "bodyweight") {
    if (comparison?.previous > 0) {
      const diff = comparison.current - comparison.previous;
      if (diff > 0) return `Has sumado +${formatNumber(diff)} reps totales frente a la última sesión. Próxima vez intenta consolidarlo o añadir solo 1-2 reps más en total.`;
      if (diff < 0) return `Has quedado ${formatNumber(Math.abs(diff))} reps totales por debajo de la última sesión. Mantén la variante y busca recuperar antes de hacerla más difícil.`;
    }
    return "Próxima sesión: repite la misma variante y busca mejorar el total de reps con técnica limpia. Cuando el total sea claramente fácil, pasa a una variante más difícil o añade carga externa.";
  }

  if (mode === "maxreps") {
    if (comparison?.previous > 0 && comparison.current > comparison.previous) {
      return `Nuevo mejor total: +${formatNumber(comparison.current - comparison.previous)} reps frente a la última sesión. Próxima vez intenta superar el total, no una cifra fija por serie.`;
    }
    return "Próxima sesión: intenta superar tu mejor serie o el total de repeticiones del ejercicio. No existe un rango obligatorio que debas mantener.";
  }

  if (mode === "time") {
    if (comparison?.previous > 0) {
      const diff = comparison.current - comparison.previous;
      if (diff > 0) return `Has acumulado +${formatNumber(diff)} s respecto a la última sesión. Próxima vez consolida ese tiempo o añade unos pocos segundos.`;
      if (diff < 0) return `Tiempo total ${formatNumber(Math.abs(diff))} s inferior a la última sesión. Mantén el objetivo y prioriza una posición perfecta.`;
    }
    return `Próxima sesión: intenta sumar algunos segundos al total o alcanzar ${formatNumber(exercise.targetSeconds || 30)} s con mejor control.`;
  }

  if (mode === "cardio") {
    if (comparison?.previous > 0) {
      const diff = comparison.current - comparison.previous;
      if (diff > 0) return `Sesión mejorada: +${formatNumber(diff, comparison.unit === "km" ? 2 : 1)} ${comparison.unit} frente a la última referencia comparable. Próxima vez mejora solo una variable.`;
      if (diff < 0 && history.kind === "decline") return "La sesión confirma una bajada reciente. Próxima vez repite una intensidad cómoda y recupera tu referencia antes de apretar más.";
    }
    return "Próxima sesión: mejora una sola variable: un poco más de distancia en el mismo tiempo o el mismo recorrido en menos tiempo. No se aplica lógica de kg/reps.";
  }

  return "Próxima sesión: usa esta sesión como nueva referencia.";
}

function strengthNextSession(exercise, history) {
  const completed = completedWorkSets(exercise);
  const all = workSets(exercise);

  if (!completed.length) {
    if (history.kind === "stagnant") return "Historial estancado: hoy intenta mejorar al menos una repetición con la misma carga antes de plantear una subida.";
    if (history.kind === "decline") return "El historial viene a la baja: hoy prioriza recuperar tu rendimiento habitual antes de aumentar carga.";
    return "Pendiente de datos de esta sesión. FORGE decidirá al completar las series efectivas.";
  }

  if (exercise.failure) {
    if (completed.length < all.length) return "Aún no hay decisión final: completa el ejercicio y compara rendimiento entre series.";
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
    if (topSets > 0 && averageRir <= 1.5) return "Candidata a progresión, pero espera a terminar todas las series antes de subir carga la próxima vez.";
    return "De momento: mantener carga y seguir sumando repeticiones dentro del rango.";
  }

  if (belowRange) {
    if (history.kind === "decline") return "Próxima sesión: mantén la carga y busca recuperar el rango. Si la caída se repite, considera reducir el mínimo incremento disponible.";
    return "Próxima sesión: mantén la carga. Si vuelves a salirte por abajo del rango, considera reducir el mínimo incremento disponible.";
  }

  if (allAtTop && averageRir <= 1.5) {
    if (history.kind === "decline") return "Hoy has cumplido el criterio de progresión pese a la caída previa. Repetiría esta carga una sesión más para confirmar antes de subir.";
    if (history.kind === "stagnant") return "Has roto el estancamiento alcanzando el techo en todas las series: próxima sesión sube con el incremento mínimo disponible.";
    if (["progress", "improving"].includes(history.kind)) return "Progresión confirmada por sesión e historial: sube la carga con el incremento mínimo disponible y vuelve a construir desde la parte baja del rango.";
    return "Próxima sesión: sube la carga con el incremento mínimo disponible y vuelve a construir desde la parte baja del rango.";
  }

  if (allAtTop && averageRir > 1.5) return "Próxima sesión: probablemente puedes subir carga, pero confirma que las series estén realmente cerca del fallo.";
  if (history.kind === "stagnant") return "Llevas varias sesiones estable: mantén la carga y busca una mejora pequeña y medible, idealmente +1 rep total, antes de subir.";
  if (history.kind === "decline") return "Próxima sesión: mantén la carga. El objetivo principal es recuperar tu nivel habitual antes de perseguir una progresión.";
  return "Próxima sesión: mantén la carga e intenta sumar repeticiones hasta dominar el techo del rango en todas las series.";
}

function nextSessionAdvice(exercise, history) {
  return normalizeExerciseMode(exercise.mode) === "strength"
    ? strengthNextSession(exercise, history)
    : contextualNextSession(exercise, history);
}

export function coachAdvice(exercise, set) {
  const history = historicalStatus(exercise);

  return {
    reading: reading(exercise, set),
    nextSet: contextualNextSet(exercise, set),
    nextSession: nextSessionAdvice(exercise, history),
    trend: history.message,
    trendKind: history.kind,
    historySessions: history.sessions.length
  };
}

export function coachMessage(exercise, set) {
  return coachAdvice(exercise, set).reading;
}
