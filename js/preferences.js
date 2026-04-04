/**
 * preferences.js -- localStorage persistence for sender categorisations.
 *
 * Stores only sender-email-to-category mappings. Never stores tokens,
 * email content, subject lines, or metadata.
 */

const STORAGE_KEY = 'inbox-sort-tidy-prefs';

/**
 * Load saved preferences from localStorage.
 * @returns {Record<string, string>} email -> category
 */
export function loadPreferences() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

/**
 * Save preferences to localStorage.
 * @param {Record<string, string>} prefs
 */
export function savePreferences(prefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

/**
 * Clear all saved preferences.
 */
export function clearPreferences() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Apply saved preferences as overrides to classifier suggestions.
 * @param {object[]} senderGroups
 * @param {Record<string, string>} prefs
 */
export function applyPreferences(senderGroups, prefs) {
  for (const group of senderGroups) {
    if (prefs[group.senderEmail]) {
      group.assignedCategory = prefs[group.senderEmail];
    }
  }
}

/**
 * Save current user choices (where they differ from suggestions).
 * @param {object[]} senderGroups
 */
export function saveCurrentChoices(senderGroups) {
  const prefs = loadPreferences();
  for (const group of senderGroups) {
    if (group.assignedCategory && group.assignedCategory !== group.suggestedCategory) {
      prefs[group.senderEmail] = group.assignedCategory;
    }
  }
  savePreferences(prefs);
}
