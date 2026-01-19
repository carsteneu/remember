"""
Application Session Restore Configuration

DEPRECATED: This module is deprecated and will be removed in a future version.
Use plugin_loader.py and plugin_handlers.py instead.

The plugin system now handles app configuration dynamically through
plugin config.json files with settings blocks.

Handles checking and configuring session restore for various applications.
"""

import warnings
warnings.warn(
    "app_config.py is deprecated. Use plugin_loader.py and plugin_handlers.py instead.",
    DeprecationWarning,
    stacklevel=2
)

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, GLib
import json
import os
import subprocess

from .utils import show_message, open_url
import gettext

# Translation function
_ = gettext.gettext


class AppConfigurator:
    """Handles application session restore configuration."""

    def __init__(self, parent_window):
        self.parent = parent_window

    # ========== VS Code ==========

    def check_vscode(self):
        """Check if VS Code is configured to restore windows."""
        config_path = os.path.expanduser("~/.config/Code/User/settings.json")
        if os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    content = f.read()
                    return '"window.restoreWindows": "all"' in content or '"window.restoreWindows":"all"' in content
            except:
                pass
        return False

    def configure_vscode(self, widget):
        """Configure VS Code to restore all windows."""
        config_dir = os.path.expanduser("~/.config/Code/User")
        config_path = os.path.join(config_dir, "settings.json")

        try:
            os.makedirs(config_dir, exist_ok=True)

            settings = {}
            if os.path.exists(config_path):
                with open(config_path, 'r') as f:
                    settings = json.load(f)

            settings['window.restoreWindows'] = 'all'

            with open(config_path, 'w') as f:
                json.dump(settings, f, indent=2)

            show_message(self.parent, _("VS Code configured!"), _("VS Code will now restore all windows on startup."))
        except Exception as e:
            show_message(self.parent, _("Error"), _("Failed to configure VS Code: {0}").format(e), Gtk.MessageType.ERROR)

    def open_vscode_settings(self, widget):
        """Open VS Code settings."""
        subprocess.Popen(['code', '--goto', 'settings.json'])

    # ========== Brave Browser ==========

    def check_brave(self):
        """Check if Brave is configured for session restore."""
        prefs_path = os.path.expanduser("~/.config/BraveSoftware/Brave-Browser/Default/Preferences")
        if os.path.exists(prefs_path):
            try:
                with open(prefs_path, 'r') as f:
                    prefs = json.load(f)
                    return prefs.get('session', {}).get('restore_on_startup', 0) == 1
            except:
                pass
        return False

    def configure_brave(self, widget):
        """Show instructions for Brave configuration."""
        show_message(
            self.parent,
            _("Configure Brave Browser"),
            _("Brave settings cannot be changed externally.\n\n"
            "Please configure manually:\n"
            "1. Open Brave\n"
            "2. Go to Settings (brave://settings/)\n"
            "3. Find 'On startup'\n"
            "4. Select 'Continue where you left off'"),
            Gtk.MessageType.INFO
        )

    def open_brave_settings(self, widget):
        """Open Brave settings."""
        open_url("brave://settings/")

    # ========== Firefox ==========

    def check_firefox(self):
        """Check if Firefox is configured for session restore."""
        profile_dir = os.path.expanduser("~/.mozilla/firefox")
        if os.path.exists(profile_dir):
            for item in os.listdir(profile_dir):
                if '.default' not in item:
                    continue
                for filename in ["user.js", "prefs.js"]:
                    filepath = os.path.join(profile_dir, item, filename)
                    if os.path.exists(filepath):
                        try:
                            with open(filepath, 'r') as f:
                                content = f.read()
                                if 'browser.startup.page", 3' in content:
                                    return True
                        except:
                            pass
        return False

    def configure_firefox(self, widget):
        """Configure Firefox for session restore."""
        profile_dir = os.path.expanduser("~/.mozilla/firefox")
        if not os.path.exists(profile_dir):
            show_message(self.parent, _("Firefox not found"), _("Firefox profile directory not found."), Gtk.MessageType.WARNING)
            return

        for item in os.listdir(profile_dir):
            if '.default' not in item:
                continue
            user_js_path = os.path.join(profile_dir, item, "user.js")
            try:
                existing_content = ""
                if os.path.exists(user_js_path):
                    with open(user_js_path, 'r') as f:
                        existing_content = f.read()

                if 'browser.startup.page", 3' in existing_content:
                    show_message(self.parent, _("Already configured"), _("Firefox session restore is already enabled."))
                    return

                with open(user_js_path, 'a') as f:
                    f.write('\n// Added by Window Position Remember\n')
                    f.write('user_pref("browser.startup.page", 3);\n')
                show_message(self.parent, _("Firefox configured!"), _("Firefox will now restore previous session.\nRestart Firefox for changes to take effect."))
                return
            except Exception as e:
                show_message(self.parent, _("Error"), _("Failed to configure Firefox: {0}").format(e), Gtk.MessageType.ERROR)
                return

        show_message(self.parent, _("Firefox profile not found"), _("Could not find Firefox default profile."), Gtk.MessageType.WARNING)

    def open_firefox_settings(self, widget):
        """Open Firefox settings."""
        open_url("about:preferences#general")

    # ========== Google Chrome ==========

    def check_chrome(self):
        """Check if Chrome is configured for session restore."""
        prefs_path = os.path.expanduser("~/.config/google-chrome/Default/Preferences")
        if os.path.exists(prefs_path):
            try:
                with open(prefs_path, 'r') as f:
                    prefs = json.load(f)
                    return prefs.get('session', {}).get('restore_on_startup', 0) == 1
            except:
                pass
        return False

    def configure_chrome(self, widget):
        """Configure Chrome for session restore."""
        prefs_path = os.path.expanduser("~/.config/google-chrome/Default/Preferences")

        if not os.path.exists(prefs_path):
            show_message(self.parent, _("Chrome not found"), _("Chrome preferences file not found."), Gtk.MessageType.WARNING)
            return

        try:
            with open(prefs_path, 'r') as f:
                prefs = json.load(f)

            if prefs.get('session', {}).get('restore_on_startup', 0) == 1:
                show_message(self.parent, _("Already configured"), _("Chrome session restore is already enabled."))
                return

            if 'session' not in prefs:
                prefs['session'] = {}
            prefs['session']['restore_on_startup'] = 1

            with open(prefs_path, 'w') as f:
                json.dump(prefs, f, separators=(',', ':'))

            show_message(
                self.parent,
                _("Chrome configured!"),
                _("Chrome will now restore previous session on startup.\n\n"
                "Note: Chrome must be fully closed for this to take effect.")
            )
        except Exception as e:
            show_message(self.parent, _("Error"), _("Failed to configure Chrome: {0}").format(e), Gtk.MessageType.ERROR)

    def open_chrome_settings(self, widget):
        """Open Chrome settings."""
        open_url("chrome://settings/")

    # ========== Thunderbird ==========

    def check_thunderbird(self):
        """Thunderbird always restores state."""
        return True

    def configure_thunderbird(self, widget):
        """Thunderbird doesn't need configuration."""
        pass

    # ========== Generic methods ==========

    def get_app_configs(self):
        """Get list of app configuration tuples."""
        return [
            (_("Visual Studio Code"), _("Restore all windows with their tabs"),
             self.configure_vscode, self.check_vscode, self.open_vscode_settings),
            (_("Brave Browser"), _("Continue where you left off"),
             self.configure_brave, self.check_brave, self.open_brave_settings),
            (_("Firefox"), _("Restore previous session on startup"),
             self.configure_firefox, self.check_firefox, self.open_firefox_settings),
            (_("Google Chrome"), _("Continue where you left off"),
             self.configure_chrome, self.check_chrome, self.open_chrome_settings),
            (_("Thunderbird"), _("Auto-restores state (always enabled)"),
             self.configure_thunderbird, self.check_thunderbird, None),
        ]

    def handle_switch_toggle(self, switch, state, configure_func, check_func):
        """Handle app config switch toggle."""
        if state:
            configure_func(switch)
            if check_func:
                GLib.timeout_add(500, lambda: switch.set_active(check_func()))
        else:
            show_message(
                self.parent,
                _("Manual Action Required"),
                _("To disable session restore, please open the app's settings and change it manually."),
                Gtk.MessageType.INFO
            )
            if check_func:
                GLib.timeout_add(100, lambda: switch.set_active(check_func()))
        return True
