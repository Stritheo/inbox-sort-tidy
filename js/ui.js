/**
 * ui.js -- XSS-safe DOM rendering.
 *
 * CRITICAL: All email-derived content rendered via textContent only.
 * Never use innerHTML with any data from email headers.
 */

import { getActionForCategory } from './classifier.js';

// ── Category options for dropdown ─────────────────────────────

const CATEGORY_OPTIONS = [
  { value: 'human',           label: 'Keep in Inbox' },
  { value: 'job_alerts',      label: 'Label: Job Alerts' },
  { value: 'kids_activities', label: 'Label: Kids & Activities (keep visible)' },
  { value: 'receipts',        label: 'Label: Receipts' },
  { value: 'newsletters',     label: 'Label: Newsletters' },
  { value: 'retail_promos',   label: 'Archive' },
  { value: 'social',          label: 'Archive' },
  { value: 'notifications',   label: 'Archive' },
];

/**
 * Short display labels for category tags in the sender table.
 */
const CATEGORY_TAGS = {
  job_alerts:      'Job Alerts',
  kids_activities: 'Kids',
  receipts:        'Receipts',
  newsletters:     'Newsletters',
  retail_promos:   'Retail',
  social:          'Social',
  notifications:   'Notifications',
  human:           'Human',
};

/**
 * Descriptions for the results breakdown screen.
 */
const CATEGORY_RESULT_TEXT = {
  job_alerts:      { verb: 'labelled and archived', noun: 'job alerts' },
  kids_activities: { verb: 'labelled', noun: 'kids and activities emails' },
  receipts:        { verb: 'labelled and archived', noun: 'receipts' },
  newsletters:     { verb: 'labelled and archived', noun: 'newsletters' },
  retail_promos:   { verb: 'archived', noun: 'retail promotions' },
  social:          { verb: 'archived', noun: 'social notifications' },
  notifications:   { verb: 'archived', noun: 'platform notifications' },
  human:           { verb: 'kept in inbox', noun: 'emails' },
};

// ── Effective category ────────────────────────────────────────

function effectiveCategory(group) {
  return group.assignedCategory || group.suggestedCategory;
}

// ── Sender table ──────────────────────────────────────────────

/**
 * Render the sender frequency table with category dropdowns and colour tags.
 * @param {object[]} senderGroups
 * @param {HTMLElement} container
 */
export function renderSenderTable(senderGroups, container) {
  container.replaceChildren();

  const table = document.createElement('table');
  table.classList.add('sender-table');

  // Header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  for (const label of ['Emails', 'Sender', 'Category']) {
    const th = document.createElement('th');
    th.textContent = label;
    th.setAttribute('scope', 'col');
    if (label === 'Emails') th.style.textAlign = 'right';
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body
  const tbody = document.createElement('tbody');
  for (const group of senderGroups) {
    const row = document.createElement('tr');

    const countCell = document.createElement('td');
    countCell.textContent = group.messages.length;

    const senderCell = document.createElement('td');
    // Sender name with category tag
    const senderText = document.createElement('span');
    senderText.textContent = group.senderName || group.senderEmail;
    senderCell.appendChild(senderText);
    senderCell.title = group.senderEmail;

    // Category colour tag
    const cat = effectiveCategory(group);
    const tag = document.createElement('span');
    tag.classList.add('cat-tag', `cat-tag--${cat}`);
    tag.textContent = CATEGORY_TAGS[cat] || cat;
    senderCell.appendChild(tag);

    const categoryCell = document.createElement('td');
    categoryCell.appendChild(createCategorySelect(group, tag));

    row.append(countCell, senderCell, categoryCell);
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

/**
 * Create a <select> for a sender group's category.
 * @param {object} group
 * @param {HTMLElement} tag -- the category tag element to update on change
 * @returns {HTMLSelectElement}
 */
function createCategorySelect(group, tag) {
  const select = document.createElement('select');
  select.setAttribute('aria-label', `Category for ${group.senderEmail}`);

  const current = effectiveCategory(group);

  for (const opt of CATEGORY_OPTIONS) {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    if (opt.value === current) option.selected = true;
    select.appendChild(option);
  }

  select.addEventListener('change', () => {
    group.assignedCategory = select.value;
    // Update the tag
    tag.className = `cat-tag cat-tag--${select.value}`;
    tag.textContent = CATEGORY_TAGS[select.value] || select.value;
  });

  return select;
}

// ── Progress ──────────────────────────────────────────────────

/**
 * Update a progress bar and its label.
 * @param {number} current
 * @param {number} total
 * @param {string} message
 * @param {HTMLProgressElement} progressEl
 * @param {HTMLElement} labelEl
 */
export function renderProgress(current, total, message, progressEl, labelEl) {
  if (total > 0) {
    progressEl.max = total;
    progressEl.value = current;
  } else {
    progressEl.removeAttribute('value'); // indeterminate
  }
  labelEl.textContent = message;
}

// ── Preview summary ───────────────────────────────────────────

/**
 * Calculate and render the dry-run preview.
 * @param {object[]} senderGroups
 * @param {HTMLElement} container
 * @returns {object} counts by action type
 */
export function renderPreview(senderGroups, container) {
  const counts = {
    archive: 0, label_archive: 0, label_keep: 0, keep: 0,
  };
  const labelCounts = {};

  for (const group of senderGroups) {
    const cat = effectiveCategory(group);
    const mapping = getActionForCategory(cat);
    const n = group.messages.length;

    if (mapping.action === 'archive') counts.archive += n;
    else if (mapping.action === 'label_archive') {
      counts.label_archive += n;
      const lbl = group.sublabel || mapping.labelName;
      labelCounts[lbl] = (labelCounts[lbl] || 0) + n;
    }
    else if (mapping.action === 'label_keep') {
      counts.label_keep += n;
      const lbl = mapping.labelName;
      labelCounts[lbl] = (labelCounts[lbl] || 0) + n;
    }
    else counts.keep += n;
  }

  container.replaceChildren();

  const total = counts.archive + counts.label_archive + counts.label_keep + counts.keep;
  const headline = document.createElement('p');
  headline.classList.add('preview-headline');
  headline.textContent = `${total.toLocaleString()} emails`;
  container.appendChild(headline);

  const list = document.createElement('ul');
  list.classList.add('preview-plan');

  const items = [
    { count: counts.archive, text: 'archived' },
  ];

  // Add per-label items
  for (const [label, count] of Object.entries(labelCounts)) {
    items.push({ count, text: `labelled ${label}` });
  }

  items.push({ count: counts.keep + counts.label_keep, text: 'staying in your inbox' });

  for (const item of items) {
    if (item.count === 0) continue;
    const li = document.createElement('li');
    const num = document.createElement('strong');
    num.textContent = item.count;
    li.appendChild(num);
    li.appendChild(document.createTextNode(` ${item.text}`));
    list.appendChild(li);
  }

  container.appendChild(list);
  return counts;
}

// ── Before/After Results ──────────────────────────────────────

/**
 * Animate a number counting down from `from` to `to`.
 * @param {HTMLElement} element
 * @param {number} from
 * @param {number} to
 * @param {number} duration -- milliseconds
 */
function animateCount(element, from, to, duration) {
  const start = performance.now();
  const diff = from - to;

  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(from - (diff * eased));
    element.textContent = current.toLocaleString();
    if (progress < 1) requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}

/**
 * Format bytes into a human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Render the before/after results screen.
 * @param {object} results -- from executeActions()
 * @param {object} containers -- { before, after, breakdown, storage }
 */
export function renderBeforeAfter(results, containers) {
  // Before count
  const beforeEl = containers.before;
  if (beforeEl) {
    beforeEl.textContent = results.totalScanned.toLocaleString();
  }

  // After count with animation
  const afterEl = containers.after;
  if (afterEl) {
    // Reduced motion check
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      afterEl.textContent = results.remaining.toLocaleString();
    } else {
      animateCount(afterEl, results.totalScanned, results.remaining, 1500);
    }
  }

  // Breakdown list
  const breakdownEl = containers.breakdown;
  if (breakdownEl) {
    breakdownEl.replaceChildren();
    const list = document.createElement('ul');
    list.classList.add('results-breakdown-list');

    for (const [category, data] of Object.entries(results.breakdown)) {
      if (data.count === 0) continue;
      const meta = CATEGORY_RESULT_TEXT[category];
      if (!meta) continue;

      const li = document.createElement('li');
      li.classList.add(`cat-result--${category}`);
      const num = document.createElement('strong');
      num.textContent = data.count.toLocaleString();
      li.appendChild(num);
      li.appendChild(document.createTextNode(` ${meta.noun} ${meta.verb}`));
      list.appendChild(li);
    }

    breakdownEl.appendChild(list);
  }

  // Storage freed
  const storageEl = containers.storage;
  if (storageEl) {
    if (results.storageFreed > 0) {
      storageEl.textContent = `Approximately ${formatBytes(results.storageFreed)} freed`;
      storageEl.hidden = false;
    } else {
      storageEl.hidden = true;
    }
  }
}

// ── Legacy renderResults (simple text fallback) ───────────────

/**
 * Render a simple text results summary (used when before/after containers
 * are not available, e.g. empty inbox).
 * @param {object} stats
 * @param {HTMLElement} container
 */
export function renderResults(stats, container) {
  container.replaceChildren();

  if (stats.totalScanned !== undefined) {
    // New v2 results format
    const p = document.createElement('p');
    p.textContent = `Processed ${stats.totalScanned} emails. ${stats.remaining} remain in your inbox.`;
    container.appendChild(p);
    return;
  }

  // Fallback for simple stats
  const lines = [];
  if (stats.archived > 0) lines.push(`Archived ${stats.archived} emails.`);
  if (stats.kept > 0) lines.push(`Kept ${stats.kept} in Inbox.`);

  for (const line of lines) {
    const p = document.createElement('p');
    p.textContent = line;
    container.appendChild(p);
  }
}
