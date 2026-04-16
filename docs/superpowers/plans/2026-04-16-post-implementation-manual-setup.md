# Post-Implementation Manual Setup Guide

Everything in this guide requires human action — it cannot be scripted or automated. Complete these steps **after** the implementation plan has been fully executed and deployed to Vercel.

Work through the sections in order. Each section depends on the previous one.

---

## 1. Supabase — Verify Migrations

After running `pnpm exec drizzle-kit migrate`, confirm the new tables exist in your Supabase database.

1. Go to [supabase.com](https://supabase.com) → your project → **Table Editor**
2. Confirm these three tables appear:
   - `gsheet_sync_queue` — should now have `retry_count` and `last_error` columns
   - `sync_audit_log` — new table
   - `system_config` — new table
3. Click into `system_config` and verify it has one row:
   - `key`: `sync_frozen`
   - `value`: `false`
   
   If the row is missing, insert it manually via the Table Editor or the Supabase SQL editor:
   ```sql
   INSERT INTO system_config (key, value, updated_at)
   VALUES ('sync_frozen', 'false', NOW());
   ```

---

## 2. Vercel — Add Environment Variable

The sync API route is protected by a secret token. You need to add it to Vercel so the deployed app can read it.

1. Generate a secure random token on your machine:
   ```bash
   openssl rand -hex 32
   ```
   Copy the output — this is your `CRON_SECRET`. Save it somewhere safe (password manager).

2. Go to [vercel.com](https://vercel.com) → your project → **Settings** → **Environment Variables**

3. Add a new variable:
   - **Name:** `CRON_SECRET`
   - **Value:** the token you just generated
   - **Environments:** Production, Preview, Development (check all three)

4. Click **Save**

5. **Redeploy** the app so the new variable takes effect:
   - Go to **Deployments** → click your latest deployment → **Redeploy**

6. Once deployed, test the health endpoint in your browser:
   ```
   https://your-app.vercel.app/api/health
   ```
   You should see `{"status":"healthy","timestamp":"..."}`. If you see an error, your `DATABASE_URL` env var may need checking.

---

## 3. Discord — Create an Alert Webhook

This webhook receives automated alerts when the Cloudflare Worker detects the app is down or a sync fails.

1. Open Discord → go to the server where you want alerts (create a dedicated `#agila-alerts` channel if you don't have one)

2. Click the gear icon next to the channel name → **Integrations** → **Webhooks** → **New Webhook**

3. Give it a name (e.g., `AGILA Sync Monitor`) and optionally set an avatar

4. Click **Copy Webhook URL** — save this URL, you'll need it in the next section

---

## 4. Cloudflare — Deploy the Worker

### 4a. Create a Cloudflare account

1. Go to [cloudflare.com](https://cloudflare.com) and sign up for a free account if you don't have one
2. No domain or paid plan needed — the free Workers tier is sufficient

### 4b. Install Wrangler CLI

Wrangler is Cloudflare's CLI tool for managing Workers.

```bash
pnpm add -g wrangler
```

Then log in:

```bash
wrangler login
```

This opens a browser window. Authorize Wrangler with your Cloudflare account.

### 4c. Update the worker config with your app URL

Before deploying, open `workers/sync-cron/wrangler.toml` and update the `APP_URL` variable to your actual Vercel deployment URL:

```toml
[vars]
APP_URL = "https://your-actual-app.vercel.app"
```

Save the file.

### 4d. Deploy the worker

```bash
cd workers/sync-cron
pnpm install
wrangler deploy
```

You should see output ending with a `workers.dev` URL — the worker is now live.

### 4e. Add secrets to the worker

Secrets are environment variables that are encrypted and never appear in logs.

```bash
wrangler secret put CRON_SECRET
```
When prompted, paste the same `CRON_SECRET` value you set in Vercel.

```bash
wrangler secret put DISCORD_WEBHOOK_URL
```
When prompted, paste the Discord webhook URL from step 3.

### 4f. Verify the cron trigger is active

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → click your `agila-sync-cron` worker
2. Click the **Triggers** tab
3. Under **Cron Triggers**, confirm you see `*/10 * * * *` (every 10 minutes)
4. If it's missing, click **Add Cron Trigger** and enter `*/10 * * * *`

### 4g. Test the worker manually

In the Cloudflare dashboard, go to your worker → **Quick Edit** → click **Send** on the right side to manually trigger it once. Check the **Logs** tab for output. You should see something like:

```
[Health] OK
[Sync] OK at 2026-04-16T...
```

If you see a 401 error on the sync call, the `CRON_SECRET` in Cloudflare doesn't match the one in Vercel — re-check both.

---

## 5. Google Sheets — Prepare the CATalog Spreadsheet

Do this for **every regional sheet tab** (GATE 3, ARETE, SDC, etc.).

### 5a. Add the timestamp columns

1. Open the CATalog Google Spreadsheet
2. In each sheet tab, click on the column header after V (i.e., column W) and insert two new columns
3. In **row 2** of column W, type: `last_edited_at`
4. In **row 2** of column X, type: `edited_by`
5. Leave all data rows (row 3 onwards) in W and X empty — the Apps Script fills these automatically

### 5b. Deploy the Apps Script

1. In the spreadsheet, go to **Extensions → Apps Script**
2. You'll see the Apps Script editor with a default `Code.gs` file
3. Delete all existing content in `Code.gs`
4. Copy the contents of `workers/apps-script/Code.gs` from the repository and paste it in
5. Find this line near the top and update it with your actual service account email:
   ```javascript
   var SERVICE_ACCOUNT_EMAIL = "your-service-account@your-project.iam.gserviceaccount.com";
   ```
   Your service account email is inside the `SERVICE_ACCOUNT_CREDENTIALS` environment variable — it's the value of the `"client_email"` field in that JSON.
6. Click **Save** (or Ctrl+S)

### 5c. Add the Protection script

1. In the Apps Script editor, click **+** next to **Files** in the left sidebar → **Script**
2. Name it `Protection` (it will become `Protection.gs`)
3. Copy the contents of `workers/apps-script/Protection.gs` from the repository and paste it in
4. Find the `MANAGER_EMAILS` array and add the actual email addresses of your managers:
   ```javascript
   var MANAGER_EMAILS = [
     "manager1@ateneo.edu",
     "manager2@ateneo.edu",
   ];
   ```
5. Click **Save**

### 5d. Install the onEdit trigger

This is the critical step — a "simple trigger" (`onEdit`) cannot access the user's email, so you must install it as an "installable trigger" instead.

1. In the Apps Script editor, click the **clock icon** (Triggers) in the left sidebar
2. Click **+ Add Trigger** (bottom right)
3. Configure it:
   - **Function:** `onEditInstallable`
   - **Deployment:** Head
   - **Event source:** From spreadsheet
   - **Event type:** On edit
   - **Failure notification:** Notify me immediately (or daily — your preference)
4. Click **Save**
5. A permissions dialog will appear — click **Review Permissions** → choose your Google account → click **Allow**

### 5e. Test the trigger

1. Go to any regional sheet tab
2. Edit any cell in the data range (e.g., row 3, column C — a cat's nickname)
3. Look at column W of that same row — it should now contain a timestamp like `2026-04-16T10:30:00.000Z`
4. Look at column X — it should contain your Google account email
5. If columns W and X stay empty, the trigger isn't firing. Go back to the Triggers page in Apps Script and confirm it's listed there.

### 5f. Protect columns W and X

Prevent managers from accidentally overwriting the auto-timestamps.

1. In the spreadsheet, select column W header, then Shift+click column X header to select both
2. Right-click → **Protect range**
3. In the sidebar that appears, click **Set permissions**
4. Select **Restrict who can edit this range** → **Only you**
5. Click **Done**
6. Repeat for every sheet tab (unfortunately, range protection doesn't apply across tabs automatically)

---

## 6. Verify the Full Cycle End-to-End

Once all of the above is done, do a manual end-to-end test.

1. **Add or edit a cat** in the AGILA app
2. **Check the database** — confirm the `gsheet_sync_queue` table has a new PENDING row for that cat
3. **Wait up to 10 minutes** for the Cloudflare Worker to fire, or manually trigger it from the Cloudflare dashboard
4. **Check the GSheet** — the cat should appear/update in the correct regional tab, sorted alphabetically
5. **Check `sync_audit_log`** in Supabase — confirm a new row was inserted with `direction = 'FORWARD'` and `tasks_failed = 0`
6. **Test reverse sync:** Manually edit a cat's name in the GSheet. Wait up to 10 minutes (or trigger the worker). Check the database — the name change should now be reflected in Postgres.
7. **Check Discord** — you should receive a test alert if you manually trigger a sync failure (e.g., temporarily set an invalid `CRON_SECRET` in Cloudflare, trigger the worker, then restore the correct value)

---

## 7. Ongoing Operations

### Freeze the system (app is down)

1. In the AGILA app (if still partially accessible), call the `freezeSync()` server action — or run the SQL directly in Supabase:
   ```sql
   UPDATE system_config SET value = 'true', updated_at = NOW()
   WHERE key = 'sync_frozen';
   ```
2. Open the CATalog spreadsheet → Extensions → Apps Script → run `freezeMode()` from the editor
3. Notify managers that they can now edit the spreadsheet directly

### Unfreeze the system (after recovery)

1. Deploy the fixed app to Vercel
2. In the AGILA app, call the `unfreezeSync()` server action — this runs full reverse sync before re-enabling the cron
3. Open the CATalog spreadsheet → Extensions → Apps Script → run `unfreezeMode()` to re-lock the sheets
4. Notify managers to stop editing the spreadsheet directly

### Pause the Cloudflare cron (optional during maintenance)

1. Go to Cloudflare dashboard → Workers & Pages → `agila-sync-cron` → Triggers
2. Click the three-dot menu next to the cron trigger → **Disable**
3. Re-enable when ready
