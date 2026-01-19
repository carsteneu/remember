# Window Remember Control

A Cinnamon panel applet that provides quick access to the Window Position Remember extension.

## Overview

This applet adds a panel icon for quick control of the Window Position Remember extension. It provides one-click access to save and restore window positions, making workspace management effortless.

## Requirements

**This applet requires the Window Position Remember extension to be installed and enabled.**

Install the extension first:
1. Open System Settings → Extensions
2. Search for "Window Position Remember"
3. Install and enable it

## Installation

### From Cinnamon Spices (Recommended)

1. Right-click on your panel
2. Select "Applets"
3. Click "Download" tab
4. Search for "Window Remember Control"
5. Click "Install"
6. Add to panel from "Manage" tab

### Manual Installation

```bash
cd ~/.local/share/cinnamon/applets/
git clone <repository-url> remember-applet@thechief
```

Then restart Cinnamon (Alt+F2, type `r`, press Enter).

## Features

- **One-Click Save**: Click the panel icon to save all window positions immediately
- **Quick Restore**: Right-click menu to restore windows to saved positions
- **Extension Toggle**: Enable/disable the extension from the panel
- **Settings Access**: Quick access to extension settings
- **Visual Feedback**: Icon shows extension status

## Usage

### Panel Icon Actions

**Left Click**: Save all window positions immediately

**Right Click Menu**:
- **Restore All Windows** - Restore windows to saved positions
- **Toggle Extension** - Enable/disable the extension
- **Open Settings** - Open the extension settings dialog
- **About** - Show applet information

### Typical Workflow

1. Arrange your windows as desired
2. Click the panel icon to save positions
3. Windows are automatically restored on next login
4. Use right-click menu for manual restore when needed

## Configuration

The applet has minimal configuration:
- Icon is displayed in the panel
- All settings are managed through the extension

To access extension settings:
- Right-click the applet → "Open Settings"
- Or: System Settings → Extensions → Window Position Remember → Configure

## Troubleshooting

### Applet shows "Extension not found"

The Window Position Remember extension is not installed or not enabled.

**Solution:**
1. Install the extension from System Settings → Extensions
2. Enable the extension
3. Restart Cinnamon

### Click does nothing

Check if the extension is running:
1. Right-click applet → "Toggle Extension"
2. Check System Settings → Extensions → ensure "Window Position Remember" is enabled
3. Check logs: `tail -f ~/.xsession-errors`

### Applet doesn't appear after installation

Restart Cinnamon: Alt+F2, type `r`, press Enter

## Technical Details

- **Platform**: Cinnamon Desktop 5.0 - 6.4
- **Language**: JavaScript (Cinnamon JS/CJS)
- **Dependencies**: Window Position Remember extension (remember@thechief)
- **Max Instances**: 1 per panel

## Relationship to Extension

This applet is a **companion** to the Window Position Remember extension:

- **Extension**: Provides core functionality (tracking, saving, restoring)
- **Applet**: Provides UI convenience (panel icon, quick actions)

The extension works perfectly fine without the applet - the applet just adds convenience for users who want quick panel access.

## Credits

**Author**: [carsteneu](https://github.com/carsteneu)

## License

GPL-3.0 - See LICENSE file for details

## Links

- [GitHub Repository](https://github.com/carsteneu/remember)
- [Window Position Remember Extension](https://cinnamon-spices.linuxmint.com/extensions/view/remember@thechief)
- [Cinnamon Spices](https://cinnamon-spices.linuxmint.com/)
- [Report Issues](https://github.com/carsteneu/remember/issues)
