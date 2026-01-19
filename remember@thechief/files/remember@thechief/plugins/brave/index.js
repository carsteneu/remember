/**
 * Brave Browser Plugin Handler
 *
 * Handles Brave browser session restore with Chromium preferences manipulation.
 * Fixes the exit_type in Preferences file to enable --restore-last-session.
 */

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const UUID = "remember@thechief";

/**
 * Brave Handler Class
 */
var BraveHandler = class BraveHandler {
    constructor(config, extensionSettings, storage) {
        this._config = config;
        this._extensionSettings = extensionSettings;
        this._storage = storage;
    }

    /**
     * Hook: Called before launching the app
     * Modifies Chromium Preferences to enable session restore
     *
     * @param {Object} instance - Window instance data
     * @param {Object} launchParams - { executable, args, workDir }
     * @returns {Object} Modified launch params
     */
    beforeLaunch(instance, launchParams) {
        // Only fix preferences if browser session restore is enabled
        if (this._extensionSettings.useBrowserSessionRestore()) {
            this._fixChromiumPreferences();
        }

        return launchParams;
    }

    /**
     * Hook: Called after launching the app
     *
     * @param {Object} instance - Window instance data
     * @param {number} pid - Process ID
     * @param {boolean} success - Whether spawn was successful
     */
    afterLaunch(instance, pid, success) {
        if (success) {
            global.log(`${UUID}: Brave launched with PID ${pid}`);
        }
    }

    /**
     * Hook: Parse data from window title (not used for Brave)
     *
     * @param {string} title - Window title
     * @returns {string[]|null} Arguments to add, or null
     */
    parseTitleData(title) {
        return null; // Brave doesn't need title parsing
    }

    /**
     * Fix Chromium Preferences to enable session restore
     *
     * CRITICAL: Sets exit_type to "Normal" which allows --restore-last-session to work.
     * This is counter-intuitive but proven by testing!
     *
     * When Brave is killed during logout, the session is preserved but exit_type becomes "Crashed".
     * Setting exit_type=Normal BEFORE launch allows --restore-last-session to work properly.
     */
    _fixChromiumPreferences() {
        try {
            // Get preferences path from config or use default
            const prefsRelPath = (this._config.configPaths && this._config.configPaths.preferences)
                ? this._config.configPaths.preferences
                : '.config/BraveSoftware/Brave-Browser/Default/Preferences';

            const configPath = GLib.build_filenamev([
                GLib.get_home_dir(),
                prefsRelPath
            ]);

            const file = Gio.File.new_for_path(configPath);
            if (!file.query_exists(null)) {
                global.log(`${UUID}: Brave preferences file not found: ${configPath}`);
                return;
            }

            // Read current preferences
            const [success, contents] = file.load_contents(null);
            if (!success) {
                global.logError(`${UUID}: Failed to read Brave preferences file`);
                return;
            }

            let prefsText = imports.byteArray.toString(contents);
            let modified = false;

            // Set exit_type to "Normal" (enables --restore-last-session)
            if (prefsText.includes('"exit_type":"Crashed"')) {
                prefsText = prefsText.replace(/"exit_type":"Crashed"/g, '"exit_type":"Normal"');
                modified = true;
                global.log(`${UUID}: Brave: Set exit_type=Normal (enables session restore)`);
            }

            // Also handle exited_cleanly if present (older versions)
            if (prefsText.includes('"exited_cleanly":false')) {
                prefsText = prefsText.replace(/"exited_cleanly":false/g, '"exited_cleanly":true');
                modified = true;
                global.log(`${UUID}: Brave: Set exited_cleanly=true`);
            }

            if (modified) {
                // Write back modified preferences
                file.replace_contents(
                    prefsText,
                    null,
                    false,
                    Gio.FileCreateFlags.REPLACE_DESTINATION,
                    null
                );
                global.log(`${UUID}: Brave: Fixed preferences for session restore`);
            } else if (prefsText.includes('"exit_type":"Normal"')) {
                global.log(`${UUID}: Brave: Already set to Normal - session restore ready`);
            }

        } catch (e) {
            global.logError(`${UUID}: Brave: Failed to fix preferences: ${e}`);
        }
    }

    /**
     * Cleanup (called when extension is disabled)
     */
    destroy() {
        // Nothing to cleanup
    }
};
