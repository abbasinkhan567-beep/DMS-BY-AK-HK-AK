# Simple guide — GitHub only

No OneDrive. No Google Drive. No tunnel.

## What stays local

Every PC keeps `data/pepsi.db` on its own disk. **Offline always works.**

## One-time setup

### A) Your PC (developer)
1. Create **private** GitHub repo  
2. Push this project (`PUBLISH-UPDATE.bat` or git push)  
3. Run app → login `admin123` → change password  
4. Settings → Updates → paste repo URL  
5. Settings → Sync → PC name `Home` → Sync Now  
   - If upload fails: add a GitHub Personal Access Token (repo) in Sync

### B) Office PC
1. `git clone` your private repo (or copy folder)  
2. Run `INSTALL-OFFICE.bat` → Desktop icon  
3. Login → Settings → Updates → same GitHub URL  
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
