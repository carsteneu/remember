# User Guide - Window Position Remember

Complete user documentation for the **Window Position Remember** Cinnamon Extension.

---

## Overview

**Window Position Remember** is a powerful Cinnamon Extension that automatically saves and restores window positions. With multi-monitor support, session restore, and 15+ pre-configured plugins, it offers a comprehensive solution for window management.

---

## Documentation Index

### 1. [Getting Started](getting-started.md) - First Steps

**For new users** - Quick start in 5 minutes:

- ✅ Installation (Cinnamon Spices + Git)
- ✅ Enable extension
- ✅ Add applet to panel
- ✅ First steps: Automatic saving
- ✅ Run test
- ✅ Understand multi-monitor support
- ✅ Enable session restore

**Recommended for**: First-time users, quick start

---

### 2. [Features](features.md) - Feature Overview

**Detailed feature descriptions**:

- 🔄 **Window Position Tracking** - Automatic saving (every 30s)
- 🖥️ **Multi-Monitor Support** - EDID identification, resolution-independent
- 🚀 **Session Restore** - Auto-launch on login
- 🎯 **Smart Window Matching** - 5 matching strategies
- 💾 **Window States** - sticky, always-on-top, fullscreen, shaded
- 🔌 **Plugin System** - 15+ pre-configured plugins
- 🚫 **Blacklist System** - Exclude applications
- 📐 **Workspace Support** - Multi-workspace tracking

**Recommended for**: All users who want to understand features in detail

---

### 3. [Configuration](configuration.md) - Configuration

**Complete settings reference**:

#### Cinnamon Settings (Built-in)
- **General**: track-all-workspaces, track-dialogs, auto-restore, auto-launch, capture-cmdline
- **Behavior**: save-delay, restore-delay, use-percentage, clamp-to-screen, restore-workspace
- **Window States**: remember-sticky, remember-always-on-top, remember-shaded, remember-fullscreen, restore-minimized
- **Blacklist**: Excluded applications

#### Python Settings UI (Advanced)
- **Overview Tab**: Dashboard, statistics, quick actions
- **Windows Tab**: All saved windows, filters, search
- **Apps Tab**: Launch flags, autostart, blacklist management
- **About Tab**: Extension information

#### Data Storage
- `positions.json` - Window positions & monitors
- `preferences.json` - UI settings
- `extension-settings.json` - Launch flags
- Backup system (7 days)

**Recommended for**: Users who want to customize settings

---

### 4. [FAQ & Troubleshooting](faq.md) - Frequently Asked Questions

**Solutions for common problems**:

#### Frequently Asked Questions
- ❓ Where is data stored?
- ❓ How does multi-monitor work?
- ❓ How often are positions saved?
- ❓ Is sensitive data stored?
- ❓ Does it work with Flatpak/Snap/AppImage?
- ❓ How do I create backups?

#### Configuration
- 🔧 Add application to blacklist
- 🔧 Change launch flags
- 🔧 Disable session restore for specific app

#### Issues & Solutions
- 🐛 Extension doesn't start
- 🐛 Window not restored
- 🐛 Window at wrong position
- 🐛 Session restore doesn't work
- 🐛 Applet shows no data
- 🐛 Performance issues

#### Advanced Topics
- 🔬 Sync data between computers
- 🔬 Debug extension problems
- 🔬 Create bug report

**Recommended for**: Users with problems or specific questions

---

## Quick Access

### Installation (Summary)

```bash
# Via Cinnamon Spices
System Settings → Extensions → Download → "Window Position Remember"

# Or via Git
cd ~/.local/share/cinnamon/extensions/
git clone https://github.com/carsteneu/remember.git remember@thechief
cinnamon --replace &
```

### Important Settings

```bash
# Open Cinnamon Settings
cinnamon-settings extensions remember@thechief

# Open Python Settings UI
python3 ~/.local/share/cinnamon/extensions/remember@thechief/settings.py
```

### View Logs

```bash
# Filter extension logs
tail -f ~/.xsession-errors | grep "remember@thechief"

# View saved data
cat ~/.config/remember@thechief/positions.json | jq
```

### Create Backup

```bash
# Manual backup
cp ~/.config/remember@thechief/positions.json \
   ~/remember_backup_$(date +%Y-%m-%d).json

# View automatic backups
ls -lh ~/.config/remember@thechief/backups/
```

---

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

---

## System Requirements

- **Cinnamon Desktop**: 6.0+ (recommended: current stable version)
- **Python**: 3.8+ (for Settings UI)
- **GTK**: 3.0+ (for Settings UI)

---

## Files & Directories

| Path | Description |
|------|-------------|
| `~/.local/share/cinnamon/extensions/remember@thechief/` | Extension installation |
| `~/.local/share/cinnamon/applets/remember-applet@thechief/` | Applet installation |
| `~/.config/remember@thechief/positions.json` | Window positions & monitors |
| `~/.config/remember@thechief/preferences.json` | UI settings |
| `~/.config/remember@thechief/extension-settings.json` | Launch flags |
| `~/.config/remember@thechief/positions_backup_*.json` | Automatic backups (7 days) |
| `~/.xsession-errors` | Cinnamon logs |

---

## Links & Resources

- **GitHub Repository**: https://github.com/carsteneu/remember
- **GitHub Issues**: https://github.com/carsteneu/remember/issues
- **Cinnamon Spices**: https://cinnamon-spices.linuxmint.com/extensions/view/remember@thechief
- **Documentation**: This directory (`docs/user-guide/`)

---

## Support & Contributing

### Bug Reports

Create a **GitHub Issue** with:
- System information (Cinnamon version, distribution)
- Extension version
- Logs (`~/.xsession-errors`)
- Steps to reproduce

### Feature Requests

Propose new features via **GitHub Issues**.

### Contributing

Pull requests are welcome! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.

---

## License

**MIT License** - See [LICENSE](../../LICENSE) for details.

---

## About the Author

**carsteneu** - Extension Developer

- GitHub: https://github.com/carsteneu
- Extension Homepage: https://github.com/carsteneu/remember

---

## Changelog

See [CHANGELOG.md](../../CHANGELOG.md) for version history.

---

**Enjoy Window Position Remember!**

If you have questions or problems:
1. Read the [FAQ](faq.md)
2. Check [GitHub Issues](https://github.com/carsteneu/remember/issues)
3. Create a new issue with detailed information

---

*Last updated: January 2026*
