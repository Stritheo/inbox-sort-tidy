# Inbox Sort and Tidy -- Brand Style Guide

## Design Philosophy

Three principles guide every design decision:

1. **Apple's simplicity** -- One action per screen. No clutter. The interface explains itself.
2. **Tom Ford's restraint** -- One accent colour. Considered typography. Every element earns its place.
3. **Nintendo's self-guided engagement** -- Remove the fear of mistakes. Reward completion. Make the user want to proceed.

---

## Colour

### Primary palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--accent` | `#2563eb` | Buttons, focus rings, interactive elements. The only brand colour. |
| `--accent-hover` | `#1d4ed8` | Hover state for accent elements |
| `--accent-light` | `#dbeafe` | Focus shadows, subtle highlights |

### Neutrals

| Token | Hex | Usage |
|-------|-----|-------|
| `--text` | `#111827` | Headings, primary text, bold numbers |
| `--text-secondary` | `#4b5563` | Body copy, descriptions |
| `--text-tertiary` | `#6b7280` | Hints, labels, de-emphasised text |
| `--bg` | `#fafafa` | Page background |
| `--surface` | `#ffffff` | Cards, inputs, elevated surfaces |
| `--border` | `#e5e7eb` | Card borders, dividers |
| `--border-light` | `#f3f4f6` | Table row separators, subtle lines |

### Semantic

| Token | Hex | Usage |
|-------|-----|-------|
| `--success` | `#047857` | "Tidy My Inbox" button, connected banner, check circle |
| `--success-light` | `#ecfdf5` | Connected banner background, check circle background |
| `--error-bg` | `#fef2f2` | Error alert background |
| `--error-text` | `#991b1b` | Error alert text |

### Rules

- **Never introduce a new colour.** If something needs emphasis, use `--accent`. If it needs to recede, use a neutral.
- **Green is reserved for the primary action** ("Tidy My Inbox") and success states. Do not use green for secondary actions.

---

## Typography

### Font stack

```
font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif;
```

Use the system font. No web fonts. This matches the device the user is already on.

### Type scale (4 sizes only — no exceptions)

| Token | Size | Use for | Weight | Tracking |
|-------|------|---------|--------|----------|
| `--text-xl` | 1.75rem (28px) | h1 page title, preview headline | 700-800 | -0.03em |
| `--text-lg` | 1.25rem (20px) | h2 section headings | 700 | -0.02em |
| `--text-base` | 0.9375rem (15px) | Body, subtitle, buttons, trust copy, table data, progress labels | 400-500 | normal |
| `--text-sm` | 0.8125rem (13px) | Captions, hints, footer, labels, compact buttons, config | 400-600 | normal or 0.04-0.06em (uppercase only) |

**There are exactly 4 font sizes in the entire application.** Adding a fifth requires a design review.

### Line height (3 values only)

| Token | Value | Use for |
|-------|-------|---------|
| `--leading-tight` | 1.2 | Headings (h1, h2, h3) |
| `--leading-normal` | 1.5 | Body text, buttons, labels, table cells |
| `--leading-relaxed` | 1.6 | Subtitle, long-form descriptions |

**Every `line-height` declaration must use one of these three tokens.** No raw numbers.

### Spacing between text elements

| Context | Margin | Rule |
|---------|--------|------|
| After h1 | 0.75rem | Gives room before subtitle |
| After h2 | 0.375rem | Tight — h2 and its description are a unit |
| Between body paragraphs | 0.125rem | Stacked trust lines read as a single block |
| Between sections | 1.5-2.5rem | Breathing room between distinct areas |
| After description before content | 1.5rem | e.g. after card description, before table |

### Rules

- **Headings use tight tracking** (-0.02em to -0.03em). This is what makes them feel considered.
- **Small labels are uppercase** with wide tracking. This separates them from content text.
- **Body text is never smaller than 0.8rem.** Anything smaller becomes illegible on mobile.
- **Bold numbers** (email counts, summary card numbers) use `font-weight: 700-800` and `font-variant-numeric: tabular-nums` so columns align.

---

## Spacing

### Tokens

| Name | Value | Usage |
|------|-------|-------|
| `--radius` | 12px | Cards, brand icon, large buttons |
| `--radius-sm` | 8px | Inputs, small buttons, table header corners |
| `--radius-full` | 9999px | Connect button pill shape |

### Rules

- **Container max-width: 640px.** The app is a single column. Wider than this and lines become too long.
- **Card padding: 2rem** (desktop), **1.25rem** (mobile). Generous breathing room.
- **Between sections: 1.5-2.5rem.** Never less than 1rem between distinct elements.
- **Button groups: 0.75rem gap.** Tight enough to feel related, loose enough to tap separately.

---

## Elevation

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-xs` | `0 1px 2px rgba(0,0,0,0.04)` | Buttons at rest |
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.08)` | Cards, buttons on hover |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.08)` | Brand icon |

### Rules

- **Shadows are barely there.** The app uses borders (`--border`) as the primary elevation cue, with shadows only for emphasis.
- **Brand icon is the only element with `--shadow-md`.** It's the visual anchor of the page.

---

## Components

### Buttons

| Type | Background | Border | Use for |
|------|-----------|--------|---------|
| Primary | `--accent` | none | Main actions: "Preview Changes", "Scan Again" |
| Go | `--success` | none | The single commit action: "Tidy My Inbox" |
| Secondary | transparent | `--border` | Alternative actions: "Disconnect", "Go Back" |
| Ghost | transparent | `--border` | Inline de-emphasised actions: "Disconnect" in banner |
| Text | none | none | Understated escape: "or go back and adjust" |
| Undo | transparent | dashed `--border` | Reversal action: "Undo everything" |

### Rules

- **Only one green button per screen.** This is the "point of no return" indicator.
- **Hover lifts buttons 1px** (`translateY(-1px)`). Subtle, not bouncy.
- **All buttons have `:focus-visible` outlines** using `--accent` with 2px offset.
- **Dashed border on undo** signals "this is different, this goes backwards."

### Cards

- White background, `--border` border, `--shadow-sm` shadow, `--radius` corners.
- Cards wrap every view except the landing page (which uses the full page).
- Cards are the primary container — they say "you are in a step."

### Tables

- Minimal chrome. No row borders except `--border-light` separators.
- Header row: uppercase, small, `--text-tertiary`, `--bg` background.
- Hover row: `--accent-light` or very subtle highlight (optional).
- Numbers right-aligned, bold, tabular-nums.

### Progress bars

- 6px height. `--border-light` track. `--accent` fill.
- No gradient. Solid colour only.
- Smooth transition on value change (0.4s ease).

---

## Copy

### Voice

- **No "we."** The app is a tool, not a person. Say "This app" or use passive voice.
- **Non-technical.** No "server", "API", "OAuth", "metadata", "headers." Translate everything.
- **Short.** If a sentence can be cut, cut it. If a paragraph can be a sentence, make it one.
- **AU/UK spelling.** Labelled, categorised, colour, organise.

### Translation table

| Developer-speak | User-speak |
|----------------|------------|
| No server | Your data never leaves this device |
| No data stored | This app keeps no copy of anything |
| Email headers / metadata | Sender names and subject lines |
| gmail.modify scope | Permission to archive and label |
| batchModify | Tidy / archive / label |
| Token expired | Session expired. Please reconnect. |
| 429 rate limit | Slowing down to stay within Gmail's limits |

### Screen-specific guidelines

| Screen | Tone | Example |
|--------|------|---------|
| Connect | Inviting, trustworthy | "Group your Gmail by sender. Archive or label in bulk." |
| Scanning | Patient, reassuring | "Scanning... 342 / 2,000 emails" |
| Results | Empowering, clear | "Your inbox, sorted" |
| Preview | Calm, confident | Summary cards speak. Copy recedes. |
| Executing | Quiet, working | "Tidying... 450 / 1,045 processed" |
| Done | Celebrating, empowering | "Inbox tidied" |
| Undo | Reassuring, no judgement | "Everything is back to how it was." |

---

## Animation

### Allowed

| Animation | Where | Duration |
|-----------|-------|----------|
| Button lift on hover | All buttons | 0.15-0.2s ease |
| Brand icon scale + rotate on hover | Landing page | 0.3s spring |
| Progress bar fill | Scanning, executing | 0.4s ease |
| Check circle pop-in | Done screen | 0.4s spring |
| Scan icon pulse | Scanning screen | 2s ease-in-out, infinite |
| Details triangle rotation | Label config | 0.15s ease |

### Rules

- **All animations respect `prefers-reduced-motion: reduce`.** Disable transforms, set durations to 0.
- **No animation on page load** except the scan icon pulse (which signals "working").
- **Spring curves** (`cubic-bezier(0.34, 1.56, 0.64, 1)`) for celebratory moments only (check circle, brand icon hover).
- **Linear/ease for functional motion** (progress bars, button hovers).

---

## Accessibility

- **Contrast:** All text meets WCAG 2.1 AA (4.5:1 minimum). `--text-tertiary` is the lightest allowed text colour.
- **Focus:** All interactive elements have `:focus-visible` outlines (2px solid `--accent`, 2px offset).
- **Touch targets:** Minimum 36px height for all tappable elements, 44px for primary actions.
- **Screen readers:** `aria-label` on all buttons, `aria-live="polite"` on progress text, `role="alert"` on errors.
- **Motion:** `prefers-reduced-motion` media query disables all animations and transforms.
- **Skip link:** Hidden until focused, jumps to main content.

---

## File structure

```
css/app.css          -- All styles. Single file. No preprocessor.
index.html           -- All views. Single page. Semantic HTML.
js/ui.js             -- DOM rendering. textContent only. Never innerHTML.
```

No CSS framework. No icon library. SVGs are inline with explicit width/height attributes.

---

## What NOT to do

- Do not add a second accent colour.
- Do not use emoji in the UI.
- Do not add a dark mode (the soft grey background is the brand).
- Do not use innerHTML for any email-derived content.
- Do not add loading spinners -- use progress bars.
- Do not add tooltips -- write clearer copy instead.
- Do not add a hamburger menu or navigation bar.
- Do not add animations that play on page load.
- Do not use "we", "our", or "us" in any copy.
