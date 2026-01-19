"""
Utility functions and classes for Window Position Remember Settings UI
"""

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, GLib
import json
import os
import subprocess
import gettext

# Translation function
_ = gettext.gettext

# Constants
UUID = "remember@thechief"
CONFIG_DIR = os.path.join(GLib.get_home_dir(), '.config', UUID)
CONFIG_FILE = os.path.join(CONFIG_DIR, 'positions.json')
APPLET_UUID = "remember-applet@thechief"
APPLET_DIR = os.path.join(GLib.get_home_dir(), '.local', 'share', 'cinnamon', 'applets', APPLET_UUID)


class DataManager:
    """Handles loading and saving of position data."""

    def __init__(self):
        self.data = self.load()

    def load(self):
        """Load position data from JSON file."""
        if not os.path.exists(CONFIG_FILE):
            return {"version": 3, "monitors": {}, "applications": {}, "settings": {}}

        try:
            with open(CONFIG_FILE, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading data: {e}")
            return {"version": 3, "monitors": {}, "applications": {}, "settings": {}}

    def save(self):
        """Save position data to JSON file."""
        os.makedirs(CONFIG_DIR, exist_ok=True)
        try:
            with open(CONFIG_FILE, 'w') as f:
                json.dump(self.data, f, indent=2)
            return True
        except Exception as e:
            print(f"Error saving data: {e}")
            return False

    def reload(self):
        """Reload data from file."""
        self.data = self.load()
        return self.data

    @property
    def applications(self):
        return self.data.get("applications", {})

    @property
    def monitors(self):
        return self.data.get("monitors", {})

    @property
    def settings(self):
        if 'settings' not in self.data:
            self.data['settings'] = {}
        return self.data['settings']

    @property
    def version(self):
        return self.data.get("version", "?")


def run_cinnamon_js(code):
    """Run JavaScript code via Cinnamon's DBus interface."""
    try:
        subprocess.run([
            'dbus-send', '--session', '--type=method_call',
            '--dest=org.Cinnamon',
            '/org/Cinnamon',
            'org.Cinnamon.Eval',
            f'string:{code}'
        ], check=False)
        return True
    except Exception as e:
        print(f"Error running JS: {e}")
        return False


def show_message(parent, title, message, msg_type=Gtk.MessageType.INFO):
    """Show a message dialog."""
    dialog = Gtk.MessageDialog(
        transient_for=parent,
        flags=0,
        message_type=msg_type,
        buttons=Gtk.ButtonsType.OK,
        text=title
    )
    dialog.format_secondary_text(message)
    dialog.run()
    dialog.destroy()


def open_url(url):
    """Open URL in appropriate browser."""
    try:
        if url.startswith("brave://"):
            subprocess.Popen(['brave-browser', url])
        elif url.startswith("chrome://"):
            subprocess.Popen(['google-chrome', url])
        elif url.startswith("about:"):
            subprocess.Popen(['firefox', url])
        else:
            subprocess.Popen(['xdg-open', url])
        return True
    except Exception as e:
        print(f"Error opening URL: {e}")
        return False


def format_position(instance):
    """Format position info compactly with Pango markup."""
    if instance.get("maximized"):
        return f'<span color="#3584e4">{_("Maximized")}</span>'
    if instance.get("fullscreen"):
        return f'<span color="#26a269">{_("Fullscreen")}</span>'

    geom = instance.get("geometry_absolute", {})
    if not geom:
        return f'<span color="#888888">{_("No position")}</span>'

    x = geom.get('x', 0)
    y = geom.get('y', 0)
    w = geom.get('width', 0)
    h = geom.get('height', 0)

    return f'{x},{y} {w}x{h}'


def get_state_badges(instance):
    """Generate state badge string."""
    badges = []

    if instance.get('sticky'):
        badges.append('S')
    if instance.get('alwaysOnTop'):
        badges.append('T')
    if instance.get('fullscreen'):
        badges.append('F')
    if instance.get('shaded'):
        badges.append('R')

    return ' '.join(badges) if badges else ''


def get_monitor_display_name(monitor_id, monitor_idx):
    """Get a display-friendly monitor name."""
    if monitor_id.startswith("edid:"):
        return f"M{monitor_idx + 1}"
    elif monitor_id.startswith("connector:"):
        connector = monitor_id.split(":")[1] if ":" in monitor_id else ""
        return connector[:8] if connector else f"M{monitor_idx + 1}"
    else:
        return f"M{monitor_idx + 1}"


class WidgetFactory:
    """Factory for creating common widgets with consistent styling."""

    @staticmethod
    def create_section_header(text):
        """Create a section header label."""
        header = Gtk.Label(label=text)
        header.set_halign(Gtk.Align.START)
        header.get_style_context().add_class('section-header')
        return header

    @staticmethod
    def create_stat_card(title, value, subtitle):
        """Create a statistics card widget."""
        card = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)
        card.get_style_context().add_class('stat-card')

        title_label = Gtk.Label(label=title.upper())
        title_label.set_halign(Gtk.Align.START)
        title_label.get_style_context().add_class('stat-title')
        card.pack_start(title_label, False, False, 0)

        value_label = Gtk.Label(label=str(value))
        value_label.set_halign(Gtk.Align.START)
        value_label.get_style_context().add_class('stat-value')
        card.pack_start(value_label, False, False, 0)

        subtitle_label = Gtk.Label(label=subtitle)
        subtitle_label.set_halign(Gtk.Align.START)
        subtitle_label.get_style_context().add_class('stat-subtitle')
        card.pack_start(subtitle_label, False, False, 0)

        return card

    @staticmethod
    def create_status_row(label_text, is_active, action_button=None):
        """Create a status indicator row."""
        box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        box.get_style_context().add_class('quick-stat')

        dot = Gtk.Label(label="●")
        dot.get_style_context().add_class('status-active' if is_active else 'status-inactive')
        box.pack_start(dot, False, False, 0)

        label = Gtk.Label(label=label_text)
        label.set_halign(Gtk.Align.START)
        box.pack_start(label, True, True, 0)

        if action_button:
            box.pack_end(action_button, False, False, 0)

        return box

    @staticmethod
    def create_action_button(label, icon_name, callback, style_class=None):
        """Create an action button with icon."""
        btn = Gtk.Button()
        btn_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)

        if icon_name:
            icon = Gtk.Image.new_from_icon_name(icon_name, Gtk.IconSize.BUTTON)
            btn_box.pack_start(icon, False, False, 0)

        btn_label = Gtk.Label(label=label)
        btn_box.pack_start(btn_label, False, False, 0)

        btn.add(btn_box)
        btn.get_style_context().add_class('action-button')
        if style_class:
            btn.get_style_context().add_class(style_class)
        btn.connect("clicked", callback)

        return btn

    @staticmethod
    def create_settings_row(key, label_text, tooltip, default_value, settings_dict, on_changed):
        """Create a settings row with label, tooltip, and switch."""
        row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        row.get_style_context().add_class('settings-row')

        label = Gtk.Label(label=label_text)
        label.set_halign(Gtk.Align.START)
        row.pack_start(label, True, True, 0)

        # Tooltip icon
        tooltip_btn = Gtk.Button(label="?")
        tooltip_btn.set_relief(Gtk.ReliefStyle.NONE)
        tooltip_btn.get_style_context().add_class('tooltip-icon')
        tooltip_btn.set_tooltip_text(tooltip)
        row.pack_start(tooltip_btn, False, False, 0)

        # Switch
        switch = Gtk.Switch()
        switch.set_active(settings_dict.get(key, default_value))
        switch.connect("notify::active", lambda sw, _, k=key: on_changed(k, sw.get_active()))
        row.pack_start(switch, False, False, 0)

        return row
