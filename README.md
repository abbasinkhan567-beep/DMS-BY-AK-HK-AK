# Pepsi Distribution Management System

Chhoti Pepsi distribution company ke liye complete management software.

## Quick Start (Office PC — fresh clone)

1. Install **Node.js 22+** from https://nodejs.org and **Git** from https://git-scm.com
2. Open CMD and run:
```
git clone https://github.com/abbasinkhan567-beep/DMS-BY-AK-HK-AK.git "A:\Pepsi-Office"
cd "A:\Pepsi-Office"
START.bat
```
3. Login: `admin123` · Settings: `settings123`
4. Settings → Sync → PC name: `Office` → paste GitHub token → Save → Sync Now
5. Future updates: Settings → Updates → Apply

## Developer PC

| Command | What |
|---------|------|
| `START.bat` | Build + run app (first run shows setup progress) |
| `PUBLISH.bat` | Bump version, commit, push to GitHub |
| `MAKE-OFFICE.bat` | Create `A:\Pepsi-Office` with build + git + shortcut |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build |

## Features

Dashboard, Products, Purchases, Sales, Customers, Salesmen, Paper/Old Records, Expenses, Ledgers, Accounts, Manual Backup, Stock Adjustment, **Safe Merge Sync** (both PCs share data via GitHub without replacing each other's entries), Updates via GitHub.

### Two-PC data sync

Use separate PC names such as `Home` and `Office` in Settings → Sync. After entering data on either PC, click **Sync Now** while online; the app merges rows from both PCs by sync ID. Automatic sync also runs about every two minutes. If both PCs sync at exactly the same time, GitHub lease protection prevents one upload from overwriting the other—run Sync Now again to merge the latest data.

## Tech

Next.js 15 + Tailwind CSS + SQLite (built-in `node:sqlite`)
