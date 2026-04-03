# Risk Assessment -- Inbox Sort and Tidy

## Methodology

Each risk assessed from inherent (before controls) to residual (after controls). Likelihood and impact rated LOW / MEDIUM / HIGH / CRITICAL. Residual risks rated after all mitigations applied. Risks requiring acceptance are explicitly flagged.

## Risk Register

### R1: XSS via email subject lines

| | |
|---|---|
| **Description** | Malicious email subject lines (e.g. `<script>alert(1)</script>`) rendered in the browser could execute arbitrary JavaScript. An attacker who sends a crafted email to the user could exploit this. |
| **Inherent** | HIGH likelihood, CRITICAL impact |
| **Mitigation** | All email data rendered via `textContent` only, never `innerHTML`. CSP meta tag blocks inline scripts and eval. Belt-and-suspenders sanitise function in security.js. |
| **Residual** | NEGLIGIBLE likelihood, CRITICAL impact |
| **Status** | Mitigated |

### R2: OAuth token theft

| | |
|---|---|
| **Description** | Access token stolen from browser memory via XSS, malicious extension, or physical access to DevTools. |
| **Inherent** | MEDIUM likelihood, HIGH impact |
| **Mitigation** | Token in module-scoped JS closure (not window/localStorage/cookies). CSP blocks third-party scripts. Token auto-expires at 1 hour. No refresh tokens. XSS prevention (R1) is the primary defence. |
| **Residual** | LOW likelihood, HIGH impact |
| **Status** | Mitigated |

### R3: Gmail API rate limiting

| | |
|---|---|
| **Description** | Excessive API calls trigger 429 errors, degrading user experience or blocking scan completion. |
| **Inherent** | MEDIUM likelihood, LOW impact |
| **Mitigation** | Parallel batches of 20 with 200ms delay. Exponential backoff on 429. User-visible "Slowing down" message. Cap at 2000 messages per scan. |
| **Residual** | LOW likelihood, LOW impact |
| **Status** | Mitigated |

### R4: User accidentally archives important emails

| | |
|---|---|
| **Description** | Classifier miscategorises a sender, user accepts suggestion without reviewing, important emails archived. |
| **Inherent** | MEDIUM likelihood, MEDIUM impact |
| **Mitigation** | Default safe bucket is "Keep in Inbox" (human category). Mandatory preview step before execution showing exact counts. Archive is reversible (emails move to All Mail, not deleted). |
| **Residual** | LOW likelihood, LOW impact |
| **Status** | Mitigated |

### R5: Google rejects restricted scope verification

| | |
|---|---|
| **Description** | Google denies verification for gmail.modify scope, blocking public launch beyond 100 test users. |
| **Inherent** | MEDIUM likelihood, HIGH impact |
| **Mitigation** | Testing mode supports 100 named users immediately. Thorough privacy policy and demo video prepared before submission. Client-side architecture simplifies the review (no server-side data handling to scrutinise). |
| **Residual** | LOW likelihood, MEDIUM impact |
| **Status** | Mitigated (accept delay risk) |

### R6: CASA audit required despite client-side architecture

| | |
|---|---|
| **Description** | Google determines that a CASA security assessment is required, costing $4,500-$75,000. |
| **Inherent** | LOW likelihood, HIGH impact |
| **Mitigation** | Google documentation states CASA is only for apps accessing data through a third-party server. Client-side apps are exempt. If required anyway, this is a go/no-go commercial decision. |
| **Residual** | LOW likelihood, HIGH impact |
| **Status** | Accepted (commercial decision if triggered) |

### R7: Token expires mid-scan

| | |
|---|---|
| **Description** | Access token expires during the 40-second metadata fetch, causing partial scan failure. |
| **Inherent** | MEDIUM likelihood, LOW impact |
| **Mitigation** | Check `isAuthenticated()` before each batch. If expired, pause scan, prompt re-auth, resume from last position. Scan progress is not lost. |
| **Residual** | LOW likelihood, NEGLIGIBLE impact |
| **Status** | Mitigated |

### R8: Browser-side data exposure (DevTools)

| | |
|---|---|
| **Description** | Anyone with physical access to the browser (or a malicious extension) can see email metadata in the Network tab, DOM, or JS memory. |
| **Inherent** | LOW likelihood, MEDIUM impact |
| **Mitigation** | Inherent to any web application. Disclosed in privacy policy. Session data cleared when tab closes. No persistence of email metadata. |
| **Residual** | LOW likelihood, MEDIUM impact |
| **Status** | Accepted (inherent to web apps, disclosed) |

### R9: localStorage reveals sender patterns

| | |
|---|---|
| **Description** | Saved preferences map sender email addresses to categories. Someone with browser access could infer business relationships. |
| **Inherent** | LOW likelihood, LOW impact |
| **Mitigation** | Only sender-to-category mappings stored (e.g. "news@co.com": "newsletters"). No email content, subjects, or counts. Users can clear preferences via the app. Disclosed in privacy policy. |
| **Residual** | LOW likelihood, LOW impact |
| **Status** | Accepted (minimal data, user-controlled) |

### R10: GIS library fails to load

| | |
|---|---|
| **Description** | Ad blockers or corporate firewalls block accounts.google.com/gsi/client, making the app unusable. |
| **Inherent** | LOW likelihood, HIGH impact |
| **Mitigation** | Fallback message: "Could not load Google authentication. Check ad blockers or firewall settings." App degrades gracefully to an informational page. |
| **Residual** | LOW likelihood, MEDIUM impact |
| **Status** | Mitigated |

### R11: Gmail API scope is broader than needed

| | |
|---|---|
| **Description** | gmail.modify allows more than archive and label (e.g. mark as spam, mark as read). A compromised app or XSS exploit could abuse the full scope. |
| **Inherent** | LOW likelihood, MEDIUM impact |
| **Mitigation** | gmail.modify is the minimum viable scope (no narrower option for archive). CSP and XSS prevention (R1, R2) protect against scope abuse. App code only calls batchModify with removeLabelIds and addLabelIds. Code is open source and auditable. |
| **Residual** | LOW likelihood, MEDIUM impact |
| **Status** | Accepted (minimum viable scope, no alternative) |

### R12: No audit trail for actions taken

| | |
|---|---|
| **Description** | If the app miscategorises or moves emails incorrectly, there is no record of what was moved where. |
| **Inherent** | MEDIUM likelihood, LOW impact |
| **Mitigation** | Show a results summary after execution with exact counts per category. Archive is reversible (emails in All Mail). Consider adding CSV export of actions taken (sender, count, action) for user records. |
| **Residual** | LOW likelihood, LOW impact |
| **Status** | Mitigated |

### R13: Minors using the app

| | |
|---|---|
| **Description** | Users under 18 connecting their Gmail, creating potential children's privacy obligations (COPPA, Australian Privacy Act). |
| **Inherent** | LOW likelihood, MEDIUM impact |
| **Mitigation** | Terms of service restrict use to 18+. No age verification mechanism (industry standard for free tools). Zero data retention means no children's data is stored. |
| **Residual** | LOW likelihood, LOW impact |
| **Status** | Accepted (ToS restriction, industry standard) |

### R14: Supply chain compromise (Pico CSS)

| | |
|---|---|
| **Description** | Malicious code injected into Pico CSS if fetched from CDN. |
| **Inherent** | LOW likelihood, HIGH impact |
| **Mitigation** | Pico CSS is self-hosted (committed to repo), not loaded from CDN. CSP blocks external style sources. Version pinned. |
| **Residual** | NEGLIGIBLE likelihood, HIGH impact |
| **Status** | Mitigated |

### R15: Orphaned tokens on decommission

| | |
|---|---|
| **Description** | If the app is shut down, users' OAuth grants remain active in their Google account until manually revoked. |
| **Inherent** | MEDIUM likelihood, LOW impact |
| **Mitigation** | Privacy policy includes decommission procedure: 30 days notice, email notification, guidance to revoke at myaccount.google.com/permissions. App's "Disconnect" button calls `google.accounts.oauth2.revoke()`. |
| **Residual** | LOW likelihood, LOW impact |
| **Status** | Mitigated |

### R16: Error messages leak email content

| | |
|---|---|
| **Description** | Unhandled JavaScript exceptions could include email metadata (subject lines, sender addresses) in error messages visible in the console or error reporting. |
| **Inherent** | MEDIUM likelihood, LOW impact |
| **Mitigation** | Custom error classes (GmailError, AuthExpiredError) that never include email content. No console.log in production. No third-party error reporting service. Errors displayed to user via generic messages only. |
| **Residual** | LOW likelihood, NEGLIGIBLE impact |
| **Status** | Mitigated |

### R17: Cross-site request forgery on Google consent

| | |
|---|---|
| **Description** | Attacker tricks user into granting OAuth consent to a malicious app impersonating this one. |
| **Inherent** | LOW likelihood, HIGH impact |
| **Mitigation** | GIS Token Model uses popup-based consent with origin validation (Google verifies the requesting origin matches the registered JavaScript origin). No redirect-based flow to intercept. |
| **Residual** | NEGLIGIBLE likelihood, HIGH impact |
| **Status** | Mitigated |

## Summary

| Rating | Count | Risk IDs |
|--------|-------|----------|
| Mitigated to LOW/NEGLIGIBLE | 11 | R1, R3, R4, R7, R10, R12, R14, R15, R16, R17, R13 |
| Accepted (LOW residual) | 4 | R8, R9, R11, R13 |
| Accepted (commercial decision) | 1 | R6 |
| Accepted (process dependency) | 1 | R5 |
| **CRITICAL or HIGH residual** | **0** | -- |

Zero critical or high residual risks. Six risks explicitly accepted with documented rationale.
