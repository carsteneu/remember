# FAQ & Troubleshooting - Window Position Remember

Frequently asked questions and solutions to problems with the **Window Position Remember** extension.

---

## Frequently Asked Questions (FAQ)

### General Questions

#### Where is the data stored?

All data is stored locally in your home directory:

```bash
~/.config/remember@thechief/
├── positions.json                      # Window positions & monitor data
├── preferences.json                    # UI settings (Python Settings)
├── extension-settings.json             # Launch flags for Session Restore
├── positions_backup_20260119_143000.json  # Automatic backups
├── positions_backup_20260119_150000.json
└── positions_backup_latest.json        # Latest backup
```

**View main file**:
```bash
cat ~/.config/remember@thechief/positions.json | jq
```

**Check file size**:
```bash
ls -lh ~/.config/remember@thechief/positions.json
```

Typical size: **50-200 KB** (depending on number of tracked windows).

---

#### How does multi-monitor support work?

The extension uses **EDID identification** for reliable monitor detection:

**1. EDID Hash (Primary Method)**

Each monitor has a unique **hardware ID** (EDID):

```bash
# Read EDID
xrandr --verbose | grep -A 10 "connected"
```

**Advantages**:
- Works even after **monitor rearrangement**
- Independent of **connector names** (HDMI-1, DP-2)
- Recognizes the same monitor on different ports

**Example**:
```json
{
  "monitor": "edid:abc123def456...",
  "connector": "HDMI-1",
  "resolution": "1920x1080"
}
```

**2. Fallback Mechanisms**

If EDID is not available:
- **Connector + Resolution**: `"HDMI-1_1920x1080"`
- **Monitor Index**: `"monitor_0"`, `"monitor_1"`

**3. Resolution Independent**

Positions are stored **as percentages**:
```
50% width at 1920x1080 = 960px
50% width at 2560x1440 = 1280px
→ Window adapts automatically
```

---

#### How often are positions saved?

**Auto-Save Mechanism**:

- **Interval**: Every **30 seconds**
- **Dirty-Flag System**: Only **changed** windows are saved
- **Automatic**: No manual action required

**Additionally saved**:
- On **Cinnamon restart**
- On **Logout/Shutdown** (with backup)
- On manual **"Save All"** via applet

**Save immediately**:
```
Applet → Save All
```

Or via terminal:
```bash
# Call extension API (only if applet is installed)
dbus-send --session --dest=org.Cinnamon \
  --type=method_call /org/Cinnamon \
  org.Cinnamon.SaveWindowPositions
```

---

#### Are my passwords or sensitive data saved?

**No**, the extension does **not save sensitive data**.

**Stored information**:
- Window position (X, Y, Width, Height)
- Window title (e.g., "Document1.odt - LibreOffice")
- WM_CLASS (e.g., "firefox")
- Command-line (optional, see below)

**Command-Line Arguments**:

If `capture-cmdline` is enabled, **start commands** are saved:

```json
{
  "cmdline": "firefox --private-window https://example.com"
}
```

**Privacy Notes**:
- Command-lines may contain **file paths** (e.g., `/home/user/private/document.odt`)
- Disable `capture-cmdline` if you don't use Session Restore
- The file `positions.json` has **user permissions** (chmod 600)

**Check saved command-lines**:
```bash
cat ~/.config/remember@thechief/positions.json | jq '.applications[] | .instances[]? | .cmdline[]?'
```

---

#### Does the extension work with Flatpak/Snap/AppImage?

**Yes**, the extension supports all package formats:

**Flatpak**:
```bash
# Example: Firefox Flatpak
flatpak run org.mozilla.firefox

# Saved as
{
  "cmdline": "flatpak run org.mozilla.firefox",
  "exe": "/usr/bin/flatpak"
}
```

**Snap**:
```bash
# Example: Chromium Snap
/snap/bin/chromium

# Automatically detected
```

**AppImage**:
```bash
# Example: VS Code AppImage
~/Applications/code-1.80.0.AppImage

# Saved with full path
```

**Important**: Enable `capture-cmdline` for best results.

---

#### Can I create backups?

**Automatic Backups**:

The extension creates **automatic** backups:
- On every **Cinnamon restart**
- On **Logout/Shutdown**
- Retention: **7 days**

**List backup files**:
```bash
ls -lh ~/.config/remember@thechief/positions_backup_*.json
```

**Create manual backup**:
```bash
# Backup with date
cp ~/.config/remember@thechief/positions.json \
   ~/remember_backup_$(date +%Y-%m-%d).json
```

**Restore backup**:
```bash
# 1. Disable extension
cinnamon-settings extensions remember@thechief
# → Turn extension switch off

# 2. Copy backup
cp ~/remember_backup_2026-01-19.json \
   ~/.config/remember@thechief/positions.json

# 3. Re-enable extension
```

**Recommendation**: Use your regular backup system for `~/.config/remember@thechief/`.

---

### Configuration

#### How do I add an application to the blacklist?

**Method 1: Cinnamon Settings (simple)**

1. Open **System Settings → Extensions → Remember**
2. Click **Configure** (⚙️)
3. Go to the **Blacklist** tab
4. Add the **WM_CLASS name** (one line per app)

**Example**:
```
cinnamon-settings
gnome-calculator
nemo-desktop
```

**Method 2: Python Settings UI (graphical)**

```bash
python3 ~/.local/share/cinnamon/extensions/remember@thechief/settings.py
```

→ **Apps Tab** → **Blacklist Management** → **Add Application**

**Find WM_CLASS**:

```bash
# Method 1: xprop (interactive)
xprop WM_CLASS
# Click on the window

# Output (example)
WM_CLASS(STRING) = "firefox", "Firefox"
                      ^          ^
                   Instance    Class

# Method 2: wmctrl
wmctrl -lx | grep "firefox"

# Method 3: All running windows
wmctrl -lx
```

**Which name to use?**
- Use the **second value** (Class): `"Firefox"`
- With lowercase: `"firefox"` also works
- Case is often ignored

---

#### How do I change launch flags for Session Restore?

**Launch flags** control how applications are started during Session Restore.

**Open Python Settings UI**:
```bash
python3 ~/.local/share/cinnamon/extensions/remember@thechief/settings.py
```

**Apps Tab → Select Application**:

**Firefox Example**:
```
┌─────────────────────────────────────┐
│ Firefox                              │
├─────────────────────────────────────┤
│ ✅ Enable Autostart                  │
│ ✅ Firefox Session Restore           │
│                                      │
│ Launch Command:                      │
│ firefox --restore-session            │
└─────────────────────────────────────┘
```

**Available Flags**:

| App | Flag | Description |
|-----|------|--------------|
| **Firefox** | `--restore-session` | Restores browser tabs |
| **Chrome** | `--restore-last-session` | Opens last session |
| **Brave** | `--restore-last-session` | Opens last session |
| **VS Code** | `--reuse-window` | Uses existing window |
| **LibreOffice** | `/path/to/file.odt` | Opens specific document |

**Add custom flags**:

Edit `~/.config/remember@thechief/extension-settings.json`:

```json
{
  "launchFlags": {
    "firefoxSessionRestore": true,
    "customFlag": true
  }
}
```

---

#### How do I disable Session Restore for a specific app?

**Python Settings UI**:

1. Open Settings: `python3 ~/.local/share/cinnamon/extensions/remember@thechief/settings.py`
2. Go to **Apps Tab**
3. Select the application
4. Disable **"Enable Autostart"**

**Or manually** in `extension-settings.json`:

```json
{
  "autostart": {
    "firefox": true,
    "thunderbird": false,  ← Disabled
    "code": true
  }
}
```

---

### Problems & Solutions

#### Extension does not start

**Symptoms**:
- Extension does not appear in the list
- Error messages when enabling
- Extension immediately turns off again

**Solution Steps**:

**1. Check logs**:
```bash
tail -f ~/.xsession-errors | grep "remember@thechief"
```

**2. Reinstall extension**:
```bash
# Remove old version
rm -rf ~/.local/share/cinnamon/extensions/remember@thechief/

# Reinstall via Cinnamon Spices
# System Settings → Extensions → Download → Remember
```

**3. Restart Cinnamon**:
```bash
# Method 1: Keyboard shortcut
Ctrl + Alt + Esc

# Method 2: Terminal
cinnamon --replace &

# Method 3: Logout and login again
```

**4. Check permissions**:
```bash
# Extension directory
ls -la ~/.local/share/cinnamon/extensions/remember@thechief/

# Config directory
ls -la ~/.config/remember@thechief/
```

All files should **belong to your user**.

**5. Check dependencies**:
```bash
# Python 3 (for Settings UI)
python3 --version

# GTK 3 (for Settings UI)
dpkg -l | grep python3-gi
```

---

#### Window is not restored

**Symptoms**:
- Window opens at default position instead of saved position
- Only some windows are restored

**Checklist**:

**1. Extension enabled?**
```bash
# Check
cinnamon-settings extensions

# → "Window Position Remember" must be enabled
```

**2. Auto-Restore enabled?**
```
System Settings → Extensions → Remember → Configure
→ "Auto-restore positions on window open" ✅
```

**3. Was the window saved?**

Wait **30 seconds** after positioning, or:
```
Applet → Save All
```

**4. Check blacklist**:
```bash
# Open settings
cinnamon-settings extensions remember@thechief

# → Blacklist Tab
# → Check if app is excluded
```

**5. Check logs**:
```bash
tail -f ~/.xsession-errors | grep "remember@thechief"
```

Look for:
- `Restoring window: [App-Name]`
- Error messages

**6. Check saved data**:
```bash
cat ~/.config/remember@thechief/positions.json | jq '.applications["Firefox"] // .applications["firefox"]'
```

If **empty** or **null**: Window was not saved (see point 3).

---

#### Window is restored at wrong position

**Symptoms**:
- Window appears partially off-screen
- Window on wrong monitor
- Window too large or too small

**Possible Causes & Solutions**:

**1. Monitor layout changed**

```
Problem: Monitor removed/added/rearranged
Solution: Enable clamp-to-screen
```

```
System Settings → Extensions → Remember → Behavior
→ "Clamp windows to screen bounds" ✅
```

**2. Resolution changed**

```
Problem: Monitor resolution changed (e.g., 1920x1080 → 2560x1440)
Solution: Enable use-percentage (default)
```

```
System Settings → Extensions → Remember → Behavior
→ "Use percentage-based positioning" ✅
```

**3. Window was manually moved**

```
Problem: Window was moved after saving
Solution: Save new position
```

1. Reposition window
2. Wait 30 seconds or click **"Save All"**
3. Test: Close window and reopen

**4. Restore delay too short**

```
Problem: Window is not ready yet
Solution: Increase restore delay
```

```
System Settings → Extensions → Remember → Behavior
→ Restore delay: 800ms (instead of 500ms)
```

Especially important for **slow apps** (LibreOffice, GIMP).

**5. Restore backup**

```
If nothing helps: Use old backup
```

```bash
# View backups
ls -lh ~/.config/remember@thechief/positions_backup_*.json

# Restore (disable extension first!)
cp ~/.config/remember@thechief/positions_backup_20260119_143000.json \
   ~/.config/remember@thechief/positions.json
```

---

#### Session Restore does not work

**Symptoms**:
- Applications do not start at login
- Only some apps are started
- Apps start, but without windows

**Checklist**:

**1. Auto-Launch enabled?**
```
System Settings → Extensions → Remember → General
→ "Auto-launch session on login" ✅
```

**2. Capture-Cmdline enabled?**
```
System Settings → Extensions → Remember → General
→ "Capture command line arguments" ✅
```

**3. Per-App Autostart enabled?**

```bash
python3 ~/.local/share/cinnamon/extensions/remember@thechief/settings.py
```

→ **Apps Tab** → Select application → **"Enable Autostart"** ✅

**4. Launch Command correct?**

Check `extension-settings.json`:
```bash
cat ~/.config/remember@thechief/extension-settings.json | jq
```

**Example**:
```json
{
  "autostart": {
    "firefox": true,
    "code": true
  }
}
```

**5. Check timeouts**

**Browsers/IDEs** have longer timeouts (2 min):
- Firefox: 120 seconds
- VS Code: 90 seconds
- Thunderbird: 120 seconds

Wait **2-3 minutes** after login before reporting problems.

**6. Check logs**:
```bash
tail -f ~/.xsession-errors | grep "remember@thechief"
```

Look for:
- `Launching application: [App]`
- `Timeout waiting for window: [App]`
- Error messages

**7. Flatpak problems**

```
Problem: Flatpak apps do not start
Solution: Check Flatpak installation
```

```bash
# List Flatpak apps
flatpak list

# Example: Firefox
flatpak run org.mozilla.firefox
```

**Correct command-line**:
```json
{
  "cmdline": "flatpak run org.mozilla.firefox"
}
```

**Wrong**:
```json
{
  "cmdline": "/usr/bin/firefox"  ← Does not work for Flatpak
}
```

---

#### Applet shows no data / does not respond

**Symptoms**:
- Applet shows "0 windows tracked"
- Clicks on applet do not work
- Applet appears empty

**Solution Steps**:

**1. Extension enabled?**
```
System Settings → Extensions
→ "Window Position Remember" must be enabled
```

**2. Restart applet**:
```bash
# Method 1: Restart panel
Right-click on Panel → "Troubleshoot" → "Restart Cinnamon"

# Method 2: Remove and re-add applet
Right-click on Panel → "Applets to the panel"
→ Remove Remember → Re-add
```

**3. Check extension API**:

Open **Looking Glass** (`Alt+F2` → `lg`):
```javascript
// In "Evaluator" tab
global.log(Main.windowRemember);

// Should output: [object Object]
// If undefined: Extension not loaded correctly
```

**4. Check logs**:
```bash
tail -f ~/.xsession-errors | grep -E "(remember@thechief|remember-applet)"
```

---

#### Too much data / performance problems

**Symptoms**:
- `positions.json` becomes very large (> 1 MB)
- Auto-Save slows down system
- Cinnamon startup delayed

**Solution Steps**:

**1. Exclude dialogs**:
```
System Settings → Extensions → Remember → General
→ "Track dialog windows" ❌ (disable)
```

**2. Delete old data**:

```bash
# Python Settings UI
python3 ~/.local/share/cinnamon/extensions/remember@thechief/settings.py
```

→ **Windows Tab** → Delete old/unused windows

**3. Extend blacklist**:

Add **temporary apps** to the blacklist:
```
nemo-desktop
cinnamon-settings-*
gnome-calculator
xfce4-appfinder
```

**4. Delete all data**:

```bash
# WARNING: Deletes all saved positions!
rm ~/.config/remember@thechief/positions.json

# Restart Cinnamon
cinnamon --replace &
```

**5. Increase save delay**:
```
System Settings → Extensions → Remember → Behavior
→ Save delay: 2000ms (instead of 1000ms)
```

Reduces I/O load on slower systems.

---

### Advanced Topics

#### How can I synchronize data between computers?

**Method 1: Cloud Sync (Dropbox, Nextcloud, etc.)**

```bash
# Move original directory to cloud
mv ~/.config/remember@thechief ~/Dropbox/remember-config

# Create symlink
ln -s ~/Dropbox/remember-config ~/.config/remember@thechief
```

**On second computer**:
```bash
# Create symlink
ln -s ~/Dropbox/remember-config ~/.config/remember@thechief
```

**⚠️ Warning**:
- **Monitor EDIDs** are different between computers
- Only useful with **identical hardware setup**
- Can lead to **conflicts** (auto-save on both computers)

**Method 2: Git Repository (for developers)**

```bash
cd ~/.config/remember@thechief/
git init
git add positions.json extension-settings.json
git commit -m "Initial commit"

# Add remote
git remote add origin https://github.com/user/remember-config.git
git push -u origin main
```

**On second computer**:
```bash
cd ~/.config/
git clone https://github.com/user/remember-config.git remember@thechief
```

**Sync**:
```bash
cd ~/.config/remember@thechief/
git pull  # Fetch changes
git add .
git commit -m "Update"
git push  # Upload changes
```

---

#### How do I debug extension problems?

**1. Looking Glass (Cinnamon Debugger)**

```
Alt + F2 → lg → Enter
```

**Tabs**:
- **Evaluator**: Execute JavaScript code
- **Log**: Show extension logs
- **Windows**: Inspect all windows

**Useful Commands** (Evaluator Tab):
```javascript
// Show extension object
global.log(Main.windowRemember);

// All tracked windows
global.log(Main.windowRemember.tracker.windows);

// Get stats
global.log(Main.windowRemember.getStats());

// Trigger Save All
Main.windowRemember.saveAll();

// Trigger Restore All
Main.windowRemember.restoreAll();
```

**2. Filter extension logs**

```bash
# Only extension logs
tail -f ~/.xsession-errors | grep "remember@thechief"

# With colors (if grc is installed)
tail -f ~/.xsession-errors | grep --color=always "remember@thechief"

# Save to file
tail -f ~/.xsession-errors | grep "remember@thechief" > ~/remember-debug.log
```

**3. Enable verbose logging**

Edit `extension.js`:
```javascript
const DEBUG = true;  // Line at the beginning of the file

// Then restart
cinnamon --replace &
```

**4. Inspect saved data**

```bash
# Formatted nicely
cat ~/.config/remember@thechief/positions.json | jq

# Only Firefox windows
cat ~/.config/remember@thechief/positions.json | jq '.applications["Firefox"] // .applications["firefox"]'

# Only monitor data
cat ~/.config/remember@thechief/positions.json | jq '.monitors'

# Number of tracked applications
cat ~/.config/remember@thechief/positions.json | jq '.applications | length'
```

---

#### How do I create a bug report?

**GitHub Issues**: https://github.com/carsteneu/remember/issues

**Please provide the following information**:

**1. System information**:
```bash
# Cinnamon version
cinnamon --version

# Linux distribution
lsb_release -a

# Kernel version
uname -r

# Monitor setup
xrandr --verbose | grep -A 5 "connected"
```

**2. Extension version**:
```bash
cat ~/.local/share/cinnamon/extensions/remember@thechief/metadata.json | jq '.version'
```

**3. Logs**:
```bash
# Extract relevant logs
grep "remember@thechief" ~/.xsession-errors | tail -n 50 > ~/remember-logs.txt
```

**4. Config files** (optional):
```bash
# positions.json (if relevant)
cat ~/.config/remember@thechief/positions.json | jq > ~/positions-debug.json
```

**⚠️ Privacy**: Remove **sensitive paths** and **command-lines** before uploading!

**5. Steps to reproduce**:
- What did you do?
- What was the expected result?
- What happened instead?
- Does the problem always occur or only sometimes?

---

## Summary

The **most common problems** and their solutions:

| Problem | Solution |
|---------|--------|
| Extension does not start | Check logs, reinstall, restart Cinnamon |
| Window not restored | Enable `auto-restore`, wait 30s, check blacklist |
| Wrong position | Enable `clamp-to-screen`, increase restore delay |
| Session Restore does not work | Enable `auto-launch` + `capture-cmdline`, check per-app autostart |
| Applet shows no data | Enable extension, restart applet |
| Performance problems | Exclude dialogs, delete old data, increase save delay |

**Further help**:
- [Getting Started](getting-started.md)
- [Features](features.md)
- [Configuration](configuration.md)
- **GitHub Issues**: https://github.com/carsteneu/remember/issues

---

**For further questions**: Create a **GitHub Issue** with detailed information!
