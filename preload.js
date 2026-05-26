const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getSkills: () => ipcRenderer.invoke('get-skills'),
  getSkillContent: (id, status) => ipcRenderer.invoke('get-skill-content', { id, status }),
  applyChanges: (activeIds) => ipcRenderer.invoke('apply-changes', { activeIds }),
  onProgress: (callback) => ipcRenderer.on('move-progress', (event, data) => callback(data)),
  computeFullTokens: () => ipcRenderer.invoke('compute-full-tokens'),
  onTokenProgress: (callback) => ipcRenderer.on('token-progress', (event, data) => callback(data))
});
