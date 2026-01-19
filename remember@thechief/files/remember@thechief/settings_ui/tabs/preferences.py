"""
Preferences Tab - Extension settings and configuration options
Uses card layout with descriptions displayed directly (like Apps & Session tab)
"""

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, GLib
import json
import os

from ..utils import WidgetFactory
from ..i18n import _

# Translation function


# Path to preferences settings file
PREFERENCES_FILE = os.path.join(
    GLib.get_home_dir(), '.config', 'remember@thechief', 'preferences.json'
)


class PreferencesTab:
    """Creates the Preferences tab with extension settings in card layout."""

    def __init__(self, data_manager, parent_window):
        self.data_manager = data_manager
        self.parent = parent_window
        self.preferences = self._load_preferences()
        # Save defaults if file didn't exist
        if not os.path.exists(PREFERENCES_FILE):
            self._save_preferences()

    def create(self):
        """Create the Preferences tab widget."""
        main_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        main_box.set_margin_start(16)
        main_box.set_margin_end(16)
        main_box.set_margin_top(16)
        main_box.set_margin_bottom(16)

        # Header
        header = Gtk.Label()
        header.set_markup(f"<b>{_('Extension Preferences')}</b>")
        header.set_halign(Gtk.Align.START)
        main_box.pack_start(header, False, False, 0)

        desc = Gtk.Label(label=_("Configure how windows are tracked and restored."))
        desc.set_halign(Gtk.Align.START)
        desc.set_line_wrap(True)
        desc.set_margin_bottom(16)
        main_box.pack_start(desc, False, False, 0)

        # Scrolled window for settings cards
        scrolled = Gtk.ScrolledWindow()
        scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        main_box.pack_start(scrolled, True, True, 0)

        # Container for all sections
        content_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=16)
        scrolled.add(content_box)

        # Section 1: Window States
        window_states_settings = [
            ('rememberSticky', _("Remember sticky (on all workspaces)"),
             _("Remember sticky (on all workspaces)"), True),
            ('rememberAlwaysOnTop', _("Remember always-on-top"),
             _("Remember always-on-top"), True),
            ('rememberShaded', _("Remember shaded (rolled up)"),
             _("Remember shaded (rolled up)"), False),
            ('rememberFullscreen', _("Remember fullscreen"),
             _("Remember fullscreen"), True),
            ('restoreMinimized', _("Restore minimized state"),
             _("Restore minimized state"), False),
        ]
        section1 = self._create_settings_section(_("Window States"), window_states_settings)
        content_box.pack_start(section1, False, False, 0)

        # Section 2: Tracking Behavior
        tracking_settings = [
            ('trackDialogs', _("Track dialog windows"),
             _("Track dialog windows"), False),
            ('trackAllWorkspaces', _("Track all workspaces"),
             _("Track all workspaces"), True),
        ]
        section2 = self._create_settings_section(_("Tracking Behavior"), tracking_settings)
        content_box.pack_start(section2, False, False, 0)

        # Section 3: Restore Behavior
        restore_settings = [
            ('autoRestore', _("Enable auto-restore on login"),
             _("Enable auto-restore on login"), True),
            ('clampToScreen', _("Clamp windows to screen bounds"),
             _("Clamp windows to screen bounds"), True),
            ('restoreWorkspace', _("Restore workspace assignments"),
             _("Restore workspace assignments"), True),
        ]
        section3 = self._create_settings_section(_("Position Behavior"), restore_settings)
        content_box.pack_start(section3, False, False, 0)

        # Section 4: UI Settings
        ui_settings = [
            ('showProgressWindow', _("Show progress window on restore"),
             _("Show the progress window during session restore"), True),
        ]
        section4 = self._create_settings_section(_("UI Settings"), ui_settings)
        content_box.pack_start(section4, False, False, 0)

        return main_box

    def _create_settings_section(self, title, settings_list):
        """Create a section with settings cards in a 2-column grid."""
        section_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)

        # Section header
        header = WidgetFactory.create_section_header(title)
        section_box.pack_start(header, False, False, 0)

        # Grid for cards (2 columns)
        grid = Gtk.Grid()
        grid.set_column_spacing(16)
        grid.set_row_spacing(12)
        grid.set_column_homogeneous(True)
        section_box.pack_start(grid, False, False, 0)

        for i, (key, label_text, description, default) in enumerate(settings_list):
            card = self._create_settings_card(key, label_text, description, default)
            grid.attach(card, i % 2, i // 2, 1, 1)

        return section_box

    def _load_preferences(self):
        """Load preferences from JSON file."""
        if os.path.exists(PREFERENCES_FILE):
            try:
                with open(PREFERENCES_FILE, 'r') as f:
                    return json.load(f)
            except Exception:
                pass
        # Default preferences
        return {
            'rememberSticky': True,
            'rememberAlwaysOnTop': True,
            'rememberShaded': False,
            'rememberFullscreen': True,
            'restoreMinimized': False,
            'trackDialogs': False,
            'trackAllWorkspaces': True,
            'autoRestore': True,
            'clampToScreen': True,
            'restoreWorkspace': True,
            'showProgressWindow': True,
        }

    def _save_preferences(self):
        """Save preferences to JSON file."""
        try:
            os.makedirs(os.path.dirname(PREFERENCES_FILE), exist_ok=True)
            with open(PREFERENCES_FILE, 'w') as f:
                json.dump(self.preferences, f, indent=2)
        except Exception as e:
            print(f"Error saving preferences: {e}")

    def _create_settings_card(self, key, title, description, default_value):
        """Create a card for a single setting (like Apps & Session style)."""
        frame = Gtk.Frame()
        frame.get_style_context().add_class('config-frame')

        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        box.set_margin_start(12)
        box.set_margin_end(12)
        box.set_margin_top(12)
        box.set_margin_bottom(12)
        frame.add(box)

        # Header with title and switch
        header_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        box.pack_start(header_box, False, False, 0)

        # Status indicator
        is_enabled = self.preferences.get(key, default_value)
        status = Gtk.Label(label="●")
        status.get_style_context().add_class('status-active' if is_enabled else 'status-inactive')
        header_box.pack_start(status, False, False, 0)

        title_label = Gtk.Label()
        title_label.set_markup(f"<b>{title}</b>")
        title_label.set_halign(Gtk.Align.START)
        title_label.set_line_wrap(True)
        header_box.pack_start(title_label, True, True, 0)

        # Switch
        switch = Gtk.Switch()
        switch.set_active(is_enabled)
        switch.connect("notify::active",
            lambda sw, _, k=key, st=status: self._on_switch_toggled(sw, k, st))
        header_box.pack_end(switch, False, False, 0)

        # Description (displayed directly, not as tooltip)
        desc_label = Gtk.Label(label=description)
        desc_label.set_halign(Gtk.Align.START)
        desc_label.set_line_wrap(True)
        desc_label.get_style_context().add_class('dim-label')
        box.pack_start(desc_label, False, False, 0)

        return frame

    def _on_switch_toggled(self, switch, key, status_label):
        """Handle setting toggle changes and update status indicator."""
        is_active = switch.get_active()
        self.preferences[key] = is_active
        self._save_preferences()

        # Update status indicator
        status_label.get_style_context().remove_class('status-active')
        status_label.get_style_context().remove_class('status-inactive')
        status_label.get_style_context().add_class('status-active' if is_active else 'status-inactive')
