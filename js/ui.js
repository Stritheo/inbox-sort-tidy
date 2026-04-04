/**
 * ui.js -- XSS-safe DOM rendering.
 *
 * CRITICAL: All email-derived content rendered via textContent only.
 * Never use innerHTML with any data from email headers.
 */

// ── Category options ───────────────────────────────────────────

const CATEGORY_OPTIONS = [
  { value: 'human', label: 'Keep in Inbox' },
  { value: 'archive', label: 'Archive All' },
  { value: 'newsletters', label: 'Label: Newsletters' },
  { value: 'receipts', label: 'Label: Receipts' },
  { value: 'fyi', label: 'Label: FYI' },
];

/**
 * Map classifier categories to the UI dropdown value.
 * 'notifications' and 'social' both map to 'archive'.
 */
function effectiveCategory(group) {
  const cat = group.assignedCategory || group.suggestedCategory;
  if (cat === 'notifications' || cat === 'social') return 'archive';
  return cat;
}

// ── Sender table ───────────────────────────────────────────────

/**
 * Render the sender frequency table with category dropdowns.
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
    senderCell.textContent = group.senderName || group.senderEmail;
    senderCell.title = group.senderEmail; // tooltip shows full email

    const categoryCell = document.createElement('td');
    categoryCell.appendChild(createCategorySelect(group));

    row.append(countCell, senderCell, categoryCell);
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

/**
 * Create a <select> for a sender group's category.
 * @param {object} group
 * @returns {HTMLSelectElement}
 */
function createCategorySelect(group) {
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
  });

  return select;
}

// ── Progress ───────────────────────────────────────────────────

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

// ── Preview summary ────────────────────────────────────────────

/**
 * Calculate and render the dry-run preview.
 * @param {object[]} senderGroups
 * @param {HTMLElement} container
 * @returns {object} counts by action
 */
export function renderPreview(senderGroups, container) {
  const counts = { archive: 0, newsletters: 0, receipts: 0, fyi: 0, keep: 0 };

  for (const group of senderGroups) {
    const cat = effectiveCategory(group);
    const n = group.messages.length;
    if (cat === 'archive') counts.archive += n;
    else if (cat === 'newsletters') counts.newsletters += n;
    else if (cat === 'receipts') counts.receipts += n;
    else if (cat === 'fyi') counts.fyi += n;
    else counts.keep += n;
  }

  container.replaceChildren();

  // Total as headline
  const total = counts.archive + counts.newsletters + counts.receipts + counts.fyi + counts.keep;
  const headline = document.createElement('p');
  headline.classList.add('preview-headline');
  headline.textContent = `${total.toLocaleString()} emails`;
  container.appendChild(headline);

  // Plan as a clean list
  const list = document.createElement('ul');
  list.classList.add('preview-plan');

  const items = [
    { count: counts.archive, text: 'archived' },
    { count: counts.newsletters, text: 'labelled Newsletters' },
    { count: counts.receipts, text: 'labelled Receipts' },
    { count: counts.fyi, text: 'labelled FYI' },
    { count: counts.keep, text: 'staying in your inbox' },
  ];

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

// ── Done results ───────────────────────────────────────────────

/**
 * Render the final results summary.
 * @param {object} stats -- { archived, newsletters, receipts, fyi, kept }
 * @param {HTMLElement} container
 */
export function renderResults(stats, container) {
  container.replaceChildren();

  const lines = [];
  if (stats.archived > 0) lines.push(`Archived ${stats.archived} emails.`);
  if (stats.newsletters > 0) lines.push(`Labelled ${stats.newsletters} as Newsletters.`);
  if (stats.receipts > 0) lines.push(`Labelled ${stats.receipts} as Receipts.`);
  if (stats.fyi > 0) lines.push(`Labelled ${stats.fyi} as FYI.`);
  if (stats.kept > 0) lines.push(`Kept ${stats.kept} in Inbox.`);

  for (const line of lines) {
    const p = document.createElement('p');
    p.textContent = line;
    container.appendChild(p);
  }
}
