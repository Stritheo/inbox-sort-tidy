# Inbox Sort and Tidy

A free tool to sort and tidy your Gmail inbox. Scan, categorise, and archive in bulk -- no AI, no cost, no data stored.

## How it works

1. **Connect** your Gmail account (one click, Google sign-in)
2. **Scan** your inbox -- the app reads message headers (never email bodies)
3. **Review** a sender frequency table showing who sends you the most email
4. **Categorise** each sender: keep, archive, label as newsletters/receipts/FYI
5. **Preview** exactly what will happen before anything changes
6. **Tidy** -- the app archives and labels emails in bulk

## Privacy

This app runs **entirely in your browser**. There is no server, no database, no backend. Your email data goes directly between your browser and Google's Gmail API -- it never touches a third-party server.

- No email bodies are ever read (metadata only: sender, subject, date)
- No data is stored anywhere except your browser's memory during the session
- No analytics, no tracking, no cookies
- No emails are ever deleted (archive and label only -- everything stays in All Mail)
- Open source and auditable

Read the full [privacy policy](privacy-policy.html).

## What it does NOT do

- Does not read email bodies
- Does not delete emails
- Does not send emails
- Does not use AI or language models
- Does not cost anything to use
- Does not store your data

## Technical details

- Vanilla JavaScript (no frameworks, no build step)
- Google Identity Services for authentication
- Gmail REST API called directly from the browser
- Pico CSS for styling (self-hosted)
- Hosted on Cloudflare Pages (free tier)

## Self-hosting or forking

The OAuth Client ID in `js/app.js` is scoped to this project's hosted domain. If you deploy a fork to your own domain, Google will reject the auth request because the origin will not match. You need your own Client ID.

## Steps to get one (free, ~10 minutes):

1. Create a project in [Google Cloud Console](https://console.cloud.google.com).
2. Enable the Gmail API under **APIs & Services -> Library**.
3. Go to **APIs & Services -> Credentials -> Create credentials -> OAuth 2.0 Client ID**.
   - Application type: **Web application**
   - Authorised JavaScript origins: your deployed domain (e.g. `https://yourusername.github.io`)
4. Copy the generated Client ID and replace the `CLIENT_ID` value in `js/app.js`.
5. Configure your OAuth consent screen (**Google Auth Platform -> Branding + Audience**). For personal or small-group use, "Testing" mode (up to 100 users) is sufficient without a Google review.

The full GCP setup walkthrough is in [`docs/setup-guide.md`](docs/setup-guide.md).

## Scope

The app requests `gmail.modify` permission, which is the minimum scope required to archive emails (remove the INBOX label). This is a restricted scope verified by Google. The app cannot delete emails, send emails, or access any data outside Gmail.

## Licence

MIT
