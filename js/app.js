/**
 * app.js -- Entry point. State machine, view toggling, event wiring.
 */

import { initAuth, requestAuth, revokeAuth, isAuthenticated } from './auth.js';
import { getProfile, AuthExpiredError } from './gmail.js';
import { scanInbox } from './scanner.js';
import { classifyMessages } from './classifier.js';
import { renderSenderTable, renderProgress, renderPreview, renderResults } from './ui.js';
import { loadPreferences, applyPreferences, saveCurrentChoices } from './preferences.js';
import { executeActions } from './actions.js';

// ── Configuration ──────────────────────────────────────────────

const CLIENT_ID = ''; // Set your Google OAuth Client ID here

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
};

// ── State ──────────────────────────────────────────────────────

let senderGroups = [];

// ── View management ────────────────────────────────────────────

function showView(name) {
  for (const [key, el] of Object.entries(views)) {
    el.hidden = key !== name;
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
  showView('connect');
  clearError();
});

// ── Scan flow ──────────────────────────────────────────────────

async function startScan() {
  showView('scanning');
  renderProgress(0, 0, 'Starting scan...', els.scanProgress, els.scanStatus);

  try {
    const messages = await scanInbox((completed, total, message) => {
      renderProgress(completed, total, message, els.scanProgress, els.scanStatus);
    });

    if (messages.length === 0) {
      showView('done');
      renderResults({ archived: 0, newsletters: 0, receipts: 0, fyi: 0, kept: 0 }, els.doneResults);
      const p = document.createElement('p');
      p.textContent = 'Your inbox is already empty. Nothing to tidy.';
      els.doneResults.prepend(p);
      return;
    }

    // Classify
    renderProgress(0, 0, 'Analysing patterns...', els.scanProgress, els.scanStatus);
    senderGroups = classifyMessages(messages);

    // Apply saved preferences
    const prefs = loadPreferences();
    applyPreferences(senderGroups, prefs);

    // Show results
    renderSenderTable(senderGroups, els.senderTableContainer);
    showView('results');

  } catch (err) {
    if (err instanceof AuthExpiredError) {
      showView('connect');
      showError('Session expired. Please reconnect Gmail.');
    } else {
      showView('connect');
      showError(err.message || 'Something went wrong during the scan.');
    }
  }
}

// ── Button handlers ────────────────────────────────────────────

els.btnConnect.addEventListener('click', () => {
  clearError();
  requestAuth();
});

els.btnDisconnect.addEventListener('click', () => {
  revokeAuth();
});

els.btnPreview.addEventListener('click', () => {
  saveCurrentChoices(senderGroups);
  renderPreview(senderGroups, els.previewSummary);
  showView('preview');
});

els.btnBack.addEventListener('click', () => {
  showView('results');
});

els.btnExecute.addEventListener('click', async () => {
  showView('executing');
  renderProgress(0, 0, 'Working...', els.execProgress, els.execStatus);

  try {
    const stats = await executeActions(senderGroups, (completed, total) => {
      renderProgress(completed, total, `Tidying... ${completed} / ${total} processed`, els.execProgress, els.execStatus);
    });

    renderResults(stats, els.doneResults);
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
    await startScan();
  } else {
    showView('connect');
    showError('Session expired. Please reconnect Gmail.');
  }
});

els.btnDoneDisconnect.addEventListener('click', () => {
  revokeAuth();
});

// ── Initialise ─────────────────────────────────────────────────

if (!CLIENT_ID) {
  showError('No OAuth Client ID configured. Set CLIENT_ID in js/app.js.');
} else {
  // Wait for GIS library to load, then initialise
  const gisScript = document.querySelector('script[src*="accounts.google.com"]');
  if (gisScript) {
    gisScript.addEventListener('load', () => initAuth(CLIENT_ID));
    // If already loaded (cached)
    if (typeof google !== 'undefined' && google.accounts) {
      initAuth(CLIENT_ID);
    }
  }
}
