# Contributing to Remember Extension

Vielen Dank für dein Interesse an Remember! Diese Anleitung hilft dir beim Setup, Development und Contribution-Process.

## Inhaltsverzeichnis

- [Projekt-Setup](#projekt-setup)
- [Development-Workflow](#development-workflow)
- [Code-Style Guidelines](#code-style-guidelines)
- [Testing](#testing)
- [Debugging](#debugging)
- [Commit-Konventionen](#commit-konventionen)
- [Pull Request Process](#pull-request-process)
- [Bug-Reports](#bug-reports)
- [Feature-Requests](#feature-requests)
- [Community-Guidelines](#community-guidelines)

---

## Projekt-Setup

### Voraussetzungen

**System:**
- Linux Distribution mit Cinnamon Desktop 6.0+
- Git
- Python 3.8+
- Node.js (optional, für Linting)

**Empfohlene Distribution:**
- Linux Mint 22+ mit Cinnamon 6.0+

### Repository klonen

```bash
# Clone Repository
git clone https://github.com/yourusername/remember-cinnamon-extension.git
cd remember-cinnamon-extension

# Oder von Bitbucket
git clone https://bitbucket.org/yourusername/remember-cinnamon-extension.git
cd remember-cinnamon-extension
```

### Installation für Development

```bash
# Installation Script ausführen
chmod +x install.sh
./install.sh
```

**Was das Script macht:**
1. Kopiert Extension von `remember@thechief/files/remember@thechief/` nach `~/.local/share/cinnamon/extensions/remember@thechief/`
2. Kopiert Applet von `remember-applet@thechief/files/remember-applet@thechief/` nach `~/.local/share/cinnamon/applets/remember-applet@thechief/`
3. Startet Cinnamon neu (mit Cache-Clear)

**Alternative: Manuelle Symlinks (für Live-Editing)**

```bash
# Entferne alte Installation
rm -rf ~/.local/share/cinnamon/extensions/remember@thechief
rm -rf ~/.local/share/cinnamon/applets/remember-applet@thechief

# Erstelle Symlinks
ln -s "$(pwd)/remember@thechief/files/remember@thechief" \
      ~/.local/share/cinnamon/extensions/remember@thechief

ln -s "$(pwd)/remember-applet@thechief/files/remember-applet@thechief" \
      ~/.local/share/cinnamon/applets/remember-applet@thechief

# Restart Cinnamon
cinnamon --replace &
```

**Vorteil Symlinks:** Änderungen sofort wirksam (nach Cinnamon-Restart).

### Verzeichnis-Struktur

```
remember-cinnamon-extension/
├── remember@thechief/
│   └── files/remember@thechief/
│       ├── extension.js          # Entry point
│       ├── modules.js            # Module loader
│       ├── config.js             # Constants
│       ├── windowTracker.js      # Window tracking
│       ├── sessionLauncher.js    # App launching
│       ├── pluginManager.js      # Plugin system
│       ├── core/                 # Core modules
│       ├── services/             # Service modules
│       ├── plugins/              # Built-in plugins
│       ├── settings.py           # Python settings UI
│       ├── settings_ui/          # Settings UI tabs
│       └── settings-schema.json  # Cinnamon settings schema
├── remember-applet@thechief/
│   └── files/remember-applet@thechief/
│       └── applet.js             # Panel applet
├── docs/
│   ├── developer/                # Developer documentation
│   └── user/                     # User documentation
├── plan/                         # Architecture plans
├── install.sh                    # Installation script
└── README.md
```

### Development-Tools Setup

**Optional: ESLint für JavaScript**

```bash
npm install -g eslint
npm install -g eslint-config-standard

# In project root
cat > .eslintrc.json <<EOF
{
  "env": {
    "es6": true,
    "node": true
  },
  "extends": "standard",
  "globals": {
    "imports": "readonly",
    "global": "readonly",
    "log": "readonly",
    "logError": "readonly",
    "Main": "readonly",
    "Meta": "readonly",
    "Gio": "readonly",
    "GLib": "readonly",
    "Mainloop": "readonly"
  },
  "rules": {
    "indent": ["error", 4],
    "semi": ["error", "always"],
    "no-unused-vars": "warn"
  }
}
EOF
```

**Python Tools (für Settings UI)**

```bash
# Install Python dev tools
pip3 install pylint black

# Format code (from repository root)
black remember@thechief/files/remember@thechief/settings.py \
      remember@thechief/files/remember@thechief/settings_ui/*.py

# Lint code
pylint remember@thechief/files/remember@thechief/settings.py \
       remember@thechief/files/remember@thechief/settings_ui/*.py
```

---

## Development-Workflow

### 1. Code ändern

Edit files im Repository (oder über Symlinks direkt in `.local/share/cinnamon/extensions/`).

### 2. Testen

**Quick Test (Cinnamon Restart):**
```bash
# Restart Cinnamon
cinnamon --replace &

# Or via keyboard
Alt+F2 → r → Enter
```

**Full Test (Extension Reload):**
```bash
# Via Extension Manager
# Disable → Enable Extension

# Or via Looking Glass
Alt+F2 → lg
# Restart extension via UI
```

### 3. Logs prüfen

```bash
# Tail logs
tail -f ~/.xsession-errors | grep remember@thechief

# Or with color
tail -f ~/.xsession-errors | grep --color=always remember@thechief

# Search for errors
grep -i error ~/.xsession-errors | grep remember@thechief
```

### 4. Debug Mode

```bash
# Enable debug mode
export REMEMBER_DEBUG=1
cinnamon --replace &

# Now all log() calls are visible
tail -f ~/.xsession-errors | grep remember@thechief
```

### 5. Iteration

```bash
# Nach Code-Änderungen:

# 1. Restart Cinnamon
cinnamon --replace &

# 2. Check logs
tail -f ~/.xsession-errors | grep remember@thechief

# 3. Test functionality
# Open/close windows, change positions, test restore, etc.

# 4. Repeat
```

---

## Code-Style Guidelines

### JavaScript (GJS/CJS)

**General Style:**
- **Indentation:** 4 spaces (NO tabs)
- **Semicolons:** Required
- **Quotes:** Single quotes for strings (except translations)
- **Line length:** Max 120 characters
- **Naming:**
  - Classes: `PascalCase`
  - Functions/Methods: `camelCase`
  - Private methods: `_camelCase` (underscore prefix)
  - Constants: `UPPER_SNAKE_CASE`
  - Variables: `camelCase`

**Beispiel:**

```javascript
/**
 * WindowTracker Class
 * Tracks window positions and movements
 */
var WindowTracker = class WindowTracker {
    constructor(storage, monitorManager, preferences, extensionMeta) {
        this._storage = storage;
        this._monitorManager = monitorManager;
        this._preferences = preferences;
        this._extensionMeta = extensionMeta;

        // Private state
        this._trackedWindows = new Map();
        this._dirtyWindows = new Set();
    }

    /**
     * Start tracking windows
     */
    enable() {
        // Implementation
    }

    /**
     * Private helper method
     */
    _onWindowChanged(metaWindow) {
        // Implementation
    }
};

// Constants
const CONFIG = {
    SAVE_DELAY: 1000,
    DATA_VERSION: 4
};
```

**Kommentare:**
- JSDoc für alle public methods
- Einzeiler für kurze Erklärungen
- Mehrzeiler für komplexe Logik
- TODO/FIXME/NOTE markers wo sinnvoll

**Beispiel:**
```javascript
/**
 * Try to restore window position
 *
 * @param {MetaWindow} metaWindow - Window to restore
 * @param {boolean} isNewWindow - True if window just created
 * @param {Object|null} launchedInstance - Instance data if launched by us
 * @param {string|null} instanceId - Instance ID for progress tracking
 */
tryRestorePosition(metaWindow, isNewWindow, launchedInstance, instanceId) {
    // TODO: Add support for multi-monitor DPI scaling
    // FIXME: Aggressive apps (VSCode) override position immediately
    // NOTE: We try multiple times with increasing delays

    // Implementation
}
```

**Error Handling:**
```javascript
// Always wrap risky operations
try {
    const file = Gio.File.new_for_path(filePath);
    const [success, contents] = file.load_contents(null);
    if (success) {
        return JSON.parse(imports.byteArray.toString(contents));
    }
} catch (e) {
    logError(`Failed to load config: ${e}`);
    return null; // Graceful fallback
}
```

**Null Checks:**
```javascript
// Always check objects before accessing properties
if (metaWindow && metaWindow.get_wm_class) {
    const wmClass = metaWindow.get_wm_class();
}

// Use optional chaining where supported (GJS 1.70+)
const title = metaWindow?.get_title() || '';
```

**Logger Injection Pattern:**
```javascript
var MyModule = class MyModule {
    constructor() {
        // Logger injection - no-op until injected
        this._log = function() {};
        this._logError = global.logError;
    }
};

// In extension.js after loading module
myModule._log = log;
myModule._logError = logError;
```

**Module Exports:**
```javascript
// Always use 'var' for exported symbols (GJS requirement)
var MyClass = class MyClass { ... };
var myFunction = function() { ... };
var MY_CONSTANT = 42;

// NOT: const, let, export
```

### Python (Settings UI)

**General Style:**
- Follow PEP 8
- **Indentation:** 4 spaces
- **Line length:** Max 100 characters
- **Naming:**
  - Classes: `PascalCase`
  - Functions/Methods: `snake_case`
  - Private methods: `_snake_case`
  - Constants: `UPPER_SNAKE_CASE`

**Beispiel:**

```python
"""
Main settings window for Remember extension.
"""

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk

class SettingsWindow(Gtk.Window):
    """Main settings window with tabbed interface."""

    def __init__(self):
        super().__init__(title="Remember - Settings")
        self._data_manager = None
        self._setup_ui()

    def _setup_ui(self):
        """Setup the UI components."""
        # Implementation
        pass

    def _on_save_clicked(self, button):
        """Handle save button click."""
        # Implementation
        pass

# Constants
WINDOW_WIDTH = 1000
WINDOW_HEIGHT = 700
```

**Docstrings:**
```python
def load_data(self, file_path: str) -> dict:
    """
    Load JSON data from file.

    Args:
        file_path: Path to JSON file

    Returns:
        Loaded data as dictionary

    Raises:
        FileNotFoundError: If file doesn't exist
        JSONDecodeError: If file is not valid JSON
    """
    # Implementation
```

---

## Testing

### Unit Tests

**Aktuell:** Keine automatisierten Unit Tests.

**TODO:** Jest-Setup für JavaScript, Pytest für Python.

### Manuelle Tests

**Test-Checkliste:**

#### Basic Functionality

- [ ] Extension lädt ohne Errors
- [ ] Applet erscheint im Panel
- [ ] Settings Dialog öffnet
- [ ] Window Tracking funktioniert
  - [ ] Position-Änderungen werden gespeichert
  - [ ] Size-Änderungen werden gespeichert
  - [ ] Workspace-Änderungen werden gespeichert
  - [ ] Maximized-State wird gespeichert
- [ ] Auto-Save (alle 30 sec) funktioniert
- [ ] Manual Save via Applet funktioniert
- [ ] Manual Restore via Applet funktioniert

#### Session Restore

- [ ] Auto-Restore beim Login funktioniert
- [ ] Apps werden gestartet
- [ ] Positionen werden restored
- [ ] Workspaces werden restored
- [ ] Monitor-Zuordnung funktioniert
- [ ] Progress Window erscheint
- [ ] Timeouts funktionieren
- [ ] Grace Periods funktionieren

#### Plugin System

- [ ] Built-in Plugins laden
- [ ] User Plugins laden (aus ~/.config/)
- [ ] Plugin-Handlers funktionieren
- [ ] Conditional Flags funktionieren
- [ ] Single-Instance Apps funktionieren
- [ ] Title Stabilization funktioniert

#### Multi-Monitor

- [ ] Monitor-Erkennung via EDID funktioniert
- [ ] Position-Restore auf richtigem Monitor
- [ ] Monitor-Change wird erkannt
- [ ] Percentage-based Restore funktioniert
- [ ] Absolute Fallback funktioniert

#### Edge Cases

- [ ] Cinnamon Restart (Alt+F2 r) - keine Datenverluste
- [ ] Logout/Shutdown - Backup wird erstellt
- [ ] Sehr viele Fenster (50+) - keine Performance-Probleme
- [ ] Sehr große Fenster - Positionen korrekt
- [ ] Sehr kleine Fenster - werden gefiltert
- [ ] Apps mit Unicode-Titles - funktionieren
- [ ] Apps mit langen Command-Lines - funktionieren

#### Cinnamon Version

Test auf der aktuellen Cinnamon-Version:

- [ ] Cinnamon 6.0+ (empfohlen: aktuelle stabile Version)

### Performance Tests

**Memory Leak Check:**
```bash
# Start Cinnamon
cinnamon --replace &

# Check initial memory
ps aux | grep cinnamon

# Open/close many windows
# ... work for 30 minutes ...

# Check memory again
ps aux | grep cinnamon

# Memory should be stable (< 50MB growth)
```

**CPU Usage Check:**
```bash
# Monitor CPU during auto-save
top -p $(pgrep -f cinnamon)

# CPU spikes should be minimal (< 5% for < 1 sec)
```

**I/O Check:**
```bash
# Monitor disk writes
iotop -p $(pgrep -f cinnamon)

# Auto-save should cause minimal I/O
```

---

## Debugging

### Looking Glass

Cinnamon's eingebautes Debug-Tool.

**Öffnen:**
```bash
Alt+F2 → lg → Enter
```

**Nützliche Commands:**

```javascript
// Check Extension State
global.windowRemember

// Check Stats
global.windowRemember._tracker.getStats()

// Check Plugin Manager
global.windowRemember._pluginManager.getLoadedPlugins()

// Check Storage
global.windowRemember._storage.getAllApps()

// Force Save
global.windowRemember._storage.save()

// List all Windows
global.get_window_actors().map(a => {
    const w = a.get_meta_window();
    return {
        wmClass: w.get_wm_class(),
        title: w.get_title(),
        workspace: w.get_workspace().index()
    };
})
```

**Errors/Warnings Tab:**
- Zeigt alle JavaScript-Exceptions
- Sehr nützlich für Syntax-Errors

**Log Tab:**
- Zeigt alle `global.log()` Ausgaben
- Filter möglich

### Log Files

**Primary Log:**
```bash
~/.xsession-errors
```

**Tail with filter:**
```bash
tail -f ~/.xsession-errors | grep remember@thechief
```

**Search for errors:**
```bash
grep -i "error\|exception\|warning" ~/.xsession-errors | grep remember@thechief
```

**Clear log:**
```bash
> ~/.xsession-errors
# Restart Cinnamon for fresh logs
cinnamon --replace &
```

### Debug Mode

**Enable:**
```bash
export REMEMBER_DEBUG=1
cinnamon --replace &
```

**Was es macht:**
- Alle `log()` calls werden ausgegeben
- `logSensitive()` zeigt full data
- `logDebug()` wird aktiviert

**Disable:**
```bash
unset REMEMBER_DEBUG
cinnamon --replace &
```

### Inspect Saved Data

**positions.json:**
```bash
# Pretty-print entire file
cat ~/.config/remember@thechief/positions.json | jq

# Show specific app
cat ~/.config/remember@thechief/positions.json | jq '.apps.firefox'

# Show monitor layout
cat ~/.config/remember@thechief/positions.json | jq '.monitor_layout'

# Count instances per app
cat ~/.config/remember@thechief/positions.json | jq '.apps | to_entries | map({app: .key, instances: .value.instances | length})'

# Find instance by ID
cat ~/.config/remember@thechief/positions.json | jq '.apps[].instances[] | select(.id == "firefox-123456-0")'
```

**preferences.json:**
```bash
cat ~/.config/remember@thechief/preferences.json | jq
```

**extension-settings.json:**
```bash
cat ~/.config/remember@thechief/extension-settings.json | jq
```

### Breakpoint-Debugging (Limited)

GJS hat kein echtes Debugger-Support, aber:

**Console Logging:**
```javascript
function myFunction(param) {
    global.log(`DEBUG: myFunction called with ${param}`);

    const result = doSomething(param);
    global.log(`DEBUG: result = ${JSON.stringify(result)}`);

    return result;
}
```

**Conditional Logging:**
```javascript
const DEBUG = true; // Toggle manually

function myFunction(param) {
    if (DEBUG) {
        global.log(`myFunction: param=${param}`);
    }

    // Implementation
}
```

---

## Commit-Konventionen

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type:**
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring (no behavior change)
- `perf`: Performance improvement
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `test`: Adding/updating tests
- `chore`: Maintenance tasks (dependencies, build, etc.)

**Scope (optional):**
- `extension`: Extension core
- `applet`: Panel applet
- `settings`: Settings UI
- `plugin`: Plugin system
- `storage`: Storage system
- `tracker`: Window tracker
- `launcher`: Session launcher
- `plugin/<name>`: Specific plugin

**Subject:**
- Imperative mood ("Add feature", not "Added feature")
- No period at end
- Max 72 characters

**Body (optional):**
- Detailed explanation
- Why was this change needed?
- What does it fix/improve?

**Footer (optional):**
- Breaking changes: `BREAKING CHANGE: <description>`
- References: `Closes #123`, `Fixes #456`

### Commit Examples

**Feature:**
```
feat(plugin): add JetBrains IDEs plugin with project path restoration

- Supports IntelliJ IDEA, PyCharm, WebStorm, etc.
- Extracts project path from window title
- Implements restoreTimings for aggressive positioning
- Added titleStabilizationDelay (2000ms)

Closes #45
```

**Bug Fix:**
```
fix(tracker): prevent data loss during Cinnamon restart

Window untracking now defers deletion to periodic cleanup instead of
immediate removal. This prevents data loss when windows are briefly
"unmanaged" during Cinnamon restart (Alt+F2 r).

The cleanup logic compares saved instances vs. running windows and
only deletes instances that have no matching window AND were not
tracked recently (5 min threshold).

Fixes #78
```

**Refactoring:**
```
refactor(storage): extract monitor matching to separate module

Moved monitor matching logic from positionRestorer.js to new
core/monitorMatcher.js module for better separation of concerns
and reusability.

No behavior changes.
```

**Documentation:**
```
docs(developer): add plugin development guide

Added comprehensive plugin-development.md with:
- Step-by-step plugin creation guide
- config.json full reference
- Handler class development
- Code examples for all hook types
- Testing and debugging tips
```

**Performance:**
```
perf(tracker): implement dirty-flag system for window saves

Changed from immediate save on every position-changed event to
dirty-flag marking + batch save every 30 seconds.

This reduces I/O operations by ~95% during active window management.

Benchmark: 100 window moves/sec
- Before: 100 saves/sec, 50% CPU
- After: 1 save/30sec, < 5% CPU
```

---

## Pull Request Process

### 1. Fork & Branch

```bash
# Fork repository on GitHub/Bitbucket

# Clone your fork
git clone https://github.com/YOURNAME/remember-cinnamon-extension.git
cd remember-cinnamon-extension

# Add upstream remote
git remote add upstream https://github.com/ORIGINAL/remember-cinnamon-extension.git

# Create feature branch
git checkout -b feature/my-awesome-feature

# Or bug fix branch
git checkout -b fix/issue-123
```

### 2. Develop & Test

```bash
# Make changes
# ...

# Test thoroughly (see Testing section)
# ...

# Commit
git add .
git commit -m "feat(plugin): add support for MyApp"
```

### 3. Push & Create PR

```bash
# Push to your fork
git push origin feature/my-awesome-feature

# Create Pull Request on GitHub/Bitbucket
# Use PR template below
```

### PR Template

```markdown
## Description

Brief description of what this PR does.

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Related Issues

Closes #123
Fixes #456

## Changes Made

- Added XYZ feature
- Fixed ABC bug
- Refactored DEF module

## Testing

Tested on:
- [ ] Cinnamon 6.0+ (aktuelle stabile Version)

Test Cases:
- [ ] Manual window tracking
- [ ] Session restore
- [ ] Multi-monitor setup
- [ ] Edge cases (restart, logout, etc.)

## Screenshots (if applicable)

[Add screenshots here]

## Checklist

- [ ] My code follows the code style of this project
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings or errors
- [ ] I have tested my changes on Cinnamon 6.0+
- [ ] All existing tests still pass

## Additional Notes

[Any additional information]
```

### 4. Review Process

**What happens:**
1. Maintainer reviews code
2. Automated checks run (if configured)
3. Feedback/Change requests
4. You update PR based on feedback
5. Approval
6. Merge

**Update PR after feedback:**
```bash
# Make changes
# ...

# Commit
git add .
git commit -m "fix: address review comments"

# Push (updates PR automatically)
git push origin feature/my-awesome-feature
```

**Squash commits before merge (optional):**
```bash
# Interactive rebase
git rebase -i HEAD~5  # Last 5 commits

# In editor, mark commits as 'squash' or 'fixup'
# Force push (updates PR)
git push --force-with-lease origin feature/my-awesome-feature
```

### 5. After Merge

```bash
# Update your local main
git checkout main
git pull upstream main

# Delete feature branch
git branch -d feature/my-awesome-feature
git push origin --delete feature/my-awesome-feature
```

---

## Bug-Reports

### Gute Bug-Reports enthalten:

1. **Beschreibung**
   - Was ist passiert?
   - Was sollte passieren?

2. **Reproduktionsschritte**
   - Schritt-für-Schritt Anleitung
   - Minimal reproduzierbares Beispiel

3. **Environment**
   - Distribution & Version
   - Cinnamon Version
   - Extension Version

4. **Logs**
   - Relevante Log-Ausgaben
   - Screenshots (falls sinnvoll)

5. **Expected vs. Actual Behavior**

### Bug-Report Template

```markdown
## Bug Description

Brief description of the bug.

## Steps to Reproduce

1. Open Firefox
2. Move window to workspace 2
3. Close Firefox
4. Click "Launch Session" in applet
5. Firefox appears on workspace 1 instead of 2

## Expected Behavior

Firefox should appear on workspace 2.

## Actual Behavior

Firefox appears on workspace 1.

## Environment

- **Cinnamon Version:** 6.0.x
- **Extension Version:** 1.2.3
- **Monitor Setup:** 2 monitors (HDMI-1: 1920x1080, DP-1: 2560x1440)

## Logs

```
remember@thechief: Restoring firefox to workspace 2, monitor 0
remember@thechief: ERROR: Failed to set workspace
```

## Screenshots

[Attach screenshot if relevant]

## Additional Context

This only happens with Firefox. Other apps (Chrome, VSCode) restore correctly.

## Possible Fix

I think the issue might be in positionRestorer.js line 234 where we check...
```

---

## Feature-Requests

### Gute Feature-Requests enthalten:

1. **Use Case**
   - Warum brauchst du das?
   - Welches Problem löst es?

2. **Vorgeschlagene Lösung**
   - Wie sollte es funktionieren?
   - Alternative Ansätze?

3. **Beispiele**
   - Konkrete Beispiele aus anderen Apps/Extensions

### Feature-Request Template

```markdown
## Feature Description

Brief description of the feature.

## Use Case

I frequently use split-screen layouts with 4 windows arranged in a grid.
Currently, I have to manually position them every time I log in.

## Proposed Solution

Add a "Save Layout" feature that saves the current window arrangement and
allows quick restoration with a hotkey or applet button.

Possible implementation:
- Button in applet: "Save Current Layout"
- Hotkey: Super+Shift+S
- Restore: Super+Shift+R

## Alternatives Considered

1. Using tiling window manager - too complex, I prefer floating windows
2. Using WM presets - doesn't persist across sessions
3. Manually creating script - would prefer native integration

## Examples

Similar to:
- Windows PowerToys FancyZones
- KDE Window Rules with layout saving

## Additional Context

This would be especially useful for:
- Developers with IDE + terminals + browser layout
- Content creators with specific tool arrangements
- Anyone with consistent workflow patterns

I'm willing to help implement this if you can point me to the right modules.
```

---

## Community-Guidelines

### Code of Conduct

**Be Respectful:**
- Treat everyone with respect
- No harassment, discrimination, or offensive behavior
- Constructive criticism only

**Be Collaborative:**
- Help others
- Share knowledge
- Credit contributors

**Be Professional:**
- Keep discussions on-topic
- No spam or self-promotion
- Follow project guidelines

### Communication Channels

**GitHub/Bitbucket Issues:**
- Bug reports
- Feature requests
- Technical discussions

**Pull Requests:**
- Code reviews
- Implementation discussions

**Email (for sensitive issues):**
- Security vulnerabilities
- Private concerns

### Response Times

**We try to:**
- Respond to issues within 3 days
- Review PRs within 1 week
- Release bug fixes within 2 weeks

**Please be patient!** This is a volunteer project.

### Getting Help

**Before asking:**
1. Read documentation (README, docs/)
2. Search existing issues
3. Check Looking Glass for errors

**When asking:**
- Provide context
- Include environment details
- Show what you've tried

**Where to ask:**
- Simple questions: GitHub Issues
- Complex discussions: GitHub Discussions (if enabled)
- Real-time help: IRC/Matrix (if available)

---

## Advanced Topics

### Creating a Plugin from Scratch

**See:** [Plugin Development Guide](plugin-development.md)

**Quick Start:**
```bash
# Create plugin directory
mkdir -p ~/.config/remember@thechief/plugins/myapp

# Create config.json
cat > ~/.config/remember@thechief/plugins/myapp/config.json <<EOF
{
  "name": "myapp",
  "displayName": "My Application",
  "version": "1.0.0",
  "description": "Support for My Application",
  "wmClass": ["myapp", "MyApp"],
  "type": "editor",
  "launch": {
    "executables": ["myapp"],
    "flags": [],
    "conditionalFlags": {}
  },
  "features": {
    "isSingleInstance": false,
    "timeout": 45000,
    "gracePeriod": 30000
  }
}
EOF

# Restart Cinnamon
cinnamon --replace &

# Check if loaded
tail -f ~/.xsession-errors | grep "Loaded plugin: myapp"
```

### Modifying Core Behavior

**Example: Change Auto-Save Interval**

**File:** `services/storage.js`

```javascript
// Line 86: Change from 30 to 60 seconds
_startAutoSave() {
    this._autoSaveIntervalId = Mainloop.timeout_add_seconds(60, () => {
        // ...
    });
}
```

**Test:**
```bash
# Install modified version
./install.sh

# Monitor saves
tail -f ~/.xsession-errors | grep "Saved"

# Should see saves every 60 seconds instead of 30
```

### Adding a New Service Module

**Example: Add notification service**

**File:** `services/notificationService.js`

```javascript
const Main = imports.ui.main;

const UUID = "remember@thechief";

var NotificationService = class NotificationService {
    constructor() {
        this._log = function() {};
        this._logError = global.logError;
    }

    init() {
        this._log('NotificationService initialized');
    }

    notify(title, message, icon = null) {
        Main.notify(title, message, icon);
    }

    destroy() {
        // Cleanup
    }
};
```

**Use in extension.js:**

```javascript
// Load service
const { NotificationService } = getExtensionModule('services/notificationService');

// Initialize
this._notificationService = new NotificationService();
this._notificationService._log = log;
this._notificationService.init();

// Use
this._notificationService.notify(
    _("Window Remember"),
    _("Session restored successfully")
);
```

---

## Troubleshooting Common Issues

### Extension doesn't load

**Symptom:** No errors, but extension not working.

**Check:**
```bash
# Extension enabled?
cinnamon-settings extensions

# Look for errors
grep -i "remember@thechief" ~/.xsession-errors

# Check syntax
cd ~/.local/share/cinnamon/extensions/remember@thechief
gjs -c extension.js
```

### Changes not applied

**Symptom:** Code changes have no effect.

**Solution:**
```bash
# Clear GJS cache
rm -rf ~/.cache/gjs-*

# Restart Cinnamon
cinnamon --replace &
```

### Module not found

**Symptom:** `Error: Module 'xyz' not found`

**Check:**
```bash
# File exists?
ls -la ~/.local/share/cinnamon/extensions/remember@thechief/services/xyz.js

# Export statement?
grep "^var" services/xyz.js

# Should see: var MyClass = class MyClass { ... }
```

### Plugin not loading

**Symptom:** Plugin doesn't appear in loaded list.

**Check:**
```bash
# config.json valid?
cat ~/.config/remember@thechief/plugins/myapp/config.json | jq

# Required fields present?
cat config.json | jq '{name, wmClass, launch}'

# Logs?
grep -i "plugin" ~/.xsession-errors | grep myapp
```

---

## Release Process (for Maintainers)

### 1. Version Bump

**Update version in:**
- `remember@thechief/files/remember@thechief/metadata.json`
- `remember-applet@thechief/files/remember-applet@thechief/metadata.json`
- `CHANGELOG.md`

```bash
# Example: 1.2.3 → 1.3.0
sed -i 's/"version": "1.2.3"/"version": "1.3.0"/' \
    remember@thechief/files/remember@thechief/metadata.json
sed -i 's/"version": "1.2.3"/"version": "1.3.0"/' \
    remember-applet@thechief/files/remember-applet@thechief/metadata.json
```

### 2. Update Changelog

**CHANGELOG.md:**
```markdown
## [1.3.0] - 2026-01-20

### Added
- JetBrains IDEs plugin with project path restoration
- Multi-monitor DPI scaling support
- Session restore progress window

### Fixed
- Data loss during Cinnamon restart
- LibreOffice WM_CLASS migration
- Monitor matching on resolution change

### Changed
- Auto-save interval from 30s to 60s
- Improved dirty-flag performance
```

### 3. Git Tag

```bash
git tag -a v1.3.0 -m "Release v1.3.0"
git push origin v1.3.0
```

### 4. Create Release

**GitHub Release:**
1. Go to Releases
2. Create new release
3. Tag: v1.3.0
4. Title: v1.3.0 - Feature Name
5. Description: Copy from CHANGELOG
6. Attach ZIP (optional)

### 5. Submit to Spices

**Cinnamon Spices:**
1. Update on cinnamon-spices-extensions repo
2. Create PR
3. Wait for approval

---

## License

Dieses Projekt ist unter der GPL-3.0 License lizenziert. Contributions werden unter derselben License akzeptiert.

Siehe [LICENSE](../../LICENSE) für Details.

---

## Kontakt

**Maintainer:** [Your Name]

**Issues:** https://github.com/yourname/remember-cinnamon-extension/issues

**Email:** your.email@example.com (für Security-Vulnerabilities)

---

## Danke!

Vielen Dank für dein Interest an Remember! Jeder Contribution - ob Code, Dokumentation, Bug-Reports oder Feature-Requests - hilft das Projekt zu verbessern.

Happy Coding!
