/**
 * gmail.js -- Gmail REST API client via fetch().
 *
 * All calls go through gmailFetch() which handles auth headers,
 * rate limiting (429 retry), and error wrapping.
 */

import { getToken } from './auth.js';

const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

// ── Custom errors ──────────────────────────────────────────────

export class AuthExpiredError extends Error {
  constructor(msg = 'Session expired. Please reconnect.') {
    super(msg);
    this.name = 'AuthExpiredError';
  }
}

export class GmailError extends Error {
  constructor(status, body) {
    // Extract user-friendly message from Gmail API error format
    let msg = `Gmail returned an error (${status}).`;
    try {
      const parsed = JSON.parse(body);
      if (parsed.error && parsed.error.message) {
        msg = parsed.error.message;
      }
    } catch { /* body wasn't JSON, use generic message */ }
    super(msg);
    this.name = 'GmailError';
    this.status = status;
  }
}

// ── Helpers ────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Core fetch wrapper with auth header and 429 retry.
 */
async function gmailFetch(path, options = {}) {
  const token = getToken();
  if (!token) throw new AuthExpiredError();

  const { _retryCount, signal, ...fetchOptions } = options;

  const res = await fetch(`${BASE}${path}`, {
    ...fetchOptions,
    signal,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
  });

  if (res.status === 401) throw new AuthExpiredError();

  if (res.status === 429) {
    const attempt = (options._retryCount || 0) + 1;
    if (attempt > 3) throw new GmailError(429, 'Gmail rate limit exceeded after 3 retries. Try again in a few minutes.');
    const retryAfter = parseInt(res.headers.get('Retry-After') || '5', 10);
    await sleep(retryAfter * 1000);
    return gmailFetch(path, { ...options, _retryCount: attempt });
  }

  if (!res.ok) throw new GmailError(res.status, await res.text());
  return res.json();
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Get the authenticated user's email address.
 * @returns {Promise<string>}
 */
export async function getProfile() {
  const data = await gmailFetch('/profile');
  return data.emailAddress;
}

/**
 * List message IDs matching a query, paginating up to maxResults.
 * @param {string} query -- Gmail search query (e.g. 'in:inbox')
 * @param {number} maxResults -- cap on total IDs to return
 * @returns {Promise<string[]>}
 */
export async function listAllMessageIds(query, maxResults = 50000) {
  const ids = [];
  let pageToken = null;

  while (ids.length < maxResults) {
    const pageSize = Math.min(500, maxResults - ids.length);
    let url = `/messages?q=${encodeURIComponent(query)}&maxResults=${pageSize}`;
    if (pageToken) url += `&pageToken=${pageToken}`;

    const data = await gmailFetch(url);

    if (data.messages) {
      for (const msg of data.messages) {
        ids.push(msg.id);
      }
    }

    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return ids;
}

/**
 * Fetch metadata for a batch of message IDs.
 * Fetches in parallel batches of 20 with 200ms delay between batches.
 * @param {string[]} messageIds
 * @param {(completed: number, total: number) => void} onProgress
 * @returns {Promise<object[]>}
 */
export async function fetchMessageMetadata(messageIds, onProgress, signal) {
  const BATCH_SIZE = 20;
  const BATCH_DELAY = 200;
  const results = [];

  for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
    if (signal && signal.aborted) throw new DOMException('Scan cancelled.', 'AbortError');

    const batch = messageIds.slice(i, i + BATCH_SIZE);

    const batchSettled = await Promise.allSettled(
      batch.map(id =>
        gmailFetch(`/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=List-Unsubscribe`, { signal })
      )
    );

    // Keep successful results, skip transient failures (deleted messages, 500s)
    for (const result of batchSettled) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      }
      // Silently skip rejected fetches -- message may have been deleted or server hiccup
    }

    if (onProgress) {
      onProgress(results.length, messageIds.length);
    }

    if (i + BATCH_SIZE < messageIds.length) {
      await sleep(BATCH_DELAY);
    }
  }

  return results;
}

/**
 * Restore messages to the inbox by adding the INBOX label.
 * @param {string[]} messageIds
 */
export async function batchUnarchive(messageIds) {
  const CHUNK = 1000;
  for (let i = 0; i < messageIds.length; i += CHUNK) {
    const chunk = messageIds.slice(i, i + CHUNK);
    await gmailFetch('/messages/batchModify', {
      method: 'POST',
      body: JSON.stringify({
        ids: chunk,
        addLabelIds: ['INBOX'],
      }),
    });
  }
}

/**
 * Remove a label from messages (without changing inbox status).
 * @param {string[]} messageIds
 * @param {string} labelId
 */
export async function batchRemoveLabel(messageIds, labelId) {
  const CHUNK = 1000;
  for (let i = 0; i < messageIds.length; i += CHUNK) {
    const chunk = messageIds.slice(i, i + CHUNK);
    await gmailFetch('/messages/batchModify', {
      method: 'POST',
      body: JSON.stringify({
        ids: chunk,
        removeLabelIds: [labelId],
        addLabelIds: ['INBOX'],
      }),
    });
  }
}

/**
 * Archive messages by removing the INBOX label.
 * @param {string[]} messageIds -- up to thousands; chunked into 1000 per call
 */
export async function batchArchive(messageIds) {
  const CHUNK = 1000;
  for (let i = 0; i < messageIds.length; i += CHUNK) {
    const chunk = messageIds.slice(i, i + CHUNK);
    await gmailFetch('/messages/batchModify', {
      method: 'POST',
      body: JSON.stringify({
        ids: chunk,
        removeLabelIds: ['INBOX'],
      }),
    });
  }
}

/**
 * Add a label and remove from INBOX.
 * @param {string[]} messageIds
 * @param {string} labelId -- Gmail label ID
 */
export async function batchAddLabel(messageIds, labelId) {
  const CHUNK = 1000;
  for (let i = 0; i < messageIds.length; i += CHUNK) {
    const chunk = messageIds.slice(i, i + CHUNK);
    await gmailFetch('/messages/batchModify', {
      method: 'POST',
      body: JSON.stringify({
        ids: chunk,
        addLabelIds: [labelId],
        removeLabelIds: ['INBOX'],
      }),
    });
  }
}

/**
 * Ensure labels exist, creating any that are missing.
 * @param {string[]} labelNames
 * @returns {Promise<Record<string, string>>} name-to-ID map
 */
export async function ensureLabels(labelNames) {
  const data = await gmailFetch('/labels');
  const existing = new Map();
  for (const label of data.labels) {
    existing.set(label.name, label.id);
  }

  const result = {};
  for (const name of labelNames) {
    if (existing.has(name)) {
      result[name] = existing.get(name);
    } else {
      const created = await gmailFetch('/labels', {
        method: 'POST',
        body: JSON.stringify({
          name,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
        }),
      });
      result[name] = created.id;
    }
  }

  return result;
}
