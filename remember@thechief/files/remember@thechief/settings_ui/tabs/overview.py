"""
Overview Tab - Dashboard with Statistics, Quick Actions, and System Status
"""

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk
import os
import shutil

from ..utils import (
    DataManager, WidgetFactory, run_cinnamon_js, show_message,
    APPLET_DIR, APPLET_UUID, CONFIG_FILE
)
from ..i18n import _


class OverviewTab:
    """Creates the Overview & Control dashboard tab."""

    def __init__(self, data_manager, parent_window, on_refresh_callback):
        self.data_manager = data_manager
        self.parent = parent_window
        self.on_refresh = on_refresh_callback

    def create(self):
        """Create the Overview tab widget."""
        main_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        main_box.set_margin_start(16)
        main_box.set_margin_end(16)
        main_box.set_margin_top(16)
        main_box.set_margin_bottom(16)

        # Top section: 3-column grid
        grid = Gtk.Grid()
        grid.set_column_spacing(16)
        grid.set_row_spacing(16)
        grid.set_column_homogeneous(True)
        main_box.pack_start(grid, False, False, 0)

        # Left column: Statistics
        stats_box = self._create_stats_panel()
        grid.attach(stats_box, 0, 0, 1, 1)

        # Center column: Quick Actions
        actions_box = self._create_actions_panel()
        grid.attach(actions_box, 1, 0, 1, 1)

        # Right column: System Status
        status_box = self._create_status_panel()
        grid.attach(status_box, 2, 0, 1, 1)

        # Spacer
        main_box.pack_start(Gtk.Box(), True, True, 0)

        return main_box

    def _create_stats_panel(self):
        """Create statistics panel."""
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)

        header = WidgetFactory.create_section_header(_("Active Windows"))
        box.pack_start(header, False, False, 0)

        apps = self.data_manager.applications
        monitors = self.data_manager.monitors
        total_apps = len(apps)
        total_instances = sum(len(app.get("instances", [])) for app in apps.values())
        total_monitors = len(monitors)

        # Get monitor layout info
        monitor_layout = self.data_manager.data.get('monitor_layout', {})
        active_monitors = monitor_layout.get('monitors', [])

        # Count active monitors (only show count, no resolution)
        active_count = len(active_monitors)
        active_info = str(active_count)

        stats = [
            (_("Application"), str(total_apps), _("Tracked Apps")),
            (_("Windows"), str(total_instances), _("Saved Instances")),
            (_("Monitors"), str(total_monitors), _("Monitors")),
            (_("Active"), active_info, _("Active")),
            ("Version", str(self.data_manager.version), "data format"),
        ]

        for title, value, subtitle in stats:
            card = WidgetFactory.create_stat_card(title, value, subtitle)
            box.pack_start(card, False, False, 0)

        return box

    def _create_actions_panel(self):
        """Create quick actions panel."""
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)

        header = WidgetFactory.create_section_header(_("Quick Actions"))
        box.pack_start(header, False, False, 0)

        actions = [
            (_("Save All"), "document-save-symbolic", self._on_save_all, "primary"),
            (_("Restore All"), "view-refresh-symbolic", self._on_restore_all, None),
            (_("Delete"), "user-trash-symbolic", self._on_clear_all, "destructive"),
        ]

        for label, icon_name, callback, style in actions:
            btn = WidgetFactory.create_action_button(label, icon_name, callback, style)
            box.pack_start(btn, False, False, 4)

        return box

    def _create_status_panel(self):
        """Create system status panel."""
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)

        header = WidgetFactory.create_section_header(_("Status"))
        box.pack_start(header, False, False, 0)

        # Extension status
        ext_row = WidgetFactory.create_status_row(_("Extension Active"), True)
        box.pack_start(ext_row, False, False, 0)

        # Applet status
        applet_installed = os.path.exists(APPLET_DIR)
        if not applet_installed:
            install_btn = Gtk.Button(label=_("Install"))
            install_btn.connect("clicked", self._on_install_applet)
        else:
            install_btn = Gtk.Button(label=_("Manage"))
            install_btn.connect("clicked", self._on_manage_applet)

        app_row = WidgetFactory.create_status_row(
            _("Applet Installed") if applet_installed else _("Applet Not Installed"),
            applet_installed,
            install_btn
        )
        box.pack_start(app_row, False, False, 0)

        # Monitor section header
        mon_section_header = Gtk.Label(label=_("Monitors"))
        mon_section_header.set_halign(Gtk.Align.START)
        mon_section_header.set_margin_top(12)
        mon_section_header.get_style_context().add_class('section-subheader')
        box.pack_start(mon_section_header, False, False, 0)

        # Monitor info
        monitors = self.data_manager.monitors
        monitor_layout = self.data_manager.data.get('monitor_layout', {})
        active_monitors = monitor_layout.get('monitors', [])

        if monitors:
            for i, (mon_id, mon_data) in enumerate(monitors.items()):
                res = mon_data.get("lastResolution", {})
                mon_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
                mon_box.get_style_context().add_class('quick-stat')

                # Check if this monitor is currently active
                is_active = any(m.get('id') == mon_id for m in active_monitors)
                status_label = _("Active") if is_active else ""

                mon_num = Gtk.Label(label=f"{_('Monitor')} {i + 1}")
                mon_num.set_halign(Gtk.Align.START)
                mon_box.pack_start(mon_num, False, False, 0)

                if status_label:
                    status = Gtk.Label(label=status_label)
                    status.set_halign(Gtk.Align.CENTER)
                    status.get_style_context().add_class('accent-text')
                    mon_box.pack_start(status, False, False, 8)

                mon_res = Gtk.Label(label=f"{res.get('width', '?')}×{res.get('height', '?')}")
                mon_res.set_halign(Gtk.Align.END)
                mon_box.pack_end(mon_res, False, False, 0)

                box.pack_start(mon_box, False, False, 0)

        return box

    # Event handlers

    def _on_save_all(self, widget):
        """Save all positions via extension."""
        run_cinnamon_js("Main.windowRemember?.saveAll()")
        show_message(self.parent, _("Save All"), _("Save command sent to extension."))

    def _on_restore_all(self, widget):
        """Restore all positions via extension."""
        run_cinnamon_js("Main.windowRemember?.restoreAll()")
        show_message(self.parent, _("Restore All"), _("Restore command sent to extension."))

    def _on_open_data_file(self, widget):
        """Open data file in default editor."""
        import subprocess
        if os.path.exists(CONFIG_FILE):
            try:
                subprocess.Popen(['xdg-open', CONFIG_FILE])
            except Exception as e:
                print(f"Error opening file: {e}")

    def _on_clear_all(self, widget):
        """Clear all saved data."""
        dialog = Gtk.MessageDialog(
            transient_for=self.parent,
            flags=0,
            message_type=Gtk.MessageType.WARNING,
            buttons=Gtk.ButtonsType.YES_NO,
            text=_("Clear ALL saved window positions?\n\nThis cannot be undone!")
        )
        response = dialog.run()
        dialog.destroy()

        if response == Gtk.ResponseType.YES:
            self.data_manager.data["applications"] = {}
            self.data_manager.save()
            self.on_refresh()

    def _on_install_applet(self, widget):
        """Install the companion applet."""
        ext_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        applet_src = os.path.join(ext_dir, 'applet')

        if not os.path.exists(applet_src):
            parent = os.path.dirname(ext_dir)
            applet_src = os.path.join(parent, 'applet')

        if not os.path.exists(applet_src):
            show_message(self.parent, _("Error"), _("Applet source not found.\n\nLooked in:\n{0}").format(applet_src), Gtk.MessageType.ERROR)
            return

        try:
            os.makedirs(APPLET_DIR, exist_ok=True)

            for item in os.listdir(applet_src):
                src = os.path.join(applet_src, item)
                dst = os.path.join(APPLET_DIR, item)
                if os.path.isfile(src):
                    shutil.copy2(src, dst)

            show_message(
                self.parent,
                _("Applet Installed"),
                _("Applet installed successfully!\n\n"
                "To add it to your panel:\n"
                "1. Right-click on your panel\n"
                "2. Select 'Applets'\n"
                "3. Find 'Window Remember Control'\n"
                "4. Click '+' to add it")
            )
            self.on_refresh()

        except Exception as e:
            show_message(self.parent, _("Error"), _("Failed to install applet:\n{0}").format(e), Gtk.MessageType.ERROR)

    def _on_manage_applet(self, widget):
        """Open Cinnamon applet settings."""
        import subprocess
        try:
            subprocess.Popen(['cinnamon-settings', 'applets'])
        except Exception as e:
            print(f"Error opening applet settings: {e}")
