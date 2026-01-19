/**
 * Xed Text Editor Plugin Handler
 *
 * Extracts file path from window title and opens the file on launch.
 * Same logic as gedit handler.
 */

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const UUID = "remember@thechief";

/**
 * Xed Handler Class
 */
var XedHandler = class XedHandler {
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
            global.log(`${UUID}: xed launched with PID ${pid}`);
        }
    }

    parseTitleData(title) {
        if (!title) return null;

        const patterns = this._config.titlePatterns || {};
        const skipPatterns = patterns.skipPatterns || ['untitled', 'unsaved', 'new file'];

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
                    global.log(`${UUID}: xed: Opening file ${filePath}`);
                    return [filePath];
                }
            }

            // Filename only
            const filenameRegex = new RegExp(patterns.filenameRegex || '^([^\\s/]+\\.[a-zA-Z0-9]+)\\s*[~()]*\\s*-\\s*');
            const filenameMatch = title.match(filenameRegex);

            if (filenameMatch) {
                const filename = filenameMatch[1];
                global.log(`${UUID}: xed: Opening relative file ${filename}`);
                return [filename];
            }

        } catch (e) {
            global.logError(`${UUID}: xed: Failed to parse title: ${e}`);
        }

        return null;
    }

    destroy() {}
};
