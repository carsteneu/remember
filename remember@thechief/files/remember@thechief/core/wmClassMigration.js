/**
 * WM_CLASS Migration Module
 *
 * Handles WM_CLASS changes for applications like LibreOffice that change their
 * WM_CLASS after document loads (e.g., "Soffice" -> "libreoffice-calc").
 * Migrates instance data from old wmClass to new wmClass to prevent duplicate app entries.
 */

const UUID = "remember@thechief";

/**
 * WmClassMigration - Handles WM_CLASS migration for apps that change class at runtime
 */
var WmClassMigration = class WmClassMigration {
    /**
     * @param {Object} options
     * @param {Object} options.storage - Storage instance for app data
     * @param {Object} options.pluginManager - PluginManager instance
     * @param {Function} options.getX11WindowIdFn - Function to get X11 window ID
     * @param {Function} options.findDesktopFileFn - Function to find desktop file
     * @param {Function} options.findDesktopExecFn - Function to find desktop exec
     * @param {Function} options.onWindowChangedFn - Callback when window changed
     */
    constructor(options) {
        this._storage = options.storage;
        this._pluginManager = options.pluginManager;
        this._getX11WindowIdFn = options.getX11WindowIdFn;
        this._findDesktopFileFn = options.findDesktopFileFn;
        this._findDesktopExecFn = options.findDesktopExecFn;
        this._onWindowChangedFn = options.onWindowChangedFn;
    }

    /**
     * Handle WM_CLASS changes (LibreOffice bug: changes from "Soffice" to "libreoffice-calc" after document loads)
     * Migrates instance data from old wmClass to new wmClass to prevent duplicate app entries
     * @param {Meta.Window} metaWindow - The window whose WM_CLASS changed
     */
    onWmClassChanged(metaWindow) {
        const newWmClass = metaWindow.get_wm_class();
        if (!newWmClass) return;

        // Try to find which old wmClass this window belonged to
        const windowSeq = metaWindow.get_stable_sequence();
        const windowXid = this._getX11WindowIdFn(metaWindow);

        if (!windowSeq && !windowXid) {
            // Can't identify the window, just track under new wmClass
            this._onWindowChangedFn(metaWindow);
            return;
        }

        // Check if this window matches an instance in a different app (by stable_sequence or x11_window_id)
        const allApps = this._storage.getAllApps();
        let oldWmClass = null;
        let matchedInstance = null;

        for (const wmClass in allApps) {
            if (wmClass === newWmClass) continue; // Skip the new wmClass

            const appData = allApps[wmClass];
            if (!appData.instances) continue;

            for (const instance of appData.instances) {
                if ((windowSeq && instance.stable_sequence === windowSeq) ||
                    (windowXid && instance.x11_window_id === windowXid)) {
                    oldWmClass = wmClass;
                    matchedInstance = instance;
                    break;
                }
            }

            if (matchedInstance) break;
        }

        if (matchedInstance && oldWmClass) {
            // Found a match! Migrate instance data from oldWmClass to newWmClass
            global.log(`${UUID}: WM_CLASS changed: "${oldWmClass}" -> "${newWmClass}" (migrating instance data)`);

            // Check if they belong to the same plugin (e.g., LibreOffice plugin handles both "Soffice" and "libreoffice-calc")
            const samePlugin = this._pluginManager &&
                               this._pluginManager.hasPlugin(oldWmClass) &&
                               this._pluginManager.hasPlugin(newWmClass) &&
                               this._pluginManager.getPlugin(oldWmClass) === this._pluginManager.getPlugin(newWmClass);

            if (samePlugin || this.shouldMigrateWmClass(oldWmClass, newWmClass)) {
                // Remove instance from old app
                const oldAppData = this._storage.getApp(oldWmClass);
                if (oldAppData && oldAppData.instances) {
                    oldAppData.instances = oldAppData.instances.filter(i => i !== matchedInstance);

                    if (oldAppData.instances.length === 0) {
                        // No more instances, remove the app entry entirely
                        this._storage.removeApp(oldWmClass);
                        global.log(`${UUID}: Removed empty app entry: ${oldWmClass}`);
                    } else {
                        this._storage.setApp(oldWmClass, oldAppData);
                    }
                }

                // Add instance to new app
                let newAppData = this._storage.getApp(newWmClass);
                if (!newAppData) {
                    newAppData = {
                        wm_class: newWmClass,
                        desktop_file: this._findDesktopFileFn(metaWindow),
                        desktop_exec: this._findDesktopExecFn(metaWindow),
                        instances: []
                    };
                }

                newAppData.instances.push(matchedInstance);
                this._storage.setApp(newWmClass, newAppData);

                global.log(`${UUID}: Migrated instance from "${oldWmClass}" to "${newWmClass}"`);
            }
        }

        // Update window state under new wmClass
        this._onWindowChangedFn(metaWindow);
    }

    /**
     * Check if wmClass change should trigger instance migration
     * Used for apps known to change WM_CLASS (LibreOffice, etc.)
     * @param {string} oldWmClass - The old WM_CLASS
     * @param {string} newWmClass - The new WM_CLASS
     * @returns {boolean} True if migration should occur
     */
    shouldMigrateWmClass(oldWmClass, newWmClass) {
        // LibreOffice patterns: "Soffice" -> "libreoffice-*"
        if ((oldWmClass === 'Soffice' || oldWmClass === 'soffice') &&
            newWmClass.startsWith('libreoffice-')) {
            return true;
        }

        // Reverse: "libreoffice-*" -> "Soffice"
        if (oldWmClass.startsWith('libreoffice-') &&
            (newWmClass === 'Soffice' || newWmClass === 'soffice')) {
            return true;
        }

        return false;
    }
};
