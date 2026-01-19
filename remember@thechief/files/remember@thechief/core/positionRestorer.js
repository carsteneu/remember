/**
 * Position Restorer Module for Window Position Remember Extension
 *
 * Handles restoring window positions from saved data.
 * Extracted from windowTracker.js for modularity.
 */

const Meta = imports.gi.Meta;
const Mainloop = imports.mainloop;

const UUID = "remember@thechief";

const CONFIG = {
    RESTORE_DELAY: 500,
    MIN_WINDOW_WIDTH: 200,
    MIN_WINDOW_HEIGHT: 150
};

/**
 * Position Restorer Class
 * Handles restoring window positions from saved data
 */
var PositionRestorer = class PositionRestorer {
    /**
     * Create a PositionRestorer instance
     * @param {Object} options - Configuration options
     * @param {Object} options.storage - Storage instance for accessing saved data
     * @param {Object} options.monitorManager - Monitor manager for monitor identification
     * @param {Object} options.preferences - Preferences instance for user settings
     * @param {Object} options.pluginManager - Plugin manager for app-specific handlers
     * @param {Object} options.sessionLauncher - Session launcher for pending launch tracking
     * @param {Function} options.getX11WindowIdFn - Function to get X11 window ID
     * @param {Function} options.findInstanceForWindowFn - Function to find matching instance for a window
     */
    constructor(options) {
        this._storage = options.storage;
        this._monitorManager = options.monitorManager;
        this._preferences = options.preferences;
        this._pluginManager = options.pluginManager;
        this._sessionLauncher = options.sessionLauncher;
        this._getX11WindowIdFn = options.getX11WindowIdFn;
        this._findInstanceForWindowFn = options.findInstanceForWindowFn;
    }

    /**
     * Try to restore window position from saved data
     * @param {Meta.Window} metaWindow - The window to restore
     * @param {boolean} isNewWindow - True if window was just created (from window-created signal)
     * @param {Object} launchedInstance - The instance from sessionLauncher (if this window was auto-launched)
     * @param {string} instanceId - The instanceId for progress tracking (if this window was auto-launched)
     */
    tryRestorePosition(metaWindow, isNewWindow = false, launchedInstance = null, instanceId = null) {
        const wmClass = metaWindow.get_wm_class();
        const appData = this._storage.getApp(wmClass);

        // If no saved data found, mark as ready (nothing to restore)
        if (!appData || !appData.instances || appData.instances.length === 0) {
            if (this._sessionLauncher && instanceId) {
                this._sessionLauncher.notifyPositionComplete(instanceId, wmClass);
            }
            return;
        }

        // Use the launched instance directly if provided (avoids mismatches during session restore)
        let instance = launchedInstance;

        // If no launched instance, find best match from saved data
        if (!instance) {
            instance = this._findInstanceForWindowFn(metaWindow, appData);
        } else {
            // Mark launched instance as assigned and update IDs
            const windowSeq = metaWindow.get_stable_sequence();
            const windowXid = this._getX11WindowIdFn(metaWindow);
            instance.assigned = true;
            instance.stable_sequence = windowSeq;
            if (windowXid) {
                instance.x11_window_id = windowXid;
            }
            global.log(`${UUID}: Using launched instance ${instance.id} for ${wmClass}`);
        }

        if (!instance) {
            // No matching instance found, mark as ready (can't restore)
            if (this._sessionLauncher && instanceId) {
                this._sessionLauncher.notifyPositionComplete(instanceId, wmClass);
            }
            return;
        }

        // Check if plugin has custom restore timings (for apps that self-position quickly)
        let restoreTimings = null;
        if (this._pluginManager) {
            const handler = this._pluginManager.getHandler(wmClass);
            if (handler && handler.restoreTimings) {
                restoreTimings = handler.restoreTimings;
                global.log(`${UUID}: Using custom restore timings for ${wmClass}: [${restoreTimings}]ms`);
            }
        }

        // Only minimize newly created windows to avoid flicker during launch
        // Existing windows (from Cinnamon restart) should NOT be minimized
        // IMPORTANT: Only minimize if the window should NOT be visible (instance.minimized === true)
        const wasMinimized = metaWindow.minimized;
        const shouldBeMinimized = instance.minimized === true;

        if (isNewWindow && !wasMinimized && !instance.maximized && !shouldBeMinimized) {
            // Temporarily minimize to avoid flicker - we'll unminimize after positioning
            metaWindow.minimize();
        }

        // Helper to notify ready status after positioning
        const notifyReady = () => {
            if (this._sessionLauncher && instanceId) {
                this._sessionLauncher.notifyPositionComplete(instanceId, wmClass);
            }
        };

        // If plugin specifies custom restore timings, use multiple attempts
        if (restoreTimings && restoreTimings.length > 0) {
            // Don't minimize for apps with aggressive self-positioning
            if (isNewWindow && metaWindow.minimized && !shouldBeMinimized) {
                metaWindow.unminimize();
            }

            // Schedule multiple restore attempts at specified timings
            const lastIndex = restoreTimings.length - 1;
            restoreTimings.forEach((delay, index) => {
                Mainloop.timeout_add(delay, () => {
                    if (!metaWindow || metaWindow.is_on_all_workspaces === undefined) {
                        return false; // Window was destroyed
                    }
                    global.log(`${UUID}: Restore attempt ${index + 1}/${restoreTimings.length} for ${wmClass} at ${delay}ms`);
                    this.applyPosition(metaWindow, instance);
                    // Notify ready after last attempt
                    if (index === lastIndex) {
                        notifyReady();
                    }
                    return false;
                });
            });
        } else {
            // Default behavior: single restore attempt after delay
            Mainloop.timeout_add(CONFIG.RESTORE_DELAY, () => {
                // Unminimize FIRST if we minimized it temporarily (and it should NOT stay minimized)
                if (isNewWindow && !wasMinimized && metaWindow.minimized && !instance.maximized && !shouldBeMinimized) {
                    metaWindow.unminimize();
                    // Wait for unminimize to complete before positioning
                    Mainloop.timeout_add(100, () => {
                        this.applyPosition(metaWindow, instance);
                        notifyReady();
                        return false;
                    });
                } else {
                    // Apply directly if not minimized
                    this.applyPosition(metaWindow, instance);
                    notifyReady();
                }
                return false;
            });
        }
    }

    /**
     * Apply saved position to a window
     * @param {Meta.Window} metaWindow - The window to position
     * @param {Object} instance - The saved instance data with geometry
     */
    applyPosition(metaWindow, instance) {
        if (!metaWindow || metaWindow.is_on_all_workspaces === undefined) {
            return;  // Window destroyed
        }

        try {
            // Move to workspace FIRST (before any position/maximize operations)
            if (this._preferences.shouldRestoreWorkspace() && instance.workspace !== undefined && !instance.sticky) {
                const workspaceManager = global.workspace_manager;
                const numWorkspaces = workspaceManager.get_n_workspaces();
                const targetWsIndex = instance.workspace;

                global.log(`${UUID}: Workspace restore: ${metaWindow.get_wm_class()} -> WS ${targetWsIndex + 1} (${numWorkspaces} available)`);

                // Ensure target workspace exists
                if (targetWsIndex >= 0 && targetWsIndex < numWorkspaces) {
                    const targetWs = workspaceManager.get_workspace_by_index(targetWsIndex);
                    const currentWs = metaWindow.get_workspace();
                    const currentWsIndex = currentWs ? currentWs.index() : -1;

                    if (targetWs && !metaWindow.is_on_all_workspaces() && currentWsIndex !== targetWsIndex) {
                        metaWindow.change_workspace(targetWs);
                        global.log(`${UUID}: Moved ${metaWindow.get_wm_class()} from WS ${currentWsIndex + 1} to WS ${targetWsIndex + 1}`);
                    } else if (currentWsIndex === targetWsIndex) {
                        global.log(`${UUID}: ${metaWindow.get_wm_class()} already on correct WS ${targetWsIndex + 1}`);
                    }
                } else {
                    global.log(`${UUID}: WARNING: Target workspace ${targetWsIndex + 1} doesn't exist (only ${numWorkspaces} available)`);
                }
            }

            // Handle maximized windows
            if (instance.maximized) {
                metaWindow.unmaximize(Meta.MaximizeFlags.BOTH); // Unmaximize first if needed
                metaWindow.maximize(Meta.MaximizeFlags.BOTH);
                global.log(`${UUID}: Maximized window ${metaWindow.get_wm_class()}`);
                return;
            }

            // Unmaximize if needed
            if (metaWindow.get_maximized() !== 0) {
                metaWindow.unmaximize(Meta.MaximizeFlags.BOTH);
            }

            // Find target monitor using EDID/connector/layout-based matching
            let monitorInfo = null;
            if (this._monitorManager && instance.monitor_id) {
                // Pass saved layout for layout-based fallback matching
                const savedLayout = this._storage.getMonitorLayout();
                monitorInfo = this._monitorManager.findMonitorForId(instance.monitor_id, savedLayout);
            }

            // Fallback to index-based matching if monitor manager didn't find a match
            if (!monitorInfo && instance.monitor_index !== undefined) {
                const nMonitors = global.display.get_n_monitors();

                // Use saved monitor_index if it still exists in current setup
                if (instance.monitor_index < nMonitors) {
                    monitorInfo = {
                        index: instance.monitor_index,
                        geometry: global.display.get_monitor_geometry(instance.monitor_index)
                    };
                    global.log(`${UUID}: Using saved monitor_index ${instance.monitor_index}`);
                }
                // Otherwise fallback to primary (index 0)
                else {
                    monitorInfo = {
                        index: 0,
                        geometry: global.display.get_monitor_geometry(0)
                    };
                    global.log(`${UUID}: Saved monitor_index ${instance.monitor_index} doesn't exist, using primary`);
                }
            }

            // Last resort: use primary monitor
            if (!monitorInfo) {
                monitorInfo = {
                    index: 0,
                    geometry: global.display.get_monitor_geometry(0)
                };
            }

            const monitorGeom = monitorInfo.geometry;

            // Calculate target position
            let targetX, targetY, targetWidth, targetHeight;

            if (instance.geometry_percent) {
                // Use percentage-based positioning (adapts to resolution changes)
                targetX = monitorGeom.x + Math.round(instance.geometry_percent.x * monitorGeom.width);
                targetY = monitorGeom.y + Math.round(instance.geometry_percent.y * monitorGeom.height);
                targetWidth = Math.round(instance.geometry_percent.width * monitorGeom.width);
                targetHeight = Math.round(instance.geometry_percent.height * monitorGeom.height);
            } else if (instance.geometry_absolute) {
                // Fallback to absolute positioning
                targetX = instance.geometry_absolute.x;
                targetY = instance.geometry_absolute.y;
                targetWidth = instance.geometry_absolute.width;
                targetHeight = instance.geometry_absolute.height;
            } else {
                return;  // No geometry data
            }

            // Apply minimum size constraints
            targetWidth = Math.max(targetWidth, CONFIG.MIN_WINDOW_WIDTH);
            targetHeight = Math.max(targetHeight, CONFIG.MIN_WINDOW_HEIGHT);

            // Clamp to monitor bounds (prevent out-of-bounds windows)
            if (this._preferences.shouldClampToScreen()) {
                targetX = Math.max(monitorGeom.x,
                    Math.min(targetX, monitorGeom.x + monitorGeom.width - targetWidth));
                targetY = Math.max(monitorGeom.y,
                    Math.min(targetY, monitorGeom.y + monitorGeom.height - targetHeight));
            }

            // Workspace was already changed at the beginning of this function

            // Apply extended window states BEFORE position (conditional based on preferences)
            // Sticky (on all workspaces)
            if (this._preferences.shouldRememberSticky() && instance.sticky) {
                metaWindow.stick();
            } else if (metaWindow.is_on_all_workspaces()) {
                metaWindow.unstick();
            }

            // Always on top
            if (this._preferences.shouldRememberAlwaysOnTop() && instance.alwaysOnTop) {
                metaWindow.make_above();
            } else if (metaWindow.is_above()) {
                metaWindow.unmake_above();
            }

            // Fullscreen
            if (this._preferences.shouldRememberFullscreen() && instance.fullscreen) {
                metaWindow.make_fullscreen();
            } else if (metaWindow.is_fullscreen()) {
                metaWindow.unmake_fullscreen();
            }

            // Skip taskbar (read-only property, cannot be set)
            // Note: skipTaskbar is managed by the application itself, not by window manager

            // Apply position
            metaWindow.move_resize_frame(
                false,  // user_op
                targetX,
                targetY,
                targetWidth,
                targetHeight
            );

            // Shaded (rolled up) - apply AFTER position
            if (this._preferences.shouldRememberShaded() && instance.shaded) {
                metaWindow.shade();
            } else if (metaWindow.shaded) {
                metaWindow.unshade();
            }

            // Minimized state - only restore if preference enabled
            if (instance.minimized && this._preferences.shouldRestoreMinimized()) {
                metaWindow.minimize();
            }

            global.log(`${UUID}: Restored position for ${metaWindow.get_wm_class()}: ` +
                `${targetX},${targetY} ${targetWidth}x${targetHeight} on monitor ${instance.monitor_id || instance.monitor_index}`);

            // NOTE: 'ready' status is sent by the caller (tryRestorePosition -> notifyReady)
            // to ensure we use the correct instanceId for progress tracking

        } catch (e) {
            global.logError(`${UUID}: Failed to apply position: ${e}`);
        }
    }
};
