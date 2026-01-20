# User Guide - Window Position Remember

Vollständige Benutzer-Dokumentation für die **Window Position Remember** Cinnamon Extension.

---

## Übersicht

**Window Position Remember** ist eine leistungsstarke Cinnamon Extension, die automatisch Fensterpositionen speichert und wiederherstellt. Mit Multi-Monitor-Support, Session Restore und 15+ vorkonfigurierten Plugins bietet sie eine umfassende Lösung für die Fensterverwaltung.

---

## Dokumentations-Index

### 1. [Getting Started](getting-started.md) - Erste Schritte

**Für neue Benutzer** - Schnelleinstieg in 5 Minuten:

- ✅ Installation (Cinnamon Spices + Git)
- ✅ Extension aktivieren
- ✅ Applet zum Panel hinzufügen
- ✅ Erste Schritte: Automatisches Speichern
- ✅ Test durchführen
- ✅ Multi-Monitor-Unterstützung verstehen
- ✅ Session Restore aktivieren

**Empfohlen für**: Erstbenutzer, Schnellstart

---

### 2. [Features](features.md) - Funktionsübersicht

**Detaillierte Feature-Beschreibungen**:

- 🔄 **Window Position Tracking** - Automatisches Speichern (alle 30s)
- 🖥️ **Multi-Monitor Support** - EDID-Identifikation, auflösungsunabhängig
- 🚀 **Session Restore** - Auto-Launch beim Login
- 🎯 **Smart Window Matching** - 5 Matching-Strategien
- 💾 **Fenster-Status** - sticky, always-on-top, fullscreen, shaded
- 🔌 **Plugin-System** - 15+ vorkonfigurierte Plugins
- 🚫 **Blacklist-System** - Anwendungen ausschließen
- 📐 **Workspace-Support** - Multi-Workspace-Verfolgung

**Empfohlen für**: Alle Benutzer, die Features im Detail verstehen möchten

---

### 3. [Configuration](configuration.md) - Konfiguration

**Vollständige Einstellungs-Referenz**:

#### Cinnamon Settings (Built-in)
- **General**: track-all-workspaces, track-dialogs, auto-restore, auto-launch, capture-cmdline
- **Behavior**: save-delay, restore-delay, use-percentage, clamp-to-screen, restore-workspace
- **Window States**: remember-sticky, remember-always-on-top, remember-shaded, remember-fullscreen, restore-minimized
- **Blacklist**: Ausgeschlossene Anwendungen

#### Python Settings UI (Erweitert)
- **Overview Tab**: Dashboard, Statistiken, Quick Actions
- **Windows Tab**: Alle gespeicherten Fenster, Filter, Suche
- **Apps Tab**: Launch Flags, Autostart, Blacklist Management
- **About Tab**: Extension-Informationen

#### Datenspeicherung
- `positions.json` - Fensterpositionen & Monitore
- `preferences.json` - UI-Einstellungen
- `extension-settings.json` - Launch-Flags
- Backup-System (7 Tage)

**Empfohlen für**: Benutzer, die Einstellungen anpassen möchten

---

### 4. [FAQ & Troubleshooting](faq.md) - Häufige Fragen

**Lösungen für häufige Probleme**:

#### Häufig gestellte Fragen
- ❓ Wo werden Daten gespeichert?
- ❓ Wie funktioniert Multi-Monitor?
- ❓ Wie oft werden Positionen gespeichert?
- ❓ Werden sensible Daten gespeichert?
- ❓ Funktioniert es mit Flatpak/Snap/AppImage?
- ❓ Wie erstelle ich Backups?

#### Konfiguration
- 🔧 Anwendung zur Blacklist hinzufügen
- 🔧 Launch-Flags ändern
- 🔧 Session Restore für bestimmte App deaktivieren

#### Probleme & Lösungen
- 🐛 Extension startet nicht
- 🐛 Fenster wird nicht wiederhergestellt
- 🐛 Fenster an falscher Position
- 🐛 Session Restore funktioniert nicht
- 🐛 Applet zeigt keine Daten
- 🐛 Performance-Probleme

#### Erweiterte Themen
- 🔬 Daten zwischen Rechnern synchronisieren
- 🔬 Extension-Probleme debuggen
- 🔬 Bug-Report erstellen

**Empfohlen für**: Benutzer mit Problemen oder spezifischen Fragen

---

## Schnellzugriff

### Installation (Kurzfassung)

```bash
# Über Cinnamon Spices
Systemeinstellungen → Extensions → Download → "Window Position Remember"

# Oder via Git
cd ~/.local/share/cinnamon/extensions/
git clone https://github.com/carsteneu/remember.git remember@thechief
cinnamon --replace &
```

### Wichtige Einstellungen

```bash
# Cinnamon Settings öffnen
cinnamon-settings extensions remember@thechief

# Python Settings UI öffnen
python3 ~/.local/share/cinnamon/extensions/remember@thechief/settings.py
```

### Logs anzeigen

```bash
# Extension-Logs filtern
tail -f ~/.xsession-errors | grep "remember@thechief"

# Gespeicherte Daten anzeigen
cat ~/.config/remember@thechief/positions.json | jq
```

### Backup erstellen

```bash
# Manuelles Backup
cp ~/.config/remember@thechief/positions.json \
   ~/remember_backup_$(date +%Y-%m-%d).json

# Automatische Backups ansehen
ls -lh ~/.config/remember@thechief/backups/
```

---

## Unterstützte Anwendungen

Die Extension funktioniert mit **allen Anwendungen**, aber 15+ Plugins bieten erweiterte Funktionen:

### Browser
- **Firefox** - Session Restore mit `--restore-session`
- **Chrome / Chromium** - Multi-Window Support
- **Brave** - Session Restore

### Editoren & IDEs
- **Visual Studio Code** - Workspace-Restore
- **JetBrains IDEs** (IntelliJ IDEA, PyCharm, WebStorm, etc.)
- **gedit, xed, kate, SciTE** - Datei-Restore

### Office & Tools
- **LibreOffice** - Dokument-Pfad-Restore
- **Thunderbird** - Multi-Profil Support
- **GIMP** - Bilddatei-Restore
- **Nemo** - Dateimanager-Fenster

### Sonstige
- **Wave Terminal** - Terminal-Session
- **Gradia** - Screenshot-Tool (Flatpak)

---

## Systemanforderungen

- **Cinnamon Desktop**: 6.0+ (empfohlen: aktuelle stabile Version)
- **Python**: 3.8+ (für Settings UI)
- **GTK**: 3.0+ (für Settings UI)

---

## Dateien & Verzeichnisse

| Pfad | Beschreibung |
|------|--------------|
| `~/.local/share/cinnamon/extensions/remember@thechief/` | Extension-Installation |
| `~/.local/share/cinnamon/applets/remember-applet@thechief/` | Applet-Installation |
| `~/.config/remember@thechief/positions.json` | Fensterpositionen & Monitore |
| `~/.config/remember@thechief/preferences.json` | UI-Einstellungen |
| `~/.config/remember@thechief/extension-settings.json` | Launch-Flags |
| `~/.config/remember@thechief/positions_backup_*.json` | Automatische Backups (7 Tage) |
| `~/.xsession-errors` | Cinnamon-Logs |

---

## Links & Ressourcen

- **GitHub Repository**: https://github.com/carsteneu/remember
- **GitHub Issues**: https://github.com/carsteneu/remember/issues
- **Cinnamon Spices**: https://cinnamon-spices.linuxmint.com/extensions/view/remember@thechief
- **Dokumentation**: Dieses Verzeichnis (`docs/user-guide/`)

---

## Support & Mitwirkung

### Bug-Reports

Erstellen Sie ein **GitHub Issue** mit:
- System-Informationen (Cinnamon-Version, Distribution)
- Extension-Version
- Logs (`~/.xsession-errors`)
- Schritte zur Reproduktion

### Feature-Requests

Schlagen Sie neue Features über **GitHub Issues** vor.

### Mitwirkung

Pull Requests sind willkommen! Siehe [CONTRIBUTING.md](../../CONTRIBUTING.md) für Details.

---

## Lizenz

**MIT License** - Siehe [LICENSE](../../LICENSE) für Details.

---

## Über den Autor

**carsteneu** - Extension-Entwickler

- GitHub: https://github.com/carsteneu
- Extension-Homepage: https://github.com/carsteneu/remember

---

## Changelog

Siehe [CHANGELOG.md](../../CHANGELOG.md) für Versions-Historie.

---

**Viel Erfolg mit Window Position Remember!**

Bei Fragen oder Problemen:
1. Lesen Sie die [FAQ](faq.md)
2. Prüfen Sie [GitHub Issues](https://github.com/carsteneu/remember/issues)
3. Erstellen Sie ein neues Issue mit detaillierten Informationen

---

*Letzte Aktualisierung: Januar 2026*
