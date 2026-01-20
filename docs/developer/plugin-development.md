# Plugin-Entwicklung für Remember Extension

## Übersicht

Das Plugin-System ermöglicht app-spezifische Anpassungen für Window-Launching, Session-Restore und Position-Restaurierung ohne Änderungen am Extension-Core.

**Was Plugins können:**
- Executable-Pfade und Launch-Flags definieren
- Conditional Flags basierend auf User-Settings
- Single-Instance vs. Multi-Instance Verhalten steuern
- Timeouts und Grace Periods anpassen
- Title Stabilization Delays für Apps die ihren Titel ändern
- Session-Restore hooks (beforeLaunch, afterLaunch, parseTitleData)
- Deduplizierung für Browser-Sessions
- Custom Restore-Timings für aggressive Self-Positioning

**Plugin-Typen:**
- **Einfache Plugins:** Nur `config.json` (Launch-Config)
- **Erweiterte Plugins:** `config.json` + `index.js` (Handler-Klasse)

## Plugin-Struktur

### Verzeichnis-Layout

```
plugins/
├── firefox/
│   └── config.json          # Basic config (keine Handler-Klasse)
├── vscode/
│   ├── config.json          # Config mit handler reference
│   └── index.js             # VSCodeHandler Klasse
├── thunderbird/
│   ├── config.json
│   └── index.js             # ThunderbirdHandler mit parseTitleData
└── libreoffice/
    ├── config.json
    └── index.js             # LibreOfficeHandler mit deduplication
```

### Plugin-Pfade

**Built-in Plugins:**
```
~/.local/share/cinnamon/extensions/remember@thechief/plugins/
```

**User Plugins:**
```
~/.config/remember@thechief/plugins/
```

User-Plugins können Built-in Plugins überschreiben (gleicher Name).

## Plugin erstellen (Schritt-für-Schritt)

### Schritt 1: Plugin-Verzeichnis erstellen

```bash
# User-Plugin
mkdir -p ~/.config/remember@thechief/plugins/myapp

# Oder: Built-in Plugin (für Contribution)
cd ~/.local/share/cinnamon/extensions/remember@thechief/plugins/
mkdir myapp
```

### Schritt 2: config.json erstellen

Erstelle eine `config.json` Datei im Plugin-Verzeichnis. Es gibt zwei Varianten:

**Minimal-Beispiel (ohne Handler):**

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

**Vollständiges Beispiel (mit Handler):**

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

### Schritt 3: Handler-Klasse erstellen (optional)

**File:** `index.js`

```javascript
/**
 * MyApp Plugin Handler
 *
 * Handler für erweiterte Launch-Logik und Session-Restore.
 */

// Imports (benötigt für File-Operations in parseTitleData)
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

### Schritt 4: Plugin testen

```bash
# 1. Extension neu laden
# Drücke Alt+F2, tippe "r" und drücke Enter
# Oder: Rechtsklick auf Extension → "Reload"

# 2. Debug Mode aktivieren (optional)
export REMEMBER_DEBUG=1
cinnamon --replace &

# 3. Logs prüfen
tail -f ~/.xsession-errors | grep remember@thechief

# 4. Plugin-Loading verifizieren
# Should see: "Loaded plugin: myapp (myapp, MyApp)"

# 5. Test Launch
# 1. Öffne MyApp
# 2. Klicke auf "Save All" im Applet
# 3. Schließe MyApp
# 4. Klicke auf "Launch Session" im Applet
# 5. Überprüfe ob MyApp an der richtigen Position geöffnet wird
```

## config.json Referenz

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

Setting-Key wird in `extension-settings.json` geprüft:
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
- `true`: Launch einmal, erwartet dass die App alle Windows selbst öffnet (Browser, IDEs)
- `false`: Launch für jede gespeicherte Instance (Text-Editoren, Terminals)

**timeout:**
- Zeit in ms bis Launch als "timeout" gilt
- Nach Timeout: Grace Period beginnt
- Standard: 45000 (45 sec)
- Single-Instance Apps: 120000 (2 min)

**gracePeriod:**
- Zusätzliche Wartezeit nach Timeout
- Window kann noch "late-matched" werden
- Standard: 30000 (30 sec)
- Single-Instance Apps: 60000 (1 min)

**titleStabilizationDelay:**
- Delay vor initial save/restore
- Für Apps die Title ändern nach Startup (z.B. VSCode lädt Projekt)
- Verhindert false Instance-Creation durch unstabilen Title
- Standard: 0 (kein Delay)
- VSCode: 1500ms
- JetBrains IDEs: 2000ms

### settings Object (für Settings UI)

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

**check Object** (Prüfen ob Setting aktiviert ist):

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

**configure Object** (Setting aktivieren):

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

**unconfigure Object** (Setting deaktivieren):

```json
// Manual (User muss selbst deaktivieren)
{
  "type": "manual",
  "message": "Please disable in MyApp settings:\n1. Open MyApp\n2. Go to Settings\n3. Disable 'Restore Windows'"
}

// JSON Set (automatisch)
{
  "type": "json_set",
  "path": "~/.config/myapp/config.json",
  "key": "window.restore",
  "value": false
}
```

**openSettings Object** (Settings öffnen):

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

## Provider-Typen

### mozilla-browser

Browser mit Mozilla-Technologie (Firefox, Thunderbird).

**Merkmale:**
- Single-Instance
- Session-Restore via `--restore-session` flag
- Profile-basierte Konfiguration

**Beispiel:** `plugins/firefox/`

### chromium-browser

Chromium-based Browser (Chrome, Brave, Edge).

**Merkmale:**
- Single-Instance (optional Multi-Profile)
- Session-Restore via `--restore-last-session` flag
- Deduplizierung von Browser-Sessions

**Beispiel:** `plugins/chrome/`, `plugins/brave/`

### editor

Text-Editoren und Code-Editoren.

**Merkmale:**
- Multi-Instance (meist)
- Document-Path-Restoration via parseTitleData
- Working-Directory Tracking

**Beispiel:** `plugins/gedit/`, `plugins/xed/`, `plugins/scite/`

### ide

Integrierte Entwicklungsumgebungen.

**Merkmale:**
- Single-Instance (meist)
- Project-Path-Restoration
- Title Stabilization Delay (Projekt lädt langsam)
- Aggressive Restore Timings (Self-Positioning)

**Beispiel:** `plugins/vscode/`, `plugins/jetbrains/`

### office

Office-Anwendungen.

**Merkmale:**
- Multi-Instance
- Document-Path-Restoration
- WM_CLASS Migration (LibreOffice: Soffice → libreoffice-calc)

**Beispiel:** `plugins/libreoffice/`

### file-manager

Datei-Manager.

**Merkmale:**
- Multi-Instance (verschiedene Tabs/Windows)
- Path-Restoration
- Tab-State-Restoration (falls unterstützt)

**Beispiel:** `plugins/nemo/`

### terminal

Terminal-Emulatoren.

**Merkmale:**
- Multi-Instance
- Working-Directory-Restoration
- Command-History-Restoration (falls unterstützt)

**Beispiel:** `plugins/wave/`

## Handler-Klasse Entwickeln

### Naming Convention

**Klassen-Name:** `<Name>Handler`

**Beispiele:**
- `FirefoxHandler`
- `VSCodeHandler`
- `ThunderbirdHandler`

**WICHTIG:** Klasse MUSS mit `Handler` enden, sonst wird sie nicht erkannt!

### Constructor Signature

```javascript
constructor(config, extensionSettings, storage)
```

**Parameter:**
- `config`: Plugin config from config.json
- `extensionSettings`: Extension settings service (für launchFlags)
- `storage`: Storage service (für Deduplizierung, etc.)

**Beispiel:**
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

**Parameter:**
- `instance`: Saved instance data
- `launchParams`: `{ executable, args, workDir }`

**Return:** Modified `launchParams` object

**Use Cases:**
- Custom executable selection
- Dynamic flag addition
- Working directory modification
- Conditional logic based on instance data

**Beispiel:**
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

**Parameter:**
- `titleSnapshot`: Saved window title
- `instance`: Full instance data (für `document_path`, `open_documents` access)

**Return:** `string[]` (arguments) or `null`

**Use Cases:**
- Extract document paths from title
- Parse project names
- Extract session identifiers

**Beispiel 1: Document Editor**
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

**Beispiel 2: IDE (JetBrains)**
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

**Beispiel 3: LibreOffice**
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

**Parameter:**
- `instance`: Saved instance data
- `pid`: Process ID (or null if launch failed)
- `success`: Boolean indicating launch success

**Return:** void

**Use Cases:**
- Logging
- Post-launch cleanup
- Statistics tracking
- Error handling

**Beispiel:**
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

**Parameter:**
- `instance`: Saved instance data

**Return:** `boolean` (true = skip, false = restore)

**Use Cases:**
- Skip transient windows (Settings, Preferences, etc.)
- Skip dialog windows
- Skip specific window types

**Beispiel 1: Thunderbird (Skip Compose Windows)**
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

**Beispiel 2: IDE (Skip Settings/Dialogs)**
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

**Beispiel:**
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

**Beispiel:**
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

## Beispiel-Plugins

### Einfaches Plugin: Firefox

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

**Keine Handler-Klasse nötig!** Firefox restored Session selbst via `--restore-session`.

### Mittel-komplexes Plugin: VS Code

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

### Komplexes Plugin: Thunderbird

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

### Sehr komplexes Plugin: LibreOffice

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

## Launch Flags und Conditional Flags

### Static Flags

Immer beim Launch hinzugefügt.

**Beispiel:**
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

Nur hinzugefügt wenn Setting aktiviert ist.

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

**Charakteristik:**
- App launched EINMAL
- App öffnet alle Windows selbst (z.B. via Session-Restore)
- Beispiele: Browser, IDEs, Email-Clients

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

**Launch-Verhalten:**
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

**Charakteristik:**
- Jede Instance wird einzeln launched
- Jede Instance ist ein separater Prozess
- Beispiele: Text-Editoren, Terminals, File-Manager

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

**Launch-Verhalten:**
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

## Timeouts und Grace Periods

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

### Timeout-Flow

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

1. **Langsame Apps** (z.B. LibreOffice mit großen Dokumenten)
2. **Network-dependent Apps** (z.B. Email-Clients die erst sync müssen)
3. **Single-Instance Apps** (z.B. Browser der erst existierende Instanz findet)

## Title Stabilization

### Problem

Manche Apps ändern ihren Titel nach dem Öffnen:
- VSCode: "Visual Studio Code" → "ProjectName - Visual Studio Code"
- JetBrains IDEs: "IntelliJ IDEA" → "ProjectName - [file.java] - IntelliJ IDEA"
- Browsers: "New Tab" → "Page Title"

Das führt zu falschen Instance-Matches beim Tracking.

### Lösung: titleStabilizationDelay

**Config:**
```json
{
  "features": {
    "titleStabilizationDelay": 1500
  }
}
```

**Effekt:**

1. **Initial Track (keine Save):**
   ```javascript
   // (requires: const Mainloop = imports.mainloop;)
   _trackWindow(metaWindow) {
       // Window wird getracked, aber...

       if (titleStabilizationDelay > 0) {
           // KEIN sofortiges Save!
           // Warte bis Title stabil ist
           Mainloop.timeout_add(titleStabilizationDelay + 500, () => {
               this._onWindowChanged(metaWindow); // Save NACH Stabilisierung
           });
       }
   }
   ```

2. **Restore (mit Delay):**
   ```javascript
   // (requires: const Mainloop = imports.mainloop;)
   _onWindowCreated(metaWindow) {
       if (titleStabilizationDelay > 0) {
           // Warte auf stabilen Title bevor Matching
           Mainloop.timeout_add(titleStabilizationDelay, () => {
               this._positionRestorer.tryRestorePosition(metaWindow, true);
           });
       }
   }
   ```

**Empfohlene Werte:**
- VSCode: 1500ms
- JetBrains IDEs: 2000ms
- Browsers: 0ms (Title-Änderung ist ok, matchen via X11 ID)

## Testing und Debugging

### Debug Mode aktivieren

```bash
export REMEMBER_DEBUG=1
cinnamon --replace &
```

### Plugin-Loading prüfen

```bash
tail -f ~/.xsession-errors | grep -i "plugin"
```

**Expected Output:**
```
remember@thechief: Loaded plugin: myapp (myapp, MyApp)
remember@thechief: Loaded handler for plugin: myapp
remember@thechief: PluginManager initialized with 15 plugins
```

### Plugin-Config prüfen

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

### Handler-Loading prüfen

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

Für Apps mit aggressive Self-Positioning:

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

#### Plugin nicht geladen

**Symptom:**
```
remember@thechief: PluginManager initialized with 14 plugins
# myapp fehlt in der Liste
```

**Checks:**
1. config.json existiert?
   ```bash
   ls -la ~/.config/remember@thechief/plugins/myapp/config.json
   ```

2. JSON valide?
   ```bash
   cat ~/.config/remember@thechief/plugins/myapp/config.json | jq
   ```

3. `name` und `wmClass` vorhanden?
   ```bash
   cat config.json | jq '{name, wmClass}'
   ```

#### Handler nicht geladen

**Symptom:**
```
remember@thechief: Loaded plugin: myapp (myapp)
# Kein "Loaded handler for plugin: myapp"
```

**Checks:**
1. `handler` field in config.json?
   ```bash
   cat config.json | jq .handler
   ```

2. index.js existiert?
   ```bash
   ls -la ~/.config/remember@thechief/plugins/myapp/index.js
   ```

3. Handler-Klasse endet mit "Handler"?
   ```javascript
   // WRONG:
   var MyApp = class MyApp { ... }

   // CORRECT:
   var MyAppHandler = class MyAppHandler { ... }
   ```

#### Launch schlägt fehl

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

#### Position wird nicht restored

**Symptom:**
App launched, aber Position falsch.

**Checks:**
1. Instance matched?
   ```bash
   cat ~/.config/remember@thechief/positions.json | jq '.apps.myapp.instances[] | {id, assigned}'
   ```

2. Restore Timings ausreichend?
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

### 1. wmClass Array vollständig

Manche Apps haben multiple wmClasses (Case-Varianten, Beta-Versionen, etc.).

**Beispiel VSCode:**
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

Verschiedene Distributionen, Installation-Methoden.

**Beispiel:**
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

### 3. Conditional Flags für Features

Nicht alle User wollen alle Features.

**Beispiel:**
```json
{
  "conditionalFlags": {
    "launchFlags.myappSessionRestore": ["--restore-session"],
    "launchFlags.myappHardwareAcceleration": ["--enable-gpu"],
    "launchFlags.myappDebugMode": ["--verbose", "--log-level=debug"]
  }
}
```

User kann in Settings aktivieren/deaktivieren.

### 4. Deduplizierung in beforeLaunch

Verhindere doppelte Launches.

**Beispiel:**
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

Mehrere Strategien versuchen.

**Beispiel:**
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

Immer defensive programmieren.

**Beispiel:**
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
        // Fallback zu open_documents
        if (instance.open_documents) {
            return instance.open_documents;
        }
    }
    return null;
}
```

### 7. Logging für Debug

Hilft bei Troubleshooting.

**Beispiel:**
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

### 8. Testing auf aktueller Cinnamon-Version

Plugins müssen nur auf der aktuellen Cinnamon-Version getestet werden.

**Test-Anforderung:**
- Cinnamon 6.0+ (aktuelle stabile Version)

**Was testen:**
- [ ] Executable paths (funktionieren die Pfade in `executables`?)
- [ ] Config file locations (existieren die Config-Dateien?)
- [ ] Default flags (funktioniert die App mit den Flags?)
- [ ] Desktop file names (werden die Apps korrekt erkannt?)
- [ ] Launch und Restore (funktioniert der gesamte Workflow?)

**Test-Workflow:**
1. App öffnen und positionieren
2. "Save All" im Applet klicken
3. App schließen
4. "Launch Session" im Applet klicken
5. Überprüfen ob App an richtiger Position öffnet

## Plugin Contribution

Möchtest du dein Plugin zum Extension-Repository beitragen?

### 1. Plugin-Qualitäts-Checklist

- [ ] `config.json` vollständig und valide
- [ ] `wmClass` array deckt alle Varianten ab
- [ ] `executables` hat Fallbacks für verschiedene Distros
- [ ] Handler-Klasse (falls vorhanden) hat Error-Handling
- [ ] Plugin auf mind. 2 Distributionen getestet
- [ ] Logs sauber (keine Spam, nützliche Debug-Infos)
- [ ] Keine hardcoded User-Pfade
- [ ] README.md mit Beschreibung und Beispielen

### 2. Repository-Struktur

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

## Weitere Ressourcen

- **Architecture:** `architecture.md` - System-Übersicht und Design
- **API Reference:** `api-reference.md` - Alle APIs mit Beispielen
- **Contributing:** `contributing.md` - Code-Style, Testing, PR-Process
