import { clearDraft } from "./core/storage.js";

function forceTodayOnOpen() {
  document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.add("hidden"));
  document.querySelector("#tab-today")?.classList.remove("hidden");

  document.querySelectorAll(".bottom-nav button").forEach(button => {
    button.classList.toggle("active", button.dataset.tab === "today");
  });
}

function bindDiscardWorkout() {
  const button = document.querySelector("#discardWorkoutBtn");
  if (!button) return;

  button.addEventListener("click", () => {
    const confirmed = confirm(
      "¿Descartar la sesión actual? El historial de entrenamientos guardados no se borrará."
    );

    if (!confirmed) return;

    clearDraft();
    location.reload();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  forceTodayOnOpen();
  bindDiscardWorkout();
});
