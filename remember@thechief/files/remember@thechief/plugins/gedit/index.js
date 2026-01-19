/**
 * Text Editor Plugin Handler (gedit)
 *
 * Extracts file path from window title and opens the file on launch.
 * Works for gedit, xed, SciTE, and similar editors.
 */

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const UUID = "remember@thechief";

/**
 * Text Editor Handler Class
 */
var TextEditorHandler = class TextEditorHandler {
    constructor(config, extensionSettings, storage) {
        this._config = config;
        this._extensionSettings = extensionSettings;
        this._storage = storage;
    }

    /**
     * Hook: Called before launching the app
     */
    beforeLaunch(instance, launchParams) {
        return launchParams;
    }

    /**
     * Hook: Called after launching the app
     */
    afterLaunch(instance, pid, success) {
        if (success) {
            global.log(`${UUID}: ${this._config.name} launched with PID ${pid}`);
        }
    }

    /**
     * Hook: Extract file path from window title
     *
     * Title patterns:
     * - "filename.txt - gedit" or "/full/path/file.txt - gedit"
     * - "filename.txt (~) - gedit" (unsaved marker)
     *
     * @param {string} title - Window title
     * @returns {string[]|null} File path as argument, or null
     */
    parseTitleData(title) {
        if (!title) return null;

        const patterns = this._config.titlePatterns || {};
        const skipPatterns = patterns.skipPatterns || ['untitled', 'unsaved', 'new file'];

        // Skip unsaved/untitled documents
        const titleLower = title.toLowerCase();
        for (const skip of skipPatterns) {
            if (titleLower.includes(skip)) {
                global.log(`${UUID}: ${this._config.name}: Skipping unsaved document`);
                return null;
            }
        }

        try {
            // Pattern 1: Full path in title (e.g., "/home/user/file.txt - gedit")
            const fullPathRegex = new RegExp(patterns.fullPathRegex || '^(/[^\\s]+\\.[a-zA-Z0-9]+)\\s*-\\s*');
            const fullPathMatch = title.match(fullPathRegex);

            if (fullPathMatch) {
                const filePath = fullPathMatch[1];
                // Verify file exists
                const file = Gio.File.new_for_path(filePath);
                if (file.query_exists(null)) {
                    global.log(`${UUID}: ${this._config.name}: Opening file ${filePath}`);
                    return [filePath];
                }
            }

            // Pattern 2: Filename only (e.g., "script.py - gedit")
            const filenameRegex = new RegExp(patterns.filenameRegex || '^([^\\s/]+\\.[a-zA-Z0-9]+)\\s*[~()]*\\s*-\\s*');
            const filenameMatch = title.match(filenameRegex);

            if (filenameMatch) {
                const filename = filenameMatch[1];
                global.log(`${UUID}: ${this._config.name}: Opening relative file ${filename}`);
                return [filename]; // Let the app try to find it
            }

        } catch (e) {
            global.logError(`${UUID}: ${this._config.name}: Failed to parse title "${title}": ${e}`);
        }

        return null;
    }

    destroy() {
        // Nothing to cleanup
    }
};
