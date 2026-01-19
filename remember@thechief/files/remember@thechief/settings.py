#!/usr/bin/python3
"""
Settings dialog for Window Position Remember Extension

This script is called when user clicks "Configure" in Extension Manager.
It provides a GTK-based settings interface with modern, information-dense design.

The actual implementation is in the settings_ui package.
Translation is initialized in settings_ui/i18n.py
"""

import sys
import os
import locale

# Add the extension directory to the path for imports
ext_dir = os.path.dirname(os.path.abspath(__file__))
if ext_dir not in sys.path:
    sys.path.insert(0, ext_dir)

# Set up locale (best effort)
try:
    locale.setlocale(locale.LC_ALL, '')
except:
    pass

# Import and run main (i18n is initialized in settings_ui.i18n)
from settings_ui.main_window import main

if __name__ == "__main__":
    main()
