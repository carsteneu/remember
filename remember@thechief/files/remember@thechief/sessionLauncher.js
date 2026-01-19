/**
 * Session Launcher Module for Window Position Remember Extension
 *
 * Handles launching applications for session restore.
 * Uses plugin system for app-specific launch logic.
 */

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;

const UUID = "remember@thechief";

// NOTE: All config constants moved to config.js (SESSION_LAUNCH_CONFIG)
// They are passed via constructor parameter (this._launchConfig)

/**
 * Session Launcher Class
 * Handles launching applications for session restore
 */
var SessionLauncher = class SessionLauncher {
    constructor(storage, tracker, extensionSettings, pluginManager = null, launchConfig = null, singleInstanceConfig = null) {
        this._storage = storage;
        this._tracker = tracker;
        this._extensionSettings = extensionSettings;
        this._pluginManager = pluginManager;

        // Config from config.js (SESSION_LAUNCH_CONFIG) - required, no fallback
        if (!launchConfig) {
            throw new Error(`${UUID}: launchConfig is required for SessionLauncher`);
        }
        this._launchConfig = launchConfig;

        // Single-instance config from config.js - required, no fallback
        if (!singleInstanceConfig) {
            throw new Error(`${UUID}: singleInstanceConfig is required for SessionLauncher`);
        }
        this._singleInstanceConfig = singleInstanceConfig;

        // Track pending launches by instance ID for multi-instance support
        this._pendingLaunches = new Map();  // instanceId -> { wmClass, instance, launchTime }
        this._launchTimeouts = new Map();   // instanceId -> timeoutId
        this._launchQueue = [];             // Queue of instances to launch
        this._launchQueueTimer = null;
        this._onAllLaunchedCallback = null; // Callback when all launches complete
        this._totalLaunches = 0;            // Total number of launches started

        // Expected launches registry - tracks instances even after timeout
        this._expectedLaunches = new Map(); // instanceId -> { wmClass, instance, startTime, timeout, timedOut, gracePeriod }
        this._launchAttempts = new Map();   // instanceId -> attemptCount (for future retry logic)
        this._launchPids = new Map();       // instanceId -> GPid (for process monitoring)

        // Progress IDs map - for single-instance apps, maps primary instanceId to all covered instanceIds
        this._progressIdsMap = new Map();   // instanceId -> [instanceId1, instanceId2, ...]
    }

    /**
     * Set plugin manager (can be set after construction)
     */
    setPluginManager(pluginManager) {
        this._pluginManager = pluginManager;
    }

    /**
     * Set callback for when all launches are complete
     */
    setOnAllLaunchedCallback(callback) {
        this._onAllLaunchedCallback = callback;
    }

    /**
     * Check if all launches are complete and notify
     */
    _checkAllLaunchesComplete() {
        const hasActivePending = this._pendingLaunches.size > 0;

        // Check for expected launches still within grace period
        const hasActiveExpected = Array.from(this._expectedLaunches.values()).some(e => {
            if (!e.timedOut) return true;
            return Date.now() < e.gracePeriod;
        });

        if (!hasActivePending && !hasActiveExpected && this._launchQueue.length === 0) {
            if (this._onAllLaunchedCallback && this._totalLaunches > 0) {
                global.log(`${UUID}: All ${this._totalLaunches} launches completed`);
                this._onAllLaunchedCallback();
                this._onAllLaunchedCallback = null;
            }
        }
    }

    /**
     * Get progress IDs for an instance (for single-instance apps, returns all covered instances)
     */
    _getProgressIds(instanceId) {
        if (this._progressIdsMap && this._progressIdsMap.has(instanceId)) {
            return this._progressIdsMap.get(instanceId);
        }
        return [instanceId];
    }

    /**
     * Notify progress via status file (for Python progress window)
     * Uses instanceId as key to support multiple instances of same app
     * @param {string|string[]} instanceIds - Single instanceId or array of instanceIds
     * @param {string} wmClass - Window class name
     * @param {string} status - Status string
     */
    _notifyProgress(instanceIds, wmClass, status) {
        // Support both single instanceId and array of instanceIds
        // Also lookup progressIdsMap for single-instance apps
        let ids;
        if (Array.isArray(instanceIds)) {
            ids = instanceIds;
        } else {
            ids = this._getProgressIds(instanceIds);
        }

        global.log(`${UUID}: Progress status: ${ids.join(', ')} (${wmClass}) -> ${status}`);

        try {
            const statusFile = GLib.build_filenamev([
                GLib.get_home_dir(),
                '.config',
                'remember@thechief',
                'progress-status.json'
            ]);

            let statusData = {};
            const file = Gio.File.new_for_path(statusFile);
            if (file.query_exists(null)) {
                const [success, contents] = file.load_contents(null);
                if (success) {
                    statusData = JSON.parse(imports.byteArray.toString(contents));
                }
            }

            // Update all instanceIds with the same status
            const timestamp = Date.now();
            for (const instanceId of ids) {
                statusData[instanceId] = {
                    wmClass: wmClass,
                    status: status,
                    timestamp: timestamp
                };
            }

            const data = JSON.stringify(statusData, null, 2);
            file.replace_contents(
                data,
                null,
                false,
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null
            );
        } catch (e) {
            global.logError(`${UUID}: Failed to write progress status: ${e}`);
        }
    }

    /**
     * Launch Python GTK progress window
     * Shows restore progress to user
     */
    _launchProgressWindow(instancesToLaunch) {
        try {
            // Clear old progress status file before starting new restore
            this._clearProgressStatus();

            // Build JSON data for progress window
            // Use pre-computed instanceId from launch queue items
            const appsData = instancesToLaunch.map(item => ({
                instanceId: item.instanceId,
                wmClass: item.wmClass,
                instance: {
                    workspace: item.instance.workspace || 0,
                    monitor_index: item.instance.monitor_index || 0,
                    title: item.instance.title_snapshot || item.wmClass,
                    geometry_percent: item.instance.geometry_percent || null,
                    geometry_absolute: item.instance.geometry_absolute || null
                }
            }));

            const jsonData = JSON.stringify(appsData);

            // Launch progress window Python script
            const scriptPath = GLib.build_filenamev([
                GLib.get_home_dir(),
                '.local', 'share', 'cinnamon', 'extensions', UUID,
                'progress_window.py'
            ]);

            // Use spawn_async with argv array - NO shell interpolation (prevents injection)
            GLib.spawn_async(
                null,  // working directory (inherit)
                ['python3', scriptPath, jsonData],  // argv array
                null,  // envp (inherit)
                GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                null   // child setup
            );
            global.log(`${UUID}: Launched progress window with ${instancesToLaunch.length} apps`);
        } catch (e) {
            global.logError(`${UUID}: Failed to launch progress window: ${e}`);
        }
    }

    /**
     * Clear old progress status file
     */
    _clearProgressStatus() {
        try {
            const statusFile = GLib.build_filenamev([
                GLib.get_home_dir(),
                '.config',
                UUID,
                'progress-status.json'
            ]);

            const file = Gio.File.new_for_path(statusFile);
            if (file.query_exists(null)) {
                // Write empty object to clear all old statuses
                file.replace_contents(
                    '{}',
                    null,
                    false,
                    Gio.FileCreateFlags.REPLACE_DESTINATION,
                    null
                );
                global.log(`${UUID}: Cleared progress status file`);
            }
        } catch (e) {
            global.logError(`${UUID}: Failed to clear progress status: ${e}`);
        }
    }

    /**
     * Filter and validate instances before launching
     * - Checks blacklist
     * - Counts running windows per wmClass
     * - Checks which saved instances are already assigned to running windows
     * - Only launches instances that don't have a matching running window
     * - Applies MAX_INSTANCES_PER_APP limit
     * @param {Array} instances - Raw instance list
     * @returns {Array} - Filtered instance list
     */
    _filterAndValidateInstances(instances) {
        if (!instances || instances.length === 0) {
            return [];
        }

        // Count currently running windows per wmClass
        const runningCount = new Map();
        global.get_window_actors().forEach(actor => {
            const metaWindow = actor.get_meta_window();
            if (metaWindow) {
                const wmClass = metaWindow.get_wm_class();
                if (wmClass) {
                    const key = wmClass.toLowerCase();
                    runningCount.set(key, (runningCount.get(key) || 0) + 1);
                }
            }
        });

        const blacklist = this._launchConfig.LAUNCH_BLACKLIST || [];
        const maxInstances = this._launchConfig.MAX_INSTANCES_PER_APP || 5;
        const filteredInstances = [];

        // Group by wmClass for limit checking
        const instancesByApp = new Map();
        for (const item of instances) {
            const wmClass = item.wmClass;

            // Check blacklist
            const isBlacklisted = blacklist.some(
                bl => wmClass.toLowerCase().includes(bl.toLowerCase())
            );
            if (isBlacklisted) {
                global.log(`${UUID}: ${wmClass} is blacklisted, skipping`);
                continue;
            }

            if (!instancesByApp.has(wmClass)) {
                instancesByApp.set(wmClass, []);
            }
            instancesByApp.get(wmClass).push(item);
        }

        // Apply running count and max limit per app
        // CRITICAL: Only launch instances that are NOT already assigned to running windows
        for (const [wmClass, appInstances] of instancesByApp.entries()) {
            const currentCount = runningCount.get(wmClass.toLowerCase()) || 0;

            // Count how many saved instances are already assigned to running windows
            // An instance is "assigned" if it was matched to an existing window during restore
            const assignedCount = appInstances.filter(item => item.instance.assigned === true).length;
            const unassignedInstances = appInstances.filter(item => item.instance.assigned !== true);

            // Only launch unassigned instances (windows that don't exist yet)
            // But still respect the max limit
            const availableSlots = maxInstances - currentCount;
            const needToLaunch = Math.min(unassignedInstances.length, availableSlots);

            if (needToLaunch <= 0) {
                if (currentCount > 0) {
                    global.log(`${UUID}: ${wmClass}: ${currentCount} running, ${assignedCount} assigned - all instances covered, skipping launch`);
                }
                continue;
            }

            global.log(`${UUID}: ${wmClass}: ${currentCount} running, ${assignedCount}/${appInstances.length} assigned, launching ${needToLaunch} unassigned`);

            // Add only the unassigned instances we need to launch
            for (let i = 0; i < needToLaunch; i++) {
                filteredInstances.push(unassignedInstances[i]);
            }
        }

        return filteredInstances;
    }

    /**
     * Launch instances passed from extension.js
     * Handles single-instance logic, browser session restore, and queue building
     */
    launchInstances(instances) {
        // Filter and validate first (blacklist, running count, max limit)
        const filteredInstances = this._filterAndValidateInstances(instances);

        if (filteredInstances.length === 0) {
            global.log(`${UUID}: No instances to launch after filtering`);
            return 0;
        }

        this._launchQueue = [];

        // Group instances by wmClass
        const instancesByApp = new Map();
        for (const item of filteredInstances) {
            if (!instancesByApp.has(item.wmClass)) {
                instancesByApp.set(item.wmClass, {
                    appData: item.appData,
                    instances: []
                });
            }
            instancesByApp.get(item.wmClass).instances.push(item.instance);
        }

        // Build launch queue with single-instance and browser-restore handling
        // Also build a separate list of ALL instances for progress window display
        const allInstancesForProgress = [];

        for (const [wmClass, data] of instancesByApp.entries()) {
            const { appData, instances: appInstances } = data;

            // Check single-instance status via plugin or fallback list
            const isSingleInstance = this._isSingleInstance(wmClass);

            // Check if this is a browser with browser session restore enabled
            const plugin = this._pluginManager ? this._pluginManager.getPlugin(wmClass) : null;
            const isBrowser = plugin && plugin.type === 'chromium-browser';
            const useBrowserRestore = this._extensionSettings && this._extensionSettings.useBrowserSessionRestore();

            global.log(`${UUID}: ${wmClass}: isSingleInstance=${isSingleInstance}, isBrowser=${isBrowser}, useBrowserRestore=${useBrowserRestore}, instances=${appInstances.length}`);

            const baseTime = Date.now();

            // Always add ALL instances to progress display list
            for (let i = 0; i < appInstances.length; i++) {
                const instance = appInstances[i];
                const instanceId = instance.id || `${wmClass}-${baseTime}-${i}`;
                allInstancesForProgress.push({
                    wmClass: wmClass,
                    appData: appData,
                    instance: instance,
                    instanceId: instanceId
                });
            }

            if (isSingleInstance) {
                // Single-instance apps: launch only ONCE, but all instances shown in progress
                global.log(`${UUID}: ${wmClass} is single-instance app - launching once, showing ${appInstances.length} instances in progress`);
                const instance = appInstances[0];
                const instanceId = instance.id || `${wmClass}-${baseTime}-0`;
                this._launchQueue.push({
                    wmClass: wmClass,
                    appData: appData,
                    instance: instance,
                    instanceId: instanceId,
                    needsSequential: false,
                    // Track all instanceIds that this single launch covers
                    coveredInstanceIds: appInstances.map((inst, idx) => inst.id || `${wmClass}-${baseTime}-${idx}`)
                });
            } else {
                // Normal multi-instance app: launch all instances
                const needsSequential = appInstances.length > 1;
                if (needsSequential) {
                    global.log(`${UUID}: ${wmClass} has ${appInstances.length} instances - will launch sequentially`);
                }

                for (let i = 0; i < appInstances.length; i++) {
                    const instance = appInstances[i];
                    const instanceId = instance.id || `${wmClass}-${baseTime}-${i}`;
                    this._launchQueue.push({
                        wmClass: wmClass,
                        appData: appData,
                        instance: instance,
                        instanceId: instanceId,
                        needsSequential: needsSequential
                    });
                }
            }
        }

        const totalCount = this._launchQueue.length;
        const displayCount = allInstancesForProgress.length;
        global.log(`${UUID}: Launch queue built with ${totalCount} launches, ${displayCount} instances to display`);

        if (this._launchQueue.length > 0) {
            // Launch progress window with ALL instances (not just launches)
            this._launchProgressWindow(allInstancesForProgress);

            this._processLaunchQueue();
        }

        return displayCount;
    }

    /**
     * Launch all apps with autostart enabled (manual session launch via API)
     */
    launchSession() {
        const apps = this._storage.getAllApps();
        const instances = [];

        for (const wmClass in apps) {
            const appData = apps[wmClass];
            if (!appData.instances) continue;

            const autostartInstances = appData.instances.filter(i => i.autostart);
            for (const instance of autostartInstances) {
                instances.push({
                    wmClass: wmClass,
                    appData: appData,
                    instance: instance
                });
            }
        }

        return this.launchInstances(instances);
    }

    /**
     * Process launch queue with delay between launches
     */
    _processLaunchQueue() {
        if (this._launchQueue.length === 0) {
            global.log(`${UUID}: Launch queue completed`);
            this._checkAllLaunchesComplete();
            return;
        }

        const item = this._launchQueue.shift();
        const wmClass = item.wmClass;
        const instanceId = item.instanceId;  // Use pre-computed instanceId from queue

        // For single-instance apps, update all covered instances in progress window
        const progressIds = item.coveredInstanceIds || [instanceId];

        // Store progressIds for status updates (single-instance apps cover multiple instances)
        this._progressIdsMap.set(instanceId, progressIds);

        // Launch the app
        this._notifyProgress(progressIds, wmClass, 'launching');
        this._launchApp(wmClass, item.appData, item.instance, instanceId);

        // Determine delay until next launch
        let delay = this._launchConfig.LAUNCH_DELAY_BETWEEN_APPS;

        // If this app needs sequential launching and there are more instances of the same app
        if (item.needsSequential) {
            const hasMoreOfSameApp = this._launchQueue.some(i => i.wmClass === wmClass);
            if (hasMoreOfSameApp) {
                // Use longer delay for same app (wait for window to appear and stabilize)
                delay = 2000; // 2 seconds between instances of same app
                global.log(`${UUID}: ${wmClass} needs sequential launch, waiting ${delay}ms for next instance`);
            }
        }

        if (this._launchQueue.length > 0) {
            this._launchQueueTimer = Mainloop.timeout_add(
                delay,
                () => {
                    this._processLaunchQueue();
                    return false;
                }
            );
        }
    }

    /**
     * Launch a single application instance
     * @param {string} instanceId - Pre-computed unique instance ID for progress tracking
     */
    _launchApp(wmClass, appData, instance, instanceId) {
        let workDir = instance.working_dir || GLib.get_home_dir();

        // Validate working directory
        if (workDir && workDir !== GLib.get_home_dir()) {
            const workDirFile = Gio.File.new_for_path(workDir);
            if (!workDirFile.query_exists(null)) {
                global.log(`${UUID}: Working dir ${workDir} doesn't exist, using home dir`);
                workDir = GLib.get_home_dir();
            }
        }

        // Check if we have a plugin for this app
        const plugin = this._pluginManager ? this._pluginManager.getPlugin(wmClass) : null;
        const handler = this._pluginManager ? this._pluginManager.getHandler(wmClass) : null;

        if (plugin) {
            // Plugin-based launch
            this._launchWithPlugin(plugin, handler, wmClass, appData, instance, workDir, instanceId);
        } else if (appData.desktop_file) {
            // Desktop file launch (legacy fallback)
            this._launchDesktopFile(appData.desktop_file, wmClass, instance, instanceId);
        } else {
            // Generic launch (last resort)
            this._launchGeneric(wmClass, appData, instance, workDir, instanceId);
        }
    }

    /**
     * Launch app using plugin configuration and handler
     */
    _launchWithPlugin(plugin, handler, wmClass, appData, instance, workDir, instanceId) {
        try {
            // 0. Check if plugin handler wants to skip this instance
            // Used for transient windows (Thunderbird Compose, etc.) that can't be restored
            if (handler && typeof handler.shouldSkipRestore === 'function') {
                try {
                    if (handler.shouldSkipRestore(instance)) {
                        global.log(`${UUID}: Skipping ${wmClass} instance "${instance.id}" - plugin requested skip`);
                        // Mark as complete so it doesn't block restore
                        this._pendingLaunches.delete(instanceId);
                        this._expectedLaunches.delete(instanceId);
                        this._notifyProgress(instanceId, wmClass, 'skipped');
                        this._checkAllLaunchesComplete();
                        return;
                    }
                } catch (e) {
                    global.logError(`${UUID}: Plugin ${plugin.name} shouldSkipRestore failed: ${e}`);
                }
            }

            // 1. Resolve executable from plugin config
            let executable = this._resolveExecutable(plugin.launch.executables);

            // If no executable in plugin, try desktop file or cmdline
            if (!executable) {
                if (instance.cmdline && instance.cmdline.length > 0) {
                    executable = instance.cmdline[0];
                } else {
                    executable = wmClass.toLowerCase();
                }
            }

            // 2. Build args from plugin config
            let args = [...(plugin.launch.flags || [])];

            // Add conditional flags based on settings
            if (plugin.launch.conditionalFlags) {
                for (const [settingKey, flags] of Object.entries(plugin.launch.conditionalFlags)) {
                    // Check if setting is enabled (defaults to true if not set)
                    if (this._extensionSettings.get(settingKey) !== false) {
                        args.push(...flags);
                    }
                }
            }

            // 3. Create launch params object for handler hooks
            let launchParams = {
                executable: executable,
                args: args,
                workDir: workDir
            };

            // 4. Call handler beforeLaunch hook if available
            if (handler && typeof handler.beforeLaunch === 'function') {
                try {
                    launchParams = handler.beforeLaunch(instance, launchParams) || launchParams;
                } catch (e) {
                    global.logError(`${UUID}: Plugin ${plugin.name} beforeLaunch failed: ${e}`);
                }
            }

            // 5. Parse title data if handler supports it
            // Pass both title_snapshot and full instance for document_path access
            global.log(`${UUID}: DEBUG: handler=${!!handler}, hasParseTitleData=${handler ? typeof handler.parseTitleData : 'N/A'}, title_snapshot="${instance.title_snapshot}", document_path="${instance.document_path || 'none'}"`);
            if (handler && typeof handler.parseTitleData === 'function') {
                try {
                    global.log(`${UUID}: DEBUG: Calling parseTitleData for ${wmClass}`);
                    // Pass instance as second parameter for document_path access
                    const parsedArgs = handler.parseTitleData(instance.title_snapshot, instance);
                    global.log(`${UUID}: DEBUG: parseTitleData returned: ${JSON.stringify(parsedArgs)}`);
                    if (parsedArgs && Array.isArray(parsedArgs)) {
                        launchParams.args.push(...parsedArgs);
                        global.log(`${UUID}: DEBUG: Added args: ${JSON.stringify(launchParams.args)}`);
                    }
                } catch (e) {
                    global.logError(`${UUID}: Plugin ${plugin.name} parseTitleData failed: ${e}`);
                }
            } else {
                global.log(`${UUID}: DEBUG: Skipping parseTitleData - no handler or no parseTitleData function`);
            }

            // 6. Spawn process
            const argv = [launchParams.executable, ...launchParams.args];
            const { timeout, gracePeriod, isSingleInstance } = this._getTimeouts(wmClass, plugin);

            const [success, pid] = this._spawnProcess(
                launchParams.workDir,
                argv,
                instanceId,
                wmClass,
                instance,
                isSingleInstance,
                timeout,
                gracePeriod
            );

            // 7. Call handler afterLaunch hook
            if (handler && typeof handler.afterLaunch === 'function') {
                try {
                    handler.afterLaunch(instance, pid, success);
                } catch (e) {
                    global.logError(`${UUID}: Plugin ${plugin.name} afterLaunch failed: ${e}`);
                }
            }

            const ws = instance.workspace !== undefined ? instance.workspace + 1 : '?';
            const flagsStr = launchParams.args.length > 0 ? ` with [${launchParams.args.join(', ')}]` : '';
            global.log(`${UUID}: [Plugin:${plugin.name}] Launched ${wmClass} (WS${ws})${isSingleInstance ? ' [single-instance]' : ''}${flagsStr}`);

        } catch (e) {
            global.logError(`${UUID}: Plugin launch failed for ${wmClass}: ${e}`);
            this._notifyProgress(instanceId, wmClass, 'error');
        }
    }

    /**
     * Launch via desktop file (legacy fallback when no plugin)
     */
    _launchDesktopFile(desktopFileId, wmClass, instance, instanceId) {
        try {
            const appInfo = Gio.DesktopAppInfo.new(desktopFileId);
            if (appInfo) {
                // Note: gracePeriod is calculated in _onLaunchTimeout based on isSingleInstance
                const { timeout, isSingleInstance } = this._getTimeouts(wmClass);

                // Register pending launch
                this._pendingLaunches.set(instanceId, {
                    wmClass: wmClass,
                    instance: instance,
                    launchTime: Date.now()
                });

                this._expectedLaunches.set(instanceId, {
                    wmClass: wmClass,
                    instance: instance,
                    startTime: Date.now(),
                    timeout: timeout,
                    timedOut: false,
                    gracePeriod: null,
                    isSingleInstance: isSingleInstance
                });

                this._totalLaunches++;

                // Set timeout
                const timeoutId = Mainloop.timeout_add(timeout, () => {
                    this._onLaunchTimeout(instanceId);
                    return false;
                });
                this._launchTimeouts.set(instanceId, timeoutId);

                appInfo.launch([], null);

                const ws = instance.workspace !== undefined ? instance.workspace + 1 : '?';
                global.log(`${UUID}: [DesktopFile] Launched ${wmClass} (WS${ws}) via ${desktopFileId}`);
            }
        } catch (e) {
            global.logError(`${UUID}: Failed to launch desktop file ${desktopFileId}: ${e}`);
            this._notifyProgress(instanceId, wmClass, 'error');
        }
    }

    /**
     * Generic launch (last resort when no plugin and no desktop file)
     */
    _launchGeneric(wmClass, appData, instance, workDir, instanceId) {
        let argv = null;

        // Try desktop exec, then cmdline, then wmClass
        if (appData.desktop_exec) {
            argv = this._parseDesktopExec(appData.desktop_exec);
        } else if (instance.cmdline && instance.cmdline.length > 0) {
            argv = instance.cmdline;
        } else {
            argv = [wmClass.toLowerCase()];
        }

        if (!argv || argv.length === 0) {
            global.logError(`${UUID}: No launch method for ${wmClass}`);
            this._notifyProgress(instanceId, wmClass, 'error');
            return;
        }

        // Check if executable exists, if not try Flatpak fallback
        const executable = argv[0];
        const executableExists = GLib.find_program_in_path(executable) !== null;

        if (!executableExists) {
            global.log(`${UUID}: Executable '${executable}' not found in PATH, trying Flatpak...`);

            // Try common Flatpak name patterns
            const flatpakAppId = this._tryFindFlatpakApp(wmClass);
            if (flatpakAppId) {
                global.log(`${UUID}: Found Flatpak app: ${flatpakAppId}`);
                argv = ['flatpak', 'run', flatpakAppId];
            } else {
                global.logError(`${UUID}: Executable '${executable}' not found and no Flatpak alternative found`);
                this._notifyProgress(instanceId, wmClass, 'error');
                return;
            }
        }

        const { timeout, gracePeriod, isSingleInstance } = this._getTimeouts(wmClass);

        this._spawnProcess(workDir, argv, instanceId, wmClass, instance, isSingleInstance, timeout, gracePeriod);

        const ws = instance.workspace !== undefined ? instance.workspace + 1 : '?';
        global.log(`${UUID}: [Generic] Launched ${wmClass} (WS${ws})`);
    }

    /**
     * Consolidated process spawning
     */
    _spawnProcess(workDir, argv, instanceId, wmClass, instance, isSingleInstance, timeout, gracePeriod) {
        try {
            // Register pending launch
            this._pendingLaunches.set(instanceId, {
                wmClass: wmClass,
                instance: instance,
                launchTime: Date.now()
            });

            this._expectedLaunches.set(instanceId, {
                wmClass: wmClass,
                instance: instance,
                startTime: Date.now(),
                timeout: timeout,
                timedOut: false,
                gracePeriod: null,
                isSingleInstance: isSingleInstance
            });

            this._totalLaunches++;

            // Set timeout
            const timeoutId = Mainloop.timeout_add(timeout, () => {
                this._onLaunchTimeout(instanceId);
                return false;
            });
            this._launchTimeouts.set(instanceId, timeoutId);

            // Spawn process with proper detachment
            // Use nohup-like behavior to prevent process from attaching to existing instances
            const spawnArgv = ['setsid', '--fork', ...argv];
            let [success, pid] = GLib.spawn_async(
                workDir,
                spawnArgv,
                null,
                GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                null
            );

            if (success) {
                this._launchPids.set(instanceId, pid);

                // Add child watch for process monitoring
                GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, (pid, status) => {
                    this._onChildProcessExit(instanceId, pid, status);
                });

                global.log(`${UUID}: Spawned ${wmClass} with PID ${pid}`);
            } else {
                // Spawn failed immediately (executable not found, permission denied, etc.)
                global.logError(`${UUID}: Failed to spawn ${wmClass}: GLib.spawn_async returned false`);
                this._notifyProgress(instanceId, wmClass, 'error');
                this._pendingLaunches.delete(instanceId);
                this._expectedLaunches.delete(instanceId);

                const timeoutId = this._launchTimeouts.get(instanceId);
                if (timeoutId) {
                    Mainloop.source_remove(timeoutId);
                    this._launchTimeouts.delete(instanceId);
                }
            }

            return [success, pid];

        } catch (e) {
            global.logError(`${UUID}: Failed to spawn ${wmClass}: ${e}`);
            this._notifyProgress(instanceId, wmClass, 'error');
            this._pendingLaunches.delete(instanceId);
            this._expectedLaunches.delete(instanceId);

            const timeoutId = this._launchTimeouts.get(instanceId);
            if (timeoutId) {
                Mainloop.source_remove(timeoutId);
                this._launchTimeouts.delete(instanceId);
            }
            return [false, null];
        }
    }

    /**
     * Resolve executable from candidates list
     */
    _resolveExecutable(candidates) {
        if (!candidates || candidates.length === 0) return null;
        if (typeof candidates === 'string') return candidates;

        for (const candidate of candidates) {
            try {
                if (candidate.startsWith('/')) {
                    const file = Gio.File.new_for_path(candidate);
                    if (file.query_exists(null)) return candidate;
                } else {
                    const path = GLib.find_program_in_path(candidate);
                    if (path) return candidate;
                }
            } catch (e) {
                // Continue to next candidate
            }
        }

        // Fallback: return first candidate
        return candidates[0];
    }

    /**
     * Try to find Flatpak app ID for a wmClass
     * Strategy: 1. Desktop file lookup, 2. Flatpak list search, 3. Pattern guessing
     */
    _tryFindFlatpakApp(wmClass) {
        const wmClassLower = wmClass.toLowerCase();

        // Strategy 1: Search desktop files for StartupWMClass or matching name
        const desktopAppId = this._findFlatpakFromDesktopFiles(wmClassLower);
        if (desktopAppId) {
            global.log(`${UUID}: Found Flatpak via desktop file: ${desktopAppId}`);
            return desktopAppId;
        }

        // Strategy 2: Search installed Flatpak apps
        const flatpakListAppId = this._findFlatpakFromList(wmClassLower);
        if (flatpakListAppId) {
            global.log(`${UUID}: Found Flatpak via flatpak list: ${flatpakListAppId}`);
            return flatpakListAppId;
        }

        // Strategy 3: Try common Flatpak app ID patterns (legacy fallback)
        const patterns = [
            `org.${wmClassLower}.${wmClass}`,  // org.gimp.GIMP
            `org.${wmClassLower}.${wmClass.toUpperCase()}`,
            `org.gnome.${wmClass}`,
            `com.${wmClassLower}.${wmClass}`
        ];

        for (const appId of patterns) {
            try {
                const [success] = GLib.spawn_command_line_sync(`flatpak info ${appId}`);
                if (success) {
                    global.log(`${UUID}: Found Flatpak via pattern: ${appId}`);
                    return appId;
                }
            } catch (e) {
                // Continue to next pattern
            }
        }

        return null;
    }

    /**
     * Search desktop files for Flatpak app matching wmClass
     * Checks StartupWMClass and filename for matches
     */
    _findFlatpakFromDesktopFiles(wmClassLower) {
        const desktopDirs = [
            '/var/lib/flatpak/exports/share/applications',
            GLib.build_filenamev([GLib.get_home_dir(), '.local', 'share', 'flatpak', 'exports', 'share', 'applications'])
        ];

        for (const dirPath of desktopDirs) {
            try {
                const dir = Gio.File.new_for_path(dirPath);
                if (!dir.query_exists(null)) continue;

                const enumerator = dir.enumerate_children(
                    'standard::name,standard::type',
                    Gio.FileQueryInfoFlags.NONE,
                    null
                );

                let fileInfo;
                while ((fileInfo = enumerator.next_file(null)) !== null) {
                    const filename = fileInfo.get_name();
                    if (!filename.endsWith('.desktop')) continue;

                    // Check if filename contains wmClass (e.g., "be.alexandervanhee.gradia.desktop")
                    const filenameLower = filename.toLowerCase();
                    if (filenameLower.includes(wmClassLower)) {
                        const appId = filename.replace('.desktop', '');
                        // Verify it's a valid Flatpak app
                        try {
                            const [success] = GLib.spawn_command_line_sync(`flatpak info ${appId}`);
                            if (success) return appId;
                        } catch (e) {
                            // Not a valid Flatpak, continue
                        }
                    }

                    // Check StartupWMClass inside the file
                    const filePath = GLib.build_filenamev([dirPath, filename]);
                    const startupWmClass = this._getStartupWMClass(filePath);
                    if (startupWmClass && startupWmClass.toLowerCase() === wmClassLower) {
                        const appId = filename.replace('.desktop', '');
                        try {
                            const [success] = GLib.spawn_command_line_sync(`flatpak info ${appId}`);
                            if (success) return appId;
                        } catch (e) {
                            // Not a valid Flatpak, continue
                        }
                    }
                }
            } catch (e) {
                // Directory not accessible, continue
            }
        }

        return null;
    }

    /**
     * Read StartupWMClass from a desktop file
     */
    _getStartupWMClass(filePath) {
        try {
            const [success, contents] = GLib.file_get_contents(filePath);
            if (!success) return null;

            const text = imports.byteArray.toString(contents);
            const match = text.match(/^StartupWMClass=(.+)$/m);
            return match ? match[1].trim() : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Search flatpak list for app matching wmClass
     */
    _findFlatpakFromList(wmClassLower) {
        try {
            const [success, stdout, stderr, exitCode] = GLib.spawn_command_line_sync('flatpak list --app --columns=application');
            if (!success || exitCode !== 0) return null;

            const output = imports.byteArray.toString(stdout);
            const lines = output.trim().split('\n');

            for (const line of lines) {
                const appId = line.trim();
                if (!appId) continue;

                // Check if app ID contains wmClass (e.g., "be.alexandervanhee.gradia" contains "gradia")
                if (appId.toLowerCase().includes(wmClassLower)) {
                    // Verify the app exists
                    try {
                        const [verifySuccess] = GLib.spawn_command_line_sync(`flatpak info ${appId}`);
                        if (verifySuccess) return appId;
                    } catch (e) {
                        // Continue
                    }
                }
            }
        } catch (e) {
            global.logError(`${UUID}: Failed to search flatpak list: ${e}`);
        }

        return null;
    }

    /**
     * Get timeout and grace period for an app
     * Priority: 1. Plugin features, 2. Single-instance config, 3. Default config
     * @param {string} wmClass - Window class name
     * @param {Object|null} plugin - Plugin config object (optional)
     * @returns {Object} { timeout, gracePeriod, isSingleInstance }
     */
    _getTimeouts(wmClass, plugin = null) {
        // 1. Plugin-specific timeouts take precedence
        if (plugin && plugin.features) {
            const timeout = plugin.features.timeout || this._launchConfig.APP_LAUNCH_TIMEOUT;
            const gracePeriod = plugin.features.gracePeriod || this._launchConfig.GRACE_PERIOD_AFTER_TIMEOUT;
            return {
                timeout,
                gracePeriod,
                isSingleInstance: plugin.features.isSingleInstance || false
            };
        }

        // 2. Single-instance apps get extended timeouts
        const isSingleInstance = this._isSingleInstance(wmClass);
        if (isSingleInstance) {
            return {
                timeout: this._singleInstanceConfig.timeout,
                gracePeriod: this._singleInstanceConfig.gracePeriod,
                isSingleInstance: true
            };
        }

        // 3. Default timeouts
        return {
            timeout: this._launchConfig.APP_LAUNCH_TIMEOUT,
            gracePeriod: this._launchConfig.GRACE_PERIOD_AFTER_TIMEOUT,
            isSingleInstance: false
        };
    }

    /**
     * Check if app is single-instance
     * Priority:
     * 1. Plugin config (plugin.features.isSingleInstance)
     * 2. Fallback Set (SINGLE_INSTANCE_APPS from config.js)
     *
     * Note: Plugin config always wins. The fallback Set is for apps
     * without plugins that still need single-instance behavior.
     */
    _isSingleInstance(wmClass) {
        // Plugin takes precedence
        if (this._pluginManager && this._pluginManager.hasPlugin(wmClass)) {
            return this._pluginManager.isSingleInstance(wmClass);
        }
        // Fallback for apps without plugin
        return this._singleInstanceConfig.apps.has(wmClass);
    }

    /**
     * Parse desktop exec string into argv
     */
    _parseDesktopExec(exec) {
        let cleaned = exec
            .replace(/%[uUfFdDnNickvm]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (!cleaned) return null;

        try {
            const [success, argv] = GLib.shell_parse_argv(cleaned);
            if (success && argv.length > 0) {
                return argv;
            }
        } catch (e) {
            global.logError(`${UUID}: Failed to parse exec line "${exec}": ${e}`);
        }

        return cleaned.split(' ').filter(s => s);
    }

    /**
     * Handle child process exit - detects early crashes
     *
     * NOTE: DBus-activated apps (Nemo, gnome-terminal, etc.) start a launcher process
     * that exits immediately with code 0, while the actual app is started by the DBus daemon.
     * Exit code 0 means successful handoff, NOT a crash!
     */
    _onChildProcessExit(instanceId, pid, status) {
        this._launchPids.delete(instanceId);

        if (this._pendingLaunches.has(instanceId)) {
            const pending = this._pendingLaunches.get(instanceId);
            const elapsed = Date.now() - pending.launchTime;

            // Only treat as crash if:
            // 1. Process exited within 5 seconds AND
            // 2. Exit status is NON-ZERO (actual error)
            // Exit code 0 with quick exit = DBus activation (normal behavior)
            if (elapsed < 5000 && status !== 0) {
                global.logError(`${UUID}: ${pending.wmClass} crashed early (PID ${pid}, exit ${status})`);
                this._notifyProgress(instanceId, pending.wmClass, 'error');

                this._pendingLaunches.delete(instanceId);
                this._expectedLaunches.delete(instanceId);

                const timeoutId = this._launchTimeouts.get(instanceId);
                if (timeoutId) {
                    Mainloop.source_remove(timeoutId);
                    this._launchTimeouts.delete(instanceId);
                }

                const attemptCount = (this._launchAttempts.get(instanceId) || 0) + 1;
                this._launchAttempts.set(instanceId, attemptCount);

                this._checkAllLaunchesComplete();
            } else if (elapsed < 5000 && status === 0) {
                // Quick exit with code 0 = DBus activation, not a crash
                global.log(`${UUID}: ${pending.wmClass} launcher exited (DBus activation), waiting for window`);
            }
        }
    }

    /**
     * Handle launch timeout
     */
    _onLaunchTimeout(instanceId) {
        if (this._pendingLaunches.has(instanceId)) {
            const pending = this._pendingLaunches.get(instanceId);
            global.log(`${UUID}: Launch timeout for ${pending.wmClass} (${instanceId}) - entering grace period`);
            this._notifyProgress(instanceId, pending.wmClass, 'timeout');

            this._pendingLaunches.delete(instanceId);

            const expected = this._expectedLaunches.get(instanceId);
            if (expected) {
                const gracePeriodMs = expected.isSingleInstance ?
                    this._singleInstanceConfig.gracePeriod : this._launchConfig.GRACE_PERIOD_AFTER_TIMEOUT;

                expected.timedOut = true;
                expected.gracePeriod = Date.now() + gracePeriodMs;

                const appType = expected.isSingleInstance ? ' [single-instance]' : '';
                global.log(`${UUID}: Instance ${instanceId}${appType} in grace period until ${new Date(expected.gracePeriod).toLocaleTimeString()}`);
            }
        }
        this._launchTimeouts.delete(instanceId);
        this._checkAllLaunchesComplete();
    }

    /**
     * Check if a window matches a pending launch
     * Returns {instance, instanceId} or null
     */
    checkPendingLaunch(metaWindow) {
        const wmClass = metaWindow.get_wm_class();
        if (!wmClass) return null;

        for (const [instanceId, pending] of this._pendingLaunches.entries()) {
            // Check direct wmClass match OR related wmClass via plugin
            if (this._wmClassMatches(wmClass, pending.wmClass)) {
                this._pendingLaunches.delete(instanceId);
                this._expectedLaunches.delete(instanceId);

                const timeoutId = this._launchTimeouts.get(instanceId);
                if (timeoutId) {
                    Mainloop.source_remove(timeoutId);
                    this._launchTimeouts.delete(instanceId);
                }

                global.log(`${UUID}: Window appeared for launched app: ${wmClass} (${instanceId})`);
                this._notifyProgress(instanceId, wmClass, 'positioning');

                this._checkAllLaunchesComplete();

                // Return both instance and instanceId for progress tracking
                return { instance: pending.instance, instanceId: instanceId };
            }
        }

        return null;
    }

    /**
     * Check if two wmClasses match, considering plugin-defined relationships
     * E.g., "Soffice" matches "libreoffice-calc" because LibreOffice plugin handles both
     *
     * @param {string} windowWmClass - wmClass from window
     * @param {string} pendingWmClass - wmClass from pending launch
     * @returns {boolean}
     */
    _wmClassMatches(windowWmClass, pendingWmClass) {
        // Direct match
        if (windowWmClass === pendingWmClass) return true;

        // Check if both belong to the same plugin
        if (this._pluginManager) {
            const windowPlugin = this._pluginManager.getPlugin(windowWmClass);
            const pendingPlugin = this._pluginManager.getPlugin(pendingWmClass);

            if (windowPlugin && pendingPlugin && windowPlugin.name === pendingPlugin.name) {
                global.log(`${UUID}: wmClass match via plugin "${windowPlugin.name}": ${windowWmClass} ↔ ${pendingWmClass}`);
                return true;
            }
        }

        return false;
    }

    /**
     * Notify that positioning is complete for an instance
     */
    notifyPositionComplete(instanceId, wmClass) {
        if (instanceId) {
            this._notifyProgress(instanceId, wmClass, 'ready');
        }
    }

    /**
     * Check if an instance is still expected
     */
    isInstanceExpected(wmClass, instanceId) {
        const expected = this._expectedLaunches.get(instanceId);
        if (!expected || expected.wmClass !== wmClass) return false;

        if (!expected.timedOut) return true;

        if (expected.gracePeriod) {
            return Date.now() < expected.gracePeriod;
        }

        return false;
    }

    /**
     * Get all expected instance IDs for a wmClass
     */
    getExpectedInstances(wmClass) {
        return Array.from(this._expectedLaunches.values())
            .filter(e => e.wmClass === wmClass)
            .map(e => e.instance.id);
    }

    /**
     * Finalize restore - cleanup expired grace periods
     */
    finalizeRestore() {
        const now = Date.now();
        const toRemove = [];

        for (const [instanceId, expected] of this._expectedLaunches.entries()) {
            if (expected.timedOut && expected.gracePeriod && now >= expected.gracePeriod) {
                toRemove.push(instanceId);
                global.log(`${UUID}: Grace period expired for ${expected.wmClass} (${instanceId})`);
            }
        }

        for (const instanceId of toRemove) {
            this._expectedLaunches.delete(instanceId);
        }

        if (toRemove.length > 0) {
            global.log(`${UUID}: Finalized restore, cleaned ${toRemove.length} expired expected launches`);
        }
    }

    /**
     * Get launch statistics
     */
    getStats() {
        return {
            pending: this._pendingLaunches.size,
            expected: this._expectedLaunches.size
        };
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this._launchQueueTimer) {
            Mainloop.source_remove(this._launchQueueTimer);
            this._launchQueueTimer = null;
        }
        this._launchQueue = [];

        for (const timeoutId of this._launchTimeouts.values()) {
            Mainloop.source_remove(timeoutId);
        }
        this._launchTimeouts.clear();
        this._pendingLaunches.clear();
        this._expectedLaunches.clear();
        this._launchAttempts.clear();
        this._launchPids.clear();
    }
};
