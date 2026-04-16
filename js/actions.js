/**
 * actions.js -- Execute the user-approved plan, with full undo support.
 *
 * Handles four action types:
 *   - archive:       remove INBOX label
 *   - label_archive: add label + remove INBOX label
 *   - label_keep:    add label only (email stays in inbox)
 *   - keep:          no API call
 *
 * Stores a manifest of every action taken so the entire operation
 * can be reversed with undoActions().
 */

import {
  batchArchive, batchAddLabel, batchLabelKeep, ensureLabels,
  batchUnarchive, batchRemoveLabel,
} from './gmail.js';
import { getActionForCategory } from './classifier.js';

// ── Action manifest (stored in memory for undo) ────────────────

let _lastManifest = null;

/**
 * Resolve the effective action for a sender group.
 * Uses assignedCategory override if present, otherwise suggestedCategory.
 */
function resolveAction(group) {
  const cat = group.assignedCategory || group.suggestedCategory;
  const mapping = getActionForCategory(cat);
  // For label_archive/label_keep, determine the label name
  let labelName = null;
  if (mapping.action === 'label_archive' || mapping.action === 'label_keep') {
    labelName = group.sublabel || mapping.labelName;
  }
  return { action: mapping.action, labelName, category: cat };
}

/**
 * Execute archive/label operations for all sender groups.
 * Stores a manifest so everything can be undone.
 * @param {object[]} senderGroups
 * @param {Record<string, string>} labelOverrides -- custom label name overrides keyed by default label name
 * @param {(completed: number, total: number) => void} onProgress
 * @returns {Promise<object>} results
 */
export async function executeActions(senderGroups, labelOverrides, onProgress) {
  const overrides = labelOverrides || {};

  // Phase 1: Collect all label names needed
  const labelNamesNeeded = new Set();
  const groupActions = [];

  for (const group of senderGroups) {
    const resolved = resolveAction(group);
    if (resolved.labelName) {
      // Apply user overrides (e.g. user renamed "Newsletters" to "News")
      const finalLabel = overrides[resolved.labelName] || resolved.labelName;
      resolved.labelName = finalLabel;
      labelNamesNeeded.add(finalLabel);
    }
    groupActions.push({ group, ...resolved });
  }

  // Phase 2: Ensure all labels exist (case-insensitive matching)
  const labelMap = labelNamesNeeded.size > 0
    ? await ensureLabels([...labelNamesNeeded])
    : {};

  // Phase 3: Bucket message IDs by action
  const buckets = {
    archive: [],        // IDs to archive (remove INBOX)
    label_archive: [],  // { ids, labelName, labelId } pairs
    label_keep: [],     // { ids, labelName, labelId } pairs
  };
  let keptCount = 0;
  const breakdown = {};

  for (const { group, action, labelName, category } of groupActions) {
    const ids = group.messages.map(m => m.id);
    const storageBytes = group.messages.reduce((sum, m) => sum + (m.sizeEstimate || 0), 0);

    if (!breakdown[category]) {
      breakdown[category] = { count: 0, action, storage: 0 };
    }
    breakdown[category].count += ids.length;
    breakdown[category].storage += storageBytes;

    if (action === 'archive') {
      buckets.archive.push(...ids);
    } else if (action === 'label_archive' && labelName) {
      buckets.label_archive.push({ ids, labelName, labelId: labelMap[labelName] });
    } else if (action === 'label_keep' && labelName) {
      buckets.label_keep.push({ ids, labelName, labelId: labelMap[labelName] });
    } else {
      keptCount += ids.length;
    }
  }

  // Phase 4: Execute
  let completed = 0;
  const totalActionable = buckets.archive.length +
    buckets.label_archive.reduce((s, b) => s + b.ids.length, 0) +
    buckets.label_keep.reduce((s, b) => s + b.ids.length, 0);

  _lastManifest = { archived: [], labelled: [], labelledKeep: [] };

  // Archive
  if (buckets.archive.length) {
    await batchArchive(buckets.archive);
    _lastManifest.archived = [...buckets.archive];
    completed += buckets.archive.length;
    if (onProgress) onProgress(completed, totalActionable);
  }

  // Label + archive
  for (const { ids, labelName, labelId } of buckets.label_archive) {
    await batchAddLabel(ids, labelId);
    _lastManifest.labelled.push({ ids: [...ids], labelId, labelName });
    completed += ids.length;
    if (onProgress) onProgress(completed, totalActionable);
  }

  // Label + keep in inbox
  for (const { ids, labelName, labelId } of buckets.label_keep) {
    await batchLabelKeep(ids, labelId);
    _lastManifest.labelledKeep.push({ ids: [...ids], labelId, labelName });
    completed += ids.length;
    if (onProgress) onProgress(completed, totalActionable);
  }

  // Calculate totals
  const totalScanned = senderGroups.reduce((s, g) => s + g.messages.length, 0);
  const archivedCount = buckets.archive.length +
    buckets.label_archive.reduce((s, b) => s + b.ids.length, 0);
  const remaining = totalScanned - archivedCount;
  const storageFreed = Object.values(breakdown)
    .filter(b => b.action === 'archive' || b.action === 'label_archive')
    .reduce((s, b) => s + b.storage, 0);

  return {
    totalScanned,
    totalActioned: totalActionable,
    remaining,
    storageFreed,
    breakdown,
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
  for (const group of manifest.labelled) totalIds += group.ids.length;
  for (const group of manifest.labelledKeep) totalIds += group.ids.length;

  // Undo archives: add INBOX label back
  if (manifest.archived.length) {
    await batchUnarchive(manifest.archived);
    completed += manifest.archived.length;
    if (onProgress) onProgress(completed, totalIds);
  }

  // Undo label+archive: remove label and add INBOX back
  for (const group of manifest.labelled) {
    await batchRemoveLabel(group.ids, group.labelId);
    completed += group.ids.length;
    if (onProgress) onProgress(completed, totalIds);
  }

  // Undo label+keep: just remove the label (they were already in inbox)
  for (const group of manifest.labelledKeep) {
    // batchRemoveLabel also adds INBOX back, which is fine (already there)
    await batchRemoveLabel(group.ids, group.labelId);
    completed += group.ids.length;
    if (onProgress) onProgress(completed, totalIds);
  }

  const stats = {
    restored: manifest.archived.length,
    unlabelled: manifest.labelled.reduce((sum, g) => sum + g.ids.length, 0) +
                manifest.labelledKeep.reduce((sum, g) => sum + g.ids.length, 0),
  };

  _lastManifest = null;
  return stats;
}

/**
 * Clear the undo manifest (e.g. on disconnect).
 */
export function clearUndoManifest() {
  _lastManifest = null;
}
