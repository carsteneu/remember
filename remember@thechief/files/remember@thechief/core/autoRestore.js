/**
 * AutoRestore - Handles automatic session restore on login
 *
 * Extracted from extension.js to modularize the auto-restore logic.
 * Manages startup delays, login detection, and coordinated app launching.
 */

const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;

const UUID = "remember@thechief";

/**
 * AutoRestore class - manages automatic session restoration
 */
var AutoRestore = class AutoRestore {
    /**
     * @param {Object} options - Dependencies injected via constructor
     * @param {WindowTracker} options.tracker - Window tracker instance
     * @param {Storage} options.storage - Storage instance
     * @param {Preferences} options.preferences - Preferences instance
     * @param {SessionLauncher} options.launcher - Session launcher instance
     * @param {PluginManager} options.pluginManager - Plugin manager instance
     * @param {Object} options.sessionConfig - Session configuration (from config.js)
     */
    constructor(options) {
        this._tracker = options.tracker;
        this._storage = options.storage;
        this._preferences = options.preferences;
        this._launcher = options.launcher;
        this._pluginManager = options.pluginManager;
        this._sessionConfig = options.sessionConfig;

        this._startupTimeoutId = null;
        this._restoreFinalizeTimeoutId = null;
    }

    /**
     * Schedule automatic position restore after startup
     * Waits for STARTUP_DELAY before performing restore
     */
    scheduleAutoRestore() {
        if (this._startupTimeoutId) {
            Mainloop.source_remove(this._startupTimeoutId);
        }

        global.log(`${UUID}: Scheduling auto-restore in ${this._sessionConfig.STARTUP_DELAY}ms`);

        this._startupTimeoutId = Mainloop.timeout_add(this._sessionConfig.STARTUP_DELAY, () => {
            this._startupTimeoutId = null;
            this.performAutoRestore();
            return false;  // Don't repeat
        });
    }

    /**
     * Check if this is a fresh login (vs manual extension enable)
     * Returns true if Cinnamon started within the grace period
     * Uses actual Cinnamon process uptime from system (not a JS variable that resets on reload)
     *
     * @returns {boolean} True if this is a login session
     */
    isLoginSession() {
        try {
            // Get Cinnamon process uptime in seconds using ps command
            // This is reliable because it queries the actual process, not a JS variable
            const [success, stdout, stderr, exitCode] = GLib.spawn_command_line_sync(
                'sh -c "ps -o etimes= -p $(pgrep -x cinnamon | head -1) 2>/dev/null"'
            );

            if (!success || exitCode !== 0) {
                global.log(`${UUID}: Login check: Could not get Cinnamon uptime, assuming not login`);
                return false;
            }

            // Convert Uint8Array to string (works in all GJS versions)
            const decoder = new TextDecoder('utf-8');
            const uptimeStr = decoder.decode(stdout).trim();
            const cinnamonUptime = parseInt(uptimeStr, 10);

            if (isNaN(cinnamonUptime)) {
                global.log(`${UUID}: Login check: Invalid uptime "${uptimeStr}", assuming not login`);
                return false;
            }

            const isLogin = cinnamonUptime < this._sessionConfig.STARTUP_GRACE_PERIOD_SECONDS;

            global.log(`${UUID}: Login check: Cinnamon uptime=${cinnamonUptime}s, grace=${this._sessionConfig.STARTUP_GRACE_PERIOD_SECONDS}s, isLogin=${isLogin}`);
            return isLogin;

        } catch (e) {
            global.logError(`${UUID}: Login check failed: ${e.message}`);
            return false;
        }
    }

    /**
     * Focus Workspace 1 so user can see all apps starting during session restore
     */
    _focusWorkspace1() {
        try {
            const workspaceManager = global.workspace_manager;
            const workspace1 = workspaceManager.get_workspace_by_index(0);
            if (workspace1) {
                workspace1.activate(global.get_current_time());
                global.log(`${UUID}: Focused Workspace 1 for session restore visibility`);
            }
        } catch (e) {
            global.logError(`${UUID}: Failed to focus Workspace 1: ${e.message}`);
        }
    }

    /**
     * Perform automatic session restore (launch apps + restore positions)
     * Called after startup delay, checks preferences and login state
     */
    performAutoRestore() {
        if (!this._tracker) {
            return;
        }

        // Check if auto-restore is enabled in preferences
        if (!this._preferences.shouldAutoRestore()) {
            global.log(`${UUID}: Auto-restore disabled by preferences, skipping`);
            // Clear restore flag and unblock saves
            this._tracker._isRestoringSession = false;
            this._storage.unblockSaves();
            return;
        }

        // CRITICAL: Only perform ANY restore action on fresh login!
        // Manual enable via Extensions Manager should do NOTHING
        // (just start tracking, no restore, no app launch)
        if (!this.isLoginSession()) {
            global.log(`${UUID}: Manual enable detected (not login), skipping ALL restore actions`);
            this._tracker._isRestoringSession = false;
            this._storage.unblockSaves();
            return;
        }

        global.log(`${UUID}: Performing auto-restore (login session)...`);

        // _isRestoringSession was already set to true in enable() before tracking started
        // This prevents any position updates from overwriting saved data

        // Focus Workspace 1 so user can see all apps starting
        this._focusWorkspace1();

        // Reset assignments for clean matching after relogin
        this._tracker.resetAssignments();

        // Step 1: Restore positions for windows that are already open
        let restoredCount = 0;
        global.get_window_actors().forEach(actor => {
            const metaWindow = actor.get_meta_window();
            if (metaWindow && this._tracker._windowFilter.shouldTrack(metaWindow)) {
                // isNewWindow = false: existing windows from Cinnamon restart, don't minimize
                this._tracker._positionRestorer.tryRestorePosition(metaWindow, false);
                restoredCount++;
            }
        });

        global.log(`${UUID}: Restored positions for ${restoredCount} existing windows`);

        // Step 2: Launch all missing instances from saved session
        // CRITICAL: Wait for windows to finish appearing before counting them
        if (this._launcher) {
            // Register callback for when all launches complete
            this._launcher.setOnAllLaunchedCallback(() => {
                this.onSessionRestoreComplete();
            });

            // Use a short delay (500ms) to launch apps quickly after login
            // but still give desktop time to initialize
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
                this.launchMissingInstances();

                // Fallback timeout (30 seconds) in case no apps need launching
                // or callback never fires (e.g., all apps already running)
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 30000, () => {
                    if (this._tracker._isRestoringSession) {
                        global.log(`${UUID}: Fallback timeout - ending restore phase (skipping workspace focus)`);
                        // Skip workspace focus - user may have manually switched during the 30s wait
                        this.finalizeSessionRestore(true);
                    }
                    return GLib.SOURCE_REMOVE;
                });

                return GLib.SOURCE_REMOVE;
            });
        } else {
            // No launcher, clear flag immediately
            this._tracker._isRestoringSession = false;
        }
    }

    /**
     * Called when session restore is complete (all apps launched or timeout)
     * This is just a signal that launching is done - we still need to wait for positioning
     */
    onSessionRestoreComplete() {
        if (!this._tracker._isRestoringSession) {
            return; // Already completed
        }

        global.log(`${UUID}: All apps launched, waiting for positioning to complete...`);

        // DON'T unblock saves yet - the windows are still being positioned
        // The actual unblock happens in finalizeSessionRestore() which is called
        // after a longer delay to ensure all workspace moves are complete

        // Schedule the final restore completion with a longer delay
        // This gives time for:
        // - Windows to fully initialize
        // - Workspace changes to complete (change_workspace is async)
        // - Position restore callbacks to finish
        this.scheduleRestoreFinalization();
    }

    /**
     * Schedule the final session restore completion
     * Called after all apps are launched, waits for positioning to settle
     */
    scheduleRestoreFinalization() {
        // Cancel any existing finalization timer
        if (this._restoreFinalizeTimeoutId) {
            GLib.source_remove(this._restoreFinalizeTimeoutId);
        }

        // Wait 3 seconds for async workspace changes to stabilize
        // Expected-Launch tracking now handles late-starting apps, so we don't need the long 10s delay
        const FINALIZE_DELAY = 3000;

        global.log(`${UUID}: Scheduling restore finalization in ${FINALIZE_DELAY}ms`);

        this._restoreFinalizeTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, FINALIZE_DELAY, () => {
            this._restoreFinalizeTimeoutId = null;
            this.finalizeSessionRestore();
            return GLib.SOURCE_REMOVE;
        });
    }

    /**
     * Finalize session restore - called after all windows are positioned
     * Clears restore flag, unblocks saves, and triggers a full save
     * @param {boolean} [skipWorkspaceFocus=false] - Skip focusing Workspace 1 (for fallback timeout)
     */
    finalizeSessionRestore(skipWorkspaceFocus = false) {
        if (!this._tracker._isRestoringSession) {
            return; // Already completed
        }

        global.log(`${UUID}: Finalizing session restore...`);

        // Inform SessionLauncher: cleanup any expired grace periods
        if (this._launcher) {
            this._launcher.finalizeRestore();
        }

        this._tracker._isRestoringSession = false;

        // NOW we can safely unblock saves
        this._storage.unblockSaves();

        global.log(`${UUID}: Session restore FINALIZED - saves now enabled`);

        // Return focus to Workspace 1 so user sees the restored session
        // (apps may have grabbed focus to other workspaces during launch)
        // Skip this if called from fallback timeout - user may have manually switched workspaces
        if (!skipWorkspaceFocus) {
            this._focusWorkspace1();
        }

        // Do a full save of all windows in their final positions
        // Cleanup will now only remove truly orphaned instances (not expected ones)
        this._saveAllWindows();
    }

    /**
     * Launch all missing instances from saved session
     * Builds instance list and delegates ALL filtering to SessionLauncher
     * (blacklist, running count, max instances, single-instance handling)
     */
    launchMissingInstances() {
        if (!this._storage || !this._launcher) return;

        // Build raw list of ALL saved instances
        const apps = this._storage.getAllApps();

        // Run plugin deduplication hooks BEFORE building launch list
        // This removes duplicate instances (e.g., LibreOffice same document)
        this.runPluginDeduplication(apps);

        const instancesToLaunch = [];

        for (const wmClass in apps) {
            const appData = apps[wmClass];
            if (!appData.instances) continue;

            for (const instance of appData.instances) {
                instancesToLaunch.push({
                    wmClass: wmClass,
                    appData: appData,
                    instance: instance
                });
            }
        }

        // Delegate to SessionLauncher - it handles:
        // - Blacklist filtering
        // - Running window count
        // - MAX_INSTANCES_PER_APP limit
        // - Single-instance app handling
        // - Browser session restore
        // - Progress window
        if (instancesToLaunch.length > 0) {
            global.log(`${UUID}: Passing ${instancesToLaunch.length} instances to SessionLauncher`);
            this._launcher.launchInstances(instancesToLaunch);
        } else {
            global.log(`${UUID}: No instances to launch`);
        }
    }

    /**
     * Run plugin deduplication hooks before session restore
     * Plugins can remove duplicate instances (e.g., LibreOffice same document across Soffice/libreoffice-calc)
     *
     * @param {Object} apps - All apps from storage (modified in place)
     */
    runPluginDeduplication(apps) {
        if (!this._pluginManager || !apps) return;

        let totalRemoved = 0;

        // Get all plugins and check for deduplicateInstances hook
        const plugins = this._pluginManager.getAllPlugins();
        for (const plugin of plugins) {
            if (plugin.handler && typeof plugin.handler.deduplicateInstances === 'function') {
                try {
                    const removed = plugin.handler.deduplicateInstances(apps);
                    if (removed > 0) {
                        totalRemoved += removed;
                        // Save after deduplication to persist the changes
                        this._storage.save();
                    }
                } catch (e) {
                    global.logError(`${UUID}: Plugin deduplication failed for ${plugin.name}: ${e}`);
                }
            }
        }

        if (totalRemoved > 0) {
            global.log(`${UUID}: Plugin deduplication removed ${totalRemoved} duplicate instances`);
        }
    }

    /**
     * Save ALL currently open windows to storage
     * Called after session restore completes to capture any new windows
     * @private
     */
    _saveAllWindows() {
        if (!this._tracker || !this._storage) return;

        let savedCount = 0;
        global.get_window_actors().forEach(actor => {
            const metaWindow = actor.get_meta_window();
            if (metaWindow && this._tracker._windowFilter.shouldTrack(metaWindow)) {
                // Mark window as dirty via _onWindowChanged
                this._tracker._onWindowChanged(metaWindow);
                savedCount++;
            }
        });

        this._storage.save();
        global.log(`${UUID}: Full save completed - ${savedCount} windows saved`);
    }

    /**
     * Cancel pending timeouts (called during disable)
     */
    destroy() {
        if (this._startupTimeoutId) {
            Mainloop.source_remove(this._startupTimeoutId);
            this._startupTimeoutId = null;
        }
        if (this._restoreFinalizeTimeoutId) {
            GLib.source_remove(this._restoreFinalizeTimeoutId);
            this._restoreFinalizeTimeoutId = null;
        }
    }
};
