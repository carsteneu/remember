"""
Windows Tab - Consolidated view of all tracked windows with filtering and detail pane
"""

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Pango

from ..utils import DataManager, format_position, get_state_badges, get_monitor_display_name
from ..i18n import _
import subprocess
import os
import signal


class WindowsTab:
    """Creates the Windows tab with TreeView and detail pane."""

    def __init__(self, data_manager, parent_window):
        self.data_manager = data_manager
        self.parent = parent_window
        self.current_view = 'application'
        self.filter_text = ''

        # Will be set during create()
        self.windows_tree = None
        self.windows_store = None
        self.windows_filter = None
        self.detail_box = None
        self.app_view_btn = None
        self.ws_view_btn = None
        self.filter_entry = None

        # Currently selected instance for kill button
        self._current_wm_class = None
        self._current_instance = None

    def create(self):
        """Create the Windows tab widget."""
        main_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)

        # Toolbar
        toolbar = self._create_toolbar()
        main_box.pack_start(toolbar, False, False, 0)

        # Main content: TreeView + Detail Pane
        paned = Gtk.Paned(orientation=Gtk.Orientation.HORIZONTAL)
        main_box.pack_start(paned, True, True, 0)

        # Left: TreeView
        tree_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        scrolled = Gtk.ScrolledWindow()
        scrolled.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)

        self.windows_tree = self._create_treeview()
        scrolled.add(self.windows_tree)
        tree_box.pack_start(scrolled, True, True, 0)

        paned.pack1(tree_box, True, True)

        # Right: Detail Pane
        detail_pane = self._create_detail_pane()
        paned.pack2(detail_pane, False, True)
        paned.set_position(650)

        return main_box

    def _create_toolbar(self):
        """Create toolbar for windows tab."""
        toolbar = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
        toolbar.get_style_context().add_class('toolbar-box')

        # View toggle
        view_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=0)
        view_box.get_style_context().add_class('view-toggle')

        self.app_view_btn = Gtk.RadioButton.new_with_label(None, _("By Application"))
        self.app_view_btn.set_mode(False)
        self.app_view_btn.set_active(True)
        self.app_view_btn.connect("toggled", self._on_view_changed)
        view_box.pack_start(self.app_view_btn, False, False, 0)

        self.ws_view_btn = Gtk.RadioButton.new_with_label_from_widget(self.app_view_btn, _("By Workspace"))
        self.ws_view_btn.set_mode(False)
        self.ws_view_btn.connect("toggled", self._on_view_changed)
        view_box.pack_start(self.ws_view_btn, False, False, 0)

        toolbar.pack_start(view_box, False, False, 0)

        # Separator
        sep = Gtk.Separator(orientation=Gtk.Orientation.VERTICAL)
        toolbar.pack_start(sep, False, False, 0)

        # Search/filter
        self.filter_entry = Gtk.SearchEntry()
        self.filter_entry.set_placeholder_text(_("Filter..."))
        self.filter_entry.get_style_context().add_class('search-entry')
        self.filter_entry.connect('search-changed', self._on_filter_changed)
        toolbar.pack_start(self.filter_entry, False, False, 0)

        # Spacer
        toolbar.pack_start(Gtk.Box(), True, True, 0)

        # Action buttons
        expand_btn = Gtk.Button(label=_("Expand All"))
        expand_btn.connect("clicked", lambda w: self.windows_tree.expand_all())
        toolbar.pack_start(expand_btn, False, False, 0)

        collapse_btn = Gtk.Button(label=_("Collapse All"))
        collapse_btn.connect("clicked", lambda w: self.windows_tree.collapse_all())
        toolbar.pack_start(collapse_btn, False, False, 0)

        delete_btn = Gtk.Button(label=_("Delete Selected"))
        delete_btn.connect("clicked", self._on_delete_selected)
        toolbar.pack_start(delete_btn, False, False, 0)

        return toolbar

    def _create_treeview(self):
        """Create TreeView for windows data."""
        # TreeStore columns:
        # 0=display_name, 1=workspace, 2=monitor, 3=position, 4=states,
        # 5=is_parent, 6=wm_class, 7=instance_index
        self.windows_store = Gtk.TreeStore(str, str, str, str, str, bool, str, int)

        self._populate_store()

        # Create filter model
        self.windows_filter = self.windows_store.filter_new()
        self.windows_filter.set_visible_func(self._filter_func)

        tree = Gtk.TreeView(model=self.windows_filter)
        tree.set_enable_tree_lines(True)
        tree.set_headers_visible(True)
        tree.get_style_context().add_class('compact')

        # Connect selection changed
        selection = tree.get_selection()
        selection.connect("changed", self._on_selection_changed)

        # Column 0: App/Window name
        renderer = Gtk.CellRendererText()
        renderer.set_property('ellipsize', Pango.EllipsizeMode.END)
        column = Gtk.TreeViewColumn(_("Application / Window"), renderer, text=0)
        column.set_resizable(True)
        column.set_min_width(220)
        column.set_expand(True)
        tree.append_column(column)

        # Column 1: Workspace
        renderer = Gtk.CellRendererText()
        renderer.set_property('xalign', 0.5)
        column = Gtk.TreeViewColumn(_("WS"), renderer, text=1)
        column.set_min_width(50)
        tree.append_column(column)

        # Column 2: Monitor
        renderer = Gtk.CellRendererText()
        column = Gtk.TreeViewColumn(_("Monitor"), renderer, text=2)
        column.set_min_width(90)
        tree.append_column(column)

        # Column 3: Position
        renderer = Gtk.CellRendererText()
        renderer.set_property('font', 'monospace 9')
        column = Gtk.TreeViewColumn(_("Position"), renderer, markup=3)
        column.set_resizable(True)
        column.set_min_width(130)
        tree.append_column(column)

        # Column 4: States
        renderer = Gtk.CellRendererText()
        column = Gtk.TreeViewColumn(_("States"), renderer, text=4)
        column.set_min_width(70)
        tree.append_column(column)

        # Expand all by default
        tree.expand_all()

        return tree

    def _populate_store(self):
        """Populate windows store based on current view."""
        self.windows_store.clear()

        if self.current_view == 'application':
            self._populate_by_application()
        else:
            self._populate_by_workspace()

    def _populate_by_application(self):
        """Populate store grouped by application."""
        apps = self.data_manager.applications

        for wm_class, app_data in sorted(apps.items()):
            instances = app_data.get("instances", [])
            instance_count = len(instances)

            # Parent row
            parent_iter = self.windows_store.append(None, [
                f"{wm_class} ({instance_count})",
                "", "", "", "",
                True, wm_class, -1
            ])

            # Child rows
            for i, instance in enumerate(instances):
                title = instance.get("title_snapshot", _("Untitled")) or _("Untitled")
                if len(title) > 45:
                    title = title[:42] + "..."

                workspace = instance.get("workspace", 0)
                workspace_str = str(workspace + 1)

                monitor_id = instance.get("monitor_id", "")
                monitor_idx = instance.get("monitor_index", 0)
                monitor_str = get_monitor_display_name(monitor_id, monitor_idx)

                position_str = format_position(instance)
                states_str = get_state_badges(instance)

                self.windows_store.append(parent_iter, [
                    f"  {title}",
                    workspace_str,
                    monitor_str,
                    position_str,
                    states_str,
                    False, wm_class, i
                ])

    def _populate_by_workspace(self):
        """Populate store grouped by workspace."""
        workspace_data = {}

        apps = self.data_manager.applications
        for wm_class, app_data in apps.items():
            for i, instance in enumerate(app_data.get("instances", [])):
                ws = instance.get("workspace", 0)
                monitor_idx = instance.get("monitor_index", 0)

                if ws not in workspace_data:
                    workspace_data[ws] = {}
                if monitor_idx not in workspace_data[ws]:
                    workspace_data[ws][monitor_idx] = []

                workspace_data[ws][monitor_idx].append({
                    "wm_class": wm_class,
                    "instance": instance,
                    "index": i
                })

        for ws_index in sorted(workspace_data.keys()):
            monitors = workspace_data[ws_index]
            total_windows = sum(len(wins) for wins in monitors.values())

            ws_iter = self.windows_store.append(None, [
                _("Workspace {0} ({1} windows)").format(ws_index + 1, total_windows),
                "", "", "", "",
                True, "", -1
            ])

            for monitor_idx in sorted(monitors.keys()):
                windows = monitors[monitor_idx]

                mon_iter = self.windows_store.append(ws_iter, [
                    _("  Monitor {0} ({1} windows)").format(monitor_idx + 1, len(windows)),
                    "", "", "", "",
                    True, "", -1
                ])

                for win_data in windows:
                    wm_class = win_data["wm_class"]
                    instance = win_data["instance"]
                    idx = win_data["index"]

                    title = instance.get("title_snapshot", _("Untitled")) or _("Untitled")
                    if len(title) > 35:
                        title = title[:32] + "..."

                    position_str = format_position(instance)
                    states_str = get_state_badges(instance)

                    self.windows_store.append(mon_iter, [
                        f"    {title}",
                        "",
                        wm_class[:15],
                        position_str,
                        states_str,
                        False, wm_class, idx
                    ])

    def _filter_func(self, model, iter, data):
        """Filter function for TreeView."""
        if not self.filter_text:
            return True

        filter_lower = self.filter_text.lower()

        # Check if any column contains the filter text
        for col in [0, 2, 6]:  # name, monitor, wm_class
            value = model[iter][col]
            if value and filter_lower in value.lower():
                return True

        # For parent rows, check if any child matches
        if model[iter][5]:  # is_parent
            child = model.iter_children(iter)
            while child:
                for col in [0, 2, 6]:
                    value = model[child][col]
                    if value and filter_lower in value.lower():
                        return True
                child = model.iter_next(child)

        return False

    def _create_detail_pane(self):
        """Create detail pane for selected window."""
        scrolled = Gtk.ScrolledWindow()
        scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        scrolled.set_size_request(260, -1)
        scrolled.get_style_context().add_class('detail-pane')

        self.detail_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        scrolled.add(self.detail_box)

        # Placeholder
        self._show_placeholder()

        return scrolled

    def _show_placeholder(self):
        """Show placeholder in detail pane."""
        placeholder = Gtk.Label(label=_("Select a window to view details"))
        placeholder.set_halign(Gtk.Align.CENTER)
        placeholder.set_valign(Gtk.Align.CENTER)
        self.detail_box.pack_start(placeholder, True, True, 0)

    def _update_detail_pane(self, instance, wm_class):
        """Update detail pane with instance info in 2-column layout."""
        # Clear existing content
        for child in self.detail_box.get_children():
            self.detail_box.remove(child)

        # Header
        header = Gtk.Label(label=_("Window Details"))
        header.set_halign(Gtk.Align.START)
        header.get_style_context().add_class('detail-header')
        self.detail_box.pack_start(header, False, False, 0)

        # 2-column grid for details
        grid = Gtk.Grid()
        grid.set_column_spacing(16)
        grid.set_row_spacing(4)
        grid.set_margin_top(8)
        self.detail_box.pack_start(grid, False, False, 0)

        # Details - will be arranged in 2 columns
        details = [
            (_("APPLICATION"), wm_class),
            (_("WORKSPACE"), str(instance.get("workspace", 0) + 1)),
            (_("TITLE"), (instance.get("title_snapshot", _("Untitled")) or _("Untitled"))[:35]),
            (_("MONITOR INDEX"), str(instance.get("monitor_index", 0))),
            (_("X11 WINDOW ID"), instance.get("x11_window_id", "N/A")),
            (_("STABLE SEQ"), str(instance.get("stable_sequence", "N/A"))),
        ]

        geom = instance.get("geometry_absolute", {})
        if geom:
            details.append((_("GEOMETRY"), f"{geom.get('x', 0)},{geom.get('y', 0)} {geom.get('width', 0)}x{geom.get('height', 0)}"))

        geom_pct = instance.get("geometry_percent", {})
        if geom_pct:
            details.append((_("GEOMETRY %"), f"{geom_pct.get('x', 0)*100:.0f}%,{geom_pct.get('y', 0)*100:.0f}% {geom_pct.get('width', 0)*100:.0f}%x{geom_pct.get('height', 0)*100:.0f}%"))

        # Add details to grid in 2-column layout
        for i, (label_text, value) in enumerate(details):
            col = (i % 2) * 2  # 0 or 2 (label columns are 0,2; value columns follow)
            row = i // 2

            label = Gtk.Label(label=label_text)
            label.set_halign(Gtk.Align.START)
            label.get_style_context().add_class('detail-label')
            grid.attach(label, col, row * 2, 1, 1)

            value_label = Gtk.Label(label=str(value))
            value_label.set_halign(Gtk.Align.START)
            value_label.set_selectable(True)
            value_label.set_line_wrap(True)
            value_label.set_max_width_chars(18)
            value_label.set_ellipsize(Pango.EllipsizeMode.END)
            value_label.get_style_context().add_class('detail-value')
            grid.attach(value_label, col, row * 2 + 1, 1, 1)

        # States section - also 2-column
        states_label = Gtk.Label(label=_("STATES"))
        states_label.set_halign(Gtk.Align.START)
        states_label.get_style_context().add_class('detail-label')
        states_label.set_margin_top(12)
        self.detail_box.pack_start(states_label, False, False, 0)

        states_grid = Gtk.Grid()
        states_grid.set_column_spacing(16)
        states_grid.set_row_spacing(2)
        self.detail_box.pack_start(states_grid, False, False, 0)

        states = [
            (_("Maximized"), instance.get("maximized", False)),
            (_("Fullscreen"), instance.get("fullscreen", False)),
            (_("Sticky"), instance.get("sticky", False)),
            (_("Always on Top"), instance.get("alwaysOnTop", False)),
            (_("Shaded"), instance.get("shaded", False)),
            (_("Minimized"), instance.get("minimized", False)),
        ]

        for i, (state_name, state_value) in enumerate(states):
            col = i % 2
            row = i // 2

            state_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=4)

            check = Gtk.Label(label="✓" if state_value else "✗")
            check.get_style_context().add_class('status-active' if state_value else 'status-inactive')
            state_box.pack_start(check, False, False, 0)

            state_label = Gtk.Label(label=state_name)
            state_label.set_halign(Gtk.Align.START)
            state_box.pack_start(state_label, False, False, 0)

            states_grid.attach(state_box, col, row, 1, 1)

        # Command line (full width at bottom if exists)
        cmd = instance.get("cmdline", "")
        if cmd:
            cmd_label = Gtk.Label(label=_("COMMAND"))
            cmd_label.set_halign(Gtk.Align.START)
            cmd_label.get_style_context().add_class('detail-label')
            cmd_label.set_margin_top(8)
            self.detail_box.pack_start(cmd_label, False, False, 0)

            cmd_value = Gtk.Label(label=cmd[:60])
            cmd_value.set_halign(Gtk.Align.START)
            cmd_value.set_selectable(True)
            cmd_value.set_line_wrap(True)
            cmd_value.get_style_context().add_class('detail-value')
            self.detail_box.pack_start(cmd_value, False, False, 0)

        # Store current instance for kill button
        self._current_wm_class = wm_class
        self._current_instance = instance

        # Kill Process button
        kill_btn = Gtk.Button(label=_("Close Window"))
        kill_btn.set_margin_top(16)
        kill_btn.get_style_context().add_class('destructive-action')
        kill_btn.connect("clicked", self._on_kill_clicked)
        self.detail_box.pack_start(kill_btn, False, False, 0)

        self.detail_box.show_all()

    def _clear_detail_pane(self):
        """Clear detail pane."""
        for child in self.detail_box.get_children():
            self.detail_box.remove(child)
        self._show_placeholder()
        self._current_wm_class = None
        self._current_instance = None
        self.detail_box.show_all()

    def _on_kill_clicked(self, widget):
        """Kill/close the currently selected window using wmctrl."""
        if not self._current_instance:
            return

        x11_window_id = self._current_instance.get("x11_window_id")
        title = self._current_instance.get("title_snapshot", "")

        if not x11_window_id:
            dialog = Gtk.MessageDialog(
                transient_for=self.parent,
                flags=0,
                message_type=Gtk.MessageType.ERROR,
                buttons=Gtk.ButtonsType.OK,
                text=_("Cannot close window")
            )
            dialog.format_secondary_text(_("No X11 Window ID available for this window."))
            dialog.run()
            dialog.destroy()
            return

        # Confirm close
        dialog = Gtk.MessageDialog(
            transient_for=self.parent,
            flags=0,
            message_type=Gtk.MessageType.QUESTION,
            buttons=Gtk.ButtonsType.YES_NO,
            text=_("Close window '{0}'?").format(title[:40] if title else self._current_wm_class)
        )
        dialog.format_secondary_text(_("This will gracefully close the window. Unsaved work may be lost."))
        response = dialog.run()
        dialog.destroy()

        if response != Gtk.ResponseType.YES:
            return

        try:
            # Use wmctrl to close window gracefully (-c = close)
            result = subprocess.run(
                ["wmctrl", "-i", "-c", x11_window_id],
                capture_output=True,
                text=True
            )

            if result.returncode == 0:
                # Success - refresh the view
                self.data_manager.reload()
                self._populate_store()
                self._clear_detail_pane()
            else:
                # Window might not exist anymore - that's OK
                self.data_manager.reload()
                self._populate_store()
                self._clear_detail_pane()

        except FileNotFoundError:
            dialog = Gtk.MessageDialog(
                transient_for=self.parent,
                flags=0,
                message_type=Gtk.MessageType.ERROR,
                buttons=Gtk.ButtonsType.OK,
                text=_("wmctrl not found")
            )
            dialog.format_secondary_text(_("Please install wmctrl: sudo apt install wmctrl"))
            dialog.run()
            dialog.destroy()
        except Exception as e:
            dialog = Gtk.MessageDialog(
                transient_for=self.parent,
                flags=0,
                message_type=Gtk.MessageType.ERROR,
                buttons=Gtk.ButtonsType.OK,
                text=_("Error closing window")
            )
            dialog.format_secondary_text(str(e))
            dialog.run()
            dialog.destroy()

    # Event handlers

    def _on_view_changed(self, widget):
        """Handle view toggle."""
        if widget.get_active():
            self.current_view = 'application' if widget == self.app_view_btn else 'workspace'
            self._populate_store()
            self.windows_filter.refilter()
            self.windows_tree.expand_all()
            self._clear_detail_pane()

    def _on_filter_changed(self, entry):
        """Handle filter text changes."""
        self.filter_text = entry.get_text()
        self.windows_filter.refilter()
        if self.filter_text:
            self.windows_tree.expand_all()

    def _on_selection_changed(self, selection):
        """Handle tree selection to update detail pane."""
        model, treeiter = selection.get_selected()
        if treeiter is None:
            self._clear_detail_pane()
            return

        is_parent = model[treeiter][5]
        if is_parent:
            self._clear_detail_pane()
            return

        wm_class = model[treeiter][6]
        instance_index = model[treeiter][7]

        if wm_class and instance_index >= 0:
            app_data = self.data_manager.applications.get(wm_class)
            if app_data and instance_index < len(app_data.get("instances", [])):
                instance = app_data["instances"][instance_index]
                self._update_detail_pane(instance, wm_class)
                return

        self._clear_detail_pane()

    def _on_delete_selected(self, widget):
        """Delete selected item."""
        selection = self.windows_tree.get_selection()
        model, treeiter = selection.get_selected()

        if treeiter is None:
            return

        is_parent = model[treeiter][5]
        wm_class = model[treeiter][6]
        instance_index = model[treeiter][7]

        if is_parent and wm_class:
            # Delete entire app
            dialog = Gtk.MessageDialog(
                transient_for=self.parent,
                flags=0,
                message_type=Gtk.MessageType.QUESTION,
                buttons=Gtk.ButtonsType.YES_NO,
                text=_("Delete all saved data for '{0}'?").format(wm_class)
            )
            response = dialog.run()
            dialog.destroy()

            if response == Gtk.ResponseType.YES:
                if wm_class in self.data_manager.data.get("applications", {}):
                    del self.data_manager.data["applications"][wm_class]
                    self.data_manager.save()
                    self._populate_store()
                    self.windows_filter.refilter()
                    self.windows_tree.expand_all()

        elif not is_parent and wm_class and instance_index >= 0:
            # Delete single instance
            app_data = self.data_manager.data.get("applications", {}).get(wm_class)
            if app_data and instance_index < len(app_data.get("instances", [])):
                dialog = Gtk.MessageDialog(
                    transient_for=self.parent,
                    flags=0,
                    message_type=Gtk.MessageType.QUESTION,
                    buttons=Gtk.ButtonsType.YES_NO,
                    text=_("Delete this window instance?")
                )
                response = dialog.run()
                dialog.destroy()

                if response == Gtk.ResponseType.YES:
                    app_data["instances"].pop(instance_index)
                    if len(app_data["instances"]) == 0:
                        del self.data_manager.data["applications"][wm_class]
                    self.data_manager.save()
                    self._populate_store()
                    self.windows_filter.refilter()
                    self.windows_tree.expand_all()
                    self._clear_detail_pane()

    def refresh(self):
        """Refresh the tab data."""
        self._populate_store()
        self.windows_filter.refilter()
        self.windows_tree.expand_all()
        self._clear_detail_pane()
