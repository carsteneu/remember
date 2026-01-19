"""
Main Settings Window for Window Position Remember Extension

This is the main entry point that creates the settings window and manages tabs.
"""

import gi
gi.require_version('Gtk', '3.0')
gi.require_version('Gdk', '3.0')
from gi.repository import Gtk, Gdk, GLib

from .css import apply_css
from .utils import DataManager, CONFIG_FILE
from .tabs import OverviewTab, WindowsTab, AppsSessionTab, PreferencesTab
from .i18n import _


class SettingsWindow(Gtk.Window):
    """Main settings window with modern, information-dense design."""

    # Window dimensions
    WINDOW_WIDTH = 960
    WINDOW_HEIGHT = 720

    def __init__(self):
        Gtk.Window.__init__(self, title=_("Window Position Remember - Settings"))
        self.get_style_context().add_class('settings-window')
        self.set_border_width(0)

        # Apply CSS styling
        apply_css()

        # Position and size window
        self._position_window()

        # Initialize data manager
        self.data_manager = DataManager()

        # Tab instances (stored for refresh)
        self.tab_instances = {}

        # Build UI
        self._build_ui()

        # Setup keyboard shortcuts
        self._setup_keyboard_shortcuts()

    def _position_window(self):
        """Position window centered on screen."""
        screen = self.get_screen()
        screen_width = screen.get_width()
        screen_height = screen.get_height()

        pos_x = (screen_width - self.WINDOW_WIDTH) // 2
        pos_y = (screen_height - self.WINDOW_HEIGHT) // 2

        self.set_default_size(self.WINDOW_WIDTH, self.WINDOW_HEIGHT)
        self.move(pos_x, pos_y)

    def _build_ui(self):
        """Build the main UI structure."""
        main_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        self.add(main_box)

        # Notebook for tabs
        self.notebook = Gtk.Notebook()
        self.notebook.set_tab_pos(Gtk.PositionType.TOP)
        main_box.pack_start(self.notebook, True, True, 0)

        # Build all tabs
        self._build_tabs()

        # Bottom bar with buttons
        bottom_bar = self._create_bottom_bar()
        main_box.pack_start(bottom_bar, False, False, 0)

    def _build_tabs(self):
        """Build all notebook tabs."""
        # Tab 1: Overview & Control (Dashboard)
        self.tab_instances['overview'] = OverviewTab(
            self.data_manager, self, self._on_refresh
        )
        overview_page = self.tab_instances['overview'].create()
        self.notebook.append_page(overview_page, Gtk.Label(label=_("Overview")))

        # Tab 2: Windows (Consolidated Data View)
        self.tab_instances['windows'] = WindowsTab(self.data_manager, self)
        windows_page = self.tab_instances['windows'].create()
        self.notebook.append_page(windows_page, Gtk.Label(label=_("Windows")))

        # Tab 3: Applications & Session
        self.tab_instances['apps'] = AppsSessionTab(self.data_manager, self)
        apps_page = self.tab_instances['apps'].create()
        self.notebook.append_page(apps_page, Gtk.Label(label=_("Apps & Session")))

        # Tab 4: Preferences
        self.tab_instances['preferences'] = PreferencesTab(self.data_manager, self)
        prefs_page = self.tab_instances['preferences'].create()
        self.notebook.append_page(prefs_page, Gtk.Label(label=_("Preferences")))

    def _create_bottom_bar(self):
        """Create the bottom info bar with buttons."""
        bottom_bar = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        bottom_bar.get_style_context().add_class('info-bar')

        # Data file path
        path_label = Gtk.Label(label=_("Data: {0}").format(CONFIG_FILE))
        path_label.set_halign(Gtk.Align.START)
        path_label.set_selectable(True)
        bottom_bar.pack_start(path_label, True, True, 0)

        # Buttons
        refresh_btn = Gtk.Button(label=_("Refresh"))
        refresh_btn.connect("clicked", lambda w: self._on_refresh())
        bottom_bar.pack_end(refresh_btn, False, False, 0)

        close_btn = Gtk.Button(label=_("Close"))
        close_btn.connect("clicked", lambda w: self.destroy())
        bottom_bar.pack_end(close_btn, False, False, 0)

        return bottom_bar

    def _setup_keyboard_shortcuts(self):
        """Setup keyboard shortcuts."""
        accel_group = Gtk.AccelGroup()
        self.add_accel_group(accel_group)

        # Ctrl+W to close
        key, mod = Gtk.accelerator_parse("<Control>w")
        accel_group.connect(key, mod, Gtk.AccelFlags.VISIBLE, lambda *args: self.destroy())

        # Ctrl+R to refresh
        key, mod = Gtk.accelerator_parse("<Control>r")
        accel_group.connect(key, mod, Gtk.AccelFlags.VISIBLE, lambda *args: self._on_refresh())

    def _on_refresh(self):
        """Refresh data and rebuild tabs."""
        current_tab = self.notebook.get_current_page()

        # Reload data
        self.data_manager.reload()

        # Clear tab instances
        self.tab_instances.clear()

        # Remove all tabs
        while self.notebook.get_n_pages() > 0:
            self.notebook.remove_page(0)

        # Rebuild tabs
        self._build_tabs()

        # Show all new widgets first
        self.notebook.show_all()

        # Restore current tab AFTER show_all to ensure it stays
        if current_tab >= 0 and current_tab < self.notebook.get_n_pages():
            self.notebook.set_current_page(current_tab)


def main():
    """Main entry point."""
    win = SettingsWindow()
    win.connect("destroy", Gtk.main_quit)
    win.show_all()
    win.present()
    win.present_with_time(GLib.get_monotonic_time() // 1000)
    Gtk.main()


if __name__ == "__main__":
    main()
