const STORAGE_KEY = "forge.routines.v1";

export const DEFAULT_ROUTINES = [
  {
    id: "dia1",
    name: "Día 1 · Empujes",
    subtitle: "Prioridad pecho",
    exercises: [
      { name: "Aperturas peck deck / cruces polea mitad altura", warmup: 2, sets: 3, min: 12, max: 15 },
      { name: "Press inclinado multipower / libre", warmup: 0, sets: 3, min: 8, max: 10 },
      { name: "Press plano con mancuernas", warmup: 0, sets: 3, min: 8, max: 10 },
      { name: "Máquina pectoral plano", warmup: 0, sets: 3, min: 12, max: 15 },
      { name: "Elevaciones laterales mancuernas", warmup: 0, sets: 4, min: 12, max: 15 },
      { name: "Tríceps polea alta cuerdas / barra", warmup: 0, sets: 5, min: 12, max: 15 }
    ]
  },
  {
    id: "dia2",
    name: "Día 2 · Espalda + bíceps",
    subtitle: "Espalda + bíceps",
    exercises: [
      { name: "Pull over con cuerdas", warmup: 2, sets: 2, min: 12, max: 15 },
      { name: "Remo hammer agarre prono espalda alta", warmup: 0, sets: 3, min: 8, max: 10 },
      { name: "Jalón al pecho barra agarre abierto", warmup: 0, sets: 3, min: 8, max: 10 },
      { name: "Remo gironda con barra espalda alta", warmup: 0, sets: 3, min: 8, max: 10 },
      { name: "Jalón al pecho unilateral máquina / polea", warmup: 0, sets: 2, min: 8, max: 10 },
      { name: "Remo gironda agarre cerrado", warmup: 0, sets: 3, min: 10, max: 12 },
      { name: "Hiperextensiones lumbar", warmup: 0, sets: 3, min: 12, max: 15 },
      { name: "Bíceps polea baja con barra", warmup: 0, sets: 5, min: 12, max: 15 }
    ]
  },
  {
    id: "dia3",
    name: "Día 3 · Pierna",
    subtitle: "Pierna",
    exercises: [
      { name: "Extensión de cuádriceps", warmup: 0, sets: 3, min: 12, max: 15 },
      { name: "Sentadilla libre / multipower / hack", warmup: 0, sets: 3, min: 8, max: 12 },
      { name: "Prensa", warmup: 0, sets: 3, min: 8, max: 12 },
      { name: "Aductor en máquina", warmup: 0, sets: 4, min: 15, max: 20 },
      { name: "Peso muerto rumano con mancuernas", warmup: 0, sets: 4, min: 10, max: 12 },
      { name: "Femoral sentado", warmup: 0, sets: 4, min: 10, max: 12 },
      { name: "Gemelo a tu gusto", warmup: 0, sets: 3, min: null, max: null, failure: true }
    ]
  },
  {
    id: "dia4",
    name: "Día 4 · Empujes",
    subtitle: "Prioridad hombro",
    exercises: [
      { name: "Press militar mancuernas / multipower / máquina", warmup: 0, sets: 2, min: 8, max: 10 },
      { name: "Elevaciones laterales mancuernas sentado", warmup: 0, sets: 4, min: 12, max: 15 },
      { name: "Elevaciones laterales máquina / polea baja", warmup: 0, sets: 4, min: 12, max: 15 },
      { name: "Hombro posterior cables / pájaros banco", warmup: 0, sets: 3, min: 12, max: 15 },
      { name: "Hombro posterior peck deck / face pull", warmup: 0, sets: 3, min: 12, max: 15 },
      { name: "Máquina pectoral plano", warmup: 0, sets: 2, min: 12, max: 15 },
      { name: "Cruces polea desde arriba pecho inferior", warmup: 0, sets: 2, min: 12, max: 15 }
    ]
  },
  {
    id: "dia5",
    name: "Día 5 · Brazos",
    subtitle: "Bíceps + tríceps",
    exercises: [
      { name: "Bíceps barra libre / mancuernas", warmup: 0, sets: 3, min: 8, max: 12 },
      { name: "Tríceps polea alta con barra", warmup: 0, sets: 3, min: 12, max: 15 },
      { name: "Bíceps martillo con mancuernas", warmup: 0, sets: 3, min: 12, max: 15 },
      { name: "Tríceps fondos máquina / libre", warmup: 0, sets: 3, min: 12, max: 15 },
      { name: "Bíceps máquina codos apoyados", warmup: 0, sets: 3, min: 12, max: 15 },
      { name: "Tríceps detrás de cabeza polea baja", warmup: 0, sets: 3, min: 12, max: 15 }
    ]
  }
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sanitizeExercise(exercise) {
  const failure = Boolean(exercise?.failure);
  const sets = Math.max(1, Math.min(12, Number(exercise?.sets || 1)));
  const warmup = Math.max(0, Math.min(8, Number(exercise?.warmup || 0)));
  const min = failure ? null : Math.max(1, Math.min(100, Number(exercise?.min || 8)));
  const max = failure ? null : Math.max(min, Math.min(100, Number(exercise?.max || min)));

  return {
    name: String(exercise?.name || "Ejercicio").trim() || "Ejercicio",
    warmup,
    sets,
    min,
    max,
    ...(failure ? { failure: true } : {})
  };
}

function sanitizeRoutine(routine, fallback) {
  const exercises = Array.isArray(routine?.exercises) && routine.exercises.length
    ? routine.exercises.map(sanitizeExercise)
    : clone(fallback.exercises);

  return {
    id: fallback.id,
    name: String(routine?.name || fallback.name).trim() || fallback.name,
    subtitle: String(routine?.subtitle || fallback.subtitle).trim() || fallback.subtitle,
    exercises
  };
}

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function loadRoutines() {
  const stored = readStored();
  if (!stored) return clone(DEFAULT_ROUTINES);

  return DEFAULT_ROUTINES.map(fallback => {
    const saved = stored.find(routine => routine?.id === fallback.id);
    return saved ? sanitizeRoutine(saved, fallback) : clone(fallback);
  });
}

export const ROUTINES = loadRoutines();

export function getRoutine(id) {
  return ROUTINES.find(routine => routine.id === id) || ROUTINES[0];
}

export function getDefaultRoutine(id) {
  const found = DEFAULT_ROUTINES.find(routine => routine.id === id) || DEFAULT_ROUTINES[0];
  return clone(found);
}

export function saveRoutineConfiguration(updatedRoutine) {
  const fallback = DEFAULT_ROUTINES.find(routine => routine.id === updatedRoutine?.id);
  if (!fallback) throw new Error("Rutina no válida.");

  const next = ROUTINES.map(routine =>
    routine.id === fallback.id
      ? sanitizeRoutine(updatedRoutine, fallback)
      : clone(routine)
  );

  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function resetRoutineToDefault(id) {
  const fallback = getDefaultRoutine(id);
  const next = ROUTINES.map(routine => routine.id === id ? fallback : clone(routine));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
