# PhD Outreach dashboard

A one-page dashboard for tracking professor emails, replies and follow-ups. It works on desktop and phone.

- Professors grouped by wave, each with a status: Not sent, Waiting, Follow-up due, Followed up, New reply, Bounced, the reply type, or No reply (closed).
- Buttons for "Mark sent today", "Follow-up sent today", "Got a reply", "Handled" and "Resent today". There is also a reply-type menu, notes, and editable dates, email and Gmail thread ID.
- A **Do next** list: new replies and bounces, follow-ups due today, upcoming dates, and waves not yet sent.
- Optional read-only Gmail sync that fills in sends, follow-ups, replies and bounces for you.
- A password lock. All the data is one JSON document, kept in free Upstash Redis on Vercel or in a local file anywhere else.

## Rules

| Situation | What the dashboard does |
|---|---|
| Sent, no reply | A follow-up is due **12 days** after sending. Send one follow-up, in the same thread. |
| Followed up, no reply | The contact is closed **14 days** after the follow-up. |
| Interested | Reply within 24 h with a small first task and a call time. |
| Send more | Send what they asked for within 48 h. |
| No room, try X | Thank them, then email X and say who referred you. |
| Declined | Send a two-line thank-you and close it. |

After you've acted on a reply, press **Handled** to take it off the Do next list. The rules live in `lib/status.js`.

## Run it locally

```bash
npm install
npm run dev          # http://localhost:3000
```

## Data

`data/seed.json` holds the starting data and is tracked in git. On first run the app copies it into live storage, and every click writes there. Changing `seed.json` later does not touch the live data.

The app picks its storage automatically:

- **Upstash Redis** when `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set (Vercel sets them for you). The data is one JSON value under the key `outreach`.
- **A file** otherwise: `data/outreach.json`, or the path in `DATA_FILE`. The file is not in git, so a `git pull` never overwrites your edits.

To add a professor, copy an existing entry, give it a unique `id` and its `wave`, and save:
- On Vercel, open your Upstash database (Vercel → Storage → your database → **Open in Upstash**). In **Data Browser**, edit the `outreach` key.
- With a file, edit `data/outreach.json`.

The change shows up on the next page load.

## Deploy free on Vercel (recommended)

This costs nothing: Vercel's Hobby plan plus Upstash Redis's free tier.

1. Sign in at <https://vercel.com> with GitHub. Click **Add New → Project**, import `outreach-dashboard-starter` and leave the settings as they are. **Don't deploy yet.** If it already deployed, that's fine: the page just asks you to set a password.
2. In the project, open **Storage → Create Database → Upstash for Redis** (free plan). Pick a region close to you, such as Singapore, and connect it to the project. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` for you.
3. Under **Settings → Environment Variables**, add:
   - `DASHBOARD_PASSWORD`: your password, plain ASCII. The site refuses to run on Vercel without it.
   - `CRON_SECRET`: any long random string, for the daily Gmail sync.
   - The four `GMAIL_*` values, if you want Gmail sync (see below).
4. Under **Deployments**, choose **Redeploy** so the new variables take effect. Then open `https://<project>.vercel.app` on your phone. Any username works with your password. Add it to your home screen if you like.

Every push to `master` redeploys the site automatically. Your data stays in Redis.

**Time zone:** dates are always worked out in Asia/Dhaka (`TIME_ZONE` in `lib/status.js`), wherever the code runs.

**Daily Gmail sync:** `vercel.json` runs the sync once a day at about 07:00 Dhaka time (01:00 UTC). Vercel's free plan allows one run per day, and it may start up to an hour late. Press **Check Gmail** any time you want to check sooner.

## Deploy to your own server (VPS)

If you ever get a server, the same code runs there with a file for storage. Both options below assume Ubuntu with nginx. Point a DNS **A record** for your subdomain (for example `outreach.yourdomain.com`) at the server first.

### Option A: PM2 (simplest)

```bash
# on the server, as your normal user
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
sudo npm i -g pm2

git clone https://github.com/anawrulkabir/outreach-dashboard-starter.git outreach
cd outreach
cp .env.example .env && nano .env      # set DASHBOARD_PASSWORD (and Gmail keys later)
npm ci && npm run build
pm2 start deploy/ecosystem.config.cjs
pm2 save && pm2 startup                 # run the command it prints, so it restarts on reboot
```

PM2 runs the app on `127.0.0.1:3000` with `TZ=Asia/Dhaka`.

To update later:

```bash
git pull && npm ci && npm run build && pm2 restart outreach
```

### Option B: Docker

```bash
cp .env.example .env && nano .env
docker compose up -d --build
```

Live data is kept in `./data-live/outreach.json` on the host. Docker also listens only on `127.0.0.1:3000`.

### nginx and HTTPS (both options)

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/outreach
sudo nano /etc/nginx/sites-available/outreach    # replace outreach.example.com
sudo ln -s /etc/nginx/sites-available/outreach /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d outreach.yourdomain.com  # gets the certificate and adds the HTTPS redirect
```

Open `https://outreach.yourdomain.com`. The browser asks for a username and password. Any username works, and the password is `DASHBOARD_PASSWORD`. Keep the password plain ASCII. The lock is HTTP Basic auth, so it is only safe over HTTPS.

## Gmail sync (optional)

Sync is read-only and uses the `gmail.readonly` scope. When you press **Check Gmail**, the app:

- reads each known thread. Your first message there is the send, your second is the follow-up, and any message from someone else is a reply. A message from mailer-daemon or postmaster marks the contact as **Bounced**.
- searches `in:sent to:<email>` for contacts that don't have a thread ID yet, so emails you send from Gmail are picked up on their own.

Sync only fills in empty fields. It never overwrites a date you entered by hand.

### 1. Create the Google OAuth client (one time, about 10 min)

1. Go to <https://console.cloud.google.com>, create a project (for example "Outreach dashboard") and select it.
2. Open **APIs & Services → Library**, search for **Gmail API** and click **Enable**.
3. Open **APIs & Services → OAuth consent screen** (shown as "Google Auth Platform" in newer consoles):
   - User type: **External**. App name: anything. Support and developer email: your Gmail.
   - Under **Data access / Scopes**, add `https://www.googleapis.com/auth/gmail.readonly`.
   - Under **Audience / Test users**, add `mdanawrulkabirfahad123@gmail.com`.
   - Under **Audience**, press **Publish app** to move it to *In production*. **Don't skip this step.** While the app is in *Testing*, Google expires the refresh token after 7 days and sync stops working. You don't need Google's verification for your own account. During sign-in you'll see an "unverified app" warning; choose **Advanced → Go to … (unsafe)**.
4. Open **APIs & Services → Credentials → Create credentials → OAuth client ID**, choose application type **Desktop app**, and create it. Copy the **Client ID** and **Client secret**.

### 2. Get a refresh token (on your laptop)

```bash
GMAIL_CLIENT_ID=xxx GMAIL_CLIENT_SECRET=yyy npm run gmail-token
```

Open the link it prints and sign in with the Gmail account you send from. Allow access, and the terminal prints `GMAIL_REFRESH_TOKEN=...`.

### 3. Add the keys

On Vercel, add these under **Settings → Environment Variables** and redeploy. On a VPS, put them in `.env`:

```
GMAIL_ADDRESS=mdanawrulkabirfahad123@gmail.com
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
```

On a VPS, restart the app with `pm2 restart outreach --update-env` or `docker compose up -d`. A **Check Gmail** button now appears in the top right.

### Automatic sync

On Vercel it runs daily on its own (see above). On a VPS, to sync every 3 hours without pressing the button, add a crontab line on the server:

```
0 */3 * * * curl -s -u me:YOUR_PASSWORD -X POST http://127.0.0.1:3000/api/sync > /dev/null
```

## Project layout

```
app/page.js               server page that loads the data
app/Dashboard.js          the whole UI (client component)
app/api/contacts/[id]     PATCH one contact
app/api/sync              POST (button) or GET (daily cron) runs the Gmail sync
lib/status.js             status and next-step rules, Dhaka dates
lib/store.js              storage: Upstash Redis or a JSON file
lib/gmail.js              Gmail sync
middleware.js             password lock
scripts/gmail-token.mjs   one-time refresh-token helper
deploy/                   PM2 config and nginx site
vercel.json               daily Gmail sync cron on Vercel
Dockerfile, docker-compose.yml
```
