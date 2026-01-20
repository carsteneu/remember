"""
About Tab - Extension information, credits, and support links
"""

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk
import subprocess
import sys

from ..utils import WidgetFactory
from ..i18n import _


class AboutTab:
    """Creates the About tab with extension information and links."""

    def __init__(self, data_manager, parent_window):
        self.data_manager = data_manager
        self.parent = parent_window

    def create(self):
        """Create the About tab widget."""
        main_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        main_box.set_margin_start(16)
        main_box.set_margin_end(16)
        main_box.set_margin_top(16)
        main_box.set_margin_bottom(16)

        # Apply CSS for smaller font size (except titles)
        css_provider = Gtk.CssProvider()
        css_provider.load_from_data(b"""
            .about-content label {
                font-size: 0.9em;
            }
        """)
        style_context = main_box.get_style_context()
        style_context.add_provider(css_provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)

        # Scrolled window
        scrolled = Gtk.ScrolledWindow()
        scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        main_box.pack_start(scrolled, True, True, 0)

        # Container for all sections
        content_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=16)
        scrolled.add(content_box)

        # Top row: Info and Credits side by side
        top_row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=16)
        content_box.pack_start(top_row, False, False, 0)

        # Section 1: Extension Information (left)
        info_section = self._create_info_section()
        top_row.pack_start(info_section, True, True, 0)

        # Section 2: Credits & Sponsors (right)
        credits_section = self._create_credits_section()
        top_row.pack_start(credits_section, True, True, 0)

        # Section 3: Help & Support (bottom, full width)
        support_section = self._create_support_section()
        content_box.pack_start(support_section, False, False, 0)

        return main_box

    def _create_info_section(self):
        """Create the Extension Information section."""
        card = Gtk.Frame()
        card.get_style_context().add_class('card')

        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        vbox.set_margin_start(12)
        vbox.set_margin_end(12)
        vbox.set_margin_top(8)
        vbox.set_margin_bottom(8)
        card.add(vbox)

        # Section title
        title = Gtk.Label()
        title.set_markup(f"<b>{_('settings-about-info-title')}</b>")
        title.set_halign(Gtk.Align.START)
        vbox.pack_start(title, False, False, 0)

        # Description
        desc_label = Gtk.Label()
        desc_label.set_markup(_('settings-about-description'))
        desc_label.set_xalign(0.0)  # Left align text
        desc_label.set_line_wrap(True)
        desc_label.get_style_context().add_class('about-content')
        vbox.pack_start(desc_label, False, False, 0)

        # Separator
        separator = Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL)
        vbox.pack_start(separator, False, False, 4)

        # Version info
        version_label = Gtk.Label()
        version_label.set_markup(_('settings-about-version'))
        version_label.set_xalign(0.0)  # Left align text
        version_label.set_line_wrap(True)
        version_label.set_selectable(True)
        version_label.get_style_context().add_class('about-content')
        vbox.pack_start(version_label, False, False, 0)

        # Separator
        separator2 = Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL)
        vbox.pack_start(separator2, False, False, 6)

        # Author info
        author_label = Gtk.Label()
        author_label.set_markup(_('settings-about-author'))
        author_label.set_xalign(0.0)  # Left align text
        author_label.set_line_wrap(True)
        author_label.set_selectable(True)
        author_label.get_style_context().add_class('about-content')
        vbox.pack_start(author_label, False, False, 0)

        return card

    def _create_support_section(self):
        """Create the Help & Support section."""
        card = Gtk.Frame()
        card.get_style_context().add_class('card')

        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        vbox.set_margin_start(12)
        vbox.set_margin_end(12)
        vbox.set_margin_top(8)
        vbox.set_margin_bottom(8)
        card.add(vbox)

        # Section title
        title = Gtk.Label()
        title.set_markup(f"<b>{_('settings-about-support-title')}</b>")
        title.set_halign(Gtk.Align.START)
        vbox.pack_start(title, False, False, 0)

        # Spacer - smaller gap before buttons
        spacer = Gtk.Box()
        spacer.set_size_request(-1, 4)  # Small 4px gap instead of 12px
        vbox.pack_start(spacer, False, False, 0)

        # Button box - horizontal layout
        button_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        button_box.set_homogeneous(True)
        vbox.pack_start(button_box, False, False, 0)

        # GitHub button
        github_btn = Gtk.Button(label=_('settings-about-github-btn'))
        github_btn.set_tooltip_text(_('settings-about-github-tooltip'))
        github_btn.connect('clicked', self._on_github_clicked)
        button_box.pack_start(github_btn, True, True, 0)

        # Issues button
        issues_btn = Gtk.Button(label=_('settings-about-issues-btn'))
        issues_btn.set_tooltip_text(_('settings-about-issues-tooltip'))
        issues_btn.connect('clicked', self._on_issues_clicked)
        button_box.pack_start(issues_btn, True, True, 0)

        # Documentation button
        docs_btn = Gtk.Button(label=_('settings-about-docs-btn'))
        docs_btn.set_tooltip_text(_('settings-about-docs-tooltip'))
        docs_btn.connect('clicked', self._on_docs_clicked)
        button_box.pack_start(docs_btn, True, True, 0)

        return card

    def _create_credits_section(self):
        """Create the Credits & Sponsors section."""
        card = Gtk.Frame()
        card.get_style_context().add_class('card')

        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        vbox.set_margin_start(12)
        vbox.set_margin_end(12)
        vbox.set_margin_top(8)
        vbox.set_margin_bottom(8)
        card.add(vbox)

        # Section title
        title = Gtk.Label()
        title.set_markup(f"<b>{_('settings-about-credits-title')}</b>")
        title.set_halign(Gtk.Align.START)
        vbox.pack_start(title, False, False, 0)

        # Sponsor info
        sponsor_label = Gtk.Label()
        sponsor_label.set_markup(_('settings-about-sponsor'))
        sponsor_label.set_xalign(0.0)  # Left align text
        sponsor_label.set_line_wrap(True)
        sponsor_label.set_use_markup(True)
        sponsor_label.get_style_context().add_class('about-content')
        vbox.pack_start(sponsor_label, False, False, 0)

        # Make links clickable
        sponsor_label.connect('activate-link', self._on_link_clicked)

        # Separator
        separator = Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL)
        vbox.pack_start(separator, False, False, 4)

        # License info
        license_label = Gtk.Label()
        license_label.set_markup(_('settings-about-license'))
        license_label.set_xalign(0.0)  # Left align text
        license_label.set_line_wrap(True)
        license_label.get_style_context().add_class('about-content')
        vbox.pack_start(license_label, False, False, 0)

        return card

    def _on_github_clicked(self, widget):
        """Handle GitHub button click."""
        url = "https://github.com/carsteneu/remember"
        self._open_url(url)

    def _on_issues_clicked(self, widget):
        """Handle Issues button click."""
        url = "https://github.com/carsteneu/remember/issues"
        self._open_url(url)

    def _on_docs_clicked(self, widget):
        """Handle Documentation button click."""
        url = "https://carsteneu.github.io/remember/"
        self._open_url(url)

    def _on_link_clicked(self, label, uri):
        """Handle link activation in labels."""
        self._open_url(uri)
        return True  # Prevent default handler

    def _open_url(self, url):
        """Open URL in default browser."""
        try:
            subprocess.Popen(['xdg-open', url])
        except Exception as e:
            print(f"Error opening URL {url}: {e}", file=sys.stderr)
