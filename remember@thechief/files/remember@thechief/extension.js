/**
 * Window Position Remember Extension
 *
 * Main extension entry point. Imports modules and coordinates components.
 *
 * Saves and restores window positions across sessions and monitors.
 * Supports multi-monitor setups with EDID identification.
 */

const Main = imports.ui.main;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;

const UUID = "remember@thechief";

// Initialize gettext for translations
Gettext.bindtextdomain(UUID, GLib.build_filenamev([GLib.get_home_dir(), '.local', 'share', 'locale']));

function _(str) {
    return Gettext.dgettext(UUID, str);
}

// NOTE: Session config moved to config.js (SESSION_LAUNCH_CONFIG)
// Loaded dynamically in enable() and passed to SessionLauncher

// Get extension path for imports
let extensionPath = null;

function getExtensionModule(moduleName) {
    if (!extensionPath) {
        extensionPath = GLib.build_filenamev([
            GLib.get_home_dir(), '.local', 'share', 'cinnamon', 'extensions', UUID
        ]);
    }

    imports.searchPath.unshift(extensionPath);
    try {
        const module = imports[moduleName];
        return module;
    } finally {
        // ALWAYS clean up, even if import throws
        imports.searchPath.shift();
    }
}

// Extension state
let extension = null;

/**
 * Main Extension Class
 */
class WindowRememberExtension {
    constructor() {
        this._storage = null;
        this._monitorManager = null;
        this._tracker = null;
        this._launcher = null;
        this._enabled = false;
        this._extPath = null;
        this._sessionClient = null;
        this._appletManager = null;
        this._autoRestore = null;
    }

    /**
     * Initialize extension (called once)
     */
    init(meta) {
        this._meta = meta;
        this._extPath = meta.path;
        global.log(`${UUID}: Extension initialized at ${this._extPath}`);

        // Load core modules via modules.js for AppletManager (needed early)
        const modulesModule = getExtensionModule('modules');
        const Modules = modulesModule.Modules;

        const { AppletManager } = Modules.load(this._meta, 'core', 'appletManager');

        // Initialize AppletManager and install applet if needed
        this._appletManager = new AppletManager(this._extPath);
        this._appletManager.installIfNeeded();
    }

    /**
     * Enable extension
     */
    enable() {
        if (this._enabled) return;

        global.log(`${UUID}: Enabling extension...`);

        // Reset shutdown flag
        this._isShuttingDown = false;

        // Load logger module FIRST (used by other modules)
        const { Logger } = getExtensionModule('services/logger');
        this._logger = new Logger();

        // Load modules dynamically
        const { Storage } = getExtensionModule('services/storage');
        const { MonitorManager } = getExtensionModule('services/monitorManager');
        const { SessionLauncher } = getExtensionModule('sessionLauncher');
        const { WindowTracker } = getExtensionModule('windowTracker');
        const { ExtensionSettings } = getExtensionModule('services/extensionSettings');
        const { Preferences } = getExtensionModule('services/preferences');
        const { PluginManager } = getExtensionModule('pluginManager');

        // Load core modules via modules.js
        const modulesModule = getExtensionModule('modules');
        const Modules = modulesModule.Modules;

        const { AutoRestore } = Modules.load(this._meta, 'core', 'autoRestore');

        // Load centralized config
        const configModule = getExtensionModule('config');
        this._sessionConfig = configModule.SESSION_LAUNCH_CONFIG;
        this._singleInstanceConfig = {
            apps: configModule.SINGLE_INSTANCE_APPS,
            timeout: configModule.SINGLE_INSTANCE_TIMEOUT,
            gracePeriod: configModule.SINGLE_INSTANCE_GRACE_PERIOD
        };

        // Initialize storage (inject logger)
        this._storage = new Storage();
        this._storage._logger = this._logger; // Inject logger for sanitized logging
        this._storage.init();

        // Initialize preferences (for window tracking behavior)
        this._preferences = new Preferences();
        this._preferences.init();

        // Initialize extension settings (for launch flags, etc.)
        this._extensionSettings = new ExtensionSettings();
        this._extensionSettings.init();

        // Initialize plugin manager for app-specific launch handling
        this._pluginManager = new PluginManager(this._extPath, this._extensionSettings, this._storage);
        this._pluginManager.loadPlugins();
        global.log(`${UUID}: PluginManager initialized with ${this._pluginManager.getLoadedPlugins().length} plugins`);

        // BLOCK ALL SAVES until restore completes
        this._storage.blockSaves();

        // Initialize monitor manager
        this._monitorManager = new MonitorManager(this._storage);
        this._monitorManager.enable();

        // Initialize window tracker (with preferences for conditional behavior)
        // Pass extensionMeta for loading core modules via modules.js
        this._tracker = new WindowTracker(this._storage, this._monitorManager, this._preferences, this._meta);
        this._tracker._logger = this._logger; // Inject logger for sanitized logging
        this._tracker.resetAssignments();

        // Set restore flag BEFORE enabling tracker to prevent saving stale positions
        // This will be cleared after session restore completes (60s timeout)
        this._tracker._isRestoringSession = true;

        this._tracker.enable();

        // Initialize session launcher (inject extension settings, plugin manager, config, and logger)
        this._launcher = new SessionLauncher(
            this._storage,
            this._tracker,
            this._extensionSettings,
            this._pluginManager,
            this._sessionConfig,
            this._singleInstanceConfig
        );
        this._launcher._logger = this._logger; // Inject logger for sanitized logging
        this._tracker.setSessionLauncher(this._launcher);
        this._tracker.setPluginManager(this._pluginManager);

        // Initialize AutoRestore module
        this._autoRestore = new AutoRestore({
            tracker: this._tracker,
            storage: this._storage,
            preferences: this._preferences,
            launcher: this._launcher,
            pluginManager: this._pluginManager,
            sessionConfig: this._sessionConfig
        });

        // Expose global API for applet
        Main.windowRemember = {
            saveAll: () => this._saveAll(),
            restoreAll: () => this._restoreAll(),
            launchSession: () => this._launchSession(),
            toggle: () => this._toggle(),
            getStats: () => this._getStats(),
            isEnabled: () => this._enabled,
            getMonitors: () => this._monitorManager ? this._monitorManager.getAllMonitors() : [],
            closeWindow: (x11WindowId) => this._closeWindow(x11WindowId)
        };

        this._enabled = true;
        global.log(`${UUID}: Extension enabled`);

        // Schedule auto-restore after startup delay
        this._autoRestore.scheduleAutoRestore();
    }

    /**
     * Disable extension
     */
    disable() {
        if (!this._enabled) return;

        global.log(`${UUID}: Disabling extension...`);

        // CRITICAL: Set shutdown flag FIRST to stop all saves immediately
        // This prevents saving partial state as windows close during logout
        this._isShuttingDown = true;
        if (this._tracker) {
            this._tracker._isShuttingDown = true;
        }

        // BACKUP: Create timestamped backup of positions.json before shutdown
        // This allows debugging session restore issues by comparing before/after state
        if (this._storage) {
            this._storage.backupPositions();
        }

        // Stop auto-save timer immediately
        if (this._storage) {
            this._storage.stopAutoSave();
        }

        // Cancel pending auto-restore timeouts
        if (this._autoRestore) {
            this._autoRestore.destroy();
            this._autoRestore = null;
        }


        // Remove applet from panel
        if (this._appletManager) {
            this._appletManager.deactivate();
        }

        // Remove global API
        if (Main.windowRemember) {
            delete Main.windowRemember;
        }

        // CRITICAL: Disable tracker FIRST to disconnect signals
        // This prevents _untrackWindow() from deleting instances during logout
        if (this._tracker) {
            this._tracker.disable();
        }

        // NOTE: No final save here - we already have the last good state saved
        // Saving now would capture partial state as windows are closing

        // Cleanup launcher
        if (this._launcher) {
            this._launcher.destroy();
            this._launcher = null;
        }

        // Cleanup tracker
        if (this._tracker) {
            this._tracker = null;
        }

        // Disable monitor manager
        if (this._monitorManager) {
            this._monitorManager.disable();
            this._monitorManager = null;
        }

        // Cleanup storage
        if (this._storage) {
            this._storage.destroy();
            this._storage = null;
        }

        // Cleanup preferences
        if (this._preferences) {
            this._preferences.destroy();
            this._preferences = null;
        }

        // Cleanup extension settings
        if (this._extensionSettings) {
            this._extensionSettings.destroy();
            this._extensionSettings = null;
        }

        // Cleanup plugin manager
        if (this._pluginManager) {
            this._pluginManager.destroy();
            this._pluginManager = null;
        }

        this._enabled = false;
        global.log(`${UUID}: Extension disabled`);
    }

    /**
     * Save ALL currently open windows to storage
     * Called after session restore completes to capture any new windows
     */
    _saveAllWindows() {
        if (!this._tracker || !this._storage) return;

        let savedCount = 0;
        global.get_window_actors().forEach(actor => {
            const metaWindow = actor.get_meta_window();
            if (metaWindow && this._tracker._windowFilter.shouldTrack(metaWindow)) {
                // Call _onWindowChanged to save the window state
                this._tracker._onWindowChanged(metaWindow);
                savedCount++;
            }
        });

        this._storage.save();
        global.log(`${UUID}: Full save completed - ${savedCount} windows saved`);
    }

    /**
     * Force save all window positions
     */
    _saveAll() {
        if (!this._storage) return;
        this._storage.save();
        const stats = this._getStats();
        global.log(`${UUID}: Force saved all positions`);
        const message = _("Saved %d window positions").replace('%d', stats.savedInstances);
        Main.notify(_("Window Remember"), message);
    }

    /**
     * Restore all window positions
     */
    _restoreAll() {
        if (!this._tracker) return;
        this._tracker.resetAssignments();

        let restoredCount = 0;

        // Re-apply positions to all tracked windows
        global.get_window_actors().forEach(actor => {
            const metaWindow = actor.get_meta_window();
            if (metaWindow && this._tracker._windowFilter.shouldTrack(metaWindow)) {
                // isNewWindow = false: manual restore, don't minimize existing windows
                this._tracker._positionRestorer.tryRestorePosition(metaWindow, false);
                restoredCount++;
            }
        });

        global.log(`${UUID}: Restored ${restoredCount} window positions`);
        const message = _("Restored %d window positions").replace('%d', restoredCount);
        Main.notify(_("Window Remember"), message);
    }

    /**
     * Launch saved session (start apps and restore positions)
     */
    _launchSession() {
        if (!this._launcher) return;

        this._tracker.resetAssignments();
        const count = this._launcher.launchSession();
        const message = _("Launching %d applications...").replace('%d', count);
        Main.notify(_("Window Remember"), message);
    }

    /**
     * Close a window by X11 Window ID
     * Called from settings dialog when user deletes a window
     */
    _closeWindow(x11WindowId) {
        if (!this._tracker) {
            global.logError(`${UUID}: Cannot close window - tracker not initialized`);
            return false;
        }

        // Find the window by X11 ID
        let foundWindow = null;
        global.get_window_actors().forEach(actor => {
            const metaWindow = actor.get_meta_window();
            if (metaWindow) {
                const windowXid = this._tracker._getX11WindowId(metaWindow);
                if (windowXid === x11WindowId) {
                    foundWindow = metaWindow;
                }
            }
        });

        if (!foundWindow) {
            global.log(`${UUID}: Window ${x11WindowId} not found, may already be closed`);
            return false;
        }

        // Close the window
        try {
            const wmClass = foundWindow.get_wm_class();
            const title = foundWindow.get_title();
            foundWindow.delete(global.get_current_time());
            global.log(`${UUID}: Closed window ${wmClass} - ${title} (${x11WindowId})`);
            return true;
        } catch (e) {
            global.logError(`${UUID}: Failed to close window ${x11WindowId}: ${e}`);
            return false;
        }
    }

    /**
     * Get combined statistics
     */
    _getStats() {
        const trackerStats = this._tracker ? this._tracker.getStats() : {};
        const launcherStats = this._launcher ? this._launcher.getStats() : {};
        const monitorCount = this._monitorManager ? this._monitorManager.getMonitorCount() : 0;

        return {
            ...trackerStats,
            ...launcherStats,
            monitors: monitorCount
        };
    }

    /**
     * Toggle extension on/off
     */
    _toggle() {
        if (this._enabled) {
            this.disable();
        } else {
            this.enable();
        }
        return this._enabled;
    }
}

/**
 * Extension entry points
 */
function init(meta) {
    extension = new WindowRememberExtension();
    extension.init(meta);
}

function enable() {
    if (extension) {
        extension.enable();
    }
}

function disable() {
    if (extension) {
        extension.disable();
    }
}
