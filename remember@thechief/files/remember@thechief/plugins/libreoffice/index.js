/**
 * LibreOffice Plugin Handler
 *
 * Extracts document path from window title and opens files on session restore.
 * Handles Calc, Writer, Impress, Draw, Base, and Math.
 *
 * Title format: "DocumentName.ods – LibreOffice Calc"
 * For saved files, the title contains the filename (not full path).
 *
 * Special handling:
 * - WM_CLASS changes from "Soffice" to "libreoffice-*" during startup
 * - Duplicate detection based on document_path to prevent ghost instances
 */

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const UUID = "remember@thechief";

/**
 * LibreOffice Handler Class
 */
var LibreOfficeHandler = class LibreOfficeHandler {
    constructor(config, extensionSettings, storage) {
        this._config = config;
        this._extensionSettings = extensionSettings;
        this._storage = storage;

        // Map wmClass to LibreOffice component
        this._componentMap = {
            'libreoffice-calc': '--calc',
            'libreoffice-writer': '--writer',
            'libreoffice-impress': '--impress',
            'libreoffice-draw': '--draw',
            'libreoffice-base': '--base',
            'libreoffice-math': '--math',
            'Soffice': null,  // Generic, determine from title
            'soffice': null
        };

        // All wmClasses handled by this plugin (for deduplication)
        this._allWmClasses = [
            'libreoffice-calc', 'libreoffice-writer', 'libreoffice-impress',
            'libreoffice-draw', 'libreoffice-base', 'libreoffice-math',
            'Soffice', 'soffice'
        ];

        // Recent documents directory
        this._recentDocsPath = GLib.build_filenamev([
            GLib.get_home_dir(),
            '.config',
            'libreoffice',
            '4',
            'user',
            'registrymodifications.xcu'
        ]);

        // LibreOffice positions its windows quickly and may override
        // window manager positioning. Use multiple restore attempts.
        this.restoreTimings = [0, 200, 500];  // ms after window appears
    }

    /**
     * Hook: Called before launching the app
     * Adds the appropriate component flag based on wmClass or title
     */
    beforeLaunch(instance, launchParams) {
        // First try to get component from wmClass
        let componentFlag = this._componentMap[instance.wm_class];

        // If wmClass is generic (Soffice) or not found, try to determine from title
        if (!componentFlag && instance.title_snapshot) {
            componentFlag = this._getComponentFromTitle(instance.title_snapshot);
        }

        if (componentFlag) {
            // Insert component flag at the beginning of args
            launchParams.args = [componentFlag, ...launchParams.args];
            global.log(`${UUID}: LibreOffice: Using component ${componentFlag}`);
        }

        return launchParams;
    }

    /**
     * Determine LibreOffice component from window title
     */
    _getComponentFromTitle(title) {
        const titleLower = title.toLowerCase();

        if (titleLower.includes('calc')) return '--calc';
        if (titleLower.includes('writer')) return '--writer';
        if (titleLower.includes('impress')) return '--impress';
        if (titleLower.includes('draw')) return '--draw';
        if (titleLower.includes('base')) return '--base';
        if (titleLower.includes('math')) return '--math';

        return null;
    }

    /**
     * Hook: Called after launching the app
     */
    afterLaunch(instance, pid, success) {
        if (success) {
            global.log(`${UUID}: LibreOffice launched with PID ${pid}`);
        }
    }

    /**
     * Hook: Extract document path from instance data or window title
     *
     * Priority:
     * 1. Use document_path from instance (captured from /proc/pid/fd/)
     * 2. Parse title to find document
     * 3. For unsaved documents, return empty array to open new document
     *
     * @param {string} title - Window title
     * @param {object} instance - Instance data (optional, contains document_path)
     * @returns {string[]|null} Document path as argument, or empty array for new doc
     */
    parseTitleData(title, instance) {
        // Priority 1: Use document_path if available (most reliable)
        if (instance && instance.document_path) {
            const docPath = instance.document_path;
            const file = Gio.File.new_for_path(docPath);
            if (file.query_exists(null)) {
                global.log(`${UUID}: LibreOffice: Opening saved document ${docPath}`);
                return [docPath];
            } else {
                global.log(`${UUID}: LibreOffice: Saved document no longer exists: ${docPath}`);
            }
        }

        if (!title) return [];  // Open empty document

        const patterns = this._config.titlePatterns || {};
        const unsavedPatterns = patterns.unsaved || ['^Unbenannt', '^Untitled'];
        const suffix = patterns.documentSuffix || ' – LibreOffice';

        // Check if this is an unsaved document - open new empty document
        for (const pattern of unsavedPatterns) {
            const regex = new RegExp(pattern, 'i');
            if (regex.test(title)) {
                global.log(`${UUID}: LibreOffice: Opening new empty document (was unsaved)`);
                return [];  // Empty args = open new document
            }
        }

        try {
            // Extract document name from title
            // Format: "DocumentName.ext – LibreOffice Component"
            const suffixIndex = title.indexOf(suffix);
            if (suffixIndex === -1) {
                global.log(`${UUID}: LibreOffice: No suffix found in title "${title}"`);
                return [];
            }

            const docName = title.substring(0, suffixIndex).trim();
            if (!docName) return [];

            // Try to find the full path of the document
            const fullPath = this._findDocumentPath(docName);

            if (fullPath) {
                global.log(`${UUID}: LibreOffice: Opening document ${fullPath}`);
                return [fullPath];
            } else {
                global.log(`${UUID}: LibreOffice: Document "${docName}" not found, opening empty`);
                return [];
            }

        } catch (e) {
            global.logError(`${UUID}: LibreOffice: Failed to parse title "${title}": ${e}`);
        }

        return [];
    }

    /**
     * Find the full path of a document by its filename
     *
     * Search order:
     * 1. LibreOffice recent documents
     * 2. Common document locations
     */
    _findDocumentPath(docName) {
        // First, try to find in recent documents
        const recentPath = this._searchRecentDocuments(docName);
        if (recentPath) return recentPath;

        // Search common locations
        const searchDirs = [
            GLib.get_home_dir(),
            GLib.build_filenamev([GLib.get_home_dir(), 'Dokumente']),
            GLib.build_filenamev([GLib.get_home_dir(), 'Documents']),
            GLib.build_filenamev([GLib.get_home_dir(), 'Desktop']),
            GLib.build_filenamev([GLib.get_home_dir(), 'Downloads'])
        ];

        for (const dir of searchDirs) {
            const fullPath = GLib.build_filenamev([dir, docName]);
            const file = Gio.File.new_for_path(fullPath);
            if (file.query_exists(null)) {
                return fullPath;
            }
        }

        // Recursive search in Documents folder (limited depth)
        const docsDir = GLib.build_filenamev([GLib.get_home_dir(), 'Dokumente']);
        const foundPath = this._searchDirectory(docsDir, docName, 3);
        if (foundPath) return foundPath;

        const docsDir2 = GLib.build_filenamev([GLib.get_home_dir(), 'Documents']);
        const foundPath2 = this._searchDirectory(docsDir2, docName, 3);
        if (foundPath2) return foundPath2;

        return null;
    }

    /**
     * Search LibreOffice recent documents
     */
    _searchRecentDocuments(docName) {
        try {
            // LibreOffice stores recent documents in registrymodifications.xcu
            const file = Gio.File.new_for_path(this._recentDocsPath);
            if (!file.query_exists(null)) return null;

            const [success, contents] = file.load_contents(null);
            if (!success) return null;

            const xml = imports.byteArray.toString(contents);

            // Search for the document name in the XML
            // Recent files are stored as file:// URIs
            const escapedName = docName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`file://([^"<>]+${escapedName})`, 'i');
            const match = xml.match(regex);

            if (match) {
                // Decode URI
                const uri = match[1];
                const path = decodeURIComponent(uri);
                const fullFile = Gio.File.new_for_path(path);
                if (fullFile.query_exists(null)) {
                    return path;
                }
            }
        } catch (e) {
            // Silently fail, will try other methods
        }

        return null;
    }

    /**
     * Recursively search a directory for a file (limited depth)
     */
    _searchDirectory(dirPath, filename, maxDepth) {
        if (maxDepth <= 0) return null;

        try {
            const dir = Gio.File.new_for_path(dirPath);
            if (!dir.query_exists(null)) return null;

            const enumerator = dir.enumerate_children(
                'standard::name,standard::type',
                Gio.FileQueryInfoFlags.NONE,
                null
            );

            let info;
            while ((info = enumerator.next_file(null)) !== null) {
                const name = info.get_name();
                const type = info.get_file_type();

                if (name === filename) {
                    return GLib.build_filenamev([dirPath, name]);
                }

                if (type === Gio.FileType.DIRECTORY && !name.startsWith('.')) {
                    const subPath = GLib.build_filenamev([dirPath, name]);
                    const found = this._searchDirectory(subPath, filename, maxDepth - 1);
                    if (found) return found;
                }
            }
        } catch (e) {
            // Directory not accessible, skip
        }

        return null;
    }

    /**
     * Hook: Deduplicate instances before session restore
     *
     * LibreOffice has a problem where multiple instances are saved for the same document
     * because the WM_CLASS changes from "Soffice" to "libreoffice-*" during startup.
     * This results in ghost entries that all try to open the same document.
     *
     * This method is called by SessionLauncher before building the launch queue.
     * It removes duplicate instances based on document_path across all LibreOffice wmClasses.
     *
     * @param {Object} allApps - All apps from storage (can be modified)
     * @returns {number} Number of duplicates removed
     */
    deduplicateInstances(allApps) {
        if (!allApps) return 0;

        // Collect all LibreOffice instances across all wmClasses
        const seenDocuments = new Map(); // document_path -> { wmClass, instance, hasGeometry }
        const instancesToRemove = []; // { wmClass, instanceId }
        let removedCount = 0;

        // First pass: find all instances and their document paths
        for (const wmClass of this._allWmClasses) {
            const appData = allApps[wmClass];
            if (!appData || !appData.instances) continue;

            for (const instance of appData.instances) {
                const docPath = instance.document_path;

                // Skip instances without document_path (unsaved documents)
                if (!docPath) continue;

                const hasGeometry = instance.geometry_percent !== null ||
                                   instance.geometry_absolute !== null;

                if (seenDocuments.has(docPath)) {
                    // Duplicate found! Keep the one with better data
                    const existing = seenDocuments.get(docPath);

                    // Prefer instance with geometry data
                    if (!existing.hasGeometry && hasGeometry) {
                        // New instance is better, mark old for removal
                        instancesToRemove.push({
                            wmClass: existing.wmClass,
                            instanceId: existing.instance.id
                        });
                        seenDocuments.set(docPath, { wmClass, instance, hasGeometry });
                        global.log(`${UUID}: LibreOffice dedup: Keeping ${instance.id} over ${existing.instance.id} for ${docPath}`);
                    } else {
                        // Existing is better or equal, mark new for removal
                        instancesToRemove.push({ wmClass, instanceId: instance.id });
                        global.log(`${UUID}: LibreOffice dedup: Removing duplicate ${instance.id} for ${docPath}`);
                    }
                } else {
                    seenDocuments.set(docPath, { wmClass, instance, hasGeometry });
                }
            }
        }

        // Second pass: remove duplicates
        for (const toRemove of instancesToRemove) {
            const appData = allApps[toRemove.wmClass];
            if (!appData || !appData.instances) continue;

            const beforeCount = appData.instances.length;
            appData.instances = appData.instances.filter(i => i.id !== toRemove.instanceId);

            if (appData.instances.length < beforeCount) {
                removedCount++;
            }

            // Remove empty app entries
            if (appData.instances.length === 0) {
                delete allApps[toRemove.wmClass];
                global.log(`${UUID}: LibreOffice dedup: Removed empty app entry ${toRemove.wmClass}`);
            }
        }

        if (removedCount > 0) {
            global.log(`${UUID}: LibreOffice dedup: Removed ${removedCount} duplicate instances`);
        }

        return removedCount;
    }

    /**
     * Hook: Check if this wmClass belongs to LibreOffice plugin
     * Used for WM_CLASS migration detection
     *
     * @param {string} wmClass - The WM_CLASS to check
     * @returns {boolean} True if this plugin handles this wmClass
     */
    handlesWmClass(wmClass) {
        return this._allWmClasses.includes(wmClass);
    }

    /**
     * Hook: Check if WM_CLASS change is a known LibreOffice transition
     * Called by windowTracker to decide if instance data should be migrated
     *
     * @param {string} oldWmClass - Previous WM_CLASS
     * @param {string} newWmClass - New WM_CLASS
     * @returns {boolean} True if this is a valid LibreOffice WM_CLASS transition
     */
    isValidWmClassTransition(oldWmClass, newWmClass) {
        // Soffice -> libreoffice-* (normal startup)
        if ((oldWmClass === 'Soffice' || oldWmClass === 'soffice') &&
            newWmClass.startsWith('libreoffice-')) {
            return true;
        }

        // libreoffice-* -> Soffice (rare, but possible)
        if (oldWmClass.startsWith('libreoffice-') &&
            (newWmClass === 'Soffice' || newWmClass === 'soffice')) {
            return true;
        }

        return false;
    }

    destroy() {
        // Nothing to cleanup
    }
};
