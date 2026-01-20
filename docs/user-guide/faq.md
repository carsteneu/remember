# FAQ & Troubleshooting - Window Position Remember

Häufig gestellte Fragen und Lösungen für Probleme mit der **Window Position Remember** Extension.

---

## Häufig gestellte Fragen (FAQ)

### Allgemeine Fragen

#### Wo werden die Daten gespeichert?

Alle Daten werden lokal in Ihrem Home-Verzeichnis gespeichert:

```bash
~/.config/remember@thechief/
├── positions.json                      # Fensterpositionen & Monitor-Daten
├── preferences.json                    # UI-Einstellungen (Python Settings)
├── extension-settings.json             # Launch-Flags für Session Restore
├── positions_backup_20260119_143000.json  # Automatische Backups
├── positions_backup_20260119_150000.json
└── positions_backup_latest.json        # Letztes Backup
```

**Hauptdatei ansehen**:
```bash
cat ~/.config/remember@thechief/positions.json | jq
```

**Dateigröße prüfen**:
```bash
ls -lh ~/.config/remember@thechief/positions.json
```

Typische Größe: **50-200 KB** (abhängig von Anzahl der verfolgten Fenster).

---

#### Wie funktioniert Multi-Monitor-Unterstützung?

Die Extension verwendet **EDID-Identifikation** für zuverlässige Monitor-Erkennung:

**1. EDID-Hash (Primäre Methode)**

Jeder Monitor hat eine eindeutige **Hardware-ID** (EDID):

```bash
# EDID auslesen
xrandr --verbose | grep -A 10 "connected"
```

**Vorteile**:
- Funktioniert auch nach **Monitor-Neuanordnung**
- Unabhängig von **Connector-Namen** (HDMI-1, DP-2)
- Erkennt denselben Monitor an verschiedenen Ports

**Beispiel**:
```json
{
  "monitor": "edid:abc123def456...",
  "connector": "HDMI-1",
  "resolution": "1920x1080"
}
```

**2. Fallback-Mechanismen**

Falls EDID nicht verfügbar:
- **Connector + Resolution**: `"HDMI-1_1920x1080"`
- **Monitor-Index**: `"monitor_0"`, `"monitor_1"`

**3. Auflösungsunabhängig**

Positionen werden **prozentual** gespeichert:
```
50% Breite auf 1920x1080 = 960px
50% Breite auf 2560x1440 = 1280px
→ Fenster passt sich automatisch an
```

---

#### Wie oft werden Positionen gespeichert?

**Auto-Save-Mechanismus**:

- **Intervall**: Alle **30 Sekunden**
- **Dirty-Flag-System**: Nur **geänderte** Fenster werden gespeichert
- **Automatisch**: Keine manuelle Aktion erforderlich

**Zusätzlich gespeichert**:
- Bei **Cinnamon-Neustart**
- Bei **Logout/Shutdown** (mit Backup)
- Bei manuellem **"Save All"** über Applet

**Sofort speichern**:
```
Applet → Save All
```

Oder via Terminal:
```bash
# Extension-API aufrufen (nur wenn Applet installiert)
dbus-send --session --dest=org.Cinnamon \
  --type=method_call /org/Cinnamon \
  org.Cinnamon.SaveWindowPositions
```

---

#### Werden meine Passwörter oder sensiblen Daten gespeichert?

**Nein**, die Extension speichert **keine sensiblen Daten**.

**Gespeicherte Informationen**:
- Fensterposition (X, Y, Breite, Höhe)
- Fenstertitel (z.B. "Document1.odt - LibreOffice")
- WM_CLASS (z.B. "firefox")
- Command-Line (optional, siehe unten)

**Command-Line-Argumente**:

Falls `capture-cmdline` aktiviert ist, werden **Start-Befehle** gespeichert:

```json
{
  "cmdline": "firefox --private-window https://example.com"
}
```

**Datenschutz-Hinweise**:
- Command-Lines können **Datei-Pfade** enthalten (z.B. `/home/user/private/document.odt`)
- Deaktivieren Sie `capture-cmdline`, wenn Sie Session Restore nicht nutzen
- Die Datei `positions.json` hat **Benutzer-Berechtigungen** (chmod 600)

**Prüfen Sie gespeicherte Command-Lines**:
```bash
cat ~/.config/remember@thechief/positions.json | jq '.applications[] | .instances[]? | .cmdline[]?'
```

---

#### Funktioniert die Extension mit Flatpak/Snap/AppImage?

**Ja**, die Extension unterstützt alle Paketformate:

**Flatpak**:
```bash
# Beispiel: Firefox Flatpak
flatpak run org.mozilla.firefox

# Gespeichert als
{
  "cmdline": "flatpak run org.mozilla.firefox",
  "exe": "/usr/bin/flatpak"
}
```

**Snap**:
```bash
# Beispiel: Chromium Snap
/snap/bin/chromium

# Automatisch erkannt
```

**AppImage**:
```bash
# Beispiel: VS Code AppImage
~/Applications/code-1.80.0.AppImage

# Gespeichert mit vollständigem Pfad
```

**Wichtig**: Aktivieren Sie `capture-cmdline` für beste Ergebnisse.

---

#### Kann ich Backups erstellen?

**Automatische Backups**:

Die Extension erstellt **automatisch** Backups:
- Bei jedem **Cinnamon-Neustart**
- Bei **Logout/Shutdown**
- Aufbewahrung: **7 Tage**

**Backup-Dateien auflisten**:
```bash
ls -lh ~/.config/remember@thechief/positions_backup_*.json
```

**Manuelles Backup erstellen**:
```bash
# Backup mit Datum
cp ~/.config/remember@thechief/positions.json \
   ~/remember_backup_$(date +%Y-%m-%d).json
```

**Backup wiederherstellen**:
```bash
# 1. Extension deaktivieren
cinnamon-settings extensions remember@thechief
# → Extension-Schalter ausschalten

# 2. Backup kopieren
cp ~/remember_backup_2026-01-19.json \
   ~/.config/remember@thechief/positions.json

# 3. Extension neu aktivieren
```

**Empfehlung**: Nutzen Sie Ihr reguläres Backup-System für `~/.config/remember@thechief/`.

---

### Konfiguration

#### Wie füge ich eine Anwendung zur Blacklist hinzu?

**Methode 1: Cinnamon Settings (einfach)**

1. Öffnen Sie **Systemeinstellungen → Extensions → Remember**
2. Klicken Sie auf **Configure** (⚙️)
3. Gehen Sie zum Tab **Blacklist**
4. Fügen Sie den **WM_CLASS-Namen** hinzu (eine Zeile pro App)

**Beispiel**:
```
cinnamon-settings
gnome-calculator
nemo-desktop
```

**Methode 2: Python Settings UI (grafisch)**

```bash
python3 ~/.local/share/cinnamon/extensions/remember@thechief/settings.py
```

→ **Apps Tab** → **Blacklist Management** → **Add Application**

**WM_CLASS herausfinden**:

```bash
# Methode 1: xprop (interaktiv)
xprop WM_CLASS
# Klicken Sie auf das Fenster

# Ausgabe (Beispiel)
WM_CLASS(STRING) = "firefox", "Firefox"
                      ^          ^
                   Instance    Class

# Methode 2: wmctrl
wmctrl -lx | grep "firefox"

# Methode 3: Alle laufenden Fenster
wmctrl -lx
```

**Welchen Namen verwenden?**
- Nutzen Sie den **zweiten Wert** (Class): `"Firefox"`
- Bei Kleinbuchstaben: `"firefox"` funktioniert ebenfalls
- Groß-/Kleinschreibung wird oft ignoriert

---

#### Wie ändere ich Launch-Flags für Session Restore?

**Launch-Flags** steuern, wie Anwendungen beim Session Restore gestartet werden.

**Python Settings UI öffnen**:
```bash
python3 ~/.local/share/cinnamon/extensions/remember@thechief/settings.py
```

**Apps Tab → Application auswählen**:

**Firefox Beispiel**:
```
┌─────────────────────────────────────┐
│ Firefox                              │
├─────────────────────────────────────┤
│ ✅ Enable Autostart                  │
│ ✅ Firefox Session Restore           │
│                                      │
│ Launch Command:                      │
│ firefox --restore-session            │
└─────────────────────────────────────┘
```

**Verfügbare Flags**:

| App | Flag | Beschreibung |
|-----|------|--------------|
| **Firefox** | `--restore-session` | Stellt Browser-Tabs wieder her |
| **Chrome** | `--restore-last-session` | Öffnet letzte Sitzung |
| **Brave** | `--restore-last-session` | Öffnet letzte Sitzung |
| **VS Code** | `--reuse-window` | Nutzt bestehendes Fenster |
| **LibreOffice** | `/path/to/file.odt` | Öffnet spezifisches Dokument |

**Custom Flags hinzufügen**:

Bearbeiten Sie `~/.config/remember@thechief/extension-settings.json`:

```json
{
  "launchFlags": {
    "firefoxSessionRestore": true,
    "customFlag": true
  }
}
```

---

#### Wie deaktiviere ich Session Restore für eine bestimmte App?

**Python Settings UI**:

1. Öffnen Sie Settings: `python3 ~/.local/share/cinnamon/extensions/remember@thechief/settings.py`
2. Gehen Sie zu **Apps Tab**
3. Wählen Sie die Anwendung aus
4. Deaktivieren Sie **"Enable Autostart"**

**Oder manuell** in `extension-settings.json`:

```json
{
  "autostart": {
    "firefox": true,
    "thunderbird": false,  ← Deaktiviert
    "code": true
  }
}
```

---

### Probleme & Lösungen

#### Extension startet nicht

**Symptome**:
- Extension erscheint nicht in der Liste
- Fehlermeldungen beim Aktivieren
- Extension schaltet sich sofort wieder aus

**Lösungsschritte**:

**1. Logs prüfen**:
```bash
tail -f ~/.xsession-errors | grep "remember@thechief"
```

**2. Extension neu installieren**:
```bash
# Alte Version entfernen
rm -rf ~/.local/share/cinnamon/extensions/remember@thechief/

# Neu installieren über Cinnamon Spices
# Systemeinstellungen → Extensions → Download → Remember
```

**3. Cinnamon neu starten**:
```bash
# Methode 1: Tastenkombination
Ctrl + Alt + Esc

# Methode 2: Terminal
cinnamon --replace &

# Methode 3: Ausloggen und neu einloggen
```

**4. Berechtigungen prüfen**:
```bash
# Extension-Verzeichnis
ls -la ~/.local/share/cinnamon/extensions/remember@thechief/

# Config-Verzeichnis
ls -la ~/.config/remember@thechief/
```

Alle Dateien sollten **Ihrem Benutzer** gehören.

**5. Abhängigkeiten prüfen**:
```bash
# Python 3 (für Settings UI)
python3 --version

# GTK 3 (für Settings UI)
dpkg -l | grep python3-gi
```

---

#### Fenster wird nicht wiederhergestellt

**Symptome**:
- Fenster öffnet an Standard-Position statt gespeicherter Position
- Nur manche Fenster werden wiederhergestellt

**Checkliste**:

**1. Extension aktiviert?**
```bash
# Prüfen
cinnamon-settings extensions

# → "Window Position Remember" muss aktiviert sein
```

**2. Auto-Restore aktiviert?**
```
Systemeinstellungen → Extensions → Remember → Configure
→ "Auto-restore positions on window open" ✅
```

**3. Wurde das Fenster gespeichert?**

Warten Sie **30 Sekunden** nach dem Positionieren, oder:
```
Applet → Save All
```

**4. Blacklist prüfen**:
```bash
# Einstellungen öffnen
cinnamon-settings extensions remember@thechief

# → Blacklist Tab
# → Prüfen, ob App ausgeschlossen ist
```

**5. Logs prüfen**:
```bash
tail -f ~/.xsession-errors | grep "remember@thechief"
```

Suchen Sie nach:
- `Restoring window: [App-Name]`
- Fehlermeldungen

**6. Gespeicherte Daten prüfen**:
```bash
cat ~/.config/remember@thechief/positions.json | jq '.applications["Firefox"] // .applications["firefox"]'
```

Falls **leer** oder **null**: Fenster wurde nicht gespeichert (siehe Punkt 3).

---

#### Fenster wird an falscher Position wiederhergestellt

**Symptome**:
- Fenster erscheint teilweise außerhalb des Bildschirms
- Fenster auf falschem Monitor
- Fenster zu groß oder zu klein

**Mögliche Ursachen & Lösungen**:

**1. Monitor-Layout geändert**

```
Problem: Monitor entfernt/hinzugefügt/neu angeordnet
Lösung: clamp-to-screen aktivieren
```

```
Systemeinstellungen → Extensions → Remember → Behavior
→ "Clamp windows to screen bounds" ✅
```

**2. Auflösung geändert**

```
Problem: Monitor-Auflösung geändert (z.B. 1920x1080 → 2560x1440)
Lösung: use-percentage aktivieren (Standard)
```

```
Systemeinstellungen → Extensions → Remember → Behavior
→ "Use percentage-based positioning" ✅
```

**3. Fenster wurde manuell verschoben**

```
Problem: Fenster wurde nach dem Speichern verschoben
Lösung: Neue Position speichern
```

1. Fenster neu positionieren
2. Warten Sie 30 Sekunden oder klicken Sie **"Save All"**
3. Test: Fenster schließen und neu öffnen

**4. Restore-Delay zu kurz**

```
Problem: Fenster ist noch nicht bereit
Lösung: Restore-Delay erhöhen
```

```
Systemeinstellungen → Extensions → Remember → Behavior
→ Restore delay: 800ms (statt 500ms)
```

Besonders wichtig für **langsame Apps** (LibreOffice, GIMP).

**5. Backup wiederherstellen**

```
Falls nichts hilft: Altes Backup verwenden
```

```bash
# Backup ansehen
ls -lh ~/.config/remember@thechief/positions_backup_*.json

# Wiederherstellen (Extension vorher deaktivieren!)
cp ~/.config/remember@thechief/positions_backup_20260119_143000.json \
   ~/.config/remember@thechief/positions.json
```

---

#### Session Restore funktioniert nicht

**Symptome**:
- Anwendungen starten nicht beim Login
- Nur manche Apps werden gestartet
- Apps starten, aber ohne Fenster

**Checkliste**:

**1. Auto-Launch aktiviert?**
```
Systemeinstellungen → Extensions → Remember → General
→ "Auto-launch session on login" ✅
```

**2. Capture-Cmdline aktiviert?**
```
Systemeinstellungen → Extensions → Remember → General
→ "Capture command line arguments" ✅
```

**3. Per-App Autostart aktiviert?**

```bash
python3 ~/.local/share/cinnamon/extensions/remember@thechief/settings.py
```

→ **Apps Tab** → Anwendung auswählen → **"Enable Autostart"** ✅

**4. Launch Command korrekt?**

Prüfen Sie `extension-settings.json`:
```bash
cat ~/.config/remember@thechief/extension-settings.json | jq
```

**Beispiel**:
```json
{
  "autostart": {
    "firefox": true,
    "code": true
  }
}
```

**5. Timeouts prüfen**

**Browser/IDEs** haben längere Timeouts (2 Min):
- Firefox: 120 Sekunden
- VS Code: 90 Sekunden
- Thunderbird: 120 Sekunden

Warten Sie nach dem Login **2-3 Minuten**, bevor Sie Probleme melden.

**6. Logs prüfen**:
```bash
tail -f ~/.xsession-errors | grep "remember@thechief"
```

Suchen Sie nach:
- `Launching application: [App]`
- `Timeout waiting for window: [App]`
- Fehlermeldungen

**7. Flatpak-Probleme**

```
Problem: Flatpak-Apps starten nicht
Lösung: Prüfen Sie Flatpak-Installation
```

```bash
# Flatpak-Apps auflisten
flatpak list

# Beispiel: Firefox
flatpak run org.mozilla.firefox
```

**Korrekte Command-Line**:
```json
{
  "cmdline": "flatpak run org.mozilla.firefox"
}
```

**Falsch**:
```json
{
  "cmdline": "/usr/bin/firefox"  ← Funktioniert nicht für Flatpak
}
```

---

#### Applet zeigt keine Daten / reagiert nicht

**Symptome**:
- Applet zeigt "0 windows tracked"
- Clicks auf Applet funktionieren nicht
- Applet erscheint leer

**Lösungsschritte**:

**1. Extension aktiviert?**
```
Systemeinstellungen → Extensions
→ "Window Position Remember" muss aktiviert sein
```

**2. Applet neu starten**:
```bash
# Methode 1: Panel neu starten
Rechtsklick auf Panel → "Troubleshoot" → "Restart Cinnamon"

# Methode 2: Applet entfernen und neu hinzufügen
Rechtsklick auf Panel → "Applets to the panel"
→ Remember entfernen → Neu hinzufügen
```

**3. Extension-API prüfen**:

Öffnen Sie **Looking Glass** (`Alt+F2` → `lg`):
```javascript
// Im "Evaluator" Tab
global.log(Main.windowRemember);

// Sollte ausgeben: [object Object]
// Falls undefined: Extension nicht korrekt geladen
```

**4. Logs prüfen**:
```bash
tail -f ~/.xsession-errors | grep -E "(remember@thechief|remember-applet)"
```

---

#### Zu viele Daten / Performance-Probleme

**Symptome**:
- `positions.json` wird sehr groß (> 1 MB)
- Auto-Save verlangsamt System
- Cinnamon-Start verzögert

**Lösungsschritte**:

**1. Dialoge ausschließen**:
```
Systemeinstellungen → Extensions → Remember → General
→ "Track dialog windows" ❌ (deaktivieren)
```

**2. Alte Daten löschen**:

```bash
# Python Settings UI
python3 ~/.local/share/cinnamon/extensions/remember@thechief/settings.py
```

→ **Windows Tab** → Alte/unbenutzte Fenster löschen

**3. Blacklist erweitern**:

Fügen Sie **temporäre Apps** zur Blacklist hinzu:
```
nemo-desktop
cinnamon-settings-*
gnome-calculator
xfce4-appfinder
```

**4. Daten komplett löschen**:

```bash
# WARNUNG: Löscht alle gespeicherten Positionen!
rm ~/.config/remember@thechief/positions.json

# Cinnamon neu starten
cinnamon --replace &
```

**5. Save-Delay erhöhen**:
```
Systemeinstellungen → Extensions → Remember → Behavior
→ Save delay: 2000ms (statt 1000ms)
```

Reduziert I/O-Last auf langsameren Systemen.

---

### Erweiterte Themen

#### Wie kann ich Daten zwischen Rechnern synchronisieren?

**Methode 1: Cloud-Sync (Dropbox, Nextcloud, etc.)**

```bash
# Original-Verzeichnis in Cloud verschieben
mv ~/.config/remember@thechief ~/Dropbox/remember-config

# Symlink erstellen
ln -s ~/Dropbox/remember-config ~/.config/remember@thechief
```

**Auf zweitem Rechner**:
```bash
# Symlink erstellen
ln -s ~/Dropbox/remember-config ~/.config/remember@thechief
```

**⚠️ Warnung**:
- **Monitor-EDIDs** sind unterschiedlich zwischen Rechnern
- Nur sinnvoll bei **identischem Hardware-Setup**
- Kann zu **Konflikten** führen (Auto-Save auf beiden Rechnern)

**Methode 2: Git-Repository (für Entwickler)**

```bash
cd ~/.config/remember@thechief/
git init
git add positions.json extension-settings.json
git commit -m "Initial commit"

# Remote hinzufügen
git remote add origin https://github.com/user/remember-config.git
git push -u origin main
```

**Auf zweitem Rechner**:
```bash
cd ~/.config/
git clone https://github.com/user/remember-config.git remember@thechief
```

**Sync**:
```bash
cd ~/.config/remember@thechief/
git pull  # Änderungen holen
git add .
git commit -m "Update"
git push  # Änderungen hochladen
```

---

#### Wie debugge ich Extension-Probleme?

**1. Looking Glass (Cinnamon Debugger)**

```
Alt + F2 → lg → Enter
```

**Tabs**:
- **Evaluator**: JavaScript-Code ausführen
- **Log**: Extension-Logs anzeigen
- **Windows**: Alle Fenster inspizieren

**Nützliche Commands** (Evaluator Tab):
```javascript
// Extension-Objekt anzeigen
global.log(Main.windowRemember);

// Alle verfolgten Fenster
global.log(Main.windowRemember.tracker.windows);

// Stats abrufen
global.log(Main.windowRemember.getStats());

// Save All auslösen
Main.windowRemember.saveAll();

// Restore All auslösen
Main.windowRemember.restoreAll();
```

**2. Extension-Logs filtern**

```bash
# Nur Extension-Logs
tail -f ~/.xsession-errors | grep "remember@thechief"

# Mit Farben (falls grc installiert)
tail -f ~/.xsession-errors | grep --color=always "remember@thechief"

# In Datei speichern
tail -f ~/.xsession-errors | grep "remember@thechief" > ~/remember-debug.log
```

**3. Verbose Logging aktivieren**

Bearbeiten Sie `extension.js`:
```javascript
const DEBUG = true;  // Zeile am Anfang der Datei

// Dann neu starten
cinnamon --replace &
```

**4. Gespeicherte Daten inspizieren**

```bash
# Schön formatiert
cat ~/.config/remember@thechief/positions.json | jq

# Nur Firefox-Fenster
cat ~/.config/remember@thechief/positions.json | jq '.applications["Firefox"] // .applications["firefox"]'

# Nur Monitor-Daten
cat ~/.config/remember@thechief/positions.json | jq '.monitors'

# Anzahl verfolgter Anwendungen
cat ~/.config/remember@thechief/positions.json | jq '.applications | length'
```

---

#### Wie erstelle ich einen Bug-Report?

**GitHub Issues**: https://github.com/carsteneu/remember/issues

**Bitte folgende Informationen angeben**:

**1. System-Informationen**:
```bash
# Cinnamon-Version
cinnamon --version

# Linux-Distribution
lsb_release -a

# Kernel-Version
uname -r

# Monitor-Setup
xrandr --verbose | grep -A 5 "connected"
```

**2. Extension-Version**:
```bash
cat ~/.local/share/cinnamon/extensions/remember@thechief/metadata.json | jq '.version'
```

**3. Logs**:
```bash
# Relevante Logs extrahieren
grep "remember@thechief" ~/.xsession-errors | tail -n 50 > ~/remember-logs.txt
```

**4. Config-Dateien** (optional):
```bash
# positions.json (falls relevant)
cat ~/.config/remember@thechief/positions.json | jq > ~/positions-debug.json
```

**⚠️ Datenschutz**: Entfernen Sie **sensible Pfade** und **Command-Lines** vor dem Hochladen!

**5. Schritte zur Reproduktion**:
- Was haben Sie gemacht?
- Was war das erwartete Ergebnis?
- Was ist stattdessen passiert?
- Tritt das Problem immer auf oder nur manchmal?

---

## Zusammenfassung

Die **häufigsten Probleme** und ihre Lösungen:

| Problem | Lösung |
|---------|--------|
| Extension startet nicht | Logs prüfen, neu installieren, Cinnamon neu starten |
| Fenster nicht wiederhergestellt | `auto-restore` aktivieren, 30s warten, Blacklist prüfen |
| Falsche Position | `clamp-to-screen` aktivieren, Restore-Delay erhöhen |
| Session Restore funktioniert nicht | `auto-launch` + `capture-cmdline` aktivieren, Per-App Autostart prüfen |
| Applet zeigt keine Daten | Extension aktivieren, Applet neu starten |
| Performance-Probleme | Dialoge ausschließen, alte Daten löschen, Save-Delay erhöhen |

**Weitere Hilfe**:
- [Getting Started](getting-started.md)
- [Features](features.md)
- [Configuration](configuration.md)
- **GitHub Issues**: https://github.com/carsteneu/remember/issues

---

**Bei weiteren Fragen**: Erstellen Sie ein **GitHub Issue** mit detaillierten Informationen!
