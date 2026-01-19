/**
 * Configuration constants for Window Position Remember Extension
 */

var UUID = "remember@thechief";

var CONFIG = {
    SAVE_DELAY: 1000,           // Debounce delay for saving (ms)
    RESTORE_DELAY: 500,         // Delay before applying position after window creation (ms)
    // Note: STARTUP_DELAY moved to SESSION_LAUNCH_CONFIG (single source of truth)
    MIN_WINDOW_WIDTH: 200,      // Minimum window dimensions
    MIN_WINDOW_HEIGHT: 150,
    DATA_VERSION: 3
};

/**
 * Single-instance applications that restore their own windows
 * These apps get extended timeout (2 minutes) + longer grace period (1 minute)
 * to allow their internal session restore to complete
 */
var SINGLE_INSTANCE_APPS = new Set([
    'firefox',
    'Firefox',
    'google-chrome',
    'Google-chrome',
    'chromium',
    'Chromium',
    'brave-browser',
    'Brave-browser',
    // VS Code now handled by plugin (plugins/vscode/)
    'jetbrains-idea',
    'jetbrains-pycharm',
    'jetbrains-webstorm',
    'jetbrains-phpstorm',
    'sublime_text',
    'Sublime_text',
    'atom',
    'Atom'
]);

var SINGLE_INSTANCE_TIMEOUT = 120000;       // 2 minutes for single-instance apps
var SINGLE_INSTANCE_GRACE_PERIOD = 60000;  // 1 minute grace after timeout

/**
 * Session launch configuration
 * Centralized config for session restore and app launching
 */
var SESSION_LAUNCH_CONFIG = {
    // Timing
    STARTUP_DELAY: 1000,                    // Wait after enable() before auto-restore (ms)
    POSITION_RESTORE_DELAY: 500,            // Delay before restoring each window position (ms)
    LAUNCH_DELAY_BETWEEN_APPS: 500,         // Delay between launching apps (ms)
    APP_LAUNCH_TIMEOUT: 45000,              // Default timeout for apps without plugin (ms)
    GRACE_PERIOD_AFTER_TIMEOUT: 30000,      // Grace period after timeout before cleanup (ms)

    // Limits
    MAX_INSTANCES_PER_APP: 5,               // Maximum instances to launch per app

    // Login detection
    STARTUP_GRACE_PERIOD_SECONDS: 60,       // Seconds after Cinnamon start = "login" (vs manual enable)

    // Apps that should never be auto-launched (system dialogs, settings, etc.)
    LAUNCH_BLACKLIST: [
        'settings.py',                      // Our settings dialog (legacy)
        'app.py',
        'progress_window.py',               // Our restore progress window
        'remember@thechief',                // Our settings dialog wmClass
        'cinnamon-settings',
        'blueman-manager',
        'warpinator',
        'nm-connection-editor',
        'pavucontrol',
        'gnome-disks',
        'baobab',
        'gnome-system-monitor',
        'mint-update'
    ]
};
