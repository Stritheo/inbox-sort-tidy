/**
 * preferences.js -- localStorage persistence for sender categorisations.
 *
 * Stores only sender-email-to-category mappings. Never stores tokens,
 * email content, subject lines, or metadata.
 *
 * Valid category values:
 *   job_alerts, kids_activities, receipts, newsletters,
 *   retail_promos, social, notifications, human
 */

const STORAGE_KEY = 'inbox-sort-tidy-prefs';

/**
 * Migrate old v1 category names to v2.
 */
const MIGRATION_MAP = {
  archive: 'retail_promos',
  fyi: 'newsletters',
};

/**
 * Valid v2 category values.
 */
const VALID_CATEGORIES = new Set([
  'job_alerts', 'kids_activities', 'receipts', 'newsletters',
  'retail_promos', 'social', 'notifications', 'human',
]);

/**
 * Load saved preferences from localStorage.
 * Migrates old v1 category names automatically.
 * @returns {Record<string, string>} email -> category
 */
export function loadPreferences() {
  let prefs;
  try {
    prefs = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }

  // Migrate old category values
  let migrated = false;
  for (const [email, category] of Object.entries(prefs)) {
    if (MIGRATION_MAP[category]) {
      prefs[email] = MIGRATION_MAP[category];
      migrated = true;
    } else if (!VALID_CATEGORIES.has(category)) {
      // Remove invalid categories
      delete prefs[email];
      migrated = true;
    }
  }

  if (migrated) {
    savePreferences(prefs);
  }

  return prefs;
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
    if (prefs[group.senderEmail] && VALID_CATEGORIES.has(prefs[group.senderEmail])) {
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
