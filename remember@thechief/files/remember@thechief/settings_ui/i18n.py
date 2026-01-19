"""
Internationalization setup for settings UI.

This module provides a centralized translation function that can be
imported by all UI modules.
"""

import gettext
import os

UUID = "remember@thechief"
locale_dir = os.path.join(os.path.expanduser("~"), ".local", "share", "locale")

# Bind the text domain
gettext.bindtextdomain(UUID, locale_dir)
gettext.textdomain(UUID)

# Translation function
def _(message):
    """Translate a message using the extension's text domain."""
    return gettext.dgettext(UUID, message)
