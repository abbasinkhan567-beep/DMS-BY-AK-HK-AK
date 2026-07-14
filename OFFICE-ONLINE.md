# Simple guide — GitHub only

No OneDrive. No Google Drive. No tunnel.

**Repo:** https://github.com/abbasinkhan567-beep/DMS-BY-AK-HK-AK

## What stays local

Every PC keeps `data/pepsi.db` on its own disk. **Offline always works.**

## One-time setup

### A) Your PC (developer)
1. Code already on GitHub (`main` branch)  
2. Run app → login → change password  
3. Settings → Updates → GitHub URL is auto-set to this repo (Save if blank)  
4. Settings → Sync → PC name `Home` → Sync Now  
   - If upload fails: add a GitHub Personal Access Token (repo scope) in Sync

### B) Office PC
1. Clone:
   ```bash
   git clone https://github.com/abbasinkhan567-beep/DMS-BY-AK-HK-AK.git
   ```
2. Run `INSTALL-OFFICE.bat` → Desktop icon  
3. Login → Settings → Updates → same URL (auto-filled) → Check Updates  
4. Settings → Sync → PC name `Office` → same token if needed → Sync Now  

## Daily

| Who | What |
|-----|------|
| Office | Normal sales on Desktop app (offline OK) |
| You | Old/paper data on your PC (offline OK) |
| Internet on | App auto Sync, or press **Sync Now** |
| Software change | You edit → `PUBLISH-UPDATE.bat` → office **Updates → Apply** |

## Remember

- **Updates button** = new software only (data safe)  
- **Sync button** = data between home ↔ office via GitHub `data-sync` branch  
- Newer data wins; old copy kept in Backups  
