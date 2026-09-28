# VELOop Rewards — Design Preview

A static visual concept for the VELOop Rewards wallet and payout experience.

## Preview

Open `index.html` in a browser, or serve this folder locally:

```bash
python -m http.server 4173
```

Then visit `http://localhost:4173`.

## Screens included

- **Login:** member sign-in concept.
- **Wallet:** VELOop balance, SVEs, Gems, Tokens, Spins, streak calendar, next-streak milestone, summary statistics, recent activity, and redeem prompt.
- **Payout:** UPI method, illustrative reward choices, and redemption summary.

## Design notes

- This repository currently contains a **static design preview** made with HTML and an external CSS file.
- Displayed balances, progress, activity, and payout values are illustrative examples.
- Login, forms, navigation beyond page anchors, wallet balances, and payout actions are not connected to an API or database.
- No production credentials or real payout integrations are included.

## Files

- `index.html` — page structure and static sample content.
- `styles.css` — layout, responsive rules, typography, and visual styling.

## Next implementation stage

After the frontend design is reviewed and approved, backend/API integration can replace the sample data and connect the wallet, reward progression, authentication, and payout flows.
