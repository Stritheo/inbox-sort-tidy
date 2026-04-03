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

## Scope

The app requests `gmail.modify` permission, which is the minimum scope required to archive emails (remove the INBOX label). This is a restricted scope verified by Google. The app cannot delete emails, send emails, or access any data outside Gmail.

## Licence

MIT
