/**
 * Nemo File Manager Plugin Handler
 *
 * Extracts directory path from window title and opens the directory on launch.
 * Each Nemo instance can be in a different directory on different workspaces.
 */

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const UUID = "remember@thechief";
const DEBUG = GLib.getenv('REMEMBER_DEBUG') === '1' || GLib.getenv('REMEMBER_DEBUG') === 'true';

/**
 * Nemo Handler Class
 */
var NemoHandler = class NemoHandler {
    constructor(config, extensionSettings, storage) {
        this._config = config;
        this._extensionSettings = extensionSettings;
        this._storage = storage;
    }

    beforeLaunch(instance, launchParams) {
        return launchParams;
    }

    afterLaunch(instance, pid, success) {
        if (success) {
            global.log(`${UUID}: Nemo launched with PID ${pid}`);
        }
    }

    /**
     * Extract directory from window title
     *
     * Nemo window titles format:
     * - "Persönlicher Ordner" (home in German)
     * - "Home Folder" or "Home" (home in English)
     * - "name - /path/to/directory"
     *
     * @param {string} title - Window title
     * @returns {string[]|null} Directory path as argument
     */
    parseTitleData(title) {
        if (DEBUG) global.log(`${UUID}: Nemo parseTitleData called with: "${title}"`);

        if (!title) {
            if (DEBUG) global.log(`${UUID}: Nemo: No title, using home dir`);
            return [GLib.get_home_dir()];
        }

        const patterns = this._config.titlePatterns || {};
        const homeKeywords = patterns.homeKeywords || ['Persönlicher Ordner', 'Home Folder', 'Home'];
        const separator = patterns.pathSeparator || ' - ';

        try {
            // Check for home directory keywords
            for (const keyword of homeKeywords) {
                if (title === keyword || title.startsWith(keyword + separator)) {
                    if (DEBUG) global.log(`${UUID}: Nemo: Opening home directory`);
                    return [GLib.get_home_dir()];
                }
            }

            // Format: "name - /path/to/dir" - extract path after last separator
            const separatorIndex = title.lastIndexOf(separator);
            if (separatorIndex > 0) {
                const path = title.substring(separatorIndex + separator.length);

                // Verify it looks like a path (starts with /)
                if (path.startsWith('/')) {
                    // Check if directory exists
                    const dir = Gio.File.new_for_path(path);
                    if (dir.query_exists(null)) {
                        if (DEBUG) global.log(`${UUID}: Nemo: Opening directory ${path}`);
                        return [path];
                    } else {
                        if (DEBUG) global.log(`${UUID}: Nemo: Directory doesn't exist: ${path}`);
                    }
                }
            }

            if (DEBUG) global.log(`${UUID}: Nemo: Couldn't extract path from title "${title}"`);

        } catch (e) {
            global.logError(`${UUID}: Nemo: Failed to parse title: ${e}`);
        }

        // Fallback to home directory
        return [GLib.get_home_dir()];
    }

    destroy() {}
};
