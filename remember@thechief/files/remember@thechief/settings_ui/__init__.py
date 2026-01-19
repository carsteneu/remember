"""
Settings UI Package for Window Position Remember Extension

This package provides a modular settings interface with:
- css.py: GTK CSS styling
- utils.py: Common utilities and helpers
- app_config.py: Application session restore configuration
- tabs/: Individual tab implementations
  - overview.py: Dashboard with stats and quick actions
  - windows.py: Consolidated window data view
  - apps.py: App session configuration
  - preferences.py: Extension preferences
"""

from .main_window import SettingsWindow

__all__ = ['SettingsWindow']
