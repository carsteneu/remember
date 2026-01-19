/**
 * Extension Settings Module
 *
 * Manages extension-specific settings like launch flags for apps.
 * Separate from Cinnamon's settings-schema.json to allow runtime changes.
 */

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const UUID = "remember@thechief";

/**
 * Extension Settings Class
 */
var ExtensionSettings = class ExtensionSettings {
    constructor() {
        this._configDir = GLib.build_filenamev([
            GLib.get_home_dir(), '.config', UUID
        ]);
        this._configFile = GLib.build_filenamev([
            this._configDir, 'extension-settings.json'
        ]);
        this._settings = null;
        this._fileMonitor = null;
        this._reloadTimeoutId = null;
    }

    /**
     * Initialize and load settings
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
     * Load settings from disk
     */
    _load() {
        const file = Gio.File.new_for_path(this._configFile);

        if (!file.query_exists(null)) {
            this._settings = this._createDefaultSettings();
            this._save();
            global.log(`${UUID}: Created default extension settings`);
            return;
        }

        try {
            const [success, contents] = file.load_contents(null);
            if (success) {
                const text = imports.byteArray.toString(contents);
                this._settings = JSON.parse(text);
                global.log(`${UUID}: Loaded extension settings`);
            }
        } catch (e) {
            global.logError(`${UUID}: Failed to load extension settings: ${e}`);
            this._settings = this._createDefaultSettings();
        }
    }

    /**
     * Create default settings
     */
    _createDefaultSettings() {
        return {
            launchFlags: {
                browserSessionRestore: true,    // Brave/Chrome --restore-last-session
                firefoxSessionRestore: true,    // Firefox --restore-session
                kateSessionRestore: true,       // Kate -s default
                jetbrainsRestore: true          // JetBrains IDEs (automatic)
            }
        };
    }

    /**
     * Save settings to disk
     */
    _save() {
        if (!this._settings) return;

        try {
            const file = Gio.File.new_for_path(this._configFile);
            const contents = JSON.stringify(this._settings, null, 2);
            file.replace_contents(
                contents,
                null,
                false,
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null
            );
            global.log(`${UUID}: Saved extension settings`);
        } catch (e) {
            global.logError(`${UUID}: Failed to save extension settings: ${e}`);
        }
    }

    /**
     * Get a setting value
     */
    get(key) {
        const keys = key.split('.');
        let value = this._settings;
        for (const k of keys) {
            if (value && typeof value === 'object') {
                value = value[k];
            } else {
                return null;
            }
        }
        return value;
    }

    /**
     * Set a setting value
     */
    set(key, value) {
        const keys = key.split('.');
        const lastKey = keys.pop();
        let target = this._settings;

        for (const k of keys) {
            if (!target[k]) {
                target[k] = {};
            }
            target = target[k];
        }

        target[lastKey] = value;
        this._save();
    }

    /**
     * Check if browser session restore is enabled
     */
    useBrowserSessionRestore() {
        return this.get('launchFlags.browserSessionRestore') !== false;
    }

    /**
     * Check if Firefox session restore is enabled
     */
    useFirefoxSessionRestore() {
        return this.get('launchFlags.firefoxSessionRestore') !== false;
    }

    /**
     * Check if Kate session restore is enabled
     */
    useKateSessionRestore() {
        return this.get('launchFlags.kateSessionRestore') !== false;
    }

    /**
     * Check if JetBrains restore is enabled
     */
    useJetBrainsRestore() {
        return this.get('launchFlags.jetbrainsRestore') !== false;
    }

    /**
     * Get all settings (for debugging)
     */
    getAll() {
        return this._settings;
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

            global.log(`${UUID}: File monitor active for extension-settings.json`);
        } catch (e) {
            global.logError(`${UUID}: Failed to setup file monitor: ${e}`);
        }
    }

    /**
     * Reload settings from disk
     */
    _reload() {
        global.log(`${UUID}: Reloading extension settings...`);
        const oldSettings = JSON.stringify(this._settings);
        this._load();
        const newSettings = JSON.stringify(this._settings);

        if (oldSettings !== newSettings) {
            global.log(`${UUID}: Extension settings changed`);
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
