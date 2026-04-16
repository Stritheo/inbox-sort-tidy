/**
 * classifier.js -- Deterministic pattern matching engine.
 *
 * Groups emails by sender, classifies each group into one of 8 categories
 * using a strict priority chain. Zero AI, zero API cost.
 *
 * Priority order (first match wins):
 *   0. critical safety  -> Keep in inbox (security alerts, verification codes)
 *   1. job_alerts       -> Label, archive
 *   2. kids_activities  -> Label, keep in inbox
 *   3. receipts         -> Label, archive
 *   4. newsletters      -> Label, archive (sublabel for food/recipe)
 *   5. retail_promos    -> Archive only
 *   6. social           -> Archive only
 *   7. notifications    -> Archive only
 *   8. human            -> Keep in inbox
 */

// ── Job Alerts ────────────────────────────────────────────────

const JOB_ALERT_DOMAINS = [
  's.seek.com.au',
  'seek.com.au',
  'jora.com',
  'ethicaljobs.com.au',
  'apsjobs.gov.au',
  'iworkfor.nsw.gov.au',
];

const JOB_ALERT_SENDERS = [
  'jobs-noreply@linkedin.com',
  'jobalerts-noreply@linkedin.com',
];

const JOB_SUBJECT_PATTERNS = [
  /\bnew\s+jobs?\b/i,
  /\bjob.{0,20}(match|recommend|alert|pick)/i,
  /\b\d+\s+new\s+jobs?\b/i,
  /\bnew.*roles?\s+(for|in|at|near)\b/i,
  /\bis\s+hiring\b/i,
];

// ── Kids & Activities ─────────────────────────────────────────

const KIDS_ACTIVITY_DOMAINS = [
  'revolutionise.com.au',
  'compassedu.com.au',
  'tass.com.au',
  'operoo.com',
  'classcover.com.au',
  'trybooking.com',
  'signupgenius.com',
  'schoolzine.com',
  'skoolbag.com.au',
  'sentral.com.au',
  // Youth and school-adjacent platforms
  'nsw.scouts.com.au',
  'scouts.com.au',
  'dribl.com',
];

// Any sender domain ending with these is treated as a school/education domain
const KIDS_ACTIVITY_DOMAIN_SUFFIXES = [
  '.nsw.edu.au',
  '.vic.edu.au',
  '.qld.edu.au',
  '.wa.edu.au',
  '.sa.edu.au',
  '.tas.edu.au',
  '.act.edu.au',
  '.nt.edu.au',
];

const KIDS_ACTIVITY_SENDER_PATTERNS = [
  /\bscout/i,
  /\bschool\b/i,
  /\bp\s*[&and]+\s*c\b/i,
  /\b(band|choir|keyboard|orchestra)\b/i,
  /\b(afl|cricket|soccer|netball|swimming|rugby|basketball|athletics)\b/i,
  /\b(cubs|brownies|guides|venturers|joeys)\b/i,
];

const KIDS_ACTIVITY_SUBJECT_PATTERNS = [
  /\bterm\s+\d/i,
  /\bexcursion/i,
  /\bschool\s+(report|notice|newsletter)/i,
  /\bcanteen/i,
  /\buniform/i,
  /\bregistration\b.*\b20\d{2}/i,
  /\bpermission/i,
  /\bcamp\b/i,
  /\bsports?\s+day/i,
  /\bswimming\s+(carnival|lesson)/i,
  /\bcross\s+country/i,
];

// ── Receipts ──────────────────────────────────────────────────

const RECEIPT_SENDER_DOMAINS = [
  'stripe.com', 'paypal.com', 'square.com', 'xero.com',
  'shopify.com', 'amazon.com', 'apple.com',
  'commbank.com.au', 'westpac.com.au', 'anz.com',
  'nab.com.au', 'macquarie.com', 'suncorp.com.au',
  'afterpay.com', 'zip.co', 'email.apple.com',
];

const RECEIPT_SUBJECT_PATTERNS = [
  /\breceipt\b/i, /\binvoice\b/i, /\btax invoice\b/i,
  /\bpayment confirm/i, /\border confirm/i, /\btransaction\b/i,
  /\bpurchase confirm/i, /\bshipping confirm/i, /\byour order\b/i,
  /\bsubscription\s+renew/i, /\bauto.?renew/i,
  /\bpayment\s+(received|confirm)/i, /\bdirect\s+debit/i,
  // Shipping and delivery confirmations
  /\b(despatched|dispatched)\b/i,
  /\bhas\s+shipped\b/i, /\bhas\s+been\s+shipped\b/i,
  /\bwe\s+have\s+delivered\b/i, /\bparcel\s+delivered\b/i,
  /\btracking\s+(number|info)/i,
  /\border\s+#/i, /\border\s+number/i,
];

// ── Newsletters ───────────────────────────────────────────────

const FOOD_NEWSLETTER_DOMAINS = [
  'skinnymixers.com.au',
  'thermomix.com.au',
  'taste.com.au',
  'delicious.com.au',
];

// ── Retail Promos ─────────────────────────────────────────────

const AU_RETAIL_DOMAINS = [
  'reply.ebay.com.au',
  'hello.citybeach.com.au',
  'plans.eventbrite.com',
  'e.kmart.com.au',
  'e.target.com.au',
  'e.bigw.com.au',
  'e.bunnings.com.au',
  'e.woolworths.com.au',
  'e.coles.com.au',
  'e.myer.com.au',
  'e.davidjones.com',
  'email.catch.com.au',
  'e.theiconic.com.au',
  'e.cottonon.com',
  'e.countryroad.com.au',
];

const RETAIL_SUBJECT_PATTERNS = [
  /\b\d+%\s*off\b/i,
  /\bsale\b/i,
  /\bdiscount/i,
  /\bdeal/i,
  /\bexclusive\s+offer/i,
  /\bfree\s+(shipping|delivery)/i,
  /\bflash\s+sale/i,
  /\bclearance/i,
  /\bbest\s+deals/i,
];

// ── Social ────────────────────────────────────────────────────

const LINKEDIN_SOCIAL_SENDERS = [
  'notifications-noreply@linkedin.com',
  'messages-noreply@linkedin.com',
  'linkedin@em.linkedin.com',
  'invitations-noreply@linkedin.com',
  'updates-noreply@linkedin.com',
  'news-noreply@linkedin.com',
  'hits-noreply@linkedin.com',
];

const SOCIAL_DOMAINS = [
  'facebookmail.com', 'twitter.com', 'x.com',
  'instagram.com', 'tiktok.com', 'reddit.com', 'quora.com',
  'medium.com', 'substack.com', 'discord.com', 'slack.com',
  'meetup.com', 'nextdoor.com', 'pinterest.com',
];

// ── Notifications (generic noreply) ───────────────────────────

const NOREPLY_PATTERNS = [
  'noreply@', 'no-reply@', 'do-not-reply@', 'donotreply@',
  'notifications@', 'mailer-daemon@', 'postmaster@',
  'auto-confirm@', 'bounce@', 'automated@',
];

// ── Detection functions ───────────────────────────────────────

function isNoreply(email) {
  return NOREPLY_PATTERNS.some(p => email.includes(p));
}

function isJobAlert(email, domain, senderName, subject) {
  if (JOB_ALERT_DOMAINS.includes(domain)) return true;
  if (JOB_ALERT_SENDERS.includes(email)) return true;
  if (email.includes('jobs-noreply') || email.includes('jobalerts-noreply') || email.includes('jobmail@')) return true;
  if (isNoreply(email) && JOB_SUBJECT_PATTERNS.some(p => p.test(subject))) return true;
  return false;
}

function isKidsActivity(email, domain, senderName, subject) {
  if (KIDS_ACTIVITY_DOMAINS.includes(domain)) return true;
  if (KIDS_ACTIVITY_DOMAIN_SUFFIXES.some(suffix => domain.endsWith(suffix))) return true;
  if (KIDS_ACTIVITY_SENDER_PATTERNS.some(p => p.test(senderName))) return true;
  if (KIDS_ACTIVITY_SUBJECT_PATTERNS.some(p => p.test(subject))) return true;
  return false;
}

// Security and account-critical senders that must never be auto-archived.
// These are kept in the inbox regardless of other signals.
const CRITICAL_SAFETY_SENDERS = [
  'no-reply@accounts.google.com',
  'noreply@accounts.google.com',
  'noreply-account@google.com',
  'security-noreply@linkedin.com',
  'noreply-apple-id@apple.com',
  'appleid@id.apple.com',
];

const CRITICAL_SAFETY_SUBJECT_PATTERNS = [
  /\bsecurity\s+alert\b/i,
  /\bsuspicious\s+(sign|activity|login)/i,
  /\bnew\s+sign.?in\b/i,
  /\bpassword\s+(reset|changed)/i,
  /\btwo.?factor/i,
  /\bverification\s+code\b/i,
];

function isCriticalSafety(email, subject) {
  if (CRITICAL_SAFETY_SENDERS.includes(email)) return true;
  if (CRITICAL_SAFETY_SUBJECT_PATTERNS.some(p => p.test(subject))) return true;
  return false;
}

function isReceipt(domain, subject) {
  if (RECEIPT_SENDER_DOMAINS.includes(domain)) return true;
  if (RECEIPT_SUBJECT_PATTERNS.some(p => p.test(subject))) return true;
  return false;
}

function isFoodNewsletter(domain) {
  return FOOD_NEWSLETTER_DOMAINS.includes(domain);
}

function isRetailPromo(email, domain, subject) {
  if (AU_RETAIL_DOMAINS.includes(domain)) return true;
  if (email.includes('marketing@') && RETAIL_SUBJECT_PATTERNS.some(p => p.test(subject))) return true;
  return false;
}

function isSocial(email, domain) {
  if (LINKEDIN_SOCIAL_SENDERS.includes(email)) return true;
  if (SOCIAL_DOMAINS.includes(domain)) return true;
  return false;
}

// ── Action mapping ────────────────────────────────────────────

const ACTION_MAP = {
  job_alerts:      { action: 'label_archive', labelName: 'Job Alerts' },
  kids_activities: { action: 'label_keep',    labelName: 'Kids & Activities' },
  receipts:        { action: 'label_archive', labelName: 'Receipts' },
  newsletters:     { action: 'label_archive', labelName: 'Newsletters' },
  retail_promos:   { action: 'archive',       labelName: null },
  social:          { action: 'archive',       labelName: null },
  notifications:   { action: 'archive',       labelName: null },
  human:           { action: 'keep',          labelName: null },
};

// ── Public API ────────────────────────────────────────────────

/**
 * Group messages by sender and classify each group.
 * Classification runs in strict priority order; first match wins.
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
        sublabel: null,
        action: null,
        labelName: null,
      });
    }
    senderMap.get(key).messages.push(msg);
  }

  // Classify each group (strict priority order)
  for (const [, group] of senderMap) {
    const { senderEmail, senderDomain, senderName } = group;
    // Use first message's subject as representative for sender-level checks
    const repSubject = group.messages[0] ? group.messages[0].subject : '';
    const anySubject = (patterns) => group.messages.some(m => patterns.some(p => p.test(m.subject)));

    // 0. Critical safety: security alerts, verification codes, account notices
    // These ALWAYS stay in inbox regardless of any other signal.
    if (isCriticalSafety(senderEmail, repSubject) ||
        group.messages.some(m => isCriticalSafety(senderEmail, m.subject))) {
      group.suggestedCategory = 'human';
    }
    // 1. Job Alerts
    else if (isJobAlert(senderEmail, senderDomain, senderName, repSubject) ||
        anySubject(JOB_SUBJECT_PATTERNS) && isNoreply(senderEmail)) {
      group.suggestedCategory = 'job_alerts';
    }
    // 2. Kids & Activities
    else if (isKidsActivity(senderEmail, senderDomain, senderName, repSubject) ||
             anySubject(KIDS_ACTIVITY_SUBJECT_PATTERNS)) {
      group.suggestedCategory = 'kids_activities';
    }
    // 3. Receipts
    else if (isReceipt(senderDomain, repSubject) ||
             group.messages.some(m => RECEIPT_SUBJECT_PATTERNS.some(p => p.test(m.subject)))) {
      group.suggestedCategory = 'receipts';
    }
    // 4. Newsletters (List-Unsubscribe header)
    else if (group.messages.some(m => m.hasUnsubscribe)) {
      group.suggestedCategory = 'newsletters';
      // Sub-label for food/recipe newsletters
      if (isFoodNewsletter(senderDomain)) {
        group.sublabel = 'Recipes';
      }
    }
    // 5. Retail Promos
    else if (isRetailPromo(senderEmail, senderDomain, repSubject) ||
             group.messages.some(m => isRetailPromo(senderEmail, senderDomain, m.subject))) {
      group.suggestedCategory = 'retail_promos';
    }
    // 6. Social
    else if (isSocial(senderEmail, senderDomain)) {
      group.suggestedCategory = 'social';
    }
    // 7. Notifications (generic noreply)
    else if (isNoreply(senderEmail)) {
      group.suggestedCategory = 'notifications';
    }
    // 8. Human (default)
    else {
      group.suggestedCategory = 'human';
    }

    // Apply action mapping
    const mapping = ACTION_MAP[group.suggestedCategory];
    group.action = mapping.action;
    group.labelName = group.sublabel || mapping.labelName;
  }

  // Sort by message count descending (biggest impact first)
  return [...senderMap.values()].sort((a, b) => b.messages.length - a.messages.length);
}

/**
 * Get the action mapping for a given category.
 * Used by actions.js and ui.js to determine what each category does.
 * @param {string} category
 * @returns {{ action: string, labelName: string|null }}
 */
export function getActionForCategory(category) {
  return ACTION_MAP[category] || ACTION_MAP.human;
}
