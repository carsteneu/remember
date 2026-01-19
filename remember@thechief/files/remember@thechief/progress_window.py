#!/usr/bin/env python3
"""
Session Restore Progress Window
Shows which windows are being restored during session start
"""

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, GLib, Gio
import json
import os
import sys
import subprocess
import gettext
import locale

# Setup constants first
UUID = "remember@thechief"

# Setup locale and translations
locale.setlocale(locale.LC_ALL, '')

# Translations are installed to ~/.local/share/locale by install.sh
LOCALE_DIR = os.path.expanduser("~/.local/share/locale")

# Fallback to system locale dir if user locale doesn't exist
if not os.path.exists(LOCALE_DIR):
    LOCALE_DIR = "/usr/share/locale"

try:
    translation = gettext.translation(UUID, localedir=LOCALE_DIR, fallback=True)
    _ = translation.gettext
except Exception as e:
    print(f"Translation setup failed: {e}")
    _ = gettext.gettext
CONFIG_DIR = os.path.expanduser(f"~/.config/{UUID}")
PREFERENCES_FILE = os.path.join(CONFIG_DIR, "preferences.json")
PROGRESS_STATUS_FILE = os.path.join(CONFIG_DIR, "progress-status.json")
POSITIONS_FILE = os.path.join(CONFIG_DIR, "positions.json")

# Status constants
STATUS_SCHEDULED = 'scheduled'
STATUS_LAUNCHING = 'launching'
STATUS_POSITIONING = 'positioning'
STATUS_READY = 'ready'
STATUS_TIMEOUT = 'timeout'
STATUS_ERROR = 'error'

# Status icons and colors
def get_status_info():
    """Get translatable status info."""
    return {
        STATUS_SCHEDULED: ('⏰', _('Scheduled'), '#888888'),
        STATUS_LAUNCHING: ('⏳', _('Launching...'), '#3584e4'),
        STATUS_POSITIONING: ('📍', _('Positioning'), '#e5a50a'),
        STATUS_READY: ('✓', _('Ready'), '#26a269'),
        STATUS_TIMEOUT: ('⚠', _('Timeout'), '#e66100'),
        STATUS_ERROR: ('✗', _('Error'), '#c01c28')
    }


class ProgressWindow(Gtk.Window):
    """Session restore progress window"""

    def __init__(self, apps_to_launch):
        super().__init__(title=_("Session Restore in Progress"))

        self.apps_to_launch = apps_to_launch
        self.instance_rows = {}  # instanceId -> tree_iter (for per-instance status updates)
        self.show_setting = self._load_show_setting()

        self.set_default_size(800, 500)
        self.set_position(Gtk.WindowPosition.CENTER)
        self.set_resizable(True)
        self.set_deletable(True)
        self.set_keep_above(True)  # Always on top - stay visible during restore

        self._build_ui()

    def _build_ui(self):
        """Build the window UI"""
        # Main container
        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=15)
        vbox.set_margin_start(20)
        vbox.set_margin_end(20)
        vbox.set_margin_top(20)
        vbox.set_margin_bottom(20)

        # Header with icon
        header_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
        icon = Gtk.Image.new_from_icon_name("folder-open-symbolic", Gtk.IconSize.DIALOG)
        title_label = Gtk.Label(label=f"<span size='x-large' weight='bold'>{_('Session Restore in Progress')}</span>")
        title_label.set_use_markup(True)
        header_box.pack_start(icon, False, False, 0)
        header_box.pack_start(title_label, False, False, 0)
        vbox.pack_start(header_box, False, False, 0)

        # Separator
        sep = Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL)
        vbox.pack_start(sep, False, False, 0)

        # Scrolled window for app list
        scrolled = Gtk.ScrolledWindow()
        scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        scrolled.set_vexpand(True)

        # TreeView for apps
        # Columns: App Name, Details, Monitor, Workspace, Size, Status, wmClass (hidden)
        self.store = Gtk.ListStore(str, str, str, str, str, str, str)
        self.tree = Gtk.TreeView(model=self.store)
        self.tree.set_headers_visible(True)

        # Columns in desired order: Name, Details, Monitor, Workspace, Size, Status
        cols = [
            (_("Program"), 0, 120),
            (_("Window"), 1, 200),
            (_("Monitor"), 2, 70),
            (_("Workspace"), 3, 100),
            (_("Size"), 4, 100),
            (_("Status"), 5, 120)
        ]

        for title, col_id, width in cols:
            renderer = Gtk.CellRendererText()
            column = Gtk.TreeViewColumn(title, renderer, text=col_id)
            column.set_min_width(width)
            column.set_resizable(True)
            self.tree.append_column(column)

        scrolled.add(self.tree)
        vbox.pack_start(scrolled, True, True, 0)

        # Populate with initial apps
        for item in self.apps_to_launch:
            wm_class = item['wmClass']
            instance = item['instance']
            # Use instanceId for unique identification (falls back to wmClass if not present)
            instance_id = item.get('instanceId', wm_class)

            # Get program name (clean wmClass) and window details (title, truncated)
            program_name = self._get_program_name(wm_class)
            window_details = self._truncate_text(instance.get('title', '—'), 120)

            # Monitor and workspace
            monitor = f"M{instance.get('monitor_index', 0) + 1}"
            workspace = f"WS{instance.get('workspace', 0) + 1}"

            # Size
            size = self._get_position_size_text(wm_class, instance)

            # Initial status
            icon, text, color = get_status_info()[STATUS_SCHEDULED]
            status_text = f"{icon} {text}"

            # Append in order: Program, Details, Monitor, Workspace, Size, Status, wmClass (hidden)
            tree_iter = self.store.append([program_name, window_details, monitor, workspace, size, status_text, wm_class])

            # Store tree_iter by instanceId for per-instance status updates
            self.instance_rows[instance_id] = tree_iter

        # Separator
        sep2 = Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL)
        vbox.pack_start(sep2, False, False, 0)

        # Footer
        footer_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)

        # Checkbox
        self.show_checkbox = Gtk.CheckButton(label=_("Show this window on startup"))
        self.show_checkbox.set_active(self.show_setting)
        self.show_checkbox.connect("toggled", self._on_checkbox_toggled)
        footer_box.pack_start(self.show_checkbox, False, False, 0)

        # Spacer
        footer_box.pack_start(Gtk.Box(), True, True, 0)

        # Close button
        close_btn = Gtk.Button(label=_("Close"))
        close_btn.connect("clicked", lambda w: self.destroy())
        footer_box.pack_end(close_btn, False, False, 0)

        vbox.pack_start(footer_box, False, False, 0)

        self.add(vbox)

        # Start periodic status file monitoring (every 50ms for fast updates)
        GLib.timeout_add(50, self._check_status_file)

    def _check_status_file(self):
        """Check status file for updates from extension"""
        try:
            if os.path.exists(PROGRESS_STATUS_FILE):
                with open(PROGRESS_STATUS_FILE, 'r') as f:
                    status_data = json.load(f)

                # Status file now uses instanceId as key
                for instance_id, info in status_data.items():
                    if instance_id in self.instance_rows:
                        # Update specific instance by its instanceId
                        tree_iter = self.instance_rows[instance_id]
                        self.update_status_by_iter(tree_iter, info['status'])

        except json.JSONDecodeError as e:
            # JSON parsing error - file might be mid-write, retry next poll
            pass
        except Exception as e:
            # Other errors - log but continue
            sys.stderr.write(f"[Progress Window] Error reading status file: {e}\n")
            sys.stderr.flush()

        return True  # Keep timer running

    def _truncate_text(self, text, max_length=120):
        """Truncate text to max_length with ellipsis"""
        if not text or len(text) <= max_length:
            return text
        return text[:max_length - 3] + "..."

    def _get_program_name(self, wm_class):
        """Get clean program name from wmClass"""
        # Map wmClass to friendly names
        name_map = {
            'Brave-browser': 'Brave',
            'Code': 'VS Code',
            'Gnome-terminal': 'Terminal',
            'SciTE': 'SciTE',
            'WebApp-ChatGpt6946': 'ChatGPT',
            'Nemo': 'Files',
            'Firefox': 'Firefox',
            'Google-chrome': 'Chrome',
            'Thunderbird': 'Thunderbird'
        }
        return name_map.get(wm_class, wm_class)

    def _get_position_size_text(self, wm_class, instance):
        """Get formatted position/size text from instance data"""
        try:
            # Use absolute geometry (pixel size)
            geom_abs = instance.get('geometry_absolute')
            if geom_abs:
                w = geom_abs.get('width', 0)
                h = geom_abs.get('height', 0)
                return f"{w}×{h}"

            # If no absolute geometry, show indicator that it's configured
            geom = instance.get('geometry_percent')
            if geom:
                return "✓"

            return "—"
        except Exception as e:
            return "—"

    def update_status_by_iter(self, tree_iter, status):
        """Update status for a specific tree_iter"""
        icon, text, color = get_status_info().get(status, get_status_info()[STATUS_SCHEDULED])
        status_text = f"{icon} {text}"
        self.store.set_value(tree_iter, 5, status_text)

    def _on_checkbox_toggled(self, checkbox):
        """Handle checkbox toggle"""
        self.show_setting = checkbox.get_active()
        self._save_show_setting()

    def _save_show_setting(self):
        """Save show setting to preferences.json"""
        try:
            os.makedirs(CONFIG_DIR, exist_ok=True)

            # Load existing preferences
            preferences = {}
            if os.path.exists(PREFERENCES_FILE):
                with open(PREFERENCES_FILE, 'r') as f:
                    preferences = json.load(f)

            # Update showProgressWindow setting
            preferences['showProgressWindow'] = self.show_setting

            # Save back
            with open(PREFERENCES_FILE, 'w') as f:
                json.dump(preferences, f, indent=2)
        except Exception as e:
            print(f"Failed to save progress window setting: {e}")

    def _load_show_setting(self):
        """Load show setting from preferences.json"""
        try:
            if os.path.exists(PREFERENCES_FILE):
                with open(PREFERENCES_FILE, 'r') as f:
                    preferences = json.load(f)
                    return preferences.get("showProgressWindow", True)
        except Exception as e:
            print(f"Failed to load progress window setting: {e}")
        return True  # Default: show


def main():
    """Main entry point"""
    # Get apps data from command line argument or use test data
    if len(sys.argv) > 1:
        try:
            apps_to_launch = json.loads(sys.argv[1])
        except Exception as e:
            print(f"Error parsing apps data: {e}")
            apps_to_launch = []
    else:
        # Test data if run without arguments (includes instanceId for per-instance tracking)
        apps_to_launch = [
            {
                'instanceId': 'brave-1',
                'wmClass': 'Brave-browser',
                'instance': {'workspace': 5, 'monitor_index': 0, 'title': 'Main Browser'}
            },
            {
                'instanceId': 'terminal-1',
                'wmClass': 'Gnome-terminal',
                'instance': {'workspace': 3, 'monitor_index': 0, 'title': 'Terminal 1'}
            },
            {
                'instanceId': 'terminal-2',
                'wmClass': 'Gnome-terminal',
                'instance': {'workspace': 3, 'monitor_index': 0, 'title': 'Terminal 2'}
            },
            {
                'instanceId': 'nemo-1',
                'wmClass': 'Nemo',
                'instance': {'workspace': 3, 'monitor_index': 0, 'title': 'Files'}
            }
        ]

        # Simulate status updates for testing (per-instance)
        def update_statuses(win):
            # Brave launches
            GLib.timeout_add(1000, lambda: win.update_status_by_iter(win.instance_rows.get('brave-1'), STATUS_LAUNCHING) or False)
            GLib.timeout_add(2000, lambda: win.update_status_by_iter(win.instance_rows.get('brave-1'), STATUS_POSITIONING) or False)
            GLib.timeout_add(3000, lambda: win.update_status_by_iter(win.instance_rows.get('brave-1'), STATUS_READY) or False)
            # Terminal 1 launches (while Terminal 2 is still scheduled)
            GLib.timeout_add(1500, lambda: win.update_status_by_iter(win.instance_rows.get('terminal-1'), STATUS_LAUNCHING) or False)
            GLib.timeout_add(2500, lambda: win.update_status_by_iter(win.instance_rows.get('terminal-1'), STATUS_POSITIONING) or False)
            GLib.timeout_add(3500, lambda: win.update_status_by_iter(win.instance_rows.get('terminal-1'), STATUS_READY) or False)
            # Terminal 2 launches after Terminal 1
            GLib.timeout_add(4000, lambda: win.update_status_by_iter(win.instance_rows.get('terminal-2'), STATUS_LAUNCHING) or False)
            GLib.timeout_add(5000, lambda: win.update_status_by_iter(win.instance_rows.get('terminal-2'), STATUS_POSITIONING) or False)
            GLib.timeout_add(6000, lambda: win.update_status_by_iter(win.instance_rows.get('terminal-2'), STATUS_READY) or False)
            # Nemo launches
            GLib.timeout_add(4500, lambda: win.update_status_by_iter(win.instance_rows.get('nemo-1'), STATUS_LAUNCHING) or False)
            GLib.timeout_add(5500, lambda: win.update_status_by_iter(win.instance_rows.get('nemo-1'), STATUS_READY) or False)

    win = ProgressWindow(apps_to_launch)
    win.connect("destroy", Gtk.main_quit)
    win.show_all()

    # Start status update simulation if test mode
    if len(sys.argv) == 1:
        update_statuses(win)

    Gtk.main()


if __name__ == "__main__":
    main()
