# Getting Started - Window Position Remember

Willkommen bei **Window Position Remember**, der Cinnamon Extension, die automatisch Ihre Fensterpositionen speichert und wiederherstellt. Diese Anleitung hilft Ihnen bei der ersten Einrichtung.

## Installation

### Methode 1: Über Cinnamon Spices (empfohlen)

1. Öffnen Sie die **Systemeinstellungen**
2. Navigieren Sie zu **Extensions** (Erweiterungen)
3. Klicken Sie auf **Download** (Herunterladen)
4. Suchen Sie nach **"Window Position Remember"**
5. Klicken Sie auf **Install** (Installieren)
6. Warten Sie, bis die Installation abgeschlossen ist

### Methode 2: Manuelle Installation via Git

Für Entwickler oder für die neueste Entwicklerversion:

```bash
# Repository klonen
git clone https://github.com/carsteneu/remember.git
cd remember

# Installation ausführen
bash install.sh
```

Das Script kopiert die Extension und das Applet in die korrekten Verzeichnisse und startet Cinnamon automatisch neu.

## Extension aktivieren

Nach der Installation über Cinnamon Spices müssen Sie die Extension aktivieren:

1. Öffnen Sie **Systemeinstellungen**
2. Gehen Sie zu **Extensions** (Erweiterungen)
3. Suchen Sie **"Window Position Remember"** in der Liste
4. Aktivieren Sie den Schalter neben der Extension
5. Die Extension ist jetzt aktiv

> **Hinweis**: Bei manueller Installation via `install.sh` wird die Extension automatisch aktiviert.

## Applet zum Panel hinzufügen (optional)

Das Remember-Applet bietet schnellen Zugriff über Ihr Panel:

1. **Rechtsklick** auf Ihr Panel
2. Wählen Sie **"Applets to the panel"** (Applets zum Panel hinzufügen)
3. Suchen Sie nach **"Window Position Remember"**
4. Klicken Sie auf das **+** Symbol, um es hinzuzufügen
5. Das Applet erscheint in Ihrem Panel

### Applet-Funktionen

Das Applet bietet folgende Schnellaktionen:

- **Save All** - Speichert sofort alle offenen Fensterpositionen
- **Restore All** - Stellt alle Fensterpositionen wieder her
- **Toggle** - Aktiviert/Deaktiviert die automatische Verfolgung
- **Statistiken** - Zeigt Anzahl der verfolgten Fenster und Anwendungen

## Erste Schritte

### Schritt 1: Fenster öffnen

Nach der Aktivierung beginnt die Extension automatisch mit der Arbeit:

1. Öffnen Sie eine Anwendung (z.B. **Firefox**, **VS Code**, **LibreOffice**)
2. Positionieren Sie das Fenster an Ihrer gewünschten Stelle
3. Ändern Sie ggf. die Fenstergröße

### Schritt 2: Automatisches Speichern

Die Extension speichert Fensterpositionen automatisch:

- **Auto-Save Intervall**: Alle 30 Sekunden
- **Dirty-Flag-System**: Nur geänderte Fenster werden gespeichert
- **Gespeichert werden**:
  - Position (X, Y-Koordinaten)
  - Größe (Breite, Höhe)
  - Monitor (bei Multi-Monitor-Setup)
  - Workspace (Arbeitsfläche)
  - Fenster-Status (sticky, always-on-top, fullscreen, etc.)

Sie müssen **nichts manuell tun** - die Extension arbeitet im Hintergrund.

### Schritt 3: Test durchführen

So überprüfen Sie, ob die Extension funktioniert:

1. **Öffnen Sie Firefox** (oder eine andere unterstützte Anwendung)
2. **Positionieren Sie das Fenster** an einer bestimmten Stelle
3. **Warten Sie 30 Sekunden** (oder klicken Sie im Applet auf "Save All")
4. **Schließen Sie Firefox komplett**
5. **Öffnen Sie Firefox erneut**
6. ✅ Das Fenster sollte **exakt an der gleichen Position** erscheinen

## Datenspeicherung

Die Extension speichert alle Daten lokal in Ihrem Home-Verzeichnis:

```
~/.config/remember@thechief/
├── positions.json          # Fensterpositionen und Monitor-Daten
├── preferences.json        # UI-Einstellungen
├── extension-settings.json # Launch-Flags für Session Restore
├── positions_backup_20260119_143000.json  # Automatische Backups
├── positions_backup_20260119_150000.json
└── positions_backup_latest.json           # Neuestes Backup
```

### Backups

Die Extension erstellt **automatisch Backups**:

- Bei jedem Cinnamon-Neustart
- Bei Logout/Shutdown
- Die letzten 10 Backups werden aufbewahrt
- Ältere Backups werden automatisch gelöscht
- Zusätzlich: `positions_backup_latest.json` (immer das neueste)

## Multi-Monitor Support

Die Extension unterstützt mehrere Monitore vollständig:

### EDID-Identifikation

Monitore werden über ihre **EDID-Hash** identifiziert:

- Jeder Monitor hat eine eindeutige Hardware-ID
- Fenster werden dem **richtigen Monitor** zugeordnet
- Funktioniert auch nach Monitorwechsel oder Neuanordnung

### Fallback-Mechanismus

Falls EDID nicht verfügbar:
1. **Connector-Name + Auflösung** (z.B. "HDMI-1_1920x1080")
2. **Monitor-Index** (z.B. Monitor 0, 1, 2)

### Auflösungsunabhängig

Positionen werden **prozentual** gespeichert:

- **Standard**: Prozent-basierte Positionierung
- **Vorteil**: Fenster passen sich automatisch an neue Auflösungen an
- **Fallback**: Absolute Pixel-Koordinaten werden zusätzlich gespeichert

**Beispiel**: Ein Fenster bei 50% Breite auf einem 1920x1080 Monitor erscheint bei 50% Breite auf einem 2560x1440 Monitor.

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

## Nächste Schritte

### Session Restore aktivieren

Um Anwendungen beim Login automatisch zu starten:

1. Öffnen Sie die **Extension-Einstellungen**:
   - Systemeinstellungen → Extensions → Remember → **Configure**
2. Aktivieren Sie **"Auto-launch session on login"**
3. Beim nächsten Login werden alle offenen Anwendungen automatisch gestartet

Details siehe: [Configuration Guide](configuration.md)

### Python Settings UI

Für erweiterte Einstellungen verwenden Sie die Python-GUI:

```bash
# Extension-Einstellungen öffnen
cd ~/.local/share/cinnamon/extensions/remember@thechief/settings_ui/
python3 settings.py
```

Oder über Systemeinstellungen: **Extensions → Remember → Configure** (Zahnrad-Symbol)

## Troubleshooting

### Extension startet nicht

```bash
# Prüfen Sie die Logs
tail -f ~/.xsession-errors

# Filtern nach Remember-Ausgaben
tail -f ~/.xsession-errors | grep remember

# Cinnamon neu starten
cinnamon --replace &
```

### Fenster wird nicht wiederhergestellt

Prüfen Sie:
- Ist die Extension aktiviert?
- Ist `auto-restore` eingeschaltet?
- Wurde das Fenster mindestens 30 Sekunden geöffnet (Auto-Save)?
- Prüfen Sie die Blacklist (Einstellungen)

### Weitere Hilfe

- **FAQ**: [FAQ](faq.md)
- **Konfiguration**: [Configuration Guide](configuration.md)
- **Features**: [Features Overview](features.md)
- **GitHub Issues**: https://github.com/carsteneu/remember/issues

## Zusammenfassung

Nach der Installation haben Sie:

✅ Extension installiert und aktiviert
✅ Applet zum Panel hinzugefügt (optional)
✅ Erste Fenster automatisch gespeichert
✅ Test durchgeführt: Fenster schließen und neu öffnen

Die Extension arbeitet nun **automatisch im Hintergrund** und speichert alle Fensterpositionen. Keine weitere Konfiguration erforderlich!

---

**Viel Erfolg mit Window Position Remember!**
Bei Fragen oder Problemen besuchen Sie: https://github.com/carsteneu/remember
