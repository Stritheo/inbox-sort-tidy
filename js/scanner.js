/**
 * scanner.js -- Inbox scan orchestrator.
 *
 * Lists message IDs, fetches metadata in parallel batches,
 * and normalises each message into a consistent format.
 */

import { listAllMessageIds, fetchMessageMetadata } from './gmail.js';

// ── From header parser ─────────────────────────────────────────

const FROM_REGEX = /^"?([^"<]*)"?\s*<?([^\s>]+@[^\s>]+)>?$/;

/**
 * Parse a From header into name, email, and domain.
 * Handles: "Name" <email>, Name <email>, bare email
 * @param {string} raw
 * @returns {{ sender: string, senderEmail: string, senderDomain: string }}
 */
function parseFrom(raw) {
  if (!raw) return { sender: '', senderEmail: '', senderDomain: '' };

  const match = raw.match(FROM_REGEX);
  if (match) {
    const name = (match[1] || '').trim();
    const email = match[2].trim().toLowerCase();
    const domain = email.split('@')[1] || '';
    return { sender: name || email, senderEmail: email, senderDomain: domain };
  }

  // Fallback: treat entire string as email
  const email = raw.trim().toLowerCase();
  const domain = email.includes('@') ? email.split('@')[1] : '';
  return { sender: email, senderEmail: email, senderDomain: domain };
}

/**
 * Extract a header value by name from a Gmail metadata message.
 * @param {object} msg -- raw Gmail message with payload.headers
 * @param {string} name -- header name (case-insensitive match)
 * @returns {string|null}
 */
function getHeader(msg, name) {
  if (!msg.payload || !msg.payload.headers) return null;
  const lower = name.toLowerCase();
  const header = msg.payload.headers.find(h => h.name.toLowerCase() === lower);
  return header ? header.value : null;
}

/**
 * Normalise a raw Gmail metadata message into our internal format.
 * @param {object} msg
 * @returns {object}
 */
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

// ── Public API ─────────────────────────────────────────────────

/**
 * Scan the inbox: list IDs, fetch metadata, normalise.
 * @param {(completed: number, total: number, phase: string) => void} onProgress
 * @param {number} maxMessages -- cap on messages to scan
 * @returns {Promise<object[]>} normalised messages
 */
export async function scanInbox(onProgress, maxMessages = 2000) {
  // Phase 1: List message IDs
  if (onProgress) onProgress(0, 0, 'Listing messages...');
  const ids = await listAllMessageIds('in:inbox', maxMessages);

  if (ids.length === 0) return [];

  // Phase 2: Fetch metadata
  const rawMessages = await fetchMessageMetadata(ids, (completed, total) => {
    if (onProgress) onProgress(completed, total, `Scanning... ${completed} / ${total} messages`);
  });

  // Phase 3: Normalise
  return rawMessages.map(normaliseMessage);
}
