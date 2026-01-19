/**
 * ProcessCapture - Captures process information for windows
 *
 * Extracts cmdline, working directory, and open documents from /proc
 * for use in session restoration.
 */

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const UUID = "remember@thechief";

/**
 * ProcessCapture class for capturing process information
 */
var ProcessCapture = class ProcessCapture {
    /**
     * @param {Object} options - Configuration options
     * @param {Object} options.storage - Storage instance for reading/writing app data
     * @param {Function} options.findDesktopFileFn - Function to find desktop file for a window
     * @param {Function} options.findDesktopExecFn - Function to find desktop exec command
     * @param {Function} options.findOrCreateInstanceFn - Function to find or create instance data
     */
    constructor(options) {
        this._storage = options.storage;
        this._findDesktopFileFn = options.findDesktopFileFn;
        this._findDesktopExecFn = options.findDesktopExecFn;
        this._findOrCreateInstanceFn = options.findOrCreateInstanceFn;
    }

    /**
     * Capture initial process info ONCE when window is first tracked
     * cmdline and working_dir never change during process lifetime
     * @param {Meta.Window} metaWindow - The window to capture info for
     */
    captureInitialProcessInfo(metaWindow) {
        const wmClass = metaWindow.get_wm_class();
        if (!wmClass) return;

        // Get or create app/instance data
        let appData = this._storage.getApp(wmClass);
        if (!appData) {
            appData = {
                wm_class: wmClass,
                desktop_file: this._findDesktopFileFn(metaWindow),
                desktop_exec: this._findDesktopExecFn(metaWindow),
                instances: []
            };
        }

        const instanceData = this._findOrCreateInstanceFn(metaWindow, appData);

        // Skip if already captured (e.g., from restored session data)
        if (instanceData.cmdline && instanceData.cmdline.length > 0) {
            global.log(`${UUID}: Process info already cached for ${wmClass}`);
            return;
        }

        try {
            const pid = metaWindow.get_pid();
            if (!pid || pid <= 0) return;

            // Read cmdline ONCE
            const cmdlineFile = Gio.File.new_for_path(`/proc/${pid}/cmdline`);
            if (!cmdlineFile.query_exists(null)) return;

            const [success, contents] = cmdlineFile.load_contents(null);
            if (!success) return;

            const cmdlineStr = imports.byteArray.toString(contents);
            let cmdline = cmdlineStr.split('\0').filter(s => s);
            if (cmdline.length === 0) return;

            // Chromium workaround
            const wmClassLower = wmClass.toLowerCase();
            const isChromiumBrowser = wmClassLower.includes('brave') ||
                                      wmClassLower.includes('chrome') ||
                                      wmClassLower.includes('chromium');

            if (isChromiumBrowser && cmdline.length === 1 && cmdline[0].includes(' --')) {
                const spaceIndex = cmdline[0].indexOf(' ');
                if (spaceIndex > 0) {
                    cmdline = [cmdline[0].substring(0, spaceIndex)];
                }
            }

            instanceData.cmdline = cmdline;

            // Read working directory ONCE
            try {
                const cwdLink = Gio.File.new_for_path(`/proc/${pid}/cwd`);
                const cwdInfo = cwdLink.query_info('standard::symlink-target', Gio.FileQueryInfoFlags.NONE, null);
                instanceData.working_dir = cwdInfo.get_symlink_target();
            } catch (e) {
                instanceData.working_dir = GLib.get_home_dir();
            }

            // Initial document capture for document-based apps
            if (this.isDocumentApp(wmClass)) {
                this.captureOpenDocuments(pid, wmClass, instanceData);
            }

            this._storage.setApp(wmClass, appData);
            global.log(`${UUID}: Captured initial process info for ${wmClass}`);

        } catch (e) {
            global.logError(`${UUID}: Failed to capture initial process info: ${e}`);
        }
    }

    /**
     * Apps that work with documents and should have fd/ scanned on title change
     * @param {string} wmClass - Window manager class to check
     * @returns {boolean} True if this is a document-based app
     */
    isDocumentApp(wmClass) {
        const documentApps = [
            'libreoffice', 'soffice',
            'gedit', 'xed', 'pluma', 'mousepad',
            'evince', 'okular', 'atril',
            'gimp', 'inkscape',
            'gnumeric', 'abiword'
        ];
        const wmClassLower = wmClass.toLowerCase();
        return documentApps.some(app => wmClassLower.includes(app));
    }

    /**
     * Legacy wrapper - kept for compatibility but now just delegates
     * @deprecated Use captureInitialProcessInfo instead
     * @param {Meta.Window} metaWindow - The window to capture info for
     * @param {Object} instanceData - Instance data object to populate
     */
    captureCmdline(metaWindow, instanceData) {
        // Only capture if not already cached
        if (instanceData.cmdline && instanceData.cmdline.length > 0) {
            return; // Already have cmdline, skip expensive /proc reads
        }

        const wmClass = metaWindow.get_wm_class();
        const pid = metaWindow.get_pid();
        if (!pid || pid <= 0) return;

        try {
            const cmdlineFile = Gio.File.new_for_path(`/proc/${pid}/cmdline`);
            if (!cmdlineFile.query_exists(null)) return;

            const [success, contents] = cmdlineFile.load_contents(null);
            if (!success) return;

            const cmdlineStr = imports.byteArray.toString(contents);
            let cmdline = cmdlineStr.split('\0').filter(s => s);
            if (cmdline.length === 0) return;

            // Chromium workaround
            const wmClassLower = (wmClass || '').toLowerCase();
            const isChromiumBrowser = wmClassLower.includes('brave') ||
                                      wmClassLower.includes('chrome') ||
                                      wmClassLower.includes('chromium');

            if (isChromiumBrowser && cmdline.length === 1 && cmdline[0].includes(' --')) {
                const spaceIndex = cmdline[0].indexOf(' ');
                if (spaceIndex > 0) {
                    cmdline = [cmdline[0].substring(0, spaceIndex)];
                }
            }

            instanceData.cmdline = cmdline;

            // Working dir
            try {
                const cwdLink = Gio.File.new_for_path(`/proc/${pid}/cwd`);
                const cwdInfo = cwdLink.query_info('standard::symlink-target', Gio.FileQueryInfoFlags.NONE, null);
                instanceData.working_dir = cwdInfo.get_symlink_target();
            } catch (e) {
                instanceData.working_dir = GLib.get_home_dir();
            }

        } catch (e) {
            // Silently fail - not critical
        }
    }

    /**
     * Capture open document files from /proc/pid/fd/
     * Extracts document paths for office suites and similar apps
     * @param {number} pid - Process ID
     * @param {string} wmClass - Window manager class
     * @param {Object} instanceData - Instance data object to populate
     */
    captureOpenDocuments(pid, wmClass, instanceData) {
        // Document file extensions to look for
        const documentExtensions = [
            // LibreOffice / OpenDocument
            '.ods', '.odt', '.odp', '.odg', '.odb', '.odf',
            // Microsoft Office
            '.xlsx', '.xls', '.docx', '.doc', '.pptx', '.ppt',
            // Other common document types
            '.pdf', '.csv', '.rtf'
        ];

        try {
            const fdDir = Gio.File.new_for_path(`/proc/${pid}/fd`);
            if (!fdDir.query_exists(null)) return;

            const enumerator = fdDir.enumerate_children(
                'standard::name,standard::symlink-target',
                Gio.FileQueryInfoFlags.NONE,
                null
            );

            let info;
            while ((info = enumerator.next_file(null)) !== null) {
                try {
                    // Read the symlink target
                    const fdPath = GLib.build_filenamev([`/proc/${pid}/fd`, info.get_name()]);
                    const fdLink = Gio.File.new_for_path(fdPath);
                    const linkInfo = fdLink.query_info(
                        'standard::symlink-target',
                        Gio.FileQueryInfoFlags.NONE,
                        null
                    );
                    const target = linkInfo.get_symlink_target();

                    if (!target) continue;

                    // Check if this is a document file
                    const targetLower = target.toLowerCase();
                    for (const ext of documentExtensions) {
                        if (targetLower.endsWith(ext)) {
                            // Found a document file!
                            // Verify it's not a temp file
                            if (!target.includes('/tmp/') && !target.includes('/.~lock.')) {
                                instanceData.document_path = target;
                                global.log(`${UUID}: Captured document path for ${wmClass}: ${target}`);
                                return; // Use the first matching document
                            }
                        }
                    }
                } catch (e) {
                    // Skip unreadable fd entries (common for sockets, pipes, etc.)
                }
            }
        } catch (e) {
            // Can't enumerate fd directory - permissions or process gone
        }
    }
};
