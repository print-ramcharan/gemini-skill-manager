# Gemini Skill Manager

An Electron desktop application to manage active and backup skills for Google Antigravity and Claude Code.

## Why this app exists

AI coding tools like Claude Code and Google Antigravity use modular folders called "Skills" to extend their capabilities. Having too many active skills consumes workspace context tokens, which can lead to context truncation or exceeding the 20k token limit.

This application allows you to toggle skills on and off. Unused skills are moved to a backup directory, freeing up context space.

## Features

- **Quick Presets**: Select skills for specific environments (Fullstack, Mobile, DevOps, AI/ML, Science, Security, CRO, Automation, etc.).
- **20k Token Limit Toggle**: 
  - When enabled, presets only select the essential skills for that stack to stay under the 20k token limit.
  - When disabled, presets select all matching skills in the stack.
- **Categorization**: Skills are grouped by technology domain into collapsible accordions.
- **Bulk Actions**: Select, deselect, collapse, or expand all categories at once.
- **Context Size Gauge**: Visual status bar estimating the active token footprint.
- **Doc Preview**: View any skill's `SKILL.md` directly inside the app.

## How it works

The app moves directories between:
- **Active Skills**: `~/.gemini/config/skills`
- **Backup Skills**: `~/.gemini/config/skills_backup`

## Setup

### Prerequisites
- Node.js (v18+)
- macOS

### Run
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the app:
   ```bash
   npm start
   ```

 ### Build Instructions
 For packaging the app for macOS and Windows locally using `electron-packager`:

 - Build macOS (requires `icon.icns` in project root):

 ```bash
 npm run build:mac
 ```

 - Build Windows (expects a Windows `.ico` at `icons/windows/icon.ico`):

 ```bash
 npm run build:win
 ```

 - Build both sequentially:

 ```bash
 npm run build:all
 ```

 If you need to create a Windows `.ico` from a PNG on macOS or Linux, ImageMagick can do this:

 ```bash
 convert colorful-padded.png -define icon:auto-resize=256,128,64,48,32,16 icons/windows/icon.ico
 ```

 If you prefer `electron-builder` for producing installer artifacts, let me know and I can add it.

### Install / Deploy

Install on macOS (packager output or `electron-builder`):

```bash
# build (packager) or use electron-builder
npm run build:mac

# find the produced .app and install to /Applications
APP=$(find dist -name "Gemini Skill Manager.app" -print -quit)
rm -rf "/Applications/Gemini Skill Manager.app" || true
cp -R "$APP" /Applications/

# refresh LaunchServices and macOS caches so the Dock shows the new icon
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "/Applications/Gemini Skill Manager.app" || true
touch "/Applications/Gemini Skill Manager.app" || true
qlmanage -r cache || true
killall Dock || true
open "/Applications/Gemini Skill Manager.app" || true
```

Notes:
- Code signing: building signed DMGs or notarized apps requires an Apple Developer account and codesign configuration. Unsigned artifacts still run locally.

Install on Windows:

```bash
# Using electron-packager (produces a folder) or electron-builder (produces installer/exe)
npm run build:win

# If electron-builder produced an NSIS installer (recommended):
npm run dist:win

# Example: run the installer produced in dist/ or unzip the portable ZIP and run
# dist\Gemini Skill Manager Setup 1.0.0.exe
```

Notes:
- Building Windows installers on macOS may require Wine for some targets (NSIS). You can still produce ZIP/artifact outputs without Wine and build full installers on a Windows CI runner.
- To install manually, copy the packaged folder to `C:\Program Files\Gemini Skill Manager` and create a shortcut to the executable.

### Build macOS App
To package the app into `/Applications/Gemini Skill Manager.app`:
```bash
npx -y electron-packager . "Gemini Skill Manager" --platform=darwin --overwrite --icon=icon.icns --out=dist
rm -rf "/Applications/Gemini Skill Manager.app"
cp -r "dist/Gemini Skill Manager-darwin-arm64/Gemini Skill Manager.app" /Applications/
rm -rf dist
```

## Contributing
Pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the expected workflow, testing notes, and review checklist.
