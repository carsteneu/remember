// logger.js - Secure logging with sanitization and debug mode
const GLib = imports.gi.GLib;

const UUID = 'remember@thechief';

// Check debug mode once at module load
const _debugEnv = GLib.getenv('REMEMBER_DEBUG');
const _debugMode = _debugEnv === '1' || _debugEnv === 'true';

/**
 * Global log function - only logs if REMEMBER_DEBUG=1
 * Use this instead of global.log() throughout the extension
 * @param {string} message - Log message (UUID prefix added automatically)
 */
var log = function(message) {
    if (_debugMode) {
        global.log(`${UUID}: ${message}`);
    }
};

/**
 * Error logging - always logs regardless of debug mode
 * @param {string} message - Error message
 * @param {Error} error - Optional error object
 */
var logError = function(message, error = null) {
    if (error) {
        global.logError(`${UUID}: ${message}: ${error}`);
        if (error.stack) {
            global.logError(`${UUID}: Stack: ${error.stack}`);
        }
    } else {
        global.logError(`${UUID}: ${message}`);
    }
};

/**
 * Check if debug mode is enabled
 * @returns {boolean}
 */
var isDebugMode = function() {
    return _debugMode;
};

/**
 * Logger Module
 * Provides sanitized logging with configurable verbosity and debug mode
 */
var Logger = class Logger {
    constructor() {
        this._debugMode = _debugMode;
        if (this._debugMode) {
            global.log(`${UUID}: Debug mode ENABLED - verbose logging active`);
        }
    }

    /**
     * Standard log with UUID prefix (only in debug mode)
     */
    log(message) {
        log(message);
    }

    /**
     * Log with sensitive data sanitization
     * @param {string} message - Log message
     * @param {object} sensitiveData - Object with sensitive fields to sanitize
     *   Supported fields: cmdline (array), title (string), path (string), workingDir (string)
     */
    logSensitive(message, sensitiveData = {}) {
        if (!this._debugMode) return; // Skip entirely in production

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
        logError(message, error);
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
