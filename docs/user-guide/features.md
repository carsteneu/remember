# Features - Window Position Remember

Diese Extension bietet umfassende Funktionen zum Speichern und Wiederherstellen von Fensterpositionen im Cinnamon Desktop.

## Übersicht

**Window Position Remember** ist eine leistungsstarke Cinnamon Extension, die:

- ✅ Fensterpositionen **automatisch** speichert (alle 30 Sekunden)
- ✅ **Multi-Monitor-Setups** vollständig unterstützt
- ✅ **Session Restore** mit automatischem Anwendungsstart beim Login
- ✅ **Smart Window Matching** für zuverlässige Wiederherstellung
- ✅ **Fenster-Status** speichert (sticky, always-on-top, fullscreen, etc.)
- ✅ **15 vorkonfigurierte Plugins** für optimale App-Integration
- ✅ **Blacklist-System** für ausgeschlossene Anwendungen

---

## 1. Window Position Tracking

### Automatisches Speichern

Die Extension verfolgt Fenster automatisch im Hintergrund:

**Auto-Save Mechanismus**:
- **Intervall**: Alle 30 Sekunden
- **Dirty-Flag-System**: Nur geänderte Fenster werden gespeichert (reduziert I/O)
- **Keine manuelle Aktion erforderlich**

**Was wird gespeichert**:
```json
{
  "x": 100,              // X-Koordinate
  "y": 50,               // Y-Koordinate
  "width": 1200,         // Fensterbreite
  "height": 800,         // Fensterhöhe
  "monitor": "edid:abc123", // Monitor-Identifikation
  "workspace": 0,        // Workspace-Nummer
  "sticky": false,       // Auf allen Workspaces sichtbar
  "alwaysOnTop": false,  // Immer im Vordergrund
  "fullscreen": false,   // Vollbildmodus
  "shaded": false        // Aufgerollt (rolled up)
}
```

### Cleanup beim Speichern

Beim automatischen Speichern werden bereinigt:
- **Orphaned Instances**: Fenster, die vom Benutzer geschlossen wurden
- **Duplikate**: Mehrfache Einträge für dieselbe `x11_window_id`
- **Ungültige Einträge**: Null-Geometrie oder fehlerhafte Daten

### Pause-Mechanismus

Auto-Save wird pausiert während:
- **Session Restore**: Verhindert Datenbeschädigung während des Starts
- **Shutdown**: Sichere Datenrettung beim Herunterfahren

---

## 2. Multi-Monitor Support

### EDID-basierte Monitor-Identifikation

**EDID (Extended Display Identification Data)** ist die primäre Identifikationsmethode:

```bash
# Monitor-EDID auslesen
xrandr --verbose | grep -A 10 "connected"
```

**Vorteile**:
- Jeder Monitor hat eine **eindeutige Hardware-ID**
- Funktioniert auch nach **Monitorwechsel**
- Unabhängig von **Connector-Namen** (HDMI-1, DP-2, etc.)
- Funktioniert bei **Monitor-Neuanordnung**

### Fallback-Mechanismen

Falls EDID nicht verfügbar:

1. **Connector + Resolution**: `"HDMI-1_1920x1080"`
2. **Monitor-Index**: `"monitor_0"`, `"monitor_1"`, etc.

### Auflösungsunabhängige Positionierung

**Prozent-basiert (Standard)**:

Positionen werden als **Prozentsatz der Monitor-Größe** gespeichert:

```javascript
percentX = (x / monitorWidth) * 100
percentY = (y / monitorHeight) * 100
```

**Vorteile**:
- Fenster passen sich **automatisch** an neue Auflösungen an
- Ideal für **Laptop-Benutzer** (wechselnde Monitor-Konfigurationen)
- Funktioniert bei **DPI-Änderungen**

**Beispiel**:
- Monitor 1: 1920x1080 → Fenster bei 50% Breite = 960px
- Monitor 2: 2560x1440 → Fenster bei 50% Breite = 1280px

**Absolute Positionierung**:

Deaktivieren Sie `use-percentage` für pixelgenaue Wiederherstellung:
- Fenster werden **exakt** an denselben Pixel-Koordinaten platziert
- Nur sinnvoll bei **festen Monitor-Setups**

### Clamp-to-Screen

`clamp-to-screen` stellt sicher, dass Fenster **immer sichtbar** sind:

- Verhindert Fenster **außerhalb des Bildschirms**
- Passt Position an, wenn Monitor entfernt wurde
- Empfohlen: **Aktiviert** (Standard)

---

## 3. Session Restore / Auto-Launch

### Funktionsweise

Mit **Auto-Launch** werden Anwendungen beim Login automatisch gestartet:

1. **Cinnamon startet**
2. Extension wartet **2 Sekunden** (Desktop-Stabilisierung)
3. **Jede gespeicherte Anwendung** wird nacheinander gestartet
4. **Verzögerung**: 500ms zwischen Fensterstarts
5. **Positionen werden automatisch wiederhergestellt**

### Aktivierung

```
Systemeinstellungen → Extensions → Remember → Configure
→ "Auto-launch session on login" aktivieren
```

### Launch-Flags

Erweiterte Konfiguration über **Python Settings UI**:

```bash
python3 ~/.local/share/cinnamon/extensions/remember@thechief/settings.py
```

**Apps Tab → Launch Flags**:

| Anwendung | Flags | Beschreibung |
|-----------|-------|--------------|
| Firefox | `--restore-session` | Stellt Browser-Tabs wieder her |
| Chrome | `--restore-last-session`<br>`--disable-session-crashed-bubble` | Öffnet letzte Sitzung<br>Unterdrückt "Crash"-Dialog |
| Brave | `--restore-last-session`<br>`--disable-session-crashed-bubble` | Öffnet letzte Sitzung<br>Unterdrückt "Crash"-Dialog |
| VS Code | - | Keine speziellen Flags |

### Single-Instance Apps

**Browser und IDEs** haben spezielle Behandlung:

- **Timeout**: 2 Minuten (statt 30 Sekunden)
- **Grace Period**: 1 Minute nach Timeout
- **Grund**: Diese Apps stellen **ihre eigenen Fenster** wieder her

**Konfiguration** (`config.json`):

```json
{
  "features": {
    "isSingleInstance": true,
    "timeout": 120000,      // 2 Minuten
    "gracePeriod": 60000    // 1 Minute
  }
}
```

### Max Instances

**Sicherheitslimit**: 5 Instanzen pro Anwendung

Verhindert **Runaway-Launches**, falls eine App nicht startet.

---

## 4. Smart Window Matching

### Matching-Strategien (Priorität)

Die Extension verwendet mehrere Strategien, um Fenster korrekt zuzuordnen:

#### 1. Stable Sequence (höchste Priorität)

Eindeutige Sequenznummer **innerhalb einer Session**:

- Wird beim ersten Tracking vergeben
- **Zuverlässigste Methode** während derselben Cinnamon-Session
- Geht verloren bei Cinnamon-Neustart

#### 2. X11 Window ID

Persistente X11-Window-ID:

- **Überlebt Cinnamon-Neustarts** (`Alt+F2` → `r`)
- Geht verloren bei **Re-Login**
- Zweite Priorität

#### 3. Exact Title Match

Exakte Übereinstimmung des **Fenstertitels**:

- Nur für **noch nicht zugeordnete Instanzen**
- Funktioniert nach **Re-Login**
- Gut für Apps mit **eindeutigen Titeln**

**Beispiel**:
- LibreOffice: "Document1.odt - LibreOffice Writer"
- Firefox: "GitHub - Mozilla Firefox"

#### 4. First Unassigned Instance

**Order-basierter Fallback**:

- Wenn keine andere Strategie passt
- Nutzt **Reihenfolge** der Fensteröffnung
- Weniger zuverlässig, aber funktioniert immer

#### 5. Create New Instance

**Neue Instanz anlegen**:

- Nur wenn **kein Match** gefunden wurde
- Erstellt neuen Tracking-Eintrag

### Title Stabilization Delay

Manche Apps ändern ihren Titel **nach dem Öffnen**:

**VS Code Beispiel**:
1. Öffnet mit Titel: "Visual Studio Code"
2. Nach 1 Sekunde: "ProjectName - Visual Studio Code"

**Lösung**: `titleStabilizationDelay` in `config.json`:

```json
{
  "features": {
    "titleStabilizationDelay": 1500  // 1.5 Sekunden warten
  }
}
```

---

## 5. Fenster-Status speichern

### Sticky (Auf allen Workspaces)

**Einstellung**: `remember-sticky` (Standard: **aktiviert**)

Speichert, ob ein Fenster auf **allen Arbeitsflächen** sichtbar ist:

```javascript
// Sticky aktivieren: Rechtsklick auf Titelleiste → "Auf allen Arbeitsflächen"
```

**Wiederherstellung**:
- Fenster wird automatisch auf allen Workspaces angezeigt

### Always-on-Top (Immer im Vordergrund)

**Einstellung**: `remember-always-on-top` (Standard: **aktiviert**)

Speichert "Always on Top"-Status:

```javascript
// Aktivieren: Rechtsklick auf Titelleiste → "Immer im Vordergrund"
```

**Anwendungsfälle**:
- **Notiz-Apps** (immer sichtbar)
- **Media Player** (über anderen Fenstern)

### Shaded (Aufgerollt)

**Einstellung**: `remember-shaded` (Standard: **deaktiviert**)

Speichert, ob ein Fenster **aufgerollt** ist:

```javascript
// Aufroll-Modus: Doppelklick auf Titelleiste
```

**Warum deaktiviert?**
- Die meisten Benutzer möchten Fenster **nicht aufgerollt** wiederherstellen
- Kann manuell aktiviert werden

### Fullscreen (Vollbildmodus)

**Einstellung**: `remember-fullscreen` (Standard: **aktiviert**)

Speichert Vollbildmodus-Status:

```javascript
// Vollbild: F11 oder Rechtsklick → "Vollbild"
```

**Wiederherstellung**:
- Fenster wird automatisch im Vollbildmodus geöffnet

### Minimized (Minimiert)

**Einstellung**: `restore-minimized` (Standard: **deaktiviert**)

**Warum deaktiviert?**
- Die meisten Benutzer möchten Fenster **sichtbar** nach Session Restore
- Aktivieren, wenn minimierte Fenster gewünscht sind

---

## 6. Plugin-System

### Übersicht der 15 Plugins

Die Extension bietet **vorkonfigurierte Plugins** für optimale App-Integration:

#### Browser

| Plugin | WM_CLASS | Features |
|--------|----------|----------|
| **Firefox** | `firefox`, `Navigator` | Session Restore, `--restore-session` |
| **Chrome** | `google-chrome`, `Google-chrome`, `chromium` | Multi-Window, `--restore-last-session` |
| **Brave** | `brave-browser`, `Brave-browser` | Session Restore |

#### Editoren & IDEs

| Plugin | WM_CLASS | Features |
|--------|----------|----------|
| **VS Code** | `code`, `Code` | Workspace Restore, Title Stabilization |
| **JetBrains** | `jetbrains-*`, `idea`, `pycharm`, `webstorm` | Project Restore |
| **gedit** | `gedit`, `Gedit` | File Path Restore |
| **xed** | `xed`, `Xed` | File Path Restore |
| **SciTE** | `scite`, `SciTE` | Session Support |
| **kate** | `kate`, `Kate` | File Restore |

#### Office & Productivity

| Plugin | WM_CLASS | Features |
|--------|----------|----------|
| **LibreOffice** | `libreoffice-*`, `soffice` | Document Path Restore |
| **Thunderbird** | `thunderbird`, `Mail` | Multi-Profile, Title Parsing |
| **GIMP** | `gimp`, `Gimp` | Image File Restore |
| **Nemo** | `nemo`, `Nemo` | File Manager Paths |

#### Sonstige

| Plugin | WM_CLASS | Features |
|--------|----------|----------|
| **Wave** | `wave`, `Wave` | Terminal Session |
| **Gradia** | `org.gradiapp.Gradia` | Flatpak Screenshot Tool |

### Plugin-Struktur

Jedes Plugin hat eine `config.json`:

```json
{
  "name": "firefox",
  "displayName": "Firefox",
  "version": "1.0.0",
  "description": "Browser session restore support",
  "wmClass": ["firefox", "Firefox", "Navigator"],
  "type": "mozilla-browser",

  "settings": {
    "sessionRestore": {
      "type": "app_config",
      "label": "Session Restore",
      "description": "Configure Firefox to restore previous session on startup"
    }
  },

  "launch": {
    "executables": ["firefox"],
    "flags": [],
    "conditionalFlags": {
      "launchFlags.firefoxSessionRestore": ["--restore-session"]
    }
  },

  "features": {
    "isSingleInstance": true,
    "timeout": 120000,
    "gracePeriod": 60000
  }
}
```

### Eigene Plugins erstellen

**User-Plugins** können in `~/.config/remember@thechief/plugins/` erstellt werden:

```bash
mkdir -p ~/.config/remember@thechief/plugins/myapp/
cd ~/.config/remember@thechief/plugins/myapp/
```

**Minimal-Konfiguration** (`config.json`):

```json
{
  "name": "myapp",
  "displayName": "My Application",
  "wmClass": ["myapp", "MyApp"],
  "type": "custom",

  "launch": {
    "executables": ["myapp"],
    "flags": []
  }
}
```

Optional: **Handler-Klasse** (`index.js`) für erweiterte Funktionen.

---

## 7. Blacklist-System

### Anwendungen ausschließen

Manche Anwendungen sollten **nicht verfolgt** werden:

**Systemeinstellungen → Extensions → Remember → Blacklist Tab**

**Blacklist-Editor**:
```
cinnamon-settings
gnome-calculator
nemo-desktop
```

Ein **WM_CLASS-Name pro Zeile**.

### WM_CLASS herausfinden

```bash
# Methode 1: xprop
xprop WM_CLASS
# Klicken Sie auf das Fenster

# Methode 2: wmctrl
wmctrl -lx
```

### Automatische Blacklist

Folgende Apps sind **automatisch ausgeschlossen**:

- **Extension Settings Dialog**: `settings.py` (verhindert Rekursion)
- **System-Dialogs**: `cinnamon-settings-*`
- **Desktop-Icons**: `nemo-desktop`

### Dialoge ausschließen

**Einstellung**: `track-dialogs` (Standard: **deaktiviert**)

**Warum deaktiviert?**
- Dialoge sind **temporär**
- Dialog-Positionen sind meist unwichtig
- Reduziert Datenmenge

**Aktivieren**, wenn Sie **spezielle Dialoge** tracken möchten.

---

## 8. Workspace-Support

### Track-All-Workspaces

**Einstellung**: `track-all-workspaces` (Standard: **aktiviert**)

**Aktiviert**:
- Fenster auf **allen Arbeitsflächen** werden verfolgt
- **Empfohlen** für Multi-Workspace-Nutzer

**Deaktiviert**:
- Nur Fenster auf der **aktuellen Workspace** werden verfolgt
- Spart Ressourcen bei Single-Workspace-Nutzung

### Restore-Workspace

**Einstellung**: `restore-workspace` (Standard: **aktiviert**)

**Aktiviert**:
- Fenster werden auf ihre **ursprüngliche Workspace** verschoben
- Erhält Workspace-Organisation

**Deaktiviert**:
- Fenster öffnen auf der **aktuellen Workspace**
- Nützlich, wenn Sie Workspace-Zuordnung selbst steuern möchten

---

## 9. Restore-Verhalten

### Auto-Restore

**Einstellung**: `auto-restore` (Standard: **aktiviert**)

**Aktiviert**:
- Fenster werden **automatisch** positioniert beim Öffnen
- Keine manuelle Aktion erforderlich

**Deaktiviert**:
- Fenster behalten ihre **Standard-Positionen**
- Restore nur manuell über Applet

### Restore-Delay

**Einstellung**: `restore-delay` (Standard: **500ms**)

Verzögerung vor dem Wiederherstellen:

- **Zu kurz** (< 100ms): Fenster ist ggf. noch nicht bereit
- **Zu lang** (> 2000ms): Sichtbares "Springen" des Fensters
- **Optimal**: 500ms

**Anpassung** für langsame Apps:

```
Systemeinstellungen → Extensions → Remember → Behavior → Restore delay
```

---

## 10. Capture-Mechanismus

### Command-Line Capture

**Einstellung**: `capture-cmdline` (Standard: **aktiviert**)

Speichert **Command-Line-Argumente** für Session Restore:

**Beispiel**:
```bash
# Gestarteter Befehl
firefox --private-window https://example.com

# Gespeichert in positions.json
{
  "cmdline": "firefox --private-window https://example.com"
}
```

**Vorteile**:
- **Genaue Wiederherstellung** mit allen Flags
- Unterstützt **Flatpak**, **Snap**, **AppImage**

**Deaktivieren**, wenn:
- Sie **keine Session Restore** nutzen
- Datenschutzbedenken (Command-Lines können sensible Pfade enthalten)

### Process-Capture via `/proc`

Die Extension liest Prozessinformationen aus `/proc/[pid]/`:

- **cmdline**: Kompletter Start-Befehl
- **exe**: Pfad zur ausführbaren Datei
- **environ**: Umgebungsvariablen (z.B. `FLATPAK_ID`)

**Flatpak-Erkennung**:
```bash
# Normaler Start
/usr/bin/firefox

# Flatpak-Start
/usr/bin/flatpak run org.mozilla.firefox
```

---

## Zusammenfassung

**Window Position Remember** bietet eine umfassende Lösung für:

✅ **Automatisches Tracking** aller Fenster (30s Intervall)
✅ **Multi-Monitor-Support** mit EDID-Identifikation
✅ **Session Restore** mit automatischem App-Start
✅ **Smart Matching** für zuverlässige Wiederherstellung
✅ **Fenster-Status** (sticky, always-on-top, fullscreen, shaded)
✅ **15 Plugins** für optimale App-Integration
✅ **Blacklist-System** für Ausnahmen
✅ **Auflösungsunabhängig** (Prozent + Pixel)

Alle Features sind **konfigurierbar** und arbeiten **automatisch im Hintergrund**.

---

**Weitere Informationen**:
- [Getting Started](getting-started.md)
- [Configuration](configuration.md)
- [FAQ](faq.md)
