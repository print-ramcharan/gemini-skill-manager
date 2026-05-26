const { app, BrowserWindow, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow;
const appIconPath = path.join(__dirname, 'new-logo.png');
const dockIcon = nativeImage.createFromPath(appIconPath);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    icon: appIconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#121214'
  });

  const htmlPath = path.join(__dirname, 'index.html');
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('Renderer failed to load:', { errorCode, errorDescription, validatedURL, htmlPath });
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('Renderer process gone:', details);
  });

  mainWindow.loadFile(htmlPath).catch(error => {
    console.error('Failed to load main window HTML:', error);
  });
}

app.whenReady().then(() => {
  if (process.platform === 'darwin' && !dockIcon.isEmpty()) {
    app.dock.setIcon(dockIcon);
  }

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Paths to skills and backup
const homeDir = os.homedir();
const skillsDir = path.join(homeDir, '.gemini/config/skills');
const backupDir = path.join(homeDir, '.gemini/config/skills_backup');

// Helper to parse SKILL.md
function parseSkillInfo(folderPath, folderName) {
  const skillMdPath = path.join(folderPath, 'SKILL.md');
  let displayName = folderName;
  let description = 'No description available.';
  let tokenEstimate = 500; // Default fallback

  if (fs.existsSync(skillMdPath)) {
    try {
      const content = fs.readFileSync(skillMdPath, 'utf8');
      
      // Rough token estimation: ~4 characters per token
      tokenEstimate = Math.ceil(content.length / 4);

      // Simple frontmatter parser
      const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (match) {
        const yamlLines = match[1].split('\n');
        for (const line of yamlLines) {
          const nameMatch = line.match(/^name:\s*(.+)$/);
          const descMatch = line.match(/^description:\s*["']?(.+?)["']?$/);
          if (nameMatch) displayName = nameMatch[1].trim();
          if (descMatch) description = descMatch[1].trim();
        }
      }
    } catch (e) {
      console.error(`Error reading SKILL.md for ${folderName}:`, e);
    }
  }

  return { name: displayName, description, tokens: tokenEstimate };
}

// IPC: Fetch all skills
ipcMain.handle('get-skills', async () => {
  const skillsList = [];

  // Ensure directories exist
  if (!fs.existsSync(skillsDir)) {
    fs.mkdirSync(skillsDir, { recursive: true });
  }
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // Scan Active Skills
  const activeFolders = fs.readdirSync(skillsDir).filter(f => {
    const p = path.join(skillsDir, f);
    return fs.statSync(p).isDirectory();
  });

  for (const folder of activeFolders) {
    const { name, description, tokens } = parseSkillInfo(path.join(skillsDir, folder), folder);
    skillsList.push({
      id: folder,
      name,
      description,
      tokens,
      status: 'active'
    });
  }

  // Scan Backup Skills
  const backupFolders = fs.readdirSync(backupDir).filter(f => {
    const p = path.join(backupDir, f);
    return fs.statSync(p).isDirectory();
  });

  for (const folder of backupFolders) {
    const { name, description, tokens } = parseSkillInfo(path.join(backupDir, folder), folder);
    skillsList.push({
      id: folder,
      name,
      description,
      tokens,
      status: 'backup'
    });
  }

  return skillsList.sort((a, b) => a.id.localeCompare(b.id));
});

// IPC: Get full skill content (SKILL.md)
ipcMain.handle('get-skill-content', async (event, { id, status }) => {
  const folderDir = status === 'active' ? skillsDir : backupDir;
  const filePath = path.join(folderDir, id, 'SKILL.md');
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8');
  }
  return '# No documentation found\nSKILL.md does not exist for this skill.';
});

// IPC: Apply Changes
ipcMain.handle('apply-changes', async (event, { activeIds }) => {
  const activeSet = new Set(activeIds);
  const allSkills = [];

  // 1. Gather all current folders and locations
  const activeFolders = fs.readdirSync(skillsDir).filter(f => fs.statSync(path.join(skillsDir, f)).isDirectory());
  const backupFolders = fs.readdirSync(backupDir).filter(f => fs.statSync(path.join(backupDir, f)).isDirectory());

  activeFolders.forEach(f => allSkills.push({ id: f, current: 'active' }));
  backupFolders.forEach(f => allSkills.push({ id: f, current: 'backup' }));

  // Filter only those that need moving
  const moves = [];
  allSkills.forEach(skill => {
    const shouldBeActive = activeSet.has(skill.id);
    if (shouldBeActive && skill.current === 'backup') {
      moves.push({ id: skill.id, from: path.join(backupDir, skill.id), to: path.join(skillsDir, skill.id), target: 'active' });
    } else if (!shouldBeActive && skill.current === 'active') {
      moves.push({ id: skill.id, from: path.join(skillsDir, skill.id), to: path.join(backupDir, skill.id), target: 'backup' });
    }
  });

  const totalMoves = moves.length;
  if (totalMoves === 0) {
    return { success: true, movedCount: 0 };
  }

  // 2. Perform moves sequentially to track progress
  let currentMove = 0;
  for (const move of moves) {
    currentMove++;
    mainWindow.webContents.send('move-progress', {
      current: currentMove,
      total: totalMoves,
      skillName: move.id,
      target: move.target
    });

    try {
      // Use fs.renameSync, but it might fail across devices, so fallback to copy/delete if needed.
      // Since both are in ~/.gemini/config/, renameSync should work perfectly and be near-instant.
      fs.renameSync(move.from, move.to);
    } catch (e) {
      console.error(`Failed to move ${move.id}:`, e);
      // Fallback: simple copy and delete
      try {
        fs.cpSync(move.from, move.to, { recursive: true });
        fs.rmSync(move.from, { recursive: true, force: true });
      } catch (err) {
        console.error(`Fallback failed for ${move.id}:`, err);
      }
    }
    // Small artificial delay to let UI render progress bar smoothly
    await new Promise(r => setTimeout(r, 10));
  }

  return { success: true, movedCount: totalMoves };
});

module.exports = { parseSkillInfo };
