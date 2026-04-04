# CLAUDE.md -- Inbox Sort and Tidy

## Project Overview

A free, fully client-side inbox sorting and tidying tool. Users connect their Gmail, the app scans their inbox, groups emails by sender, auto-categorises using deterministic pattern matching, and lets the user archive/label in bulk. No AI, no backend, no cost, no data retention.

**Target audience:** Anyone with an overflowing Gmail inbox. Initial distribution via LinkedIn as a free tool.

**Privacy model:** Zero-retention, zero-server. Data flows browser-to-Google only. No third-party server ever sees email content or metadata. "We store nothing" is provably true because there is no server.

## Tech Stack

- **Language:** Vanilla JavaScript (ES modules, no transpiler, no bundler)
- **Styling:** Pico CSS v2 (self-hosted, not CDN)
- **Auth:** Google Identity Services (GIS) Token Model
- **API:** Gmail REST API (direct fetch from browser)
- **Hosting:** Cloudflare Pages (free) or GitHub Pages (free)
- **Build step:** None. The repo root IS the deployable artifact.
- **Dependencies:** Zero npm packages. Zero build tools.

## Project Structure

```
inbox-sort-tidy/
├── index.html              # SPA shell with CSP meta tag
├── css/
│   ├── pico.min.css        # Self-hosted Pico CSS v2.1.1 (~10KB gzipped)
│   └── app.css             # Custom overrides and component styles
├── js/
│   ├── app.js              # Entry point: state machine, view toggling
│   ├── auth.js             # GIS Token Model: initTokenClient, token lifecycle
│   ├── gmail.js            # Gmail REST API: list, get metadata, batchModify
│   ├── scanner.js          # Inbox scan orchestrator with progress reporting
│   ├── classifier.js       # Deterministic pattern matching engine
│   ├── ui.js               # XSS-safe DOM rendering (textContent only, NEVER innerHTML)
│   ├── actions.js          # Archive/label execution with batchModify
│   ├── preferences.js      # localStorage for saved sender categorisations
│   └── security.js         # Input sanitisation, token guard wrapper
├── privacy-policy.html     # Required for Google OAuth verification
├── terms.html              # Terms of service
├── _headers                # Cloudflare Pages security headers
├── 404.html                # SPA fallback
├── README.md
├── LICENSE                 # MIT
└── .github/
    └── workflows/
        └── deploy.yml      # GitHub Pages deploy workflow
```

## Architecture

### Auth Flow (GIS Token Model)

The app uses Google Identity Services **Token Model** (not Code Model). Token Model returns an access token directly to a browser callback -- no backend needed. Code Model requires a server to exchange the authorisation code.

```
User clicks "Connect Gmail"
  -> google.accounts.oauth2.initTokenClient() opens popup
  -> User consents in Google's popup
  -> Callback receives { access_token, expires_in, scope }
  -> Token stored in module-scoped JS closure (NOT window, NOT localStorage, NOT cookies)
  -> Token auto-expires after 1 hour
  -> User re-consents on each new session (no refresh tokens)
```

**Scope:** `https://www.googleapis.com/auth/gmail.modify` (single scope). This is a restricted scope that requires Google verification. It covers: list messages, get metadata, modify labels (archive = remove INBOX label, add custom labels). It is a superset of `gmail.readonly`.

**Why gmail.modify:** Archive = remove the INBOX label from a message. This requires `users.messages.modify` which only accepts `gmail.modify` or the full `mail.google.com` scope. There is no narrower option.

**No CASA audit needed:** Google requires CASA (Cloud Application Security Assessment) only for apps that access data through a third-party server. A purely client-side app where data flows browser-to-Google only is exempt. You still need restricted scope verification (demo video, privacy policy, Limited Use compliance) but not the $4,500-$75,000 security assessment.

### Gmail API Usage

All calls made directly from the browser via `fetch()`. No Google API client library.

| Operation | Method | Endpoint | Quota Cost |
|-----------|--------|----------|------------|
| List messages | GET | `/gmail/v1/users/me/messages?q=in:inbox` | 5 units |
| Get metadata | GET | `/gmail/v1/users/me/messages/{id}?format=metadata` | 5 units |
| Batch modify | POST | `/gmail/v1/users/me/messages/batchModify` | 50 units |
| List labels | GET | `/gmail/v1/users/me/labels` | 1 unit |
| Create label | POST | `/gmail/v1/users/me/labels` | 5 units |

**Rate limits:** Consumer Gmail API allows ~250 quota units/second. Each `messages.get` costs 5 units = ~50 requests/second max. The app fetches metadata in parallel batches of 20 with 200ms delay between batches to stay well under limits.

**Pagination:** `messages.list` returns max 500 per page. The app paginates up to 2000 messages (4 pages). Cap at 2000 to keep scan under 2 minutes. "Scan more" button for larger inboxes.

**Batch modify:** `batchModify` accepts up to 1000 message IDs per call. This is the most efficient path for bulk operations.

### Classification Engine

Deterministic pattern matching -- zero AI, zero API cost. Groups emails by sender first, then classifies each sender group.

**Categories (5 buckets):**

| Category | Action | Detection Method |
|----------|--------|-----------------|
| Newsletters | Label: "Newsletters", remove from Inbox | `List-Unsubscribe` header present |
| Notifications | Archive (remove from Inbox) | Noreply sender patterns, automated sender patterns |
| Receipts | Label: "Receipts", remove from Inbox | Sender domain match OR subject keyword match |
| Social | Archive (remove from Inbox) | Social media platform domains |
| Human | Keep in Inbox (no action) | Default safe bucket -- everything else |

**Pattern matching rules (in priority order):**

```javascript
// 1. NOREPLY DETECTION
const NOREPLY_PATTERNS = [
  'noreply@', 'no-reply@', 'do-not-reply@', 'donotreply@',
  'notifications@', 'mailer-daemon@', 'postmaster@',
  'auto-confirm@', 'bounce@', 'automated@',
];

// 2. NEWSLETTER DETECTION (strongest signal: List-Unsubscribe header)
// The presence of the List-Unsubscribe header is the most reliable indicator.
// Request this header via metadataHeaders parameter on messages.get.

// 3. RECEIPT DETECTION
const RECEIPT_SUBJECT_PATTERNS = [
  /\breceipt\b/i, /\binvoice\b/i, /\btax invoice\b/i,
  /\bpayment confirm/i, /\border confirm/i, /\btransaction\b/i,
  /\bpurchase confirm/i, /\bshipping confirm/i, /\byour order\b/i,
];
const RECEIPT_SENDER_DOMAINS = [
  'stripe.com', 'paypal.com', 'square.com', 'xero.com',
  'shopify.com', 'amazon.com', 'apple.com',
];

// 4. SOCIAL NOTIFICATION DETECTION
const SOCIAL_DOMAINS = [
  'facebookmail.com', 'linkedin.com', 'twitter.com', 'x.com',
  'instagram.com', 'tiktok.com', 'reddit.com', 'quora.com',
  'medium.com', 'substack.com', 'discord.com', 'slack.com',
  'meetup.com', 'nextdoor.com', 'pinterest.com',
];

// 5. DEFAULT: "Human" -- keep in inbox
```

**Key design decision:** Group by sender, then classify the group. The UI shows a sender frequency table (sender name, email count, suggested category). This is more useful for bulk cleanup than a per-message view.

### State Machine

```
DISCONNECTED -> CONNECTING -> CONNECTED -> SCANNING -> CLASSIFYING ->
REVIEWING -> PREVIEWING -> EXECUTING -> DONE

Each state shows/hides the corresponding <section> in index.html.
Transitions triggered by user actions and async completion events.
```

## Implementation Details

### index.html

Single HTML file. Key requirements:

- `<meta>` CSP tag (see Security section below)
- `data-theme="light"` on `<html>` for Pico CSS
- One `<section>` per state, all hidden except the active one
- External script: `https://accounts.google.com/gsi/client` (Google Identity Services -- required)
- App script: `<script type="module" src="js/app.js"></script>`
- Privacy badges visible on the landing view: "No server", "No data stored", "No AI", "Open source"
- Link to privacy policy in footer

### js/auth.js

Token stored in module-scoped closure. Never on `window`, never in `localStorage`, never in cookies.

```javascript
let _accessToken = null;
let _tokenExpiry = 0;
let _tokenClient = null;

export function initAuth(clientId) {
  _tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: 'https://www.googleapis.com/auth/gmail.modify',
    callback: handleTokenResponse,
    error_callback: handleTokenError,
  });
}

// requestAuth() must be called from a user gesture (click handler)
export function requestAuth() {
  _tokenClient.requestAccessToken({ prompt: 'consent' });
}

function handleTokenResponse(response) {
  if (response.error) { /* dispatch auth:error event */ return; }
  _accessToken = response.access_token;
  _tokenExpiry = Date.now() + (response.expires_in * 1000);
  // Verify scope was granted
  if (!google.accounts.oauth2.hasGrantedAllScopes(response,
      'https://www.googleapis.com/auth/gmail.modify')) {
    // Dispatch auth:scope_denied event -- UI explains why gmail.modify is needed
    return;
  }
  document.dispatchEvent(new CustomEvent('auth:connected'));
}

export function getToken() {
  if (!_accessToken || Date.now() > _tokenExpiry) return null;
  return _accessToken;
}

export function isAuthenticated() {
  return _accessToken !== null && Date.now() < _tokenExpiry;
}

export function revokeAuth() {
  if (_accessToken) {
    google.accounts.oauth2.revoke(_accessToken);
    _accessToken = null;
    _tokenExpiry = 0;
  }
}
```

### js/gmail.js

Direct REST calls via `fetch()`. All calls go through a single `gmailFetch()` wrapper that handles auth headers, rate limiting (429 retry with exponential backoff), and error wrapping.

```javascript
const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

async function gmailFetch(path, options = {}) {
  const token = getToken();
  if (!token) throw new AuthExpiredError('Session expired. Please reconnect.');
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '5', 10);
    await sleep(retryAfter * 1000);
    return gmailFetch(path, options); // single retry
  }
  if (!res.ok) throw new GmailError(res.status, await res.text());
  return res.json();
}
```

**Key functions:**

- `listAllMessageIds(query, maxResults)` -- paginate `messages.list`, return array of IDs
- `fetchMessageMetadata(messageIds, onProgress)` -- parallel batches of 20, request `format=metadata` with `metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=List-Unsubscribe`
- `batchArchive(messageIds)` -- `batchModify` with `removeLabelIds: ['INBOX']`, chunks of 1000
- `batchAddLabel(messageIds, labelId)` -- `batchModify` with `addLabelIds: [labelId], removeLabelIds: ['INBOX']`, chunks of 1000
- `ensureLabels(labelNames)` -- list existing labels, create missing ones, return name-to-ID map
- `getProfile()` -- fetch user email address for display

### js/scanner.js

Orchestrates the scan flow:

1. Call `listAllMessageIds('in:inbox', 2000)` -- get message IDs
2. Call `fetchMessageMetadata(ids, onProgress)` -- get headers for each message
3. Parse each message into normalised format: `{ id, sender, senderEmail, senderDomain, subject, hasUnsubscribe, date }`
4. Pass normalised array to classifier
5. Dispatch `scan:complete` event with results

**Token expiry check:** Before each batch of metadata fetches, check `isAuthenticated()`. If expired, pause scan, dispatch `auth:expired` event (UI prompts re-auth), resume from last position after re-auth.

### js/classifier.js

```javascript
export function classifyMessages(messages) {
  const senderMap = new Map(); // senderEmail -> { messages, suggestedCategory, ... }

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
      });
    }
    senderMap.get(key).messages.push(msg);
  }

  // Classify each sender group (priority order)
  for (const [email, group] of senderMap) {
    if (isNoreply(email)) {
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
```

### js/ui.js

**CRITICAL RULE: Never use `innerHTML` with any data derived from email content.** All dynamic content rendered via `textContent`, `createElement`, and `appendChild`. This prevents XSS from malicious email subject lines.

```javascript
export function renderSenderTable(senderGroups, container) {
  container.replaceChildren(); // Clear safely

  const table = document.createElement('table');
  table.setAttribute('role', 'grid');

  // Header row
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  for (const label of ['Emails', 'Sender', 'Category']) {
    const th = document.createElement('th');
    th.textContent = label;
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Data rows
  const tbody = document.createElement('tbody');
  for (const group of senderGroups) {
    const row = document.createElement('tr');

    const countCell = document.createElement('td');
    countCell.textContent = group.messages.length;

    const senderCell = document.createElement('td');
    senderCell.textContent = group.senderName || group.senderEmail;

    const categoryCell = document.createElement('td');
    categoryCell.appendChild(createCategorySelect(group));

    row.append(countCell, senderCell, categoryCell);
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

function createCategorySelect(group) {
  const select = document.createElement('select');
  const options = [
    { value: 'human', label: 'Keep in Inbox' },
    { value: 'archive', label: 'Archive All' },
    { value: 'newsletters', label: 'Label: Newsletters' },
    { value: 'receipts', label: 'Label: Receipts' },
    { value: 'fyi', label: 'Label: FYI' },
  ];
  for (const opt of options) {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    if (opt.value === group.assignedCategory || opt.value === group.suggestedCategory) {
      option.selected = true;
    }
    select.appendChild(option);
  }
  select.addEventListener('change', () => {
    group.assignedCategory = select.value;
  });
  return select;
}
```

### js/actions.js

Executes the user-approved plan. Uses `batchModify` for efficiency (up to 1000 messages per call).

```javascript
export async function executeActions(senderGroups, onProgress) {
  // Phase 1: Ensure labels exist
  const labelMap = await ensureLabels(['Newsletters', 'Receipts', 'FYI']);

  // Phase 2: Group message IDs by action
  const actions = { archive: [], newsletters: [], receipts: [], fyi: [] };
  for (const group of senderGroups) {
    const category = group.assignedCategory || group.suggestedCategory;
    const ids = group.messages.map(m => m.id);
    if (category === 'archive' || category === 'notifications' || category === 'social') {
      actions.archive.push(...ids);
    } else if (category === 'newsletters') {
      actions.newsletters.push(...ids);
    } else if (category === 'receipts') {
      actions.receipts.push(...ids);
    } else if (category === 'fyi') {
      actions.fyi.push(...ids);
    }
    // 'human' = no action
  }

  // Phase 3: Execute
  let completed = 0;
  const total = Object.values(actions).reduce((sum, ids) => sum + ids.length, 0);

  if (actions.archive.length) {
    await batchArchive(actions.archive);
    completed += actions.archive.length;
    onProgress(completed, total);
  }
  for (const [category, ids] of Object.entries(actions)) {
    if (category === 'archive' || !ids.length) continue;
    await batchAddLabel(ids, labelMap[category.charAt(0).toUpperCase() + category.slice(1)]);
    completed += ids.length;
    onProgress(completed, total);
  }

  return {
    archived: actions.archive.length,
    newsletters: actions.newsletters.length,
    receipts: actions.receipts.length,
    fyi: actions.fyi.length,
    kept: senderGroups.reduce((sum, g) => {
      const cat = g.assignedCategory || g.suggestedCategory;
      return sum + (cat === 'human' ? g.messages.length : 0);
    }, 0),
  };
}
```

### js/preferences.js

Stores sender-to-category mappings in localStorage. Never stores tokens, email content, subject lines, or metadata.

```javascript
const STORAGE_KEY = 'inbox-sort-tidy-prefs';

export function loadPreferences() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}

export function savePreferences(prefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function clearPreferences() {
  localStorage.removeItem(STORAGE_KEY);
}

// Structure: { "sender@example.com": "archive", "news@co.com": "newsletters" }
```

On scan results, apply saved preferences as overrides to the classifier's suggestions. On any user category change, save immediately.

### js/security.js

Belt-and-suspenders sanitisation (the primary defence is `textContent`, this is the backup).

```javascript
export function sanitise(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>&"']/g, c => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export function requireAuth(fn) {
  return (...args) => {
    if (!isAuthenticated()) {
      throw new Error('Session expired. Please reconnect Gmail.');
    }
    return fn(...args);
  };
}
```

### js/app.js

Entry point. Initialises auth, wires up event listeners, manages state transitions.

```javascript
import { initAuth, requestAuth, revokeAuth, isAuthenticated } from './auth.js';
import { scanInbox } from './scanner.js';
import { classifyMessages } from './classifier.js';
import { renderSenderTable, renderPreview, renderResults, renderProgress } from './ui.js';
import { executeActions } from './actions.js';
import { loadPreferences, savePreferences } from './preferences.js';

const CLIENT_ID = ''; // Set during GCP project setup

const views = {
  connect: document.getElementById('view-connect'),
  scanning: document.getElementById('view-scanning'),
  results: document.getElementById('view-results'),
  preview: document.getElementById('view-preview'),
  executing: document.getElementById('view-executing'),
  done: document.getElementById('view-done'),
};

let currentState = 'DISCONNECTED';
let senderGroups = [];

function showView(name) {
  for (const [key, el] of Object.entries(views)) {
    el.hidden = key !== name;
  }
}

// State transitions
// DISCONNECTED: show connect view
// CONNECTED: show "Scan Inbox" button
// SCANNING: show progress bar
// REVIEWING: show sender table with category dropdowns
// PREVIEWING: show summary of planned actions
// EXECUTING: show execution progress
// DONE: show results summary
```

### _headers (Cloudflare Pages)

```
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains
```

### .github/workflows/deploy.yml (GitHub Pages)

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - uses: actions/deploy-pages@v4
        id: deployment
```

No build step. The repo root is the deployable artifact.

## UX Flow

| Step | State | What User Sees | What Happens |
|------|-------|----------------|-------------|
| 1 | DISCONNECTED | Hero section, "Connect Gmail" button, privacy badges ("No server", "No data stored", "No AI", "Open source"), link to privacy policy | GIS library loads async |
| 2 | CONNECTING | Google popup (handled by GIS) | User selects account, grants consent |
| 3 | CONNECTED | "Connected as user@gmail.com" banner, "Scan Inbox" button | Token in memory |
| 4 | SCANNING | Progress bar: "Scanning... 342 / 2000 messages" | messages.list pagination, then parallel messages.get for metadata |
| 5 | CLASSIFYING | Brief "Analysing patterns..." (sub-second) | classifyMessages() runs synchronously |
| 6 | REVIEWING | Sender frequency table: count, sender name, category dropdown. "Apply All Suggestions" button. "Preview Changes" button. | User reviews/overrides categories |
| 7 | PREVIEWING | Summary card: "Archive 847 from 23 senders. Label 156 as Newsletters. Keep 312." Two buttons: "Execute" and "Go Back". | Dry-run calculation, no API calls |
| 8 | EXECUTING | Progress bar: "Tidying... 450 / 1045 processed" | batchModify calls |
| 9 | DONE | Results: "Archived 847. Labelled 156 as Newsletters. Labelled 42 as Receipts. Kept 312." Buttons: "Disconnect" and "Scan Again". | Token still valid for remainder of hour |

**Error states:**
- Token expired mid-scan: pause, show re-auth prompt, resume from last position
- Rate limited (429): automatic retry with backoff, user sees "Slowing down -- Gmail rate limit reached"
- Network error: retry with exponential backoff, fail after 3 attempts with user message
- User denied scope: explain why gmail.modify is needed, offer retry
- GIS library failed to load: "Could not load Google authentication. Check ad blockers."

## Security Architecture

### Content Security Policy (meta tag in index.html)

```
default-src 'self';
script-src 'self' https://accounts.google.com/gsi/client;
style-src 'self';
connect-src https://gmail.googleapis.com https://www.googleapis.com https://accounts.google.com;
frame-src https://accounts.google.com;
img-src 'self' data:;
```

### Security Controls

| Control | Where | Implementation |
|---------|-------|---------------|
| XSS prevention | ui.js | `textContent` only, never `innerHTML` for email data |
| CSP | index.html | Meta tag restricting scripts, styles, connections |
| Token isolation | auth.js | Module-scoped closure, never on window/localStorage/cookies |
| Token expiry check | auth.js | Checked before every API call via getToken() |
| No eval/document.write | All files | Code review + CSP blocks eval |
| Input sanitisation | security.js | Belt-and-suspenders sanitise function |
| No third-party scripts | index.html | Only GIS from accounts.google.com |
| No analytics/tracking | Entire app | No GA, no pixels, no beacons, no third-party requests |
| Rate limit handling | gmail.js | Exponential backoff on 429 |
| Scope minimisation | auth.js | Single scope: gmail.modify |
| No deletion capability | actions.js | Only removeLabelIds and addLabelIds, never trash or delete |
| No email bodies | scanner.js | format=metadata only, never format=full or format=raw |
| Error handling | gmail.js | Custom error classes, never expose raw API errors to DOM |

### What This App Cannot Do (By Design)

- Cannot read email bodies (only requests metadata format)
- Cannot delete emails (batchModify only supports label changes)
- Cannot send emails (gmail.modify does not include send)
- Cannot access contacts, calendar, or any non-Gmail data
- Cannot store data server-side (no server exists)
- Cannot phone home (CSP blocks all non-Google connections)

## Quality Standards

- AU/UK spelling in all user-facing text
- No emoji in UI or output
- No corporate jargon
- Accessible: semantic HTML, ARIA labels, keyboard navigable
- Mobile responsive (Pico CSS handles most of this)
- Works in all modern browsers (Chrome, Firefox, Safari, Edge)
- No console.log in production (wrap in DEBUG flag)

## Testing

### Unit Tests (no auth needed)
Test classifier, preferences, and security modules with a simple test harness (inline HTML page that imports modules and runs assertions).

- `classifier.js`: Feed known message arrays, assert correct categorisation
- `preferences.js`: Test localStorage round-trip, clear, edge cases
- `security.js`: Test sanitise with XSS payloads (`<script>`, `<img onerror=`, event handlers)

### Integration Tests (mock Gmail responses)
Create `js/test/mock-gmail.js` that intercepts `fetch()` calls to `gmail.googleapis.com` and returns canned JSON. Test full scan-classify-preview flow without real API calls.

### Manual E2E Testing
- Use a dedicated test Gmail account with known email patterns
- Full flow: connect, scan, review, preview, execute
- Verify: emails archived, labels created, no data in DevTools localStorage/sessionStorage beyond preferences

### Security Verification Checklist
- [ ] CSP blocks inline scripts (attempt injection via DevTools)
- [ ] Token not visible in `window`, `localStorage`, `sessionStorage`, `document.cookie`
- [ ] No network calls to domains other than `googleapis.com` and `accounts.google.com`
- [ ] Subject lines not present in any persisted storage
- [ ] Error messages do not expose raw API responses or email content

## Performance Budget

| Operation | Expected Time | API Calls | Quota Cost |
|-----------|--------------|-----------|------------|
| List 2000 message IDs | ~2s (4 pages) | 4 | 20 units |
| Fetch 2000 metadata | ~40s (100 batches of 20) | 2000 | 10,000 units |
| Classification | <100ms (synchronous) | 0 | 0 |
| Execute (2000 msgs) | ~2s (2 batchModify calls) | 2 | 100 units |
| **Total** | **~45s** | **~2006** | **~10,120 units** |

**Future optimisation:** Gmail HTTP batch endpoint (`POST /batch/gmail/v1`) can send up to 100 `messages.get` calls in a single HTTP request, reducing 2000 round-trips to 20 and cutting scan time from ~40s to ~4s. Adds multipart/mixed parsing complexity -- save for v2.

## Google OAuth Verification

### Testing Mode (immediate, up to 100 users)
1. Set OAuth consent screen publishing status to "Testing"
2. Add test users by email (up to 100 lifetime)
3. Users see "unverified app" warning but can click through
4. Token grants expire after 7 days in testing mode

### Production Verification (2-6 weeks)
1. Prepare privacy policy (privacy-policy.html in this repo)
2. Record demo video showing the app's functionality
3. Submit for restricted scope verification via GCP Console
4. Google reviews Limited Use compliance, privacy policy, and demo
5. No CASA audit required (client-side only)

## Build Order

Build files in this order. Each must work before starting the next.

1. index.html + css/ -- static shell with all views, Pico CSS
2. js/auth.js -- GIS integration, test with real Google consent
3. js/gmail.js -- API client, test with real Gmail data
4. js/scanner.js -- scan orchestrator, test with real inbox
5. js/classifier.js -- pattern matching, test with scan results
6. js/ui.js -- render sender table, wire up category dropdowns
7. js/actions.js -- execute archive/label, test with real emails
8. js/preferences.js -- localStorage persistence
9. js/security.js -- sanitisation helpers
10. js/app.js -- wire everything together, state machine
11. privacy-policy.html + terms.html
12. _headers + deploy workflow
13. End-to-end test with real Gmail account

## Environment Variables

There is only one configuration value: the Google OAuth Client ID. It is set directly in `js/app.js` (or loaded from a `config.js` file). It is not secret -- OAuth Client IDs for web apps are public by design (they are visible in the browser's network requests).

```javascript
const CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
```
