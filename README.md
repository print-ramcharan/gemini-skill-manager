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

### Build macOS App
To package the app into `/Applications/Gemini Skill Manager.app`:
```bash
npx -y electron-packager . "Gemini Skill Manager" --platform=darwin --overwrite --icon=icon.icns --out=dist
rm -rf "/Applications/Gemini Skill Manager.app"
cp -r "dist/Gemini Skill Manager-darwin-arm64/Gemini Skill Manager.app" /Applications/
rm -rf dist
```

## Contributing
Pull requests are welcome. Feel free to open issues or submit changes to add new presets, adjust category rules, or improve the UI.
