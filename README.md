# Window Position Remember

A Cinnamon Desktop extension that automatically saves and restores window positions across sessions and monitors.

![Screenshot](remember@thechief/screenshot.png)

## Features

- **Automatic Position Saving** - Window positions saved every 30 seconds
- **Multi-Monitor Support** - EDID-based monitor identification that persists across port changes
- **Session Restore** - Automatically restores your complete workspace layout on login
- **Smart Window Matching** - Reliable window identification across sessions
- **Resolution-Independent** - Percentage-based positioning adapts to resolution changes
- **Plugin System** - App-specific handlers for browsers, IDEs, office suites
- **GTK Settings UI** - Comprehensive settings dialog
- **Multi-Language Support** - 15+ languages

## Components

| Component | Description |
|-----------|-------------|
| [remember@thechief](remember@thechief/) | Main extension - tracks and restores window positions |
| [remember-applet@thechief](remember-applet@thechief/) | Panel applet - quick access to extension functions |

## Installation

### From Cinnamon Spices (Recommended)

1. Open **System Settings → Extensions**
2. Click the **Download** tab
3. Search for "Window Position Remember"
4. Click **Install**

### Manual Installation

```bash
git clone https://github.com/carsteneu/remember.git
cd remember
./install.sh
```

Then enable the extension in System Settings → Extensions.

## Usage

1. Enable the extension in System Settings → Extensions
2. Arrange your windows as desired
3. Positions are automatically saved every 30 seconds
4. On next login, windows are restored to their saved positions

## Documentation

Comprehensive documentation is available:

- **[User Guide](docs/user-guide/README.md)** - Getting started, features, and configuration
- **[Developer Guide](docs/developer-guide/README.md)** - Architecture, API, and plugin development
- **[API Reference](docs/api/README.md)** - Complete API documentation

## Configuration

Right-click the extension in the Extensions list and select **Configure** to open the settings dialog.

See the [Extension README](remember@thechief/README.md) for detailed configuration options.

## Data Location

```
~/.config/remember@thechief/positions.json   # Window positions
~/.config/remember@thechief/preferences.json # Settings
~/.config/remember@thechief/plugins/         # Custom plugins
```

## Development

### Making Changes

```bash
# Edit extension files
vim remember@thechief/files/remember@thechief/extension.js

# Install and restart Cinnamon
./install.sh
```

### Viewing Logs

```bash
tail -f ~/.xsession-errors
# Or with debug mode:
REMEMBER_DEBUG=1 cinnamon --replace &
```

## License

GPL-3.0

## Author

[carsteneu](https://github.com/carsteneu)

## Links

- [Report Issues](https://github.com/carsteneu/remember/issues)
- [Cinnamon Spices](https://cinnamon-spices.linuxmint.com/)
