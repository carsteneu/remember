"""
CSS Provider for Window Position Remember Settings UI

Modern, information-dense styling for GTK3 widgets.
"""

import gi
gi.require_version('Gtk', '3.0')
gi.require_version('Gdk', '3.0')
from gi.repository import Gtk, Gdk

CSS_STYLES = """
/* Global compact styling */
window.settings-window {
    font-size: 11pt;
}

/* Compact margins for power-user density */
.compact-row {
    padding: 4px 8px;
    min-height: 28px;
}

/* Statistics cards */
.stat-card {
    background: alpha(@theme_fg_color, 0.04);
    border-radius: 8px;
    padding: 12px 16px;
    margin: 4px;
}

.stat-card:hover {
    background: alpha(@theme_fg_color, 0.06);
}

.stat-title {
    font-size: 10pt;
    font-weight: 600;
    color: alpha(@theme_fg_color, 0.6);
    letter-spacing: 0.3px;
}

.stat-value {
    font-size: 23pt;
    font-weight: bold;
    margin-top: 2px;
}

.stat-subtitle {
    font-size: 9pt;
    color: alpha(@theme_fg_color, 0.5);
}

/* Status indicators */
.status-active {
    color: #26a269;
}

.status-inactive {
    color: #c01c28;
}

.status-warning {
    color: #e5a50a;
}

/* Action buttons */
.action-button {
    padding: 10px 18px;
    min-height: 40px;
    border-radius: 6px;
}

.action-button.primary {
    background: @theme_selected_bg_color;
    color: @theme_selected_fg_color;
    font-weight: 600;
}

.action-button.destructive {
    background: alpha(#c01c28, 0.15);
    color: #c01c28;
}

.action-button.destructive:hover {
    background: alpha(#c01c28, 0.25);
}

/* Compact TreeView */
treeview {
    font-size: 11pt;
}

treeview.compact {
    font-size: 10pt;
}

treeview.view row {
    padding: 2px 0;
}

treeview.view header button {
    padding: 4px 8px;
    font-weight: 600;
    font-size: 10pt;
}

/* Badge styling */
.badge {
    background: alpha(@theme_fg_color, 0.1);
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 10pt;
    font-weight: 600;
}

.badge-maximized {
    background: alpha(#3584e4, 0.2);
    color: #3584e4;
}

.badge-sticky {
    background: alpha(#e5a50a, 0.2);
    color: #986a00;
}

.badge-fullscreen {
    background: alpha(#26a269, 0.2);
    color: #26a269;
}

/* Detail pane */
.detail-pane {
    background: alpha(@theme_fg_color, 0.02);
    border-left: 1px solid alpha(@theme_fg_color, 0.1);
    padding: 16px;
}

.detail-header {
    font-size: 12pt;
    font-weight: bold;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid alpha(@theme_fg_color, 0.1);
}

.detail-label {
    font-size: 9pt;
    font-weight: 600;
    color: alpha(@theme_fg_color, 0.6);
    letter-spacing: 0.3px;
    margin-top: 10px;
    margin-bottom: 2px;
}

.detail-value {
    font-family: monospace;
    font-size: 10pt;
    padding: 4px 0;
}

/* Toolbar styling */
.toolbar-box {
    background: alpha(@theme_fg_color, 0.02);
    border-bottom: 1px solid alpha(@theme_fg_color, 0.1);
    padding: 8px 12px;
}

/* Section headers */
.section-header {
    font-size: 12pt;
    font-weight: bold;
    padding: 12px 0 8px 0;
    border-bottom: 1px solid alpha(@theme_fg_color, 0.1);
    margin-bottom: 12px;
}

/* Settings rows */
.settings-row {
    padding: 8px 0;
    border-bottom: 1px solid alpha(@theme_fg_color, 0.05);
}

.settings-row:last-child {
    border-bottom: none;
}

/* Info bar at bottom */
.info-bar {
    background: alpha(@theme_fg_color, 0.03);
    border-top: 1px solid alpha(@theme_fg_color, 0.1);
    padding: 8px 16px;
    font-size: 10pt;
    color: alpha(@theme_fg_color, 0.7);
}

/* Monitor diagram */
.monitor-diagram {
    background: alpha(@theme_fg_color, 0.03);
    border: 1px solid alpha(@theme_fg_color, 0.1);
    border-radius: 6px;
    padding: 8px;
}

/* Frame styling */
.config-frame {
    border: 1px solid alpha(@theme_fg_color, 0.1);
    border-radius: 8px;
    padding: 12px;
    margin: 4px 0;
}

.config-frame:hover {
    background: alpha(@theme_fg_color, 0.02);
}

/* Tab styling */
notebook > header {
    background: transparent;
}

notebook > header > tabs > tab {
    padding: 8px 16px;
    font-weight: 500;
}

notebook > header > tabs > tab:checked {
    font-weight: 600;
}

/* Tooltip icon */
.tooltip-icon {
    color: alpha(@theme_fg_color, 0.4);
    font-size: 11pt;
}

.tooltip-icon:hover {
    color: alpha(@theme_fg_color, 0.7);
}

/* View toggle buttons */
.view-toggle button {
    padding: 6px 14px;
    border-radius: 0;
    border: 1px solid alpha(@theme_fg_color, 0.2);
    font-size: 10pt;
    font-weight: 500;
}

.view-toggle button:first-child {
    border-radius: 4px 0 0 4px;
    border-right: none;
}

.view-toggle button:last-child {
    border-radius: 0 4px 4px 0;
}

.view-toggle button:checked {
    background: @theme_selected_bg_color;
    color: @theme_selected_fg_color;
}

/* Search entry */
.search-entry {
    border-radius: 4px;
    padding: 4px 8px;
    min-width: 180px;
}

/* Quick stats in overview */
.quick-stat {
    padding: 8px 12px;
    margin: 2px;
    border-radius: 4px;
    background: alpha(@theme_fg_color, 0.03);
}

/* Dimmed label for descriptions */
.dim-label {
    color: alpha(@theme_fg_color, 0.6);
    font-size: 10pt;
}

/* Plugin cards */
.plugin-card {
    border: 1px solid alpha(@theme_fg_color, 0.1);
    border-radius: 8px;
    margin: 4px 0;
    background: transparent;
}

.plugin-card:hover {
    background: alpha(@theme_fg_color, 0.02);
}

/* Plugin expander */
.plugin-expander {
    font-size: 10pt;
    color: alpha(@theme_fg_color, 0.7);
}

.plugin-expander title {
    font-weight: 500;
}

.plugin-expander > box {
    background: alpha(@theme_fg_color, 0.02);
    border-radius: 4px;
    padding: 8px;
    margin-top: 4px;
}

/* Setting rows inside expander */
.setting-row {
    padding: 8px 4px;
    border-bottom: 1px solid alpha(@theme_fg_color, 0.05);
}

.setting-row:last-child {
    border-bottom: none;
}

.setting-row:hover {
    background: alpha(@theme_fg_color, 0.02);
    border-radius: 4px;
}

/* Badge variants for plugins */
.badge-auto {
    background: alpha(#26a269, 0.2);
    color: #26a269;
}

.badge-single {
    background: alpha(#9141ac, 0.2);
    color: #9141ac;
}
"""


def apply_css():
    """Load and apply custom CSS to the application."""
    css_provider = Gtk.CssProvider()
    try:
        css_provider.load_from_data(CSS_STYLES.encode())
        Gtk.StyleContext.add_provider_for_screen(
            Gdk.Screen.get_default(),
            css_provider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        )
        return True
    except Exception as e:
        print(f"CSS Error: {e}")
        return False
