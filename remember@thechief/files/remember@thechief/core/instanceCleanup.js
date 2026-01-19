/**
 * Instance Cleanup Module
 *
 * Handles cleanup of orphaned window instances from storage.
 * Removes instances for windows that no longer exist.
 */

const UUID = "remember@thechief";

/**
 * InstanceCleanup class
 *
 * Cleans up orphaned instances from storage by comparing
 * saved instances against currently open windows.
 */
var InstanceCleanup = class InstanceCleanup {
    /**
     * Constructor
     * @param {Object} options - Configuration options
     * @param {Object} options.storage - Storage instance for data persistence
     * @param {Object} options.sessionLauncher - SessionLauncher for checking expected instances
     * @param {Function} options.shouldTrackFn - Function to check if window should be tracked
     * @param {Function} options.getX11WindowIdFn - Function to get X11 window ID
     * @param {Function} options.isWmClassBlacklistedFn - Function to check if wmClass is blacklisted
     * @param {Set} options.everTrackedWmClasses - Reference to Set of ever-tracked wmClasses
     */
    constructor(options) {
        this._storage = options.storage;
        this._sessionLauncher = options.sessionLauncher;
        this._shouldTrackFn = options.shouldTrackFn;
        this._getX11WindowIdFn = options.getX11WindowIdFn;
        this._isWmClassBlacklistedFn = options.isWmClassBlacklistedFn;
        this._everTrackedWmClasses = options.everTrackedWmClasses; // Reference to Set
    }

    /**
     * Clean up orphaned instances from storage
     *
     * This method:
     * 1. Builds indexes of currently open windows for fast lookup
     * 2. Removes blacklisted apps from storage
     * 3. Removes duplicate instances with same x11_window_id
     * 4. Removes instances with invalid geometry data
     * 5. Removes instances for windows that are no longer open
     *
     * @returns {number} Number of removed instances
     */
    cleanupOrphanedInstances() {
        // PERFORMANCE: Build indexes for fast O(1) lookups
        const openWindowCounts = new Map(); // wmClass -> count
        const openWindowXids = new Set();   // Set of all open X11 window IDs (for fast lookup)
        const openWindowsByClass = new Map(); // wmClass -> array of {seq, xid, title}

        global.get_window_actors().forEach(actor => {
            const metaWindow = actor.get_meta_window();
            if (metaWindow && this._shouldTrackFn(metaWindow)) {
                const wmClass = metaWindow.get_wm_class();
                if (wmClass) {
                    openWindowCounts.set(wmClass, (openWindowCounts.get(wmClass) || 0) + 1);

                    const xid = this._getX11WindowIdFn(metaWindow);
                    if (xid) {
                        openWindowXids.add(xid);  // PERFORMANCE: O(1) lookup later
                    }

                    if (!openWindowsByClass.has(wmClass)) {
                        openWindowsByClass.set(wmClass, []);
                    }
                    openWindowsByClass.get(wmClass).push({
                        seq: metaWindow.get_stable_sequence(),
                        xid: xid,
                        title: metaWindow.get_title() || ''
                    });
                }
            }
        });

        // Check each app in storage
        const apps = this._storage.getAllApps();
        let removedCount = 0;

        for (const wmClass in apps) {
            const appData = apps[wmClass];
            if (!appData.instances) continue;

            // STEP 0: Remove blacklisted apps entirely from storage
            if (this._isWmClassBlacklistedFn(wmClass)) {
                const instanceCount = appData.instances.length;
                this._storage.removeApp(wmClass);
                global.log(`${UUID}: Removed blacklisted app from storage: ${wmClass} (${instanceCount} instances)`);
                removedCount += instanceCount;
                continue;
            }

            // STEP 1: Remove duplicate instances with same x11_window_id
            // Keep only the first instance for each unique x11_window_id
            const seenXids = new Set();
            const deduplicatedInstances = [];
            for (const instance of appData.instances) {
                const xid = instance.x11_window_id;
                if (xid && seenXids.has(xid)) {
                    // Duplicate x11_window_id - remove this instance
                    global.log(`${UUID}: Removing duplicate instance for ${wmClass} with xid ${xid}`);
                    removedCount++;
                    continue;
                }
                if (xid) {
                    seenXids.add(xid);
                }
                deduplicatedInstances.push(instance);
            }
            appData.instances = deduplicatedInstances;

            // STEP 2: Remove instances with invalid geometry data
            const validInstances = appData.instances.filter(instance => {
                // Remove instances with null geometry (invalid data)
                if (instance.geometry_percent === null && instance.geometry_absolute === null) {
                    global.log(`${UUID}: Removing instance with null geometry for ${wmClass}`);
                    removedCount++;
                    return false;
                }
                return true;
            });
            appData.instances = validInstances;

            const openCount = openWindowCounts.get(wmClass) || 0;
            const savedCount = appData.instances.length;

            // If no windows of this app are open, check if any are expected (pending launch)
            if (openCount === 0) {
                // Check if SessionLauncher is still expecting windows for this app
                const expectedIds = this._sessionLauncher ?
                    this._sessionLauncher.getExpectedInstances(wmClass) : [];

                if (expectedIds.length > 0) {
                    // Don't remove - windows are still expected to appear
                    global.log(`${UUID}: Keeping ${wmClass} - ${expectedIds.length} instances still expected`);
                    continue;
                }

                // No windows open and none expected - remove the app
                this._storage.removeApp(wmClass);
                global.log(`${UUID}: Removed app ${wmClass} (no windows open)`);
                removedCount += savedCount;
                continue;
            }

            // STEP 3: If we have more saved instances than open windows, trim the excess
            if (savedCount > openCount) {
                // PERFORMANCE: Build expected IDs set for O(1) lookup
                const expectedIds = this._sessionLauncher ?
                    new Set(this._sessionLauncher.getExpectedInstances(wmClass)) : new Set();

                const instancesToKeep = [];
                const instancesToRemove = [];

                for (const instance of appData.instances) {
                    // 1. PERFORMANCE: Instance matches an open window by XID (O(1) lookup via openWindowXids)
                    if (instance.x11_window_id && openWindowXids.has(instance.x11_window_id)) {
                        instance.assigned = true;
                        instancesToKeep.push(instance);
                    }
                    // 2. Still expected from SessionLauncher (pending or in grace period): keep
                    else if (expectedIds.has(instance.id)) {
                        instancesToKeep.push(instance);
                        global.log(`${UUID}: Keeping expected instance ${instance.id} for ${wmClass}`);
                    }
                    // 3. Not matching any open window: candidate for removal
                    else {
                        instancesToRemove.push(instance);
                    }
                }

                // If we still have more instances than open windows, remove unmatched ones
                const excessCount = instancesToKeep.length - openCount;
                if (excessCount > 0 && instancesToRemove.length > 0) {
                    // Remove excess unassigned instances
                    for (let i = 0; i < Math.min(excessCount, instancesToRemove.length); i++) {
                        const inst = instancesToRemove[i];
                        global.log(`${UUID}: Cleaned orphaned instance ${wmClass} (title: "${inst.title_snapshot}")`);
                        removedCount++;
                    }
                    // Keep remaining unassigned if needed
                    const remainingToKeep = instancesToRemove.slice(Math.min(excessCount, instancesToRemove.length));
                    appData.instances = [...instancesToKeep, ...remainingToKeep];
                } else {
                    // Log removed instances
                    if (instancesToRemove.length > 0) {
                        for (const inst of instancesToRemove) {
                            global.log(`${UUID}: Cleaned orphaned instance ${wmClass} (title: "${inst.title_snapshot}")`);
                        }
                        removedCount += instancesToRemove.length;
                    }
                    appData.instances = instancesToKeep;
                }
            }
        }

        if (removedCount > 0) {
            this._storage.save();
            global.log(`${UUID}: Cleanup complete - removed ${removedCount} orphaned/duplicate instances`);
        }

        return removedCount;
    }
};
