/**
 * Google Chrome / Chromium Plugin Handler
 *
 * Handles Chrome/Chromium session restore with preferences manipulation.
 */

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const UUID = "remember@thechief";

/**
 * Chrome Handler Class
 */
var ChromeHandler = class ChromeHandler {
    constructor(config, extensionSettings, storage) {
        this._config = config;
        this._extensionSettings = extensionSettings;
        this._storage = storage;
    }

    /**
     * Hook: Called before launching the app
     */
    beforeLaunch(instance, launchParams) {
        if (this._extensionSettings.useBrowserSessionRestore()) {
            this._fixChromiumPreferences(launchParams.executable);
        }
        return launchParams;
    }

    /**
     * Hook: Called after launching the app
     */
    afterLaunch(instance, pid, success) {
        if (success) {
            global.log(`${UUID}: Chrome/Chromium launched with PID ${pid}`);
        }
    }

    /**
     * Hook: Parse data from window title (not used)
     */
    parseTitleData(title) {
        return null;
    }

    /**
     * Fix Chromium Preferences to enable session restore
     */
    _fixChromiumPreferences(executable) {
        // Determine which config path to use based on executable
        let prefsRelPath;
        if (executable.includes('chromium')) {
            prefsRelPath = this._config.configPaths.chromium;
        } else {
            prefsRelPath = this._config.configPaths.chrome;
        }

        try {
            const configPath = GLib.build_filenamev([
                GLib.get_home_dir(),
                prefsRelPath
            ]);

            const file = Gio.File.new_for_path(configPath);
            if (!file.query_exists(null)) {
                global.log(`${UUID}: Chrome preferences file not found: ${configPath}`);
                return;
            }

            const [success, contents] = file.load_contents(null);
            if (!success) {
                global.logError(`${UUID}: Failed to read Chrome preferences file`);
                return;
            }

            let prefsText = imports.byteArray.toString(contents);
            let modified = false;

            // Set exit_type to "Normal"
            if (prefsText.includes('"exit_type":"Crashed"')) {
                prefsText = prefsText.replace(/"exit_type":"Crashed"/g, '"exit_type":"Normal"');
                modified = true;
                global.log(`${UUID}: Chrome: Set exit_type=Normal`);
            }

            // Handle exited_cleanly
            if (prefsText.includes('"exited_cleanly":false')) {
                prefsText = prefsText.replace(/"exited_cleanly":false/g, '"exited_cleanly":true');
                modified = true;
                global.log(`${UUID}: Chrome: Set exited_cleanly=true`);
            }

            if (modified) {
                file.replace_contents(
                    prefsText,
                    null,
                    false,
                    Gio.FileCreateFlags.REPLACE_DESTINATION,
                    null
                );
                global.log(`${UUID}: Chrome: Fixed preferences for session restore`);
            }

        } catch (e) {
            global.logError(`${UUID}: Chrome: Failed to fix preferences: ${e}`);
        }
    }

    destroy() {
        // Nothing to cleanup
    }
};
