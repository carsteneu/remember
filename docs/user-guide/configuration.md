# Configuration - Window Position Remember

Diese Anleitung erklärt alle Konfigurationsoptionen der **Window Position Remember** Extension.

## Übersicht

Die Extension bietet **zwei Konfigurations-Interfaces**:

1. **Cinnamon Settings** - Grundlegende Einstellungen (Built-in)
2. **Python Settings UI** - Erweiterte Einstellungen mit GUI

---

## Cinnamon Settings (System Settings)

### Zugriff

```
Systemeinstellungen → Extensions → Window Position Remember → Configure (⚙️)
```

Oder via Terminal:
```bash
cinnamon-settings extensions remember@thechief
```

---

## Einstellungen-Übersicht

### General (Allgemein)

#### Window Tracking

**track-all-workspaces**
- **Typ**: Switch (Ein/Aus)
- **Standard**: Aktiviert ✅
- **Beschreibung**: Verfolgt Fenster auf allen Arbeitsflächen
- **Empfehlung**: Aktiviert für Multi-Workspace-Nutzer

```
✅ Aktiviert: Alle Fenster auf allen Workspaces werden verfolgt
❌ Deaktiviert: Nur Fenster auf der aktuellen Workspace
```

**track-dialogs**
- **Typ**: Switch
- **Standard**: Deaktiviert ❌
- **Beschreibung**: Verfolgt auch Dialog-Fenster
- **Empfehlung**: Deaktiviert (Dialoge sind temporär)

```
⚠️ Warnung: Aktivieren erhöht Datenmenge erheblich
Nur aktivieren für spezielle Anwendungsfälle
```

---

#### Session Management

**auto-restore**
- **Typ**: Switch
- **Standard**: Aktiviert ✅
- **Beschreibung**: Stellt Fensterpositionen automatisch beim Öffnen wieder her
- **Empfehlung**: Aktiviert (Hauptfunktion der Extension)

```
✅ Aktiviert: Fenster werden automatisch positioniert
❌ Deaktiviert: Manuelle Wiederherstellung über Applet
```

**auto-launch**
- **Typ**: Switch
- **Standard**: Deaktiviert ❌
- **Beschreibung**: Startet gespeicherte Anwendungen automatisch beim Login
- **Empfehlung**: Aktivieren für vollständiges Session Restore

```
⚠️ Wichtig: Erfordert "capture-cmdline" für beste Ergebnisse
```

**Aktivierungs-Workflow**:
1. `auto-launch` aktivieren
2. `capture-cmdline` aktivieren
3. Anwendungen öffnen
4. Bei nächstem Login werden alle Apps automatisch gestartet

**capture-cmdline**
- **Typ**: Switch
- **Standard**: Aktiviert ✅
- **Beschreibung**: Speichert Command-Line-Argumente für Session Restore
- **Empfehlung**: Aktiviert für beste Session-Restore-Qualität

```javascript
// Beispiel: Gespeicherte Command-Line (aus positions.json)
{
  "cmdline": [
    "/usr/bin/firefox",
    "--private-window",
    "https://example.com"
  ],
  "working_dir": "/home/user"
}
```

**Datenschutz**: Command-Lines können sensible Pfade enthalten. Prüfen Sie bei Bedarf:
```bash
cat ~/.config/remember@thechief/positions.json | jq '.applications[] | .instances[]? | .cmdline[]?'
```

---

### Behavior (Verhalten)

#### Timing

**save-delay**
- **Typ**: Spinbutton (Zahlenfeld)
- **Standard**: 1000ms (1 Sekunde)
- **Bereich**: 100ms - 5000ms
- **Beschreibung**: Verzögerung vor dem Speichern (Debouncing)
- **Empfehlung**: 1000ms (Standard)

```
Zu kurz (< 500ms):  Viele Schreibvorgänge (I/O-Last)
Optimal (1000ms):   Balance zwischen Reaktion und Performance
Zu lang (> 3000ms): Änderungen gehen bei Absturz verloren
```

**Anwendungsfälle**:
- **Schnelle Systeme**: 500ms
- **Standard**: 1000ms
- **Langsame HDDs**: 2000ms

**restore-delay**
- **Typ**: Spinbutton
- **Standard**: 500ms
- **Bereich**: 100ms - 2000ms
- **Beschreibung**: Verzögerung vor dem Wiederherstellen der Position
- **Empfehlung**: 500ms

```
Zu kurz (< 200ms):  Fenster ggf. noch nicht bereit
Optimal (500ms):    Zuverlässige Wiederherstellung
Zu lang (> 1000ms): Sichtbares "Springen" des Fensters
```

**Anpassung für langsame Apps**:
```
LibreOffice, GIMP: 800-1000ms
Firefox, Chrome:   500ms (Standard)
Gedit, Kate:       300ms
```

---

#### Restore Behavior

**use-percentage**
- **Typ**: Switch
- **Standard**: Aktiviert ✅
- **Beschreibung**: Speichert Positionen prozentual zur Monitor-Größe
- **Empfehlung**: Aktiviert für Multi-Resolution-Setups

```
✅ Prozentual (Standard):
  - 50% Breite auf 1920x1080 = 960px
  - 50% Breite auf 2560x1440 = 1280px
  → Fenster passen sich automatisch an

❌ Absolut (Pixel):
  - Fenster immer bei exakt denselben Pixel-Koordinaten
  → Nur für feste Monitor-Setups
```

**Beispiel-Berechnung**:
```javascript
// Prozentual speichern
percentX = (x / monitorWidth) * 100
percentY = (y / monitorHeight) * 100

// Wiederherstellen
x = (percentX / 100) * monitorWidth
y = (percentY / 100) * monitorHeight
```

**clamp-to-screen**
- **Typ**: Switch
- **Standard**: Aktiviert ✅
- **Beschreibung**: Stellt sicher, dass Fenster immer sichtbar sind
- **Empfehlung**: Aktiviert

```
✅ Aktiviert:
  - Fenster werden in sichtbaren Bereich verschoben
  - Verhindert "verlorene" Fenster bei Monitor-Wechsel

❌ Deaktiviert:
  - Fenster können außerhalb des Bildschirms sein
  - Nur für Debugging/Entwicklung
```

**Anwendungsfall - Monitor entfernt**:
```
Vorher: 3 Monitore, Fenster auf Monitor 3
Nachher: 2 Monitore
→ Mit clamp-to-screen: Fenster auf Monitor 2
→ Ohne clamp-to-screen: Fenster unsichtbar
```

**restore-workspace**
- **Typ**: Switch
- **Standard**: Aktiviert ✅
- **Beschreibung**: Verschiebt Fenster auf ihre ursprüngliche Workspace
- **Empfehlung**: Aktiviert für Workspace-Organisation

```
✅ Aktiviert:
  - Fenster auf Workspace 2 → Öffnet auf Workspace 2
  - Erhält Ihre Workspace-Organisation

❌ Deaktiviert:
  - Alle Fenster öffnen auf aktueller Workspace
  - Nützlich für flexible Workspace-Nutzung
```

---

#### Window States

**remember-sticky**
- **Typ**: Switch
- **Standard**: Aktiviert ✅
- **Beschreibung**: Speichert "Auf allen Arbeitsflächen"-Status

```javascript
// Sticky aktivieren
Rechtsklick auf Titelleiste → "Auf allen Arbeitsflächen"

// Beim nächsten Öffnen
Fenster ist automatisch auf allen Workspaces sichtbar
```

**remember-always-on-top**
- **Typ**: Switch
- **Standard**: Aktiviert ✅
- **Beschreibung**: Speichert "Immer im Vordergrund"-Status

**Anwendungsfälle**:
- Notiz-Apps (immer sichtbar)
- Media Player (über anderen Fenstern)
- Systemmonitore

**remember-shaded**
- **Typ**: Switch
- **Standard**: Deaktiviert ❌
- **Beschreibung**: Speichert "Aufgerollt"-Status

```javascript
// Aufroll-Modus aktivieren
Doppelklick auf Titelleiste

// Fenster wird nur als Titelleiste angezeigt
```

**Warum deaktiviert?**
Die meisten Benutzer möchten Fenster **nicht aufgerollt** beim Session Restore.

**remember-fullscreen**
- **Typ**: Switch
- **Standard**: Aktiviert ✅
- **Beschreibung**: Speichert Vollbildmodus

```
F11 oder Rechtsklick → "Vollbild"
→ Fenster wird beim nächsten Öffnen im Vollbild gestartet
```

**restore-minimized**
- **Typ**: Switch
- **Standard**: Deaktiviert ❌
- **Beschreibung**: Stellt Fenster minimiert wieder her

**Warum deaktiviert?**
Session Restore soll Apps **sichtbar** machen, nicht minimiert.

```
✅ Deaktiviert (Standard): Minimierte Fenster öffnen normal
❌ Aktiviert: Fenster öffnen minimiert (meist unerwünscht)
```

---

### Blacklist (Ausgeschlossene Anwendungen)

**blacklist-info**
- **Typ**: Label (Informationstext)
- **Beschreibung**: Anleitung für Blacklist-Nutzung

**blacklist**
- **Typ**: Textview (Mehrzeiliges Textfeld)
- **Standard**: Leer
- **Beschreibung**: WM_CLASS-Namen von ausgeschlossenen Anwendungen

**Format**:
```
# Ein WM_CLASS pro Zeile
cinnamon-settings
gnome-calculator
nemo-desktop
```

**WM_CLASS herausfinden**:
```bash
# Methode 1: xprop
xprop WM_CLASS
# Dann auf das Fenster klicken

# Methode 2: wmctrl
wmctrl -lx | grep "Anwendungsname"

# Beispiel-Ausgabe
WM_CLASS(STRING) = "firefox", "Firefox"
                      ^          ^
                   Instance    Class
```

**Häufig ausgeschlossene Apps**:
```
cinnamon-settings         # System-Einstellungen
nemo-desktop             # Desktop-Icons
gnome-calculator         # Taschenrechner
xfce4-appfinder          # App Finder
```

**Automatisch ausgeschlossen**:
- Extension Settings Dialog (`settings.py`)
- System-Dialogs (`cinnamon-settings-*`)

---

## Python Settings UI (Erweiterte Einstellungen)

### Zugriff

**Über System Settings**:
```
Extensions → Remember → Configure (⚙️-Symbol klicken)
```

**Über Terminal**:
```bash
cd ~/.local/share/cinnamon/extensions/remember@thechief/
python3 settings.py
```

---

### Tabs-Übersicht

Die Python-GUI bietet **4 Tabs**:

1. **Overview** - Dashboard mit Statistiken
2. **Windows** - Alle gespeicherten Fenster
3. **Apps** - Anwendungs-Konfiguration
4. **About** - Über die Extension

---

### Tab 1: Overview (Übersicht)

**Dashboard mit Quick Stats**:

```
┌─────────────────────────────────────┐
│ Window Position Remember            │
├─────────────────────────────────────┤
│ Tracked Applications:  12           │
│ Total Windows:         24           │
│ Monitors:              2            │
│ Last Save:             2 min ago    │
└─────────────────────────────────────┘
```

**Quick Actions**:
- **Save All** - Speichert alle Fenster sofort
- **Restore All** - Stellt alle Positionen wieder her
- **Clear All Data** - Löscht alle gespeicherten Daten (mit Bestätigung)
- **Open Backup** - Öffnet Backup-Verzeichnis

**Monitor-Informationen**:
```
Monitor 1: Dell U2720Q (EDID: abc123...)
  Resolution: 3840x2160
  Position: 0,0

Monitor 2: LG 27UK850 (EDID: def456...)
  Resolution: 3840x2160
  Position: 3840,0
```

---

### Tab 2: Windows (Fenster)

**Konsolidierte Fenster-Übersicht**:

Zeigt alle gespeicherten Fenster mit **allen Instanzen** in einer Ansicht.

**Spalten**:
| Spalte | Beschreibung |
|--------|--------------|
| **App** | WM_CLASS (z.B. "firefox") |
| **Title** | Fenstertitel |
| **Position** | X, Y Koordinaten |
| **Size** | Breite × Höhe |
| **Monitor** | Monitor-Name oder EDID |
| **Workspace** | Workspace-Nummer |
| **Sticky** | 🔒 wenn sticky |
| **Top** | 📌 wenn always-on-top |
| **Fullscreen** | ⛶ wenn fullscreen |

**Funktionen**:
- **Filter nach App**: Dropdown-Auswahl
- **Suche**: Fenstertitel-Suche
- **Sortierung**: Nach Spalten sortieren
- **Löschen**: Einzelne Fenster entfernen
- **Restore**: Einzelnes Fenster wiederherstellen

**Beispiel-Ansicht**:
```
┌──────────┬─────────────────────┬──────────┬─────────┬──────────┬────────┐
│ App      │ Title               │ Position │ Size    │ Monitor  │ Sticky │
├──────────┼─────────────────────┼──────────┼─────────┼──────────┼────────┤
│ firefox  │ GitHub - Firefox    │ 100,50   │ 1200×800│ HDMI-1   │        │
│ code     │ Project - VS Code   │ 200,100  │ 1600×900│ DP-1     │ 🔒     │
│ nemo     │ Home - Nemo         │ 300,150  │ 1000×600│ HDMI-1   │        │
└──────────┴─────────────────────┴──────────┴─────────┴──────────┴────────┘
```

---

### Tab 3: Apps (Anwendungen)

**Session-Konfiguration pro Anwendung**:

#### Application List

Liste aller verfolgten Anwendungen mit:
- **Name** (WM_CLASS)
- **Display Name** (lesbarer Name)
- **Instances** (Anzahl geöffneter Fenster)
- **Autostart** (Ein/Aus Toggle)

**Beispiel**:
```
┌─────────────────────────────────────────────────┐
│ Application          Instances   Autostart      │
├─────────────────────────────────────────────────┤
│ Firefox              2           ✅ Enabled     │
│ VS Code              1           ✅ Enabled     │
│ LibreOffice Writer   1           ❌ Disabled    │
│ Thunderbird          2           ✅ Enabled     │
│ Nemo                 3           ❌ Disabled    │
└─────────────────────────────────────────────────┘
```

#### Launch Flags Configuration

**Per-App-Einstellungen** für Session Restore:

**Firefox**:
```
┌─────────────────────────────────────┐
│ Firefox                              │
├─────────────────────────────────────┤
│ ✅ Enable Autostart                  │
│ ✅ Firefox Session Restore           │
│                                      │
│ Launch Command:                      │
│ firefox --restore-session            │
│                                      │
│ Timeout: 120 seconds                 │
│ Grace Period: 60 seconds             │
└─────────────────────────────────────┘
```

**Verfügbare Flags pro App**:

| App | Flag | Beschreibung |
|-----|------|--------------|
| **Firefox** | `--restore-session` | Stellt Browser-Tabs wieder her |
| **Chrome** | `--restore-last-session` | Öffnet letzte Sitzung |
| **Brave** | `--restore-last-session` | Öffnet letzte Sitzung |
| **VS Code** | `--reuse-window` | Nutzt bestehendes Fenster |
| **LibreOffice** | `--writer`, `--calc`, etc. | Öffnet spezifische Komponente |

#### Instance Management

**Pro Instanz konfigurierbar**:
- **Autostart aktivieren/deaktivieren**
- **Launch Command bearbeiten**
- **Custom Flags hinzufügen**
- **Instanz löschen**

**Beispiel - Multiple Firefox-Instanzen**:
```
Instance 1:
  Command: firefox --restore-session
  Autostart: ✅ Enabled

Instance 2:
  Command: firefox --private-window
  Autostart: ❌ Disabled
```

#### Blacklist Management

**Grafische Blacklist-Verwaltung**:

```
┌─────────────────────────────────────┐
│ Excluded Applications                │
├─────────────────────────────────────┤
│ ➕ Add Application                   │
│                                      │
│ • cinnamon-settings      [Remove]    │
│ • gnome-calculator       [Remove]    │
│ • nemo-desktop           [Remove]    │
│                                      │
│ [ Application Name... ]  [Add]       │
└─────────────────────────────────────┘
```

**Auto-Suggest**:
Beim Tippen werden laufende Anwendungen vorgeschlagen.

---

### Tab 4: About (Über)

**Informationen**:
- Extension-Version
- Autor
- Lizenz (MIT)
- GitHub-Link
- Bug-Reports

**Buttons**:
- **Open GitHub** - Öffnet Repository
- **Report Issue** - Öffnet GitHub Issues
- **View Documentation** - Öffnet Docs

---

## Datenspeicherung

### Datei-Struktur

```
~/.config/remember@thechief/
├── positions.json                      # Fensterpositionen & Monitore
├── preferences.json                    # UI-Präferenzen
├── extension-settings.json             # Launch-Flags & Autostart
├── positions_backup_20260119_143000.json  # Automatische Backups
├── positions_backup_20260119_150000.json
└── positions_backup_latest.json        # Letztes Backup
```

### positions.json

**Hauptdatei** mit allen Fensterdaten:

```json
{
  "version": 4,
  "lastSave": "2026-01-19T15:30:00.000Z",
  "monitors": {
    "abc123...": {
      "connector": "HDMI-1",
      "edid": "abc123...",
      "resolution": "1920x1080",
      "position": "0,0",
      "primary": true
    }
  },
  "applications": {
    "Firefox": {
      "wm_class": "Firefox",
      "desktop_file": "firefox.desktop",
      "desktop_exec": "/usr/bin/firefox %u",
      "instances": [
        {
          "id": "Firefox-1737368400000",
          "stable_sequence": 1,
          "x11_window_id": "0x4000001",
          "title_pattern": null,
          "title_snapshot": "GitHub - Mozilla Firefox",
          "cmdline": [
            "/usr/bin/firefox",
            "--restore-session"
          ],
          "working_dir": "/home/user",
          "monitor_index": 0,
          "geometry_percent": {
            "x": 5.2,
            "y": 4.6,
            "width": 62.5,
            "height": 74.0
          },
          "geometry_absolute": {
            "x": 100,
            "y": 50,
            "width": 1200,
            "height": 800
          },
          "workspace": 0,
          "maximized": false,
          "autostart": true,
          "assigned": true,
          "monitor_id": "edid:abc123...",
          "sticky": false,
          "shaded": false,
          "alwaysOnTop": false,
          "fullscreen": false,
          "skipTaskbar": false,
          "minimized": false
        }
      ]
    }
  }
}
```

**Wichtig**: Diese Datei wird von der Extension automatisch bei Fensteränderungen aktualisiert (mit Debouncing-Intervall von save-delay).

### preferences.json

**UI-Einstellungen** (von Python Settings UI):

```json
{
  "window": {
    "width": 1200,
    "height": 800,
    "x": 100,
    "y": 50
  },
  "tabs": {
    "lastActive": "apps"
  },
  "filters": {
    "showOnlyAutostart": false
  }
}
```

**Getrennt von Extension** - verhindert Konflikte mit Auto-Save.

### extension-settings.json

**Launch-Flags** für Session Restore:

```json
{
  "launchFlags": {
    "firefoxSessionRestore": true,
    "chromeSessionRestore": false,
    "vscodeReuseWindow": true
  },
  "autostart": {
    "firefox": true,
    "code": true,
    "thunderbird": false
  }
}
```

**Getrennt von Extension** - wird nur von Apps Tab verwaltet.

---

## Backup-System

### Automatische Backups

**Erstellt bei**:
- Cinnamon-Neustart
- Logout/Shutdown
- Vor großen Änderungen (Clear All Data)

**Backup-Format**:
```
positions_backup_YYYYMMDD_HHMMSS.json
Beispiel: positions_backup_20260119_143000.json
```

**Aufbewahrung**:
- Letzte **10 Backups**: Werden aufbewahrt
- **Ältere Backups**: Automatisch gelöscht
- **Zusätzlich**: `positions_backup_latest.json` (wird immer überschrieben)

### Manuelle Backups

**Backup erstellen**:
```bash
cp ~/.config/remember@thechief/positions.json \
   ~/.config/remember@thechief/positions_backup_manual_$(date +%Y%m%d_%H%M%S).json
```

**Backup wiederherstellen**:
```bash
# Extension stoppen
cinnamon-settings extensions remember@thechief
# → Extension deaktivieren

# Backup kopieren
cp ~/.config/remember@thechief/positions_backup_20260119_143000.json \
   ~/.config/remember@thechief/positions.json

# Extension neu aktivieren
```

---

## Best Practices

### Empfohlene Einstellungen für verschiedene Szenarien

#### Szenario 1: Laptop-Nutzer (wechselnde Monitore)

```
✅ use-percentage: Aktiviert
✅ clamp-to-screen: Aktiviert
✅ auto-restore: Aktiviert
✅ restore-workspace: Aktiviert
❌ auto-launch: Deaktiviert (manueller Start bevorzugt)
```

#### Szenario 2: Desktop mit festem Multi-Monitor-Setup

```
✅ use-percentage: Aktiviert (oder Deaktiviert für pixelgenau)
✅ clamp-to-screen: Aktiviert
✅ auto-restore: Aktiviert
✅ auto-launch: Aktiviert (vollständiges Session Restore)
✅ capture-cmdline: Aktiviert
✅ restore-workspace: Aktiviert
```

#### Szenario 3: Minimalist (nur Position-Restore, kein Session-Restore)

```
✅ auto-restore: Aktiviert
❌ auto-launch: Deaktiviert
❌ capture-cmdline: Deaktiviert (spart Speicher)
✅ clamp-to-screen: Aktiviert
```

#### Szenario 4: Developer (viele IDEs/Editoren)

```
✅ auto-restore: Aktiviert
✅ auto-launch: Aktiviert
✅ capture-cmdline: Aktiviert
✅ use-percentage: Aktiviert
restore-delay: 800ms (für langsame IDEs)
```

---

## Troubleshooting

### Einstellungen werden nicht gespeichert

**Ursache**: Extension überschreibt Änderungen mit Auto-Save

**Lösung**:
1. Nutzen Sie **Python Settings UI** für Launch-Flags
2. Cinnamon Settings nur für Extension-Optionen

### Session Restore funktioniert nicht

**Checkliste**:
```
✅ auto-launch aktiviert?
✅ capture-cmdline aktiviert?
✅ Anwendung in Apps Tab auf Autostart?
✅ Launch-Flags korrekt konfiguriert?
✅ Logs prüfen: ~/.xsession-errors
```

### Fenster erscheint an falscher Position

**Prüfen**:
```
clamp-to-screen: Aktiviert? (verschiebt Fenster in sichtbaren Bereich)
use-percentage: Korrekt für Ihr Setup?
Monitor-Layout geändert? (Backups prüfen)
```

---

## Zusammenfassung

**Window Position Remember** bietet umfassende Konfiguration:

✅ **Cinnamon Settings**: Grundlegende Optionen (Tracking, Timing, Restore)
✅ **Python Settings UI**: Erweiterte Einstellungen (Apps, Launch-Flags, Blacklist)
✅ **3 JSON-Dateien**: Getrennte Datenspeicherung (Extension, UI, Launch-Flags)
✅ **Automatische Backups**: Letzte 10 Backups werden aufbewahrt

Alle Einstellungen sind **dokumentiert**, **konfigurierbar** und **persistent**.

---

**Weitere Informationen**:
- [Getting Started](getting-started.md)
- [Features](features.md)
- [FAQ](faq.md)
