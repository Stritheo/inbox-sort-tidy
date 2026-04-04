/**
 * scanner.js -- Inbox scan orchestrator.
 *
 * Supports two modes:
 *   1. Wave scanning (default): scan 2,000 at a time, user tidies,
 *      then "Scan more" loads the next batch.
 *   2. Full scanning: scan the entire inbox in one go.
 *
 * Both modes list message IDs first (cheap: 5 units per page of 500),
 * then fetch metadata in parallel batches of 20.
 */

import { listAllMessageIds, fetchMessageMetadata } from './gmail.js';

// ── Constants ──────────────────────────────────────────────────

const WAVE_SIZE = 2000;
const BATCH_SIZE = 20;

// ── From header parser ─────────────────────────────────────────

const FROM_REGEX = /^"?([^"<]*)"?\s*<?([^\s>]+@[^\s>]+)>?$/;

function parseFrom(raw) {
  if (!raw) return { sender: '', senderEmail: '', senderDomain: '' };
  const match = raw.match(FROM_REGEX);
  if (match) {
    const name = (match[1] || '').trim();
    const email = match[2].trim().toLowerCase();
    const domain = email.split('@')[1] || '';
    return { sender: name || email, senderEmail: email, senderDomain: domain };
  }
  const email = raw.trim().toLowerCase();
  const domain = email.includes('@') ? email.split('@')[1] : '';
  return { sender: email, senderEmail: email, senderDomain: domain };
}

function getHeader(msg, name) {
  if (!msg.payload || !msg.payload.headers) return null;
  const lower = name.toLowerCase();
  const header = msg.payload.headers.find(h => h.name.toLowerCase() === lower);
  return header ? header.value : null;
}

function normaliseMessage(msg) {
  const from = parseFrom(getHeader(msg, 'From'));
  return {
    id: msg.id,
    sender: from.sender,
    senderEmail: from.senderEmail,
    senderDomain: from.senderDomain,
    subject: getHeader(msg, 'Subject') || '',
    hasUnsubscribe: getHeader(msg, 'List-Unsubscribe') !== null,
    date: parseInt(msg.internalDate, 10) || 0,
  };
}

// ── Scan state (for wave continuation) ─────────────────────────

let _allInboxIds = null;    // all message IDs from listing (cached)
let _scannedCount = 0;      // how many IDs we have fetched metadata for

/**
 * Reset scan state (call on disconnect or new full scan).
 */
export function resetScanState() {
  _allInboxIds = null;
  _scannedCount = 0;
}

/**
 * Get inbox stats for display.
 * @returns {{ total: number, scanned: number, remaining: number } | null}
 */
export function getScanProgress() {
  if (!_allInboxIds) return null;
  return {
    total: _allInboxIds.length,
    scanned: _scannedCount,
    remaining: _allInboxIds.length - _scannedCount,
  };
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Count total inbox messages (cheap: just lists IDs).
 * Caches the result for subsequent wave scans.
 * @param {(phase: string) => void} onStatus
 * @returns {Promise<number>}
 */
export async function countInbox(onStatus) {
  if (onStatus) onStatus('Counting emails in your inbox...');
  _allInboxIds = await listAllMessageIds('in:inbox', 50000);
  _scannedCount = 0;
  return _allInboxIds.length;
}

/**
 * Scan the next wave of messages (up to WAVE_SIZE).
 * Call countInbox() first if _allInboxIds is null.
 * @param {(completed: number, total: number, message: string) => void} onProgress
 * @returns {Promise<{ messages: object[], hasMore: boolean }>}
 */
export async function scanNextWave(onProgress) {
  if (!_allInboxIds) {
    throw new Error('Call countInbox() before scanning.');
  }

  if (_scannedCount >= _allInboxIds.length) {
    return { messages: [], hasMore: false };
  }

  const waveIds = _allInboxIds.slice(_scannedCount, _scannedCount + WAVE_SIZE);
  const waveTotal = waveIds.length;

  const rawMessages = await fetchMessageMetadata(waveIds, (completed, total) => {
    if (onProgress) {
      onProgress(completed, waveTotal, `Scanning... ${_scannedCount + completed} / ${_allInboxIds.length} emails`);
    }
  });

  _scannedCount += waveIds.length;
  const messages = rawMessages.map(normaliseMessage);
  const hasMore = _scannedCount < _allInboxIds.length;

  return { messages, hasMore };
}

/**
 * Scan the entire inbox in one go.
 * @param {(completed: number, total: number, message: string) => void} onProgress
 * @returns {Promise<{ messages: object[], hasMore: boolean }>}
 */
export async function scanFullInbox(onProgress) {
  if (!_allInboxIds) {
    throw new Error('Call countInbox() before scanning.');
  }

  _scannedCount = 0;
  const allIds = _allInboxIds;
  const total = allIds.length;

  // Estimate time for user display
  const estimatedSeconds = Math.ceil(total / BATCH_SIZE * 0.25); // ~250ms per batch

  const rawMessages = await fetchMessageMetadata(allIds, (completed) => {
    if (onProgress) {
      onProgress(completed, total, `Scanning... ${completed} / ${total} emails`);
    }
  });

  _scannedCount = total;
  const messages = rawMessages.map(normaliseMessage);

  return { messages, hasMore: false };
}

/**
 * Convenience: estimate scan time for a given count.
 * @param {number} count
 * @returns {string} human-readable estimate
 */
export function estimateScanTime(count) {
  const seconds = Math.ceil(count / BATCH_SIZE * 0.25);
  if (seconds < 60) return 'under a minute';
  const minutes = Math.ceil(seconds / 60);
  return `about ${minutes} minute${minutes === 1 ? '' : 's'}`;
}
