# Setup Guide -- Inbox Sort and Tidy

## Prerequisites

- A GitHub account
- A Google Cloud Platform account (free tier is sufficient)
- A domain (optional -- Cloudflare Pages provides a free subdomain)

## Step 1: Create the GitHub Repository

```bash
gh repo create inbox-sort-tidy --public \
  --description "Free inbox sorting and tidying tool -- scan, categorise, and archive in bulk. No AI, no cost, no data stored." \
  --license MIT
```

Clone and copy the bootstrap files from this folder:

```bash
git clone git@github.com:YOUR_USERNAME/inbox-sort-tidy.git
cd inbox-sort-tidy
```

Copy these files into the new repo root:
- `CLAUDE.md` -- build spec (Claude Code reads this automatically)
- `README.md` -- project description
- `privacy-policy.html` -- Google OAuth requirement

```bash
git add -A
git commit -m "feat: bootstrap project with CLAUDE.md build spec"
git push -u origin main
```

## Step 2: Create a Google Cloud Project

1. Go to https://console.cloud.google.com/
2. Create a new project: "Inbox Sort and Tidy"
3. Enable the **Gmail API**:
   - APIs & Services > Library > search "Gmail API" > Enable

## Step 3: Configure OAuth Consent Screen

1. APIs & Services > OAuth consent screen
2. User type: **External**
3. Fill in:
   - App name: "Inbox Sort and Tidy"
   - User support email: your email
   - App logo: optional
   - App domain: your Cloudflare Pages / GitHub Pages URL
   - Authorised domains: add your domain
   - Developer contact email: your email
4. Scopes: Add `https://www.googleapis.com/auth/gmail.modify`
5. Test users: Add your email and any testers (up to 100)
6. Publishing status: Leave as **Testing** for now

## Step 4: Create OAuth Client ID

1. APIs & Services > Credentials > Create Credentials > OAuth client ID
2. Application type: **Web application**
3. Name: "Inbox Sort and Tidy Web"
4. Authorised JavaScript origins:
   - `http://localhost:8000` (for local development)
   - `https://your-domain.pages.dev` (Cloudflare Pages)
   - OR `https://YOUR_USERNAME.github.io` (GitHub Pages)
5. Authorised redirect URIs: leave empty (Token Model uses popup, not redirect)
6. Copy the Client ID -- you'll paste this into `js/app.js`

## Step 5: Build the App

Open the cloned repo in Claude Code:

```bash
cd inbox-sort-tidy
claude
```

Claude Code reads the CLAUDE.md automatically. Tell it:

> Build this project following the CLAUDE.md spec, starting from step 1.

Or use the short prompt from `build-prompt.md`.

## Step 6: Set the Client ID

After the app is built, edit `js/app.js` and set:

```javascript
const CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
```

## Step 7: Test Locally

Serve the files locally (any static server works):

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000` and test the full flow:
1. Click "Connect Gmail"
2. Sign in with a test user account
3. Scan inbox
4. Review sender table
5. Preview changes
6. Execute on a small batch first

## Step 8: Deploy

### Option A: Cloudflare Pages (recommended)

1. Log in to Cloudflare dashboard
2. Pages > Create a project > Connect to Git
3. Select the `inbox-sort-tidy` repository
4. Build settings:
   - Build command: (leave empty)
   - Build output directory: `/`
5. Deploy

Cloudflare Pages supports the `_headers` file for security headers (GitHub Pages does not).

### Option B: GitHub Pages

1. Repository Settings > Pages
2. Source: Deploy from a branch
3. Branch: `main`, folder: `/ (root)`
4. Save

The GitHub Actions workflow in `.github/workflows/deploy.yml` handles deployment.

### After deploying:

Update the OAuth Client ID's Authorised JavaScript Origins to include your production URL.

## Step 9: Google OAuth Verification (for public launch)

While in **Testing** mode, up to 100 named test users can use the app. They'll see an "unverified app" warning but can click through. Tokens expire after 7 days.

To remove the user cap and warning screen:

1. Go to GCP Console > APIs & Services > OAuth consent screen
2. Click "Publish App"
3. Submit for verification:
   - Provide the privacy policy URL (your deployed privacy-policy.html)
   - Record a demo video showing the app flow
   - Explain the use of gmail.modify scope
4. Wait for Google review (typically 2-6 weeks)
5. No CASA audit is required for client-side-only apps

## Step 10: Share

Once verified (or with up to 100 test users in Testing mode):

- Share the URL on LinkedIn
- The README explains what the tool does
- The privacy policy satisfies Google's requirements and user trust

## Troubleshooting

**"Could not load Google authentication"**
- Check if an ad blocker is blocking `accounts.google.com`
- Verify the GIS script tag is in `index.html`

**"Access blocked: This app's request is invalid" (Error 400)**
- The JavaScript origin in GCP Console doesn't match the URL you're accessing from
- Add `http://localhost:8000` for local dev, your production URL for deployed

**"This app isn't verified" warning**
- Expected in Testing mode. Click "Advanced" > "Go to Inbox Sort and Tidy (unsafe)"
- This warning goes away after Google verification (Step 9)

**Rate limit errors during scan**
- The app handles these automatically with retry
- If persistent, wait a few minutes and try again
- Gmail API per-user rate limits reset quickly
