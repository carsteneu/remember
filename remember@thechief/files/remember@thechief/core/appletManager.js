/**
 * Applet Manager Module
 *
 * Manages the companion panel applet installation and activation.
 * Handles auto-installation, panel activation, and cleanup.
 */

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Main = imports.ui.main;

const UUID = "remember@thechief";
const APPLET_UUID = "remember-applet@thechief";

// Gettext for translations
const Gettext = imports.gettext;
Gettext.bindtextdomain(UUID, GLib.build_filenamev([GLib.get_home_dir(), '.local', 'share', 'locale']));
function _(str) {
    return Gettext.dgettext(UUID, str);
}

/**
 * Manages the companion panel applet
 */
var AppletManager = class AppletManager {
    /**
     * Create a new AppletManager
     * @param {string} extensionPath - Path to the extension directory
     */
    constructor(extensionPath) {
        this._extPath = extensionPath;
    }

    /**
     * Install companion applet if not already installed and activate it
     * Copies applet files from extension's applet/ subdirectory to
     * ~/.local/share/cinnamon/applets/
     */
    installIfNeeded() {
        const appletDir = GLib.build_filenamev([
            GLib.get_home_dir(), '.local', 'share', 'cinnamon', 'applets', APPLET_UUID
        ]);

        const appletDirFile = Gio.File.new_for_path(appletDir);
        const needsCopy = !appletDirFile.query_exists(null);

        // Find applet source in extension directory
        const appletSrc = GLib.build_filenamev([this._extPath, 'applet']);
        const appletSrcFile = Gio.File.new_for_path(appletSrc);

        if (!appletSrcFile.query_exists(null)) {
            global.log(`${UUID}: Applet source not found at ${appletSrc}`);
            return;
        }

        // Copy applet files if needed
        if (needsCopy) {
            try {
                appletDirFile.make_directory_with_parents(null);

                const enumerator = appletSrcFile.enumerate_children(
                    'standard::name,standard::type',
                    Gio.FileQueryInfoFlags.NONE,
                    null
                );

                let fileInfo;
                while ((fileInfo = enumerator.next_file(null))) {
                    const name = fileInfo.get_name();
                    const srcFile = Gio.File.new_for_path(GLib.build_filenamev([appletSrc, name]));
                    const dstFile = Gio.File.new_for_path(GLib.build_filenamev([appletDir, name]));

                    srcFile.copy(dstFile, Gio.FileCopyFlags.OVERWRITE, null, null);
                }

                global.log(`${UUID}: Applet installed to ${appletDir}`);
            } catch (e) {
                global.logError(`${UUID}: Failed to install applet: ${e}`);
                return;
            }
        }

        // Activate applet in panel if not already enabled
        this.activateIfNeeded();
    }

    /**
     * Add applet to panel via gsettings if not already active
     * Places applet on panel1, right zone, leftmost position
     */
    activateIfNeeded() {
        try {
            const settings = new Gio.Settings({ schema_id: 'org.cinnamon' });
            const enabledApplets = settings.get_strv('enabled-applets');

            // Check if applet is already enabled
            const isEnabled = enabledApplets.some(entry => entry.includes(APPLET_UUID));
            if (isEnabled) {
                global.log(`${UUID}: Applet already active in panel`);
                return;
            }

            // Add applet to panel1, right zone, leftmost position
            const appletEntry = `panel1:right:0:${APPLET_UUID}`;
            enabledApplets.push(appletEntry);
            settings.set_strv('enabled-applets', enabledApplets);
            Gio.Settings.sync();

            global.log(`${UUID}: Applet activated in panel (${appletEntry})`);
            Main.notify(_("Window Remember"), _("Applet added to panel."));

        } catch (e) {
            global.logError(`${UUID}: Failed to activate applet: ${e}`);
        }
    }

    /**
     * Remove applet from panel via gsettings
     * Called during extension disable to clean up
     */
    deactivate() {
        try {
            const settings = new Gio.Settings({ schema_id: 'org.cinnamon' });
            const enabledApplets = settings.get_strv('enabled-applets');

            // Filter out our applet
            const newApplets = enabledApplets.filter(entry => !entry.includes(APPLET_UUID));

            if (newApplets.length < enabledApplets.length) {
                settings.set_strv('enabled-applets', newApplets);
                Gio.Settings.sync();
                global.log(`${UUID}: Applet removed from panel`);
            }
        } catch (e) {
            global.logError(`${UUID}: Failed to deactivate applet: ${e}`);
        }
    }
};
