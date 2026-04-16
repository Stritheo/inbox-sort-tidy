/**
 * app.js -- Entry point. State machine, view toggling, event wiring.
 *
 * Scan modes:
 *   - Wave (default): scan 2,000 at a time, tidy, then "Scan more"
 *   - Full: scan entire inbox in one go (user opts in for large inboxes)
 */

import { initAuth, requestAuth, revokeAuth, isAuthenticated } from './auth.js';
import { getProfile, AuthExpiredError } from './gmail.js';
import { countInbox, scanNextWave, scanFullInbox, getScanProgress, estimateScanTime, resetScanState } from './scanner.js';
import { classifyMessages } from './classifier.js';
import { renderSenderTable, renderProgress, renderPreview, renderBeforeAfter, renderResults } from './ui.js';
import { loadPreferences, applyPreferences, saveCurrentChoices } from './preferences.js';
import { executeActions, undoActions, canUndo, clearUndoManifest } from './actions.js';

// ── Configuration ──────────────────────────────────────────────

const CLIENT_ID = '607048348334-46cg0kuq362s3opbe1sq47pssfiqccqq.apps.googleusercontent.com';

// ── DOM references ─────────────────────────────────────────────

const views = {
  connect: document.getElementById('view-connect'),
  scanning: document.getElementById('view-scanning'),
  results: document.getElementById('view-results'),
  preview: document.getElementById('view-preview'),
  executing: document.getElementById('view-executing'),
  done: document.getElementById('view-done'),
};

const els = {
  btnConnect: document.getElementById('btn-connect'),
  btnDisconnect: document.getElementById('btn-disconnect'),
  btnPreview: document.getElementById('btn-preview'),
  btnExecute: document.getElementById('btn-execute'),
  btnBack: document.getElementById('btn-back'),
  btnScanAgain: document.getElementById('btn-scan-again'),
  btnDoneDisconnect: document.getElementById('btn-done-disconnect'),
  btnUndo: document.getElementById('btn-undo'),
  undoSection: document.querySelector('.undo-section'),
  connectError: document.getElementById('connect-error'),
  connectedEmail: document.getElementById('connected-email'),
  connectedBanner: document.getElementById('connected-banner'),
  scanProgress: document.getElementById('scan-progress'),
  scanStatus: document.getElementById('scan-status'),
  senderTableContainer: document.getElementById('sender-table-container'),
  previewSummary: document.getElementById('preview-summary'),
  execProgress: document.getElementById('exec-progress'),
  execStatus: document.getElementById('exec-status'),
  doneResults: document.getElementById('done-results'),
  scanMoreContainer: document.getElementById('scan-more-container'),
  labelNewsletters: document.getElementById('label-newsletters'),
  labelReceipts: document.getElementById('label-receipts'),
  labelFyi: document.getElementById('label-fyi'),
  labelJobAlerts: document.getElementById('label-job-alerts'),
  labelKidsActivities: document.getElementById('label-kids-activities'),
  previewLabelHint: document.getElementById('preview-label-hint'),
  countBefore: document.getElementById('count-before'),
  countAfter: document.getElementById('count-after'),
  resultsBreakdown: document.getElementById('results-breakdown'),
  resultsStorage: document.getElementById('results-storage'),
};

// ── State ──────────────────────────────────────────────────────

let senderGroups = [];
let allMessages = [];
let _isScanning = false;
let _scanController = null;

/**
 * Read custom label names from the config inputs.
 * Falls back to defaults if inputs are empty.
 */
function getLabelOverrides() {
  const overrides = {};
  if (els.labelNewsletters && els.labelNewsletters.value.trim()) {
    overrides['Newsletters'] = els.labelNewsletters.value.trim();
  }
  if (els.labelReceipts && els.labelReceipts.value.trim()) {
    overrides['Receipts'] = els.labelReceipts.value.trim();
  }
  if (els.labelFyi && els.labelFyi.value.trim()) {
    overrides['FYI'] = els.labelFyi.value.trim();
  }
  if (els.labelJobAlerts && els.labelJobAlerts.value.trim()) {
    overrides['Job Alerts'] = els.labelJobAlerts.value.trim();
  }
  if (els.labelKidsActivities && els.labelKidsActivities.value.trim()) {
    overrides['Kids & Activities'] = els.labelKidsActivities.value.trim();
  }
  return overrides;
}

// ── View management ────────────────────────────────────────────

function showView(name) {
  for (const [key, el] of Object.entries(views)) {
    el.hidden = key !== name;
  }
  const active = views[name];
  if (active) {
    const heading = active.querySelector('h2');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus();
    } else if (active.hasAttribute('tabindex')) {
      active.focus();
    }
  }
}

function showError(message) {
  els.connectError.textContent = message;
  els.connectError.hidden = false;
}

function clearError() {
  els.connectError.textContent = '';
  els.connectError.hidden = true;
}

// ── Auth events ────────────────────────────────────────────────

document.addEventListener('auth:connected', async () => {
  clearError();
  const hint = document.getElementById('connect-hint');
  if (hint) hint.hidden = true;
  try {
    const email = await getProfile();
    els.connectedEmail.textContent = `Connected as ${email}`;
    await startScan();
  } catch (err) {
    showError(err.message);
    showView('connect');
  }
});

document.addEventListener('auth:error', (e) => {
  showView('connect');
  showError(e.detail.message);
});

document.addEventListener('auth:scope_denied', (e) => {
  showView('connect');
  showError(e.detail.message);
});

document.addEventListener('auth:disconnected', () => {
  senderGroups = [];
  allMessages = [];
  resetScanState();
  clearUndoManifest();
  showView('connect');
  clearError();
});

// ── Scan flow ──────────────────────────────────────────────────

async function startScan() {
  if (_isScanning) return;
  _isScanning = true;
  showView('scanning');
  if (els.scanProgress) els.scanProgress.removeAttribute('value');
  renderProgress(0, 0, 'Counting emails in your inbox...', els.scanProgress, els.scanStatus);
  allMessages = [];

  try {
    const totalCount = await countInbox((phase) => {
      renderProgress(0, 0, phase, els.scanProgress, els.scanStatus);
    });

    if (totalCount === 0) {
      showView('done');
      renderResults({ archived: 0, kept: 0 }, els.doneResults);
      const p = document.createElement('p');
      p.textContent = 'Your inbox is already empty. Nothing to tidy.';
      els.doneResults.prepend(p);
      return;
    }

    if (totalCount > 2500) {
      showScanChoice(totalCount);
      return;
    }

    await runWaveScan();

  } catch (err) {
    handleScanError(err);
  }
}

/**
 * Show the user a choice: scan in waves or scan everything.
 */
function showScanChoice(totalCount) {
  const est = estimateScanTime(totalCount);
  const isAtCap = totalCount >= 50000;
  const countText = isAtCap
    ? `Over ${totalCount.toLocaleString()} emails`
    : `${totalCount.toLocaleString()} emails found`;

  const container = views.scanning.querySelector('.view-card');
  container.replaceChildren();
  container.classList.add('scan-choice');

  const h2 = document.createElement('h2');
  h2.textContent = countText;
  container.appendChild(h2);

  const p = document.createElement('p');
  p.textContent = 'That is a big inbox. Choose how to tackle it.';
  container.appendChild(p);

  const btnGroup = document.createElement('div');
  btnGroup.classList.add('button-group', 'button-group--column');

  const waveBtn = document.createElement('button');
  waveBtn.type = 'button';
  waveBtn.classList.add('btn-primary', 'btn-large');
  waveBtn.textContent = 'Scan 2,000 at a time';
  waveBtn.addEventListener('click', async () => {
    restoreScanningView();
    try { await runWaveScan(); }
    catch (err) { handleScanError(err); }
  });
  btnGroup.appendChild(waveBtn);

  const waveHint = document.createElement('p');
  waveHint.className = 'choice-hint';
  waveHint.textContent = 'Recommended. Tidy in batches, under\u00a0a\u00a0minute each.';
  btnGroup.appendChild(waveHint);

  const fullBtn = document.createElement('button');
  fullBtn.type = 'button';
  fullBtn.classList.add('btn-secondary', 'btn-large');
  fullBtn.textContent = isAtCap ? 'Scan everything at once' : `Scan all ${totalCount.toLocaleString()} at once`;
  fullBtn.addEventListener('click', async () => {
    restoreScanningView();
    try { await runFullScan(); }
    catch (err) { handleScanError(err); }
  });
  btnGroup.appendChild(fullBtn);

  const fullHint = document.createElement('p');
  fullHint.className = 'choice-hint';
  fullHint.textContent = `Takes ${est}. One big operation.`;
  btnGroup.appendChild(fullHint);

  container.appendChild(btnGroup);
}

/**
 * Restore the scanning view to its original progress bar state.
 */
function restoreScanningView() {
  const container = views.scanning.querySelector('.view-card');
  container.replaceChildren();
  container.classList.add('progress-section');

  const h2 = document.createElement('h2');
  h2.textContent = 'Scanning your inbox';
  container.appendChild(h2);

  const status = document.createElement('p');
  status.className = 'progress-label';
  status.id = 'scan-status';
  status.setAttribute('aria-live', 'polite');
  status.textContent = 'Starting scan...';
  container.appendChild(status);

  const progress = document.createElement('progress');
  progress.id = 'scan-progress';
  progress.max = 100;
  progress.value = 0;
  progress.setAttribute('aria-label', 'Scan progress');
  container.appendChild(progress);

  const hint = document.createElement('p');
  hint.className = 'progress-hint';
  hint.textContent = 'This usually takes under a minute.';
  container.appendChild(hint);

  els.scanProgress = progress;
  els.scanStatus = status;
}

async function runWaveScan() {
  _scanController = new AbortController();
  renderProgress(0, 0, 'Scanning...', els.scanProgress, els.scanStatus);

  const { messages, hasMore } = await scanNextWave((completed, total, message) => {
    renderProgress(completed, total, message, els.scanProgress, els.scanStatus);
  }, _scanController.signal);

  allMessages.push(...messages);
  showResults(hasMore);
}

async function runFullScan() {
  _scanController = new AbortController();
  const progress = getScanProgress();
  const hint = views.scanning.querySelector('.progress-hint');
  if (hint && progress) {
    hint.textContent = `Scanning ${progress.total.toLocaleString()} emails. This may take ${estimateScanTime(progress.total)}.`;
  }

  renderProgress(0, 0, 'Scanning...', els.scanProgress, els.scanStatus);

  const { messages } = await scanFullInbox((completed, total, message) => {
    renderProgress(completed, total, message, els.scanProgress, els.scanStatus);
  }, _scanController.signal);

  allMessages.push(...messages);
  showResults(false);
}

function showResults(hasMore) {
  _isScanning = false;
  renderProgress(0, 0, 'Analysing patterns...', els.scanProgress, els.scanStatus);
  senderGroups = classifyMessages(allMessages);

  const prefs = loadPreferences();
  applyPreferences(senderGroups, prefs);

  renderSenderTable(senderGroups, els.senderTableContainer);

  if (els.scanMoreContainer) {
    if (hasMore) {
      const progress = getScanProgress();
      els.scanMoreContainer.hidden = false;
      const remaining = els.scanMoreContainer.querySelector('.scan-more-count');
      if (remaining && progress) {
        remaining.textContent = `${progress.remaining.toLocaleString()} emails remaining`;
      }
    } else {
      els.scanMoreContainer.hidden = true;
    }
  }

  showView('results');
}

function handleScanError(err) {
  _isScanning = false;
  _scanController = null;
  if (err.name === 'AbortError') {
    showView('connect');
    return;
  }
  if (err instanceof AuthExpiredError) {
    showView('connect');
    showError('Session expired. Please reconnect Gmail.');
  } else {
    showView('connect');
    showError(err.message || 'Something went wrong during the scan.');
  }
}

// Cancel scan button
const btnCancelScan = document.getElementById('btn-cancel-scan');
if (btnCancelScan) {
  btnCancelScan.addEventListener('click', () => {
    if (_scanController) {
      _scanController.abort();
    }
  });
}

// ── Button handlers ────────────────────────────────────────────

els.btnConnect.addEventListener('click', () => {
  clearError();
  const hint = document.getElementById('connect-hint');
  if (hint) hint.hidden = false;
  requestAuth();
});

els.btnDisconnect.addEventListener('click', () => {
  clearUndoManifest();
  resetScanState();
  revokeAuth();
});

els.btnPreview.addEventListener('click', () => {
  saveCurrentChoices(senderGroups);
  renderPreview(senderGroups, els.previewSummary);

  // Show which labels will be created
  const overrides = getLabelOverrides();
  const labelList = [];
  const usedLabels = new Set();

  for (const g of senderGroups) {
    const cat = g.assignedCategory || g.suggestedCategory;
    const labelName = g.sublabel || g.labelName;
    if (labelName && cat !== 'human') {
      const finalLabel = overrides[labelName] || labelName;
      usedLabels.add(finalLabel);
    }
  }

  for (const label of usedLabels) {
    labelList.push(`"${label}"`);
  }

  if (els.previewLabelHint && labelList.length > 0) {
    els.previewLabelHint.textContent = `Labels that will be created in Gmail: ${labelList.join(', ')}`;
    els.previewLabelHint.hidden = false;
  }

  showView('preview');
});

els.btnBack.addEventListener('click', () => {
  els.btnExecute.disabled = false;
  showView('results');
});

els.btnExecute.addEventListener('click', async () => {
  els.btnExecute.disabled = true;
  showView('executing');
  renderProgress(0, 0, 'Working...', els.execProgress, els.execStatus);

  try {
    const overrides = getLabelOverrides();
    const results = await executeActions(senderGroups, overrides, (completed, total) => {
      renderProgress(completed, total, `Tidying... ${completed} / ${total} processed`, els.execProgress, els.execStatus);
    });

    // Render before/after results screen
    renderBeforeAfter(results, {
      before: els.countBefore,
      after: els.countAfter,
      breakdown: els.resultsBreakdown,
      storage: els.resultsStorage,
    });

    // Clear the simple results container (used for empty inbox fallback)
    if (els.doneResults) els.doneResults.replaceChildren();

    // If more emails remain in inbox beyond what was scanned
    const scanState = getScanProgress();
    if (scanState && scanState.remaining > 0) {
      const moreP = document.createElement('p');
      moreP.className = 'done-more-hint';
      moreP.textContent = `There are more emails in your inbox. Tap "Scan Again" to keep going.`;
      els.doneResults.appendChild(moreP);
    }

    // Show undo section
    if (els.undoSection) {
      els.undoSection.hidden = false;
      els.btnUndo.disabled = false;
      els.btnUndo.textContent = 'Undo everything';
    }

    showView('done');

  } catch (err) {
    if (err instanceof AuthExpiredError) {
      showView('connect');
      showError('Session expired during execution. Please reconnect and try again.');
    } else {
      showView('connect');
      showError(err.message || 'Something went wrong during execution.');
    }
  }
});

els.btnScanAgain.addEventListener('click', async () => {
  if (isAuthenticated()) {
    resetScanState();
    await startScan();
  } else {
    showView('connect');
    showError('Session expired. Please reconnect Gmail.');
  }
});

els.btnDoneDisconnect.addEventListener('click', () => {
  clearUndoManifest();
  resetScanState();
  revokeAuth();
});

els.btnUndo.addEventListener('click', async () => {
  if (!canUndo()) return;

  els.btnUndo.disabled = true;
  els.btnUndo.textContent = 'Undoing...';

  try {
    const stats = await undoActions((completed, total) => {
      els.btnUndo.textContent = `Undoing... ${completed} / ${total}`;
    });

    // Reset the done screen
    if (els.doneResults) els.doneResults.replaceChildren();
    if (els.resultsBreakdown) els.resultsBreakdown.replaceChildren();
    if (els.resultsStorage) els.resultsStorage.hidden = true;

    const header = document.querySelector('.done-header h2');
    if (header) header.textContent = 'Changes reversed';

    // Reset before/after
    if (els.countBefore) els.countBefore.textContent = '';
    if (els.countAfter) els.countAfter.textContent = '';

    const lines = [];
    if (stats.restored > 0) lines.push(`${stats.restored} emails moved back to your inbox.`);
    if (stats.unlabelled > 0) lines.push(`${stats.unlabelled} labels removed.`);
    lines.push('Everything is back to how it was.');

    for (const line of lines) {
      const p = document.createElement('p');
      p.textContent = line;
      els.doneResults.appendChild(p);
    }

    if (els.undoSection) els.undoSection.hidden = true;

  } catch (err) {
    els.btnUndo.disabled = false;
    els.btnUndo.textContent = 'Undo everything';
    showError(err.message || 'Something went wrong while undoing.');
    showView('connect');
  }
});

// Scan more button
const btnScanMore = document.getElementById('btn-scan-more');
if (btnScanMore) {
  btnScanMore.addEventListener('click', async () => {
    if (!isAuthenticated()) {
      showView('connect');
      showError('Session expired. Please reconnect Gmail.');
      return;
    }
    restoreScanningView();
    showView('scanning');
    try { await runWaveScan(); }
    catch (err) { handleScanError(err); }
  });
}

// ── Initialise ─────────────────────────────────────────────────

if (!CLIENT_ID) {
  showError('This app has not been configured yet. If you are the developer, set CLIENT_ID in js/app.js.');
  els.btnConnect.disabled = true;
} else {
  const gisScript = document.querySelector('script[src*="accounts.google.com"]');
  if (gisScript) {
    gisScript.addEventListener('load', () => initAuth(CLIENT_ID));
    if (typeof google !== 'undefined' && google.accounts) {
      initAuth(CLIENT_ID);
    }
  }
}
