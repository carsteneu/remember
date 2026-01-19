/**
 * Window Matcher Module for Window Position Remember Extension
 *
 * Provides window-to-instance matching algorithms:
 * - Levenshtein-based title similarity
 * - Scoring-based instance matching
 * - Instance lookup and creation
 */

const UUID = "remember@thechief";

/**
 * Window Matcher Class
 * Matches windows to saved instances using multiple strategies
 */
var WindowMatcher = class WindowMatcher {
    /**
     * Create a new WindowMatcher
     * @param {Function} getX11WindowIdFn - Function to get X11 window ID from metaWindow
     */
    constructor(getX11WindowIdFn) {
        this._getX11WindowId = getX11WindowIdFn;
    }

    /**
     * Calculate Levenshtein distance between two strings
     * Returns similarity score 0-1 (1 = identical)
     * PERFORMANCE: Only use for titles > 10 chars to avoid expensive computation
     */
    calculateTitleSimilarity(str1, str2) {
        if (!str1 || !str2) return 0;
        if (str1 === str2) return 1;

        const len1 = str1.length;
        const len2 = str2.length;

        // PERFORMANCE: Skip expensive calculation for very short strings
        // Most false matches are caught by other criteria
        if (len1 < 10 || len2 < 10) return 0;

        // PERFORMANCE: Early exit if lengths differ too much
        // If one string is >2x longer, they're unlikely to match
        const lengthRatio = Math.max(len1, len2) / Math.min(len1, len2);
        if (lengthRatio > 2.0) return 0;

        // Create distance matrix
        const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));

        // Initialize first row and column
        for (let i = 0; i <= len1; i++) matrix[0][i] = i;
        for (let j = 0; j <= len2; j++) matrix[j][0] = j;

        // Fill matrix
        for (let j = 1; j <= len2; j++) {
            for (let i = 1; i <= len1; i++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,     // deletion
                    matrix[j - 1][i] + 1,     // insertion
                    matrix[j - 1][i - 1] + cost // substitution
                );
            }
        }

        const distance = matrix[len2][len1];
        const maxLen = Math.max(len1, len2);
        return maxLen === 0 ? 1 : 1 - (distance / maxLen);
    }

    /**
     * Score an instance match against a window
     * Returns score 0-10000 (higher = better match)
     * PERFORMANCE: Early-exit on high-confidence matches to avoid expensive fuzzy matching
     */
    scoreInstanceMatch(instance, metaWindow) {
        let score = 0;

        const windowTitle = metaWindow.get_title() || '';
        const windowWorkspace = metaWindow.get_workspace()?.index() ?? 0;
        const windowMonitor = metaWindow.get_monitor();
        const windowRect = metaWindow.get_frame_rect();
        const windowXid = this._getX11WindowId(metaWindow);
        const windowSeq = metaWindow.get_stable_sequence();

        // === HIGH-CONFIDENCE MATCHES (Individually sufficient) ===

        // X11 ID Match: +10000 (definitive!)
        if (windowXid && instance.x11_window_id === windowXid) {
            return 10000;
        }

        // Stable Sequence Match: +5000 (very reliable within session)
        if (windowSeq && instance.stable_sequence === windowSeq) {
            return 5000;
        }

        // === MEDIUM-CONFIDENCE MATCHES (Combined) ===

        // Exact Title Match: +1000
        if (windowTitle && instance.title_snapshot === windowTitle) {
            return 1000;  // PERFORMANCE: Early return, no need for fuzzy matching
        }
        // Partial Title Match (VS Code project name): +500
        else if (windowTitle && instance.title_snapshot) {
            const savedParts = instance.title_snapshot.split(' - ');
            const currentParts = windowTitle.split(' - ');

            if (savedParts.length >= 2 && currentParts.length >= 2) {
                const savedProject = savedParts.length >= 3 ? savedParts[savedParts.length - 2] : savedParts[0];
                const currentProject = currentParts.length >= 3 ? currentParts[currentParts.length - 2] : currentParts[0];

                if (savedProject && currentProject && savedProject === currentProject) {
                    score += 500;
                }
            }

            // PERFORMANCE: Only use expensive Levenshtein if we don't already have a good match
            // and titles are long enough to be meaningful
            if (score < 500 && windowTitle.length > 10 && instance.title_snapshot.length > 10) {
                const similarity = this.calculateTitleSimilarity(windowTitle, instance.title_snapshot);
                score += Math.floor(similarity * 200);  // 0-200 points based on similarity
            }
        }

        // Workspace Match: +300
        if (instance.workspace === windowWorkspace) {
            score += 300;
        }

        // Monitor Match: +200
        if (instance.monitor_index === windowMonitor) {
            score += 200;
        }

        // Geometry Proximity: +100 (up to)
        if (instance.geometry_absolute && windowRect) {
            const savedGeom = instance.geometry_absolute;
            const dx = Math.abs(savedGeom.x - windowRect.x);
            const dy = Math.abs(savedGeom.y - windowRect.y);
            const dw = Math.abs(savedGeom.width - windowRect.width);
            const dh = Math.abs(savedGeom.height - windowRect.height);

            // Closer = more points (max 100)
            const totalDiff = dx + dy + dw + dh;
            const distScore = Math.max(0, 100 - totalDiff / 20);
            score += Math.floor(distScore);
        }

        // Regex Pattern Match: +800
        if (instance.title_pattern && windowTitle) {
            try {
                const regex = new RegExp(instance.title_pattern);
                if (regex.test(windowTitle)) {
                    score += 800;
                }
            } catch (e) {
                // Invalid regex, ignore
            }
        }

        // === PENALTIES ===

        // Window at origin (likely just spawned): -50
        if (windowRect && windowRect.x < 50 && windowRect.y < 50) {
            score -= 50;
        }

        return score;
    }

    /**
     * Find matching instance for a window using scoring strategy
     * @param {Meta.Window} metaWindow - The window to find an instance for
     * @param {Object} appData - App data containing instances array
     * @returns {Object|null} Matched instance or null
     */
    findInstanceForWindow(metaWindow, appData) {
        const windowSeq = metaWindow.get_stable_sequence();
        const windowXid = this._getX11WindowId(metaWindow);
        const windowTitle = metaWindow.get_title() || '';

        // Score all unassigned instances
        const candidates = [];

        for (const instance of appData.instances) {
            if (instance.assigned) continue;

            const score = this.scoreInstanceMatch(instance, metaWindow);

            // Only consider instances with positive score
            if (score > 0) {
                candidates.push({ instance, score });
            }
        }

        // Sort by score (highest first)
        candidates.sort((a, b) => b.score - a.score);

        if (candidates.length > 0) {
            const best = candidates[0];

            // Log match details
            if (best.score >= 10000) {
                global.log(`${UUID}: Matched by X11 ID: ${windowXid} (score=${best.score})`);
            } else if (best.score >= 5000) {
                global.log(`${UUID}: Matched by stable sequence: ${windowSeq} (score=${best.score})`);
            } else if (best.score >= 1000) {
                global.log(`${UUID}: Matched by exact title: "${windowTitle}" (score=${best.score})`);
            } else {
                global.log(`${UUID}: Best match for ${appData.wm_class}: score=${best.score}, id=${best.instance.id}`);
            }

            // Log runner-up for debugging close matches
            if (candidates.length > 1) {
                const delta = best.score - candidates[1].score;
                if (delta < 100) {
                    global.log(`${UUID}: Close match! Runner-up: score=${candidates[1].score} (delta=${delta})`);
                }
            }

            // Assign and update IDs
            best.instance.assigned = true;
            best.instance.stable_sequence = windowSeq;
            best.instance.x11_window_id = windowXid;

            return best.instance;
        }

        // Fallback: First unassigned instance
        for (const instance of appData.instances) {
            if (!instance.assigned) {
                global.log(`${UUID}: No scored match found, using first unassigned instance for ${appData.wm_class}`);
                instance.assigned = true;
                instance.stable_sequence = windowSeq;
                instance.x11_window_id = windowXid;
                instance.title_snapshot = windowTitle;
                global.log(`${UUID}: Matched by order (fallback)`);
                return instance;
            }
        }

        return null;
    }

    /**
     * Find or create instance data for a window
     * Priority: 1) stable_sequence, 2) x11_window_id, 3) exact title match, 4) first unassigned, 5) create new
     * @param {Meta.Window} metaWindow - The window to find/create an instance for
     * @param {Object} appData - App data containing instances array
     * @returns {Object} Existing or newly created instance
     */
    findOrCreateInstance(metaWindow, appData) {
        const windowSeq = metaWindow.get_stable_sequence();
        const windowXid = this._getX11WindowId(metaWindow);
        const windowTitle = metaWindow.get_title() || '';

        // 1. Try to find by stable_sequence (most reliable within session)
        for (const instance of appData.instances) {
            if (instance.stable_sequence === windowSeq) {
                // Update x11_window_id if changed
                if (windowXid && instance.x11_window_id !== windowXid) {
                    instance.x11_window_id = windowXid;
                }
                return instance;
            }
        }

        // 2. Try to find by x11_window_id (persists across Cinnamon restarts)
        for (const instance of appData.instances) {
            if (windowXid && instance.x11_window_id === windowXid) {
                instance.stable_sequence = windowSeq;
                return instance;
            }
        }

        // 3. Try to find by exact title match (for after re-login when IDs change)
        // Only match unassigned instances to avoid stealing from other windows
        if (windowTitle && windowTitle.length > 4) {
            for (const instance of appData.instances) {
                if (!instance.assigned && instance.title_snapshot === windowTitle) {
                    global.log(`${UUID}: Matched instance by title: "${windowTitle}"`);
                    instance.stable_sequence = windowSeq;
                    instance.x11_window_id = windowXid;
                    instance.assigned = true;
                    return instance;
                }
            }
        }

        // 3b. Try partial title match (project name in title, e.g. "file - PROJECT - VSCode")
        // This helps match VSCode windows where file changed but project is the same
        if (windowTitle && windowTitle.includes(' - ')) {
            const windowParts = windowTitle.split(' - ');
            // VSCode format: "file - project - Visual Studio Code" -> project is second-to-last
            const windowProject = windowParts.length >= 3 ? windowParts[windowParts.length - 2] : windowParts[0];

            for (const instance of appData.instances) {
                if (!instance.assigned && instance.title_snapshot && instance.title_snapshot.includes(' - ')) {
                    const savedParts = instance.title_snapshot.split(' - ');
                    const savedProject = savedParts.length >= 3 ? savedParts[savedParts.length - 2] : savedParts[0];

                    if (windowProject && savedProject && windowProject === savedProject) {
                        global.log(`${UUID}: Matched instance by project name: "${windowProject}"`);
                        instance.stable_sequence = windowSeq;
                        instance.x11_window_id = windowXid;
                        instance.assigned = true;
                        return instance;
                    }
                }
            }
        }

        // 4. Try to find best unassigned instance using workspace/monitor scoring
        // This prevents wrong assignment when multiple windows of same app exist
        const windowWorkspace = metaWindow.get_workspace()?.index() ?? 0;
        const windowMonitor = metaWindow.get_monitor();

        let bestMatch = null;
        let bestScore = -1;

        for (const instance of appData.instances) {
            if (instance.assigned) continue;

            let score = 0;

            // Workspace match: +100 points (most important for correct placement)
            if (instance.workspace === windowWorkspace) {
                score += 100;
            }

            // Monitor match: +50 points
            if (instance.monitor_index === windowMonitor) {
                score += 50;
            }

            // Title similarity: +25 points for partial match
            if (windowTitle && instance.title_snapshot) {
                const titleLower = windowTitle.toLowerCase();
                const savedLower = instance.title_snapshot.toLowerCase();
                if (titleLower.includes(savedLower.substring(0, 10)) ||
                    savedLower.includes(titleLower.substring(0, 10))) {
                    score += 25;
                }
            }

            if (score > bestScore) {
                bestScore = score;
                bestMatch = instance;
            }
        }

        if (bestMatch) {
            global.log(`${UUID}: Best scored match for ${appData.wm_class}: score=${bestScore}, ws=${bestMatch.workspace}, mon=${bestMatch.monitor_index}`);
            bestMatch.stable_sequence = windowSeq;
            bestMatch.x11_window_id = windowXid;
            bestMatch.assigned = true;
            return bestMatch;
        }

        // 5. Fallback: first unassigned instance (only if no scoring possible)
        for (const instance of appData.instances) {
            if (!instance.assigned) {
                global.log(`${UUID}: Using first unassigned instance for ${appData.wm_class} (no scored match)`);
                instance.stable_sequence = windowSeq;
                instance.x11_window_id = windowXid;
                instance.assigned = true;
                return instance;
            }
        }

        // 6. Create new instance only if no match found
        const newInstance = {
            id: `${appData.wm_class}-${Date.now()}`,
            stable_sequence: windowSeq,
            x11_window_id: windowXid,
            title_pattern: null,
            title_snapshot: windowTitle,
            cmdline: null,
            working_dir: null,
            monitor_index: 0,
            geometry_percent: null,
            geometry_absolute: null,
            workspace: 0,
            maximized: false,
            autostart: true,
            assigned: true
        };

        appData.instances.push(newInstance);
        global.log(`${UUID}: Created new instance for ${appData.wm_class} (no existing match)`);
        return newInstance;
    }
};
