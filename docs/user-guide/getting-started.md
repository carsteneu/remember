# Getting Started - Window Position Remember

Welcome to **Window Position Remember**, the Cinnamon Extension that automatically saves and restores your window positions. This guide will help you with the initial setup.

## Installation

### Method 1: Via Cinnamon Spices (Recommended)

1. Open **System Settings**
2. Navigate to **Extensions**
3. Click on **Download**
4. Search for **"Window Position Remember"**
5. Click **Install**
6. Wait for the installation to complete

### Method 2: Manual Installation via Git

For developers or for the latest development version:

```bash
# Clone repository
git clone https://github.com/carsteneu/remember.git
cd remember

# Run installation
bash install.sh
```

The script copies the extension and applet to the correct directories and automatically restarts Cinnamon.

## Enable Extension

After installation via Cinnamon Spices, you need to enable the extension:

1. Open **System Settings**
2. Go to **Extensions**
3. Find **"Window Position Remember"** in the list
4. Enable the toggle next to the extension
5. The extension is now active

> **Note**: When installing manually via `install.sh`, the extension is automatically enabled.

## Add Applet to Panel (Optional)

The Remember applet provides quick access via your panel:

1. **Right-click** on your panel
2. Select **"Applets to the panel"**
3. Search for **"Window Position Remember"**
4. Click the **+** icon to add it
5. The applet appears in your panel

### Applet Features

The applet offers the following quick actions:

- **Save All** - Immediately saves all open window positions
- **Restore All** - Restores all window positions
- **Toggle** - Enables/disables automatic tracking
- **Statistics** - Shows number of tracked windows and applications

## First Steps

### Step 1: Open Windows

After activation, the extension automatically starts working:

1. Open an application (e.g., **Firefox**, **VS Code**, **LibreOffice**)
2. Position the window at your desired location
3. Resize the window if needed

### Step 2: Automatic Saving

The extension saves window positions automatically:

- **Auto-Save Interval**: Every 30 seconds
- **Dirty-Flag System**: Only changed windows are saved
- **What is saved**:
  - Position (X, Y coordinates)
  - Size (width, height)
  - Monitor (in multi-monitor setups)
  - Workspace
  - Window state (sticky, always-on-top, fullscreen, etc.)

You don't need to **do anything manually** - the extension works in the background.

### Step 3: Run a Test

To verify the extension is working:

1. **Open Firefox** (or another supported application)
2. **Position the window** at a specific location
3. **Wait 30 seconds** (or click "Save All" in the applet)
4. **Close Firefox completely**
5. **Open Firefox again**
6. ✅ The window should appear **exactly at the same position**

## Data Storage

The extension stores all data locally in your home directory:

```
~/.config/remember@thechief/
├── positions.json          # Window positions and monitor data
├── preferences.json        # UI settings
├── extension-settings.json # Launch flags for session restore
├── positions_backup_20260119_143000.json  # Automatic backups
├── positions_backup_20260119_150000.json
└── positions_backup_latest.json           # Latest backup
```

### Backups

The extension creates **automatic backups**:

- On every Cinnamon restart
- On logout/shutdown
- The last 10 backups are kept
- Older backups are automatically deleted
- Additionally: `positions_backup_latest.json` (always the most recent)

## Multi-Monitor Support

The extension fully supports multiple monitors:

### EDID Identification

Monitors are identified via their **EDID hash**:

- Each monitor has a unique hardware ID
- Windows are assigned to the **correct monitor**
- Works even after monitor changes or rearrangement

### Fallback Mechanism

If EDID is not available:
1. **Connector name + resolution** (e.g., "HDMI-1_1920x1080")
2. **Monitor index** (e.g., Monitor 0, 1, 2)

### Resolution-Independent

Positions are saved **as percentages**:

- **Default**: Percentage-based positioning
- **Advantage**: Windows automatically adapt to new resolutions
- **Fallback**: Absolute pixel coordinates are also saved

**Example**: A window at 50% width on a 1920x1080 monitor appears at 50% width on a 2560x1440 monitor.

## Supported Applications

The extension works with **all applications**, but 15+ plugins offer enhanced features:

### Browsers
- **Firefox** - Session restore with `--restore-session`
- **Chrome / Chromium** - Multi-window support
- **Brave** - Session restore

### Editors & IDEs
- **Visual Studio Code** - Workspace restore
- **JetBrains IDEs** (IntelliJ IDEA, PyCharm, WebStorm, etc.)
- **gedit, xed, kate, SciTE** - File restore

### Office & Tools
- **LibreOffice** - Document path restore
- **Thunderbird** - Multi-profile support
- **GIMP** - Image file restore
- **Nemo** - File manager windows

### Other
- **Wave Terminal** - Terminal session
- **Gradia** - Screenshot tool (Flatpak)

## Next Steps

### Enable Session Restore

To automatically launch applications on login:

1. Open **Extension Settings**:
   - System Settings → Extensions → Remember → **Configure**
2. Enable **"Auto-launch session on login"**
3. On next login, all open applications will be automatically launched

For details, see: [Configuration Guide](configuration.md)

### Python Settings UI

For advanced settings, use the Python GUI:

```bash
# Open extension settings
cd ~/.local/share/cinnamon/extensions/remember@thechief/settings_ui/
python3 settings.py
```

Or via System Settings: **Extensions → Remember → Configure** (gear icon)

## Troubleshooting

### Extension Won't Start

```bash
# Check the logs
tail -f ~/.xsession-errors

# Filter for Remember output
tail -f ~/.xsession-errors | grep remember

# Restart Cinnamon
cinnamon --replace &
```

### Window Not Restored

Check:
- Is the extension enabled?
- Is `auto-restore` enabled?
- Was the window open for at least 30 seconds (auto-save)?
- Check the blacklist (settings)

### Further Help

- **FAQ**: [FAQ](faq.md)
- **Configuration**: [Configuration Guide](configuration.md)
- **Features**: [Features Overview](features.md)
- **GitHub Issues**: https://github.com/carsteneu/remember/issues

## Summary

After installation, you have:

✅ Extension installed and enabled
✅ Applet added to panel (optional)
✅ First windows automatically saved
✅ Test completed: Close and reopen windows

The extension now works **automatically in the background** and saves all window positions. No further configuration required!

---

**Enjoy Window Position Remember!**
For questions or problems, visit: https://github.com/carsteneu/remember
