/**
 * Window Filter Module for Window Position Remember Extension
 *
 * Provides blacklist filtering and window tracking criteria.
 * Extracted from windowTracker.js for better modularity.
 */

const Meta = imports.gi.Meta;

const UUID = "remember@thechief";

/**
 * Configuration for window filtering
 */
var CONFIG = {
    // Windows to ignore - exact wm_class matches (case-insensitive)
    BLACKLIST_WM_CLASS: [
        'Settings.py',           // Our settings dialog
        'Progress_window.py',    // Our progress window
        '-m',                    // Python -m flag (appears as wmClass for some scripts)
        'Captain.py',            // Warp terminal launcher script
        'Mintinstall.py',        // Linux Mint Software Manager
        'gnome-system-monitor',  // System Monitor
        'gnome-control-center',  // GNOME Settings
        'gnome-disks',           // Disk utility
        'gnome-tweaks',          // GNOME Tweaks
        'Timeshift-gtk',         // Timeshift backup
        'Synaptic',              // Synaptic Package Manager
        'Update-manager',        // Update Manager
        'Software-center',       // Software Center
        'Gdebi-gtk',             // GDebi Package Installer
        'Polkit-gnome-authentication-agent-1',  // PolicyKit dialogs
        'Gcr-prompter',          // Password prompts
        'Seahorse',              // Passwords and Keys
        'Nm-connection-editor',  // Network connections editor
        'Blueman-manager',       // Bluetooth manager
    ],
    // Prefix patterns - matches wm_class that STARTS with these (case-insensitive)
    BLACKLIST_WM_CLASS_PREFIX: [
        'cinnamon-settings',     // All Cinnamon settings dialogs (themes, extensions, applets, etc.)
    ],
    BLACKLIST_TITLE_PATTERNS: [
        /^Window Position Remember/i,  // Our settings dialog title
        /^Session wird wiederhergestellt/i,  // Our progress window title
        /^Authentifizierung/i,   // Authentication dialogs (German)
        /^Authentication/i,      // Authentication dialogs (English)
    ]
};

/**
 * Window Filter Class
 * Determines which windows should be tracked based on type, class, and title.
 */
var WindowFilter = class WindowFilter {
    /**
     * Create a new WindowFilter
     * @param {Object} preferences - Preferences object with shouldTrackDialogs() method
     */
    constructor(preferences) {
        this._preferences = preferences;
    }

    /**
     * Check if window should be tracked
     * @param {Meta.Window} metaWindow - The window to check
     * @returns {boolean} True if window should be tracked
     */
    shouldTrack(metaWindow) {
        if (!metaWindow) return false;

        const windowType = metaWindow.get_window_type();

        // Only track normal windows (skip dialogs unless preference enabled)
        if (windowType !== Meta.WindowType.NORMAL) {
            // Allow dialogs if trackDialogs preference is enabled
            if (windowType !== Meta.WindowType.DIALOG || !this._preferences.shouldTrackDialogs()) {
                return false;
            }
        }

        // Skip transient windows (child dialogs)
        if (metaWindow.get_transient_for()) {
            return false;
        }

        // Skip windows without wm_class
        const wmClass = metaWindow.get_wm_class();
        if (!wmClass) {
            return false;
        }

        // Skip blacklisted wm_class (own settings dialog, etc.)
        const wmClassLower = wmClass.toLowerCase();
        for (const blacklisted of CONFIG.BLACKLIST_WM_CLASS) {
            if (wmClassLower === blacklisted.toLowerCase()) {
                global.log(`${UUID}: Skipping blacklisted wm_class: ${wmClass}`);
                return false;
            }
        }

        // Skip wm_class that starts with blacklisted prefix (e.g., "cinnamon-settings *")
        for (const prefix of CONFIG.BLACKLIST_WM_CLASS_PREFIX) {
            if (wmClassLower.startsWith(prefix.toLowerCase())) {
                global.log(`${UUID}: Skipping system tool: ${wmClass}`);
                return false;
            }
        }

        // Skip blacklisted title patterns
        const title = metaWindow.get_title() || '';
        for (const pattern of CONFIG.BLACKLIST_TITLE_PATTERNS) {
            if (pattern.test(title)) {
                global.log(`${UUID}: Skipping blacklisted title: ${title}`);
                return false;
            }
        }

        return true;
    }

    /**
     * Check if a wmClass is blacklisted
     * @param {string} wmClass - Window manager class to check
     * @returns {boolean} True if blacklisted
     */
    isWmClassBlacklisted(wmClass) {
        if (!wmClass) return false;

        const wmClassLower = wmClass.toLowerCase();

        // Check exact matches
        for (const blacklisted of CONFIG.BLACKLIST_WM_CLASS) {
            if (wmClassLower === blacklisted.toLowerCase()) {
                return true;
            }
        }

        // Check prefix matches
        for (const prefix of CONFIG.BLACKLIST_WM_CLASS_PREFIX) {
            if (wmClassLower.startsWith(prefix.toLowerCase())) {
                return true;
            }
        }

        return false;
    }
};
