# PayCycle Budget V1.2

## New in V1.2
- Paid/unpaid status for recurring bills, stored separately for each pay period
- Free-to-Spend now subtracts only unpaid commitments
- Edit accounts and opening balances
- Edit budget categories and limits
- Renaming a budget category updates existing categorized expense records
- Edit recurring commitments
- Edit savings/sinking funds
- Automatic Jamaican holiday calendar option
- Manual holiday dates remain available as overrides/additions
- Holiday preview for the selected cycle's year
- V1.1 budget-period navigation, transaction tracking, offline use, backups and PWA installation retained

## Important holiday note
The built-in calendar covers the standard Jamaican public-holiday pattern and provides weekend observation handling for budgeting calculations. Because payroll treatment or official observed dates can sometimes differ, manual holiday dates remain available and should be used when needed.

## Data
All personal finance data stays in your browser's IndexedDB database. Nothing is committed to GitHub.

## Run locally
```bash
python -m http.server 8000
```

Then browse to the folder via localhost. Service workers do not operate from file://.

## GitHub Pages
Upload the contents of this folder to the root of a GitHub repository and enable GitHub Pages from the main branch/root.
