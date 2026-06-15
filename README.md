# 📈 Revenue Audit & 90-Day Tracker System

This project is a hybrid revenue diagnostic tool and client-tracking CRM built for **BDL Revenue Intelligence**. It is composed of a serverless Google Apps Script API backend, an offline administrator management panel, and a client-facing web frontend.

---

## 📁 Project Directory Layout

The repository has been structured to isolate development test blocks, legacy scratch tools, and public client interfaces:

```
calculator/
├── .clasp.json          # Clasp Google Script configuration (Private)
├── .claspignore         # Ignores HTML/Tests during push (Private)
├── .git/                # Version control configuration (Private)
├── admin.html           # Administrator Dashboard (Private / Offline)
├── appsscript.json      # Apps Script configuration (Private)
├── Code.gs              # Backend Script router and endpoint logic (Private)
├── Core_Logic.gs        # Core business calculation engine (Private)
├── Email_PDF_Templates.gs # PDF generation and transactional email templates (Private)
├── Helpers.gs           # General GAS utility functions (Private)
├── Tests.gs             # Native Google Apps Script test suite (Private)
│
├── public/              # PUBLIC SITE ROOT (Hosted on Cloudflare Pages)
│   ├── index.html       # Public Revenue Leakage Calculator (Client View)
│   ├── tracker.html     # Secure 90-Day Progress Tracker (Client View)
│   └── sample_report.html # Live interactive diagnostic report template
│
├── tests/               # Local developer test suites
│   └── unit_tests.js    # Local Node.js test runner for calculations
│
├── scripts/             # Local build and development scripts
│   ├── build_sample.ps1 # Compiles Core_Logic and Templates into sample_report.html
│   └── legacy/          # Archived scratch files and history snippets
│       ├── Checkcode.txt
│       ├── fix.ps1
│       ├── fix.py
│       ├── fix_link.py
│       ├── fix_receipt.py
│       ├── remove_lines.py
│       └── splice.ps1
└── README.md            # System Reference Documentation
```

---

## 🔒 Security Architecture (Hiding Code & Logic)

To keep your proprietary calculations, spreadsheets, and database endpoints 100% confidential and hidden from the public eye:

1. **Server-Side Execution (GAS):** 
   All `.gs` files run exclusively on Google's cloud servers. The browser only interacts with the Web App URL via JSON API payloads, meaning the client never sees the calculations or database credentials.
2. **Private GitHub Repository:** 
   Maintain this GitHub repository as **Private**. Cloudflare Pages integrates securely with private repositories to deploy frontend updates automatically without exposing code to search engines or the public.
3. **Frontend Isolation (`/public` directory):** 
   Only the files inside the `/public` folder are hosted on the web. The root-level administrative panel (`admin.html`) is kept offline and cannot be loaded by public web visitors.

---

## 🚀 Deployment Instructions

### 1. Cloudflare Pages (Frontend Hosting)
When setting up your Cloudflare Pages project pointing to this private GitHub repository:
* **Framework Preset:** None (Static site)
* **Build Command:** Leave blank
* **Root Directory (or Output Directory):** Set to `public` (or `/public`)

This ensures that only the files in the `/public` folder (`index.html`, `tracker.html`, `sample_report.html`) are live at `audit.dataconnectmail.com`.

### 2. Google Apps Script Backend (API Hosting)
To push changes to the backend API:
1. Ensure Clasp is installed and authenticated:
   ```bash
   npm install -g @google/clasp
   clasp login
   ```
2. Push script code using the force flag:
   ```bash
   clasp push --force
   ```
   *(Note: The `.claspignore` rules will automatically prevent any html files, tests, or local scripts from uploading to Google Apps Script).*
3. **IMPORTANT:** After pushing, you must open the script editor, click **Deploy > Manage Deployments**, edit your active deployment, select **New Version**, and click **Deploy** to make backend changes live.

---

## 🛠️ Developer Utility Commands

### Run Local Unit Tests
To verify calculation formulas quickly without pushing to Google Sheets:
```bash
node tests/unit_tests.js
```

### Build Sample Report
To compile a fresh preview of the interactive client PDF report layout inside `public/sample_report.html`, run this script from the project root:
```powershell
./scripts/build_sample.ps1
```

### Run Administrator Dashboard
Double-click `admin.html` in your local file explorer to run the CRM control panel offline. It connects securely to your active Google Web App endpoint.
