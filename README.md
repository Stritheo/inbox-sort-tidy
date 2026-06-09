# Inbox Sort and Tidy

A free, self-hosted tool to sort and tidy your Gmail inbox. Scan, categorise, and archive in bulk -- no AI, no cost, no data stored.

> **You run your own copy.** This is open-source code you deploy yourself, not a hosted service. To use it you create your own free Google credentials and deploy the files -- about ten minutes. See [Setup](#setup-run-your-own-copy).

## How it works

1. **Connect** your Gmail account (one click, Google sign-in)
2. **Scan** your inbox -- the app reads message headers (never email bodies)
3. **Review** a sender frequency table showing who sends you the most email
4. **Categorise** each sender: keep, archive, label as newsletters/receipts/FYI
5. **Preview** exactly what will happen before anything changes
6. **Tidy** -- the app archives and labels emails in bulk

## Setup (run your own copy)

This app talks directly to Gmail from your browser, so it needs its own Google OAuth Client ID. Creating one is free.

1. Create a project in [Google Cloud Console](https://console.cloud.google.com).
2. Enable the **Gmail API** under **APIs & Services -> Library**.
3. Go to **APIs & Services -> Credentials -> Create credentials -> OAuth 2.0 Client ID**.
   - Application type: **Web application**
   - Authorised JavaScript origins: the domain you will deploy to (e.g. `https://yourusername.github.io`)
4. Open `js/app.js` and replace the `CLIENT_ID` value with your own. The ID shipped in this repo is the author's and only works on the author's domain -- your deployment will not connect until you set your own.
5. Configure the consent screen under **APIs & Services -> OAuth consent screen**. For personal or small-group use, "Testing" mode (up to 100 users you add by email) needs no Google review. To open it to the public, publish the app and complete Google's restricted-scope verification.
6. Deploy the files. The repo root is the deployable artifact -- any static host works (GitHub Pages, Cloudflare Pages, Netlify). No build step.

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

## Support

None. This is provided free and as-is, with no support, no warranty, and no way to contact the author for help. If it does not work, re-check the Setup steps and your Google Cloud configuration. You are welcome to fork it and adapt it under the licence.

## Technical details

- Vanilla JavaScript (no frameworks, no build step)
- Google Identity Services for authentication
- Gmail REST API called directly from the browser
- Pico CSS for styling (self-hosted)
- Deployable to any static host (GitHub Pages, Cloudflare Pages, Netlify)

## Scope

The app requests `gmail.modify` permission, which is the minimum scope required to archive emails (remove the INBOX label). This is a restricted scope. The app cannot delete emails, send emails, or access any data outside Gmail.

## Licence

MIT
