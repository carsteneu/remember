"""
Plugin Handlers for Settings UI

Provides handlers for checking and configuring plugin settings.
Each handler type corresponds to a specific way of checking or modifying
application configurations.
"""

import os
import json
import subprocess
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Tuple
from gi.repository import GLib

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk


class BaseHandler(ABC):
    """Base class for all handlers."""

    @abstractmethod
    def execute(self) -> Tuple[bool, Optional[str]]:
        """Execute the handler action.

        Returns:
            Tuple of (success, error_message)
        """
        pass


class CheckHandler(BaseHandler):
    """Base class for check handlers."""

    @abstractmethod
    def check(self) -> bool:
        """Check if the condition is met."""
        pass

    def execute(self) -> Tuple[bool, Optional[str]]:
        """Execute the check."""
        try:
            return self.check(), None
        except Exception as e:
            return False, str(e)


class ConfigureHandler(BaseHandler):
    """Base class for configure handlers."""

    @abstractmethod
    def configure(self) -> bool:
        """Apply the configuration."""
        pass

    def execute(self) -> Tuple[bool, Optional[str]]:
        """Execute the configuration."""
        try:
            return self.configure(), None
        except Exception as e:
            return False, str(e)


# ============================================================================
# Check Handlers
# ============================================================================

class JsonKeyCheckHandler(CheckHandler):
    """Checks if a JSON file contains a specific key with a specific value."""

    def __init__(self, path: str, key: str, value: Any):
        self.path = os.path.expanduser(path)
        self.key = key
        self.value = value

    def check(self) -> bool:
        if not os.path.exists(self.path):
            return False

        try:
            with open(self.path, 'r') as f:
                data = json.load(f)

            # Navigate nested keys (e.g., "session.restore_on_startup")
            keys = self.key.split('.')
            current = data
            for k in keys:
                if isinstance(current, dict) and k in current:
                    current = current[k]
                else:
                    return False

            return current == self.value
        except (json.JSONDecodeError, IOError):
            return False


class FileContainsCheckHandler(CheckHandler):
    """Checks if a file contains a specific pattern."""

    def __init__(self, path: str, pattern: str):
        self.path = os.path.expanduser(path)
        self.pattern = pattern

    def check(self) -> bool:
        if not os.path.exists(self.path):
            return False

        try:
            with open(self.path, 'r') as f:
                content = f.read()
            return self.pattern in content
        except IOError:
            return False


class FileExistsCheckHandler(CheckHandler):
    """Checks if a file exists."""

    def __init__(self, path: str):
        self.path = os.path.expanduser(path)

    def check(self) -> bool:
        return os.path.exists(self.path)


class CommandCheckHandler(CheckHandler):
    """Checks by running a command and examining its exit code."""

    def __init__(self, cmd: list):
        self.cmd = cmd

    def check(self) -> bool:
        try:
            result = subprocess.run(
                self.cmd,
                capture_output=True,
                timeout=10
            )
            return result.returncode == 0
        except (subprocess.TimeoutExpired, OSError):
            return False


class AlwaysTrueCheckHandler(CheckHandler):
    """Always returns True - for apps that auto-restore."""

    def check(self) -> bool:
        return True


class FirefoxProfileCheckHandler(CheckHandler):
    """Checks Firefox profile directories for a setting."""

    def __init__(self, pattern: str):
        self.pattern = pattern
        self.profile_dir = os.path.expanduser("~/.mozilla/firefox")

    def check(self) -> bool:
        if not os.path.exists(self.profile_dir):
            return False

        try:
            for item in os.listdir(self.profile_dir):
                if '.default' not in item:
                    continue
                for filename in ["user.js", "prefs.js"]:
                    filepath = os.path.join(self.profile_dir, item, filename)
                    if os.path.exists(filepath):
                        with open(filepath, 'r') as f:
                            if self.pattern in f.read():
                                return True
        except IOError:
            pass

        return False


# ============================================================================
# Configure Handlers
# ============================================================================

class JsonSetConfigureHandler(ConfigureHandler):
    """Sets a JSON key to a specific value."""

    def __init__(self, path: str, key: str, value: Any):
        self.path = os.path.expanduser(path)
        self.key = key
        self.value = value

    def configure(self) -> bool:
        # Create directory if needed
        os.makedirs(os.path.dirname(self.path), exist_ok=True)

        # Load existing data or start fresh
        data = {}
        if os.path.exists(self.path):
            try:
                with open(self.path, 'r') as f:
                    data = json.load(f)
            except (json.JSONDecodeError, IOError):
                pass

        # Navigate/create nested keys
        keys = self.key.split('.')
        current = data
        for k in keys[:-1]:
            if k not in current:
                current[k] = {}
            current = current[k]
        current[keys[-1]] = self.value

        # Write back
        with open(self.path, 'w') as f:
            json.dump(data, f, indent=2)

        return True


class FileAppendConfigureHandler(ConfigureHandler):
    """Appends content to a file."""

    def __init__(self, path: str, content: str, check_pattern: Optional[str] = None):
        self.path = os.path.expanduser(path)
        self.content = content
        self.check_pattern = check_pattern

    def configure(self) -> bool:
        # Create directory if needed
        os.makedirs(os.path.dirname(self.path), exist_ok=True)

        # Check if already present
        if self.check_pattern:
            if os.path.exists(self.path):
                with open(self.path, 'r') as f:
                    if self.check_pattern in f.read():
                        return True  # Already configured

        # Append content
        with open(self.path, 'a') as f:
            f.write(self.content)

        return True


class CommandConfigureHandler(ConfigureHandler):
    """Configures by running a command."""

    def __init__(self, cmd: list):
        self.cmd = cmd

    def configure(self) -> bool:
        try:
            result = subprocess.run(
                self.cmd,
                capture_output=True,
                timeout=30
            )
            return result.returncode == 0
        except (subprocess.TimeoutExpired, OSError):
            return False


class ManualConfigureHandler(ConfigureHandler):
    """Shows a manual instruction dialog."""

    def __init__(self, message: str, parent_window=None):
        self.message = message
        self.parent = parent_window

    def configure(self) -> bool:
        # Show info dialog
        if self.parent:
            dialog = Gtk.MessageDialog(
                transient_for=self.parent,
                flags=0,
                message_type=Gtk.MessageType.INFO,
                buttons=Gtk.ButtonsType.OK,
                text="Manual Configuration Required"
            )
            dialog.format_secondary_text(self.message)
            dialog.run()
            dialog.destroy()
        return True


class FirefoxConfigureHandler(ConfigureHandler):
    """Configures Firefox by writing to user.js in profile directory."""

    def __init__(self, pref_line: str, check_pattern: str):
        self.pref_line = pref_line
        self.check_pattern = check_pattern
        self.profile_dir = os.path.expanduser("~/.mozilla/firefox")

    def configure(self) -> bool:
        if not os.path.exists(self.profile_dir):
            return False

        configured = False
        for item in os.listdir(self.profile_dir):
            if '.default' not in item:
                continue

            user_js_path = os.path.join(self.profile_dir, item, "user.js")

            # Check if already configured
            if os.path.exists(user_js_path):
                with open(user_js_path, 'r') as f:
                    if self.check_pattern in f.read():
                        return True

            # Append configuration
            with open(user_js_path, 'a') as f:
                f.write('\n// Added by Window Position Remember\n')
                f.write(f'{self.pref_line}\n')
            configured = True
            break

        return configured


class OpenSettingsHandler(ConfigureHandler):
    """Opens app settings (URL or command)."""

    def __init__(self, type_: str, target: Any):
        self.type = type_
        self.target = target

    def configure(self) -> bool:
        if self.type == 'url':
            import webbrowser
            webbrowser.open(self.target)
            return True
        elif self.type == 'command':
            cmd = self.target if isinstance(self.target, list) else [self.target]
            try:
                subprocess.Popen(cmd)
                return True
            except OSError:
                return False
        return False


# ============================================================================
# Handler Factory
# ============================================================================

class HandlerFactory:
    """Factory for creating handlers from config definitions."""

    @staticmethod
    def create_check_handler(config: Dict, parent_window=None) -> Optional[CheckHandler]:
        """Create a check handler from a config definition."""
        if not config:
            return None

        handler_type = config.get('type')

        if handler_type == 'json_key':
            return JsonKeyCheckHandler(
                path=config.get('path', ''),
                key=config.get('key', ''),
                value=config.get('value')
            )
        elif handler_type == 'file_contains':
            return FileContainsCheckHandler(
                path=config.get('path', ''),
                pattern=config.get('pattern', '')
            )
        elif handler_type == 'file_exists':
            return FileExistsCheckHandler(
                path=config.get('path', '')
            )
        elif handler_type == 'command':
            return CommandCheckHandler(
                cmd=config.get('cmd', [])
            )
        elif handler_type == 'always_true':
            return AlwaysTrueCheckHandler()
        elif handler_type == 'firefox_profile':
            return FirefoxProfileCheckHandler(
                pattern=config.get('pattern', '')
            )

        return None

    @staticmethod
    def create_configure_handler(config: Dict, parent_window=None) -> Optional[ConfigureHandler]:
        """Create a configure handler from a config definition."""
        if not config:
            return None

        handler_type = config.get('type')

        if handler_type == 'json_set':
            return JsonSetConfigureHandler(
                path=config.get('path', ''),
                key=config.get('key', ''),
                value=config.get('value')
            )
        elif handler_type == 'file_append':
            return FileAppendConfigureHandler(
                path=config.get('path', ''),
                content=config.get('content', ''),
                check_pattern=config.get('checkPattern')
            )
        elif handler_type == 'command':
            return CommandConfigureHandler(
                cmd=config.get('cmd', [])
            )
        elif handler_type == 'manual':
            return ManualConfigureHandler(
                message=config.get('message', ''),
                parent_window=parent_window
            )
        elif handler_type == 'firefox':
            return FirefoxConfigureHandler(
                pref_line=config.get('prefLine', ''),
                check_pattern=config.get('checkPattern', '')
            )
        elif handler_type == 'url' or handler_type == 'open_settings':
            return OpenSettingsHandler(
                type_='url',
                target=config.get('url', config.get('target', ''))
            )

        return None

    @staticmethod
    def create_open_settings_handler(config: Dict) -> Optional[OpenSettingsHandler]:
        """Create an open settings handler from a config definition."""
        if not config:
            return None

        handler_type = config.get('type')

        if handler_type == 'url':
            return OpenSettingsHandler(
                type_='url',
                target=config.get('url', '')
            )
        elif handler_type == 'command':
            return OpenSettingsHandler(
                type_='command',
                target=config.get('cmd', [])
            )

        return None
