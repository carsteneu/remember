// logger.js - Secure logging with sanitization and debug mode
const GLib = imports.gi.GLib;

const UUID = 'remember@thechief';

/**
 * Logger Module
 * Provides sanitized logging with configurable verbosity and debug mode
 */
var Logger = class Logger {
    constructor() {
        this._debugMode = false;
        this._init();
    }

    _init() {
        // Check for debug mode from environment variable
        const debugEnv = GLib.getenv('REMEMBER_DEBUG');
        this._debugMode = debugEnv === '1' || debugEnv === 'true';

        if (this._debugMode) {
            global.log(`${UUID}: Debug mode ENABLED - sensitive data will be logged`);
        }
    }

    /**
     * Standard log with UUID prefix
     */
    log(message) {
        global.log(`${UUID}: ${message}`);
    }

    /**
     * Log with sensitive data sanitization
     * @param {string} message - Log message
     * @param {object} sensitiveData - Object with sensitive fields to sanitize
     *   Supported fields: cmdline (array), title (string), path (string), workingDir (string)
     */
    logSensitive(message, sensitiveData = {}) {
        if (this._debugMode) {
            // Debug mode: Log full data
            let debugParts = [message];

            if (sensitiveData.cmdline) {
                debugParts.push(`cmdline=[${sensitiveData.cmdline.join(' ')}]`);
            }
            if (sensitiveData.title) {
                debugParts.push(`title="${sensitiveData.title}"`);
            }
            if (sensitiveData.path) {
                debugParts.push(`path="${sensitiveData.path}"`);
            }
            if (sensitiveData.workingDir) {
                debugParts.push(`workingDir="${sensitiveData.workingDir}"`);
            }

            global.log(`${UUID}: ${debugParts.join(' ')}`);
        } else {
            // Production mode: Sanitize sensitive data
            let sanitizedParts = [message];

            if (sensitiveData.cmdline) {
                const sanitized = this.sanitizeCmdline(sensitiveData.cmdline);
                sanitizedParts.push(`cmdline=${sanitized}`);
            }
            if (sensitiveData.title) {
                const sanitized = this.sanitizeTitle(sensitiveData.title);
                sanitizedParts.push(`title=${sanitized}`);
            }
            if (sensitiveData.path) {
                const sanitized = this.sanitizePath(sensitiveData.path);
                sanitizedParts.push(`path=${sanitized}`);
            }
            if (sensitiveData.workingDir) {
                const sanitized = this.sanitizePath(sensitiveData.workingDir);
                sanitizedParts.push(`workingDir=${sanitized}`);
            }

            global.log(`${UUID}: ${sanitizedParts.join(' ')}`);
        }
    }

    /**
     * Debug-only logging (only logs if debug mode is enabled)
     */
    logDebug(message, data = null) {
        if (this._debugMode) {
            if (data) {
                global.log(`${UUID}: [DEBUG] ${message}: ${JSON.stringify(data)}`);
            } else {
                global.log(`${UUID}: [DEBUG] ${message}`);
            }
        }
    }

    /**
     * Error logging (always logs)
     */
    error(message, error = null) {
        if (error) {
            global.logError(`${UUID}: ${message}: ${error}`);
            if (error.stack) {
                global.logError(`${UUID}: Stack: ${error.stack}`);
            }
        } else {
            global.logError(`${UUID}: ${message}`);
        }
    }

    // === Sanitization Functions ===

    /**
     * Sanitize cmdline array - show only basename and arg count
     * @param {array} cmdlineArray - Command line arguments
     * @returns {string} - Sanitized string like "[firefox] <2 args>"
     */
    sanitizeCmdline(cmdlineArray) {
        if (!cmdlineArray || cmdlineArray.length === 0) {
            return '[empty]';
        }

        // Extract basename from first element (executable)
        const executable = cmdlineArray[0];
        const basename = GLib.path_get_basename(executable);

        const argCount = cmdlineArray.length - 1;

        if (argCount === 0) {
            return `[${basename}]`;
        } else {
            return `[${basename}] <${argCount} arg${argCount > 1 ? 's' : ''} redacted>`;
        }
    }

    /**
     * Sanitize title - hash to short hex
     * @param {string} title - Window title
     * @returns {string} - Hashed title like "[TITLE:a1b2c3d4]"
     */
    sanitizeTitle(title) {
        if (!title) {
            return '[TITLE:empty]';
        }

        const hash = this._hashString(title, 8);
        return `[TITLE:${hash}]`;
    }

    /**
     * Sanitize path - show only basename
     * @param {string} path - File path
     * @returns {string} - Redacted path like ".../filename.txt"
     */
    sanitizePath(path) {
        if (!path) {
            return '[PATH:empty]';
        }

        const basename = GLib.path_get_basename(path);
        return `.../${basename}`;
    }

    /**
     * Hash string to short hex (for sanitization)
     * @param {string} str - String to hash
     * @param {number} truncate - Number of hex chars to return
     * @returns {string} - Hex hash (truncated)
     */
    _hashString(str, truncate = 8) {
        // Use GLib checksum for simple hashing
        const checksum = GLib.compute_checksum_for_string(
            GLib.ChecksumType.SHA256,
            str,
            -1
        );
        return checksum.substring(0, truncate);
    }
};

