/**
 * GIMP Plugin Handler
 *
 * Extracts image file path from window title and opens the file on launch.
 * Supports both native and Flatpak installations.
 */

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const UUID = "remember@thechief";

/**
 * GIMP Handler Class
 */
var GimpHandler = class GimpHandler {
    constructor(config, extensionSettings, storage) {
        this._config = config;
        this._extensionSettings = extensionSettings;
        this._storage = storage;
    }

    /**
     * Hook: Called before launching the app
     * Checks if GIMP is available as Flatpak and adjusts launch command
     */
    beforeLaunch(instance, launchParams) {
        const Gio = imports.gi.Gio;
        const GLib = imports.gi.GLib;

        // Check if native GIMP executable exists
        const gimpPath = GLib.find_program_in_path('gimp');

        if (!gimpPath) {
            // Try Flatpak
            global.log(`${UUID}: GIMP: Native executable not found, trying Flatpak...`);

            try {
                // Check if Flatpak GIMP is installed
                const [success] = GLib.spawn_command_line_sync('flatpak info org.gimp.GIMP');
                if (success) {
                    global.log(`${UUID}: GIMP: Using Flatpak installation`);
                    launchParams.executable = 'flatpak';
                    launchParams.args = ['run', 'org.gimp.GIMP', ...launchParams.args];
                }
            } catch (e) {
                global.logError(`${UUID}: GIMP: Failed to check Flatpak: ${e}`);
            }
        }

        return launchParams;
    }

    /**
     * Hook: Called after launching the app
     */
    afterLaunch(instance, pid, success) {
        if (success) {
            global.log(`${UUID}: GIMP launched with PID ${pid}`);
        }
    }

    /**
     * Hook: Extract image file path from window title
     *
     * GIMP title patterns:
     * - "*[Unbenannt]-1.0 (RGB...) – GIMP" (unsaved/new image)
     * - "*[image.png] (RGB...) – GIMP" (unsaved changes)
     * - "[/full/path/image.png] (RGB...) – GIMP" (saved image with full path)
     *
     * @param {string} title - Window title
     * @param {Object} instance - Instance data (for document_path fallback)
     * @returns {string[]|null} File path as argument, or null
     */
    parseTitleData(title, instance) {
        if (!title) return null;

        const patterns = this._config.titlePatterns || {};
        const skipPatterns = patterns.skipPatterns || ['Unbenannt', 'Untitled', 'Sans titre'];

        // Skip unsaved/untitled images
        for (const skip of skipPatterns) {
            if (title.includes(skip)) {
                global.log(`${UUID}: GIMP: Skipping unsaved image`);
                return null;
            }
        }

        try {
            // Pattern 1: Full path in brackets (e.g., "[/home/user/image.png] ...")
            // GIMP shows full path for saved images
            const fullPathRegex = /^\*?\[([^\]]+)\]/;
            const fullPathMatch = title.match(fullPathRegex);

            if (fullPathMatch) {
                const filePath = fullPathMatch[1];

                // Only proceed if it looks like a full path (starts with /)
                if (filePath.startsWith('/')) {
                    // Verify file exists
                    const file = Gio.File.new_for_path(filePath);
                    if (file.query_exists(null)) {
                        global.log(`${UUID}: GIMP: Opening image ${filePath}`);
                        return [filePath];
                    } else {
                        global.log(`${UUID}: GIMP: File not found: ${filePath}`);
                    }
                }
            }

            // Pattern 2: Use saved document_path if available
            if (instance && instance.document_path) {
                const file = Gio.File.new_for_path(instance.document_path);
                if (file.query_exists(null)) {
                    global.log(`${UUID}: GIMP: Opening image from saved document_path: ${instance.document_path}`);
                    return [instance.document_path];
                }
            }

        } catch (e) {
            global.logError(`${UUID}: GIMP: Failed to parse title "${title}": ${e}`);
        }

        return null;
    }

    /**
     * Custom restore timings for GIMP
     * GIMP takes longer to start and has multiple windows
     */
    get restoreTimings() {
        return this._config.restoreTimings || [500, 1000, 2000, 4000];
    }

    destroy() {
        // Nothing to cleanup
    }
};
