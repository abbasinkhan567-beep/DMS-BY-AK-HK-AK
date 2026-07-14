# Simple guide — GitHub merge sync

No OneDrive. No Google Drive. No tunnel.

**Repo:** https://github.com/abbasinkhan567-beep/DMS-BY-AK-HK-AK

## How sync works (important)

- Har PC apni `data/pepsi.db` rakhti hai (offline OK).
- Sync **merge** karta hai — dono taraf ki entries rehti hain.
- Paper/old + office daily **ek saath** chal sakte hain — koi “winner” overwrite nahi.
- Internet pe auto sync ~2 minute; Settings → **Sync Now** bhi.

## One-time setup

### A) Home / developer PC
1. Repo already on GitHub  
2. App chalao → Settings → Sync → PC name `Home` → GitHub token (repo scope) → **Sync Now**  
3. Updates URL auto: same GitHub repo  

### B) Office PC
1. Clone:
   ```bash
   git clone https://github.com/abbasinkhan567-beep/DMS-BY-AK-HK-AK.git
   ```
2. `INSTALL-OFFICE.bat` → Desktop icon  
3. Settings → Sync → PC name `Office` → **same GitHub token** → **Sync Now**  
4. Settings → Updates → Check / Apply when new software out  

## Daily

| Who | What |
|-----|------|
| Anyone | Sales, paper, purchases — anytime |
| Online | Auto merge sync |
| Software change | `PUBLISH-UPDATE.bat` → office **Updates → Apply** |

## Remember

- **Updates** = new software only (data safe)  
- **Sync** = data merge via GitHub `data-sync` branch  
- Same customer/product names match across PCs automatically  
