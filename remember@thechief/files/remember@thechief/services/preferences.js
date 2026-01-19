/**
 * Preferences Module
 *
 * Manages user preferences for window tracking and restoration behavior.
 * Loads preferences from ~/.config/remember@thechief/preferences.json
 * Created and managed by Python Settings UI, read-only from JavaScript.
 */

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const UUID = "remember@thechief";

// Default preferences (matches preferences.py defaults)
const DEFAULT_PREFERENCES = {
    rememberSticky: true,           // Save/restore "on all workspaces" state
    rememberAlwaysOnTop: true,      // Save/restore "always on top" state
    rememberShaded: false,          // Save/restore rolled-up (shaded) state
    rememberFullscreen: true,       // Save/restore fullscreen mode
    restoreMinimized: false,        // Restore windows in minimized state
    trackDialogs: false,            // Track dialog windows (not recommended)
    trackAllWorkspaces: true,       // Track windows across all workspaces
    autoRestore: true,              // Auto-restore positions on window open
    clampToScreen: true,            // Ensure windows stay within screen bounds
    restoreWorkspace: true          // Move restored windows to original workspace
};

/**
 * Preferences Class
 * Loads and provides access to user preferences
 */
var Preferences = class Preferences {
    constructor() {
        this._configDir = GLib.build_filenamev([
            GLib.get_home_dir(), '.config', UUID
        ]);
        this._configFile = GLib.build_filenamev([
            this._configDir, 'preferences.json'
        ]);
        this._prefs = null;
        this._fileMonitor = null;
        this._reloadTimeoutId = null;
    }

    /**
     * Initialize and load preferences
     */
    init() {
        this._ensureConfigDir();
        this._load();
        this._setupFileMonitor();
    }

    /**
     * Ensure config directory exists
     */
    _ensureConfigDir() {
        const dir = Gio.File.new_for_path(this._configDir);
        if (!dir.query_exists(null)) {
            try {
                dir.make_directory_with_parents(null);
                global.log(`${UUID}: Created config directory: ${this._configDir}`);
            } catch (e) {
                global.logError(`${UUID}: Failed to create config directory: ${e}`);
            }
        }
    }

    /**
     * Load preferences from disk
     */
    _load() {
        const file = Gio.File.new_for_path(this._configFile);

        if (!file.query_exists(null)) {
            this._prefs = Object.assign({}, DEFAULT_PREFERENCES);
            global.log(`${UUID}: No preferences.json found, using defaults`);
            return;
        }

        try {
            const [success, contents] = file.load_contents(null);
            if (success) {
                const text = imports.byteArray.toString(contents);
                const loaded = JSON.parse(text);

                // Merge with defaults (handles missing keys gracefully)
                this._prefs = Object.assign({}, DEFAULT_PREFERENCES, loaded);
                global.log(`${UUID}: Loaded preferences from ${this._configFile}`);
            }
        } catch (e) {
            global.logError(`${UUID}: Failed to load preferences: ${e}`);
            this._prefs = Object.assign({}, DEFAULT_PREFERENCES);
        }
    }

    /**
     * Get a preference value (returns boolean)
     */
    get(key) {
        if (!this._prefs) {
            return DEFAULT_PREFERENCES[key] === true;
        }
        return this._prefs[key] === true;  // Explicit boolean coercion
    }

    /**
     * Convenience methods for readability in code
     */
    shouldRememberSticky() {
        return this.get('rememberSticky');
    }

    shouldRememberAlwaysOnTop() {
        return this.get('rememberAlwaysOnTop');
    }

    shouldRememberShaded() {
        return this.get('rememberShaded');
    }

    shouldRememberFullscreen() {
        return this.get('rememberFullscreen');
    }

    shouldRestoreMinimized() {
        return this.get('restoreMinimized');
    }

    shouldTrackDialogs() {
        return this.get('trackDialogs');
    }

    shouldTrackAllWorkspaces() {
        return this.get('trackAllWorkspaces');
    }

    shouldAutoRestore() {
        return this.get('autoRestore');
    }

    shouldClampToScreen() {
        return this.get('clampToScreen');
    }

    shouldRestoreWorkspace() {
        return this.get('restoreWorkspace');
    }

    /**
     * Get all preferences (for debugging)
     */
    getAll() {
        return this._prefs || DEFAULT_PREFERENCES;
    }

    /**
     * Setup file monitor for hot-reload
     */
    _setupFileMonitor() {
        try {
            const file = Gio.File.new_for_path(this._configFile);
            this._fileMonitor = file.monitor_file(Gio.FileMonitorFlags.NONE, null);

            this._fileMonitor.connect('changed', (monitor, file, otherFile, eventType) => {
                if (eventType === Gio.FileMonitorEvent.CHANGES_DONE_HINT) {
                    // Debounce reload (wait 1s for write to complete)
                    if (this._reloadTimeoutId) {
                        GLib.source_remove(this._reloadTimeoutId);
                    }

                    this._reloadTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
                        this._reloadTimeoutId = null;
                        this._reload();
                        return GLib.SOURCE_REMOVE;
                    });
                }
            });

            global.log(`${UUID}: File monitor active for preferences.json`);
        } catch (e) {
            global.logError(`${UUID}: Failed to setup file monitor: ${e}`);
        }
    }

    /**
     * Reload preferences from disk
     */
    _reload() {
        global.log(`${UUID}: Reloading preferences...`);
        const oldPrefs = JSON.stringify(this._prefs);
        this._load();
        const newPrefs = JSON.stringify(this._prefs);

        if (oldPrefs !== newPrefs) {
            global.log(`${UUID}: Preferences changed`);
        }
    }

    /**
     * Cleanup on destroy
     */
    destroy() {
        if (this._fileMonitor) {
            this._fileMonitor.cancel();
            this._fileMonitor = null;
        }
        if (this._reloadTimeoutId) {
            GLib.source_remove(this._reloadTimeoutId);
            this._reloadTimeoutId = null;
        }
    }
};
