/**
 * SciTE Text Editor Plugin Handler
 *
 * Extracts file path from window title and opens the file on launch.
 */

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const UUID = "remember@thechief";

/**
 * SciTE Handler Class
 */
var SciteHandler = class SciteHandler {
    constructor(config, extensionSettings, storage, log = null, logError = null) {
        this._config = config;
        this._extensionSettings = extensionSettings;
        this._storage = storage;

        // Logger injection - no-op until injected
        this._log = log || function() {};
        this._logError = logError || global.logError;
    }

    beforeLaunch(instance, launchParams) {
        return launchParams;
    }

    afterLaunch(instance, pid, success) {
        if (success) {
            this._log(`SciTE launched with PID ${pid}`);
        }
    }

    parseTitleData(title) {
        if (!title) return null;

        const patterns = this._config.titlePatterns || {};
        const skipPatterns = patterns.skipPatterns || ['untitled', 'unsaved', 'new'];

        const titleLower = title.toLowerCase();
        for (const skip of skipPatterns) {
            if (titleLower.includes(skip)) {
                return null;
            }
        }

        try {
            // Full path
            const fullPathRegex = new RegExp(patterns.fullPathRegex || '^(/[^\\s]+\\.[a-zA-Z0-9]+)\\s*-\\s*');
            const fullPathMatch = title.match(fullPathRegex);

            if (fullPathMatch) {
                const filePath = fullPathMatch[1];
                const file = Gio.File.new_for_path(filePath);
                if (file.query_exists(null)) {
                    this._log(`SciTE: Opening file ${filePath}`);
                    return [filePath];
                }
            }

            // Filename only
            const filenameRegex = new RegExp(patterns.filenameRegex || '^([^\\s/]+\\.[a-zA-Z0-9]+)\\s*-\\s*');
            const filenameMatch = title.match(filenameRegex);

            if (filenameMatch) {
                const filename = filenameMatch[1];
                this._log(`SciTE: Opening relative file ${filename}`);
                return [filename];
            }

        } catch (e) {
            this._logError(`${UUID}: SciTE: Failed to parse title: ${e}`);
        }

        return null;
    }

    destroy() {}
};
