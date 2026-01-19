/**
 * VS Code Plugin Handler
 *
 * VS Code aggressively positions its own windows on startup,
 * so we need multiple restore attempts to override it.
 */

var VSCodeHandler = class VSCodeHandler {
    constructor(config) {
        this._config = config;

        // VS Code self-positions aggressively and takes several seconds to fully load
        // Use longer timings to catch late repositioning
        this.restoreTimings = [500, 1500, 3000, 5000, 8000];
    }

    destroy() {
        // Nothing to clean up
    }
};
