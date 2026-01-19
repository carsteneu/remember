/**
 * Window Tracker Module for Window Position Remember Extension
 *
 * Tracks window positions and movements.
 * Uses modular architecture with extracted components in core/.
 */

const Main = imports.ui.main;
const Meta = imports.gi.Meta;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Cinnamon = imports.gi.Cinnamon;
const Mainloop = imports.mainloop;
const SignalManager = imports.misc.signalManager;

const UUID = "remember@thechief";

// Core modules (loaded via modules.js)
let WindowFilter, WindowMatcher, PositionRestorer, ProcessCapture, WmClassMigration, InstanceCleanup, CONFIG;

/**
 * Window Tracker Class
 * Tracks window positions and movements
 */
var WindowTracker = class WindowTracker {
    constructor(storage, monitorManager, preferences, extensionMeta) {
        this._storage = storage;
        this._monitorManager = monitorManager;
        this._preferences = preferences;
        this._extensionMeta = extensionMeta;
        this._signals = new SignalManager.SignalManager(null);
        this._trackedWindows = new Map();  // metaWindow -> signalIds
        this._dirtyWindows = new Set();    // Windows with unsaved changes (dirty flag)
        this._everTrackedWmClasses = new Set(); // All wmClasses ever tracked this session (survives window close)
        this._pendingRestores = new Map(); // wmClass -> instance data
        this._sessionLauncher = null;
        this._pluginManager = null;
        this._isRestoringSession = false; // Flag to prevent cleanup AND position saving during session restore
        this._isShuttingDown = false; // Flag to stop all saves during logout/shutdown
        this._startTime = Date.now(); // Track when tracker was initialized

        // Initialize modules
        this._initModules(extensionMeta);

        // Create module instances
        this._windowFilter = new WindowFilter(this._preferences);

        this._windowMatcher = new WindowMatcher(this._getX11WindowId.bind(this));

        this._positionRestorer = new PositionRestorer({
            storage: this._storage,
            monitorManager: this._monitorManager,
            preferences: this._preferences,
            pluginManager: this._pluginManager,
            sessionLauncher: this._sessionLauncher,
            getX11WindowIdFn: this._getX11WindowId.bind(this),
            findInstanceForWindowFn: this._windowMatcher.findInstanceForWindow.bind(this._windowMatcher)
        });

        this._processCapture = new ProcessCapture({
            storage: this._storage,
            findDesktopFileFn: this._findDesktopFile.bind(this),
            findDesktopExecFn: this._findDesktopExec.bind(this),
            findOrCreateInstanceFn: this._windowMatcher.findOrCreateInstance.bind(this._windowMatcher)
        });

        this._wmClassMigration = new WmClassMigration({
            storage: this._storage,
            pluginManager: this._pluginManager,
            getX11WindowIdFn: this._getX11WindowId.bind(this),
            findDesktopFileFn: this._findDesktopFile.bind(this),
            findDesktopExecFn: this._findDesktopExec.bind(this),
            onWindowChangedFn: this._onWindowChanged.bind(this)
        });

        this._instanceCleanup = new InstanceCleanup({
            storage: this._storage,
            sessionLauncher: this._sessionLauncher,
            shouldTrackFn: this._windowFilter.shouldTrack.bind(this._windowFilter),
            getX11WindowIdFn: this._getX11WindowId.bind(this),
            isWmClassBlacklistedFn: this._windowFilter.isWmClassBlacklisted.bind(this._windowFilter),
            everTrackedWmClasses: this._everTrackedWmClasses
        });
    }

    /**
     * Initialize core modules via modules.js
     */
    _initModules(extensionMeta) {
        // Load modules.js to access Modules.load
        const originalSearchPath = imports.searchPath.slice();
        try {
            imports.searchPath.unshift(extensionMeta.path);
            const modulesModule = imports.modules;
            const Modules = modulesModule.Modules;

            // Load core modules
            const windowFilterModule = Modules.load(extensionMeta, 'core', 'windowFilter');
            WindowFilter = windowFilterModule.WindowFilter;
            CONFIG = windowFilterModule.CONFIG;

            WindowMatcher = Modules.load(extensionMeta, 'core', 'windowMatcher').WindowMatcher;
            PositionRestorer = Modules.load(extensionMeta, 'core', 'positionRestorer').PositionRestorer;
            ProcessCapture = Modules.load(extensionMeta, 'core', 'processCapture').ProcessCapture;
            WmClassMigration = Modules.load(extensionMeta, 'core', 'wmClassMigration').WmClassMigration;
            InstanceCleanup = Modules.load(extensionMeta, 'core', 'instanceCleanup').InstanceCleanup;

            global.log(`${UUID}: Core modules loaded successfully`);
        } finally {
            // Restore the original search path
            imports.searchPath.length = 0;
            for (let i = 0; i < originalSearchPath.length; i++) {
                imports.searchPath.push(originalSearchPath[i]);
            }
        }
    }

    /**
     * Set session launcher for pending launch checks
     */
    setSessionLauncher(launcher) {
        this._sessionLauncher = launcher;
        // Update references in modules that need it
        this._positionRestorer._sessionLauncher = launcher;
        this._instanceCleanup._sessionLauncher = launcher;
    }

    /**
     * Set plugin manager for accessing plugin-specific restore timings
     */
    setPluginManager(pluginManager) {
        this._pluginManager = pluginManager;
        // Update references in modules that need it
        this._positionRestorer._pluginManager = pluginManager;
        this._wmClassMigration._pluginManager = pluginManager;
    }

    /**
     * Start tracking windows
     */
    enable() {
        // Track existing windows
        global.get_window_actors().forEach(actor => {
            const metaWindow = actor.get_meta_window();
            if (this._windowFilter.shouldTrack(metaWindow)) {
                this._trackWindow(metaWindow);
            }
        });

        // Track new windows
        this._signals.connect(
            global.display,
            'window-created',
            this._onWindowCreated.bind(this)
        );

        // Track monitor changes
        this._signals.connect(
            Main.layoutManager,
            'monitors-changed',
            this._onMonitorsChanged.bind(this)
        );

        // Register full-save callback - saves ALL open windows every 5 seconds
        // Also cleans up orphaned instances (windows that were closed by user)
        this._storage.setAutoSaveCallback(() => {
            // Only save if not restoring session and not shutting down
            if (this._isRestoringSession || this._isShuttingDown) {
                return false; // Skip save
            }
            // First cleanup orphaned instances (windows user closed)
            this._instanceCleanup.cleanupOrphanedInstances();
            // Then save all currently open windows
            this._saveAllOpenWindows();
            return true; // Proceed with save
        });

        global.log(`${UUID}: Window tracking enabled, tracking ${this._trackedWindows.size} windows`);
    }

    /**
     * Stop tracking windows
     */
    disable() {
        this._signals.disconnectAllSignals();

        // Disconnect individual window signals
        this._trackedWindows.forEach((signalIds, metaWindow) => {
            signalIds.forEach(id => {
                try {
                    metaWindow.disconnect(id);
                } catch (e) {
                    // Window might already be destroyed
                }
            });
        });

        this._trackedWindows.clear();
        this._pendingRestores.clear();
        this._everTrackedWmClasses.clear();

        global.log(`${UUID}: Window tracking disabled`);
    }

    /**
     * Start tracking a specific window
     */
    _trackWindow(metaWindow) {
        if (this._trackedWindows.has(metaWindow)) {
            return;
        }

        const signalIds = [];

        // Track position changes
        signalIds.push(metaWindow.connect('position-changed', () => {
            this._onWindowChanged(metaWindow);
        }));

        // Track size changes
        signalIds.push(metaWindow.connect('size-changed', () => {
            this._onWindowChanged(metaWindow);
        }));

        // Track workspace changes
        signalIds.push(metaWindow.connect('workspace-changed', () => {
            this._onWindowChanged(metaWindow);
        }));

        // Track title changes (for apps that change titles when opening files)
        // Uses optimized handler that only rescans fd/ for document apps
        signalIds.push(metaWindow.connect('notify::title', () => {
            this._onTitleChanged(metaWindow);
        }));

        // Track WM_CLASS changes (LibreOffice changes from "Soffice" to "libreoffice-calc" after document loads)
        signalIds.push(metaWindow.connect('notify::wm-class', () => {
            this._wmClassMigration.onWmClassChanged(metaWindow);
        }));

        // Track always-on-top changes
        signalIds.push(metaWindow.connect('notify::above', () => {
            this._onWindowChanged(metaWindow);
        }));

        // Track when window is destroyed
        signalIds.push(metaWindow.connect('unmanaging', () => {
            this._untrackWindow(metaWindow);
        }));

        this._trackedWindows.set(metaWindow, signalIds);

        const wmClass = metaWindow.get_wm_class();

        // Remember this wmClass was tracked this session (survives window close)
        if (wmClass) {
            this._everTrackedWmClasses.add(wmClass);
        }

        // Use logger if available (sanitizes title in production mode)
        if (this._logger) {
            this._logger.logSensitive(`Now tracking window: ${wmClass}`, {
                title: metaWindow.get_title()
            });
        } else {
            global.log(`${UUID}: Now tracking window: ${wmClass}`);
        }

        // Capture cmdline ONCE at first track (never changes during process lifetime)
        this._processCapture.captureInitialProcessInfo(metaWindow);

        // Check if plugin specifies title stabilization delay
        // If so, delay initial save to avoid creating wrong instances
        let titleStabilizationDelay = 0;
        if (this._pluginManager && wmClass) {
            const plugin = this._pluginManager.getPlugin(wmClass);
            if (plugin && plugin.features && plugin.features.titleStabilizationDelay) {
                titleStabilizationDelay = plugin.features.titleStabilizationDelay;
            }
        }

        if (titleStabilizationDelay > 0) {
            // Delay initial save for apps that change title after loading (e.g., VSCode)
            // IMPORTANT: Add extra 500ms to ensure restore happens BEFORE save
            // Restore runs at titleStabilizationDelay, save runs at titleStabilizationDelay + 500
            const saveDelay = titleStabilizationDelay + 500;
            global.log(`${UUID}: Delaying initial save for ${wmClass} by ${saveDelay}ms (after restore)`);
            Mainloop.timeout_add(saveDelay, () => {
                if (this._trackedWindows.has(metaWindow)) {
                    this._onWindowChanged(metaWindow);
                }
                return false;
            });
        } else {
            // Save initial position immediately
            this._onWindowChanged(metaWindow);
        }
    }

    /**
     * Stop tracking a specific window
     */
    _untrackWindow(metaWindow) {
        const signalIds = this._trackedWindows.get(metaWindow);
        if (signalIds) {
            signalIds.forEach(id => {
                try {
                    metaWindow.disconnect(id);
                } catch (e) {
                    // Ignore
                }
            });
            this._trackedWindows.delete(metaWindow);
        }

        // NOTE: We NO LONGER remove windows from storage here!
        // This caused data loss during Cinnamon restart (Alt+F2 r) because
        // windows are briefly "unmanaged" but reappear immediately.
        //
        // Instead, orphaned instances are cleaned up by cleanupOrphanedInstances()
        // which is called periodically by the auto-save callback.
        // That method compares saved instances against actually running windows.
        //
        // This is safer because:
        // 1. Cinnamon restart: windows reappear, no cleanup needed
        // 2. Logout: we want to KEEP the saved state
        // 3. User closes window: cleanup happens on next periodic save
        const wmClass = metaWindow.get_wm_class();
        if (wmClass) {
            global.log(`${UUID}: Window ${wmClass} untracked (cleanup deferred to periodic save)`);
        }
    }

    /**
     * Handle new window creation
     */
    _onWindowCreated(display, metaWindow) {
        // Wait a bit for window to fully initialize
        Mainloop.timeout_add(100, () => {
            if (!this._windowFilter.shouldTrack(metaWindow)) {
                return false;
            }

            this._trackWindow(metaWindow);

            // Check if this window was launched by our session launcher
            // This returns {instance, instanceId} if it was launched by us, null otherwise
            const launchResult = this._sessionLauncher ?
                                    this._sessionLauncher.checkPendingLaunch(metaWindow) : null;

            // Pass the launched instance directly to restore (avoids mismatches)
            // Only set isNewWindow=true for auto-launched windows (minimize before repositioning)
            const launchedInstance = launchResult ? launchResult.instance : null;
            const instanceId = launchResult ? launchResult.instanceId : null;

            // Check if plugin specifies title stabilization delay (for apps like VSCode that
            // change their title after loading a project)
            const wmClass = metaWindow.get_wm_class();
            let titleStabilizationDelay = 0;
            if (this._pluginManager && wmClass) {
                const plugin = this._pluginManager.getPlugin(wmClass);
                if (plugin && plugin.features && plugin.features.titleStabilizationDelay) {
                    titleStabilizationDelay = plugin.features.titleStabilizationDelay;
                    global.log(`${UUID}: ${wmClass} has titleStabilizationDelay: ${titleStabilizationDelay}ms`);
                }
            }

            if (titleStabilizationDelay > 0 && !launchedInstance) {
                // Wait for title to stabilize before matching (for single-instance apps
                // where VSCode opens additional windows without pendingLaunch)
                global.log(`${UUID}: Waiting ${titleStabilizationDelay}ms for ${wmClass} title to stabilize`);
                Mainloop.timeout_add(titleStabilizationDelay, () => {
                    if (!metaWindow || metaWindow.is_on_all_workspaces === undefined) {
                        return false; // Window was destroyed
                    }
                    this._positionRestorer.tryRestorePosition(metaWindow, true, null, null);
                    return false;
                });
            } else {
                this._positionRestorer.tryRestorePosition(metaWindow, launchedInstance !== null, launchedInstance, instanceId);
            }

            return false;
        });
    }

    /**
     * Handle window position/size changes
     * Now uses dirty-flag system: just marks window as dirty, actual save happens in bulk
     */
    _onWindowChanged(metaWindow) {
        if (!this._windowFilter.shouldTrack(metaWindow)) return;

        // Don't save ANY window state during session restore or shutdown
        if (this._isRestoringSession || this._isShuttingDown) {
            return;
        }

        // Mark window as dirty - will be processed in next auto-save cycle
        this._dirtyWindows.add(metaWindow);
    }

    /**
     * Actually save window state to storage (called from auto-save for dirty windows)
     */
    _saveWindowStateInternal(metaWindow) {
        if (!this._windowFilter.shouldTrack(metaWindow)) return;

        const wmClass = metaWindow.get_wm_class();
        const title = metaWindow.get_title() || '';
        const rect = metaWindow.get_frame_rect();
        const workspace = metaWindow.get_workspace();
        const workspaceIndex = workspace ? workspace.index() : 0;
        const monitorIndex = metaWindow.get_monitor();

        // Check if we should track this workspace
        if (!this._preferences.shouldTrackAllWorkspaces()) {
            const currentWorkspace = global.workspace_manager.get_active_workspace();
            const currentWorkspaceIndex = currentWorkspace ? currentWorkspace.index() : 0;
            if (workspaceIndex !== currentWorkspaceIndex) {
                return;
            }
        }

        const isMaximized = metaWindow.get_maximized() === Meta.MaximizeFlags.BOTH;
        const monitorGeom = global.display.get_monitor_geometry(monitorIndex);
        const monitorId = this._monitorManager ? this._monitorManager.getMonitorId(monitorIndex) : `index:${monitorIndex}`;

        const geometryPercent = {
            x: (rect.x - monitorGeom.x) / monitorGeom.width,
            y: (rect.y - monitorGeom.y) / monitorGeom.height,
            width: rect.width / monitorGeom.width,
            height: rect.height / monitorGeom.height
        };

        let appData = this._storage.getApp(wmClass);
        if (!appData) {
            appData = {
                wm_class: wmClass,
                desktop_file: this._findDesktopFile(metaWindow),
                desktop_exec: this._findDesktopExec(metaWindow),
                instances: []
            };
        }

        const instanceData = this._windowMatcher.findOrCreateInstance(metaWindow, appData);

        instanceData.title_snapshot = title;
        instanceData.monitor_index = monitorIndex;
        instanceData.monitor_id = monitorId;
        instanceData.geometry_percent = geometryPercent;
        instanceData.geometry_absolute = {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
        };
        instanceData.workspace = workspaceIndex;
        instanceData.maximized = isMaximized;
        instanceData.stable_sequence = metaWindow.get_stable_sequence();
        instanceData.x11_window_id = this._getX11WindowId(metaWindow);

        if (this._preferences.shouldRememberSticky()) {
            instanceData.sticky = metaWindow.is_on_all_workspaces();
        }
        if (this._preferences.shouldRememberShaded()) {
            instanceData.shaded = metaWindow.shaded || false;
        }
        if (this._preferences.shouldRememberAlwaysOnTop()) {
            instanceData.alwaysOnTop = metaWindow.is_above();
        }
        if (this._preferences.shouldRememberFullscreen()) {
            instanceData.fullscreen = metaWindow.is_fullscreen();
        }
        instanceData.skipTaskbar = metaWindow.is_skip_taskbar();
        instanceData.minimized = metaWindow.minimized;

        // cmdline is already cached from initial track, don't re-read
        this._storage.setApp(wmClass, appData);
    }

    /**
     * Handle monitor configuration changes
     */
    _onMonitorsChanged() {
        global.log(`${UUID}: Monitor configuration changed`);
        // Could trigger re-evaluation of window positions here
    }

    /**
     * Handle title change - rescan documents when title changes
     * Title change often indicates user opened a different file
     */
    _onTitleChanged(metaWindow) {
        const wmClass = metaWindow.get_wm_class();
        if (!wmClass) return;

        // Rescan fd/ on title change (any app might have opened a document)
        const pid = metaWindow.get_pid();
        if (pid && pid > 0) {
            const appData = this._storage.getApp(wmClass);
            if (appData) {
                const instanceData = this._windowMatcher.findOrCreateInstance(metaWindow, appData);
                this._processCapture.captureOpenDocuments(pid, wmClass, instanceData);
                this._storage.setApp(wmClass, appData);
            }
        }

        // Always update window state on title change
        this._onWindowChanged(metaWindow);
    }

    /**
     * Get X11 window ID
     */
    _getX11WindowId(metaWindow) {
        try {
            const desc = metaWindow.get_description();
            if (desc && desc.startsWith('0x')) {
                return desc;
            }
        } catch (e) {
            // Ignore
        }
        return null;
    }

    /**
     * Find desktop file for a window
     */
    _findDesktopFile(metaWindow) {
        try {
            const tracker = Cinnamon.WindowTracker.get_default();
            const app = tracker.get_window_app(metaWindow);
            if (app) {
                const appInfo = app.get_app_info();
                if (appInfo) {
                    return appInfo.get_id();
                }
            }
        } catch (e) {
            global.logError(`${UUID}: Failed to find desktop file: ${e}`);
        }
        return null;
    }

    /**
     * Find desktop exec command for a window
     */
    _findDesktopExec(metaWindow) {
        try {
            const tracker = Cinnamon.WindowTracker.get_default();
            const app = tracker.get_window_app(metaWindow);
            if (app) {
                const appInfo = app.get_app_info();
                if (appInfo) {
                    return appInfo.get_commandline();
                }
            }
        } catch (e) {
            // Ignore
        }
        return null;
    }

    /**
     * Reset all instance assignments (for session restore)
     * Note: We keep X11 IDs and stable sequences - they'll be updated if windows reappear
     * This preserves title_snapshot as primary identifier after restart
     */
    resetAssignments() {
        const apps = this._storage.getAllApps();
        for (const wmClass in apps) {
            const appData = apps[wmClass];
            if (appData.instances) {
                for (const instance of appData.instances) {
                    instance.assigned = false;
                    // DON'T clear X11 IDs/sequences - keep them for logging/debugging
                    // If they're stale, the matching will fall back to title_snapshot
                }
            }
        }
        global.log(`${UUID}: Reset all instance assignments (kept IDs for matching)`);
    }

    /**
     * Get statistics about tracked windows
     */
    getStats() {
        const apps = this._storage.getAllApps();
        let totalApps = Object.keys(apps).length;
        let totalInstances = 0;

        for (const wmClass in apps) {
            if (apps[wmClass].instances) {
                totalInstances += apps[wmClass].instances.length;
            }
        }

        return {
            trackedWindows: this._trackedWindows.size,
            savedApps: totalApps,
            savedInstances: totalInstances
        };
    }

    /**
     * Save only DIRTY windows to storage (optimized auto-save)
     * Called periodically by auto-save - only processes windows that changed
     */
    _saveAllOpenWindows() {
        const dirtyCount = this._dirtyWindows.size;

        if (dirtyCount === 0) {
            // Nothing changed, skip save entirely
            return;
        }

        // Process only dirty windows
        for (const metaWindow of this._dirtyWindows) {
            try {
                // Window might have been destroyed since marked dirty
                if (metaWindow && metaWindow.get_wm_class) {
                    this._saveWindowStateInternal(metaWindow);
                }
            } catch (e) {
                // Window was destroyed, ignore
            }
        }

        // Clear dirty set
        this._dirtyWindows.clear();

        // Update monitor layout before save
        if (this._monitorManager) {
            this._storage.updateMonitorLayout(this._monitorManager);
        }

        global.log(`${UUID}: Saved ${dirtyCount} dirty windows`);
    }

    /**
     * Save state of a single window (legacy compatibility)
     * @deprecated Use _saveWindowStateInternal via dirty-flag system
     */
    _saveWindowState(metaWindow) {
        this._saveWindowStateInternal(metaWindow);
    }
};
