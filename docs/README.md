# Remember - Dokumentation

Willkommen zur Dokumentation des **Remember** Cinnamon Extension und Applet Projekts.

## Übersicht

**Remember** ist ein Cinnamon Desktop Extension System, das automatisch Fensterpositionen speichert und wiederherstellt - sogar über Neustarts hinweg. Es unterstützt auch das automatische Starten gespeicherter Sessions mit allen Anwendungen.

### Komponenten

- **Extension (remember@thechief)** - Haupt-Extension für Fensterpositions-Tracking und Session Restore
- **Applet (remember-applet@thechief)** - Panel-Applet für schnellen Zugriff und Status-Anzeige

## Dokumentations-Bereiche

### 📚 [User Guide](user-guide/)

Dokumentation für Endanwender:
- [Getting Started](user-guide/getting-started.md) - Installation und erste Schritte
- [Features](user-guide/features.md) - Funktionsübersicht
- [Configuration](user-guide/configuration.md) - Konfiguration und Anpassung
- [FAQ](user-guide/faq.md) - Häufig gestellte Fragen und Problemlösungen

### 🔧 [Developer Guide](developer/)

Dokumentation für Entwickler und Plugin-Autoren:
- [Architecture](developer/architecture.md) - System-Architektur und Design
- [Plugin Development](developer/plugin-development.md) - Eigene Plugins entwickeln
- [API Reference](developer/api-reference.md) - API-Dokumentation
- [Contributing](developer/contributing.md) - Zum Projekt beitragen

## Projekt-Links

- **GitHub Repository:** [carsteneu/remember](https://github.com/carsteneu/remember)
- **Issue Tracker:** [GitHub Issues](https://github.com/carsteneu/remember/issues)

## Schnelleinstieg

```bash
# Extension installieren
cd ~/.local/share/cinnamon/extensions/
git clone https://github.com/carsteneu/remember.git remember@thechief

# Cinnamon neu starten
cinnamon --replace &

# Extension aktivieren
# System Settings → Extensions → Remember → Enable
```

## Hauptfunktionen

- ✅ Automatisches Speichern von Fensterpositionen
- ✅ Multi-Monitor Support mit EDID-Identifikation
- ✅ Session Restore - Anwendungen automatisch starten
- ✅ 15+ vorkonfigurierte Plugins (Firefox, VS Code, LibreOffice, etc.)
- ✅ Erweiterbares Plugin-System
- ✅ Auflösungsunabhängige Positionsspeicherung
- ✅ Smart Window Matching

## Lizenz

Dieses Projekt steht unter der GPLv3-Lizenz.
