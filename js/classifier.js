/**
 * classifier.js -- Deterministic pattern matching engine.
 *
 * Groups emails by sender, classifies each group into one of 5 categories.
 * Zero AI, zero API cost.
 */

// ── Pattern constants ──────────────────────────────────────────

const NOREPLY_PATTERNS = [
  'noreply@', 'no-reply@', 'do-not-reply@', 'donotreply@',
  'notifications@', 'mailer-daemon@', 'postmaster@',
  'auto-confirm@', 'bounce@', 'automated@',
];

const SOCIAL_DOMAINS = [
  'facebookmail.com', 'linkedin.com', 'twitter.com', 'x.com',
  'instagram.com', 'tiktok.com', 'reddit.com', 'quora.com',
  'medium.com', 'substack.com', 'discord.com', 'slack.com',
  'meetup.com', 'nextdoor.com', 'pinterest.com',
];

const RECEIPT_SENDER_DOMAINS = [
  'stripe.com', 'paypal.com', 'square.com', 'xero.com',
  'shopify.com', 'amazon.com', 'apple.com',
];

const RECEIPT_SUBJECT_PATTERNS = [
  /\breceipt\b/i, /\binvoice\b/i, /\btax invoice\b/i,
  /\bpayment confirm/i, /\border confirm/i, /\btransaction\b/i,
  /\bpurchase confirm/i, /\bshipping confirm/i, /\byour order\b/i,
];

// ── Detection functions ────────────────────────────────────────

function isNoreply(email) {
  return NOREPLY_PATTERNS.some(p => email.includes(p));
}

function isSocialDomain(domain) {
  return SOCIAL_DOMAINS.includes(domain);
}

function isReceiptSender(domain) {
  return RECEIPT_SENDER_DOMAINS.includes(domain);
}

function isReceiptSubject(subject) {
  return RECEIPT_SUBJECT_PATTERNS.some(p => p.test(subject));
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Group messages by sender and classify each group.
 * @param {object[]} messages -- normalised messages from scanner
 * @returns {object[]} sender groups sorted by message count descending
 */
export function classifyMessages(messages) {
  const senderMap = new Map();

  // Group by sender
  for (const msg of messages) {
    const key = msg.senderEmail.toLowerCase();
    if (!senderMap.has(key)) {
      senderMap.set(key, {
        senderEmail: key,
        senderName: msg.sender,
        senderDomain: msg.senderDomain,
        messages: [],
        suggestedCategory: null,
        assignedCategory: null,
      });
    }
    senderMap.get(key).messages.push(msg);
  }

  // Classify each group (priority order)
  for (const [, group] of senderMap) {
    if (isNoreply(group.senderEmail)) {
      group.suggestedCategory = 'notifications';
    } else if (isSocialDomain(group.senderDomain)) {
      group.suggestedCategory = 'social';
    } else if (group.messages.some(m => m.hasUnsubscribe)) {
      group.suggestedCategory = 'newsletters';
    } else if (isReceiptSender(group.senderDomain) ||
               group.messages.some(m => isReceiptSubject(m.subject))) {
      group.suggestedCategory = 'receipts';
    } else {
      group.suggestedCategory = 'human';
    }
  }

  // Sort by message count descending (biggest impact first)
  return [...senderMap.values()].sort((a, b) => b.messages.length - a.messages.length);
}
