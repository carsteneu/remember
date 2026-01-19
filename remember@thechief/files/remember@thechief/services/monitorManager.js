/**
 * Monitor Manager Module for Window Position Remember Extension
 *
 * Handles monitor identification and EDID-based tracking.
 */

const Main = imports.ui.main;
const GLib = imports.gi.GLib;
const SignalManager = imports.misc.signalManager;

const UUID = "remember@thechief";

/**
 * Monitor Manager Class
 * Handles monitor identification and EDID-based tracking
 */
var MonitorManager = class MonitorManager {
    constructor(storage) {
        this._storage = storage;
        this._signals = new SignalManager.SignalManager(null);
        this._monitors = new Map();  // index -> monitorInfo
        this._edidCache = null;      // Cached EDID data from xrandr (read once at startup)
    }

    /**
     * Initialize monitor tracking
     */
    enable() {
        // PERFORMANCE: Cache EDID data once at startup (xrandr is expensive ~300ms)
        // EDIDs don't change when monitors are plugged/unplugged, only geometry changes
        this._edidCache = this._cacheAllEdids();

        this._updateMonitors();

        this._signals.connect(
            Main.layoutManager,
            'monitors-changed',
            this._onMonitorsChanged.bind(this)
        );

        global.log(`${UUID}: Monitor manager enabled with ${this._monitors.size} monitors`);
    }

    /**
     * Disable monitor tracking
     */
    disable() {
        this._signals.disconnectAllSignals();
        this._monitors.clear();
    }

    /**
     * Update monitor information
     */
    _updateMonitors() {
        this._monitors.clear();
        const nMonitors = global.display.get_n_monitors();

        for (let i = 0; i < nMonitors; i++) {
            const monitorInfo = this._getMonitorInfo(i);
            this._monitors.set(i, monitorInfo);

            // Store in persistent storage
            this._storage.setMonitor(monitorInfo.id, {
                name: monitorInfo.name,
                connector: monitorInfo.connector,
                lastResolution: {
                    width: monitorInfo.geometry.width,
                    height: monitorInfo.geometry.height
                }
            });
        }

        global.log(`${UUID}: Updated ${nMonitors} monitors`);
    }

    /**
     * Get monitor information including EDID if available
     */
    _getMonitorInfo(index) {
        const geometry = global.display.get_monitor_geometry(index);
        const scale = global.display.get_monitor_scale(index);

        let id = `monitor:${index}`;
        let name = `Monitor ${index + 1}`;
        let connector = null;
        let edid = null;

        // Try to get connector name via Mutter's monitor info
        try {
            // Try different methods to get monitor info
            if (global.display.get_monitor_connector) {
                connector = global.display.get_monitor_connector(index);
            }

            // Build a unique ID based on available info
            if (connector) {
                id = `connector:${connector}:${geometry.width}x${geometry.height}`;
            } else {
                id = `index:${index}:${geometry.width}x${geometry.height}`;
            }

            // PERFORMANCE: Use cached EDID data instead of calling xrandr again
            // The cache was populated once at enable() and never changes
            if (!edid && this._edidCache && connector) {
                edid = this._edidCache.get(connector);
                if (edid) {
                    global.log(`${UUID}: Using cached EDID for ${connector}: ${edid}`);
                }
            }

            if (edid) {
                id = `edid:${edid}`;
            }

        } catch (e) {
            global.logError(`${UUID}: Failed to get monitor info: ${e}`);
        }

        return {
            index: index,
            id: id,
            name: name,
            connector: connector,
            edid: edid,
            geometry: {
                x: geometry.x,
                y: geometry.y,
                width: geometry.width,
                height: geometry.height
            },
            scale: scale
        };
    }

    /**
     * Cache all EDIDs at once (called ONCE at startup)
     * PERFORMANCE: xrandr --verbose is expensive (~300ms), so we call it once
     * and cache all EDID data. EDIDs don't change, only geometry changes.
     */
    _cacheAllEdids() {
        const edidMap = new Map();  // connector -> EDID hash

        try {
            const [success, stdout, stderr, exitCode] = GLib.spawn_command_line_sync(
                'xrandr --verbose'
            );

            if (!success || exitCode !== 0) {
                global.log(`${UUID}: xrandr not available, EDID caching disabled`);
                return edidMap;
            }

            const output = imports.byteArray.toString(stdout);
            const lines = output.split('\n');

            let currentConnector = null;
            let inEdidBlock = false;
            let edidData = [];

            for (const line of lines) {
                // Match connector lines like "HDMI-1 connected..."
                const connectorMatch = line.match(/^(\S+)\s+connected/);
                if (connectorMatch) {
                    currentConnector = connectorMatch[1];
                    continue;
                }

                // Look for EDID block
                if (line.includes('EDID:')) {
                    inEdidBlock = true;
                    edidData = [];
                    continue;
                }

                // Collect EDID hex data
                if (inEdidBlock) {
                    const hexMatch = line.match(/^\s+([0-9a-fA-F]+)\s*$/);
                    if (hexMatch) {
                        edidData.push(hexMatch[1]);
                    } else if (edidData.length > 0) {
                        // End of EDID block - store it
                        inEdidBlock = false;
                        if (currentConnector) {
                            const fullEdid = edidData.join('');
                            const edidHash = this._hashString(fullEdid).substring(0, 16);
                            edidMap.set(currentConnector, edidHash);
                            global.log(`${UUID}: Cached EDID for ${currentConnector}: ${edidHash}`);
                        }
                    }
                }
            }

            global.log(`${UUID}: Cached ${edidMap.size} EDIDs from xrandr`);

        } catch (e) {
            global.logError(`${UUID}: Failed to cache EDIDs: ${e}`);
        }

        return edidMap;
    }

    /**
     * Try to get EDID via xrandr output parsing
     * DEPRECATED: Use _edidCache instead (populated once at startup)
     */
    _getEdidViaXrandr(connectorHint) {
        try {
            const [success, stdout, stderr, exitCode] = GLib.spawn_command_line_sync(
                'xrandr --verbose'
            );

            if (!success || exitCode !== 0) return null;

            const output = imports.byteArray.toString(stdout);
            const lines = output.split('\n');

            let currentConnector = null;
            let inEdidBlock = false;
            let edidData = [];

            for (const line of lines) {
                // Match connector lines like "HDMI-1 connected..."
                const connectorMatch = line.match(/^(\S+)\s+connected/);
                if (connectorMatch) {
                    currentConnector = connectorMatch[1];
                    continue;
                }

                // Look for EDID block
                if (line.includes('EDID:')) {
                    inEdidBlock = true;
                    edidData = [];
                    continue;
                }

                // Collect EDID hex data
                if (inEdidBlock) {
                    const hexMatch = line.match(/^\s+([0-9a-fA-F]+)\s*$/);
                    if (hexMatch) {
                        edidData.push(hexMatch[1]);
                    } else if (edidData.length > 0) {
                        // End of EDID block
                        inEdidBlock = false;

                        // If this matches our connector hint, return the EDID hash
                        if (connectorHint && currentConnector &&
                            currentConnector.includes(connectorHint.replace('monitor-', ''))) {
                            const fullEdid = edidData.join('');
                            // Return a hash of the EDID for identification
                            return this._hashString(fullEdid).substring(0, 16);
                        }
                    }
                }
            }
        } catch (e) {
            // xrandr not available or failed
        }
        return null;
    }

    /**
     * Simple string hash function
     */
    _hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }

    /**
     * Handle monitor configuration changes
     */
    _onMonitorsChanged() {
        global.log(`${UUID}: Monitor configuration changed`);
        this._updateMonitors();
    }

    /**
     * Get monitor by ID (EDID or connector-based)
     */
    getMonitorById(id) {
        for (const [index, info] of this._monitors) {
            if (info.id === id) {
                return info;
            }
        }
        return null;
    }

    /**
     * Get monitor by index
     */
    getMonitorByIndex(index) {
        return this._monitors.get(index) || null;
    }

    /**
     * Get primary monitor
     */
    getPrimaryMonitor() {
        const primaryIndex = global.display.get_primary_monitor();
        return this._monitors.get(primaryIndex) || this._monitors.get(0) || null;
    }

    /**
     * Get monitor fingerprint based on resolution and position relative to primary
     * This helps match monitors even when EDID/connector changes
     */
    _getMonitorFingerprint(monitorInfo) {
        const primary = this.getPrimaryMonitor();
        if (!primary) return null;

        const relX = monitorInfo.geometry.x - primary.geometry.x;
        const relY = monitorInfo.geometry.y - primary.geometry.y;

        return `${monitorInfo.geometry.width}x${monitorInfo.geometry.height}@${relX},${relY}`;
    }

    /**
     * Get current monitor layout as array of monitor info with fingerprints
     */
    getCurrentLayout() {
        const monitors = this.getAllMonitors();
        return monitors.map(m => ({
            index: m.index,
            id: m.id,
            fingerprint: this._getMonitorFingerprint(m),
            connector: m.connector,
            geometry: m.geometry
        }));
    }

    /**
     * Find best matching monitor for a saved monitor ID
     * Now supports layout-based matching as fallback
     */
    findMonitorForId(savedId, savedLayout = null) {
        // 1. Exact match
        for (const [index, info] of this._monitors) {
            if (info.id === savedId) {
                return info;
            }
        }

        // 2. Try to match by EDID portion
        if (savedId.startsWith('edid:')) {
            const savedEdid = savedId.substring(5);
            for (const [index, info] of this._monitors) {
                if (info.edid && info.edid === savedEdid) {
                    return info;
                }
            }
        }

        // 3. Try to match by connector
        if (savedId.startsWith('connector:')) {
            const parts = savedId.split(':');
            const savedConnector = parts[1];
            for (const [index, info] of this._monitors) {
                if (info.connector === savedConnector) {
                    return info;
                }
            }
        }

        // 4. NEW: Layout-based matching (resolution + position)
        if (savedLayout && savedLayout.monitors) {
            const savedMonitor = savedLayout.monitors.find(m => m.id === savedId);
            if (savedMonitor && savedMonitor.fingerprint) {
                const savedFingerprint = savedMonitor.fingerprint;

                // Search for monitor with matching fingerprint
                for (const [index, info] of this._monitors) {
                    const currentFingerprint = this._getMonitorFingerprint(info);
                    if (currentFingerprint === savedFingerprint) {
                        global.log(`${UUID}: Matched monitor via layout fingerprint: ${savedFingerprint}`);
                        return info;
                    }
                }
            }
        }

        // 5. Fallback to primary monitor
        global.log(`${UUID}: No match for monitor ${savedId}, using primary`);
        return this.getPrimaryMonitor();
    }

    /**
     * Get all monitors
     */
    getAllMonitors() {
        return Array.from(this._monitors.values());
    }

    /**
     * Get monitor count
     */
    getMonitorCount() {
        return this._monitors.size;
    }

    /**
     * Get current monitor ID for an index
     */
    getMonitorId(index) {
        const info = this._monitors.get(index);
        return info ? info.id : `index:${index}`;
    }
};
