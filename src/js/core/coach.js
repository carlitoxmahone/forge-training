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

  // En series sucesivas aceptamos una pequeña caída por fatiga, pero evitamos
  // objetivos absurdos como “12-12”. Si estás justo en el mínimo, el objetivo
  // práctico es mantenerlo o sumar una repetición.
  const lowerTarget = reps <= exercise.min
    ? exercise.min
    : Math.max(exercise.min, reps - 1);
  const upperTarget = reps <= exercise.min
    ? Math.min(exercise.max, exercise.min + 1)
    : Math.min(exercise.max, reps);

  return `Mantén ${weightText} y busca ${formatRepTarget(lowerTarget, upperTarget)}. La caída ligera entre series es normal.`;
}

function nextSessionAdvice(exercise) {
  const completed = completedWorkSets(exercise);
  const all = workSets(exercise);

  if (!completed.length) {
    return "Pendiente de datos. FORGE decidirá al completar las series efectivas.";
  }

  if (exercise.failure) {
    if (completed.length < all.length) {
      return "Aún no hay decisión final: completa el ejercicio y compara rendimiento entre series.";
    }
    return "Mantén la carga si el fallo fue técnico y controlado; sube solo si claramente sobró margen.";
  }

  const allCompleted = completed.length === all.length;
  const belowRange = completed.some(set => Number(set.reps || 0) < exercise.min);
  const allAtTop = completed.every(set => Number(set.reps || 0) >= exercise.max);
  const averageRir = completed.reduce((sum, set) => sum + Number(set.rir ?? 1), 0) / completed.length;
  const topSets = completed.filter(set => Number(set.reps || 0) >= exercise.max).length;

  if (!allCompleted) {
    if (belowRange) {
      return "De momento: mantener carga. Necesitamos ver si recuperas el rango en las series restantes.";
    }
    if (topSets > 0 && averageRir <= 1.5) {
      return "Candidata a progresión, pero espera a terminar todas las series antes de subir carga la próxima vez.";
    }
    return "De momento: mantener carga y seguir sumando repeticiones dentro del rango.";
  }

  if (belowRange) {
    return "Próxima sesión: mantén la carga. Si vuelves a salirte por abajo del rango, considera reducir el mínimo incremento disponible.";
  }

  if (allAtTop && averageRir <= 1.5) {
    return "Próxima sesión: sube la carga con el incremento mínimo disponible y vuelve a construir desde la parte baja del rango.";
  }

  if (allAtTop && averageRir > 1.5) {
    return "Próxima sesión: probablemente puedes subir carga, pero confirma que las series estén realmente cerca del fallo.";
  }

  return "Próxima sesión: mantén la carga e intenta sumar repeticiones hasta dominar el techo del rango en todas las series.";
}

export function coachAdvice(exercise, set) {
  return {
    reading: reading(exercise, set),
    nextSet: nextSetAdvice(exercise, set),
    nextSession: nextSessionAdvice(exercise)
  };
}

export function coachMessage(exercise, set) {
  return coachAdvice(exercise, set).reading;
}
