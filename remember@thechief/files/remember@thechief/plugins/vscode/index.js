/**
 * VS Code Plugin Handler
 *
 * VS Code aggressively positions its own windows on startup,
 * so we need multiple restore attempts to override it.
 *
 * VS Code spawns a main process without project arguments,
 * so we parse the project name from the window title.
 */

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

var VSCodeHandler = class VSCodeHandler {
    constructor(config, extensionSettings, storage, log = null, logError = null) {
        this._config = config;
        this._extensionSettings = extensionSettings;
        this._storage = storage;

        // VS Code self-positions aggressively and takes several seconds to fully load
        // Use longer timings to catch late repositioning
        this.restoreTimings = [500, 1500, 3000, 5000, 8000];

        // Logger injection - no-op until injected
        this._log = log || function() {};
        this._logError = logError || global.logError;
    }

    /**
     * Hook: Parse project path from window title
     *
     * VSCode title format: "filename - projectname - Visual Studio Code"
     * or: "Welcome - projectname - Visual Studio Code"
     *
     * Note: VSCode changes title after initial window creation, so this is called
     * after titleStabilizationDelay (configured in config.json)
     *
     * @param {string} title - Window title
     * @param {Object} instance - Instance data (may contain working_dir)
     * @returns {string[]|null} Project path as argument
     */
    parseTitleData(title, instance) {
        if (!title) return null;

        // Extract project name from title
        // Format: "... - projectname - Visual Studio Code"
        const match = title.match(/- (.+?) - Visual Studio Code$/);
        if (!match) {
            this._log(`VSCode: Could not parse project from title: "${title}"`);
            return null;
        }

        const projectName = match[1].trim();

        // Skip if this is just a generic title (no specific project)
        if (projectName === 'Welcome' || projectName === '[Extension Development Host]') {
            this._log(`VSCode: Generic title, no specific project`);
            return null;
        }

        // Try to find project path
        const projectPath = this._findProjectPath(projectName, instance);
        if (projectPath) {
            this._log(`VSCode: Will open project ${projectPath}`);
            return [projectPath];
        }

        this._log(`VSCode: Could not find project path for "${projectName}"`);
        return null;
    }

    /**
     * Find full path to VSCode project
     * @param {string} projectName - Project name from title
     * @param {Object} instance - Instance data (may contain working_dir)
     * @returns {string|null} Full path to project directory
     * @private
     */
    _findProjectPath(projectName, instance) {
        const GLib = imports.gi.GLib;
        const Gio = imports.gi.Gio;

        // Strategy 1: Use working_dir if available and matches project name
        if (instance && instance.working_dir) {
            const dir = Gio.File.new_for_path(instance.working_dir);
            if (dir.query_exists(null) && instance.working_dir.endsWith(projectName)) {
                this._log(`VSCode: Using working_dir: ${instance.working_dir}`);
                return instance.working_dir;
            }
        }

        // Strategy 2: Search common project locations
        const searchPaths = [
            GLib.build_filenamev([GLib.get_home_dir(), 'test-projects', projectName]),
            GLib.build_filenamev([GLib.get_home_dir(), 'projects', projectName]),
            GLib.build_filenamev([GLib.get_home_dir(), 'workspace', projectName]),
            GLib.build_filenamev([GLib.get_home_dir(), 'code', projectName]),
            GLib.build_filenamev([GLib.get_home_dir(), 'dev', projectName]),
            GLib.build_filenamev([GLib.get_home_dir(), projectName])
        ];

        for (const path of searchPaths) {
            const dir = Gio.File.new_for_path(path);
            if (dir.query_exists(null)) {
                this._log(`VSCode: Found project at ${path}`);
                return path;
            }
        }

        return null;
    }

    destroy() {
        // Nothing to clean up
    }
};
