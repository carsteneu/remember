/**
 * Thunderbird Plugin Handler
 *
 * Handles Thunderbird mail client with profile detection from window title.
 * Extracts email address from window title and matches it against profiles.
 *
 * Special handling:
 * - Main windows: Extract email from title -> match to profile
 * - Compose/other windows: Use profile from parent window (same session)
 * - Fallback: Use default profile from profiles.ini
 */

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const UUID = "remember@thechief";

/**
 * Thunderbird Handler Class
 */
var ThunderbirdHandler = class ThunderbirdHandler {
    constructor(config, extensionSettings, storage) {
        this._config = config;
        this._extensionSettings = extensionSettings;
        this._storage = storage;

        // Cache the default profile for fallback
        this._defaultProfile = null;
        this._profilesCache = null;
    }

    /**
     * Hook: Called before launching the app
     */
    beforeLaunch(instance, launchParams) {
        // Profile detection is done via parseTitleData
        return launchParams;
    }

    /**
     * Hook: Called after launching the app
     */
    afterLaunch(instance, pid, success) {
        if (success) {
            global.log(`${UUID}: Thunderbird launched with PID ${pid}`);
        }
    }

    /**
     * Hook: Check if instance should be skipped during restore
     *
     * Thunderbird child windows (Compose, Address Book, etc.) cannot be
     * meaningfully restored - they belong to a profile that's already running.
     * Only main mailbox windows should be restored.
     *
     * @param {Object} instance - Instance data
     * @returns {boolean} True to skip this instance
     */
    shouldSkipRestore(instance) {
        if (!instance || !instance.title_snapshot) return false;

        const title = instance.title_snapshot;

        // Skip transient/child windows that can't be restored independently
        // These patterns indicate windows that belong to an already-running profile
        const skipPatterns = [
            /^Verfassen:/i,           // Compose window (German)
            /^Compose:/i,             // Compose window (English)
            /^Rédaction:/i,           // Compose window (French)
            /^Adressbuch/i,           // Address book (German)
            /^Address Book/i,         // Address book (English)
            /^Carnet d'adresses/i,    // Address book (French)
            /^Filterregeln/i,         // Filter rules
            /^Message Filters/i,
            /^Einstellungen/i,        // Settings
            /^Preferences/i,
            /^Options/i,
        ];

        for (const pattern of skipPatterns) {
            if (pattern.test(title)) {
                global.log(`${UUID}: Thunderbird: Skipping transient window "${title.substring(0, 40)}..."`);
                return true;
            }
        }

        return false;
    }

    /**
     * Hook: Parse profile from window title
     *
     * Window titles contain the email address, e.g.:
     * "Posteingang - user@example.com - Mozilla Thunderbird"
     *
     * For windows without email (Compose, etc.), we try to find the profile
     * from other Thunderbird instances in the same session.
     *
     * @param {string} title - Window title
     * @param {Object} instance - Instance data (optional)
     * @returns {string[]|null} Profile arguments [-P, profileName, --new-instance] or [-p] for manager
     */
    parseTitleData(title, instance) {
        // 1. Try to get profile from title (email in title)
        const profileFromTitle = title ? this._getProfileFromTitle(title) : null;

        if (profileFromTitle) {
            global.log(`${UUID}: Thunderbird: Using profile "${profileFromTitle}" from title`);
            return ['-P', profileFromTitle, '--new-instance'];
        }

        // 2. Try to find profile from other Thunderbird instances (same session)
        const profileFromSibling = this._getProfileFromSiblingInstances(instance);
        if (profileFromSibling) {
            global.log(`${UUID}: Thunderbird: Using profile "${profileFromSibling}" from sibling instance`);
            return ['-P', profileFromSibling, '--new-instance'];
        }

        // 3. Fallback: Use default profile from profiles.ini
        const defaultProfile = this._getDefaultProfile();
        if (defaultProfile) {
            global.log(`${UUID}: Thunderbird: Using default profile "${defaultProfile}"`);
            return ['-P', defaultProfile, '--new-instance'];
        }

        // 4. Last resort: Profile manager (shouldn't happen normally)
        global.log(`${UUID}: Thunderbird: No profile found, using profile manager`);
        return ['-p'];
    }

    /**
     * Find profile from other Thunderbird instances in storage
     * Useful for Compose windows that don't have email in title
     *
     * @param {Object} currentInstance - Current instance being launched
     * @returns {string|null} Profile name or null
     */
    _getProfileFromSiblingInstances(currentInstance) {
        if (!this._storage) return null;

        const apps = this._storage.getAllApps();
        if (!apps) return null;

        // Check all Thunderbird wmClasses
        const tbWmClasses = ['thunderbird', 'Thunderbird', 'thunderbird-esr', 'Mail'];

        for (const wmClass of tbWmClasses) {
            const appData = apps[wmClass];
            if (!appData || !appData.instances) continue;

            for (const inst of appData.instances) {
                // Skip current instance
                if (currentInstance && inst.id === currentInstance.id) continue;

                // Try to extract email from this instance's title
                if (inst.title_snapshot) {
                    const emailMatch = inst.title_snapshot.match(/[\w.-]+@[\w.-]+\.\w+/);
                    if (emailMatch) {
                        const profile = this._matchEmailToProfile(emailMatch[0].toLowerCase());
                        if (profile) {
                            global.log(`${UUID}: Thunderbird: Found profile "${profile}" from sibling "${inst.title_snapshot.substring(0, 40)}..."`);
                            return profile;
                        }
                    }
                }
            }
        }

        return null;
    }

    /**
     * Get the default profile from profiles.ini
     * @returns {string|null} Default profile name or null
     */
    _getDefaultProfile() {
        // Return cached value if available
        if (this._defaultProfile !== null) {
            return this._defaultProfile || null;
        }

        try {
            const profiles = this._getProfiles();
            if (!profiles || profiles.length === 0) {
                this._defaultProfile = '';
                return null;
            }

            // Find default profile (Default=1 in profiles.ini)
            for (const profile of profiles) {
                if (profile.isDefault) {
                    this._defaultProfile = profile.name;
                    global.log(`${UUID}: Thunderbird: Default profile is "${profile.name}"`);
                    return profile.name;
                }
            }

            // No explicit default, use the first profile
            this._defaultProfile = profiles[0].name;
            global.log(`${UUID}: Thunderbird: No default set, using first profile "${profiles[0].name}"`);
            return profiles[0].name;

        } catch (e) {
            global.logError(`${UUID}: Thunderbird: Failed to get default profile: ${e}`);
            this._defaultProfile = '';
            return null;
        }
    }

    /**
     * Match an email address to a Thunderbird profile
     * @param {string} email - Email address to match
     * @returns {string|null} Profile name or null
     */
    _matchEmailToProfile(email) {
        const profiles = this._getProfiles();
        if (!profiles) return null;

        for (const profile of profiles) {
            if (!profile.path || !profile.name) continue;

            const prefsPath = GLib.build_filenamev([
                GLib.get_home_dir(),
                '.thunderbird',
                profile.path,
                'prefs.js'
            ]);
            const prefsFile = Gio.File.new_for_path(prefsPath);

            if (!prefsFile.query_exists(null)) continue;

            try {
                const [prefsSuccess, prefsContents] = prefsFile.load_contents(null);
                if (!prefsSuccess) continue;

                const prefsText = imports.byteArray.toString(prefsContents);

                // Look for email in mail.identity.*.useremail settings
                const emailMatches = prefsText.match(/mail\.identity\.[^"]*\.useremail",\s*"([^"]+)"/g);
                if (emailMatches) {
                    for (const match of emailMatches) {
                        const emailInPrefs = match.match(/"([^"]+)"$/);
                        if (emailInPrefs && emailInPrefs[1].toLowerCase() === email) {
                            return profile.name;
                        }
                    }
                }
            } catch (e) {
                // Continue to next profile
            }
        }

        return null;
    }

    /**
     * Get all profiles (cached)
     * @returns {Object[]|null} Array of profiles or null
     */
    _getProfiles() {
        if (this._profilesCache !== null) {
            return this._profilesCache;
        }

        try {
            const configPath = (this._config && this._config.configPaths && this._config.configPaths.profilesIni)
                ? this._config.configPaths.profilesIni
                : '.thunderbird/profiles.ini';
            const profilesIniPath = GLib.build_filenamev([
                GLib.get_home_dir(),
                configPath
            ]);
            const profilesIniFile = Gio.File.new_for_path(profilesIniPath);

            if (!profilesIniFile.query_exists(null)) {
                this._profilesCache = [];
                return [];
            }

            const [success, contents] = profilesIniFile.load_contents(null);
            if (!success) {
                this._profilesCache = [];
                return [];
            }

            const profilesIni = imports.byteArray.toString(contents);
            this._profilesCache = this._parseProfilesIni(profilesIni);
            return this._profilesCache;

        } catch (e) {
            global.logError(`${UUID}: Thunderbird: Failed to load profiles: ${e}`);
            this._profilesCache = [];
            return [];
        }
    }

    /**
     * Get Thunderbird profile name from window title
     * Extracts email from title and matches against profiles
     *
     * @param {string} windowTitle - Window title
     * @returns {string|null} Profile name or null
     */
    _getProfileFromTitle(windowTitle) {
        // Extract email from title (format: "... - email@domain.com - Mozilla Thunderbird")
        const emailMatch = windowTitle.match(/[\w.-]+@[\w.-]+\.\w+/);
        if (!emailMatch) {
            global.log(`${UUID}: Thunderbird: No email found in title "${windowTitle}"`);
            return null;
        }

        const email = emailMatch[0].toLowerCase();
        global.log(`${UUID}: Thunderbird: Extracted email: ${email}`);

        return this._matchEmailToProfile(email);
    }

    /**
     * Parse profiles.ini file
     * @param {string} iniContent - Content of profiles.ini
     * @returns {Object[]} Array of { name, path, isDefault }
     */
    _parseProfilesIni(iniContent) {
        const profiles = [];
        let currentProfile = null;

        for (const line of iniContent.split('\n')) {
            const trimmed = line.trim();

            if (trimmed.startsWith('[Profile')) {
                if (currentProfile) {
                    profiles.push(currentProfile);
                }
                currentProfile = { name: null, path: null, isDefault: false };
            } else if (currentProfile) {
                if (trimmed.startsWith('Name=')) {
                    currentProfile.name = trimmed.substring(5);
                } else if (trimmed.startsWith('Path=')) {
                    currentProfile.path = trimmed.substring(5);
                } else if (trimmed.startsWith('Default=1')) {
                    currentProfile.isDefault = true;
                }
            }
        }

        if (currentProfile) {
            profiles.push(currentProfile);
        }

        return profiles;
    }

    destroy() {
        // Clear caches
        this._defaultProfile = null;
        this._profilesCache = null;
    }
};
