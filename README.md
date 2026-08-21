# PayCycle Budget V1.1

Offline-first personal budgeting PWA built around pay cycles.

## Added in V1.1
- Budget period selector with previous/next navigation
- 12 previous pay periods and 6 upcoming periods
- Budget categories with per-period limits
- Category spending and remaining-budget progress
- Recurring commitments/bills by due day
- Savings and sinking funds
- Free-to-spend calculation
- Edit and delete transactions
- Delete budgets, bills, and savings funds
- Existing multiple-account, income, expense, transfer, offline, PWA, and backup features retained

## Important calculation note
"Free to Spend" currently equals:
current total account balances - recurring commitments in the selected period - reserved savings funds.

This is deliberately simple for V1.1. In a later version, commitments can have paid/unpaid status so already-paid bills are not reserved twice.

## Run locally
```bash
python -m http.server 8000
```
Open the project through the local server, not directly with file://.

## GitHub Pages
Upload the project contents to the root of a GitHub repository, enable Pages for the main branch/root, then install the resulting site to your phone's Home Screen.

Financial records remain in IndexedDB on the device/browser and are not committed to GitHub.
