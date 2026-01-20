# Developer Guide - Window Position Remember

Welcome to the developer documentation for the **Window Position Remember** Cinnamon Extension.

## Overview

This guide provides comprehensive documentation for developers who want to:
- Understand the extension architecture
- Develop custom plugins
- Contribute to the project
- Use the extension API

---

## Documentation Sections

### [Architecture](architecture.md)

**System architecture and design principles**:
- Extension lifecycle (init, enable, disable)
- Module system and GJS caching
- Core components (WindowTracker, SessionLauncher, PluginManager, Storage)
- Data flow and event handling
- Smart window matching strategies
- Multi-monitor support implementation
- Performance optimizations

**Recommended for**: Developers who want to understand the internal architecture

---

### [Plugin Development](plugin-development.md)

**Guide for creating custom plugins**:
- Plugin system overview
- Creating a minimal plugin
- Plugin configuration (config.json)
- Handler classes (index.js)
- Launch behavior customization
- Testing and debugging plugins
- Best practices

**Recommended for**: Developers who want to add support for new applications

---

### [API Reference](api-reference.md)

**Complete API documentation**:
- Main API (`Main.windowRemember`)
- Module system API
- Plugin Manager API
- Storage API
- Logger API
- Extension entry points
- Services APIs

**Recommended for**: Developers who want to interact with the extension programmatically

---

### [Contributing](contributing.md)

**Contribution guidelines**:
- Project setup and prerequisites
- Development workflow
- Code style guidelines (JavaScript and Python)
- Testing procedures
- Commit conventions
- Pull request process
- Bug reporting

**Recommended for**: Developers who want to contribute to the project

---

## Quick Start

### Setting up Development Environment

```bash
# Clone repository
git clone https://github.com/carsteneu/remember.git
cd remember

# Install to local extensions directory
bash install.sh

# Enable debug logging
REMEMBER_DEBUG=1 cinnamon --replace &
```

### Viewing Logs

```bash
# Filter extension logs
tail -f ~/.xsession-errors | grep "remember@thechief"

# Or use Looking Glass
Alt+F2 → lg
```

---

## Project Structure

```
remember@thechief/
├── extension.js              # Main entry point
├── modules/                  # Core modules
│   ├── windowTracker.js     # Window tracking
│   ├── sessionLauncher.js   # Session restore
│   ├── pluginManager.js     # Plugin system
│   └── storage.js           # Data persistence
├── plugins/                  # Built-in plugins
│   ├── firefox/
│   ├── vscode/
│   └── ...
├── settings_ui/             # Python GTK settings UI
│   ├── settings.py
│   └── tabs/
└── metadata.json            # Extension metadata
```

---

## Resources

- **GitHub Repository**: https://github.com/carsteneu/remember
- **Issue Tracker**: https://github.com/carsteneu/remember/issues
- **User Guide**: [../user-guide/](../user-guide/)

---

**Ready to contribute?** Check out the [Contributing Guide](contributing.md)!
