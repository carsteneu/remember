/**
 * Window Remember Control Applet
 *
 * Provides panel UI for controlling the Window Position Remember extension.
 * Click to open settings.
 */

const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const SignalManager = imports.misc.signalManager;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;

const UUID = "remember-applet@thechief";
const EXTENSION_UUID = "remember@thechief";

// Initialize gettext for translations
Gettext.bindtextdomain(EXTENSION_UUID, GLib.build_filenamev([GLib.get_home_dir(), '.local', 'share', 'locale']));

function _(str) {
    return Gettext.dgettext(EXTENSION_UUID, str);
}

/**
 * Main Applet Class
 */
class WindowRememberApplet extends Applet.TextIconApplet {
    constructor(orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this._signals = new SignalManager.SignalManager(null);
        this._updateTimeoutId = null;

        // Set up UI
        this.set_applet_icon_symbolic_name('preferences-system-windows');
        this.set_applet_tooltip(_('Window Position Remember - Click to open settings'));

        // Start status update loop
        this._startUpdateLoop();

        global.log(`${UUID}: Applet initialized`);
    }

    /**
     * Start periodic status updates
     */
    _startUpdateLoop() {
        if (this._updateTimeoutId) {
            Mainloop.source_remove(this._updateTimeoutId);
        }

        this._updateTimeoutId = Mainloop.timeout_add_seconds(5, () => {
            this._updateStatus();
            return true;  // Continue
        });
    }

    /**
     * Update status display
     */
    _updateStatus() {
        if (!Main.windowRemember) {
            this.set_applet_label('');
            return;
        }

        const stats = Main.windowRemember.getStats();

        // Update panel label
        if (stats.trackedWindows > 0) {
            this.set_applet_label(`${stats.trackedWindows}`);
        } else {
            this.set_applet_label('');
        }
    }

    /**
     * Open extension settings dialog
     */
    _openSettings() {
        const settingsPath = GLib.build_filenamev([
            GLib.get_home_dir(), '.local', 'share', 'cinnamon', 'extensions', EXTENSION_UUID, 'settings.py'
        ]);
        Util.spawnCommandLine(`python3 ${settingsPath}`);
    }

    /**
     * Handle left click - open settings
     */
    on_applet_clicked() {
        this._openSettings();
    }

    /**
     * Cleanup on removal
     */
    on_applet_removed_from_panel() {
        if (this._updateTimeoutId) {
            Mainloop.source_remove(this._updateTimeoutId);
            this._updateTimeoutId = null;
        }

        this._signals.disconnectAllSignals();
    }
}

/**
 * Applet entry point
 */
function main(metadata, orientation, panelHeight, instanceId) {
    return new WindowRememberApplet(orientation, panelHeight, instanceId);
}
