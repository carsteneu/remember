# Remember Extension - API Reference

This file documents all APIs of the Remember Extension for developers who want to interact with or extend the extension.

## Table of Contents

- [Main API](#main-api)
- [Module System](#module-system)
- [Plugin Manager API](#plugin-manager-api)
- [Storage API](#storage-api)
- [Logger API](#logger-api)
- [Extension Entry Points](#extension-entry-points)
- [Services APIs](#services-apis)

---

## Main API

The global API is exposed under `Main.windowRemember` and is accessible from anywhere in the Cinnamon context.

### Availability

```javascript
// Available after extension.enable()
if (Main.windowRemember) {
    // API ready
}
```

### saveAll()

Saves all currently open window positions immediately.

**Signature:**
```javascript
Main.windowRemember.saveAll()
```

**Returns:** `void`

**Example:**
```javascript
// Manually save all positions
Main.windowRemember.saveAll();
// Shows notification: "Saved N window positions"
```

**Usage:**
- Applet "Save All" Button
- User wants to manually save before changes

**Internal Implementation:**
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

Restores all window positions from saved state.

**Signature:**
```javascript
Main.windowRemember.restoreAll()
```

**Returns:** `void`

**Example:**
```javascript
// Manually restore all positions
Main.windowRemember.restoreAll();
// Shows notification: "Restored N window positions"
```

**Usage:**
- Applet "Restore All" Button
- User has manually moved windows and wants to return to saved state

**Behavior:**
- Reset all assignments (marking instances as unassigned)
- Match each running window to saved instance
- Restore position, workspace, maximized, etc.
- `isNewWindow=false` - no minimization before restore

**Internal Implementation:**
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

Launches all saved apps with `autostart=true`.

**Signature:**
```javascript
Main.windowRemember.launchSession()
```

**Returns:** `void`

**Example:**
```javascript
// Manual session launch
Main.windowRemember.launchSession();
// Shows notification: "Launching N applications..."
```

**Usage:**
- Applet "Launch Session" Button
- User wants to manually start their saved session

**Behavior:**
- Filter instances: only `autostart=true`
- Reset assignments
- Launch via SessionLauncher
- Shows progress window

**Internal Implementation:**
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

Activates/Deactivates the extension.

**Signature:**
```javascript
Main.windowRemember.toggle()
```

**Returns:** `boolean` - New state (true=enabled, false=disabled)

**Example:**
```javascript
// Toggle Extension
const newState = Main.windowRemember.toggle();
if (newState) {
    log("Extension enabled");
} else {
    log("Extension disabled");
}
```

**Usage:**
- Debugging
- Quick enable/disable without Extension Manager

**Behavior:**
- If enabled: calls `disable()`
- If disabled: calls `enable()`

**WARNING:** Should not be used in production. Only for testing.

---

### getStats()

Returns statistics about tracked windows, saved apps/instances, etc.

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

**Example:**
```javascript
const stats = Main.windowRemember.getStats();
log(`Tracking ${stats.trackedWindows} windows`);
log(`Saved ${stats.savedInstances} instances from ${stats.savedApps} apps`);
log(`${stats.monitors} monitors detected`);
```

**Usage:**
- Settings Dialog: Overview Tab (Dashboard)
- Applet: Tooltip
- Debugging

---

### isEnabled()

Checks if extension is enabled.

**Signature:**
```javascript
Main.windowRemember.isEnabled()
```

**Returns:** `boolean`

**Example:**
```javascript
if (Main.windowRemember.isEnabled()) {
    // Extension is active
}
```

---

### getMonitors()

Returns list of all detected monitors.

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

**Example:**
```javascript
const monitors = Main.windowRemember.getMonitors();
monitors.forEach(mon => {
    log(`Monitor ${mon.index}: ${mon.connector} (${mon.geometry.width}x${mon.geometry.height})`);
});
```

---

### closeWindow(x11WindowId)

Closes a window via X11 Window ID.

**Signature:**
```javascript
Main.windowRemember.closeWindow(x11WindowId)
```

**Parameters:**
- `x11WindowId` (string) - X11 Window ID (e.g., "0x3a00012")

**Returns:** `boolean` - true if successfully closed

**Example:**
```javascript
// Close window from Settings Dialog
const success = Main.windowRemember.closeWindow("0x3a00012");
if (success) {
    log("Window closed");
} else {
    log("Window not found or already closed");
}
```

**Usage:**
- Settings Dialog: Windows Tab (Delete button)

**Behavior:**
- Finds window via X11 ID
- Calls `metaWindow.delete()`
- Logs wmClass and title

---

## Module System

The module system solves the GJS caching problem when loading modules from subdirectories.

### Modules.load()

Loads a module from a subdirectory of the extension.

**File:** `modules.js`

**Signature:**
```javascript
Modules.load(extensionMeta, subdir, moduleName)
```

**Parameters:**
- `extensionMeta` (Object) - Extension metadata with `path` property
- `subdir` (string) - Subdirectory name (e.g., "core", "services")
- `moduleName` (string) - Module name without `.js` extension

**Returns:** `Object` - Loaded module exports

**Example:**
```javascript
const modulesModule = getExtensionModule('modules');
const Modules = modulesModule.Modules;

// Load core module
const { WindowFilter } = Modules.load(meta, 'core', 'windowFilter');
const { PositionRestorer } = Modules.load(meta, 'core', 'positionRestorer');

// Load service module
const { Logger } = Modules.load(meta, 'services', 'logger');
```

**Internal Implementation:**
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

Clears the module cache (for development/debugging).

**Signature:**
```javascript
Modules.clearCache()
```

**Returns:** `void`

**Example:**
```javascript
// Clear module cache
Modules.clearCache();
// Next load will reload from disk
```

**Usage:**
- Development: After code changes
- Should NOT be used in production

---

### Modules.isCached()

Checks if a module is already cached.

**Signature:**
```javascript
Modules.isCached(subdir, moduleName)
```

**Parameters:**
- `subdir` (string) - Subdirectory name
- `moduleName` (string) - Module name

**Returns:** `boolean`

**Example:**
```javascript
if (Modules.isCached('core', 'windowFilter')) {
    log("WindowFilter already loaded");
}
```

---

### Modules.getLogger()

Loads logger module and returns logger functions.

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

**Example:**
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

**Example:**
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

Loads all plugins from built-in and user directories.

**Signature:**
```javascript
pluginManager.loadPlugins()
```

**Returns:** `void`

**Example:**
```javascript
pluginManager.loadPlugins();
log(`PluginManager loaded ${pluginManager.getLoadedPlugins().length} plugins`);
```

**Behavior:**
- Scans `<extensionPath>/plugins/`
- Scans `~/.config/remember@thechief/plugins/`
- User plugins override built-in plugins (same name)
- Loads `config.json` (required)
- Loads handler class from `index.js` (optional)

---

### getPlugin(wmClass)

Returns plugin config for a wmClass.

**Signature:**
```javascript
pluginManager.getPlugin(wmClass)
```

**Parameters:**
- `wmClass` (string) - Window manager class

**Returns:** `Object | null` - Plugin config or null

**Example:**
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

Returns handler instance for a wmClass.

**Signature:**
```javascript
pluginManager.getHandler(wmClass)
```

**Parameters:**
- `wmClass` (string) - Window manager class

**Returns:** `Object | null` - Handler instance or null

**Example:**
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

Checks if plugin exists for wmClass.

**Signature:**
```javascript
pluginManager.hasPlugin(wmClass)
```

**Parameters:**
- `wmClass` (string) - Window manager class

**Returns:** `boolean`

**Example:**
```javascript
if (pluginManager.hasPlugin('firefox')) {
    // Use plugin-based launch
} else {
    // Use generic launch
}
```

---

### isSingleInstance(wmClass)

Checks if app is single-instance (via plugin config).

**Signature:**
```javascript
pluginManager.isSingleInstance(wmClass)
```

**Parameters:**
- `wmClass` (string) - Window manager class

**Returns:** `boolean`

**Example:**
```javascript
if (pluginManager.isSingleInstance('firefox')) {
    log("Firefox is single-instance");
}
```

---

### getTimeout(wmClass)

Returns timeout for app (from plugin config or default).

**Signature:**
```javascript
pluginManager.getTimeout(wmClass)
```

**Parameters:**
- `wmClass` (string) - Window manager class

**Returns:** `number` - Timeout in milliseconds

**Example:**
```javascript
const timeout = pluginManager.getTimeout('firefox');
// Returns: 120000 (2 min for single-instance)
```

---

### getGracePeriod(wmClass)

Returns grace period for app.

**Signature:**
```javascript
pluginManager.getGracePeriod(wmClass)
```

**Parameters:**
- `wmClass` (string) - Window manager class

**Returns:** `number` - Grace period in milliseconds

**Example:**
```javascript
const gracePeriod = pluginManager.getGracePeriod('firefox');
// Returns: 60000 (1 min for single-instance)
```

---

### getLoadedPlugins()

Returns list of all loaded plugin names.

**Signature:**
```javascript
pluginManager.getLoadedPlugins()
```

**Returns:** `string[]`

**Example:**
```javascript
const plugins = pluginManager.getLoadedPlugins();
log(`Loaded plugins: ${plugins.join(', ')}`);
// Output: "firefox, chrome, vscode, thunderbird, ..."
```

---

### getAllPlugins()

Returns all plugins with configs and handlers (deduplicated).

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

**Example:**
```javascript
const plugins = pluginManager.getAllPlugins();
plugins.forEach(p => {
    log(`Plugin: ${p.name}, Has Handler: ${p.handler !== null}`);
});
```

---

### getStats()

Returns statistics about loaded plugins.

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

**Example:**
```javascript
const stats = pluginManager.getStats();
log(`${stats.names.length} plugins loaded (${stats.handlers} handlers)`);
```

---

### reload()

Reloads all plugins (for development).

**Signature:**
```javascript
pluginManager.reload()
```

**Returns:** `void`

**Example:**
```javascript
// After changing plugin config
pluginManager.reload();
```

**WARNING:** Should not be used in production.

---

### destroy()

Cleanup on extension disable.

**Signature:**
```javascript
pluginManager.destroy()
```

**Returns:** `void`

**Example:**
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

**Example:**
```javascript
const storage = new Storage();
storage.init();
```

---

### init()

Initializes storage, loads data, starts auto-save.

**Signature:**
```javascript
storage.init()
```

**Returns:** `void`

**Example:**
```javascript
const storage = new Storage();
storage._log = log;
storage._logError = logError;
storage.init();
```

**Behavior:**
- Creates config directory if not present
- Hardens permissions (0700 directory, 0600 files)
- Loads `positions.json`
- Migrates old data versions
- Starts auto-save timer (30 sec)

---

### save()

Saves data synchronously to disk.

**Signature:**
```javascript
storage.save()
```

**Returns:** `void`

**Example:**
```javascript
storage.save();
```

**Behavior:**
- Serializes data to JSON
- Writes to `positions.json`
- Atomic write (via `replace_contents`)
- Hardens permissions after write

**IMPORTANT:** Called automatically every 30 seconds. Manual `save()` usually not needed.

---

### load()

Loads data from disk (called by `init()`).

**Signature:**
```javascript
storage.load()
```

**Returns:** `void`

**Example:**
```javascript
storage.load();
```

---

### getApp(wmClass)

Returns app data for wmClass.

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

**Example:**
```javascript
const appData = storage.getApp('firefox');
if (appData) {
    log(`Firefox has ${appData.instances.length} instances`);
}
```

---

### setApp(wmClass, appData)

Sets/Updates app data.

**Signature:**
```javascript
storage.setApp(wmClass, appData)
```

**Parameters:**
- `wmClass` (string) - Window manager class
- `appData` (Object) - App data object

**Returns:** `void`

**Example:**
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

**IMPORTANT:** After `setApp()` must call `save()` (or wait for auto-save).

---

### getAllApps()

Returns all saved apps.

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

**Example:**
```javascript
const apps = storage.getAllApps();
for (const wmClass in apps) {
    const appData = apps[wmClass];
    log(`${wmClass}: ${appData.instances.length} instances`);
}
```

---

### updateMonitorLayout(monitorManager)

Updates monitor layout information.

**Signature:**
```javascript
storage.updateMonitorLayout(monitorManager)
```

**Parameters:**
- `monitorManager` (MonitorManager) - Monitor manager instance

**Returns:** `void`

**Example:**
```javascript
storage.updateMonitorLayout(this._monitorManager);
```

**Behavior:**
- Queries all monitors via `monitorManager.getAllMonitors()`
- Updates `this._data.monitor_layout`
- Next `save()` writes layout to disk

---

### backupPositions()

Creates timestamped backup of positions.json.

**Signature:**
```javascript
storage.backupPositions()
```

**Returns:** `void`

**Example:**
```javascript
// Before shutdown
storage.backupPositions();
```

**Backup File Format:**
```
positions_backup_2026-01-20T12-30-45-123Z.json
```

**Location:**
```
~/.config/remember@thechief/positions_backup_*.json
```

---

### setAutoSaveCallback(callback)

Sets callback that is called before each auto-save.

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
- `true` or `undefined` or `void`: Save proceeds
- `false`: Save skipped

**Example:**
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

**Usage:**
- WindowTracker registers callback for cleanup + dirty-window-save

---

### stopAutoSave()

Stops auto-save and sets shutdown flag.

**Signature:**
```javascript
storage.stopAutoSave()
```

**Returns:** `void`

**Example:**
```javascript
// In extension.disable()
storage.stopAutoSave();
```

**Behavior:**
- Sets `_isShuttingDown = true`
- Stops auto-save timer
- Cancels pending save timeouts

---

### blockSaves()

Blocks all saves until `unblockSaves()` is called.

**Signature:**
```javascript
storage.blockSaves()
```

**Returns:** `void`

**Example:**
```javascript
// Block saves during session restore
storage.blockSaves();

// ... restore session ...

// Unblock after restore complete
storage.unblockSaves();
```

**IMPORTANT:** Currently not implemented in public API. Handled internally via `_isShuttingDown` flag.

---

### destroy()

Cleanup on extension disable.

**Signature:**
```javascript
storage.destroy()
```

**Returns:** `void`

**Example:**
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

Debug logging (only when `REMEMBER_DEBUG=1`).

**Signature:**
```javascript
log(message)
```

**Parameters:**
- `message` (string) - Log message

**Returns:** `void`

**Example:**
```javascript
const { log } = Modules.getLogger(meta);
log('Extension enabled');
// Only logs if REMEMBER_DEBUG=1
```

---

#### logError(message, error)

Error logging (always logged, regardless of debug mode).

**Signature:**
```javascript
logError(message, error)
```

**Parameters:**
- `message` (string) - Error message
- `error` (Error) - Optional error object

**Returns:** `void`

**Example:**
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

Checks if debug mode is enabled.

**Signature:**
```javascript
isDebugMode()
```

**Returns:** `boolean`

**Example:**
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

**Example:**
```javascript
const logger = new Logger();
```

---

#### log(message)

Standard debug logging (only in debug mode).

**Signature:**
```javascript
logger.log(message)
```

**Parameters:**
- `message` (string) - Log message

**Returns:** `void`

**Example:**
```javascript
logger.log('Window tracking enabled');
```

---

#### logSensitive(message, sensitiveData)

Logging with sanitization of sensitive data.

**Signature:**
```javascript
logger.logSensitive(message, sensitiveData)
```

**Parameters:**
- `message` (string) - Base message
- `sensitiveData` (Object) - Object with sensitive fields

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

**Example:**
```javascript
logger.logSensitive('Now tracking window', {
    title: '/home/user/private-document.pdf',
    cmdline: ['/usr/bin/firefox', '/home/user/secret.html'],
    workingDir: '/home/user/private'
});
```

**Debug Mode Output:**
```
remember@thechief: Now tracking window title="/home/user/private-document.pdf" cmdline=[/usr/bin/firefox /home/user/secret.html] workingDir="/home/user/private"
```

**Production Output:**
```
(nothing - logSensitive skips entirely in production)
```

---

#### logDebug(message, data)

Debug-only logging with optional data.

**Signature:**
```javascript
logger.logDebug(message, data)
```

**Parameters:**
- `message` (string) - Debug message
- `data` (any) - Optional data (will be JSON-serialized)

**Returns:** `void`

**Example:**
```javascript
logger.logDebug('Restore timing', { delay: 500, attempt: 2 });
// Output: remember@thechief: [DEBUG] Restore timing: {"delay":500,"attempt":2}
```

---

#### error(message, error)

Error logging (always logged).

**Signature:**
```javascript
logger.error(message, error)
```

**Parameters:**
- `message` (string) - Error message
- `error` (Error) - Optional error object

**Returns:** `void`

**Example:**
```javascript
logger.error('Failed to spawn process', e);
```

---

#### sanitizeCmdline(cmdlineArray)

Sanitizes command line for production logs.

**Signature:**
```javascript
logger.sanitizeCmdline(cmdlineArray)
```

**Parameters:**
- `cmdlineArray` (string[]) - Command line arguments

**Returns:** `string`

**Example:**
```javascript
const cmdline = ['/usr/bin/firefox', '--profile', '/home/user/.mozilla/firefox/abc123.default', '/home/user/secret.html'];
const sanitized = logger.sanitizeCmdline(cmdline);
// Returns: "[firefox] <3 args redacted>"
```

---

#### sanitizeTitle(title)

Sanitizes window title for production logs.

**Signature:**
```javascript
logger.sanitizeTitle(title)
```

**Parameters:**
- `title` (string) - Window title

**Returns:** `string`

**Example:**
```javascript
const title = "Private Document.pdf - LibreOffice Writer";
const sanitized = logger.sanitizeTitle(title);
// Returns: "[TITLE:a1b2c3d4]"
```

---

#### sanitizePath(path)

Sanitizes file path for production logs.

**Signature:**
```javascript
logger.sanitizePath(path)
```

**Parameters:**
- `path` (string) - File path

**Returns:** `string`

**Example:**
```javascript
const path = "/home/user/Documents/private/secret.txt";
const sanitized = logger.sanitizePath(path);
// Returns: ".../secret.txt"
```

---

## Extension Entry Points

**File:** `extension.js`

### init(meta)

Extension initialization (called once on load).

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

**Called when:**
- At Cinnamon startup
- When enabling the extension in Extension Manager

**Example:**
```javascript
function init(meta) {
    extension = new WindowRememberExtension();
    extension.init(meta);
}
```

**Tasks:**
- Store metadata
- Initialize AppletManager
- Install applet if needed

**IMPORTANT:** No active logic in `init()`, setup only!

---

### enable()

Enable the extension.

**Signature:**
```javascript
function enable()
```

**Returns:** `void`

**Called when:**
- After `init()`
- On manual activation
- After Cinnamon restart (`Alt+F2 r`)

**Example:**
```javascript
function enable() {
    if (extension) {
        extension.enable();
    }
}
```

**Tasks:**
- Load logger
- Initialize services
- Load plugins
- Start window tracking
- Schedule auto-restore
- Expose global API

**See:** [Extension Lifecycle](architecture.md#extension-lifecycle)

---

### disable()

Disable the extension.

**Signature:**
```javascript
function disable()
```

**Returns:** `void`

**Called when:**
- On logout
- On shutdown
- On manual deactivation
- Before Cinnamon restart

**Example:**
```javascript
function disable() {
    if (extension) {
        extension.disable();
    }
}
```

**Tasks:**
- Set shutdown flag
- Create backup
- Stop auto-save
- Disconnect signals
- Cleanup components
- Remove global API

**IMPORTANT:** No final save in `disable()` - would save partial state during shutdown!

**See:** [Extension Lifecycle](architecture.md#extension-lifecycle)

---

## Services APIs

### Preferences

**File:** `services/preferences.js`

Manages UI preferences from `preferences.json`.

**Constructor:**
```javascript
new Preferences()
```

**Methods:**

#### init()
```javascript
preferences.init()
```
Loads preferences.json.

#### shouldTrackAllWorkspaces()
```javascript
preferences.shouldTrackAllWorkspaces()
```
**Returns:** `boolean` - Track windows on all workspaces?

#### shouldRememberSticky()
```javascript
preferences.shouldRememberSticky()
```
**Returns:** `boolean` - Save sticky state?

#### shouldRememberShaded()
```javascript
preferences.shouldRememberShaded()
```
**Returns:** `boolean` - Save shaded state?

#### shouldRememberAlwaysOnTop()
```javascript
preferences.shouldRememberAlwaysOnTop()
```
**Returns:** `boolean` - Save always-on-top state?

#### shouldRememberFullscreen()
```javascript
preferences.shouldRememberFullscreen()
```
**Returns:** `boolean` - Save fullscreen state?

#### getMinimumWindowSize()
```javascript
preferences.getMinimumWindowSize()
```
**Returns:** `{width: number, height: number}` - Minimum window size to track

**Example:**
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

Manages launch flags from `extension-settings.json`.

**Constructor:**
```javascript
new ExtensionSettings()
```

**Methods:**

#### init()
```javascript
extensionSettings.init()
```
Loads extension-settings.json.

#### get(key)
```javascript
extensionSettings.get(key)
```
**Parameters:** `key` (string) - Setting key (dot-notation)

**Returns:** `any` - Setting value or `undefined`

**Example:**
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
**Returns:** `boolean` - Browser session restore enabled?

**Example:**
```javascript
if (extensionSettings.useBrowserSessionRestore()) {
    // Use browser's own session restore
}
```

---

### MonitorManager

**File:** `services/monitorManager.js`

Manages monitor detection and matching.

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
Enables monitor tracking.

#### disable()
```javascript
monitorManager.disable()
```
Disables monitor tracking.

#### getAllMonitors()
```javascript
monitorManager.getAllMonitors()
```
**Returns:** `Array<Object>` - List of all monitors

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

**Returns:** `string` - Monitor ID (EDID hash, connector, or index)

**Example:**
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

## Code Examples

### Simple Extension Integration

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

## Further Documentation

- **Architecture:** `architecture.md` - System architecture and design
- **Plugin Development:** `plugin-development.md` - Plugin development guide
- **Contributing:** `contributing.md` - Code style, testing, PR process
