# Remember Extension - System Architecture

## Overview

Remember is a Cinnamon Desktop Extension that saves window positions and restores them across sessions. The system uses a modular architecture with clear separation of responsibilities.

**Core Features:**
- Automatic tracking of window positions in real-time
- Session restore on login with intelligent app launching
- Multi-monitor support with EDID-based identification
- Plugin system for app-specific behavior
- Smart Window Matching using multiple strategies

**Technology:**
- Language: JavaScript (GJS/CJS - Cinnamon JavaScript)
- Platform: Cinnamon Desktop 6.0+
- Settings UI: Python 3 + GTK 3
- Storage: JSON files in `~/.config/remember@thechief/`

## Design Principles

### 1. Modularity
Each module has a clearly defined responsibility. Core modules are organized in `core/`, services in `services/`, plugins in `plugins/`.

### 2. Robustness
- Dirty-flag system prevents unnecessary I/O operations
- Shutdown detection prevents data loss on logout
- Backup mechanism before shutdown
- Grace periods for slow apps

### 3. Extensibility
The plugin system allows app-specific customizations without changing core code.

### 4. Performance
- Only changed windows are saved (dirty-flag system)
- Auto-save every 30 seconds instead of on every change
- Modules are lazy loaded

## Extension Lifecycle

### 1. Initialization (`init(meta)`)

**Called once when the extension is loaded.**

```javascript
function init(meta) {
    extension = new WindowRememberExtension();
    extension.init(meta);
}
```

**Tasks:**
- Save extension metadata (`meta.path`)
- Install companion applet if needed
- No active logic, only setup

**Modules loaded:**
- `modules.js` - For dynamic loading of core modules
- `core/appletManager.js` - For applet installation

### 2. Activation (`enable()`)

**Called at Cinnamon startup or manual activation.**

```javascript
function enable() {
    if (extension) {
        extension.enable();
    }
}
```

**Tasks:**

1. **Initialize logger** (first!)
   ```javascript
   const loggerModule = getExtensionModule('services/logger');
   log = loggerModule.log;
   logError = loggerModule.logError;
   this._logger = new loggerModule.Logger();
   ```

2. **Reset shutdown flag**
   ```javascript
   this._isShuttingDown = false;
   ```

3. **Load modules** (in this order!)
   ```javascript
   // Services
   const { Storage } = getExtensionModule('services/storage');
   const { MonitorManager } = getExtensionModule('services/monitorManager');
   const { ExtensionSettings } = getExtensionModule('services/extensionSettings');
   const { Preferences } = getExtensionModule('services/preferences');

   // Core Logic
   const { WindowTracker } = getExtensionModule('windowTracker');
   const { SessionLauncher } = getExtensionModule('sessionLauncher');
   const { PluginManager } = getExtensionModule('pluginManager');

   // Core Modules via modules.js
   const Modules = getExtensionModule('modules').Modules;
   const { AutoRestore } = Modules.load(this._meta, 'core', 'autoRestore');
   ```

4. **Load config**
   ```javascript
   const configModule = getExtensionModule('config');
   this._sessionConfig = configModule.SESSION_LAUNCH_CONFIG;
   this._singleInstanceConfig = {
       apps: configModule.SINGLE_INSTANCE_APPS,
       timeout: configModule.SINGLE_INSTANCE_TIMEOUT,
       gracePeriod: configModule.SINGLE_INSTANCE_GRACE_PERIOD
   };
   ```

5. **Initialize services**
   ```javascript
   this._storage.init();
   this._preferences.init();
   this._extensionSettings.init();
   ```

6. **Block saves until restore is complete**
   ```javascript
   this._storage.blockSaves();
   ```

7. **Load plugin manager**
   ```javascript
   this._pluginManager.loadPlugins();
   ```

8. **Activate monitor manager**
   ```javascript
   this._monitorManager.enable();
   ```

9. **Initialize window tracker**
   ```javascript
   this._tracker = new WindowTracker(...);
   this._tracker._isRestoringSession = true; // Prevents saves during restore
   this._tracker.enable(); // Starts tracking
   ```

10. **Initialize session launcher**
    ```javascript
    this._launcher = new SessionLauncher(...);
    this._tracker.setSessionLauncher(this._launcher);
    this._tracker.setPluginManager(this._pluginManager);
    ```

11. **Initialize AutoRestore**
    ```javascript
    this._autoRestore = new AutoRestore({...});
    ```

12. **Expose global API**
    ```javascript
    Main.windowRemember = {
        saveAll: () => this._saveAll(),
        restoreAll: () => this._restoreAll(),
        launchSession: () => this._launchSession(),
        toggle: () => this._toggle(),
        getStats: () => this._getStats(),
        isEnabled: () => this._enabled,
        getMonitors: () => this._monitorManager.getAllMonitors(),
        closeWindow: (x11WindowId) => this._closeWindow(x11WindowId)
    };
    ```

13. **Schedule auto-restore**
    ```javascript
    this._autoRestore.scheduleAutoRestore();
    ```

### 3. Deactivation (`disable()`)

**Called on logout, shutdown or manual deactivation.**

```javascript
function disable() {
    if (extension) {
        extension.disable();
    }
}
```

**Critical order of tasks:**

1. **IMMEDIATELY set shutdown flag** (prevents further saves!)
   ```javascript
   this._isShuttingDown = true;
   if (this._tracker) {
       this._tracker._isShuttingDown = true;
   }
   ```

2. **Create backup** (before cleanup!)
   ```javascript
   if (this._storage) {
       this._storage.backupPositions();
   }
   ```

3. **Stop auto-save**
   ```javascript
   if (this._storage) {
       this._storage.stopAutoSave();
   }
   ```

4. **AutoRestore cleanup**
   ```javascript
   if (this._autoRestore) {
       this._autoRestore.destroy();
   }
   ```

5. **Remove applet**
   ```javascript
   if (this._appletManager) {
       this._appletManager.deactivate();
   }
   ```

6. **Remove global API**
   ```javascript
   if (Main.windowRemember) {
       delete Main.windowRemember;
   }
   ```

7. **Deactivate tracker** (disconnect signals!)
   ```javascript
   if (this._tracker) {
       this._tracker.disable();
   }
   ```

8. **Component cleanup** (in reverse order!)
   ```javascript
   if (this._launcher) this._launcher.destroy();
   if (this._monitorManager) this._monitorManager.disable();
   if (this._storage) this._storage.destroy();
   if (this._preferences) this._preferences.destroy();
   if (this._extensionSettings) this._extensionSettings.destroy();
   if (this._pluginManager) this._pluginManager.destroy();
   ```

**IMPORTANT:** No final save in `disable()`! This would save the partial state during shutdown.

## Module System and GJS Caching

### Problem: GJS Module Caching

GJS (GNOME JavaScript) caches modules globally by their name. This means:
- All `index.js` files would share the same cache entry
- Modules from subdirectories cannot be loaded normally

### Solution: modules.js

**File:** `modules.js`

```javascript
var Modules = {
    load: function(extensionMeta, subdir, moduleName) {
        const cacheKey = `_${subdir}_${moduleName}`;

        if (moduleCache[cacheKey]) {
            return moduleCache[cacheKey];
        }

        const subdirPath = `${extensionMeta.path}/${subdir}`;
        imports.searchPath.unshift(subdirPath);

        try {
            const loadedModule = imports[moduleName];
            moduleCache[cacheKey] = loadedModule;
            return loadedModule;
        } finally {
            // Restore search path
            imports.searchPath.shift();
        }
    }
};
```

**Usage:**

```javascript
// Load core module
const modulesModule = getExtensionModule('modules');
const Modules = modulesModule.Modules;

const { WindowFilter } = Modules.load(meta, 'core', 'windowFilter');
const { PositionRestorer } = Modules.load(meta, 'core', 'positionRestorer');
```

**Loading plugin handlers:**

Plugins use a special technique to avoid cache conflicts:

```javascript
// Parent directory to search path
const parentDir = GLib.path_get_dirname(pluginPath);
imports.searchPath.unshift(parentDir);

// Import as: imports.<pluginName>.<moduleName>
// e.g. imports.thunderbird.index
const module = imports[pluginName][moduleName];
```

This gives each plugin a unique namespace.

## Core Components

### WindowTracker

**File:** `windowTracker.js`

**Responsibility:** Monitors window events and saves position changes.

**Main features:**

1. **Dirty-flag system**
   ```javascript
   _dirtyWindows = new Set(); // Windows with unsaved changes

   _onWindowChanged(metaWindow) {
       if (this._isRestoringSession || this._isShuttingDown) {
           return; // No saves during restore/shutdown
       }
       this._dirtyWindows.add(metaWindow); // Just mark
   }

   _saveAllOpenWindows() {
       // Only save dirty windows
       for (const metaWindow of this._dirtyWindows) {
           this._saveWindowStateInternal(metaWindow);
       }
       this._dirtyWindows.clear();
   }
   ```

2. **Window signals**
   ```javascript
   // Position/Size
   metaWindow.connect('position-changed', () => this._onWindowChanged(metaWindow));
   metaWindow.connect('size-changed', () => this._onWindowChanged(metaWindow));

   // Workspace
   metaWindow.connect('workspace-changed', () => this._onWindowChanged(metaWindow));

   // Title (for document apps)
   metaWindow.connect('notify::title', () => this._onTitleChanged(metaWindow));

   // WM_CLASS Migration (LibreOffice: Soffice → libreoffice-calc)
   metaWindow.connect('notify::wm-class', () => this._wmClassMigration.onWmClassChanged(metaWindow));

   // Always-On-Top
   metaWindow.connect('notify::above', () => this._onWindowChanged(metaWindow));

   // Cleanup
   metaWindow.connect('unmanaging', () => this._untrackWindow(metaWindow));
   ```

3. **Auto-save callback**
   ```javascript
   this._storage.setAutoSaveCallback(() => {
       if (this._isRestoringSession || this._isShuttingDown) {
           return false; // Skip save
       }
       this._instanceCleanup.cleanupOrphanedInstances();
       this._saveAllOpenWindows(); // Saves only dirty windows
       return true;
   });
   ```

**Injected Dependencies:**
- `_log`, `_logError` - Logging functions
- `_logger` - Logger instance for sanitized logging
- `storage` - Storage service
- `monitorManager` - Monitor management
- `preferences` - User preferences
- `sessionLauncher` - Session restore logic
- `pluginManager` - Plugin system

### SessionLauncher

**File:** `sessionLauncher.js`

**Responsibility:** Launches apps during session restore and tracks pending launches.

**Main features:**

1. **Launch queue**
   ```javascript
   _launchQueue = []; // Queue of apps to launch
   _pendingLaunches = new Map(); // instanceId → pending data
   _expectedLaunches = new Map(); // instanceId → expected data (grace period)
   ```

2. **Single-instance handling**
   ```javascript
   launchInstances(instances) {
       for (const [wmClass, data] of instancesByApp.entries()) {
           const isSingleInstance = this._isSingleInstance(wmClass);

           if (isSingleInstance) {
               // Only launch ONCE, but show all instances as in progress
               this._launchQueue.push({
                   wmClass: wmClass,
                   instance: appInstances[0],
                   instanceId: instanceId,
                   coveredInstanceIds: appInstances.map(inst => inst.id)
               });
           } else {
               // Multi-instance: Launch all
               for (const instance of appInstances) {
                   this._launchQueue.push({...});
               }
           }
       }
   }
   ```

3. **Plugin-based launch**
   ```javascript
   _launchWithPlugin(plugin, handler, wmClass, appData, instance, workDir, instanceId) {
       // 1. Resolve executable
       let executable = this._resolveExecutable(plugin.launch.executables);

       // 2. Args from plugin config
       let args = [...(plugin.launch.flags || [])];

       // 3. Conditional flags
       if (plugin.launch.conditionalFlags) {
           for (const [settingKey, flags] of Object.entries(plugin.launch.conditionalFlags)) {
               if (this._extensionSettings.get(settingKey) !== false) {
                   args.push(...flags);
               }
           }
       }

       // 4. Handler beforeLaunch hook
       if (handler && handler.beforeLaunch) {
           launchParams = handler.beforeLaunch(instance, launchParams);
       }

       // 5. Parse title data (for document apps)
       if (handler && handler.parseTitleData) {
           const parsedArgs = handler.parseTitleData(instance.title_snapshot, instance);
           if (parsedArgs) {
               launchParams.args.push(...parsedArgs);
           }
       }

       // 6. Spawn process
       const [success, pid] = this._spawnProcess(workDir, argv, instanceId, ...);

       // 7. Handler afterLaunch hook
       if (handler && handler.afterLaunch) {
           handler.afterLaunch(instance, pid, success);
       }
   }
   ```

4. **Timeout & grace period**
   ```javascript
   _getTimeouts(wmClass, plugin = null) {
       // 1. Plugin-specific
       if (plugin && plugin.features) {
           return {
               timeout: plugin.features.timeout || 45000,
               gracePeriod: plugin.features.gracePeriod || 30000,
               isSingleInstance: plugin.features.isSingleInstance
           };
       }

       // 2. Single-instance apps
       if (this._isSingleInstance(wmClass)) {
           return {
               timeout: 120000,  // 2 min
               gracePeriod: 60000, // 1 min
               isSingleInstance: true
           };
       }

       // 3. Default
       return {
           timeout: 45000,   // 45 sec
           gracePeriod: 30000, // 30 sec
           isSingleInstance: false
       };
   }
   ```

5. **Flatpak detection**
   ```javascript
   _tryFindFlatpakApp(wmClass) {
       // 1. Desktop file lookup
       const desktopAppId = this._findFlatpakFromDesktopFiles(wmClassLower);

       // 2. flatpak list search
       const flatpakListAppId = this._findFlatpakFromList(wmClassLower);

       // 3. Pattern guessing
       const patterns = [
           `org.${wmClassLower}.${wmClass}`,
           `org.gnome.${wmClass}`,
           ...
       ];
   }
   ```

### PluginManager

**File:** `pluginManager.js`

**Responsibility:** Loads and manages app-specific plugins.

**Main features:**

1. **Plugin directories**
   ```javascript
   const pluginDirs = [
       // Built-in
       GLib.build_filenamev([this._extensionPath, 'plugins']),
       // User
       GLib.build_filenamev([GLib.get_home_dir(), '.config', UUID, 'plugins'])
   ];
   ```

2. **Plugin loading**
   ```javascript
   _loadPlugin(dirPath, pluginName) {
       // 1. Load config.json (required)
       const config = JSON.parse(configFile.load_contents());

       // 2. Validation
       if (!config.name || !config.wmClass || !Array.isArray(config.wmClass)) {
           return;
       }

       // 3. Set defaults
       config.launch = config.launch || {};
       config.features = config.features || {};
       config.features.isSingleInstance = config.features.isSingleInstance || false;

       // 4. Register for all wmClasses
       for (const wmClass of config.wmClass) {
           this._plugins.set(wmClass, config);
       }

       // 5. Load handler (optional)
       if (config.handler) {
           this._loadHandler(pluginPath, pluginName, config);
       }
   }
   ```

3. **Handler loading**
   ```javascript
   _loadHandler(pluginPath, pluginName, config) {
       // Unique import path: imports.<pluginName>.<moduleName>
       const parentDir = GLib.path_get_dirname(pluginPath);
       imports.searchPath.unshift(parentDir);

       const moduleName = config.handler.replace(/\.js$/, '');
       const module = imports[pluginName][moduleName];

       // Find handler class (convention: *Handler)
       let HandlerClass = null;
       for (const key in module) {
           if (key.endsWith('Handler')) {
               HandlerClass = module[key];
               break;
           }
       }

       // Instantiate
       const handler = new HandlerClass(config, this._extensionSettings, this._storage);

       // Register for all wmClasses
       for (const wmClass of config.wmClass) {
           this._handlers.set(wmClass, handler);
       }
   }
   ```

4. **API methods**
   ```javascript
   getPlugin(wmClass) → config || null
   getHandler(wmClass) → handler || null
   hasPlugin(wmClass) → boolean
   isSingleInstance(wmClass) → boolean
   getTimeout(wmClass) → number
   getGracePeriod(wmClass) → number
   getLoadedPlugins() → string[]
   getAllPlugins() → Array<{name, config, handler}>
   ```

### Storage

**File:** `services/storage.js`

**Responsibility:** Persistence of window positions and monitor layout.

**Data structure:**

```json
{
  "version": 4,
  "timestamp": 1737321234567,
  "monitor_layout": {
    "timestamp": 1737321234567,
    "monitors": [
      {
        "index": 0,
        "connector": "HDMI-1",
        "edid_hash": "abc123def456",
        "geometry": {"x": 0, "y": 0, "width": 1920, "height": 1080},
        "is_primary": true
      }
    ]
  },
  "applications": {
    "firefox": {
      "wm_class": "firefox",
      "desktop_file": "firefox.desktop",
      "desktop_exec": "/usr/bin/firefox",
      "instances": [
        {
          "id": "firefox-1737321234567-0",
          "title_snapshot": "Mozilla Firefox",
          "cmdline": ["/usr/bin/firefox"],
          "working_dir": "/home/user",
          "open_documents": ["/home/user/Downloads/file.pdf"],
          "workspace": 0,
          "monitor_index": 0,
          "monitor_id": "edid:abc123def456",
          "geometry_percent": {"x": 0.1, "y": 0.1, "width": 0.8, "height": 0.8},
          "geometry_absolute": {"x": 192, "y": 108, "width": 1536, "height": 864},
          "maximized": false,
          "sticky": false,
          "shaded": false,
          "alwaysOnTop": false,
          "fullscreen": false,
          "skipTaskbar": false,
          "minimized": false,
          "stable_sequence": 12345,
          "x11_window_id": "0x3a00012",
          "assigned": false,
          "autostart": true
        }
      ]
    }
  }
}
```

**Main features:**

1. **Auto-save (every 30 seconds)**
   ```javascript
   _startAutoSave() {
       this._autoSaveIntervalId = Mainloop.timeout_add_seconds(30, () => {
           if (this._autoSaveCallback) {
               const shouldSave = this._autoSaveCallback();
               if (shouldSave !== false) {
                   this.save();
               }
           }
           return true;
       });
   }
   ```

2. **Shutdown protection**
   ```javascript
   stopAutoSave() {
       this._isShuttingDown = true; // Block ALL future saves
       this._stopAutoSave();
       if (this._saveTimeoutId) {
           Mainloop.source_remove(this._saveTimeoutId);
       }
   }
   ```

3. **Backup mechanism**
   ```javascript
   backupPositions() {
       const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
       const backupFile = `positions_backup_${timestamp}.json`;
       const backupPath = GLib.build_filenamev([this._configDir, backupFile]);

       // Copy current positions.json to backup
       const srcFile = Gio.File.new_for_path(this._configFile);
       const destFile = Gio.File.new_for_path(backupPath);
       srcFile.copy(destFile, Gio.FileCopyFlags.OVERWRITE, null, null);
   }
   ```

4. **Permission hardening**
   ```javascript
   _hardenPermissions(path, isDirectory) {
       const mode = isDirectory ? 0o700 : 0o600;
       GLib.chmod(path, mode);
   }
   ```

**API methods:**
```javascript
init() → void
save() → void
load() → void
backupPositions() → void
blockSaves() → void
unblockSaves() → void
getApp(wmClass) → appData || null
setApp(wmClass, appData) → void
getAllApps() → object
updateMonitorLayout(monitorManager) → void
destroy() → void
```

## Data Flow

### 1. Window Tracking → Storage

```
Window Event (position-changed)
    ↓
WindowTracker._onWindowChanged(metaWindow)
    ↓
Add to _dirtyWindows Set
    ↓
[30 seconds later: Auto-Save Timer]
    ↓
WindowTracker._saveAllOpenWindows()
    ↓
For each dirty window:
    WindowTracker._saveWindowStateInternal(metaWindow)
        ↓
        WindowMatcher.findOrCreateInstance(metaWindow, appData)
        ↓
        Update instance data (geometry, workspace, etc.)
        ↓
        Storage.setApp(wmClass, appData)
    ↓
Clear _dirtyWindows
    ↓
Storage.save()
    ↓
Write to ~/.config/remember@thechief/positions.json
```

### 2. Session Restore

```
Cinnamon Startup
    ↓
Extension.enable()
    ↓
AutoRestore.scheduleAutoRestore()
    ↓
[2 seconds delay]
    ↓
AutoRestore._performAutoRestore()
    ↓
Filter instances (blacklist, max limit, running count)
    ↓
SessionLauncher.launchInstances(instances)
    ↓
Build launch queue:
    - Single-instance apps: 1 launch for N instances
    - Multi-instance apps: N launches
    ↓
Launch progress window (Python GTK)
    ↓
Process launch queue with delays:
    ↓
    For each item:
        SessionLauncher._launchApp(wmClass, appData, instance, instanceId)
            ↓
            Plugin-based launch:
                1. Resolve executable
                2. Build args (flags + conditionalFlags)
                3. Handler beforeLaunch hook
                4. Handler parseTitleData (for documents)
                5. Spawn process
                6. Handler afterLaunch hook
            ↓
            Register pending launch
            ↓
            Start timeout timer
    ↓
    [Delay between apps: 500ms - 2000ms]
    ↓
Window appears:
    ↓
    WindowTracker._onWindowCreated(metaWindow)
        ↓
        SessionLauncher.checkPendingLaunch(metaWindow)
            ↓
            Match wmClass (direct or via plugin)
            ↓
            Remove from pendingLaunches
            ↓
            Return instance data
        ↓
        PositionRestorer.tryRestorePosition(metaWindow, isNewWindow, instance, instanceId)
            ↓
            Match strategy (stable_sequence, x11_window_id, title, etc.)
            ↓
            Restore geometry (with retry timings for aggressive apps)
            ↓
            Restore properties (workspace, maximized, sticky, etc.)
            ↓
            Mark instance as assigned
            ↓
            Notify progress: "positioning"
        ↓
        SessionLauncher.notifyPositionComplete(instanceId, wmClass)
            ↓
            Notify progress: "ready"
    ↓
[60 seconds after last launch]
    ↓
AutoRestore._onRestoreComplete()
    ↓
    Clear _isRestoringSession flag
    ↓
    Unblock saves in Storage
    ↓
    Save all currently open windows
```

### 3. Manual Operations (via Applet/API)

**Save All:**
```
User clicks "Save All" in Applet
    ↓
Main.windowRemember.saveAll()
    ↓
Storage.save()
    ↓
Notify user: "Saved N window positions"
```

**Restore All:**
```
User clicks "Restore All" in Applet
    ↓
Main.windowRemember.restoreAll()
    ↓
WindowTracker.resetAssignments()
    ↓
For each running window:
    PositionRestorer.tryRestorePosition(metaWindow, false)
    ↓
    Match & restore position
    ↓
Notify user: "Restored N window positions"
```

**Launch Session:**
```
User clicks "Launch Session" in Applet
    ↓
Main.windowRemember.launchSession()
    ↓
SessionLauncher.launchSession()
    ↓
Filter instances (autostart=true only)
    ↓
SessionLauncher.launchInstances(instances)
    ↓
[Same as Session Restore flow]
```

## Smart Window Matching

### Matching Strategies (Priority)

**File:** `core/windowMatcher.js`

```javascript
findInstanceForWindow(metaWindow, appData) {
    const x11WindowId = this._getX11WindowIdFn(metaWindow);
    const stableSequence = metaWindow.get_stable_sequence();
    const title = metaWindow.get_title() || '';

    // 1. stable_sequence match (most reliable within session)
    for (const instance of unassignedInstances) {
        if (instance.stable_sequence && instance.stable_sequence === stableSequence) {
            return instance;
        }
    }

    // 2. X11 window ID match (persists across Cinnamon restart)
    if (x11WindowId) {
        for (const instance of unassignedInstances) {
            if (instance.x11_window_id === x11WindowId) {
                return instance;
            }
        }
    }

    // 3. Exact title match (for after re-login when IDs changed)
    if (title) {
        for (const instance of unassignedInstances) {
            if (instance.title_snapshot === title) {
                return instance;
            }
        }
    }

    // 4. First unassigned instance (order-based fallback)
    if (unassignedInstances.length > 0) {
        return unassignedInstances[0];
    }

    // 5. Create new instance
    return null;
}
```

### Instance ID Generation

```javascript
// Unique ID format: wmClass-timestamp-index
const timestamp = Date.now();
const instanceId = `${wmClass}-${timestamp}-${index}`;
```

### Assignment Lifecycle

```
Window created
    ↓
findInstanceForWindow(metaWindow, appData)
    ↓
Match found?
    Yes → Mark instance.assigned = true
    No  → Create new instance
    ↓
Save to storage
    ↓
Window destroyed
    ↓
DO NOT delete instance immediately!
    ↓
[30 seconds later: Auto-Save with Cleanup]
    ↓
InstanceCleanup.cleanupOrphanedInstances()
    ↓
Check if instance matches any running window
    ↓
    No match found?
        ↓
        Check if instance was ever tracked this session
            ↓
            Not tracked OR tracked > 5 min ago?
                ↓
                Delete instance
```

## Multi-Monitor Support

### Monitor Identification

**File:** `services/monitorManager.js`

**Strategy (Priority):**

1. **EDID Hash** (best - hardware-unique)
   ```javascript
   _getMonitorEDID(connector) {
       // Parse xrandr --verbose output
       const edidHex = this._parseXrandrEDID(connector);
       if (edidHex) {
           return GLib.compute_checksum_for_string(
               GLib.ChecksumType.SHA256,
               edidHex,
               -1
           ).substring(0, 16);
       }
   }
   ```

2. **Connector + Resolution** (fallback)
   ```javascript
   const monitorId = `${connector}:${geometry.width}x${geometry.height}`;
   ```

3. **Monitor Index** (last resort)
   ```javascript
   const monitorId = `index:${monitorIndex}`;
   ```

### Monitor Layout Storage

```json
{
  "monitor_layout": {
    "timestamp": 1737321234567,
    "monitors": [
      {
        "index": 0,
        "connector": "HDMI-1",
        "edid_hash": "abc123def456",
        "geometry": {"x": 0, "y": 0, "width": 1920, "height": 1080},
        "is_primary": true
      },
      {
        "index": 1,
        "connector": "DP-1",
        "edid_hash": "def789ghi012",
        "geometry": {"x": 1920, "y": 0, "width": 2560, "height": 1440},
        "is_primary": false
      }
    ]
  }
}
```

### Position Restoration with Monitor Matching

```javascript
tryRestorePosition(metaWindow, isNewWindow, launchedInstance, instanceId) {
    // 1. Find saved instance
    const instance = launchedInstance ||
                     this._findInstanceForWindowFn(metaWindow, appData);

    // 2. Match saved monitor to current monitors
    const targetMonitor = this._findBestMonitorMatch(
        instance.monitor_id,
        instance.monitor_index
    );

    // 3. Restore geometry
    if (targetMonitor !== null) {
        // Prefer percentage-based (adapts to resolution changes)
        const monitorGeom = global.display.get_monitor_geometry(targetMonitor);
        const x = monitorGeom.x + (instance.geometry_percent.x * monitorGeom.width);
        const y = monitorGeom.y + (instance.geometry_percent.y * monitorGeom.height);
        const width = instance.geometry_percent.width * monitorGeom.width;
        const height = instance.geometry_percent.height * monitorGeom.height;

        metaWindow.move_resize_frame(false, x, y, width, height);
    } else {
        // Fallback to absolute geometry
        metaWindow.move_resize_frame(
            false,
            instance.geometry_absolute.x,
            instance.geometry_absolute.y,
            instance.geometry_absolute.width,
            instance.geometry_absolute.height
        );
    }
}
```

## Config Layers

### 1. Cinnamon Settings Schema

**File:** `settings-schema.json`

**Purpose:** User-visible settings in Cinnamon's native settings interface.

**Example:**
```json
{
  "autoRestoreOnStartup": {
    "type": "checkbox",
    "default": true,
    "description": "Automatically restore session on login",
    "tooltip": "If enabled, saved windows will be launched on login"
  }
}
```

**Access in code:**
```javascript
// NOT USED in this extension
// We use custom JSON files instead for more flexibility
```

### 2. preferences.json

**File:** `~/.config/remember@thechief/preferences.json`

**Purpose:** UI-specific settings (managed by Python Settings Dialog).

**Service:** `services/preferences.js`

**Example:**
```json
{
  "trackAllWorkspaces": true,
  "rememberSticky": true,
  "rememberShaded": true,
  "rememberAlwaysOnTop": true,
  "rememberFullscreen": true,
  "minimumWindowWidth": 100,
  "minimumWindowHeight": 50
}
```

**API:**
```javascript
const preferences = new Preferences();
preferences.init();

if (preferences.shouldTrackAllWorkspaces()) {
    // Track windows on all workspaces
}

if (preferences.shouldRememberSticky()) {
    instance.sticky = metaWindow.is_on_all_workspaces();
}
```

### 3. extension-settings.json

**File:** `~/.config/remember@thechief/extension-settings.json`

**Purpose:** Launch-specific settings (managed by Python Settings Dialog).

**Service:** `services/extensionSettings.js`

**Example:**
```json
{
  "launchFlags": {
    "firefoxSessionRestore": true,
    "chromeSessionRestore": true,
    "braveSessionRestore": false
  }
}
```

**API:**
```javascript
const extensionSettings = new ExtensionSettings();
extensionSettings.init();

// Check conditional flag setting
if (extensionSettings.get('launchFlags.firefoxSessionRestore') !== false) {
    args.push('--restore-session');
}

// Check browser session restore
if (extensionSettings.useBrowserSessionRestore()) {
    // Use browser's own session restore
}
```

### 4. config.js

**File:** `config.js`

**Purpose:** Constants and global configuration.

**Examples:**

```javascript
// Session Launch Config
const SESSION_LAUNCH_CONFIG = {
    LAUNCH_DELAY_BETWEEN_APPS: 500,  // ms between app launches
    APP_LAUNCH_TIMEOUT: 45000,        // 45 sec default timeout
    GRACE_PERIOD_AFTER_TIMEOUT: 30000, // 30 sec grace period
    MAX_INSTANCES_PER_APP: 5,         // Safety limit
    LAUNCH_BLACKLIST: [
        'cinnamon-settings',
        'nemo-desktop',
        'remember-settings'
    ]
};

// Single-Instance Apps
const SINGLE_INSTANCE_APPS = new Set([
    'Thunderbird',
    'Spotify',
    'slack'
]);

const SINGLE_INSTANCE_TIMEOUT = 120000;    // 2 min
const SINGLE_INSTANCE_GRACE_PERIOD = 60000; // 1 min
```

## Logging System

### Debug Mode

**Activation:**
```bash
export REMEMBER_DEBUG=1
cinnamon --replace &
```

**In code:**
```javascript
// services/logger.js
const _debugMode = GLib.getenv('REMEMBER_DEBUG') === '1';

var log = function(message) {
    if (_debugMode) {
        global.log(`${UUID}: ${message}`);
    }
};
```

### Logger Module

**File:** `services/logger.js`

```javascript
const logger = new Logger();

// Standard log (only in Debug mode)
logger.log('Window tracking enabled');

// Sensitive data (sanitized in Production, full in Debug)
logger.logSensitive('Now tracking window', {
    title: 'Private Document.pdf',
    cmdline: ['/usr/bin/firefox', '/home/user/private/file.html']
});

// Debug-only
logger.logDebug('Restore timing', { delay: 500 });

// Error (always logged)
logger.error('Failed to load plugin', error);
```

**Sanitization in Production:**
```javascript
// Debug Mode:
"Now tracking window: title="Private Document.pdf" cmdline=[/usr/bin/firefox /home/user/private/file.html]"

// Production Mode:
// (nothing logged)
```

### Log Locations

```bash
# Cinnamon Logs
tail -f ~/.xsession-errors

# Looking Glass (Live Debugging)
Alt+F2 → lg → Click "Log" tab
```

## Performance Optimizations

### 1. Dirty-Flag System

**Problem:** Saving on every window event is too expensive.

**Solution:** Only mark, batch-save every 30 seconds.

```javascript
// Mark as dirty (fast)
_onWindowChanged(metaWindow) {
    this._dirtyWindows.add(metaWindow);
}

// Batch save (every 30 sec)
_saveAllOpenWindows() {
    for (const metaWindow of this._dirtyWindows) {
        this._saveWindowStateInternal(metaWindow);
    }
    this._dirtyWindows.clear();
    this._storage.save(); // Single I/O operation
}
```

### 2. Module Caching

**File:** `modules.js`

```javascript
const moduleCache = {};

load: function(extensionMeta, subdir, moduleName) {
    const cacheKey = `_${subdir}_${moduleName}`;

    if (moduleCache[cacheKey]) {
        return moduleCache[cacheKey]; // Return cached
    }

    // Load and cache
    const loadedModule = imports[moduleName];
    moduleCache[cacheKey] = loadedModule;
    return loadedModule;
}
```

### 3. Lazy Process Scanning

**Problem:** Reading `/proc/PID/cmdline` is expensive.

**Solution:** Only once at first track, never again (cmdline never changes).

```javascript
_trackWindow(metaWindow) {
    // Capture cmdline ONCE at first track
    this._processCapture.captureInitialProcessInfo(metaWindow);

    // cmdline is now cached, never read again
}
```

### 4. Orphan Cleanup only at Auto-Save

**Problem:** Cleanup on every window close is expensive.

**Solution:** Cleanup only every 30 seconds at auto-save.

```javascript
this._storage.setAutoSaveCallback(() => {
    // First cleanup orphans
    this._instanceCleanup.cleanupOrphanedInstances();
    // Then save dirty windows
    this._saveAllOpenWindows();
    return true;
});
```

## Error Handling & Robustness

### 1. Shutdown Protection

```javascript
disable() {
    // CRITICAL: Set flag FIRST to stop all saves immediately
    this._isShuttingDown = true;
    if (this._tracker) {
        this._tracker._isShuttingDown = true;
    }

    // BACKUP before cleanup
    if (this._storage) {
        this._storage.backupPositions();
    }

    // Stop auto-save
    this._storage.stopAutoSave();

    // NO SAVE HERE - would capture partial state!
}
```

### 2. Cinnamon Restart Protection

**Problem:** With `Alt+F2 r` windows are briefly "unmanaged" but come back immediately.

**Solution:** No immediate deletes in `_untrackWindow()`, only deferred cleanup.

```javascript
_untrackWindow(metaWindow) {
    // Disconnect signals
    this._trackedWindows.delete(metaWindow);

    // DO NOT delete from storage here!
    // Cleanup happens in cleanupOrphanedInstances()
}

cleanupOrphanedInstances() {
    // Compare saved instances vs. running windows
    // Only delete if no matching window AND not recently tracked
}
```

### 3. Grace Periods for Slow Apps

```javascript
_onLaunchTimeout(instanceId) {
    // App didn't appear in time - enter grace period
    const expected = this._expectedLaunches.get(instanceId);
    expected.timedOut = true;
    expected.gracePeriod = Date.now() + gracePeriodMs;

    // Keep instance in expectedLaunches for grace period
    // If window appears late, it can still be matched
}
```

### 4. Aggressive App Handling

**Problem:** Apps like VS Code position themselves aggressively.

**Solution:** Multiple restore attempts with increasing delays.

```javascript
// vscode/index.js
var VSCodeHandler = class VSCodeHandler {
    constructor(config) {
        // Multiple restore attempts to override aggressive self-positioning
        this.restoreTimings = [500, 1500, 3000, 5000, 8000];
    }
};

// core/positionRestorer.js
tryRestorePosition(metaWindow, isNewWindow, launchedInstance, instanceId) {
    // Initial restore
    this._applyGeometry(metaWindow, instance);

    // Schedule retry attempts for aggressive apps
    const handler = this._pluginManager.getHandler(wmClass);
    if (handler && handler.restoreTimings) {
        for (const delay of handler.restoreTimings) {
            Mainloop.timeout_add(delay, () => {
                this._applyGeometry(metaWindow, instance);
                return false;
            });
        }
    }
}
```

## Testing & Debugging

### Looking Glass

```bash
Alt+F2 → lg
```

**Useful Commands:**
```javascript
// Check API
Main.windowRemember

// Check stats
Main.windowRemember.getStats()

// Force save
Main.windowRemember.saveAll()

// Check loaded plugins
global.windowRemember._pluginManager.getLoadedPlugins()
```

### Inspect Saved Data

```bash
# Pretty-print positions
cat ~/.config/remember@thechief/positions.json | jq

# Check monitor layout
cat ~/.config/remember@thechief/positions.json | jq '.monitor_layout'

# List all apps
cat ~/.config/remember@thechief/positions.json | jq '.apps | keys'

# Check specific app instances
cat ~/.config/remember@thechief/positions.json | jq '.apps.firefox.instances'
```

### Test Session Restore

```bash
# 1. Save current state
# Click "Save All" in applet

# 2. Close some windows
# Close Firefox, VSCode, etc.

# 3. Test launch
# Click "Launch Session" in applet

# 4. Check logs
tail -f ~/.xsession-errors | grep remember@thechief
```

### Test Monitor Changes

```bash
# 1. Save positions on current monitor setup
# 2. Change monitor layout (disconnect/connect, change resolution)
# 3. Restart Cinnamon (Alt+F2 → r)
# 4. Check if monitors are re-identified correctly
cat ~/.config/remember@thechief/positions.json | jq '.monitor_layout'

# 5. Restore positions
# Should adapt to new layout via percentage-based geometry
```

### Debug Plugin Loading

```bash
# Enable debug mode
export REMEMBER_DEBUG=1

# Restart Cinnamon
cinnamon --replace &

# Check logs for plugin loading
tail -f ~/.xsession-errors | grep -i plugin
```

## Further Documentation

- **Plugin Development:** `plugin-development.md`
- **API Reference:** `api-reference.md`
- **Contributing:** `contributing.md`
