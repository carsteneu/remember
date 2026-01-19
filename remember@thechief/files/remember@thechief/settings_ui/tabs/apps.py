"""
Apps & Session Tab - Application session restore configuration

Dynamically loads plugin configurations and provides UI for:
- App-specific session restore settings
- Launch flags configuration
- Direct editing of plugin config values
"""

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, GLib, Pango
import json
import os

from ..plugin_loader import PluginLoader
from ..plugin_handlers import HandlerFactory
from ..utils import show_message
from ..i18n import _


# Path to extension settings file
EXTENSION_SETTINGS_FILE = os.path.join(
    GLib.get_home_dir(), '.config', 'remember@thechief', 'extension-settings.json'
)


class PluginEditDialog(Gtk.Dialog):
    """Dialog for editing plugin configuration."""

    def __init__(self, parent, plugin, plugin_loader):
        super().__init__(
            title=f"{plugin.display_name} - {_('Settings')}",
            transient_for=parent,
            modal=True,
            destroy_with_parent=True
        )
        self.plugin = plugin
        self.plugin_loader = plugin_loader
        self.config_path = os.path.join(plugin.plugin_path, 'config.json')
        self.config_data = self._load_config()
        self.entries = {}

        self.set_default_size(700, 600)
        self.add_button(_("Cancel"), Gtk.ResponseType.CANCEL)
        self.add_button(_("Save"), Gtk.ResponseType.OK)

        content = self.get_content_area()
        content.set_margin_start(16)
        content.set_margin_end(16)
        content.set_margin_top(16)
        content.set_margin_bottom(16)
        content.set_spacing(12)

        # Scrolled window for settings
        scrolled = Gtk.ScrolledWindow()
        scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        scrolled.set_min_content_height(300)
        content.pack_start(scrolled, True, True, 0)

        # Settings container
        settings_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        scrolled.add(settings_box)

        # Add editable fields for key config values
        self._add_basic_fields(settings_box)
        self._add_launch_fields(settings_box)
        self._add_features_fields(settings_box)

        self.show_all()

    def _load_config(self):
        """Load the plugin's config.json."""
        try:
            with open(self.config_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading config: {e}")
            return {}

    def _save_config(self):
        """Save the plugin's config.json."""
        try:
            with open(self.config_path, 'w') as f:
                json.dump(self.config_data, f, indent=2)
            return True
        except Exception as e:
            print(f"Error saving config: {e}")
            return False

    def _add_section_header(self, box, title):
        """Add a section header."""
        label = Gtk.Label()
        label.set_markup(f"<b>{title}</b>")
        label.set_halign(Gtk.Align.START)
        label.set_margin_top(8)
        box.pack_start(label, False, False, 0)

        sep = Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL)
        box.pack_start(sep, False, False, 0)

    def _add_field(self, box, key, value, editable=True, tooltip=None, display_name=None):
        """Add a key:value field."""
        row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        row.set_margin_start(8)
        box.pack_start(row, False, False, 0)

        # Key label with display name
        label_text = display_name if display_name else key
        key_label = Gtk.Label(label=f"{label_text}:")
        key_label.set_halign(Gtk.Align.START)
        key_label.set_width_chars(25)
        key_label.set_xalign(0)
        key_label.get_style_context().add_class('dim-label')
        row.pack_start(key_label, False, False, 0)

        # Value entry or label
        if editable:
            if isinstance(value, bool):
                entry = Gtk.Switch()
                entry.set_active(value)
                entry.set_valign(Gtk.Align.CENTER)
                self.entries[key] = ('bool', entry)
            elif isinstance(value, list):
                entry = Gtk.Entry()
                entry.set_text(', '.join(str(v) for v in value))
                entry.set_hexpand(True)
                self.entries[key] = ('list', entry)
            elif isinstance(value, (int, float)):
                entry = Gtk.SpinButton()
                entry.set_range(0, 999999)
                entry.set_increments(1, 10)
                entry.set_value(value)
                self.entries[key] = ('number', entry)
            else:
                entry = Gtk.Entry()
                entry.set_text(str(value) if value else '')
                entry.set_hexpand(True)
                self.entries[key] = ('string', entry)
            row.pack_start(entry, True, True, 0)
        else:
            value_label = Gtk.Label(label=str(value) if value else '-')
            value_label.set_halign(Gtk.Align.START)
            value_label.set_ellipsize(Pango.EllipsizeMode.END)
            row.pack_start(value_label, True, True, 0)

        if tooltip:
            row.set_tooltip_text(tooltip)

    def _add_basic_fields(self, box):
        """Add basic plugin info fields."""
        self._add_section_header(box, _("Allgemeine Informationen"))

        self._add_field(box, 'displayName', self.config_data.get('displayName', ''),
                       display_name=_("Anzeigename"))
        self._add_field(box, 'description', self.config_data.get('description', ''),
                       display_name=_("Beschreibung"))
        self._add_field(box, 'wmClass', self.config_data.get('wmClass', []),
                       display_name=_("Fensterklassen"),
                       tooltip=_("Fensterklassen-Namen (komma-getrennt)"))

    def _add_launch_fields(self, box):
        """Add launch configuration fields."""
        launch = self.config_data.get('launch', {})
        if not launch:
            return

        self._add_section_header(box, _("Start-Konfiguration"))

        self._add_field(box, 'launch.executables', launch.get('executables', []),
                       display_name=_("Ausführbare Dateien"),
                       tooltip=_("Programmpfade (komma-getrennt)"))
        self._add_field(box, 'launch.flags', launch.get('flags', []),
                       display_name=_("Standard-Flags"),
                       tooltip=_("Standard Kommandozeilen-Flags (komma-getrennt)"))

        # Conditional flags
        cond_flags = launch.get('conditionalFlags', {})
        for flag_key, flags in cond_flags.items():
            # Generate readable name
            readable_name = flag_key.replace('launchFlags.', '').replace('SessionRestore', ' Session Restore')
            self._add_field(box, f'launch.conditionalFlags.{flag_key}', flags,
                           display_name=readable_name,
                           tooltip=_("Bedingte Flags wenn aktiviert"))

    def _add_features_fields(self, box):
        """Add features fields."""
        features = self.config_data.get('features', {})
        if not features:
            return

        self._add_section_header(box, _("Funktionen"))

        if 'isSingleInstance' in features:
            self._add_field(box, 'features.isSingleInstance', features.get('isSingleInstance', False),
                           display_name=_("Einzelinstanz"))
        if 'autoRestore' in features:
            self._add_field(box, 'features.autoRestore', features.get('autoRestore', False),
                           display_name=_("Automatische Wiederherstellung"))
        if 'timeout' in features:
            self._add_field(box, 'features.timeout', features.get('timeout', 60000),
                           display_name=_("Timeout (ms)"),
                           tooltip=_("Wartezeit in Millisekunden"))
        if 'gracePeriod' in features:
            self._add_field(box, 'features.gracePeriod', features.get('gracePeriod', 30000),
                           display_name=_("Kulanzzeit (ms)"),
                           tooltip=_("Zusätzliche Wartezeit in Millisekunden"))

    def get_updated_config(self):
        """Get the updated configuration from entries."""
        for key, (value_type, widget) in self.entries.items():
            # Parse the key path
            parts = key.split('.')

            # Get the value from widget
            if value_type == 'bool':
                value = widget.get_active()
            elif value_type == 'list':
                text = widget.get_text()
                value = [v.strip() for v in text.split(',') if v.strip()]
            elif value_type == 'number':
                value = int(widget.get_value())
            else:
                value = widget.get_text()

            # Set the value in config_data
            if len(parts) == 1:
                self.config_data[key] = value
            elif len(parts) == 2:
                if parts[0] not in self.config_data:
                    self.config_data[parts[0]] = {}
                self.config_data[parts[0]][parts[1]] = value
            elif len(parts) == 3:
                if parts[0] not in self.config_data:
                    self.config_data[parts[0]] = {}
                if parts[1] not in self.config_data[parts[0]]:
                    self.config_data[parts[0]][parts[1]] = {}
                self.config_data[parts[0]][parts[1]][parts[2]] = value

        return self.config_data

    def save(self):
        """Save the updated configuration."""
        self.get_updated_config()
        return self._save_config()


class AppsSessionTab:
    """Creates the Apps & Session configuration tab with dynamic plugin loading."""

    def __init__(self, data_manager, parent_window):
        self.data_manager = data_manager
        self.parent = parent_window
        self.plugin_loader = PluginLoader()
        self.extension_settings = self._load_extension_settings()

    def _load_extension_settings(self):
        """Load extension settings from JSON file."""
        if os.path.exists(EXTENSION_SETTINGS_FILE):
            try:
                with open(EXTENSION_SETTINGS_FILE, 'r') as f:
                    return json.load(f)
            except Exception:
                pass
        return {
            "launchFlags": {
                "browserSessionRestore": True,
                "firefoxSessionRestore": True,
                "kateSessionRestore": True,
                "jetbrainsRestore": True
            }
        }

    def _save_extension_settings(self):
        """Save extension settings to JSON file."""
        try:
            os.makedirs(os.path.dirname(EXTENSION_SETTINGS_FILE), exist_ok=True)
            with open(EXTENSION_SETTINGS_FILE, 'w') as f:
                json.dump(self.extension_settings, f, indent=2)
        except Exception as e:
            print(f"Error saving extension settings: {e}")

    def create(self):
        """Create the Apps & Session tab widget."""
        main_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        main_box.set_margin_start(16)
        main_box.set_margin_end(16)
        main_box.set_margin_top(16)
        main_box.set_margin_bottom(16)

        # Header
        header = Gtk.Label()
        header.set_markup(f"<b>{_('Plugin Configuration')}</b>")
        header.set_halign(Gtk.Align.START)
        main_box.pack_start(header, False, False, 0)

        desc = Gtk.Label(label=_("Configure plugin settings. Click 'Edit' to modify values."))
        desc.set_halign(Gtk.Align.START)
        desc.set_line_wrap(True)
        desc.set_margin_bottom(16)
        main_box.pack_start(desc, False, False, 0)

        # Scrolled window for content
        scrolled = Gtk.ScrolledWindow()
        scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        main_box.pack_start(scrolled, True, True, 0)

        # 2-column grid for plugins
        self.grid = Gtk.Grid()
        self.grid.set_column_spacing(16)
        self.grid.set_row_spacing(12)
        self.grid.set_column_homogeneous(True)
        scrolled.add(self.grid)

        # Load and display plugins in 2 columns
        plugins = self.plugin_loader.get_sorted_plugins()

        for i, plugin in enumerate(plugins):
            card = self._create_plugin_card(plugin)
            col = i % 2
            row = i // 2
            self.grid.attach(card, col, row, 1, 1)

        return main_box

    def _create_plugin_card(self, plugin):
        """Create a compact card for a plugin with key:value list."""
        frame = Gtk.Frame()
        frame.get_style_context().add_class('plugin-card')

        main_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4)
        main_box.set_margin_start(12)
        main_box.set_margin_end(12)
        main_box.set_margin_top(10)
        main_box.set_margin_bottom(10)
        frame.add(main_box)

        # Header row with name and edit button
        header_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        main_box.pack_start(header_box, False, False, 0)

        # Plugin name
        name_label = Gtk.Label()
        name_label.set_markup(f"<b>{plugin.display_name}</b>")
        name_label.set_halign(Gtk.Align.START)
        header_box.pack_start(name_label, True, True, 0)

        # Edit button
        edit_btn = Gtk.Button()
        edit_btn.set_image(Gtk.Image.new_from_icon_name("document-edit-symbolic", Gtk.IconSize.BUTTON))
        edit_btn.set_tooltip_text(_("Edit Settings"))
        edit_btn.get_style_context().add_class('flat')
        edit_btn.connect("clicked", self._on_edit_clicked, plugin)
        header_box.pack_end(edit_btn, False, False, 0)

        # Key:Value list
        settings_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)
        settings_box.set_margin_top(6)
        main_box.pack_start(settings_box, False, False, 0)

        # Show key settings as key: value
        self._add_kv_row(settings_box, 'type', plugin.plugin_type or '-')

        # Show launch flags status
        launch_flags = self.extension_settings.get('launchFlags', {})
        for flag_key in plugin.conditional_flags:
            if flag_key.startswith('launchFlags.'):
                setting_key = flag_key.replace('launchFlags.', '')
                is_enabled = launch_flags.get(setting_key, True)
                row = self._add_kv_row_with_switch(settings_box, setting_key, is_enabled)

        # Show features
        if plugin.is_single_instance:
            self._add_kv_row(settings_box, 'singleInstance', 'true')
        if plugin.auto_restore:
            self._add_kv_row(settings_box, 'autoRestore', 'true')

        # Show app config settings status
        for key, setting in plugin.settings.items():
            if setting.type == 'app_config' and setting.check:
                handler = HandlerFactory.create_check_handler(setting.check, self.parent)
                if handler:
                    try:
                        is_configured, _err = handler.execute()
                        status = '✓' if is_configured else '✗'
                        self._add_kv_row(settings_box, setting.label, status)
                    except Exception:
                        self._add_kv_row(settings_box, setting.label, '?')

        return frame

    def _add_kv_row(self, box, key, value):
        """Add a simple key: value row."""
        row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=4)
        box.pack_start(row, False, False, 0)

        key_label = Gtk.Label(label=f"{key}:")
        key_label.set_halign(Gtk.Align.START)
        key_label.set_width_chars(14)
        key_label.set_xalign(0)
        key_label.get_style_context().add_class('dim-label')
        row.pack_start(key_label, False, False, 0)

        value_label = Gtk.Label(label=str(value))
        value_label.set_halign(Gtk.Align.START)
        value_label.set_ellipsize(Pango.EllipsizeMode.END)
        row.pack_start(value_label, True, True, 0)

        return row

    def _add_kv_row_with_switch(self, box, key, is_enabled):
        """Add a key: value row with a switch."""
        row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=4)
        box.pack_start(row, False, False, 0)

        key_label = Gtk.Label(label=f"{key}:")
        key_label.set_halign(Gtk.Align.START)
        key_label.set_width_chars(14)
        key_label.set_xalign(0)
        key_label.get_style_context().add_class('dim-label')
        row.pack_start(key_label, False, False, 0)

        switch = Gtk.Switch()
        switch.set_active(is_enabled)
        switch.set_valign(Gtk.Align.CENTER)
        switch.connect("notify::active",
            lambda sw, param, k=key: self._on_launch_flag_changed(sw, k))
        row.pack_start(switch, False, False, 0)

        return row

    def _on_launch_flag_changed(self, switch, key):
        """Handle launch flag toggle changes."""
        is_active = switch.get_active()

        if 'launchFlags' not in self.extension_settings:
            self.extension_settings['launchFlags'] = {}
        self.extension_settings['launchFlags'][key] = is_active
        self._save_extension_settings()

    def _on_edit_clicked(self, button, plugin):
        """Open the edit dialog for a plugin."""
        dialog = PluginEditDialog(self.parent, plugin, self.plugin_loader)
        response = dialog.run()

        if response == Gtk.ResponseType.OK:
            if dialog.save():
                show_message(
                    self.parent,
                    _("Saved"),
                    _("Plugin configuration saved. Restart Cinnamon to apply changes."),
                    Gtk.MessageType.INFO
                )
                # Reload plugins
                self.plugin_loader.reload()
            else:
                show_message(
                    self.parent,
                    _("Error"),
                    _("Failed to save plugin configuration."),
                    Gtk.MessageType.ERROR
                )

        dialog.destroy()
