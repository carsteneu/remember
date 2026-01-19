# Changelog

All notable changes to this project will be documented in this file.

## [1.1] - 2025-01

### Added
- Gradia screenshot tool plugin with Flatpak support
- Close window button in Windows tab with workspace focus on restore
- VS Code plugin for aggressive window positioning
- Multi-language support for plugin configuration UI
- Translations for 15+ languages

### Changed
- Truncate long window titles in progress window for better readability
- Improved VSCode multi-window matching on session restore
- Redesigned Apps & Session tab with plugin system
- Extracted core modules and reorganized architecture

### Fixed
- Improve Flatpak application detection and launching
- Remove forbidden icon field from metadata.json
- Correct locale path in progress window

## [1.0] - 2024-12

### Added
- Plugin system for app-specific launch handling
- LibreOffice plugin with document path restoration
- Thunderbird multi-profile session restore support
- File restoration for text editors (Gedit, Xed, Kate, SciTE)
- Brave, Chrome, Firefox browser plugins
- JetBrains IDEs support
- Progress window for session restore with real-time status
- Dirty-flag system for optimized auto-save (reduces I/O)
- Extended timeouts for single-instance apps (browsers, IDEs)
- Scoring-based instance matching algorithm
- Python GTK 3 settings UI with tabbed interface
- Overview, Windows, Apps, and Preferences tabs

### Changed
- Login detection uses actual Cinnamon process uptime instead of system uptime
- Optimized xrandr caching and Levenshtein matching
- Enhanced instance deduplication and system tool filtering
- Centralized session launch configuration

### Fixed
- Session restore reliability for LibreOffice and Thunderbird
- Prevent duplicate window launches for multi-instance apps
- Plugin handler GJS module caching conflict
- Progress window multi-instance status updates

## [0.9] - 2024-11

### Added
- Multi-monitor support with EDID-based identification
- Percentage-based position storage (resolution-independent)
- Session restore on login
- Automatic position saving every 30 seconds
- Smart window matching (stable_sequence, x11_window_id, title)
- Flatpak application detection and launching
- Backup creation on shutdown

### Changed
- Data format version 4 with improved structure

### Fixed
- Window matching after Cinnamon restart (Alt+F2 r)
- Monitor identification when reconnected to different ports
