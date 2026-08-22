# FORGE

Base estable de la aplicación web de entrenamiento.

## Qué incluye

- Los 5 días de la rutina de Carlos.
- Todos los ejercicios del día seguidos verticalmente.
- Series de calentamiento diferenciadas de las series efectivas.
- Peso, repeticiones y RIR.
- Comparación con la sesión anterior.
- Coach según rango de repeticiones, RIR y progresión.
- Autoguardado de la sesión activa.
- Recuperación de la sesión después de recargar/cerrar.
- Temporizador de descanso opcional.
- Historial, volumen y tendencia.
- Exportar/importar copias JSON.
- Modo oscuro/claro.
- PWA al publicarla.
- Migración automática de datos de prototipos FORGE anteriores.

## Desarrollo local

Abre esta carpeta en VS Code y pulsa **Go Live**.

Durante Live Server, FORGE desactiva el Service Worker y limpia la caché FORGE para evitar que aparezca código viejo después de un cambio.

## Arquitectura

- `src/js/data/routines.js`: rutina. Cambiar ejercicios/rangos aquí.
- `src/js/core/coach.js`: lógica del coach.
- `src/js/core/workout.js`: cálculos y estado de entrenamiento.
- `src/js/core/storage.js`: historial, autoguardado y copias.
- `src/js/views/workoutView.js`: pantalla de entrenamiento.
- `src/css/app.css`: diseño general.
- `src/js/app.js`: coordinación de la aplicación.

Esto permite cambiar una parte sin reemplazar todo el proyecto.
