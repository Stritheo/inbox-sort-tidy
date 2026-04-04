/**
 * actions.js -- Execute the user-approved plan.
 *
 * Uses batchModify for efficiency (up to 1000 messages per call).
 * Only ever removes INBOX label or adds labels. Never deletes.
 */

import { batchArchive, batchAddLabel, ensureLabels } from './gmail.js';

/**
 * Map a category to its effective action.
 */
function effectiveAction(group) {
  const cat = group.assignedCategory || group.suggestedCategory;
  if (cat === 'notifications' || cat === 'social' || cat === 'archive') return 'archive';
  if (cat === 'newsletters' || cat === 'receipts' || cat === 'fyi') return cat;
  return 'human'; // keep in inbox
}

/**
 * Execute archive/label operations for all sender groups.
 * @param {object[]} senderGroups
 * @param {(completed: number, total: number) => void} onProgress
 * @returns {Promise<object>} stats
 */
export async function executeActions(senderGroups, onProgress) {
  // Phase 1: Ensure labels exist
  const labelMap = await ensureLabels(['Newsletters', 'Receipts', 'FYI']);

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

  if (actions.archive.length) {
    await batchArchive(actions.archive);
    completed += actions.archive.length;
    if (onProgress) onProgress(completed, total);
  }

  const labelActions = [
    ['newsletters', 'Newsletters'],
    ['receipts', 'Receipts'],
    ['fyi', 'FYI'],
  ];

  for (const [key, labelName] of labelActions) {
    if (actions[key].length) {
      await batchAddLabel(actions[key], labelMap[labelName]);
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
