# Plugin Development for Remember Extension

## Overview

The plugin system enables app-specific customizations for window launching, session restore, and position restoration without modifying the extension core.

**What plugins can do:**
- Define executable paths and launch flags
- Conditional flags based on user settings
- Control single-instance vs. multi-instance behavior
- Customize timeouts and grace periods
- Title stabilization delays for apps that change their title
- Session restore hooks (beforeLaunch, afterLaunch, parseTitleData)
- Deduplication for browser sessions
- Custom restore timings for aggressive self-positioning

**Plugin types:**
- **Simple plugins:** Only `config.json` (launch config)
- **Advanced plugins:** `config.json` + `index.js` (handler class)

## Plugin Structure

### Directory Layout

```
plugins/
├── firefox/
│   └── config.json          # Basic config (no handler class)
├── vscode/
│   ├── config.json          # Config with handler reference
│   └── index.js             # VSCodeHandler class
├── thunderbird/
│   ├── config.json
│   └── index.js             # ThunderbirdHandler with parseTitleData
└── libreoffice/
    ├── config.json
    └── index.js             # LibreOfficeHandler with deduplication
```

### Plugin Paths

**Built-in Plugins:**
```
~/.local/share/cinnamon/extensions/remember@thechief/plugins/
```

**User Plugins:**
```
~/.config/remember@thechief/plugins/
```

User plugins can override built-in plugins (same name).

## Creating a Plugin (Step-by-Step)

### Step 1: Create Plugin Directory

```bash
# User plugin
mkdir -p ~/.config/remember@thechief/plugins/myapp

# Or: Built-in plugin (for contribution)
cd ~/.local/share/cinnamon/extensions/remember@thechief/plugins/
mkdir myapp
```

### Step 2: Create config.json

Create a `config.json` file in the plugin directory. There are two variants:

**Minimal example (without handler):**

```json
{
  "name": "myapp",
  "displayName": "My Application",
  "version": "1.0.0",
  "description": "Support for My Application",
  "wmClass": ["myapp", "MyApp"],
  "type": "editor",

  "launch": {
    "executables": ["myapp", "/usr/bin/myapp"],
    "flags": [],
    "conditionalFlags": {}
  },

  "features": {
    "isSingleInstance": false,
    "timeout": 45000,
    "gracePeriod": 30000
  }
}
```

**Complete example (with handler):**

```json
{
  "name": "myapp",
  "displayName": "My Application",
  "version": "1.0.0",
  "description": "Advanced editor with session restore",
  "wmClass": ["myapp", "MyApp", "myapp-beta"],
  "type": "editor",
  "handler": "index.js",

  "settings": {
    "sessionRestore": {
      "type": "app_config",
      "label": "Session Restore",
      "description": "Enable session restore in MyApp",
      "check": {
        "type": "json_key",
        "path": "~/.config/myapp/settings.json",
        "key": "window.restoreSession",
        "value": true
      },
      "configure": {
        "type": "json_set",
        "path": "~/.config/myapp/settings.json",
        "key": "window.restoreSession",
        "value": true
      },
      "unconfigure": {
        "type": "manual",
        "message": "Please disable session restore in MyApp settings"
      },
      "openSettings": {
        "type": "command",
        "cmd": ["myapp", "--settings"]
      }
    }
  },

  "launch": {
    "executables": [
      "myapp",
      "/usr/bin/myapp",
      "/snap/bin/myapp",
      "myapp-beta"
    ],
    "flags": [
      "--disable-gpu-sandbox",
      "--new-window"
    ],
    "conditionalFlags": {
      "launchFlags.myappSessionRestore": ["--restore-session"],
      "launchFlags.myappVerbose": ["--verbose", "--log-level=debug"]
    }
  },

  "features": {
    "isSingleInstance": true,
    "timeout": 90000,
    "gracePeriod": 45000,
    "autoRestore": true,
    "titleStabilizationDelay": 2000
  }
}
```

### Step 3: Create Handler Class (optional)

**File:** `index.js`

```javascript
/**
 * MyApp Plugin Handler
 *
 * Handler for advanced launch logic and session restore.
 */

// Imports (required for file operations in parseTitleData)
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

var MyAppHandler = class MyAppHandler {
    /**
     * Constructor
     * @param {Object} config - Plugin config from config.json
     * @param {Object} extensionSettings - Extension settings service
     * @param {Object} storage - Storage service
     */
    constructor(config, extensionSettings, storage) {
        this._config = config;
        this._extensionSettings = extensionSettings;
        this._storage = storage;

        // Optional: Aggressive restore timings
        this.restoreTimings = [500, 1500, 3000];
    }

    /**
     * beforeLaunch Hook
     * Called before spawning the process.
     *
     * @param {Object} instance - Saved instance data
     * @param {Object} launchParams - { executable, args, workDir }
     * @returns {Object} Modified launchParams
     */
    beforeLaunch(instance, launchParams) {
        // Example: Add workspace-specific flag
        if (instance.workspace === 0) {
            launchParams.args.push('--workspace=main');
        }

        // Example: Override executable for beta versions
        if (instance.cmdline && instance.cmdline[0].includes('beta')) {
            launchParams.executable = 'myapp-beta';
        }

        return launchParams;
    }

    /**
     * parseTitleData Hook
     * Parse title_snapshot to extract document paths/args.
     *
     * @param {string} titleSnapshot - Saved window title
     * @param {Object} instance - Full instance data (for document_path access)
     * @returns {Array<string>|null} Arguments to append to launch command
     */
    parseTitleData(titleSnapshot, instance) {
        // Example: Extract file path from title
        // Title format: "filename.txt - MyApp"
        const match = titleSnapshot.match(/^(.+?)\s*-\s*MyApp$/);
        if (match) {
            const filename = match[1];
            // Check if file still exists
            const filePath = GLib.build_filenamev([
                instance.working_dir || GLib.get_home_dir(),
                filename
            ]);
            const file = Gio.File.new_for_path(filePath);
            if (file.query_exists(null)) {
                return [filePath];
            }
        }

        // Fallback: Use document_path if available
        if (instance.document_path) {
            return [instance.document_path];
        }

        // Fallback: Use open_documents if available
        if (instance.open_documents && instance.open_documents.length > 0) {
            return instance.open_documents;
        }

        return null;
    }

    /**
     * afterLaunch Hook
     * Called after process was spawned.
     *
     * @param {Object} instance - Saved instance data
     * @param {number} pid - Process ID (or null if launch failed)
     * @param {boolean} success - Whether launch was successful
     */
    afterLaunch(instance, pid, success) {
        if (success) {
            global.log(`MyApp launched with PID ${pid}`);
        } else {
            global.logError(`Failed to launch MyApp`);
        }
    }

    /**
     * shouldSkipRestore Hook
     * Decide whether to skip restoring this instance.
     *
     * @param {Object} instance - Saved instance data
     * @returns {boolean} True to skip, false to restore
     */
    shouldSkipRestore(instance) {
        // Example: Skip transient windows
        if (instance.title_snapshot.includes('Settings') ||
            instance.title_snapshot.includes('Preferences')) {
            return true;
        }
        return false;
    }

    /**
     * Cleanup
     * Called when plugin manager is destroyed.
     */
    destroy() {
        // Cleanup resources if needed
    }
};
```

### Step 4: Test Plugin

```bash
# 1. Reload extension
# Press Alt+F2, type "r" and press Enter
# Or: Right-click on extension → "Reload"

# 2. Enable debug mode (optional)
export REMEMBER_DEBUG=1
cinnamon --replace &

# 3. Check logs
tail -f ~/.xsession-errors | grep remember@thechief

# 4. Verify plugin loading
# Should see: "Loaded plugin: myapp (myapp, MyApp)"

# 5. Test launch
# 1. Open MyApp
# 2. Click "Save All" in applet
# 3. Close MyApp
# 4. Click "Launch Session" in applet
# 5. Verify MyApp opens at the correct position
```

## config.json Reference

### Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique plugin identifier (lowercase, no spaces) |
| `displayName` | string | Yes | Human-readable name for UI |
| `version` | string | Yes | Semantic version (e.g., "1.0.0") |
| `description` | string | Yes | Brief description of plugin |
| `wmClass` | string[] | Yes | Window manager class names (case-sensitive!) |
| `type` | string | No | Plugin type (see Provider Types) |
| `handler` | string | No | Handler file name (e.g., "index.js") |
| `settings` | object | No | App configuration settings (for Settings UI) |
| `launch` | object | Yes | Launch configuration |
| `features` | object | No | Feature flags and timings |

### launch Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `executables` | string[] | Yes | Executable paths (tried in order) |
| `flags` | string[] | No | Default launch flags (always added) |
| `conditionalFlags` | object | No | Flags added based on settings |

**executables** Priority:
1. Absolute paths (e.g., `/usr/bin/firefox`)
2. Program names in PATH (e.g., `firefox`)
3. Snap paths (e.g., `/snap/bin/code`)
4. Fallback executables (e.g., `code-oss`)

**conditionalFlags** Format:
```json
{
  "launchFlags.settingKey": ["--flag1", "--flag2"]
}
```

Setting key is checked in `extension-settings.json`:
```javascript
if (extensionSettings.get('launchFlags.settingKey') !== false) {
    args.push('--flag1', '--flag2');
}
```

### features Object

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `isSingleInstance` | boolean | false | Single-instance app (launches once, restores N windows) |
| `timeout` | number | 45000 | Launch timeout in ms |
| `gracePeriod` | number | 30000 | Grace period after timeout in ms |
| `autoRestore` | boolean | false | App restores own windows (no explicit launch needed) |
| `titleStabilizationDelay` | number | 0 | Delay before initial save/restore (for apps that change title) |

**isSingleInstance:**
- `true`: Launch once, expect app to open all windows itself (browsers, IDEs)
- `false`: Launch for each saved instance (text editors, terminals)

**timeout:**
- Time in ms until launch is considered "timeout"
- After timeout: Grace period begins
- Default: 45000 (45 sec)
- Single-instance apps: 120000 (2 min)

**gracePeriod:**
- Additional waiting time after timeout
- Window can still be "late-matched"
- Default: 30000 (30 sec)
- Single-instance apps: 60000 (1 min)

**titleStabilizationDelay:**
- Delay before initial save/restore
- For apps that change title after startup (e.g., VSCode loads project)
- Prevents false instance creation due to unstable title
- Default: 0 (no delay)
- VSCode: 1500ms
- JetBrains IDEs: 2000ms

### settings Object (for Settings UI)

**Format:**
```json
{
  "settingKey": {
    "type": "app_config",
    "label": "Setting Label",
    "description": "Setting description",
    "check": { ... },
    "configure": { ... },
    "unconfigure": { ... },
    "openSettings": { ... }
  }
}
```

**check Object** (Check if setting is enabled):

```json
// JSON Key Check
{
  "type": "json_key",
  "path": "~/.config/myapp/config.json",
  "key": "window.restore",
  "value": true
}

// Firefox Profile Check
{
  "type": "firefox_profile",
  "pattern": "browser.startup.page\", 3"
}
```

**configure Object** (Enable setting):

```json
// JSON Set
{
  "type": "json_set",
  "path": "~/.config/myapp/config.json",
  "key": "window.restore",
  "value": true
}

// Firefox
{
  "type": "firefox",
  "prefLine": "user_pref(\"browser.startup.page\", 3);",
  "checkPattern": "browser.startup.page\", 3"
}
```

**unconfigure Object** (Disable setting):

```json
// Manual (User must disable themselves)
{
  "type": "manual",
  "message": "Please disable in MyApp settings:\n1. Open MyApp\n2. Go to Settings\n3. Disable 'Restore Windows'"
}

// JSON Set (automatic)
{
  "type": "json_set",
  "path": "~/.config/myapp/config.json",
  "key": "window.restore",
  "value": false
}
```

**openSettings Object** (Open settings):

```json
// URL
{
  "type": "url",
  "url": "about:preferences"
}

// Command
{
  "type": "command",
  "cmd": ["myapp", "--settings"]
}
```

## Provider Types

### mozilla-browser

Browser with Mozilla technology (Firefox, Thunderbird).

**Characteristics:**
- Single-instance
- Session restore via `--restore-session` flag
- Profile-based configuration

**Example:** `plugins/firefox/`

### chromium-browser

Chromium-based browser (Chrome, Brave, Edge).

**Characteristics:**
- Single-instance (optional multi-profile)
- Session restore via `--restore-last-session` flag
- Deduplication of browser sessions

**Example:** `plugins/chrome/`, `plugins/brave/`

### editor

Text editors and code editors.

**Characteristics:**
- Multi-instance (mostly)
- Document path restoration via parseTitleData
- Working directory tracking

**Example:** `plugins/gedit/`, `plugins/xed/`, `plugins/scite/`

### ide

Integrated development environments.

**Characteristics:**
- Single-instance (mostly)
- Project path restoration
- Title stabilization delay (project loads slowly)
- Aggressive restore timings (self-positioning)

**Example:** `plugins/vscode/`, `plugins/jetbrains/`

### office

Office applications.

**Characteristics:**
- Multi-instance
- Document path restoration
- WM_CLASS migration (LibreOffice: Soffice → libreoffice-calc)

**Example:** `plugins/libreoffice/`

### file-manager

File managers.

**Characteristics:**
- Multi-instance (different tabs/windows)
- Path restoration
- Tab state restoration (if supported)

**Example:** `plugins/nemo/`

### terminal

Terminal emulators.

**Characteristics:**
- Multi-instance
- Working directory restoration
- Command history restoration (if supported)

**Example:** `plugins/wave/`

## Developing Handler Class

### Naming Convention

**Class Name:** `<Name>Handler`

**Examples:**
- `FirefoxHandler`
- `VSCodeHandler`
- `ThunderbirdHandler`

**IMPORTANT:** Class MUST end with `Handler`, otherwise it won't be recognized!

### Constructor Signature

```javascript
constructor(config, extensionSettings, storage)
```

**Parameters:**
- `config`: Plugin config from config.json
- `extensionSettings`: Extension settings service (for launchFlags)
- `storage`: Storage service (for deduplication, etc.)

**Example:**
```javascript
constructor(config, extensionSettings, storage) {
    this._config = config;
    this._extensionSettings = extensionSettings;
    this._storage = storage;

    // Optional: Custom restore timings
    this.restoreTimings = [500, 1500, 3000, 5000];
}
```

### Hook: beforeLaunch

**Signature:**
```javascript
beforeLaunch(instance, launchParams)
```

**Parameters:**
- `instance`: Saved instance data
- `launchParams`: `{ executable, args, workDir }`

**Return:** Modified `launchParams` object

**Use Cases:**
- Custom executable selection
- Dynamic flag addition
- Working directory modification
- Conditional logic based on instance data

**Example:**
```javascript
beforeLaunch(instance, launchParams) {
    // Add profile flag
    if (instance.profile_name) {
        launchParams.args.push('--profile', instance.profile_name);
    }

    // Override workDir
    if (instance.project_path) {
        launchParams.workDir = instance.project_path;
    }

    return launchParams;
}
```

### Hook: parseTitleData

**Signature:**
```javascript
parseTitleData(titleSnapshot, instance)
```

**Parameters:**
- `titleSnapshot`: Saved window title
- `instance`: Full instance data (for `document_path`, `open_documents` access)

**Return:** `string[]` (arguments) or `null`

**Use Cases:**
- Extract document paths from title
- Parse project names
- Extract session identifiers

**Example 1: Document Editor**
```javascript
parseTitleData(titleSnapshot, instance) {
    // Title format: "/path/to/document.txt - Gedit"
    const match = titleSnapshot.match(/^(.+?)\s*-\s*Gedit$/);
    if (match) {
        const filePath = match[1];
        // Verify file exists (requires: const Gio = imports.gi.Gio;)
        const file = Gio.File.new_for_path(filePath);
        if (file.query_exists(null)) {
            return [filePath];
        }
    }

    // Fallback to document_path
    if (instance.document_path) {
        return [instance.document_path];
    }

    // Fallback to open_documents
    if (instance.open_documents && instance.open_documents.length > 0) {
        return instance.open_documents;
    }

    return null;
}
```

**Example 2: IDE (JetBrains)**
```javascript
parseTitleData(titleSnapshot, instance) {
    // Title format: "ProjectName - [/path/to/file.java] - IntelliJ IDEA"
    const projectMatch = titleSnapshot.match(/^(.+?)\s*-\s*\[/);
    if (projectMatch) {
        const projectName = projectMatch[1];
        // Search for project in recent projects
        const projectPath = this._findProjectPath(projectName);
        if (projectPath) {
            return [projectPath];
        }
    }

    // Fallback to working_dir
    if (instance.working_dir) {
        return [instance.working_dir];
    }

    return null;
}
```

**Example 3: LibreOffice**
```javascript
parseTitleData(titleSnapshot, instance) {
    // Title format: "document.odt - LibreOffice Writer"
    // (requires: const Gio = imports.gi.Gio; const GLib = imports.gi.GLib;)
    const match = titleSnapshot.match(/^(.+?)\s*-\s*LibreOffice/);
    if (match) {
        const filename = match[1];

        // Try document_path first
        if (instance.document_path) {
            return [instance.document_path];
        }

        // Search in common locations
        const searchDirs = [
            instance.working_dir || GLib.get_home_dir(),
            GLib.build_filenamev([GLib.get_home_dir(), 'Documents'])
        ];

        for (const dir of searchDirs) {
            const filePath = GLib.build_filenamev([dir, filename]);
            const file = Gio.File.new_for_path(filePath);
            if (file.query_exists(null)) {
                return [filePath];
            }
        }
    }

    return null;
}
```

### Hook: afterLaunch

**Signature:**
```javascript
afterLaunch(instance, pid, success)
```

**Parameters:**
- `instance`: Saved instance data
- `pid`: Process ID (or null if launch failed)
- `success`: Boolean indicating launch success

**Return:** void

**Use Cases:**
- Logging
- Post-launch cleanup
- Statistics tracking
- Error handling

**Example:**
```javascript
afterLaunch(instance, pid, success) {
    if (success) {
        global.log(`MyApp launched with PID ${pid} for ${instance.title_snapshot}`);

        // Track launch for analytics
        this._launchCount = (this._launchCount || 0) + 1;
    } else {
        global.logError(`Failed to launch MyApp for ${instance.title_snapshot}`);

        // Maybe cleanup invalid instance
        if (!instance.cmdline || instance.cmdline.length === 0) {
            this._removeInvalidInstance(instance);
        }
    }
}
```

### Hook: shouldSkipRestore

**Signature:**
```javascript
shouldSkipRestore(instance)
```

**Parameters:**
- `instance`: Saved instance data

**Return:** `boolean` (true = skip, false = restore)

**Use Cases:**
- Skip transient windows (Settings, Preferences, etc.)
- Skip dialog windows
- Skip specific window types

**Example 1: Thunderbird (Skip Compose Windows)**
```javascript
shouldSkipRestore(instance) {
    const title = instance.title_snapshot || '';

    // Skip Compose/Write windows (transient, can't restore content)
    if (title.includes('Compose:') ||
        title.includes('Write:') ||
        title.includes('New Message')) {
        return true;
    }

    // Skip Address Book
    if (title.includes('Address Book')) {
        return true;
    }

    return false;
}
```

**Example 2: IDE (Skip Settings/Dialogs)**
```javascript
shouldSkipRestore(instance) {
    const title = instance.title_snapshot || '';

    // Skip settings/preferences windows
    const skipPatterns = [
        'Settings',
        'Preferences',
        'Configure',
        'Options',
        'About'
    ];

    for (const pattern of skipPatterns) {
        if (title.includes(pattern)) {
            return true;
        }
    }

    return false;
}
```

### Property: restoreTimings

**Type:** `number[]`

**Description:** Multiple restore attempts for apps with aggressive self-positioning.

**Example:**
```javascript
constructor(config, extensionSettings, storage) {
    // VS Code aggressively repositions windows
    // Try multiple times with increasing delays
    this.restoreTimings = [500, 1500, 3000, 5000, 8000];
}
```

**Used in:** `core/positionRestorer.js`
```javascript
// (requires: const Mainloop = imports.mainloop;)

// Initial restore
this._applyGeometry(metaWindow, instance);

// Retry attempts for aggressive apps
if (handler && handler.restoreTimings) {
    for (const delay of handler.restoreTimings) {
        Mainloop.timeout_add(delay, () => {
            this._applyGeometry(metaWindow, instance);
            return false;
        });
    }
}
```

### Method: destroy

**Signature:**
```javascript
destroy()
```

**Description:** Cleanup when plugin is unloaded.

**Example:**
```javascript
// (requires: const Mainloop = imports.mainloop;)
destroy() {
    // Cleanup timers
    if (this._cleanupTimer) {
        Mainloop.source_remove(this._cleanupTimer);
        this._cleanupTimer = null;
    }

    // Cleanup resources
    this._cache = null;
}
```

## Example Plugins

### Simple Plugin: Firefox

**File:** `plugins/firefox/config.json`

```json
{
  "name": "firefox",
  "displayName": "Firefox",
  "version": "1.0.0",
  "description": "Browser session restore support",
  "wmClass": ["firefox", "Firefox", "Navigator"],
  "type": "mozilla-browser",

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

**No handler class needed!** Firefox restores session itself via `--restore-session`.

### Medium-complexity Plugin: VS Code

**File:** `plugins/vscode/config.json`

```json
{
  "name": "vscode",
  "displayName": "Visual Studio Code",
  "version": "1.0.0",
  "description": "Editor with aggressive restore timings",
  "wmClass": ["code", "Code", "code-oss", "Code - OSS"],
  "type": "editor",
  "handler": "index.js",

  "launch": {
    "executables": [
      "code",
      "/usr/bin/code",
      "/snap/bin/code"
    ],
    "flags": [],
    "conditionalFlags": {}
  },

  "features": {
    "isSingleInstance": true,
    "timeout": 90000,
    "gracePeriod": 45000,
    "autoRestore": true,
    "titleStabilizationDelay": 1500
  }
}
```

**File:** `plugins/vscode/index.js`

```javascript
var VSCodeHandler = class VSCodeHandler {
    constructor(config) {
        this._config = config;

        // VS Code self-positions aggressively
        // Multiple restore attempts needed
        this.restoreTimings = [500, 1500, 3000, 5000, 8000];
    }

    destroy() {
        // Nothing to clean up
    }
};
```

### Complex Plugin: Thunderbird

**File:** `plugins/thunderbird/config.json`

```json
{
  "name": "thunderbird",
  "displayName": "Thunderbird",
  "version": "1.0.0",
  "description": "Multi-profile email client with session restore",
  "wmClass": ["thunderbird", "Thunderbird", "Mail"],
  "type": "mozilla-browser",
  "handler": "index.js",

  "launch": {
    "executables": ["thunderbird"],
    "flags": [],
    "conditionalFlags": {
      "launchFlags.thunderbirdSessionRestore": ["--restore-session"]
    }
  },

  "features": {
    "isSingleInstance": true,
    "timeout": 90000,
    "gracePeriod": 45000
  }
}
```

**File:** `plugins/thunderbird/index.js`

```javascript
var ThunderbirdHandler = class ThunderbirdHandler {
    constructor(config, extensionSettings, storage) {
        this._config = config;
        this._storage = storage;
    }

    beforeLaunch(instance, launchParams) {
        // Add profile flag if profile detected
        if (instance.profile_name) {
            launchParams.args.push('--profile', instance.profile_name);
        }
        return launchParams;
    }

    parseTitleData(titleSnapshot, instance) {
        // Extract profile name from title
        // Format: "Inbox - username@example.com - Mozilla Thunderbird"
        const match = titleSnapshot.match(/-\s*([^@]+@[^-]+)\s*-/);
        if (match) {
            const email = match[1].trim();
            // Store for future launches
            if (!instance.profile_name) {
                instance.profile_name = this._findProfileByEmail(email);
            }
        }
        return null; // Thunderbird restores via --restore-session
    }

    shouldSkipRestore(instance) {
        const title = instance.title_snapshot || '';

        // Skip Compose/Write windows (can't restore content)
        if (title.includes('Compose:') ||
            title.includes('Write:') ||
            title.includes('New Message')) {
            return true;
        }

        return false;
    }

    _findProfileByEmail(email) {
        // Search profiles.ini for profile matching email
        // Implementation details omitted for brevity
        return 'default'; // Fallback
    }

    destroy() {
        // Cleanup
    }
};
```

### Very Complex Plugin: LibreOffice

**File:** `plugins/libreoffice/config.json`

```json
{
  "name": "libreoffice",
  "displayName": "LibreOffice",
  "version": "1.0.0",
  "description": "Office suite with document path restoration",
  "wmClass": [
    "libreoffice",
    "libreoffice-writer",
    "libreoffice-calc",
    "libreoffice-impress",
    "libreoffice-draw",
    "libreoffice-base",
    "Soffice"
  ],
  "type": "office",
  "handler": "index.js",

  "launch": {
    "executables": [
      "libreoffice",
      "/usr/bin/libreoffice"
    ],
    "flags": [],
    "conditionalFlags": {}
  },

  "features": {
    "isSingleInstance": false,
    "timeout": 60000,
    "gracePeriod": 30000
  }
}
```

**File:** `plugins/libreoffice/index.js`

```javascript
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

var LibreOfficeHandler = class LibreOfficeHandler {
    constructor(config, extensionSettings, storage) {
        this._config = config;
        this._storage = storage;
    }

    beforeLaunch(instance, launchParams) {
        // Deduplicate: Check if document already open
        const documentPath = instance.document_path;
        if (documentPath && this._isDocumentAlreadyOpen(documentPath)) {
            global.log(`LibreOffice: Document ${documentPath} already open, skipping launch`);
            // Return null to skip launch
            return null;
        }

        return launchParams;
    }

    parseTitleData(titleSnapshot, instance) {
        // Title format: "document.odt - LibreOffice Writer"
        const match = titleSnapshot.match(/^(.+?)\s*-\s*LibreOffice/);
        if (!match) {
            return null;
        }

        const filename = match[1];

        // 1. Try document_path (most reliable)
        if (instance.document_path) {
            const file = Gio.File.new_for_path(instance.document_path);
            if (file.query_exists(null)) {
                return [instance.document_path];
            }
        }

        // 2. Try working_dir + filename
        if (instance.working_dir) {
            const filePath = GLib.build_filenamev([instance.working_dir, filename]);
            const file = Gio.File.new_for_path(filePath);
            if (file.query_exists(null)) {
                return [filePath];
            }
        }

        // 3. Search common locations
        const searchDirs = [
            GLib.build_filenamev([GLib.get_home_dir(), 'Documents']),
            GLib.build_filenamev([GLib.get_home_dir(), 'Downloads']),
            GLib.get_home_dir()
        ];

        for (const dir of searchDirs) {
            const filePath = GLib.build_filenamev([dir, filename]);
            const file = Gio.File.new_for_path(filePath);
            if (file.query_exists(null)) {
                global.log(`LibreOffice: Found ${filename} in ${dir}`);
                return [filePath];
            }
        }

        global.log(`LibreOffice: Could not find ${filename}`);
        return null;
    }

    _isDocumentAlreadyOpen(documentPath) {
        // Check all open windows to see if document is already open
        let isOpen = false;
        global.get_window_actors().forEach(actor => {
            const metaWindow = actor.get_meta_window();
            if (!metaWindow) return;

            const wmClass = metaWindow.get_wm_class();
            if (!wmClass || !this._config.wmClass.includes(wmClass)) {
                return;
            }

            const title = metaWindow.get_title() || '';
            const filename = GLib.path_get_basename(documentPath);
            if (title.includes(filename)) {
                isOpen = true;
            }
        });

        return isOpen;
    }

    destroy() {
        // Cleanup
    }
};
```

## Launch Flags and Conditional Flags

### Static Flags

Always added at launch.

**Example:**
```json
{
  "launch": {
    "flags": [
      "--disable-gpu-sandbox",
      "--new-window",
      "--verbose"
    ]
  }
}
```

### Conditional Flags

Only added when setting is enabled.

**In config.json:**
```json
{
  "launch": {
    "conditionalFlags": {
      "launchFlags.myappSessionRestore": ["--restore-session"],
      "launchFlags.myappVerbose": ["--verbose", "--log-level=debug"],
      "launchFlags.myappPrivateMode": ["--incognito"]
    }
  }
}
```

**Settings File** (`~/.config/remember@thechief/extension-settings.json`):
```json
{
  "launchFlags": {
    "myappSessionRestore": true,
    "myappVerbose": false,
    "myappPrivateMode": false
  }
}
```

**Runtime Check:**
```javascript
// SessionLauncher._launchWithPlugin
if (plugin.launch.conditionalFlags) {
    for (const [settingKey, flags] of Object.entries(plugin.launch.conditionalFlags)) {
        if (this._extensionSettings.get(settingKey) !== false) {
            args.push(...flags);
        }
    }
}
```

**Result:**
```bash
# Only --restore-session is added (other flags disabled)
myapp --restore-session
```

## Single-Instance vs. Multi-Instance

### Single-Instance Apps

**Characteristics:**
- App launched ONCE
- App opens all windows itself (e.g., via session restore)
- Examples: Browsers, IDEs, email clients

**Config:**
```json
{
  "features": {
    "isSingleInstance": true,
    "timeout": 120000,
    "gracePeriod": 60000
  }
}
```

**Launch Behavior:**
```
Saved Instances: [Window1, Window2, Window3]
    ↓
Launch Queue: [Launch1 covering all 3 instances]
    ↓
Spawn Process: myapp --restore-session
    ↓
Progress Window shows: 3 instances
    ↓
App opens: Window1, Window2, Window3
    ↓
Each window matched to saved instance
    ↓
Positions restored individually
```

### Multi-Instance Apps

**Characteristics:**
- Each instance is launched separately
- Each instance is a separate process
- Examples: Text editors, terminals, file managers

**Config:**
```json
{
  "features": {
    "isSingleInstance": false,
    "timeout": 45000,
    "gracePeriod": 30000
  }
}
```

**Launch Behavior:**
```
Saved Instances: [Doc1.txt, Doc2.txt, Doc3.txt]
    ↓
Launch Queue: [Launch1, Launch2, Launch3]
    ↓
Spawn Process 1: myapp Doc1.txt
[500ms delay]
Spawn Process 2: myapp Doc2.txt
[500ms delay]
Spawn Process 3: myapp Doc3.txt
    ↓
Progress Window shows: 3 instances
    ↓
Each process creates window
    ↓
Each window matched to launched instance
    ↓
Positions restored
```

## Timeouts and Grace Periods

### Standard Timeouts

```javascript
const TIMEOUTS = {
    // Normal apps
    default: {
        timeout: 45000,      // 45 sec
        gracePeriod: 30000   // 30 sec
    },

    // Single-instance apps
    singleInstance: {
        timeout: 120000,     // 2 min
        gracePeriod: 60000   // 1 min
    }
};
```

### Custom Timeouts (via Plugin)

```json
{
  "features": {
    "timeout": 90000,
    "gracePeriod": 45000
  }
}
```

### Timeout Flow

```
Launch App
    ↓
[timeout ms]
    ↓
Timeout triggered?
    Yes → Enter Grace Period
        ↓
        [gracePeriod ms]
        ↓
        Window appeared?
            Yes → Match & Restore
            No  → Give up, cleanup
    ↓
No → Window appeared → Match & Restore
```

### Grace Period Use Cases

1. **Slow apps** (e.g., LibreOffice with large documents)
2. **Network-dependent apps** (e.g., email clients that need to sync first)
3. **Single-instance apps** (e.g., browser finding existing instance first)

## Title Stabilization

### Problem

Some apps change their title after opening:
- VSCode: "Visual Studio Code" → "ProjectName - Visual Studio Code"
- JetBrains IDEs: "IntelliJ IDEA" → "ProjectName - [file.java] - IntelliJ IDEA"
- Browsers: "New Tab" → "Page Title"

This leads to incorrect instance matches during tracking.

### Solution: titleStabilizationDelay

**Config:**
```json
{
  "features": {
    "titleStabilizationDelay": 1500
  }
}
```

**Effect:**

1. **Initial Track (no save):**
   ```javascript
   // (requires: const Mainloop = imports.mainloop;)
   _trackWindow(metaWindow) {
       // Window is tracked, but...

       if (titleStabilizationDelay > 0) {
           // NO immediate save!
           // Wait until title is stable
           Mainloop.timeout_add(titleStabilizationDelay + 500, () => {
               this._onWindowChanged(metaWindow); // Save AFTER stabilization
           });
       }
   }
   ```

2. **Restore (with delay):**
   ```javascript
   // (requires: const Mainloop = imports.mainloop;)
   _onWindowCreated(metaWindow) {
       if (titleStabilizationDelay > 0) {
           // Wait for stable title before matching
           Mainloop.timeout_add(titleStabilizationDelay, () => {
               this._positionRestorer.tryRestorePosition(metaWindow, true);
           });
       }
   }
   ```

**Recommended values:**
- VSCode: 1500ms
- JetBrains IDEs: 2000ms
- Browsers: 0ms (title change is ok, match via X11 ID)

## Testing and Debugging

### Enable Debug Mode

```bash
export REMEMBER_DEBUG=1
cinnamon --replace &
```

### Check Plugin Loading

```bash
tail -f ~/.xsession-errors | grep -i "plugin"
```

**Expected Output:**
```
remember@thechief: Loaded plugin: myapp (myapp, MyApp)
remember@thechief: Loaded handler for plugin: myapp
remember@thechief: PluginManager initialized with 15 plugins
```

### Check Plugin Config

```javascript
// In Looking Glass (Alt+F2 → lg)
global.windowRemember._pluginManager.getPlugin('myapp')
```

**Output:**
```javascript
{
  name: "myapp",
  wmClass: ["myapp", "MyApp"],
  launch: { ... },
  features: { ... },
  _path: "/path/to/plugin",
  ...
}
```

### Check Handler Loading

```javascript
// Check if handler loaded
global.windowRemember._pluginManager.getHandler('myapp')
```

**Output:**
```javascript
MyAppHandler {
  _config: { ... },
  restoreTimings: [500, 1500, 3000]
}
```

### Test Launch

1. **Save current state:**
   ```javascript
   Main.windowRemember.saveAll()
   ```

2. **Close your app**

3. **Check saved data:**
   ```bash
   cat ~/.config/remember@thechief/positions.json | jq '.apps.myapp'
   ```

4. **Test launch:**
   ```javascript
   Main.windowRemember.launchSession()
   ```

5. **Watch logs:**
   ```bash
   tail -f ~/.xsession-errors | grep -E "(myapp|remember@thechief)"
   ```

**Expected Log Sequence:**
```
remember@thechief: [Plugin:myapp] Launched myapp (WS1) with [--flag1, --flag2]
remember@thechief: Spawned myapp with PID 12345
remember@thechief: Window appeared for launched app: myapp (myapp-1737321234567-0)
remember@thechief: Restoring position for myapp (exact title match)
remember@thechief: Restored myapp to workspace 0, monitor 0
```

### Test Restore Timings

For apps with aggressive self-positioning:

```bash
# Enable debug to see restore attempts
export REMEMBER_DEBUG=1
cinnamon --replace &

# Launch app
Main.windowRemember.launchSession()

# Watch for multiple restore attempts
tail -f ~/.xsession-errors | grep -i "restoring position"
```

**Expected Output (VSCode with restoreTimings):**
```
remember@thechief: Restoring position for code (attempt 1/5)
[500ms later]
remember@thechief: Restoring position for code (attempt 2/5)
[1000ms later]
remember@thechief: Restoring position for code (attempt 3/5)
...
```

### Test parseTitleData

```javascript
// Manual test in Looking Glass
const handler = global.windowRemember._pluginManager.getHandler('myapp');
const titleSnapshot = "document.txt - MyApp";
const instance = { working_dir: "/home/user" };

const args = handler.parseTitleData(titleSnapshot, instance);
global.log(`Parsed args: ${JSON.stringify(args)}`);
// Expected: ["/home/user/document.txt"]
```

### Common Issues

#### Plugin not loaded

**Symptom:**
```
remember@thechief: PluginManager initialized with 14 plugins
# myapp missing from list
```

**Checks:**
1. config.json exists?
   ```bash
   ls -la ~/.config/remember@thechief/plugins/myapp/config.json
   ```

2. JSON valid?
   ```bash
   cat ~/.config/remember@thechief/plugins/myapp/config.json | jq
   ```

3. `name` and `wmClass` present?
   ```bash
   cat config.json | jq '{name, wmClass}'
   ```

#### Handler not loaded

**Symptom:**
```
remember@thechief: Loaded plugin: myapp (myapp)
# No "Loaded handler for plugin: myapp"
```

**Checks:**
1. `handler` field in config.json?
   ```bash
   cat config.json | jq .handler
   ```

2. index.js exists?
   ```bash
   ls -la ~/.config/remember@thechief/plugins/myapp/index.js
   ```

3. Handler class ends with "Handler"?
   ```javascript
   // WRONG:
   var MyApp = class MyApp { ... }

   // CORRECT:
   var MyAppHandler = class MyAppHandler { ... }
   ```

#### Launch fails

**Symptom:**
```
remember@thechief: Failed to spawn myapp: GLib.spawn_async returned false
```

**Checks:**
1. Executable in PATH?
   ```bash
   which myapp
   ```

2. Executable in plugin config?
   ```bash
   cat config.json | jq .launch.executables
   ```

3. Permissions ok?
   ```bash
   ls -la $(which myapp)
   ```

#### Position not restored

**Symptom:**
App launched, but position is wrong.

**Checks:**
1. Instance matched?
   ```bash
   cat ~/.config/remember@thechief/positions.json | jq '.apps.myapp.instances[] | {id, assigned}'
   ```

2. Restore timings sufficient?
   ```javascript
   // Add more aggressive timings
   this.restoreTimings = [500, 1000, 2000, 4000, 8000];
   ```

3. Debug restore attempts:
   ```bash
   export REMEMBER_DEBUG=1
   tail -f ~/.xsession-errors | grep "Restoring position"
   ```

## Best Practices

### 1. Complete wmClass Array

Some apps have multiple wmClasses (case variants, beta versions, etc.).

**Example VSCode:**
```json
{
  "wmClass": [
    "code",
    "Code",
    "code-oss",
    "Code - OSS",
    "code-insiders",
    "Code - Insiders"
  ]
}
```

### 2. Executable Fallbacks

Different distributions, installation methods.

**Example:**
```json
{
  "executables": [
    "myapp",                  // Generic
    "/usr/bin/myapp",         // Debian/Ubuntu
    "/usr/local/bin/myapp",   // Manual install
    "/snap/bin/myapp",        // Snap
    "/var/lib/flatpak/exports/bin/myapp",  // Flatpak system
    "~/.local/share/flatpak/exports/bin/myapp"  // Flatpak user
  ]
}
```

### 3. Conditional Flags for Features

Not all users want all features.

**Example:**
```json
{
  "conditionalFlags": {
    "launchFlags.myappSessionRestore": ["--restore-session"],
    "launchFlags.myappHardwareAcceleration": ["--enable-gpu"],
    "launchFlags.myappDebugMode": ["--verbose", "--log-level=debug"]
  }
}
```

Users can enable/disable in settings.

### 4. Deduplication in beforeLaunch

Prevent duplicate launches.

**Example:**
```javascript
beforeLaunch(instance, launchParams) {
    // Check if already open
    if (this._isInstanceAlreadyOpen(instance)) {
        global.log(`Instance ${instance.id} already open, skipping`);
        return null; // Skip launch
    }
    return launchParams;
}

_isInstanceAlreadyOpen(instance) {
    // Check running windows
    // (requires: const global = imports.gi.global;)
    let isOpen = false;
    global.get_window_actors().forEach(actor => {
        const metaWindow = actor.get_meta_window();
        if (!metaWindow) return;

        // Compare via x11_window_id (most reliable)
        if (instance.x11_window_id &&
            metaWindow.get_stable_sequence() === instance.x11_window_id) {
            isOpen = true;
        }

        // Or compare via title
        const title = metaWindow.get_title();
        if (title === instance.title_snapshot) {
            isOpen = true;
        }
    });
    return isOpen;
}
```

### 5. Graceful Fallbacks in parseTitleData

Try multiple strategies.

**Example:**
```javascript
parseTitleData(titleSnapshot, instance) {
    // 1. Try document_path (most reliable)
    if (instance.document_path && this._fileExists(instance.document_path)) {
        return [instance.document_path];
    }

    // 2. Try parsing title
    const parsedPath = this._parsePathFromTitle(titleSnapshot);
    if (parsedPath && this._fileExists(parsedPath)) {
        return [parsedPath];
    }

    // 3. Try open_documents
    if (instance.open_documents && instance.open_documents.length > 0) {
        const validDocs = instance.open_documents.filter(this._fileExists.bind(this));
        if (validDocs.length > 0) {
            return validDocs;
        }
    }

    // 4. Try working_dir (for project-based apps)
    if (instance.working_dir && this._dirExists(instance.working_dir)) {
        return [instance.working_dir];
    }

    return null;
}

_fileExists(filePath) {
    // (requires: const Gio = imports.gi.Gio;)
    try {
        const file = Gio.File.new_for_path(filePath);
        return file.query_exists(null);
    } catch (e) {
        return false;
    }
}

_dirExists(dirPath) {
    // (requires: const Gio = imports.gi.Gio;)
    try {
        const file = Gio.File.new_for_path(dirPath);
        return file.query_exists(null) && file.query_file_type(0, null) === Gio.FileType.DIRECTORY;
    } catch (e) {
        return false;
    }
}
```

### 6. Error Handling

Always program defensively.

**Example:**
```javascript
parseTitleData(titleSnapshot, instance) {
    // (requires: const Gio = imports.gi.Gio;)
    try {
        const filePath = this._extractPath(titleSnapshot);
        const file = Gio.File.new_for_path(filePath);
        if (file.query_exists(null)) {
            return [filePath];
        }
    } catch (e) {
        global.logError(`Failed to parse title: ${e}`);
        // Fallback to open_documents
        if (instance.open_documents) {
            return instance.open_documents;
        }
    }
    return null;
}
```

### 7. Logging for Debug

Helps with troubleshooting.

**Example:**
```javascript
beforeLaunch(instance, launchParams) {
    global.log(`MyApp beforeLaunch: executable=${launchParams.executable}, args=[${launchParams.args.join(', ')}]`);

    // Modify params
    if (instance.profile) {
        global.log(`MyApp: Adding profile ${instance.profile}`);
        launchParams.args.push('--profile', instance.profile);
    }

    return launchParams;
}
```

### 8. Testing on Current Cinnamon Version

Plugins only need to be tested on the current Cinnamon version.

**Test requirement:**
- Cinnamon 6.0+ (current stable version)

**What to test:**
- [ ] Executable paths (do the paths in `executables` work?)
- [ ] Config file locations (do the config files exist?)
- [ ] Default flags (does the app work with the flags?)
- [ ] Desktop file names (are the apps correctly recognized?)
- [ ] Launch and restore (does the entire workflow work?)

**Test workflow:**
1. Open app and position it
2. Click "Save All" in applet
3. Close app
4. Click "Launch Session" in applet
5. Verify app opens at correct position

## Plugin Contribution

Want to contribute your plugin to the extension repository?

### 1. Plugin Quality Checklist

- [ ] `config.json` complete and valid
- [ ] `wmClass` array covers all variants
- [ ] `executables` has fallbacks for different distros
- [ ] Handler class (if present) has error handling
- [ ] Plugin tested on at least 2 distributions
- [ ] Logs clean (no spam, useful debug info)
- [ ] No hardcoded user paths
- [ ] README.md with description and examples

### 2. Repository Structure

```
remember@thechief/
└── files/remember@thechief/
    └── plugins/
        └── myapp/
            ├── config.json
            ├── index.js (optional)
            └── README.md
```

### 3. README.md Template

```markdown
# MyApp Plugin

Support for MyApp with session restore and document path restoration.

## Features

- Session restore via `--restore-session` flag
- Document path restoration from window title
- Multi-profile support
- Aggressive restore timings for reliable positioning

## Configuration

This plugin supports the following settings in `extension-settings.json`:

- `launchFlags.myappSessionRestore`: Enable session restore (default: true)
- `launchFlags.myappVerbose`: Enable verbose logging (default: false)

## Supported Versions

- MyApp 1.x
- MyApp 2.x (beta)

## Known Issues

- MyApp Portable edition not supported (no system integration)
- Document paths with unicode characters may not restore correctly

## Testing

Tested on:
- Linux Mint 22.x (Cinnamon 6.0+) with MyApp 1.5.3
```

### 4. Pull Request

1. Fork Repository
2. Create Branch: `git checkout -b plugin/myapp`
3. Add Plugin: `plugins/myapp/`
4. Test thoroughly
5. Commit: `git commit -m "Add MyApp plugin with session restore support"`
6. Push: `git push origin plugin/myapp`
7. Create Pull Request

**PR Description Template:**

```markdown
## Plugin: MyApp

Adds support for MyApp with the following features:

- Session restore via `--restore-session`
- Document path restoration
- Multi-profile support

### Testing

Tested on:
- Linux Mint 22.x (Cinnamon 6.0+) with MyApp 1.5.3

### Checklist

- [x] config.json valid and complete
- [x] Handler class with error handling
- [x] Tested on multiple distributions
- [x] README.md included
- [x] No hardcoded user paths
- [x] Logs clean and useful
```

## Further Resources

- **Architecture:** `architecture.md` - System overview and design
- **API Reference:** `api-reference.md` - All APIs with examples
- **Contributing:** `contributing.md` - Code style, testing, PR process
