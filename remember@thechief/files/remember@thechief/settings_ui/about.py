#!/usr/bin/python3
"""
About tab callbacks for Window Position Remember Extension Settings
Handles button callbacks for opening external links
"""

import subprocess
import sys


def openGitHub(widget=None):
    """Open the GitHub repository in default browser"""
    url = "https://github.com/carsteneu/remember"
    try:
        subprocess.Popen(['xdg-open', url])
    except Exception as e:
        print(f"Error opening GitHub: {e}", file=sys.stderr)


def openIssues(widget=None):
    """Open GitHub Issues page in default browser"""
    url = "https://github.com/carsteneu/remember/issues"
    try:
        subprocess.Popen(['xdg-open', url])
    except Exception as e:
        print(f"Error opening Issues: {e}", file=sys.stderr)


def openDocs(widget=None):
    """Open documentation (README) in default browser"""
    url = "https://github.com/carsteneu/remember#readme"
    try:
        subprocess.Popen(['xdg-open', url])
    except Exception as e:
        print(f"Error opening Docs: {e}", file=sys.stderr)


def openSponsor(widget=None):
    """Open sponsor website in default browser"""
    url = "https://example.com"  # Replace with actual sponsor URL
    try:
        subprocess.Popen(['xdg-open', url])
    except Exception as e:
        print(f"Error opening Sponsor: {e}", file=sys.stderr)
