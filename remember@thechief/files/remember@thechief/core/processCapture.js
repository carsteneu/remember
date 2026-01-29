/**
 * ProcessCapture - Captures process information for windows
 *
 * Extracts cmdline, working directory, and open documents from /proc
 * for use in session restoration.
 */

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;

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

        // Logger injection - no-op until injected
        this._log = options.log || function() {};
        this._logError = options.logError || global.logError;
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
            this._log(`Process info already cached for ${wmClass}`);
            return;
        }

        try {
            const pid = metaWindow.get_pid();
            if (!pid || pid <= 0) {
                // PID not available yet - retry after delay
                // This can happen with apps that spawn child processes (VSCode, Electron apps)
                this._log(`PID not available for ${wmClass}, scheduling retry...`);
                Mainloop.timeout_add(500, () => {
                    this._retryCmdlineCapture(metaWindow, instanceData, appData, 0);
                    return false;
                });
                return;
            }

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
            this._log(`Captured initial process info for ${wmClass}`);

        } catch (e) {
            this._logError(`${UUID}: Failed to capture initial process info: ${e}`);
        }
    }

    /**
     * Retry cmdline capture with exponential backoff
     * @param {Meta.Window} metaWindow - The window to capture
     * @param {Object} instanceData - Instance data to populate
     * @param {Object} appData - App data container
     * @param {number} attempt - Current retry attempt (0-based)
     * @private
     */
    _retryCmdlineCapture(metaWindow, instanceData, appData, attempt) {
        const wmClass = metaWindow.get_wm_class();
        const MAX_RETRIES = 3;
        const RETRY_DELAYS = [500, 1000, 2000];  // Exponential backoff

        // Window destroyed
        if (!metaWindow || metaWindow.is_on_all_workspaces === undefined) {
            this._log(`Window destroyed before cmdline capture for ${wmClass}`);
            return;
        }

        // Already captured
        if (instanceData.cmdline && instanceData.cmdline.length > 0) {
            this._log(`Cmdline already captured for ${wmClass} on retry ${attempt}`);
            return;
        }

        try {
            const pid = metaWindow.get_pid();
            if (!pid || pid <= 0) {
                if (attempt < MAX_RETRIES) {
                    const nextDelay = RETRY_DELAYS[attempt];
                    this._log(`PID still unavailable for ${wmClass}, retry ${attempt + 1}/${MAX_RETRIES} in ${nextDelay}ms`);
                    Mainloop.timeout_add(nextDelay, () => {
                        this._retryCmdlineCapture(metaWindow, instanceData, appData, attempt + 1);
                        return false;
                    });
                } else {
                    this._log(`WARNING: PID never became available for ${wmClass} after ${MAX_RETRIES} retries`);
                }
                return;
            }

            // PID now available - capture cmdline
            const cmdlineFile = Gio.File.new_for_path(`/proc/${pid}/cmdline`);
            if (!cmdlineFile.query_exists(null)) {
                this._log(`WARNING: /proc/${pid}/cmdline doesn't exist for ${wmClass}`);
                return;
            }

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

            // Read working directory
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
            this._log(`Captured process info for ${wmClass} on retry ${attempt} (PID: ${pid})`);

        } catch (e) {
            this._logError(`${UUID}: Failed to capture cmdline on retry for ${wmClass}: ${e}`);
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
     * For LibreOffice (single process, multiple windows), matches document to window title
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

        // For LibreOffice (single process, multiple windows), extract expected
        // document name from the window title to match the correct document
        let expectedDocName = null;
        const title = instanceData.title_snapshot || '';
        const wmClassLower = wmClass.toLowerCase();
        if (wmClassLower.includes('libreoffice') || wmClassLower.includes('soffice')) {
            // Title format: "DocumentName.ext – LibreOffice Component"
            const suffixIndex = title.indexOf(' – LibreOffice');
            if (suffixIndex > 0) {
                expectedDocName = title.substring(0, suffixIndex).trim();
                this._log(`Looking for document "${expectedDocName}" for ${wmClass}`);
            }
        }

        try {
            const fdDir = Gio.File.new_for_path(`/proc/${pid}/fd`);
            if (!fdDir.query_exists(null)) return;

            const enumerator = fdDir.enumerate_children(
                'standard::name,standard::symlink-target',
                Gio.FileQueryInfoFlags.NONE,
                null
            );

            let fallbackDocument = null;  // Store first matching document as fallback
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
                            // Verify it's not a temp file
                            if (target.includes('/tmp/') || target.includes('/.~lock.')) {
                                continue;
                            }

                            // If we have an expected document name, match it exactly
                            if (expectedDocName) {
                                const fileName = target.split('/').pop();
                                if (fileName === expectedDocName) {
                                    instanceData.document_path = target;
                                    this._log(`Matched document path for ${wmClass}: ${target}`);
                                    return;
                                }
                                // Store as fallback in case no exact match
                                if (!fallbackDocument) {
                                    fallbackDocument = target;
                                }
                            } else {
                                // No expected name, use first match (non-LibreOffice apps)
                                instanceData.document_path = target;
                                this._log(`Captured document path for ${wmClass}: ${target}`);
                                return;
                            }
                        }
                    }
                } catch (e) {
                    // Skip unreadable fd entries (common for sockets, pipes, etc.)
                }
            }

            // Use fallback if no exact match found (should rarely happen)
            if (fallbackDocument && !instanceData.document_path) {
                instanceData.document_path = fallbackDocument;
                this._log(`Using fallback document path for ${wmClass}: ${fallbackDocument}`);
            }
        } catch (e) {
            // Can't enumerate fd directory - permissions or process gone
        }
    }
};
