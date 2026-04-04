/**
 * actions.js -- Execute the user-approved plan, with full undo support.
 *
 * Uses batchModify for efficiency (up to 1000 messages per call).
 * Only ever removes INBOX label or adds labels. Never deletes.
 *
 * Stores a manifest of every action taken so the entire operation
 * can be reversed with undoActions().
 */

import {
  batchArchive, batchAddLabel, ensureLabels,
  batchUnarchive, batchRemoveLabel,
} from './gmail.js';

// ── Action manifest (stored in memory for undo) ────────────────

let _lastManifest = null;

/**
 * Map a category to its effective action.
 */
function effectiveAction(group) {
  const cat = group.assignedCategory || group.suggestedCategory;
  if (cat === 'notifications' || cat === 'social' || cat === 'archive') return 'archive';
  if (cat === 'newsletters' || cat === 'receipts' || cat === 'fyi') return cat;
  return 'human';
}

/**
 * Execute archive/label operations for all sender groups.
 * Stores a manifest so everything can be undone.
 * @param {object[]} senderGroups
 * @param {{ newsletters: string, receipts: string, fyi: string }} labelNames -- custom label names
 * @param {(completed: number, total: number) => void} onProgress
 * @returns {Promise<object>} stats
 */
export async function executeActions(senderGroups, labelNames, onProgress) {
  // Phase 1: Ensure labels exist (using custom names)
  const names = labelNames || { newsletters: 'Newsletters', receipts: 'Receipts', fyi: 'FYI' };
  const labelMap = await ensureLabels([names.newsletters, names.receipts, names.fyi]);

  // Phase 2: Group message IDs by action
  const actions = { archive: [], newsletters: [], receipts: [], fyi: [] };
  let keptCount = 0;

  for (const group of senderGroups) {
    const action = effectiveAction(group);
    const ids = group.messages.map(m => m.id);

    if (action === 'archive') {
      actions.archive.push(...ids);
    } else if (action === 'newsletters') {
      actions.newsletters.push(...ids);
    } else if (action === 'receipts') {
      actions.receipts.push(...ids);
    } else if (action === 'fyi') {
      actions.fyi.push(...ids);
    } else {
      keptCount += ids.length;
    }
  }

  // Phase 3: Execute
  let completed = 0;
  const total = actions.archive.length + actions.newsletters.length +
                actions.receipts.length + actions.fyi.length;

  // Build manifest incrementally so partial failures can still be undone
  _lastManifest = { archived: [], labelled: [] };

  if (actions.archive.length) {
    await batchArchive(actions.archive);
    _lastManifest.archived = [...actions.archive];
    completed += actions.archive.length;
    if (onProgress) onProgress(completed, total);
  }

  const labelActions = [
    ['newsletters', names.newsletters],
    ['receipts', names.receipts],
    ['fyi', names.fyi],
  ];

  for (const [key, labelName] of labelActions) {
    if (actions[key].length) {
      await batchAddLabel(actions[key], labelMap[labelName]);
      _lastManifest.labelled.push({
        ids: [...actions[key]],
        labelId: labelMap[labelName],
        labelName,
      });
      completed += actions[key].length;
      if (onProgress) onProgress(completed, total);
    }
  }

  return {
    archived: actions.archive.length,
    newsletters: actions.newsletters.length,
    receipts: actions.receipts.length,
    fyi: actions.fyi.length,
    kept: keptCount,
  };
}

/**
 * Check if an undo is available.
 * @returns {boolean}
 */
export function canUndo() {
  return _lastManifest !== null;
}

/**
 * Undo the last executeActions() call.
 * Puts archived emails back in the inbox and removes added labels.
 * @param {(completed: number, total: number) => void} onProgress
 * @returns {Promise<object>} stats of what was undone
 */
export async function undoActions(onProgress) {
  if (!_lastManifest) throw new Error('Nothing to undo.');

  const manifest = _lastManifest;
  let completed = 0;
  let totalIds = manifest.archived.length;
  for (const group of manifest.labelled) {
    totalIds += group.ids.length;
  }

  // Undo archives: add INBOX label back
  if (manifest.archived.length) {
    await batchUnarchive(manifest.archived);
    completed += manifest.archived.length;
    if (onProgress) onProgress(completed, totalIds);
  }

  // Undo labels: remove the label and add INBOX back
  for (const group of manifest.labelled) {
    await batchRemoveLabel(group.ids, group.labelId);
    completed += group.ids.length;
    if (onProgress) onProgress(completed, totalIds);
  }

  const stats = {
    restored: manifest.archived.length,
    unlabelled: manifest.labelled.reduce((sum, g) => sum + g.ids.length, 0),
  };

  // Clear manifest -- can only undo once
  _lastManifest = null;

  return stats;
}

/**
 * Clear the undo manifest (e.g. on disconnect).
 */
export function clearUndoManifest() {
  _lastManifest = null;
}
