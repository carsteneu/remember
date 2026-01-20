# Features - Window Position Remember

This extension offers comprehensive features for saving and restoring window positions in the Cinnamon Desktop.

## Overview

**Window Position Remember** is a powerful Cinnamon Extension that:

- ✅ **Automatically** saves window positions (every 30 seconds)
- ✅ Fully supports **multi-monitor setups**
- ✅ **Session restore** with automatic application launch on login
- ✅ **Smart window matching** for reliable restoration
- ✅ Saves **window states** (sticky, always-on-top, fullscreen, etc.)
- ✅ **15 pre-configured plugins** for optimal app integration
- ✅ **Blacklist system** for excluded applications

---

## 1. Window Position Tracking

### Automatic Saving

The extension tracks windows automatically in the background:

**Auto-Save Mechanism**:
- **Interval**: Every 30 seconds
- **Dirty-Flag System**: Only changed windows are saved (reduces I/O)
- **No manual action required**

**What is saved**:
```json
{
  "x": 100,              // X coordinate
  "y": 50,               // Y coordinate
  "width": 1200,         // Window width
  "height": 800,         // Window height
  "monitor": "edid:abc123", // Monitor identification
  "workspace": 0,        // Workspace number
  "sticky": false,       // Visible on all workspaces
  "alwaysOnTop": false,  // Always in foreground
  "fullscreen": false,   // Fullscreen mode
  "shaded": false        // Rolled up
}
```

### Cleanup During Save

During automatic saving, these are cleaned up:
- **Orphaned Instances**: Windows closed by the user
- **Duplicates**: Multiple entries for the same `x11_window_id`
- **Invalid Entries**: Null geometry or corrupt data

### Pause Mechanism

Auto-save is paused during:
- **Session Restore**: Prevents data corruption during startup
- **Shutdown**: Safe data rescue during shutdown

---

## 2. Multi-Monitor Support

### EDID-based Monitor Identification

**EDID (Extended Display Identification Data)** is the primary identification method:

```bash
# Read monitor EDID
xrandr --verbose | grep -A 10 "connected"
```

**Advantages**:
- Each monitor has a **unique hardware ID**
- Works even after **monitor changes**
- Independent of **connector names** (HDMI-1, DP-2, etc.)
- Works with **monitor rearrangement**

### Fallback Mechanisms

If EDID is not available:

1. **Connector + Resolution**: `"HDMI-1_1920x1080"`
2. **Monitor Index**: `"monitor_0"`, `"monitor_1"`, etc.

### Resolution-Independent Positioning

**Percentage-based (Default)**:

Positions are saved as **percentage of monitor size**:

```javascript
percentX = (x / monitorWidth) * 100
percentY = (y / monitorHeight) * 100
```

**Advantages**:
- Windows **automatically** adapt to new resolutions
- Ideal for **laptop users** (changing monitor configurations)
- Works with **DPI changes**

**Example**:
- Monitor 1: 1920x1080 → Window at 50% width = 960px
- Monitor 2: 2560x1440 → Window at 50% width = 1280px

**Absolute Positioning**:

Disable `use-percentage` for pixel-perfect restoration:
- Windows are placed at **exact** pixel coordinates
- Only makes sense with **fixed monitor setups**

### Clamp-to-Screen

`clamp-to-screen` ensures windows are **always visible**:

- Prevents windows **outside the screen**
- Adjusts position if monitor was removed
- Recommended: **Enabled** (default)

---

## 3. Session Restore / Auto-Launch

### How It Works

With **Auto-Launch**, applications are automatically started on login:

1. **Cinnamon starts**
2. Extension waits **2 seconds** (desktop stabilization)
3. **Each saved application** is launched sequentially
4. **Delay**: 500ms between window starts
5. **Positions are automatically restored**

### Activation

```
System Settings → Extensions → Remember → Configure
→ Enable "Auto-launch session on login"
```

### Launch Flags

Advanced configuration via **Python Settings UI**:

```bash
python3 ~/.local/share/cinnamon/extensions/remember@thechief/settings.py
```

**Apps Tab → Launch Flags**:

| Application | Flags | Description |
|-------------|-------|-------------|
| Firefox | `--restore-session` | Restores browser tabs |
| Chrome | `--restore-last-session`<br>`--disable-session-crashed-bubble` | Opens last session<br>Suppresses "crash" dialog |
| Brave | `--restore-last-session`<br>`--disable-session-crashed-bubble` | Opens last session<br>Suppresses "crash" dialog |
| VS Code | - | No special flags |

### Single-Instance Apps

**Browsers and IDEs** have special handling:

- **Timeout**: 2 minutes (instead of 30 seconds)
- **Grace Period**: 1 minute after timeout
- **Reason**: These apps restore **their own windows**

**Configuration** (`config.json`):

```json
{
  "features": {
    "isSingleInstance": true,
    "timeout": 120000,      // 2 minutes
    "gracePeriod": 60000    // 1 minute
  }
}
```

### Max Instances

**Safety limit**: 5 instances per application

Prevents **runaway launches** if an app fails to start.

---

## 4. Smart Window Matching

### Matching Strategies (Priority)

The extension uses multiple strategies to correctly match windows:

#### 1. Stable Sequence (Highest Priority)

Unique sequence number **within a session**:

- Assigned on first tracking
- **Most reliable method** during the same Cinnamon session
- Lost on Cinnamon restart

#### 2. X11 Window ID

Persistent X11 window ID:

- **Survives Cinnamon restarts** (`Alt+F2` → `r`)
- Lost on **re-login**
- Second priority

#### 3. Exact Title Match

Exact match of **window title**:

- Only for **not yet matched instances**
- Works after **re-login**
- Good for apps with **unique titles**

**Example**:
- LibreOffice: "Document1.odt - LibreOffice Writer"
- Firefox: "GitHub - Mozilla Firefox"

#### 4. First Unassigned Instance

**Order-based fallback**:

- When no other strategy matches
- Uses **order** of window opening
- Less reliable, but always works

#### 5. Create New Instance

**Create new instance**:

- Only when **no match** found
- Creates new tracking entry

### Title Stabilization Delay

Some apps change their title **after opening**:

**VS Code Example**:
1. Opens with title: "Visual Studio Code"
2. After 1 second: "ProjectName - Visual Studio Code"

**Solution**: `titleStabilizationDelay` in `config.json`:

```json
{
  "features": {
    "titleStabilizationDelay": 1500  // Wait 1.5 seconds
  }
}
```

---

## 5. Window State Saving

### Sticky (On All Workspaces)

**Setting**: `remember-sticky` (Default: **enabled**)

Saves whether a window is visible on **all workspaces**:

```javascript
// Enable sticky: Right-click title bar → "On all workspaces"
```

**Restoration**:
- Window is automatically shown on all workspaces

### Always-on-Top (Always in Foreground)

**Setting**: `remember-always-on-top` (Default: **enabled**)

Saves "Always on Top" status:

```javascript
// Enable: Right-click title bar → "Always on top"
```

**Use cases**:
- **Note apps** (always visible)
- **Media players** (above other windows)

### Shaded (Rolled Up)

**Setting**: `remember-shaded` (Default: **disabled**)

Saves whether a window is **rolled up**:

```javascript
// Roll up mode: Double-click title bar
```

**Why disabled?**
- Most users don't want windows restored **rolled up**
- Can be manually enabled

### Fullscreen (Fullscreen Mode)

**Setting**: `remember-fullscreen` (Default: **enabled**)

Saves fullscreen mode status:

```javascript
// Fullscreen: F11 or right-click → "Fullscreen"
```

**Restoration**:
- Window is automatically opened in fullscreen mode

### Minimized (Minimized)

**Setting**: `restore-minimized` (Default: **disabled**)

**Why disabled?**
- Most users want windows **visible** after session restore
- Enable if minimized windows are desired

---

## 6. Plugin System

### Overview of 15 Plugins

The extension offers **pre-configured plugins** for optimal app integration:

#### Browsers

| Plugin | WM_CLASS | Features |
|--------|----------|----------|
| **Firefox** | `firefox`, `Navigator` | Session Restore, `--restore-session` |
| **Chrome** | `google-chrome`, `Google-chrome`, `chromium` | Multi-Window, `--restore-last-session` |
| **Brave** | `brave-browser`, `Brave-browser` | Session Restore |

#### Editors & IDEs

| Plugin | WM_CLASS | Features |
|--------|----------|----------|
| **VS Code** | `code`, `Code` | Workspace Restore, Title Stabilization |
| **JetBrains** | `jetbrains-*`, `idea`, `pycharm`, `webstorm` | Project Restore |
| **gedit** | `gedit`, `Gedit` | File Path Restore |
| **xed** | `xed`, `Xed` | File Path Restore |
| **SciTE** | `scite`, `SciTE` | Session Support |
| **kate** | `kate`, `Kate` | File Restore |

#### Office & Productivity

| Plugin | WM_CLASS | Features |
|--------|----------|----------|
| **LibreOffice** | `libreoffice-*`, `soffice` | Document Path Restore |
| **Thunderbird** | `thunderbird`, `Mail` | Multi-Profile, Title Parsing |
| **GIMP** | `gimp`, `Gimp` | Image File Restore |
| **Nemo** | `nemo`, `Nemo` | File Manager Paths |

#### Other

| Plugin | WM_CLASS | Features |
|--------|----------|----------|
| **Wave** | `wave`, `Wave` | Terminal Session |
| **Gradia** | `org.gradiapp.Gradia` | Flatpak Screenshot Tool |

### Plugin Structure

Each plugin has a `config.json`:

```json
{
  "name": "firefox",
  "displayName": "Firefox",
  "version": "1.0.0",
  "description": "Browser session restore support",
  "wmClass": ["firefox", "Firefox", "Navigator"],
  "type": "mozilla-browser",

  "settings": {
    "sessionRestore": {
      "type": "app_config",
      "label": "Session Restore",
      "description": "Configure Firefox to restore previous session on startup"
    }
  },

  "launch": {
    "executables": ["firefox"],
    "flags": [],
    "conditionalFlags": {
      "launchFlags.firefoxSessionRestore": ["--restore-session"]
    }
  },

  "features": {
    "isSingleInstance": true,
    "timeout": 120000,
    "gracePeriod": 60000
  }
}
```

### Creating Custom Plugins

**User plugins** can be created in `~/.config/remember@thechief/plugins/`:

```bash
mkdir -p ~/.config/remember@thechief/plugins/myapp/
cd ~/.config/remember@thechief/plugins/myapp/
```

**Minimal configuration** (`config.json`):

```json
{
  "name": "myapp",
  "displayName": "My Application",
  "wmClass": ["myapp", "MyApp"],
  "type": "custom",

  "launch": {
    "executables": ["myapp"],
    "flags": []
  }
}
```

Optional: **Handler class** (`index.js`) for advanced features.

---

## 7. Blacklist System

### Excluding Applications

Some applications should **not be tracked**:

**System Settings → Extensions → Remember → Blacklist Tab**

**Blacklist Editor**:
```
cinnamon-settings
gnome-calculator
nemo-desktop
```

One **WM_CLASS name per line**.

### Finding WM_CLASS

```bash
# Method 1: xprop
xprop WM_CLASS
# Click on the window

# Method 2: wmctrl
wmctrl -lx
```

### Automatic Blacklist

The following apps are **automatically excluded**:

- **Extension Settings Dialog**: `settings.py` (prevents recursion)
- **System Dialogs**: `cinnamon-settings-*`
- **Desktop Icons**: `nemo-desktop`

### Excluding Dialogs

**Setting**: `track-dialogs` (Default: **disabled**)

**Why disabled?**
- Dialogs are **temporary**
- Dialog positions are usually unimportant
- Reduces data volume

**Enable** if you want to track **special dialogs**.

---

## 8. Workspace Support

### Track-All-Workspaces

**Setting**: `track-all-workspaces` (Default: **enabled**)

**Enabled**:
- Windows on **all workspaces** are tracked
- **Recommended** for multi-workspace users

**Disabled**:
- Only windows on the **current workspace** are tracked
- Saves resources for single-workspace use

### Restore-Workspace

**Setting**: `restore-workspace` (Default: **enabled**)

**Enabled**:
- Windows are moved to their **original workspace**
- Maintains workspace organization

**Disabled**:
- Windows open on the **current workspace**
- Useful if you want to control workspace assignment yourself

---

## 9. Restore Behavior

### Auto-Restore

**Setting**: `auto-restore` (Default: **enabled**)

**Enabled**:
- Windows are **automatically** positioned when opened
- No manual action required

**Disabled**:
- Windows keep their **default positions**
- Restore only manually via applet

### Restore-Delay

**Setting**: `restore-delay` (Default: **500ms**)

Delay before restoring:

- **Too short** (< 100ms): Window may not be ready yet
- **Too long** (> 2000ms): Visible window "jumping"
- **Optimal**: 500ms

**Adjustment** for slow apps:

```
System Settings → Extensions → Remember → Behavior → Restore delay
```

---

## 10. Capture Mechanism

### Command-Line Capture

**Setting**: `capture-cmdline` (Default: **enabled**)

Saves **command-line arguments** for session restore:

**Example**:
```bash
# Launched command
firefox --private-window https://example.com

# Saved in positions.json
{
  "cmdline": "firefox --private-window https://example.com"
}
```

**Advantages**:
- **Accurate restoration** with all flags
- Supports **Flatpak**, **Snap**, **AppImage**

**Disable if**:
- You don't use **session restore**
- Privacy concerns (command lines may contain sensitive paths)

### Process Capture via `/proc`

The extension reads process information from `/proc/[pid]/`:

- **cmdline**: Complete launch command
- **exe**: Path to executable file
- **environ**: Environment variables (e.g., `FLATPAK_ID`)

**Flatpak Detection**:
```bash
# Normal launch
/usr/bin/firefox

# Flatpak launch
/usr/bin/flatpak run org.mozilla.firefox
```

---

## Summary

**Window Position Remember** offers a comprehensive solution for:

✅ **Automatic tracking** of all windows (30s interval)
✅ **Multi-monitor support** with EDID identification
✅ **Session restore** with automatic app launch
✅ **Smart matching** for reliable restoration
✅ **Window states** (sticky, always-on-top, fullscreen, shaded)
✅ **15 plugins** for optimal app integration
✅ **Blacklist system** for exceptions
✅ **Resolution-independent** (percentage + pixel)

All features are **configurable** and work **automatically in the background**.

---

**Further Information**:
- [Getting Started](getting-started.md)
- [Configuration](configuration.md)
- [FAQ](faq.md)
