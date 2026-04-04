# Build Prompts -- Inbox Sort and Tidy

## Full Build Prompt (for Claude Code in the new repo)

Use this when starting from scratch. Claude Code reads CLAUDE.md automatically, so this prompt just kicks off the build.

```
Build this project following the CLAUDE.md spec. Start from the build order in that file:

1. Create index.html with all view sections, CSP meta tag, and Pico CSS
2. Create js/auth.js with GIS Token Model integration
3. Create js/gmail.js with the Gmail REST API client
4. Create js/scanner.js for inbox scanning with progress
5. Create js/classifier.js with the deterministic pattern matching engine
6. Create js/ui.js with XSS-safe DOM rendering (textContent only, never innerHTML)
7. Create js/actions.js for archive/label execution
8. Create js/preferences.js for localStorage persistence
9. Create js/security.js for input sanitisation
10. Create js/app.js to wire everything together with the state machine
11. Create css/app.css for custom styles
12. Copy privacy-policy.html and create terms.html
13. Create _headers for Cloudflare Pages security headers
14. Create .github/workflows/deploy.yml for GitHub Pages

Download Pico CSS v2.1.1 and save as css/pico.min.css (self-hosted, not CDN).

Security rules (non-negotiable):
- textContent only for email data, never innerHTML
- Token in module-scoped closure only
- CSP meta tag as specified in CLAUDE.md
- No eval, no document.write
- No analytics, no tracking
- No console.log in production code

Test each module as you build it. After completion, walk through the full UX flow
described in CLAUDE.md and verify every state transition works.
```

## Short Prompt (for resuming or incremental work)

```
Continue building the Inbox Sort and Tidy following CLAUDE.md. Check what's already
built, pick up where it left off, and complete the next item in the build order.
```

## Test Prompt (after build is complete)

```
Run the security verification checklist from CLAUDE.md:
1. Verify CSP blocks inline scripts
2. Verify token is not in window, localStorage, sessionStorage, or cookies
3. Verify no network calls to non-Google domains
4. Verify subject lines are not in any persisted storage
5. Verify all email data rendered via textContent, never innerHTML
6. Test the classifier with edge cases (empty subjects, unicode senders, XSS payloads)
7. Test error handling: expired token, rate limit, network failure
8. Walk through the full UX flow end-to-end
```
