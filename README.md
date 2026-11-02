# Good Samaritan QR

Lost-item recovery through QR tags. Owners tag their belongings; whoever finds one scans the code and reaches the owner without either side's contact details being exposed.

## What's in the app

| Area | Route | What it does |
| --- | --- | --- |
| Items | `/dashboard`, `/items/:id` | Register items, download or print QR codes, mark items lost or returned, read finder messages |
| Finder page | `/found/:id` | Public scan page. Finders message the owner and pick a charity that receives a $1 kindness donation |
| Venue mode | `/venues`, `/t/:code` | Coat checks, hotels and events print batches of claim-on-scan tags that guests link to their phone |
| Tag shop | `/shop` | Eco-friendly tag catalog, cart and checkout with order history |
| Premium | `/premium` | $4.99/mo: instant found alerts by email, anonymous mode, personalised loss-prevention tips, 15% off tags |
| Rewards | `/rewards` | Points, badges and history |
| Community | `/community` | Live impact stats, stories of returned items, charity totals, donating points (100 pts = $1) |
| Partners | `/partners` | Inquiry form for CSR programs, schools, non-profits and brand sponsors |

### Not wired to real money yet

Checkout and Premium billing run in **demo mode**: orders are recorded and Premium is switched on without charging a card. Add a payment provider (for example Stripe Checkout plus a webhook that confirms payment) in front of `POST /api/shop/orders` and `POST /api/account/premium` before taking real payments. Charity donations are recorded as pledges funded by the sponsor pool; paying them out to charities is a manual or finance-system step.

## Run locally

```bash
npm install                       # server deps (hoisted to the root)
(cd server && npm install)
(cd client && npm install)

cp server/.env.example server/.env   # optional; defaults work for local dev
npm run dev:server                # API on http://localhost:5000 (SQLite file in server/data/)
npm run dev:client                # web app on http://localhost:3000
```

## Deploy

`netlify.toml` builds the client and serves the API as a Netlify Function. Set `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` and `JWT_SECRET` in Netlify. Email, SMS and partner-inquiry notifications are optional; see `server/.env.example`.
