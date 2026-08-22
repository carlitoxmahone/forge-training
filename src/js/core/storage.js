const KEYS = {
  db: "forge.db.v1",
  settings: "forge.settings.v1",
  draft: "forge.draft.v1",
  routine: "forge.activeRoutine.v1",
  migrated: "forge.migrated.v1"
};

const LEGACY_DB_KEYS = [
  "forgeCarlosWorkoutsV2",
  "forgeCarlosWorkoutsV1",
  "forgeTrainingV2",
  "forgeTrainingV1"
];

const LEGACY_SETTINGS_KEYS = [
  "forgeCarlosSettingsV2",
  "forgeCarlosSettingsV1",
  "forgeTrainingSettingsV2",
  "forgeTrainingSettingsV1"
];

function readJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function migrateLegacyData() {
  if (localStorage.getItem(KEYS.migrated)) return;

  const current = readJSON(KEYS.db, null);
  if (!current?.workouts?.length) {
    for (const key of LEGACY_DB_KEYS) {
      const legacy = readJSON(key, null);
      if (legacy?.workouts?.length) {
        writeJSON(KEYS.db, { workouts: legacy.workouts });
        break;
      }
    }
  }

  const currentSettings = readJSON(KEYS.settings, null);
  if (!currentSettings) {
    for (const key of LEGACY_SETTINGS_KEYS) {
      const legacy = readJSON(key, null);
      if (legacy) {
        writeJSON(KEYS.settings, {
          rest: Number(legacy.rest ?? 180),
          theme: legacy.theme === "light" ? "light" : "dark"
        });
        break;
      }
    }
  }

  localStorage.setItem(KEYS.migrated, new Date().toISOString());
}

export function loadDB() {
  return readJSON(KEYS.db, { workouts: [] });
}

export function saveDB(db) {
  writeJSON(KEYS.db, db);
}

export function loadSettings() {
  return {
    rest: 180,
    theme: "dark",
    ...readJSON(KEYS.settings, {})
  };
}

export function saveSettings(settings) {
  writeJSON(KEYS.settings, settings);
}

export function loadDraft() {
  return readJSON(KEYS.draft, null);
}

export function saveDraft(draft) {
  writeJSON(KEYS.draft, draft);
}

export function clearDraft() {
  localStorage.removeItem(KEYS.draft);
}

export function loadActiveRoutineId() {
  return localStorage.getItem(KEYS.routine) || "dia1";
}

export function saveActiveRoutineId(id) {
  localStorage.setItem(KEYS.routine, id);
}

export function resetForgeData() {
  localStorage.removeItem(KEYS.db);
  localStorage.removeItem(KEYS.draft);
  localStorage.removeItem(KEYS.settings);
  localStorage.removeItem(KEYS.routine);
}

export function makeBackup() {
  return {
    forgeBackupVersion: 1,
    exportedAt: new Date().toISOString(),
    db: loadDB(),
    settings: loadSettings(),
    activeRoutineId: loadActiveRoutineId()
  };
}

export function restoreBackup(payload) {
  if (!payload?.db?.workouts || !Array.isArray(payload.db.workouts)) {
    throw new Error("Copia de seguridad no válida.");
  }
  saveDB(payload.db);
  if (payload.settings) saveSettings(payload.settings);
  if (payload.activeRoutineId) saveActiveRoutineId(payload.activeRoutineId);
}
