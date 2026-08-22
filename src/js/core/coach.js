export function coachMessage(exercise, set) {
  if (!set) {
    const warmups = exercise.sets.filter(item => item.type === "warmup");
    const warmupsDone = warmups.filter(item => item.done).length;
    const workDone = exercise.sets.filter(item => item.type === "work" && item.done).length;

    if (!workDone && warmups.length && warmupsDone < warmups.length) {
      return `Calentamiento ${warmupsDone}/${warmups.length}. No cuenta como serie efectiva.`;
    }

    if (exercise.failure) {
      return "Las series efectivas están pautadas al fallo, manteniendo técnica y recorrido.";
    }

    return `Objetivo: ${exercise.min}-${exercise.max} reps con técnica limpia y máxima intensidad.`;
  }

  if (set.type === "warmup") {
    return "Calentamiento registrado. No cuenta como serie efectiva.";
  }

  const reps = Number(set.reps || 0);
  const rir = Number(set.rir ?? 1);
  let message = "";

  if (exercise.failure) {
    message = "Serie al fallo registrada. Mantén técnica y recorrido completo.";
  } else if (reps < exercise.min) {
    message = `Por debajo del rango ${exercise.min}-${exercise.max}. No subiría carga todavía.`;
  } else if (reps > exercise.max) {
    message = `Has superado el rango ${exercise.min}-${exercise.max}.`;
    message += rir <= 1
      ? " Con esa intensidad, la próxima sesión es candidata clara a subir carga."
      : " Revisa que la serie haya quedado realmente cerca del fallo antes de subir.";
  } else {
    message = `Dentro del rango ${exercise.min}-${exercise.max}.`;

    if (reps === exercise.max) {
      message += rir <= 1
        ? " Has tocado el techo del rango cerca del fallo: buena candidata a progresión."
        : " Has tocado el techo del rango, pero todavía parece haber margen.";
    }
  }

  if (set.previous && Number(set.weight || 0) === Number(set.previous.weight || 0)) {
    const difference = reps - Number(set.previous.reps || 0);
    if (difference > 0) {
      message += ` +${difference} rep${difference === 1 ? "" : "s"} respecto a la última sesión.`;
    } else if (difference === 0) {
      message += " Iguala tu marca anterior.";
    }
  }

  return message;
}
