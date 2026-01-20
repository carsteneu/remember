# Remember - Documentation

Welcome to the documentation for the **Remember** Cinnamon Extension and Applet project.

## Overview

**Remember** is a Cinnamon Desktop Extension system that automatically saves and restores window positions - even across restarts. It also supports automatically launching saved sessions with all applications.

### Components

- **Extension (remember@thechief)** - Main extension for window position tracking and session restore
- **Applet (remember-applet@thechief)** - Panel applet for quick access and status display

## Documentation Sections

### 📚 [User Guide](user-guide/)

Documentation for end users:
- [Getting Started](user-guide/getting-started.md) - Installation and first steps
- [Features](user-guide/features.md) - Feature overview
- [Configuration](user-guide/configuration.md) - Configuration and customization
- [FAQ](user-guide/faq.md) - Frequently asked questions and troubleshooting

### 🔧 [Developer Guide](developer/)

Documentation for developers and plugin authors:
- [Architecture](developer/architecture.md) - System architecture and design
- [Plugin Development](developer/plugin-development.md) - Developing custom plugins
- [API Reference](developer/api-reference.md) - API documentation
- [Contributing](developer/contributing.md) - Contributing to the project

## Project Links

- **GitHub Repository:** [carsteneu/remember](https://github.com/carsteneu/remember)
- **Issue Tracker:** [GitHub Issues](https://github.com/carsteneu/remember/issues)

## Quick Start

```bash
# Install extension
cd ~/.local/share/cinnamon/extensions/
git clone https://github.com/carsteneu/remember.git remember@thechief

# Restart Cinnamon
cinnamon --replace &

# Enable extension
# System Settings → Extensions → Remember → Enable
```

## Key Features

- ✅ Automatic window position saving
- ✅ Multi-monitor support with EDID identification
- ✅ Session restore - automatically launch applications
- ✅ 15+ pre-configured plugins (Firefox, VS Code, LibreOffice, etc.)
- ✅ Extensible plugin system
- ✅ Resolution-independent position storage
- ✅ Smart window matching

## License

This project is licensed under the GPLv3 License.
