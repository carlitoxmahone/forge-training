# Changelog

## 0.8.0 — Editor de rutinas

- Cada día tiene ahora un botón Editar dentro de Rutinas.
- Se puede cambiar el nombre del día y su prioridad/subtítulo.
- Se pueden modificar series efectivas, calentamientos y rangos de repeticiones.
- Se puede marcar un ejercicio como trabajo al fallo.
- Se puede cambiar el orden de los ejercicios con controles subir/bajar.
- Se pueden eliminar ejercicios y añadir ejercicios nuevos.
- Los nombres de ejercicios existentes se protegen para conservar correctamente su historial.
- Las rutinas personalizadas se guardan en el navegador y se incluyen en las copias de seguridad.
- Cada día puede restaurarse individualmente a la rutina original sin borrar el historial.
- Editar un día no borra una sesión activa perteneciente a otro día.

## 0.7.0 — Resumen final + PRs

- Al finalizar un entrenamiento aparece un resumen completo de la sesión.
- El resumen muestra duración, series efectivas, volumen y ejercicios registrados.
- Se compara el volumen con la última sesión del mismo día cuando existe referencia previa.
- FORGE detecta PRs comparando con el historial anterior, no con la sesión recién guardada.
- Se detecta mejor rendimiento estimado, nueva carga máxima y récord de repeticiones con la misma carga.
- La primera sesión de un ejercicio se guarda como referencia inicial y no se etiqueta falsamente como PR.
- Añadido acceso directo a Progreso desde el resumen final.

## 0.6.0 — Historial por ejercicio

- El nombre de cada ejercicio abre ahora su historial detallado.
- El historial muestra las últimas sesiones con peso, repeticiones y RIR.
- Añadidas métricas de número de sesiones, mejor serie, volumen acumulado y tendencia.
- Añadido gráfico compacto de rendimiento por sesión.
- El historial queda preparado como base para que el COACH use contexto de varias sesiones.

## 0.5.0 — Flujo de sesión activa

- FORGE abre siempre en la pestaña Hoy.
- Si hay una sesión en curso, Hoy muestra claramente Reanudar entrenamiento.
- Añadido botón Descartar sesión sin borrar el historial guardado.
- El estado de sesión activa se diferencia de una sesión nueva preparada para empezar.

## 0.4.1 — Flujo de series

- Corregido el objetivo absurdo tipo “12-12 reps” en la recomendación de la siguiente serie.
- Si una serie efectiva queda justo en el mínimo del rango, el COACH propone mantenerlo o sumar una repetición.
- Al completar una serie efectiva, FORGE copia automáticamente la carga a la siguiente serie si todavía estaba vacía.
- Los campos pendientes heredados como 0 de prototipos anteriores vuelven a mostrarse vacíos.

## 0.4.0 — Coach adaptativo

- El COACH separa su respuesta en Lectura, Siguiente serie y Próxima sesión.
- La recomendación de la siguiente serie usa rango de repeticiones, RIR y carga actual.
- La decisión de próxima sesión diferencia entre mantener carga, consolidar repeticiones y subir con el incremento mínimo disponible.
- El COACH compara con la sesión anterior cuando se repite la misma carga.
- La progresión no se confirma antes de completar las series efectivas del ejercicio.

## 0.3.0 — Descanso integrado

- El temporizador de descanso ya no bloquea toda la pantalla.
- El descanso aparece como una tarjeta compacta encima de la navegación inferior.
- Puedes seguir viendo el ejercicio, el COACH y preparar la siguiente serie mientras cuenta.
- Se mantienen los controles −15 s, Cerrar y +15 s.

## 0.2.0 — Entrada de series móvil

- Eliminado el scroll horizontal de la tabla durante el entrenamiento.
- Cada serie se presenta como una fila móvil con Anterior y Objetivo visibles.
- Campos kg, reps y RIR más grandes y cómodos para iPhone.
- Botón de completar serie ampliado para uso con el pulgar.
- Las series de calentamiento se distinguen visualmente y no piden RIR.

## 0.1.0 — Base estable

- Arquitectura modular.
- Rutina completa de 5 días.
- Ejercicios verticales.
- Autoguardado y recuperación de sesión.
- Migración de historial de prototipos anteriores.
- Coach por rango/RIR/progresión.
- Temporizador opcional.
- Historial y progreso.
- PWA sin interferir con el desarrollo local.
- Proyecto preparado para Git y GitHub Pages.
