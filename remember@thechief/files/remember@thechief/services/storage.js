/**
 * Storage Module for Window Position Remember Extension
 *
 * Handles persistent storage of window positions and monitor data.
 */

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;

const UUID = "remember@thechief";

const CONFIG = {
    SAVE_DELAY: 1000,
    DATA_VERSION: 4
};

/**
 * JSON Storage Class
 * Handles persistent storage of window positions
 */
var Storage = class Storage {
    constructor() {
        this._configDir = GLib.build_filenamev([
            GLib.get_home_dir(), '.config', UUID
        ]);
        this._configFile = GLib.build_filenamev([
            this._configDir, 'positions.json'
        ]);
        this._data = null;
        this._monitorLayout = null;  // Current monitor layout for matching
        this._saveTimeoutId = null;
        this._autoSaveIntervalId = null;
    }

    /**
     * Initialize storage and load existing data
     */
    init() {
        this._isShuttingDown = false;  // Reset shutdown flag on startup
        this._ensureConfigDir();
        this._hardenAllConfigFiles(); // Secure all config files on startup
        this._load();
        this._startAutoSave();
    }

    /**
     * Harden permissions on all config files (migration)
     */
    _hardenAllConfigFiles() {
        const configFiles = [
            'positions.json',
            'extension-settings.json',
            'preferences.json',
            'progress-status.json'
        ];

        for (const filename of configFiles) {
            const filePath = GLib.build_filenamev([this._configDir, filename]);
            const file = Gio.File.new_for_path(filePath);

            if (file.query_exists(null)) {
                this._hardenPermissions(filePath, false);
            }
        }
    }

    /**
     * Set callback for auto-save (allows WindowTracker to cleanup before save)
     */
    setAutoSaveCallback(callback) {
        this._autoSaveCallback = callback;
    }

    /**
     * Start periodic auto-save (every 30 seconds)
     * Note: Most state changes are captured via window signals (position-changed, etc.)
     * Auto-save is just a safety net to persist accumulated changes
     */
    _startAutoSave() {
        // Save every 30 seconds - calls full-save callback to capture all windows
        this._autoSaveIntervalId = Mainloop.timeout_add_seconds(30, () => {
            // Call full-save callback if set (saves ALL open windows)
            // The callback decides whether to save based on restore/shutdown state
            // Returns true if save should proceed, false if skipped
            if (this._autoSaveCallback) {
                const shouldSave = this._autoSaveCallback();
                if (shouldSave !== false) {
                    this.save();
                }
            } else {
                this.save();
            }
            return true; // Keep the timer running
        });
    }

    /**
     * Stop periodic auto-save (internal)
     */
    _stopAutoSave() {
        if (this._autoSaveIntervalId) {
            Mainloop.source_remove(this._autoSaveIntervalId);
            this._autoSaveIntervalId = null;
        }
    }

    /**
     * Stop auto-save (public method for shutdown)
     * Also sets shutdown flag to prevent any further saves
     */
    stopAutoSave() {
        global.log(`${UUID}: Stopping auto-save (shutdown detected)`);
        this._isShuttingDown = true;  // Block ALL future saves
        this._stopAutoSave();
        // Also cancel any pending save
        if (this._saveTimeoutId) {
            Mainloop.source_remove(this._saveTimeoutId);
            this._saveTimeoutId = null;
        }
    }

    /**
     * Ensure config directory exists with secure permissions
     */
    _ensureConfigDir() {
        const dir = Gio.File.new_for_path(this._configDir);
        if (!dir.query_exists(null)) {
            try {
                dir.make_directory_with_parents(null);
                global.log(`${UUID}: Created config directory: ${this._configDir}`);

                // Harden permissions: 0700 (user-only access)
                this._hardenPermissions(this._configDir, true);
            } catch (e) {
                global.logError(`${UUID}: Failed to create config directory: ${e}`);
            }
        } else {
            // Verify and fix permissions on existing directory
            this._hardenPermissions(this._configDir, true);
        }
    }

    /**
     * Set restrictive permissions on file or directory
     * @param {string} path - Path to file or directory
     * @param {boolean} isDirectory - True if path is a directory
     */
    _hardenPermissions(path, isDirectory) {
        try {
            const mode = isDirectory ? 0o700 : 0o600;

            // Use GLib.chmod if available
            if (typeof GLib.chmod === 'function') {
                GLib.chmod(path, mode);
            } else {
                // Fallback: use shell command
                const modeStr = isDirectory ? '700' : '600';
                GLib.spawn_command_line_sync(`chmod ${modeStr} "${path}"`);
            }

            global.log(`${UUID}: Set permissions ${mode.toString(8)} on ${path}`);
        } catch (e) {
            global.logError(`${UUID}: Failed to set permissions on ${path}: ${e}`);
        }
    }

    /**
     * Load data from disk
     */
    _load() {
        const file = Gio.File.new_for_path(this._configFile);

        if (!file.query_exists(null)) {
            this._data = this._createEmptyData();
            global.log(`${UUID}: No existing data, created empty structure`);
            return;
        }

        try {
            const [success, contents] = file.load_contents(null);
            if (success) {
                const text = imports.byteArray.toString(contents);
                this._data = JSON.parse(text);


                // Version migration if needed
                if (this._data.version !== CONFIG.DATA_VERSION) {
                    this._migrateData();
                }

                // Load monitor layout if present
                if (this._data.monitor_layout) {
                    this._monitorLayout = this._data.monitor_layout;
                    global.log(`${UUID}: Loaded monitor layout with ${this._monitorLayout.monitors?.length || 0} monitors`);
                }

                global.log(`${UUID}: Loaded ${Object.keys(this._data.applications || {}).length} applications`);
            }
        } catch (e) {
            global.logError(`${UUID}: Failed to load data: ${e}`);
            this._data = this._createEmptyData();
        }
    }

    /**
     * Create empty data structure
     */
    _createEmptyData() {
        return {
            version: CONFIG.DATA_VERSION,
            monitors: {},
            applications: {}
        };
    }

    /**
     * Migrate data from older versions
     */
    _migrateData() {
        const oldVersion = this._data.version || 1;
        global.log(`${UUID}: Migrating data from version ${oldVersion} to ${CONFIG.DATA_VERSION}`);

        // Ensure all required fields exist
        if (!this._data.monitors) this._data.monitors = {};
        if (!this._data.applications) this._data.applications = {};

        // Migration to version 3: Backfill missing instance IDs
        if (oldVersion < 3) {
            global.log(`${UUID}: Backfilling missing instance IDs`);
            let idCounter = 0;

            for (const wmClass in this._data.applications) {
                const app = this._data.applications[wmClass];
                if (app.instances) {
                    for (const instance of app.instances) {
                        if (!instance.id) {
                            // Generate deterministic ID based on position
                            instance.id = `${wmClass}-migrated-${idCounter++}`;
                            global.log(`${UUID}: Assigned ID ${instance.id}`);
                        }
                    }
                }
            }
        }

        // Migration to version 4: Add extended window states
        if (oldVersion < 4) {
            global.log(`${UUID}: Migrating to v4 - adding extended window states`);
            for (const wmClass in this._data.applications) {
                const app = this._data.applications[wmClass];
                if (app.instances) {
                    for (const instance of app.instances) {
                        // Add default values for new fields if they don't exist
                        if (instance.sticky === undefined) instance.sticky = false;
                        if (instance.shaded === undefined) instance.shaded = false;
                        if (instance.alwaysOnTop === undefined) instance.alwaysOnTop = false;
                        if (instance.fullscreen === undefined) instance.fullscreen = false;
                        if (instance.skipTaskbar === undefined) instance.skipTaskbar = false;
                        if (instance.minimized === undefined) instance.minimized = false;
                    }
                }
            }
        }

        this._data.version = CONFIG.DATA_VERSION;
        this.save();
    }

    /**
     * Save data to disk (debounced)
     * Note: This is only used for non-window data (monitors, etc.)
     * Window data is saved by the periodic full-save callback
     */
    scheduleSave() {
        if (this._saveTimeoutId) {
            Mainloop.source_remove(this._saveTimeoutId);
        }

        this._saveTimeoutId = Mainloop.timeout_add(CONFIG.SAVE_DELAY, () => {
            // Check with callback if save should proceed
            // (callback returns false during restore/shutdown)
            if (this._autoSaveCallback) {
                const shouldSave = this._autoSaveCallback();
                if (shouldSave === false) {
                    this._saveTimeoutId = null;
                    return false; // Skip save
                }
            }
            this.save();
            this._saveTimeoutId = null;
            return false;
        });
    }

    /**
     * Block all saves (used during session restore)
     */
    blockSaves() {
        this._savesBlocked = true;
        global.log(`${UUID}: Saves BLOCKED`);
    }

    /**
     * Allow saves again (after session restore)
     */
    unblockSaves() {
        this._savesBlocked = false;
        global.log(`${UUID}: Saves UNBLOCKED`);
    }

    /**
     * Update monitor layout (called before save)
     */
    updateMonitorLayout(monitorManager) {
        if (!monitorManager) return;

        const layout = monitorManager.getCurrentLayout();
        const primary = monitorManager.getPrimaryMonitor();

        this._monitorLayout = {
            timestamp: Date.now(),
            primary_connector: primary ? primary.connector : null,
            monitors: layout
        };

        // Store in data structure for persistence
        this._data.monitor_layout = this._monitorLayout;
    }

    /**
     * Get stored monitor layout
     */
    getMonitorLayout() {
        return this._monitorLayout;
    }

    /**
     * Immediately save data to disk
     */
    save() {
        if (!this._data) return;

        // Block ALL saves during restore OR shutdown
        // During shutdown, we want to preserve the last good state (from backup)
        if (this._savesBlocked || this._isShuttingDown) {
            return;
        }

        try {
            const file = Gio.File.new_for_path(this._configFile);
            const contents = JSON.stringify(this._data, null, 2);
            file.replace_contents(
                contents,
                null,
                false,
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null
            );

            // Harden file permissions after write
            this._hardenPermissions(this._configFile, false);

            global.log(`${UUID}: Saved data to ${this._configFile}`);
        } catch (e) {
            global.logError(`${UUID}: Failed to save data: ${e}`);
        }
    }

    /**
     * Get application data by wm_class
     */
    getApp(wmClass) {
        return this._data.applications[wmClass] || null;
    }

    /**
     * Set application data
     */
    setApp(wmClass, appData) {
        this._data.applications[wmClass] = appData;
        this.scheduleSave();
    }

    /**
     * Get all applications
     */
    getAllApps() {
        return this._data.applications;
    }

    /**
     * Remove an application from storage
     */
    removeApp(wmClass) {
        if (this._data.applications[wmClass]) {
            delete this._data.applications[wmClass];
            this.scheduleSave();
        }
    }

    /**
     * Get monitor data by EDID
     */
    getMonitor(edid) {
        return this._data.monitors[edid] || null;
    }

    /**
     * Set monitor data
     */
    setMonitor(edid, monitorData) {
        this._data.monitors[edid] = monitorData;
        this.scheduleSave();
    }

    /**
     * Get all monitors
     */
    getAllMonitors() {
        return this._data.monitors;
    }

    /**
     * Create backup of positions.json with timestamp
     * Called on logoff/shutdown to preserve state before session ends
     */
    backupPositions() {
        try {
            const sourceFile = Gio.File.new_for_path(this._configFile);
            if (!sourceFile.query_exists(null)) {
                global.log(`${UUID}: No positions.json to backup`);
                return;
            }

            // Create backup filename with timestamp
            const now = GLib.DateTime.new_now_local();
            const timestamp = now.format('%Y%m%d_%H%M%S');
            const backupFilename = `positions_backup_${timestamp}.json`;
            const backupPath = GLib.build_filenamev([this._configDir, backupFilename]);
            const backupFile = Gio.File.new_for_path(backupPath);

            // Copy positions.json to backup
            sourceFile.copy(
                backupFile,
                Gio.FileCopyFlags.OVERWRITE,
                null,
                null
            );

            // Also create "latest" backup (always overwritten)
            const latestBackupPath = GLib.build_filenamev([this._configDir, 'positions_backup_latest.json']);
            const latestBackupFile = Gio.File.new_for_path(latestBackupPath);
            sourceFile.copy(
                latestBackupFile,
                Gio.FileCopyFlags.OVERWRITE,
                null,
                null
            );

            global.log(`${UUID}: Backed up positions.json to ${backupFilename}`);

            // Cleanup old backups (keep only last 10)
            this._cleanupOldBackups();

        } catch (e) {
            global.logError(`${UUID}: Failed to backup positions.json: ${e}`);
        }
    }

    /**
     * Remove old backup files, keeping only the most recent 10
     */
    _cleanupOldBackups() {
        try {
            const dir = Gio.File.new_for_path(this._configDir);
            const enumerator = dir.enumerate_children(
                'standard::name,time::modified',
                Gio.FileQueryInfoFlags.NONE,
                null
            );

            const backups = [];
            let fileInfo;
            while ((fileInfo = enumerator.next_file(null)) !== null) {
                const name = fileInfo.get_name();
                if (name.startsWith('positions_backup_') && name.endsWith('.json') && name !== 'positions_backup_latest.json') {
                    const modifiedTime = fileInfo.get_modification_time().tv_sec;
                    backups.push({ name, modifiedTime });
                }
            }

            // Sort by modification time (newest first)
            backups.sort((a, b) => b.modifiedTime - a.modifiedTime);

            // Delete old backups (keep only 10 newest)
            if (backups.length > 10) {
                for (let i = 10; i < backups.length; i++) {
                    const oldBackupPath = GLib.build_filenamev([this._configDir, backups[i].name]);
                    const oldBackupFile = Gio.File.new_for_path(oldBackupPath);
                    oldBackupFile.delete(null);
                    global.log(`${UUID}: Deleted old backup: ${backups[i].name}`);
                }
            }

        } catch (e) {
            // Non-critical error, just log it
            global.log(`${UUID}: Failed to cleanup old backups: ${e}`);
        }
    }

    /**
     * Cleanup on extension disable
     */
    destroy() {
        // Stop auto-save timer
        this._stopAutoSave();

        // Clear debounced save timer
        if (this._saveTimeoutId) {
            Mainloop.source_remove(this._saveTimeoutId);
            this._saveTimeoutId = null;
        }

        // NOTE: We intentionally do NOT save here during shutdown!
        // The backup was already created in extension.disable() BEFORE windows started closing.
        // Saving now would capture partial/corrupted state as windows are being destroyed.
        // The last good state is preserved in positions.json from the last auto-save.
    }
};
