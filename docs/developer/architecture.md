# Remember Extension - System-Architektur

## Übersicht

Remember ist eine Cinnamon Desktop Extension, die Fensterpositionen speichert und über Sessions hinweg wiederherstellt. Das System verwendet eine modular aufgebaute Architektur mit klarer Trennung der Verantwortlichkeiten.

**Kernfunktionen:**
- Automatisches Tracking von Fensterpositionen in Echtzeit
- Session-Restore beim Login mit intelligentem App-Launching
- Multi-Monitor-Support mit EDID-basierter Identifikation
- Plugin-System für app-spezifisches Verhalten
- Smart Window Matching über mehrere Strategien

**Technologie:**
- Sprache: JavaScript (GJS/CJS - Cinnamon JavaScript)
- Platform: Cinnamon Desktop 6.0+
- Settings UI: Python 3 + GTK 3
- Storage: JSON-Dateien in `~/.config/remember@thechief/`

## Design-Prinzipien

### 1. Modularität
Jedes Modul hat eine klar definierte Verantwortung. Core-Module sind in `core/` organisiert, Services in `services/`, Plugins in `plugins/`.

### 2. Robustheit
- Dirty-Flag-System verhindert unnötige I/O-Operationen
- Shutdown-Detection verhindert Datenverlust beim Logout
- Backup-Mechanismus vor Shutdown
- Grace Periods für langsame Apps

### 3. Erweiterbarkeit
Das Plugin-System ermöglicht app-spezifische Anpassungen ohne Änderung des Core-Codes.

### 4. Performance
- Nur geänderte Fenster werden gespeichert (Dirty-Flag-System)
- Auto-Save alle 30 Sekunden statt bei jeder Änderung
- Module werden lazy geladen

## Extension Lifecycle

### 1. Initialisierung (`init(meta)`)

**Wird einmal beim Laden der Extension aufgerufen.**

```javascript
function init(meta) {
    extension = new WindowRememberExtension();
    extension.init(meta);
}
```

**Aufgaben:**
- Speichern der Extension-Metadaten (`meta.path`)
- Installation des Companion Applets falls benötigt
- Keine aktive Logik, nur Setup

**Module geladen:**
- `modules.js` - Für dynamisches Laden von Core-Modulen
- `core/appletManager.js` - Für Applet-Installation

### 2. Aktivierung (`enable()`)

**Wird beim Start von Cinnamon oder bei manueller Aktivierung aufgerufen.**

```javascript
function enable() {
    if (extension) {
        extension.enable();
    }
}
```

**Aufgaben:**

1. **Logger initialisieren** (als erstes!)
   ```javascript
   const loggerModule = getExtensionModule('services/logger');
   log = loggerModule.log;
   logError = loggerModule.logError;
   this._logger = new loggerModule.Logger();
   ```

2. **Shutdown-Flag zurücksetzen**
   ```javascript
   this._isShuttingDown = false;
   ```

3. **Module laden** (in dieser Reihenfolge!)
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

4. **Config laden**
   ```javascript
   const configModule = getExtensionModule('config');
   this._sessionConfig = configModule.SESSION_LAUNCH_CONFIG;
   this._singleInstanceConfig = {
       apps: configModule.SINGLE_INSTANCE_APPS,
       timeout: configModule.SINGLE_INSTANCE_TIMEOUT,
       gracePeriod: configModule.SINGLE_INSTANCE_GRACE_PERIOD
   };
   ```

5. **Services initialisieren**
   ```javascript
   this._storage.init();
   this._preferences.init();
   this._extensionSettings.init();
   ```

6. **Saves blockieren bis Restore fertig**
   ```javascript
   this._storage.blockSaves();
   ```

7. **Plugin-Manager laden**
   ```javascript
   this._pluginManager.loadPlugins();
   ```

8. **Monitor-Manager aktivieren**
   ```javascript
   this._monitorManager.enable();
   ```

9. **Window-Tracker initialisieren**
   ```javascript
   this._tracker = new WindowTracker(...);
   this._tracker._isRestoringSession = true; // Verhindert Saves während Restore
   this._tracker.enable(); // Startet Tracking
   ```

10. **Session-Launcher initialisieren**
    ```javascript
    this._launcher = new SessionLauncher(...);
    this._tracker.setSessionLauncher(this._launcher);
    this._tracker.setPluginManager(this._pluginManager);
    ```

11. **AutoRestore initialisieren**
    ```javascript
    this._autoRestore = new AutoRestore({...});
    ```

12. **Globale API exposen**
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

13. **Auto-Restore planen**
    ```javascript
    this._autoRestore.scheduleAutoRestore();
    ```

### 3. Deaktivierung (`disable()`)

**Wird beim Logout, Shutdown oder manueller Deaktivierung aufgerufen.**

```javascript
function disable() {
    if (extension) {
        extension.disable();
    }
}
```

**Kritische Reihenfolge der Aufgaben:**

1. **SOFORT Shutdown-Flag setzen** (verhindert weitere Saves!)
   ```javascript
   this._isShuttingDown = true;
   if (this._tracker) {
       this._tracker._isShuttingDown = true;
   }
   ```

2. **Backup erstellen** (vor Cleanup!)
   ```javascript
   if (this._storage) {
       this._storage.backupPositions();
   }
   ```

3. **Auto-Save stoppen**
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

5. **Applet entfernen**
   ```javascript
   if (this._appletManager) {
       this._appletManager.deactivate();
   }
   ```

6. **Globale API entfernen**
   ```javascript
   if (Main.windowRemember) {
       delete Main.windowRemember;
   }
   ```

7. **Tracker deaktivieren** (disconnected Signals!)
   ```javascript
   if (this._tracker) {
       this._tracker.disable();
   }
   ```

8. **Komponenten cleanup** (in umgekehrter Reihenfolge!)
   ```javascript
   if (this._launcher) this._launcher.destroy();
   if (this._monitorManager) this._monitorManager.disable();
   if (this._storage) this._storage.destroy();
   if (this._preferences) this._preferences.destroy();
   if (this._extensionSettings) this._extensionSettings.destroy();
   if (this._pluginManager) this._pluginManager.destroy();
   ```

**WICHTIG:** Kein finales Save in `disable()`! Das würde den Partial State während des Shutdowns speichern.

## Modul-System und GJS-Caching

### Problem: GJS Module Caching

GJS (GNOME JavaScript) cached Module global nach ihrem Namen. Das bedeutet:
- Alle `index.js` Dateien würden denselben Cache-Eintrag teilen
- Module aus Subdirectories können nicht normal geladen werden

### Lösung: modules.js

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

**Verwendung:**

```javascript
// Core Module laden
const modulesModule = getExtensionModule('modules');
const Modules = modulesModule.Modules;

const { WindowFilter } = Modules.load(meta, 'core', 'windowFilter');
const { PositionRestorer } = Modules.load(meta, 'core', 'positionRestorer');
```

**Plugin Handler laden:**

Plugins verwenden eine spezielle Technik um Cache-Konflikte zu vermeiden:

```javascript
// Parent-Directory zum Search-Path
const parentDir = GLib.path_get_dirname(pluginPath);
imports.searchPath.unshift(parentDir);

// Import als: imports.<pluginName>.<moduleName>
// z.B. imports.thunderbird.index
const module = imports[pluginName][moduleName];
```

So hat jedes Plugin einen unique Namespace.

## Core Components

### WindowTracker

**File:** `windowTracker.js`

**Verantwortung:** Überwacht Fenster-Events und speichert Position-Änderungen.

**Hauptmerkmale:**

1. **Dirty-Flag-System**
   ```javascript
   _dirtyWindows = new Set(); // Fenster mit ungespeicherten Änderungen

   _onWindowChanged(metaWindow) {
       if (this._isRestoringSession || this._isShuttingDown) {
           return; // Keine Saves während Restore/Shutdown
       }
       this._dirtyWindows.add(metaWindow); // Nur markieren
   }

   _saveAllOpenWindows() {
       // Nur dirty windows speichern
       for (const metaWindow of this._dirtyWindows) {
           this._saveWindowStateInternal(metaWindow);
       }
       this._dirtyWindows.clear();
   }
   ```

2. **Window Signals**
   ```javascript
   // Position/Size
   metaWindow.connect('position-changed', () => this._onWindowChanged(metaWindow));
   metaWindow.connect('size-changed', () => this._onWindowChanged(metaWindow));

   // Workspace
   metaWindow.connect('workspace-changed', () => this._onWindowChanged(metaWindow));

   // Title (für Dokument-Apps)
   metaWindow.connect('notify::title', () => this._onTitleChanged(metaWindow));

   // WM_CLASS Migration (LibreOffice: Soffice → libreoffice-calc)
   metaWindow.connect('notify::wm-class', () => this._wmClassMigration.onWmClassChanged(metaWindow));

   // Always-On-Top
   metaWindow.connect('notify::above', () => this._onWindowChanged(metaWindow));

   // Cleanup
   metaWindow.connect('unmanaging', () => this._untrackWindow(metaWindow));
   ```

3. **Auto-Save Callback**
   ```javascript
   this._storage.setAutoSaveCallback(() => {
       if (this._isRestoringSession || this._isShuttingDown) {
           return false; // Skip save
       }
       this._instanceCleanup.cleanupOrphanedInstances();
       this._saveAllOpenWindows(); // Saves nur dirty windows
       return true;
   });
   ```

**Injected Dependencies:**
- `_log`, `_logError` - Logging-Funktionen
- `_logger` - Logger-Instanz für sanitized logging
- `storage` - Storage-Service
- `monitorManager` - Monitor-Management
- `preferences` - User-Präferenzen
- `sessionLauncher` - Session-Restore-Logik
- `pluginManager` - Plugin-System

### SessionLauncher

**File:** `sessionLauncher.js`

**Verantwortung:** Startet Apps beim Session-Restore und tracked pending launches.

**Hauptmerkmale:**

1. **Launch Queue**
   ```javascript
   _launchQueue = []; // Queue von zu startenden Apps
   _pendingLaunches = new Map(); // instanceId → pending data
   _expectedLaunches = new Map(); // instanceId → expected data (grace period)
   ```

2. **Single-Instance Handling**
   ```javascript
   launchInstances(instances) {
       for (const [wmClass, data] of instancesByApp.entries()) {
           const isSingleInstance = this._isSingleInstance(wmClass);

           if (isSingleInstance) {
               // Nur EINMAL starten, aber alle Instances in Progress zeigen
               this._launchQueue.push({
                   wmClass: wmClass,
                   instance: appInstances[0],
                   instanceId: instanceId,
                   coveredInstanceIds: appInstances.map(inst => inst.id)
               });
           } else {
               // Multi-Instance: Alle starten
               for (const instance of appInstances) {
                   this._launchQueue.push({...});
               }
           }
       }
   }
   ```

3. **Plugin-based Launch**
   ```javascript
   _launchWithPlugin(plugin, handler, wmClass, appData, instance, workDir, instanceId) {
       // 1. Executable auflösen
       let executable = this._resolveExecutable(plugin.launch.executables);

       // 2. Args aus Plugin config
       let args = [...(plugin.launch.flags || [])];

       // 3. Conditional Flags
       if (plugin.launch.conditionalFlags) {
           for (const [settingKey, flags] of Object.entries(plugin.launch.conditionalFlags)) {
               if (this._extensionSettings.get(settingKey) !== false) {
                   args.push(...flags);
               }
           }
       }

       // 4. Handler beforeLaunch Hook
       if (handler && handler.beforeLaunch) {
           launchParams = handler.beforeLaunch(instance, launchParams);
       }

       // 5. Parse Title Data (für Dokument-Apps)
       if (handler && handler.parseTitleData) {
           const parsedArgs = handler.parseTitleData(instance.title_snapshot, instance);
           if (parsedArgs) {
               launchParams.args.push(...parsedArgs);
           }
       }

       // 6. Spawn Process
       const [success, pid] = this._spawnProcess(workDir, argv, instanceId, ...);

       // 7. Handler afterLaunch Hook
       if (handler && handler.afterLaunch) {
           handler.afterLaunch(instance, pid, success);
       }
   }
   ```

4. **Timeout & Grace Period**
   ```javascript
   _getTimeouts(wmClass, plugin = null) {
       // 1. Plugin-spezifisch
       if (plugin && plugin.features) {
           return {
               timeout: plugin.features.timeout || 45000,
               gracePeriod: plugin.features.gracePeriod || 30000,
               isSingleInstance: plugin.features.isSingleInstance
           };
       }

       // 2. Single-Instance Apps
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

5. **Flatpak Detection**
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

**Verantwortung:** Lädt und verwaltet App-spezifische Plugins.

**Hauptmerkmale:**

1. **Plugin Directories**
   ```javascript
   const pluginDirs = [
       // Built-in
       GLib.build_filenamev([this._extensionPath, 'plugins']),
       // User
       GLib.build_filenamev([GLib.get_home_dir(), '.config', UUID, 'plugins'])
   ];
   ```

2. **Plugin Laden**
   ```javascript
   _loadPlugin(dirPath, pluginName) {
       // 1. config.json laden (required)
       const config = JSON.parse(configFile.load_contents());

       // 2. Validierung
       if (!config.name || !config.wmClass || !Array.isArray(config.wmClass)) {
           return;
       }

       // 3. Defaults setzen
       config.launch = config.launch || {};
       config.features = config.features || {};
       config.features.isSingleInstance = config.features.isSingleInstance || false;

       // 4. Für alle wmClasses registrieren
       for (const wmClass of config.wmClass) {
           this._plugins.set(wmClass, config);
       }

       // 5. Handler laden (optional)
       if (config.handler) {
           this._loadHandler(pluginPath, pluginName, config);
       }
   }
   ```

3. **Handler Laden**
   ```javascript
   _loadHandler(pluginPath, pluginName, config) {
       // Unique Import Path: imports.<pluginName>.<moduleName>
       const parentDir = GLib.path_get_dirname(pluginPath);
       imports.searchPath.unshift(parentDir);

       const moduleName = config.handler.replace(/\.js$/, '');
       const module = imports[pluginName][moduleName];

       // Handler-Klasse finden (convention: *Handler)
       let HandlerClass = null;
       for (const key in module) {
           if (key.endsWith('Handler')) {
               HandlerClass = module[key];
               break;
           }
       }

       // Instanziieren
       const handler = new HandlerClass(config, this._extensionSettings, this._storage);

       // Für alle wmClasses registrieren
       for (const wmClass of config.wmClass) {
           this._handlers.set(wmClass, handler);
       }
   }
   ```

4. **API Methods**
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

**Verantwortung:** Persistierung von Fensterpositionen und Monitor-Layout.

**Datenstruktur:**

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

**Hauptmerkmale:**

1. **Auto-Save (alle 30 Sekunden)**
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

2. **Shutdown Protection**
   ```javascript
   stopAutoSave() {
       this._isShuttingDown = true; // Block ALL future saves
       this._stopAutoSave();
       if (this._saveTimeoutId) {
           Mainloop.source_remove(this._saveTimeoutId);
       }
   }
   ```

3. **Backup Mechanism**
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

4. **Permission Hardening**
   ```javascript
   _hardenPermissions(path, isDirectory) {
       const mode = isDirectory ? 0o700 : 0o600;
       GLib.chmod(path, mode);
   }
   ```

**API Methods:**
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

## Datenfluss

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

### Matching Strategien (Priorität)

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

**Strategie (Priorität):**

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

### Position Restoration mit Monitor-Matching

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

**Zweck:** User-visible settings in Cinnamon's native settings interface.

**Beispiel:**
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

**Zugriff im Code:**
```javascript
// NOT USED in this extension
// We use custom JSON files instead for more flexibility
```

### 2. preferences.json

**File:** `~/.config/remember@thechief/preferences.json`

**Zweck:** UI-spezifische Einstellungen (managed by Python Settings Dialog).

**Service:** `services/preferences.js`

**Beispiel:**
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

**Zweck:** Launch-spezifische Einstellungen (managed by Python Settings Dialog).

**Service:** `services/extensionSettings.js`

**Beispiel:**
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

**Zweck:** Konstanten und globale Konfiguration.

**Beispiele:**

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

**Aktivierung:**
```bash
export REMEMBER_DEBUG=1
cinnamon --replace &
```

**Im Code:**
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

// Standard log (nur in Debug-Mode)
logger.log('Window tracking enabled');

// Sensitive data (sanitized in Production, full in Debug)
logger.logSensitive('Now tracking window', {
    title: 'Private Document.pdf',
    cmdline: ['/usr/bin/firefox', '/home/user/private/file.html']
});

// Debug-only
logger.logDebug('Restore timing', { delay: 500 });

// Error (immer geloggt)
logger.error('Failed to load plugin', error);
```

**Sanitization in Production:**
```javascript
// Debug Mode:
"Now tracking window: title="Private Document.pdf" cmdline=[/usr/bin/firefox /home/user/private/file.html]"

// Production Mode:
// (nichts geloggt)
```

### Log Locations

```bash
# Cinnamon Logs
tail -f ~/.xsession-errors

# Looking Glass (Live Debugging)
Alt+F2 → lg → Click "Log" tab
```

## Performance Optimierungen

### 1. Dirty-Flag-System

**Problem:** Speichern bei jedem Window-Event ist zu teuer.

**Lösung:** Nur markieren, batch-save alle 30 Sekunden.

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

**Problem:** `/proc/PID/cmdline` lesen ist teuer.

**Lösung:** Nur einmal beim ersten Track, niemals erneut (cmdline ändert sich nie).

```javascript
_trackWindow(metaWindow) {
    // Capture cmdline ONCE at first track
    this._processCapture.captureInitialProcessInfo(metaWindow);

    // cmdline ist jetzt gecached, wird nie neu gelesen
}
```

### 4. Orphan Cleanup nur bei Auto-Save

**Problem:** Cleanup bei jedem Window-Close ist teuer.

**Lösung:** Cleanup nur alle 30 Sekunden beim Auto-Save.

```javascript
this._storage.setAutoSaveCallback(() => {
    // First cleanup orphans
    this._instanceCleanup.cleanupOrphanedInstances();
    // Then save dirty windows
    this._saveAllOpenWindows();
    return true;
});
```

## Error Handling & Robustheit

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

**Problem:** Bei `Alt+F2 r` werden Fenster kurz "unmanaged" aber kommen sofort zurück.

**Lösung:** Keine sofortigen Deletes in `_untrackWindow()`, nur deferred Cleanup.

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

### 3. Grace Periods für langsame Apps

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

**Problem:** Apps wie VS Code positionieren sich selbst aggressiv.

**Lösung:** Multiple Restore-Versuche mit steigenden Delays.

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

## Weitere Dokumentation

- **Plugin Development:** `plugin-development.md`
- **API Reference:** `api-reference.md`
- **Contributing:** `contributing.md`
