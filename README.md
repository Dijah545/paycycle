# PayCycle Budget — Full App

PayCycle Budget is an offline-first personal finance PWA built around a payday cycle rather than a calendar month.

## Included

- Multiple bank, savings, cash and wallet accounts
- Opening balances and live account balances
- Income, expenses and transfers
- Transfers do not inflate income or spending
- Budget categories with per-pay-period limits
- Selectable historical and future budget periods
- Payday defaults to the 25th
- Weekend/holiday payday adjustment
- Automatic Jamaican public-holiday calculations plus manual overrides
- Recurring bills and commitments
- Pay Bill workflow that can automatically create the expense transaction
- Paid/unpaid status tracked independently for each pay cycle
- Savings and sinking funds with optional targets
- Planned/forecast income
- Debt and credit-card balance tracking
- Net financial position
- Liquid Free-to-Spend calculation
- Transaction filtering and searching
- Selected-period reports
- Spending by category
- Spending by account
- CSV exports
- Full JSON backup/restore
- Offline IndexedDB storage
- PWA installation on supported phones/browsers
- No financial data is stored in GitHub

## Core calculations

**Net Financial Position**
= all account balances - debt balances

**Free to Spend**
= balances in accounts marked "Include in Free to Spend"
- unpaid recurring commitments in the selected period
- reserved savings/sinking funds

## Running locally

Service workers require HTTP/HTTPS rather than `file://`.

From the directory above this project:

```bash
python -m http.server 8000
```

Then open:

`http://localhost:8000/paycycle-budget-full/`

## Deploying to GitHub Pages

1. Create a new GitHub repository.
2. Upload the contents of this folder into the repository root.
3. Open repository **Settings → Pages**.
4. Under Build and deployment, select **Deploy from a branch**.
5. Select `main` and `/ (root)`.
6. Open the GitHub Pages URL once deployment completes.
7. On your phone, open the site and add it to your Home Screen.

## Data safety

The app itself can be public on GitHub Pages, but your financial data stays inside your device/browser via IndexedDB. It is not written to your GitHub repository.

Use **Settings → Export Full Backup** periodically, especially before clearing browser data, changing phones, or reinstalling the app.

## Holiday note

The app contains a built-in Jamaica holiday calculator for standard public holidays and observed weekend handling. Manual holiday entries remain available so you can override payroll-specific situations or unusual official observance arrangements.
