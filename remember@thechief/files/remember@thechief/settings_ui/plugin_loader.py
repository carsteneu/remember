"""
Plugin Loader for Settings UI

Loads plugin configurations from plugin directories and provides
them to the Settings UI for dynamic rendering.
"""

import os
import json
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from gi.repository import GLib


@dataclass
class PluginSetting:
    """Represents a single plugin setting."""
    key: str
    type: str  # 'app_config', 'boolean', 'string', 'choice'
    label: str
    description: str = ""
    check: Optional[Dict] = None
    configure: Optional[Dict] = None
    unconfigure: Optional[Dict] = None
    open_settings: Optional[Dict] = None
    options: Optional[List[str]] = None  # For 'choice' type
    default: Any = None


@dataclass
class PluginConfig:
    """Represents a loaded plugin configuration."""
    name: str
    display_name: str
    description: str
    version: str = "1.0.0"
    wm_class: List[str] = field(default_factory=list)
    plugin_type: str = ""

    # Launch configuration
    executables: List[str] = field(default_factory=list)
    flags: List[str] = field(default_factory=list)
    conditional_flags: Dict[str, List[str]] = field(default_factory=dict)

    # Features
    is_single_instance: bool = False
    auto_restore: bool = False
    needs_config_manipulation: bool = False
    needs_title_parsing: bool = False

    # Settings for UI
    settings: Dict[str, PluginSetting] = field(default_factory=dict)

    # Path to plugin directory
    plugin_path: str = ""


class PluginLoader:
    """Loads plugin configurations for the Settings UI."""

    # Extension and user plugin paths
    EXTENSION_PLUGIN_PATH = os.path.join(
        GLib.get_home_dir(),
        '.local', 'share', 'cinnamon', 'extensions',
        'remember@thechief', 'plugins'
    )

    USER_PLUGIN_PATH = os.path.join(
        GLib.get_home_dir(),
        '.config', 'remember@thechief', 'plugins'
    )

    def __init__(self):
        self._plugins: Dict[str, PluginConfig] = {}
        self._loaded = False

    def get_plugin_directories(self) -> List[str]:
        """Get list of plugin directories to scan."""
        dirs = []

        # Extension plugins (primary)
        if os.path.isdir(self.EXTENSION_PLUGIN_PATH):
            dirs.append(self.EXTENSION_PLUGIN_PATH)

        # User plugins (override/custom)
        if os.path.isdir(self.USER_PLUGIN_PATH):
            dirs.append(self.USER_PLUGIN_PATH)

        return dirs

    def load_all(self) -> Dict[str, PluginConfig]:
        """Load all plugin configurations from plugin directories."""
        if self._loaded:
            return self._plugins

        self._plugins = {}

        for plugin_dir in self.get_plugin_directories():
            self._scan_plugin_directory(plugin_dir)

        self._loaded = True
        return self._plugins

    def reload(self) -> Dict[str, PluginConfig]:
        """Force reload all plugins."""
        self._loaded = False
        self._plugins = {}
        return self.load_all()

    def _scan_plugin_directory(self, base_dir: str):
        """Scan a plugin directory for plugin configurations."""
        try:
            for item in os.listdir(base_dir):
                plugin_path = os.path.join(base_dir, item)
                config_file = os.path.join(plugin_path, 'config.json')

                if os.path.isdir(plugin_path) and os.path.exists(config_file):
                    try:
                        config = self._load_plugin_config(config_file, plugin_path)
                        if config:
                            # User plugins override extension plugins
                            self._plugins[config.name] = config
                    except Exception as e:
                        print(f"Error loading plugin {item}: {e}")
        except Exception as e:
            print(f"Error scanning plugin directory {base_dir}: {e}")

    def _load_plugin_config(self, config_file: str, plugin_path: str) -> Optional[PluginConfig]:
        """Load a single plugin configuration from config.json."""
        try:
            with open(config_file, 'r') as f:
                data = json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            print(f"Error reading {config_file}: {e}")
            return None

        # Extract basic info
        name = data.get('name', '')
        if not name:
            return None

        # Build display name (fallback to capitalized name)
        display_name = data.get('displayName', name.replace('-', ' ').title())

        # Extract launch configuration
        launch = data.get('launch', {})
        conditional_flags = launch.get('conditionalFlags', {})

        # Extract features
        features = data.get('features', {})

        # Parse settings block
        settings = {}
        settings_data = data.get('settings', {})
        for key, setting_data in settings_data.items():
            settings[key] = self._parse_setting(key, setting_data)

        # Auto-generate launch flag settings from conditionalFlags
        for flag_key, flags in conditional_flags.items():
            if flag_key.startswith('launchFlags.'):
                setting_key = flag_key.replace('launchFlags.', '')
                if setting_key not in settings:
                    # Auto-generate a boolean setting for this launch flag
                    settings[setting_key] = PluginSetting(
                        key=setting_key,
                        type='launch_flag',
                        label=self._generate_flag_label(setting_key),
                        description=f"Use flags: {' '.join(flags)}",
                        default=True
                    )

        config = PluginConfig(
            name=name,
            display_name=display_name,
            description=data.get('description', ''),
            version=data.get('version', '1.0.0'),
            wm_class=data.get('wmClass', []),
            plugin_type=data.get('type', ''),
            executables=launch.get('executables', []),
            flags=launch.get('flags', []),
            conditional_flags=conditional_flags,
            is_single_instance=features.get('isSingleInstance', False),
            auto_restore=features.get('autoRestore', False),
            needs_config_manipulation=features.get('needsConfigManipulation', False),
            needs_title_parsing=features.get('needsTitleParsing', False),
            settings=settings,
            plugin_path=plugin_path
        )

        return config

    def _parse_setting(self, key: str, data: Dict) -> PluginSetting:
        """Parse a setting definition from config.json."""
        return PluginSetting(
            key=key,
            type=data.get('type', 'boolean'),
            label=data.get('label', key),
            description=data.get('description', ''),
            check=data.get('check'),
            configure=data.get('configure'),
            unconfigure=data.get('unconfigure'),
            open_settings=data.get('openSettings'),
            options=data.get('options'),
            default=data.get('default')
        )

    def _generate_flag_label(self, flag_key: str) -> str:
        """Generate a human-readable label from a flag key."""
        # browserSessionRestore -> Browser Session Restore
        import re
        # Split on camelCase boundaries
        words = re.sub(r'([a-z])([A-Z])', r'\1 \2', flag_key)
        return words.title()

    def get_plugins_with_settings(self) -> Dict[str, PluginConfig]:
        """Get only plugins that have settings or conditional flags."""
        self.load_all()
        return {
            name: config
            for name, config in self._plugins.items()
            if config.settings or config.conditional_flags
        }

    def get_all_plugins(self) -> Dict[str, PluginConfig]:
        """Get all loaded plugins."""
        self.load_all()
        return self._plugins

    def get_plugin(self, name: str) -> Optional[PluginConfig]:
        """Get a specific plugin by name."""
        self.load_all()
        return self._plugins.get(name)

    def get_plugins_by_type(self, plugin_type: str) -> Dict[str, PluginConfig]:
        """Get plugins filtered by type (e.g., 'chromium-browser', 'editor')."""
        self.load_all()
        return {
            name: config
            for name, config in self._plugins.items()
            if config.plugin_type == plugin_type
        }

    def get_sorted_plugins(self) -> List[PluginConfig]:
        """Get all plugins sorted by display name."""
        self.load_all()
        return sorted(self._plugins.values(), key=lambda p: p.display_name.lower())
