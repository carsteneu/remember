#!/bin/bash
# Install script for Window Position Remember (Spices structure)
# Installs extension and applet from Spices directories

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXTENSION_DIR="$HOME/.local/share/cinnamon/extensions/remember@thechief"
APPLET_DIR="$HOME/.local/share/cinnamon/applets/remember-applet@thechief"
LOCALE_DIR="$HOME/.local/share/locale"
EXTENSION_UUID="remember@thechief"
EXTENSION_SOURCE="$SCRIPT_DIR/remember@thechief/files/remember@thechief"
APPLET_SOURCE="$SCRIPT_DIR/remember-applet@thechief/files/remember-applet@thechief"

echo "Installing Window Position Remember..."

# Check if extension source directory exists
if [ ! -d "$EXTENSION_SOURCE" ]; then
    echo "Error: Extension source directory not found: $EXTENSION_SOURCE"
    exit 1
fi

# Create directories
mkdir -p "$EXTENSION_DIR"
mkdir -p "$APPLET_DIR"

# Copy extension files from Spices structure
cp -r "$EXTENSION_SOURCE/"* "$EXTENSION_DIR/"
echo "✓ Extension installed to $EXTENSION_DIR"

# Copy applet files if available
if [ -d "$APPLET_SOURCE" ]; then
    cp -r "$APPLET_SOURCE/"* "$APPLET_DIR/"
    echo "✓ Applet installed to $APPLET_DIR"
else
    echo "⚠ Applet source not found, skipping applet installation"
fi

# Compile and install translations
if [ -d "$EXTENSION_SOURCE/po" ]; then
    echo ""
    echo "Compiling translations..."
    for po_file in "$EXTENSION_SOURCE/po"/*.po; do
        if [ -f "$po_file" ]; then
            lang=$(basename "$po_file" .po)
            mkdir -p "$LOCALE_DIR/$lang/LC_MESSAGES"
            msgfmt "$po_file" -o "$LOCALE_DIR/$lang/LC_MESSAGES/$EXTENSION_UUID.mo"
            echo "  ✓ Compiled $lang"
        fi
    done
fi

echo ""
echo "Installation complete!"
echo ""

# Restart Cinnamon to load new extension
# NOTE: dbus RestartCinnamon does NOT clear the GJS module cache!
# We need cinnamon --replace for a full cache clear
echo "Restarting Cinnamon (with cache clear)..."
nohup cinnamon --replace > /dev/null 2>&1 &
sleep 2

echo "✓ Cinnamon restarted (module cache cleared)"
echo ""
echo "Next steps:"
echo "1. Enable extension: System Settings → Extensions → 'Window Position Remember'"
if [ -d "$APPLET_DIR" ]; then
    echo "2. Add applet to panel: Right-click panel → Applets → 'Window Remember Control'"
fi
