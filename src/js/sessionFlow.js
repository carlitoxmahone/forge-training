import { clearDraft } from "./core/storage.js";
import "./exerciseHistory.js";
import "./workoutSummary.js";
import "./routineEditor.js";

function forceTodayOnOpen() {
  document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.add("hidden"));
  document.querySelector("#tab-today")?.classList.remove("hidden");

  document.querySelectorAll(".bottom-nav button").forEach(button => {
    button.classList.toggle("active", button.dataset.tab === "today");
  });
}

function ensureCoachHistoryStyles() {
  if (document.querySelector('link[data-forge-coach-history]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./src/css/coach-history.css";
  link.dataset.forgeCoachHistory = "true";
  document.head.appendChild(link);
}

function setVersionBadge() {
  const badge = document.querySelector(".version-badge");
  if (badge) badge.textContent = "0.9";
}

function cleanLegacyZeroInputs() {
  document
    .querySelectorAll('[data-action="edit-set"][data-field="weight"]')
    .forEach(input => {
      const row = input.closest(".set-row");
      if (row?.classList.contains("done")) return;
      if (input.value !== "0") return;

      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
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

ensureCoachHistoryStyles();

document.addEventListener("DOMContentLoaded", () => {
  setVersionBadge();
  forceTodayOnOpen();
  cleanLegacyZeroInputs();
  bindDiscardWorkout();
});
