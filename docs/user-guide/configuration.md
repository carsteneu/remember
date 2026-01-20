# Configuration - Window Position Remember

This guide explains all configuration options of the **Window Position Remember** extension.

## Overview

The extension provides **two configuration interfaces**:

1. **Cinnamon Settings** - Basic settings (Built-in)
2. **Python Settings UI** - Advanced settings with GUI

---

## Cinnamon Settings (System Settings)

### Access

```
System Settings → Extensions → Window Position Remember → Configure (⚙️)
```

Or via terminal:
```bash
cinnamon-settings extensions remember@thechief
```

---

## Settings Overview

### General

#### Window Tracking

**track-all-workspaces**
- **Type**: Switch (On/Off)
- **Default**: Enabled ✅
- **Description**: Tracks windows on all workspaces
- **Recommendation**: Enabled for multi-workspace users

```
✅ Enabled: All windows on all workspaces are tracked
❌ Disabled: Only windows on the current workspace
```

**track-dialogs**
- **Type**: Switch
- **Default**: Disabled ❌
- **Description**: Also tracks dialog windows
- **Recommendation**: Disabled (dialogs are temporary)

```
⚠️ Warning: Enabling increases data volume significantly
Only enable for special use cases
```

---

#### Session Management

**auto-restore**
- **Type**: Switch
- **Default**: Enabled ✅
- **Description**: Automatically restores window positions on opening
- **Recommendation**: Enabled (main function of the extension)

```
✅ Enabled: Windows are automatically positioned
❌ Disabled: Manual restoration via applet
```

**auto-launch**
- **Type**: Switch
- **Default**: Disabled ❌
- **Description**: Automatically starts saved applications on login
- **Recommendation**: Enable for complete session restore

```
⚠️ Important: Requires "capture-cmdline" for best results
```

**Activation Workflow**:
1. Enable `auto-launch`
2. Enable `capture-cmdline`
3. Open applications
4. On next login all apps will start automatically

**capture-cmdline**
- **Type**: Switch
- **Default**: Enabled ✅
- **Description**: Saves command-line arguments for session restore
- **Recommendation**: Enabled for best session restore quality

```javascript
// Example: Saved command-line (from positions.json)
{
  "cmdline": [
    "/usr/bin/firefox",
    "--private-window",
    "https://example.com"
  ],
  "working_dir": "/home/user"
}
```

**Privacy**: Command-lines may contain sensitive paths. Check if needed:
```bash
cat ~/.config/remember@thechief/positions.json | jq '.applications[] | .instances[]? | .cmdline[]?'
```

---

### Behavior

#### Timing

**save-delay**
- **Type**: Spinbutton (Number field)
- **Default**: 1000ms (1 second)
- **Range**: 100ms - 5000ms
- **Description**: Delay before saving (debouncing)
- **Recommendation**: 1000ms (default)

```
Too short (< 500ms):  Many write operations (I/O load)
Optimal (1000ms):     Balance between response and performance
Too long (> 3000ms):  Changes lost on crash
```

**Use Cases**:
- **Fast systems**: 500ms
- **Standard**: 1000ms
- **Slow HDDs**: 2000ms

**restore-delay**
- **Type**: Spinbutton
- **Default**: 500ms
- **Range**: 100ms - 2000ms
- **Description**: Delay before restoring position
- **Recommendation**: 500ms

```
Too short (< 200ms):  Window may not be ready yet
Optimal (500ms):      Reliable restoration
Too long (> 1000ms):  Visible window "jumping"
```

**Adjustment for slow apps**:
```
LibreOffice, GIMP: 800-1000ms
Firefox, Chrome:   500ms (default)
Gedit, Kate:       300ms
```

---

#### Restore Behavior

**use-percentage**
- **Type**: Switch
- **Default**: Enabled ✅
- **Description**: Saves positions as percentage of monitor size
- **Recommendation**: Enabled for multi-resolution setups

```
✅ Percentage (default):
  - 50% width on 1920x1080 = 960px
  - 50% width on 2560x1440 = 1280px
  → Windows adapt automatically

❌ Absolute (pixels):
  - Windows always at exact same pixel coordinates
  → Only for fixed monitor setups
```

**Example calculation**:
```javascript
// Save as percentage
percentX = (x / monitorWidth) * 100
percentY = (y / monitorHeight) * 100

// Restore
x = (percentX / 100) * monitorWidth
y = (percentY / 100) * monitorHeight
```

**clamp-to-screen**
- **Type**: Switch
- **Default**: Enabled ✅
- **Description**: Ensures windows are always visible
- **Recommendation**: Enabled

```
✅ Enabled:
  - Windows are moved to visible area
  - Prevents "lost" windows when monitor changes

❌ Disabled:
  - Windows can be outside screen
  - Only for debugging/development
```

**Use case - Monitor removed**:
```
Before: 3 monitors, window on monitor 3
After: 2 monitors
→ With clamp-to-screen: Window on monitor 2
→ Without clamp-to-screen: Window invisible
```

**restore-workspace**
- **Type**: Switch
- **Default**: Enabled ✅
- **Description**: Moves windows to their original workspace
- **Recommendation**: Enabled for workspace organization

```
✅ Enabled:
  - Window on workspace 2 → Opens on workspace 2
  - Maintains your workspace organization

❌ Disabled:
  - All windows open on current workspace
  - Useful for flexible workspace usage
```

---

#### Window States

**remember-sticky**
- **Type**: Switch
- **Default**: Enabled ✅
- **Description**: Saves "On all workspaces" status

```javascript
// Enable sticky
Right-click on titlebar → "On all workspaces"

// On next opening
Window is automatically visible on all workspaces
```

**remember-always-on-top**
- **Type**: Switch
- **Default**: Enabled ✅
- **Description**: Saves "Always on top" status

**Use cases**:
- Note apps (always visible)
- Media players (above other windows)
- System monitors

**remember-shaded**
- **Type**: Switch
- **Default**: Disabled ❌
- **Description**: Saves "Rolled up" status

```javascript
// Enable rolled up mode
Double-click on titlebar

// Window is shown only as titlebar
```

**Why disabled?**
Most users want windows **not rolled up** on session restore.

**remember-fullscreen**
- **Type**: Switch
- **Default**: Enabled ✅
- **Description**: Saves fullscreen mode

```
F11 or right-click → "Fullscreen"
→ Window will start in fullscreen on next opening
```

**restore-minimized**
- **Type**: Switch
- **Default**: Disabled ❌
- **Description**: Restores windows minimized

**Why disabled?**
Session restore should make apps **visible**, not minimized.

```
✅ Disabled (default): Minimized windows open normally
❌ Enabled: Windows open minimized (usually unwanted)
```

---

### Blacklist (Excluded Applications)

**blacklist-info**
- **Type**: Label (Information text)
- **Description**: Instructions for blacklist usage

**blacklist**
- **Type**: Textview (Multi-line text field)
- **Default**: Empty
- **Description**: WM_CLASS names of excluded applications

**Format**:
```
# One WM_CLASS per line
cinnamon-settings
gnome-calculator
nemo-desktop
```

**Find WM_CLASS**:
```bash
# Method 1: xprop
xprop WM_CLASS
# Then click on the window

# Method 2: wmctrl
wmctrl -lx | grep "ApplicationName"

# Example output
WM_CLASS(STRING) = "firefox", "Firefox"
                      ^          ^
                   Instance    Class
```

**Commonly excluded apps**:
```
cinnamon-settings         # System settings
nemo-desktop             # Desktop icons
gnome-calculator         # Calculator
xfce4-appfinder          # App finder
```

**Automatically excluded**:
- Extension settings dialog (`settings.py`)
- System dialogs (`cinnamon-settings-*`)

---

## Python Settings UI (Advanced Settings)

### Access

**Via System Settings**:
```
Extensions → Remember → Configure (click ⚙️ icon)
```

**Via Terminal**:
```bash
cd ~/.local/share/cinnamon/extensions/remember@thechief/
python3 settings.py
```

---

### Tabs Overview

The Python GUI provides **4 tabs**:

1. **Overview** - Dashboard with statistics
2. **Windows** - All saved windows
3. **Apps** - Application configuration
4. **About** - About the extension

---

### Tab 1: Overview

**Dashboard with Quick Stats**:

```
┌─────────────────────────────────────┐
│ Window Position Remember            │
├─────────────────────────────────────┤
│ Tracked Applications:  12           │
│ Total Windows:         24           │
│ Monitors:              2            │
│ Last Save:             2 min ago    │
└─────────────────────────────────────┘
```

**Quick Actions**:
- **Save All** - Saves all windows immediately
- **Restore All** - Restores all positions
- **Clear All Data** - Deletes all saved data (with confirmation)
- **Open Backup** - Opens backup directory

**Monitor Information**:
```
Monitor 1: Dell U2720Q (EDID: abc123...)
  Resolution: 3840x2160
  Position: 0,0

Monitor 2: LG 27UK850 (EDID: def456...)
  Resolution: 3840x2160
  Position: 3840,0
```

---

### Tab 2: Windows

**Consolidated Window Overview**:

Shows all saved windows with **all instances** in one view.

**Columns**:
| Column | Description |
|--------|--------------|
| **App** | WM_CLASS (e.g. "firefox") |
| **Title** | Window title |
| **Position** | X, Y coordinates |
| **Size** | Width × Height |
| **Monitor** | Monitor name or EDID |
| **Workspace** | Workspace number |
| **Sticky** | 🔒 if sticky |
| **Top** | 📌 if always-on-top |
| **Fullscreen** | ⛶ if fullscreen |

**Features**:
- **Filter by App**: Dropdown selection
- **Search**: Window title search
- **Sorting**: Sort by columns
- **Delete**: Remove individual windows
- **Restore**: Restore individual window

**Example View**:
```
┌──────────┬─────────────────────┬──────────┬─────────┬──────────┬────────┐
│ App      │ Title               │ Position │ Size    │ Monitor  │ Sticky │
├──────────┼─────────────────────┼──────────┼─────────┼──────────┼────────┤
│ firefox  │ GitHub - Firefox    │ 100,50   │ 1200×800│ HDMI-1   │        │
│ code     │ Project - VS Code   │ 200,100  │ 1600×900│ DP-1     │ 🔒     │
│ nemo     │ Home - Nemo         │ 300,150  │ 1000×600│ HDMI-1   │        │
└──────────┴─────────────────────┴──────────┴─────────┴──────────┴────────┘
```

---

### Tab 3: Apps (Applications)

**Session Configuration per Application**:

#### Application List

List of all tracked applications with:
- **Name** (WM_CLASS)
- **Display Name** (readable name)
- **Instances** (number of open windows)
- **Autostart** (On/Off toggle)

**Example**:
```
┌─────────────────────────────────────────────────┐
│ Application          Instances   Autostart      │
├─────────────────────────────────────────────────┤
│ Firefox              2           ✅ Enabled     │
│ VS Code              1           ✅ Enabled     │
│ LibreOffice Writer   1           ❌ Disabled    │
│ Thunderbird          2           ✅ Enabled     │
│ Nemo                 3           ❌ Disabled    │
└─────────────────────────────────────────────────┘
```

#### Launch Flags Configuration

**Per-app settings** for session restore:

**Firefox**:
```
┌─────────────────────────────────────┐
│ Firefox                              │
├─────────────────────────────────────┤
│ ✅ Enable Autostart                  │
│ ✅ Firefox Session Restore           │
│                                      │
│ Launch Command:                      │
│ firefox --restore-session            │
│                                      │
│ Timeout: 120 seconds                 │
│ Grace Period: 60 seconds             │
└─────────────────────────────────────┘
```

**Available Flags per App**:

| App | Flag | Description |
|-----|------|--------------|
| **Firefox** | `--restore-session` | Restores browser tabs |
| **Chrome** | `--restore-last-session` | Opens last session |
| **Brave** | `--restore-last-session` | Opens last session |
| **VS Code** | `--reuse-window` | Uses existing window |
| **LibreOffice** | `--writer`, `--calc`, etc. | Opens specific component |

#### Instance Management

**Configurable per instance**:
- **Enable/disable autostart**
- **Edit launch command**
- **Add custom flags**
- **Delete instance**

**Example - Multiple Firefox instances**:
```
Instance 1:
  Command: firefox --restore-session
  Autostart: ✅ Enabled

Instance 2:
  Command: firefox --private-window
  Autostart: ❌ Disabled
```

#### Blacklist Management

**Graphical blacklist management**:

```
┌─────────────────────────────────────┐
│ Excluded Applications                │
├─────────────────────────────────────┤
│ ➕ Add Application                   │
│                                      │
│ • cinnamon-settings      [Remove]    │
│ • gnome-calculator       [Remove]    │
│ • nemo-desktop           [Remove]    │
│                                      │
│ [ Application Name... ]  [Add]       │
└─────────────────────────────────────┘
```

**Auto-Suggest**:
While typing, running applications are suggested.

---

### Tab 4: About

**Information**:
- Extension version
- Author
- License (MIT)
- GitHub link
- Bug reports

**Buttons**:
- **Open GitHub** - Opens repository
- **Report Issue** - Opens GitHub issues
- **View Documentation** - Opens docs

---

## Data Storage

### File Structure

```
~/.config/remember@thechief/
├── positions.json                      # Window positions & monitors
├── preferences.json                    # UI preferences
├── extension-settings.json             # Launch flags & autostart
├── positions_backup_20260119_143000.json  # Automatic backups
├── positions_backup_20260119_150000.json
└── positions_backup_latest.json        # Latest backup
```

### positions.json

**Main file** with all window data:

```json
{
  "version": 4,
  "lastSave": "2026-01-19T15:30:00.000Z",
  "monitors": {
    "abc123...": {
      "connector": "HDMI-1",
      "edid": "abc123...",
      "resolution": "1920x1080",
      "position": "0,0",
      "primary": true
    }
  },
  "applications": {
    "Firefox": {
      "wm_class": "Firefox",
      "desktop_file": "firefox.desktop",
      "desktop_exec": "/usr/bin/firefox %u",
      "instances": [
        {
          "id": "Firefox-1737368400000",
          "stable_sequence": 1,
          "x11_window_id": "0x4000001",
          "title_pattern": null,
          "title_snapshot": "GitHub - Mozilla Firefox",
          "cmdline": [
            "/usr/bin/firefox",
            "--restore-session"
          ],
          "working_dir": "/home/user",
          "monitor_index": 0,
          "geometry_percent": {
            "x": 5.2,
            "y": 4.6,
            "width": 62.5,
            "height": 74.0
          },
          "geometry_absolute": {
            "x": 100,
            "y": 50,
            "width": 1200,
            "height": 800
          },
          "workspace": 0,
          "maximized": false,
          "autostart": true,
          "assigned": true,
          "monitor_id": "edid:abc123...",
          "sticky": false,
          "shaded": false,
          "alwaysOnTop": false,
          "fullscreen": false,
          "skipTaskbar": false,
          "minimized": false
        }
      ]
    }
  }
}
```

**Important**: This file is automatically updated by the extension on window changes (with debouncing interval of save-delay).

### preferences.json

**UI settings** (from Python Settings UI):

```json
{
  "window": {
    "width": 1200,
    "height": 800,
    "x": 100,
    "y": 50
  },
  "tabs": {
    "lastActive": "apps"
  },
  "filters": {
    "showOnlyAutostart": false
  }
}
```

**Separate from extension** - prevents conflicts with auto-save.

### extension-settings.json

**Launch flags** for session restore:

```json
{
  "launchFlags": {
    "firefoxSessionRestore": true,
    "chromeSessionRestore": false,
    "vscodeReuseWindow": true
  },
  "autostart": {
    "firefox": true,
    "code": true,
    "thunderbird": false
  }
}
```

**Separate from extension** - only managed by Apps tab.

---

## Backup System

### Automatic Backups

**Created on**:
- Cinnamon restart
- Logout/shutdown
- Before major changes (Clear All Data)

**Backup Format**:
```
positions_backup_YYYYMMDD_HHMMSS.json
Example: positions_backup_20260119_143000.json
```

**Retention**:
- Last **10 backups**: Kept
- **Older backups**: Automatically deleted
- **Additionally**: `positions_backup_latest.json` (always overwritten)

### Manual Backups

**Create backup**:
```bash
cp ~/.config/remember@thechief/positions.json \
   ~/.config/remember@thechief/positions_backup_manual_$(date +%Y%m%d_%H%M%S).json
```

**Restore backup**:
```bash
# Stop extension
cinnamon-settings extensions remember@thechief
# → Disable extension

# Copy backup
cp ~/.config/remember@thechief/positions_backup_20260119_143000.json \
   ~/.config/remember@thechief/positions.json

# Re-enable extension
```

---

## Best Practices

### Recommended Settings for Different Scenarios

#### Scenario 1: Laptop User (changing monitors)

```
✅ use-percentage: Enabled
✅ clamp-to-screen: Enabled
✅ auto-restore: Enabled
✅ restore-workspace: Enabled
❌ auto-launch: Disabled (prefer manual start)
```

#### Scenario 2: Desktop with fixed multi-monitor setup

```
✅ use-percentage: Enabled (or Disabled for pixel-perfect)
✅ clamp-to-screen: Enabled
✅ auto-restore: Enabled
✅ auto-launch: Enabled (complete session restore)
✅ capture-cmdline: Enabled
✅ restore-workspace: Enabled
```

#### Scenario 3: Minimalist (only position restore, no session restore)

```
✅ auto-restore: Enabled
❌ auto-launch: Disabled
❌ capture-cmdline: Disabled (saves memory)
✅ clamp-to-screen: Enabled
```

#### Scenario 4: Developer (many IDEs/editors)

```
✅ auto-restore: Enabled
✅ auto-launch: Enabled
✅ capture-cmdline: Enabled
✅ use-percentage: Enabled
restore-delay: 800ms (for slow IDEs)
```

---

## Troubleshooting

### Settings are not being saved

**Cause**: Extension overwrites changes with auto-save

**Solution**:
1. Use **Python Settings UI** for launch flags
2. Cinnamon Settings only for extension options

### Session restore doesn't work

**Checklist**:
```
✅ auto-launch enabled?
✅ capture-cmdline enabled?
✅ Application in Apps tab set to autostart?
✅ Launch flags configured correctly?
✅ Check logs: ~/.xsession-errors
```

### Window appears at wrong position

**Check**:
```
clamp-to-screen: Enabled? (moves window to visible area)
use-percentage: Correct for your setup?
Monitor layout changed? (check backups)
```

---

## Summary

**Window Position Remember** provides comprehensive configuration:

✅ **Cinnamon Settings**: Basic options (tracking, timing, restore)
✅ **Python Settings UI**: Advanced settings (apps, launch flags, blacklist)
✅ **3 JSON files**: Separate data storage (extension, UI, launch flags)
✅ **Automatic backups**: Last 10 backups are kept

All settings are **documented**, **configurable**, and **persistent**.

---

**More Information**:
- [Getting Started](getting-started.md)
- [Features](features.md)
- [FAQ](faq.md)
