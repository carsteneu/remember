/**
 * modules.js - Central module loader for Cinnamon Desktop Extension
 *
 * This module provides functionality to load modules from subdirectories,
 * which Cinnamon does not support by default.
 */

const UUID = 'remember@thechief';

/**
 * Cache for loaded modules to avoid reloading
 * @type {Object.<string, Object>}
 */
const moduleCache = {};

/**
 * Modules object providing the load method for importing modules from subdirectories
 */
var Modules = {
    /**
     * Load a module from a subdirectory of the extension
     *
     * @param {Object} extensionMeta - The extension metadata object containing the path
     * @param {string} subdir - The subdirectory name (e.g., 'core', 'utils')
     * @param {string} moduleName - The module name without .js extension
     * @returns {Object} The loaded module exports
     * @throws {Error} If the module cannot be loaded
     *
     * @example
     * const WindowFilter = Modules.load(meta, 'core', 'windowFilter');
     */
    load: function(extensionMeta, subdir, moduleName) {
        // Create a unique cache key to avoid GJS caching conflicts
        const cacheKey = `_${subdir}_${moduleName}`;

        // Return cached module if already loaded
        if (moduleCache[cacheKey]) {
            return moduleCache[cacheKey];
        }

        const subdirPath = `${extensionMeta.path}/${subdir}`;
        const originalSearchPath = imports.searchPath.slice();

        try {
            // Add the subdirectory to the search path
            imports.searchPath.unshift(subdirPath);

            // Use unique import key to avoid GJS module caching conflicts
            // GJS caches modules by name, so we need unique names for modules
            // with the same name in different directories
            const importKey = `${subdir}_${moduleName}`;

            // Import the module
            const loadedModule = imports[moduleName];

            if (!loadedModule) {
                throw new Error(`Module '${moduleName}' not found in '${subdir}'`);
            }

            // Cache the loaded module
            moduleCache[cacheKey] = loadedModule;

            global.log(`${UUID}: Loaded module '${moduleName}' from '${subdir}'`);

            return loadedModule;
        } catch (e) {
            global.logError(`${UUID}: Failed to load module '${moduleName}' from '${subdir}': ${e.message}`);
            throw e;
        } finally {
            // Restore the original search path
            imports.searchPath.length = 0;
            for (let i = 0; i < originalSearchPath.length; i++) {
                imports.searchPath.push(originalSearchPath[i]);
            }
        }
    },

    /**
     * Clear the module cache
     * Useful for development/debugging when modules need to be reloaded
     */
    clearCache: function() {
        for (let key in moduleCache) {
            delete moduleCache[key];
        }
        global.log(`${UUID}: Module cache cleared`);
    },

    /**
     * Check if a module is already cached
     *
     * @param {string} subdir - The subdirectory name
     * @param {string} moduleName - The module name
     * @returns {boolean} True if the module is cached
     */
    isCached: function(subdir, moduleName) {
        const cacheKey = `_${subdir}_${moduleName}`;
        return cacheKey in moduleCache;
    }
};
