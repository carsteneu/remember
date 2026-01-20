# Remember Extension - API-Referenz

Diese Datei dokumentiert alle APIs der Remember Extension für Entwickler, die mit der Extension interagieren oder sie erweitern möchten.

## Inhaltsverzeichnis

- [Main API](#main-api)
- [Module System](#module-system)
- [Plugin Manager API](#plugin-manager-api)
- [Storage API](#storage-api)
- [Logger API](#logger-api)
- [Extension Entry Points](#extension-entry-points)
- [Services APIs](#services-apis)

---

## Main API

Die globale API wird unter `Main.windowRemember` exposed und ist von überall im Cinnamon-Kontext zugänglich.

### Verfügbarkeit

```javascript
// Verfügbar nach extension.enable()
if (Main.windowRemember) {
    // API ready
}
```

### saveAll()

Speichert alle aktuell geöffneten Fenster-Positionen sofort.

**Signature:**
```javascript
Main.windowRemember.saveAll()
```

**Returns:** `void`

**Beispiel:**
```javascript
// Manuelles Speichern aller Positionen
Main.windowRemember.saveAll();
// Shows notification: "Saved N window positions"
```

**Verwendung:**
- Applet "Save All" Button
- User möchte manuell speichern vor Änderungen

**Interne Implementierung:**
```javascript
_saveAll() {
    if (!this._storage) return;
    this._storage.save();
    const stats = this._getStats();
    log('Force saved all positions');
    const message = _("Saved %d window positions").replace('%d', stats.savedInstances);
    Main.notify(_("Window Remember"), message);
}
```

---

### restoreAll()

Restauriert alle Fenster-Positionen aus dem gespeicherten State.

**Signature:**
```javascript
Main.windowRemember.restoreAll()
```

**Returns:** `void`

**Beispiel:**
```javascript
// Manuelles Restore aller Positionen
Main.windowRemember.restoreAll();
// Shows notification: "Restored N window positions"
```

**Verwendung:**
- Applet "Restore All" Button
- User hat Fenster manuell verschoben und möchte zurück zum saved state

**Verhalten:**
- Reset alle Assignments (marking instances as unassigned)
- Matched jedes laufende Fenster zu saved instance
- Restauriert Position, Workspace, Maximized, etc.
- `isNewWindow=false` - keine Minimierung vor Restore

**Interne Implementierung:**
```javascript
_restoreAll() {
    if (!this._tracker) return;
    this._tracker.resetAssignments();

    let restoredCount = 0;
    global.get_window_actors().forEach(actor => {
        const metaWindow = actor.get_meta_window();
        if (metaWindow && this._tracker._windowFilter.shouldTrack(metaWindow)) {
            // isNewWindow = false: manual restore
            this._tracker._positionRestorer.tryRestorePosition(metaWindow, false);
            restoredCount++;
        }
    });

    const message = _("Restored %d window positions").replace('%d', restoredCount);
    Main.notify(_("Window Remember"), message);
}
```

---

### launchSession()

Startet alle gespeicherten Apps mit `autostart=true`.

**Signature:**
```javascript
Main.windowRemember.launchSession()
```

**Returns:** `void`

**Beispiel:**
```javascript
// Manueller Session-Launch
Main.windowRemember.launchSession();
// Shows notification: "Launching N applications..."
```

**Verwendung:**
- Applet "Launch Session" Button
- User möchte manuell seine saved Session starten

**Verhalten:**
- Filter instances: nur `autostart=true`
- Reset assignments
- Launch via SessionLauncher
- Shows progress window

**Interne Implementierung:**
```javascript
_launchSession() {
    if (!this._launcher) return;

    this._tracker.resetAssignments();
    const count = this._launcher.launchSession();
    const message = _("Launching %d applications...").replace('%d', count);
    Main.notify(_("Window Remember"), message);
}
```

---

### toggle()

Aktiviert/Deaktiviert die Extension.

**Signature:**
```javascript
Main.windowRemember.toggle()
```

**Returns:** `boolean` - Neuer State (true=enabled, false=disabled)

**Beispiel:**
```javascript
// Toggle Extension
const newState = Main.windowRemember.toggle();
if (newState) {
    log("Extension enabled");
} else {
    log("Extension disabled");
}
```

**Verwendung:**
- Debugging
- Quick enable/disable ohne Extension Manager

**Verhalten:**
- Wenn enabled: ruft `disable()` auf
- Wenn disabled: ruft `enable()` auf

**WARNUNG:** Sollte nicht in Production verwendet werden. Nur für Testing.

---

### getStats()

Gibt Statistiken über tracked windows, saved apps/instances, etc. zurück.

**Signature:**
```javascript
Main.windowRemember.getStats()
```

**Returns:** `Object`

```javascript
{
    trackedWindows: number,      // Currently tracked windows
    savedApps: number,           // Number of apps in storage
    savedInstances: number,      // Total instances in storage
    pending: number,             // Pending launches
    expected: number,            // Expected launches (grace period)
    monitors: number             // Number of monitors
}
```

**Beispiel:**
```javascript
const stats = Main.windowRemember.getStats();
log(`Tracking ${stats.trackedWindows} windows`);
log(`Saved ${stats.savedInstances} instances from ${stats.savedApps} apps`);
log(`${stats.monitors} monitors detected`);
```

**Verwendung:**
- Settings Dialog: Overview Tab (Dashboard)
- Applet: Tooltip
- Debugging

---

### isEnabled()

Prüft ob Extension aktiviert ist.

**Signature:**
```javascript
Main.windowRemember.isEnabled()
```

**Returns:** `boolean`

**Beispiel:**
```javascript
if (Main.windowRemember.isEnabled()) {
    // Extension is active
}
```

---

### getMonitors()

Gibt Liste aller erkannten Monitore zurück.

**Signature:**
```javascript
Main.windowRemember.getMonitors()
```

**Returns:** `Array<Object>`

```javascript
[
    {
        index: number,
        connector: string,
        edid_hash: string,
        geometry: { x, y, width, height },
        is_primary: boolean
    },
    ...
]
```

**Beispiel:**
```javascript
const monitors = Main.windowRemember.getMonitors();
monitors.forEach(mon => {
    log(`Monitor ${mon.index}: ${mon.connector} (${mon.geometry.width}x${mon.geometry.height})`);
});
```

---

### closeWindow(x11WindowId)

Schließt ein Fenster via X11 Window ID.

**Signature:**
```javascript
Main.windowRemember.closeWindow(x11WindowId)
```

**Parameters:**
- `x11WindowId` (string) - X11 Window ID (e.g., "0x3a00012")

**Returns:** `boolean` - true wenn erfolgreich geschlossen

**Beispiel:**
```javascript
// Close window from Settings Dialog
const success = Main.windowRemember.closeWindow("0x3a00012");
if (success) {
    log("Window closed");
} else {
    log("Window not found or already closed");
}
```

**Verwendung:**
- Settings Dialog: Windows Tab (Delete button)

**Verhalten:**
- Findet Window via X11 ID
- Ruft `metaWindow.delete()` auf
- Loggt wmClass und Title

---

## Module System

Das Modul-System löst das GJS-Caching-Problem beim Laden von Modules aus Subdirectories.

### Modules.load()

Lädt ein Modul aus einem Subdirectory der Extension.

**File:** `modules.js`

**Signature:**
```javascript
Modules.load(extensionMeta, subdir, moduleName)
```

**Parameters:**
- `extensionMeta` (Object) - Extension metadata mit `path` property
- `subdir` (string) - Subdirectory name (z.B., "core", "services")
- `moduleName` (string) - Module name ohne `.js` extension

**Returns:** `Object` - Loaded module exports

**Beispiel:**
```javascript
const modulesModule = getExtensionModule('modules');
const Modules = modulesModule.Modules;

// Load core module
const { WindowFilter } = Modules.load(meta, 'core', 'windowFilter');
const { PositionRestorer } = Modules.load(meta, 'core', 'positionRestorer');

// Load service module
const { Logger } = Modules.load(meta, 'services', 'logger');
```

**Interne Implementierung:**
```javascript
load: function(extensionMeta, subdir, moduleName) {
    const cacheKey = `_${subdir}_${moduleName}`;

    // Return cached module
    if (moduleCache[cacheKey]) {
        return moduleCache[cacheKey];
    }

    const subdirPath = `${extensionMeta.path}/${subdir}`;
    const originalSearchPath = imports.searchPath.slice();

    try {
        imports.searchPath.unshift(subdirPath);
        const loadedModule = imports[moduleName];

        if (!loadedModule) {
            throw new Error(`Module '${moduleName}' not found in '${subdir}'`);
        }

        moduleCache[cacheKey] = loadedModule;
        return loadedModule;
    } finally {
        // Restore search path
        imports.searchPath.length = 0;
        for (let i = 0; i < originalSearchPath.length; i++) {
            imports.searchPath.push(originalSearchPath[i]);
        }
    }
}
```

---

### Modules.clearCache()

Leert den Modul-Cache (für Development/Debugging).

**Signature:**
```javascript
Modules.clearCache()
```

**Returns:** `void`

**Beispiel:**
```javascript
// Clear module cache
Modules.clearCache();
// Next load will reload from disk
```

**Verwendung:**
- Development: Nach Code-Änderungen
- Sollte NICHT in Production verwendet werden

---

### Modules.isCached()

Prüft ob ein Modul bereits cached ist.

**Signature:**
```javascript
Modules.isCached(subdir, moduleName)
```

**Parameters:**
- `subdir` (string) - Subdirectory name
- `moduleName` (string) - Module name

**Returns:** `boolean`

**Beispiel:**
```javascript
if (Modules.isCached('core', 'windowFilter')) {
    log("WindowFilter already loaded");
}
```

---

### Modules.getLogger()

Lädt Logger-Modul und gibt Logger-Funktionen zurück.

**Signature:**
```javascript
Modules.getLogger(extensionMeta)
```

**Parameters:**
- `extensionMeta` (Object) - Extension metadata

**Returns:** `Object`

```javascript
{
    log: function,        // Debug logging
    logError: function,   // Error logging
    isDebugMode: function // Check debug mode
}
```

**Beispiel:**
```javascript
const { log, logError, isDebugMode } = Modules.getLogger(meta);

log("Module loaded");  // Only logs if REMEMBER_DEBUG=1

if (isDebugMode()) {
    log("Debug mode active");
}
```

---

## Plugin Manager API

**File:** `pluginManager.js`

### Constructor

```javascript
new PluginManager(extensionPath, extensionSettings, storage, log, logError)
```

**Parameters:**
- `extensionPath` (string) - Extension installation path
- `extensionSettings` (ExtensionSettings) - Settings service instance
- `storage` (Storage) - Storage service instance
- `log` (function) - Logger function
- `logError` (function) - Error logger function

**Beispiel:**
```javascript
const pluginManager = new PluginManager(
    this._extPath,
    this._extensionSettings,
    this._storage,
    log,
    logError
);
```

---

### loadPlugins()

Lädt alle Plugins aus Built-in und User directories.

**Signature:**
```javascript
pluginManager.loadPlugins()
```

**Returns:** `void`

**Beispiel:**
```javascript
pluginManager.loadPlugins();
log(`PluginManager loaded ${pluginManager.getLoadedPlugins().length} plugins`);
```

**Verhalten:**
- Scannt `<extensionPath>/plugins/`
- Scannt `~/.config/remember@thechief/plugins/`
- User-Plugins überschreiben Built-in Plugins (gleicher Name)
- Lädt `config.json` (required)
- Lädt Handler-Klasse aus `index.js` (optional)

---

### getPlugin(wmClass)

Gibt Plugin-Config für einen wmClass zurück.

**Signature:**
```javascript
pluginManager.getPlugin(wmClass)
```

**Parameters:**
- `wmClass` (string) - Window manager class

**Returns:** `Object | null` - Plugin config oder null

**Beispiel:**
```javascript
const plugin = pluginManager.getPlugin('firefox');
if (plugin) {
    log(`Plugin: ${plugin.name}`);
    log(`Type: ${plugin.type}`);
    log(`Single-Instance: ${plugin.features.isSingleInstance}`);
}
```

**Config Structure:**
```javascript
{
    name: string,
    displayName: string,
    version: string,
    description: string,
    wmClass: string[],
    type: string,
    handler: string,
    launch: {
        executables: string[],
        flags: string[],
        conditionalFlags: object
    },
    features: {
        isSingleInstance: boolean,
        timeout: number,
        gracePeriod: number,
        autoRestore: boolean,
        titleStabilizationDelay: number
    },
    _path: string,      // Added by plugin loader
    _dirPath: string    // Added by plugin loader
}
```

---

### getHandler(wmClass)

Gibt Handler-Instanz für einen wmClass zurück.

**Signature:**
```javascript
pluginManager.getHandler(wmClass)
```

**Parameters:**
- `wmClass` (string) - Window manager class

**Returns:** `Object | null` - Handler instance oder null

**Beispiel:**
```javascript
const handler = pluginManager.getHandler('firefox');
if (handler && handler.beforeLaunch) {
    const params = handler.beforeLaunch(instance, launchParams);
}
```

**Handler Interface:**
```javascript
class Handler {
    constructor(config, extensionSettings, storage);

    // Optional: Modify launch parameters before app starts
    beforeLaunch(instance, launchParams): launchParams;

    // Optional: Extract document paths from window title
    parseTitleData(titleSnapshot, instance): string[] | null;

    // Optional: Called after app launch completes
    afterLaunch(instance, pid, success): void;

    // Optional: Skip restore for specific instances
    shouldSkipRestore(instance): boolean;

    // Optional: Custom restore timings [delay1, delay2, ...]
    restoreTimings: number[];

    // Required: Cleanup on handler destruction
    destroy(): void;
}
```

---

### hasPlugin(wmClass)

Prüft ob Plugin für wmClass existiert.

**Signature:**
```javascript
pluginManager.hasPlugin(wmClass)
```

**Parameters:**
- `wmClass` (string) - Window manager class

**Returns:** `boolean`

**Beispiel:**
```javascript
if (pluginManager.hasPlugin('firefox')) {
    // Use plugin-based launch
} else {
    // Use generic launch
}
```

---

### isSingleInstance(wmClass)

Prüft ob App single-instance ist (via Plugin-Config).

**Signature:**
```javascript
pluginManager.isSingleInstance(wmClass)
```

**Parameters:**
- `wmClass` (string) - Window manager class

**Returns:** `boolean`

**Beispiel:**
```javascript
if (pluginManager.isSingleInstance('firefox')) {
    log("Firefox is single-instance");
}
```

---

### getTimeout(wmClass)

Gibt Timeout für App zurück (aus Plugin-Config oder Default).

**Signature:**
```javascript
pluginManager.getTimeout(wmClass)
```

**Parameters:**
- `wmClass` (string) - Window manager class

**Returns:** `number` - Timeout in milliseconds

**Beispiel:**
```javascript
const timeout = pluginManager.getTimeout('firefox');
// Returns: 120000 (2 min for single-instance)
```

---

### getGracePeriod(wmClass)

Gibt Grace Period für App zurück.

**Signature:**
```javascript
pluginManager.getGracePeriod(wmClass)
```

**Parameters:**
- `wmClass` (string) - Window manager class

**Returns:** `number` - Grace period in milliseconds

**Beispiel:**
```javascript
const gracePeriod = pluginManager.getGracePeriod('firefox');
// Returns: 60000 (1 min for single-instance)
```

---

### getLoadedPlugins()

Gibt Liste aller geladenen Plugin-Namen zurück.

**Signature:**
```javascript
pluginManager.getLoadedPlugins()
```

**Returns:** `string[]`

**Beispiel:**
```javascript
const plugins = pluginManager.getLoadedPlugins();
log(`Loaded plugins: ${plugins.join(', ')}`);
// Output: "firefox, chrome, vscode, thunderbird, ..."
```

---

### getAllPlugins()

Gibt alle Plugins mit Configs und Handlers zurück (dedupliziert).

**Signature:**
```javascript
pluginManager.getAllPlugins()
```

**Returns:** `Array<Object>`

```javascript
[
    {
        name: string,
        config: object,
        handler: object | null
    },
    ...
]
```

**Beispiel:**
```javascript
const plugins = pluginManager.getAllPlugins();
plugins.forEach(p => {
    log(`Plugin: ${p.name}, Has Handler: ${p.handler !== null}`);
});
```

---

### getStats()

Gibt Statistiken über geladene Plugins zurück.

**Signature:**
```javascript
pluginManager.getStats()
```

**Returns:** `Object`

```javascript
{
    plugins: number,    // Total plugin configs (one per wmClass)
    handlers: number,   // Total handler instances
    names: string[]     // Unique plugin names
}
```

**Beispiel:**
```javascript
const stats = pluginManager.getStats();
log(`${stats.names.length} plugins loaded (${stats.handlers} handlers)`);
```

---

### reload()

Lädt alle Plugins neu (für Development).

**Signature:**
```javascript
pluginManager.reload()
```

**Returns:** `void`

**Beispiel:**
```javascript
// After changing plugin config
pluginManager.reload();
```

**WARNUNG:** Sollte nicht in Production verwendet werden.

---

### destroy()

Cleanup beim Extension-Disable.

**Signature:**
```javascript
pluginManager.destroy()
```

**Returns:** `void`

**Beispiel:**
```javascript
if (this._pluginManager) {
    this._pluginManager.destroy();
    this._pluginManager = null;
}
```

---

## Storage API

**File:** `services/storage.js`

### Constructor

```javascript
new Storage()
```

**Beispiel:**
```javascript
const storage = new Storage();
storage.init();
```

---

### init()

Initialisiert Storage, lädt Daten, startet Auto-Save.

**Signature:**
```javascript
storage.init()
```

**Returns:** `void`

**Beispiel:**
```javascript
const storage = new Storage();
storage._log = log;
storage._logError = logError;
storage.init();
```

**Verhalten:**
- Erstellt Config-Directory falls nicht vorhanden
- Härtet Permissions (0700 directory, 0600 files)
- Lädt `positions.json`
- Migriert alte Datenversionen
- Startet Auto-Save Timer (30 sec)

---

### save()

Speichert Daten synchron zu Disk.

**Signature:**
```javascript
storage.save()
```

**Returns:** `void`

**Beispiel:**
```javascript
storage.save();
```

**Verhalten:**
- Serialisiert Data zu JSON
- Schreibt zu `positions.json`
- Atomic write (via `replace_contents`)
- Härtet Permissions nach Write

**WICHTIG:** Wird automatisch alle 30 Sekunden aufgerufen. Manuelles `save()` meist nicht nötig.

---

### load()

Lädt Daten von Disk (wird von `init()` aufgerufen).

**Signature:**
```javascript
storage.load()
```

**Returns:** `void`

**Beispiel:**
```javascript
storage.load();
```

---

### getApp(wmClass)

Gibt App-Daten für wmClass zurück.

**Signature:**
```javascript
storage.getApp(wmClass)
```

**Parameters:**
- `wmClass` (string) - Window manager class

**Returns:** `Object | null`

```javascript
{
    wm_class: string,
    desktop_file: string,
    desktop_exec: string,
    instances: Array<Object>
}
```

**Beispiel:**
```javascript
const appData = storage.getApp('firefox');
if (appData) {
    log(`Firefox has ${appData.instances.length} instances`);
}
```

---

### setApp(wmClass, appData)

Setzt/Updated App-Daten.

**Signature:**
```javascript
storage.setApp(wmClass, appData)
```

**Parameters:**
- `wmClass` (string) - Window manager class
- `appData` (Object) - App data object

**Returns:** `void`

**Beispiel:**
```javascript
const appData = storage.getApp('firefox') || {
    wm_class: 'firefox',
    instances: []
};

appData.instances.push({
    id: 'firefox-123456-0',
    title_snapshot: 'Mozilla Firefox',
    workspace: 0,
    ...
});

storage.setApp('firefox', appData);
```

**WICHTIG:** Nach `setApp()` muss `save()` aufgerufen werden (oder warten bis Auto-Save).

---

### getAllApps()

Gibt alle gespeicherten Apps zurück.

**Signature:**
```javascript
storage.getAllApps()
```

**Returns:** `Object`

```javascript
{
    "firefox": { wm_class, instances, ... },
    "code": { wm_class, instances, ... },
    ...
}
```

**Beispiel:**
```javascript
const apps = storage.getAllApps();
for (const wmClass in apps) {
    const appData = apps[wmClass];
    log(`${wmClass}: ${appData.instances.length} instances`);
}
```

---

### updateMonitorLayout(monitorManager)

Aktualisiert Monitor-Layout-Informationen.

**Signature:**
```javascript
storage.updateMonitorLayout(monitorManager)
```

**Parameters:**
- `monitorManager` (MonitorManager) - Monitor manager instance

**Returns:** `void`

**Beispiel:**
```javascript
storage.updateMonitorLayout(this._monitorManager);
```

**Verhalten:**
- Fragt alle Monitore ab via `monitorManager.getAllMonitors()`
- Updated `this._data.monitor_layout`
- Nächstes `save()` schreibt Layout zu Disk

---

### backupPositions()

Erstellt timestamped Backup von positions.json.

**Signature:**
```javascript
storage.backupPositions()
```

**Returns:** `void`

**Beispiel:**
```javascript
// Vor Shutdown
storage.backupPositions();
```

**Backup-File Format:**
```
positions_backup_2026-01-20T12-30-45-123Z.json
```

**Location:**
```
~/.config/remember@thechief/positions_backup_*.json
```

---

### setAutoSaveCallback(callback)

Setzt Callback der vor jedem Auto-Save aufgerufen wird.

**Signature:**
```javascript
storage.setAutoSaveCallback(callback)
```

**Parameters:**
- `callback` (function) - Callback function

**Callback Signature:**
```javascript
() => boolean | void
```

**Returns (callback):** `boolean | void`
- `true` oder `undefined` oder `void`: Save proceeds
- `false`: Save skipped

**Beispiel:**
```javascript
storage.setAutoSaveCallback(() => {
    if (this._isRestoringSession || this._isShuttingDown) {
        return false; // Skip save
    }

    // Cleanup orphaned instances
    this._instanceCleanup.cleanupOrphanedInstances();

    // Save dirty windows
    this._saveAllOpenWindows();

    // Return true or undefined to proceed
    return true;
});
```

**Verwendung:**
- WindowTracker registriert Callback für Cleanup + Dirty-Window-Save

---

### stopAutoSave()

Stoppt Auto-Save und setzt Shutdown-Flag.

**Signature:**
```javascript
storage.stopAutoSave()
```

**Returns:** `void`

**Beispiel:**
```javascript
// In extension.disable()
storage.stopAutoSave();
```

**Verhalten:**
- Setzt `_isShuttingDown = true`
- Stoppt Auto-Save Timer
- Cancelt pending Save-Timeouts

---

### blockSaves()

Blockiert alle Saves bis `unblockSaves()` aufgerufen wird.

**Signature:**
```javascript
storage.blockSaves()
```

**Returns:** `void`

**Beispiel:**
```javascript
// Block saves during session restore
storage.blockSaves();

// ... restore session ...

// Unblock after restore complete
storage.unblockSaves();
```

**WICHTIG:** Aktuell nicht implementiert in public API. Wird intern via `_isShuttingDown` flag gehandelt.

---

### destroy()

Cleanup beim Extension-Disable.

**Signature:**
```javascript
storage.destroy()
```

**Returns:** `void`

**Beispiel:**
```javascript
if (this._storage) {
    this._storage.destroy();
    this._storage = null;
}
```

---

## Logger API

**File:** `services/logger.js`

### Module-Level Functions

#### log(message)

Debug-Logging (nur wenn `REMEMBER_DEBUG=1`).

**Signature:**
```javascript
log(message)
```

**Parameters:**
- `message` (string) - Log message

**Returns:** `void`

**Beispiel:**
```javascript
const { log } = Modules.getLogger(meta);
log('Extension enabled');
// Only logs if REMEMBER_DEBUG=1
```

---

#### logError(message, error)

Error-Logging (immer geloggt, unabhängig von Debug-Mode).

**Signature:**
```javascript
logError(message, error)
```

**Parameters:**
- `message` (string) - Error message
- `error` (Error) - Optional error object

**Returns:** `void`

**Beispiel:**
```javascript
const { logError } = Modules.getLogger(meta);

try {
    // ... code ...
} catch (e) {
    logError('Failed to load plugin', e);
    // Logs error + stack trace
}
```

---

#### isDebugMode()

Prüft ob Debug-Mode aktiviert ist.

**Signature:**
```javascript
isDebugMode()
```

**Returns:** `boolean`

**Beispiel:**
```javascript
const { isDebugMode } = Modules.getLogger(meta);

if (isDebugMode()) {
    // Expensive debug logging
    log(`Window state: ${JSON.stringify(windowState)}`);
}
```

---

### Logger Class

#### Constructor

```javascript
new Logger()
```

**Beispiel:**
```javascript
const logger = new Logger();
```

---

#### log(message)

Standard debug logging (nur in Debug-Mode).

**Signature:**
```javascript
logger.log(message)
```

**Parameters:**
- `message` (string) - Log message

**Returns:** `void`

**Beispiel:**
```javascript
logger.log('Window tracking enabled');
```

---

#### logSensitive(message, sensitiveData)

Logging mit Sanitization von sensiblen Daten.

**Signature:**
```javascript
logger.logSensitive(message, sensitiveData)
```

**Parameters:**
- `message` (string) - Base message
- `sensitiveData` (Object) - Object mit sensiblen Feldern

**Sensitive Fields:**
```javascript
{
    cmdline: string[],      // Command line args
    title: string,          // Window title
    path: string,           // File path
    workingDir: string      // Working directory
}
```

**Returns:** `void`

**Beispiel:**
```javascript
logger.logSensitive('Now tracking window', {
    title: '/home/user/private-document.pdf',
    cmdline: ['/usr/bin/firefox', '/home/user/secret.html'],
    workingDir: '/home/user/private'
});
```

**Debug-Mode Output:**
```
remember@thechief: Now tracking window title="/home/user/private-document.pdf" cmdline=[/usr/bin/firefox /home/user/secret.html] workingDir="/home/user/private"
```

**Production Output:**
```
(nothing - logSensitive skips entirely in production)
```

---

#### logDebug(message, data)

Debug-only logging mit optional data.

**Signature:**
```javascript
logger.logDebug(message, data)
```

**Parameters:**
- `message` (string) - Debug message
- `data` (any) - Optional data (wird JSON-serialisiert)

**Returns:** `void`

**Beispiel:**
```javascript
logger.logDebug('Restore timing', { delay: 500, attempt: 2 });
// Output: remember@thechief: [DEBUG] Restore timing: {"delay":500,"attempt":2}
```

---

#### error(message, error)

Error logging (immer geloggt).

**Signature:**
```javascript
logger.error(message, error)
```

**Parameters:**
- `message` (string) - Error message
- `error` (Error) - Optional error object

**Returns:** `void`

**Beispiel:**
```javascript
logger.error('Failed to spawn process', e);
```

---

#### sanitizeCmdline(cmdlineArray)

Sanitiert Command-Line für Production-Logs.

**Signature:**
```javascript
logger.sanitizeCmdline(cmdlineArray)
```

**Parameters:**
- `cmdlineArray` (string[]) - Command line arguments

**Returns:** `string`

**Beispiel:**
```javascript
const cmdline = ['/usr/bin/firefox', '--profile', '/home/user/.mozilla/firefox/abc123.default', '/home/user/secret.html'];
const sanitized = logger.sanitizeCmdline(cmdline);
// Returns: "[firefox] <3 args redacted>"
```

---

#### sanitizeTitle(title)

Sanitiert Window-Title für Production-Logs.

**Signature:**
```javascript
logger.sanitizeTitle(title)
```

**Parameters:**
- `title` (string) - Window title

**Returns:** `string`

**Beispiel:**
```javascript
const title = "Private Document.pdf - LibreOffice Writer";
const sanitized = logger.sanitizeTitle(title);
// Returns: "[TITLE:a1b2c3d4]"
```

---

#### sanitizePath(path)

Sanitiert File-Path für Production-Logs.

**Signature:**
```javascript
logger.sanitizePath(path)
```

**Parameters:**
- `path` (string) - File path

**Returns:** `string`

**Beispiel:**
```javascript
const path = "/home/user/Documents/private/secret.txt";
const sanitized = logger.sanitizePath(path);
// Returns: ".../secret.txt"
```

---

## Extension Entry Points

**File:** `extension.js`

### init(meta)

Extension-Initialisierung (einmal beim Laden).

**Signature:**
```javascript
function init(meta)
```

**Parameters:**
- `meta` (Object) - Extension metadata

```javascript
{
    uuid: string,
    path: string,
    version: string,
    ...
}
```

**Returns:** `void`

**Wird aufgerufen:**
- Beim Cinnamon-Start
- Beim Enable der Extension im Extension-Manager

**Beispiel:**
```javascript
function init(meta) {
    extension = new WindowRememberExtension();
    extension.init(meta);
}
```

**Aufgaben:**
- Metadata speichern
- AppletManager initialisieren
- Applet installieren falls nötig

**WICHTIG:** Keine aktive Logik in `init()`, nur Setup!

---

### enable()

Extension aktivieren.

**Signature:**
```javascript
function enable()
```

**Returns:** `void`

**Wird aufgerufen:**
- Nach `init()`
- Bei manueller Aktivierung
- Nach Cinnamon-Restart (`Alt+F2 r`)

**Beispiel:**
```javascript
function enable() {
    if (extension) {
        extension.enable();
    }
}
```

**Aufgaben:**
- Logger laden
- Services initialisieren
- Plugins laden
- Window tracking starten
- Auto-restore planen
- Globale API exposen

**Siehe:** [Extension Lifecycle](architecture.md#extension-lifecycle)

---

### disable()

Extension deaktivieren.

**Signature:**
```javascript
function disable()
```

**Returns:** `void`

**Wird aufgerufen:**
- Bei Logout
- Bei Shutdown
- Bei manueller Deaktivierung
- Vor Cinnamon-Restart

**Beispiel:**
```javascript
function disable() {
    if (extension) {
        extension.disable();
    }
}
```

**Aufgaben:**
- Shutdown-Flag setzen
- Backup erstellen
- Auto-Save stoppen
- Signals disconnecten
- Komponenten cleanup
- Globale API entfernen

**WICHTIG:** Kein finales Save in `disable()` - würde Partial State während Shutdown speichern!

**Siehe:** [Extension Lifecycle](architecture.md#extension-lifecycle)

---

## Services APIs

### Preferences

**File:** `services/preferences.js`

Verwaltet UI-Präferenzen aus `preferences.json`.

**Constructor:**
```javascript
new Preferences()
```

**Methods:**

#### init()
```javascript
preferences.init()
```
Lädt preferences.json.

#### shouldTrackAllWorkspaces()
```javascript
preferences.shouldTrackAllWorkspaces()
```
**Returns:** `boolean` - Track windows auf allen Workspaces?

#### shouldRememberSticky()
```javascript
preferences.shouldRememberSticky()
```
**Returns:** `boolean` - Sticky-State speichern?

#### shouldRememberShaded()
```javascript
preferences.shouldRememberShaded()
```
**Returns:** `boolean` - Shaded-State speichern?

#### shouldRememberAlwaysOnTop()
```javascript
preferences.shouldRememberAlwaysOnTop()
```
**Returns:** `boolean` - Always-On-Top-State speichern?

#### shouldRememberFullscreen()
```javascript
preferences.shouldRememberFullscreen()
```
**Returns:** `boolean` - Fullscreen-State speichern?

#### getMinimumWindowSize()
```javascript
preferences.getMinimumWindowSize()
```
**Returns:** `{width: number, height: number}` - Minimale Window-Größe zum Tracken

**Beispiel:**
```javascript
const preferences = new Preferences();
preferences.init();

if (preferences.shouldTrackAllWorkspaces()) {
    // Track on all workspaces
}

if (preferences.shouldRememberSticky()) {
    instance.sticky = metaWindow.is_on_all_workspaces();
}

const minSize = preferences.getMinimumWindowSize();
if (width < minSize.width || height < minSize.height) {
    // Skip tracking (too small)
}
```

---

### ExtensionSettings

**File:** `services/extensionSettings.js`

Verwaltet Launch-Flags aus `extension-settings.json`.

**Constructor:**
```javascript
new ExtensionSettings()
```

**Methods:**

#### init()
```javascript
extensionSettings.init()
```
Lädt extension-settings.json.

#### get(key)
```javascript
extensionSettings.get(key)
```
**Parameters:** `key` (string) - Setting key (dot-notation)

**Returns:** `any` - Setting value oder `undefined`

**Beispiel:**
```javascript
const extensionSettings = new ExtensionSettings();
extensionSettings.init();

// Check conditional flag
if (extensionSettings.get('launchFlags.firefoxSessionRestore') !== false) {
    args.push('--restore-session');
}

// Check nested setting
const verboseMode = extensionSettings.get('debug.verbose');
```

#### useBrowserSessionRestore()
```javascript
extensionSettings.useBrowserSessionRestore()
```
**Returns:** `boolean` - Browser session restore aktiviert?

**Beispiel:**
```javascript
if (extensionSettings.useBrowserSessionRestore()) {
    // Use browser's own session restore
}
```

---

### MonitorManager

**File:** `services/monitorManager.js`

Verwaltet Monitor-Erkennung und -Matching.

**Constructor:**
```javascript
new MonitorManager(storage)
```

**Parameters:**
- `storage` (Storage) - Storage service instance

**Methods:**

#### enable()
```javascript
monitorManager.enable()
```
Aktiviert Monitor-Tracking.

#### disable()
```javascript
monitorManager.disable()
```
Deaktiviert Monitor-Tracking.

#### getAllMonitors()
```javascript
monitorManager.getAllMonitors()
```
**Returns:** `Array<Object>` - Liste aller Monitore

```javascript
[
    {
        index: number,
        connector: string,
        edid_hash: string,
        geometry: { x, y, width, height },
        is_primary: boolean
    },
    ...
]
```

#### getMonitorId(monitorIndex)
```javascript
monitorManager.getMonitorId(monitorIndex)
```
**Parameters:** `monitorIndex` (number) - Monitor index

**Returns:** `string` - Monitor ID (EDID-Hash, Connector, oder Index)

**Beispiel:**
```javascript
const monitorManager = new MonitorManager(storage);
monitorManager.enable();

const monitors = monitorManager.getAllMonitors();
monitors.forEach(mon => {
    log(`Monitor ${mon.index}: ${mon.connector} (${mon.edid_hash})`);
});

const monitorId = monitorManager.getMonitorId(0);
// Returns: "edid:abc123def456" or "HDMI-1:1920x1080" or "index:0"
```

---

## Code-Beispiele

### Einfache Extension Integration

```javascript
// Check if extension is available
if (Main.windowRemember && Main.windowRemember.isEnabled()) {
    // Get current stats
    const stats = Main.windowRemember.getStats();
    log(`Tracking ${stats.trackedWindows} windows`);

    // Force save
    Main.windowRemember.saveAll();
}
```

---

### Custom Plugin Handler

```javascript
// File: ~/.config/remember@thechief/plugins/myapp/index.js
var MyAppHandler = class MyAppHandler {
    constructor(config, extensionSettings, storage) {
        this._config = config;
        this._extensionSettings = extensionSettings;
        this._storage = storage;
    }

    beforeLaunch(instance, launchParams) {
        // Check conditional flag
        if (this._extensionSettings.get('launchFlags.myappDebug') !== false) {
            launchParams.args.push('--debug');
        }

        return launchParams;
    }

    parseTitleData(titleSnapshot, instance) {
        // Extract document path from window title
        const match = titleSnapshot.match(/^(.+\.txt)\s*-\s*MyApp$/);
        if (match) {
            return [match[1]]; // Return document path as args
        }
        return null;
    }

    destroy() {
        // Cleanup resources
    }
};
```

---

### Module Loading Pattern

```javascript
// In extension.js, the modules system is already loaded
// This pattern is used internally by the extension

// Example from extension internals:
const { WindowFilter } = Modules.load(this._meta, 'core', 'windowFilter');
const { WindowMatcher } = Modules.load(this._meta, 'core', 'windowMatcher');
const { PositionRestorer } = Modules.load(this._meta, 'core', 'positionRestorer');

// Load service modules
const { Logger } = Modules.load(this._meta, 'services', 'logger');

// Use loaded modules
const logger = new Logger();
const windowFilter = new WindowFilter(preferences);
```

---

### Storage Usage Pattern

```javascript
// Initialize storage
const storage = new Storage();
storage._log = log;
storage._logError = logError;
storage.init();

// Get app data
let appData = storage.getApp('firefox');
if (!appData) {
    appData = {
        wm_class: 'firefox',
        desktop_file: 'firefox.desktop',
        instances: []
    };
}

// Add instance
appData.instances.push({
    id: 'firefox-123456-0',
    title_snapshot: 'Mozilla Firefox',
    workspace: 0,
    monitor_index: 0,
    geometry_percent: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
    ...
});

// Save
storage.setApp('firefox', appData);
storage.save();
```

---

### Plugin Manager Usage

```javascript
// Initialize plugin manager
const pluginManager = new PluginManager(
    extensionPath,
    extensionSettings,
    storage,
    log,
    logError
);

pluginManager.loadPlugins();

// Check plugin
if (pluginManager.hasPlugin('firefox')) {
    const plugin = pluginManager.getPlugin('firefox');
    const handler = pluginManager.getHandler('firefox');

    log(`Plugin: ${plugin.name}`);
    log(`Single-Instance: ${plugin.features.isSingleInstance}`);
    log(`Timeout: ${pluginManager.getTimeout('firefox')}ms`);

    if (handler && handler.beforeLaunch) {
        const params = handler.beforeLaunch(instance, launchParams);
    }
}
```

---

## Weitere Dokumentation

- **Architecture:** `architecture.md` - System-Architektur und Design
- **Plugin Development:** `plugin-development.md` - Plugin-Entwicklung Guide
- **Contributing:** `contributing.md` - Code-Style, Testing, PR-Process
