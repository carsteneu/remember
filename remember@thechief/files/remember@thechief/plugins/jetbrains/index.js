/**
 * JetBrains IDEs Plugin Handler
 *
 * JetBrains IDEs (IntelliJ, PyCharm, WebStorm, PhpStorm, etc.) restore their
 * last project automatically. This handler just logs and uses the cmdline
 * from the saved instance data.
 */

const GLib = imports.gi.GLib;

const UUID = "remember@thechief";

/**
 * JetBrains Handler Class
 */
var JetBrainsHandler = class JetBrainsHandler {
    constructor(config, extensionSettings, storage) {
        this._config = config;
        this._extensionSettings = extensionSettings;
        this._storage = storage;
    }

    /**
     * Hook: Before launch
     *
     * JetBrains IDEs need to be launched with the original cmdline since
     * they use specific launcher scripts per installation.
     */
    beforeLaunch(instance, launchParams) {
        // Use cmdline from instance if available (contains the IDE-specific launcher)
        if (instance.cmdline && instance.cmdline.length > 0) {
            launchParams.executable = instance.cmdline[0];
            global.log(`${UUID}: JetBrains: Using saved cmdline: ${launchParams.executable}`);
        }

        // Check if JetBrains restore is enabled in settings
        if (this._extensionSettings.useJetBrainsRestore && !this._extensionSettings.useJetBrainsRestore()) {
            global.log(`${UUID}: JetBrains restore disabled in settings (IDE will still restore on its own)`);
        }

        return launchParams;
    }

    afterLaunch(instance, pid, success) {
        if (success) {
            global.log(`${UUID}: JetBrains IDE launched with PID ${pid}`);
        }
    }

    /**
     * JetBrains doesn't need title parsing - it restores automatically
     */
    parseTitleData(title) {
        return null;
    }

    destroy() {}
};
