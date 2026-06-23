# Implementation Plan - CRM Online Sync & Email Warming System

We will implement read receipt tracking and an automated email warming loop to log message reads and maintain high sender deliverability. Instead of tracking bounces and reads offline in CSV logs, we will **sync them directly to your online Google Sheets CRM database** in real-time.

Additionally, to fix the slow page load times in the Admin Panel (`bdl live pro` / `bdl-leads-pro`), we will implement **Fast Fetch Caching (Stale-While-Revalidate)** in the React Zustand store.

---

## User Review Required

> [!IMPORTANT]
> **Why it's not showing in the Admin Panel right now:**
> * The 360 emails sent tonight were dispatched locally via Outlook, but **the script has not updated your Google Sheet yet**. Because the sheet doesn't know about these dispatches, your live Admin Panel (`bdl live pro`) shows them in their original state.
> * To fix this, we will run a **one-time backfill script** to instantly update the 360 sent emails (as `Pitched`) and 22 bounces (as `Lost` / `Cold`) in your Google Sheet. Your Admin Panel dashboard will immediately update to reflect these stats.
>
> [!TIP]
> **Fast Fetch React Caching (0ms Load Times):**
> * Currently, the React app waits 3–5 seconds on every page refresh to download all data from Google Sheets, showing a blocking loading spinner.
> * We will implement a **Stale-While-Revalidate** cache in the React store (`leadsStore.js`).
> * On page load, it will instantly render the data cached in `localStorage` from the previous session (loading in **0ms** and showing the tables immediately).
> * It will run the Sheets fetch quietly in the background. Once the fresh data is downloaded, it will update the UI and save the new data to the cache.
> * If there is no cache (first login), it will show the standard spinner as a fallback.

---

## Proposed Changes

### [Campaign Script Updates]

#### [NEW] [backfill_crm_stats.ps1](file:///d:/Restaurant_Campaign/backfill_crm_stats.ps1)
- One-time script to read `campaign_sent_database.csv` and `campaign_bounces_database.csv`.
- Match leads by email address and send POST requests to the Google Sheets Web App.
- Mark the 360 sent leads as `pitchSent = TRUE` / `dealStage = Pitched` and the 22 bounces as `status = Lost` / `dealStage = Cold`.

#### [NEW] [run_warmup.ps1](file:///d:/Restaurant_Campaign/run_warmup.ps1)
- Automate warmup sequences between your mapped sender accounts.
- Send natural, human-like emails round-robin.
- Auto-rescue emails: Check the Junk folder in each inbox. If a warmup email is found, move it to the Inbox and mark it as read.

#### [NEW] [check_inbox_activity.ps1](file:///d:/Restaurant_Campaign/check_inbox_activity.ps1)
- Scan all Outlook inboxes for activity in the **last 7 days**.
- Identify bounces and read receipts (`Report.IPM.Note.IPNRN`).
- Parse the recipient email and send an HTTPS POST request to your Google Sheet database (`script.google.com`) to update the lead's status (`status = Warm` for reads, `status = Lost` for bounces).
- Delete processed notification emails from Outlook to keep inboxes clean.

#### [MODIFY] [run_outlook_campaign.ps1](file:///d:/Restaurant_Campaign/run_outlook_campaign.ps1)
- Copy script from hidden brain folder to `D:\Restaurant_Campaign\run_outlook_campaign.ps1`.
- Enable read receipt requests by adding `$Mail.ReadReceiptRequested = $true`.

### [React Frontend Updates]

#### [MODIFY] [leadsStore.js](file:///e:/BDL_PRO_Claude/bdl-leads-pro/src/store/leadsStore.js)
- Modify `loadAll()` to load data from `localStorage` first.
- Perform background fetch, update store state with fresh values, and save to cache.
- Ensure that if cache exists, `loading` is set to `false` immediately so the UI is interactive right away.

---

## Verification Plan

### Automated/Manual Verification
1. **Verification of Fast Fetch Caching:** Open the local React app, refresh the browser, and verify that the dashboard and leads tables render instantly without showing the blocking spinner.
2. **Sync Verification:** Check that the background fetch completes and updates the UI if a new lead is added in the Sheet.
3. **Deploy Build:** Run `npm run build` inside `bdl-leads-pro` and copy files to `bdl-leads-pro-live` to push the update live.
