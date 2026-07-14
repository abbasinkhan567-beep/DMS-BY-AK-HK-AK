# Pepsi Distribution Management System

Simple management software for a small Pepsi distribution company.

## Features

- **Dashboard** — today's sales/purchases, stock value, low stock alerts, customer pending
- **Products / Stock** — Pepsi, Mirinda, 7UP and more with purchase/sale price and stock
- **Purchases** — buy from company; stock increases automatically
- **Sales** — sell to customers, assign salesman, cash/credit/partial payment
- **Customers** — shop records + credit balance
- **Salesmen** — sales team data (name, phone, area, salary)
- **Paper / Old Records** — enter historical forms by date without changing current stock
- **Backup** — daily local backups (never auto-deleted) + Day One protected copy
- **Office online** — one office server + Cloudflare tunnel so home and office share one database

## Run (developer)

```bash
npm install
npm run dev
```

Open: [http://localhost:3000](http://localhost:3000) — password `admin123`

## Office install

1. Run `INSTALL-OFFICE.bat`
2. Use Desktop **Pepsi Distribution** icon
3. For remote (home) access: see **[OFFICE-ONLINE.md](OFFICE-ONLINE.md)** and run `START-ONLINE.bat`

Data file: `data/pepsi.db`
