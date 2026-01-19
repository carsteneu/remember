/**
 * Plugin Manager Module for Window Position Remember Extension
 *
 * Manages app-specific plugins for launch handling.
 * Plugins can provide custom launch logic (session restore, config manipulation, etc.)
 */

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const UUID = "remember@thechief";

/**
 * Plugin Manager Class
 * Loads and manages app-specific handler plugins
 */
var PluginManager = class PluginManager {
    constructor(extensionPath, extensionSettings, storage) {
        this._extensionPath = extensionPath;
        this._extensionSettings = extensionSettings;
        this._storage = storage;
        this._plugins = new Map();   // wmClass -> config
        this._handlers = new Map();  // wmClass -> handler instance
        this._loaded = false;
    }

    /**
     * Load all plugins from built-in and user directories
     */
    loadPlugins() {
        if (this._loaded) {
            global.log(`${UUID}: Plugins already loaded, skipping`);
            return;
        }

        const pluginDirs = [
            // Built-in plugins (part of extension)
            GLib.build_filenamev([this._extensionPath, 'plugins']),
            // User plugins (custom additions)
            GLib.build_filenamev([GLib.get_home_dir(), '.config', UUID, 'plugins'])
        ];

        for (const pluginDir of pluginDirs) {
            this._loadPluginsFromDir(pluginDir);
        }

        this._loaded = true;
        global.log(`${UUID}: PluginManager loaded ${this._plugins.size} plugin configurations`);
    }

    /**
     * Load plugins from a directory
     */
    _loadPluginsFromDir(dirPath) {
        const dir = Gio.File.new_for_path(dirPath);
        if (!dir.query_exists(null)) {
            return;
        }

        try {
            const enumerator = dir.enumerate_children(
                'standard::name,standard::type',
                Gio.FileQueryInfoFlags.NONE,
                null
            );

            let fileInfo;
            while ((fileInfo = enumerator.next_file(null)) !== null) {
                if (fileInfo.get_file_type() === Gio.FileType.DIRECTORY) {
                    const pluginName = fileInfo.get_name();
                    this._loadPlugin(dirPath, pluginName);
                }
            }
        } catch (e) {
            global.logError(`${UUID}: Failed to enumerate plugins in ${dirPath}: ${e}`);
        }
    }

    /**
     * Load a single plugin from its directory
     */
    _loadPlugin(dirPath, pluginName) {
        try {
            const pluginPath = GLib.build_filenamev([dirPath, pluginName]);
            const configPath = GLib.build_filenamev([pluginPath, 'config.json']);

            // 1. Load config.json (required)
            const configFile = Gio.File.new_for_path(configPath);
            if (!configFile.query_exists(null)) {
                global.log(`${UUID}: Plugin ${pluginName} has no config.json, skipping`);
                return;
            }

            const [success, contents] = configFile.load_contents(null);
            if (!success) {
                global.logError(`${UUID}: Failed to read config.json for plugin ${pluginName}`);
                return;
            }

            const config = JSON.parse(imports.byteArray.toString(contents));

            // Validate required fields
            if (!config.name || !config.wmClass || !Array.isArray(config.wmClass)) {
                global.logError(`${UUID}: Plugin ${pluginName} has invalid config (missing name or wmClass array)`);
                return;
            }

            // Store plugin path for handler loading
            config._path = pluginPath;
            config._dirPath = dirPath;

            // Set defaults for optional fields
            config.launch = config.launch || {};
            config.launch.executables = config.launch.executables || [];
            config.launch.flags = config.launch.flags || [];
            config.launch.conditionalFlags = config.launch.conditionalFlags || {};

            config.features = config.features || {};
            config.features.isSingleInstance = config.features.isSingleInstance || false;
            config.features.timeout = config.features.timeout || 45000;
            config.features.gracePeriod = config.features.gracePeriod || 30000;

            // 2. Register plugin for all wmClass entries
            for (const wmClass of config.wmClass) {
                this._plugins.set(wmClass, config);
            }

            // 3. Load handler if specified (index.js or custom)
            if (config.handler) {
                this._loadHandler(pluginPath, pluginName, config);
            }

            global.log(`${UUID}: Loaded plugin: ${pluginName} (${config.wmClass.join(', ')})`);

        } catch (e) {
            global.logError(`${UUID}: Failed to load plugin ${pluginName}: ${e}`);
        }
    }

    /**
     * Load handler module (index.js) for a plugin
     */
    _loadHandler(pluginPath, pluginName, config) {
        try {
            const handlerFileName = config.handler;
            const handlerPath = GLib.build_filenamev([pluginPath, handlerFileName]);
            const handlerFile = Gio.File.new_for_path(handlerPath);

            if (!handlerFile.query_exists(null)) {
                global.log(`${UUID}: Plugin ${pluginName} specifies handler ${handlerFileName} but file doesn't exist`);
                return;
            }

            // Add parent directory to search path and import via plugin subdirectory
            // This creates unique module paths: imports.thunderbird.index, imports.libreoffice.index, etc.
            // Avoids GJS cache conflicts where all "index.js" would share one cache entry
            const parentDir = GLib.path_get_dirname(pluginPath);
            imports.searchPath.unshift(parentDir);

            try {
                // Import as: imports.<pluginName>.<handlerModule>
                // e.g., imports.thunderbird.index for plugins/thunderbird/index.js
                const moduleName = handlerFileName.replace(/\.js$/, '');
                const module = imports[pluginName][moduleName];

                // Find handler class (convention: <Name>Handler or just Handler)
                let HandlerClass = null;
                for (const key in module) {
                    if (key.endsWith('Handler') && typeof module[key] === 'function') {
                        HandlerClass = module[key];
                        break;
                    }
                }

                if (!HandlerClass) {
                    global.logError(`${UUID}: Plugin ${pluginName} handler has no *Handler class`);
                    return;
                }

                // Instantiate handler with dependencies
                const handler = new HandlerClass(config, this._extensionSettings, this._storage);

                // Register handler for all wmClass entries
                for (const wmClass of config.wmClass) {
                    this._handlers.set(wmClass, handler);
                }

                global.log(`${UUID}: Loaded handler for plugin: ${pluginName}`);

            } finally {
                // Always restore search path
                imports.searchPath.shift();
            }

        } catch (e) {
            global.logError(`${UUID}: Failed to load handler for plugin ${pluginName}: ${e}`);
        }
    }

    /**
     * Get plugin config for a wmClass
     * @param {string} wmClass - Window manager class
     * @returns {Object|null} Plugin config or null
     */
    getPlugin(wmClass) {
        return this._plugins.get(wmClass) || null;
    }

    /**
     * Get handler instance for a wmClass
     * @param {string} wmClass - Window manager class
     * @returns {Object|null} Handler instance or null
     */
    getHandler(wmClass) {
        return this._handlers.get(wmClass) || null;
    }

    /**
     * Check if wmClass has a plugin
     * @param {string} wmClass - Window manager class
     * @returns {boolean}
     */
    hasPlugin(wmClass) {
        return this._plugins.has(wmClass);
    }

    /**
     * Check if app is a single-instance app
     * @param {string} wmClass - Window manager class
     * @returns {boolean}
     */
    isSingleInstance(wmClass) {
        const plugin = this.getPlugin(wmClass);
        return plugin ? plugin.features.isSingleInstance === true : false;
    }

    /**
     * Get timeout for an app
     * @param {string} wmClass - Window manager class
     * @returns {number} Timeout in milliseconds
     */
    getTimeout(wmClass) {
        const plugin = this.getPlugin(wmClass);
        if (plugin && plugin.features && plugin.features.timeout) {
            return plugin.features.timeout;
        }
        return 45000; // Default timeout
    }

    /**
     * Get grace period for an app
     * @param {string} wmClass - Window manager class
     * @returns {number} Grace period in milliseconds
     */
    getGracePeriod(wmClass) {
        const plugin = this.getPlugin(wmClass);
        if (plugin && plugin.features && plugin.features.gracePeriod) {
            return plugin.features.gracePeriod;
        }
        return 30000; // Default grace period
    }

    /**
     * Get all loaded plugin names
     * @returns {string[]} Array of plugin names
     */
    getLoadedPlugins() {
        const names = new Set();
        for (const config of this._plugins.values()) {
            names.add(config.name);
        }
        return Array.from(names);
    }

    /**
     * Get all plugins with their handlers (for deduplication hooks, etc.)
     * Returns unique plugins (deduplicated by plugin name since one plugin can handle multiple wmClasses)
     * @returns {Object[]} Array of { name, config, handler }
     */
    getAllPlugins() {
        const seen = new Set();
        const plugins = [];

        for (const [wmClass, config] of this._plugins.entries()) {
            if (seen.has(config.name)) continue;
            seen.add(config.name);

            plugins.push({
                name: config.name,
                config: config,
                handler: this._handlers.get(wmClass) || null
            });
        }

        return plugins;
    }

    /**
     * Get statistics about loaded plugins
     * @returns {Object} Stats object
     */
    getStats() {
        return {
            plugins: this._plugins.size,
            handlers: this._handlers.size,
            names: this.getLoadedPlugins()
        };
    }

    /**
     * Reload all plugins (useful for development)
     */
    reload() {
        this._plugins.clear();
        this._handlers.clear();
        this._loaded = false;
        this.loadPlugins();
    }

    /**
     * Cleanup on extension disable
     */
    destroy() {
        // Call destroy on all handlers that have it
        for (const handler of this._handlers.values()) {
            if (handler && typeof handler.destroy === 'function') {
                try {
                    handler.destroy();
                } catch (e) {
                    global.logError(`${UUID}: Error destroying handler: ${e}`);
                }
            }
        }

        this._plugins.clear();
        this._handlers.clear();
        this._loaded = false;
    }
};
