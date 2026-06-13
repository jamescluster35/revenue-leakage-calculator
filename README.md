# Revenue Audit Calculator (Google Apps Script)

This project is a revenue audit and lead management calculator built to run on Google Apps Script. It serves both as a frontend tool to calculate potential revenue leakage for different business niches and a backend CRM system powered by Google Sheets.

## 📂 Project Structure

### Backend (Google Apps Script - `.gs`)
- **`Code.gs`**: The main entry point for the Apps Script Web App. It handles the `doGet` and `doPost` requests and routes them to the appropriate functions.
- **`Core_Logic.gs`**: Contains the core business logic, including the revenue leakage calculations for various niches (Dental, Real Estate, SaaS, Restaurant).
- **`Lead_Persistence.gs`**: Handles all interactions with the Google Sheets "database" (saving new leads, moving leads between tabs, updating statuses).
- **`Email_PDF_Templates.gs`**: Handles the generation of PDF reports and the logic for sending out automated confirmation or follow-up emails via `MailApp`.
- **`Helpers.gs`**: Miscellaneous utility and helper functions.
- **`Tests.gs`**: Native Google Apps Script test functions that can be run directly within the Apps Script editor.

### Frontend (HTML/JS/CSS)
- **`index.html`**: The main client-facing revenue calculator interface.
- **`admin.html`**: An admin dashboard view for managing leads, tracking metrics, and processing client status.
- **`tracker.html`**: An additional view likely used for tracking outreach or sales pipeline stages.
- **`sample_report.html`**: An HTML template used to generate the final PDF report sent to clients.

### Local Testing & CI/CD
- **`unit_tests.js`**: A standalone Node.js file containing unit tests for the core calculation logic. It can be run locally without deploying to Apps Script.
- **`unit-tests.yml`**: A GitHub Actions workflow configuration that automatically runs `unit_tests.js` on pushes or pull requests to the main branch.

### Other
- **`Checkcode.txt`**: A backup or consolidated text file containing a snapshot of the backend Google Apps Script logic.

## 🚀 How to Run & Deploy

### Local Unit Tests
To verify the core calculation logic locally, ensure you have [Node.js](https://nodejs.org/) installed, then run:
```bash
node unit_tests.js
```

### Deploying to Google Apps Script
Because this relies on Google Sheets (`SpreadsheetApp`) and Google Mail (`MailApp`), it must be hosted as a Google Apps Script Web App.

#### Prerequisites
Your linked Google Sheet must contain the following tabs for the backend to function correctly:
- `Leads`
- `Archived`
- `Deleted`
- `Clients`
- `Calculator Leads`
- `Config` (Cell A1 should contain your admin password)

#### Deployment Steps (Using `clasp`)
1. Install clasp globally: `npm install -g @google/clasp`
2. Log in to your Google Account: `clasp login`
3. Initialize the project: `clasp create --type standalone --title "Revenue Calculator"`
4. Push the code: `clasp push`
5. Open the project in your browser: `clasp open`
6. In the Apps Script editor, click **Deploy > New deployment**, select **Web app**, configure access permissions, and click **Deploy**.

Alternatively, you can manually copy and paste the `.gs` and `.html` files into a script bound to a Google Sheet via **Extensions > Apps Script**.
