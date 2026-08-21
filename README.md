# PayCycle Budget

Offline-first personal budgeting PWA.

## Current V1 features
- Multiple accounts with opening balances
- Income assigned to an account
- Expenses assigned to an account
- Transfers between accounts without inflating income/spending
- Pay cycle based on a configurable payday (default: 25th)
- Weekend/holiday payday adjustment to prior business day
- Offline storage using IndexedDB
- Installable PWA
- JSON backup and restore

## Run locally
Use a local web server (service workers do not work from file://).

Python:
```bash
python -m http.server 8000
```

Then open http://localhost:8000/paycycle-budget/

## GitHub Pages
1. Create a repository.
2. Upload the contents of this folder to the repository root.
3. In GitHub: Settings → Pages.
4. Deploy from the main branch/root.
5. Open the Pages URL on your phone and add it to your Home Screen.

## Important
Financial data is stored locally in the browser/device. It is not committed to GitHub.

Holiday dates are currently user-configurable so observed Jamaican holiday dates can be entered accurately. Automatic Jamaican holiday generation can be added in the next version.
