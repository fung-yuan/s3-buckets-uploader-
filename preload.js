const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  upload: (params) => ipcRenderer.invoke('upload', params),
  testConnection: (url) => ipcRenderer.invoke('test-connection', url),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (data) => ipcRenderer.invoke('save-settings', data),
  copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),
  startAutomation: (params) => ipcRenderer.invoke('start-automation', params),
  stopAutomation: () => ipcRenderer.invoke('stop-automation'),
  onAutomationProgress: (cb) => ipcRenderer.on('automation-progress', (_, data) => cb(data)),
  onAutomationDone: (cb) => ipcRenderer.on('automation-done', (_, data) => cb(data)),
  removeAutomationListeners: () => {
    ipcRenderer.removeAllListeners('automation-progress')
    ipcRenderer.removeAllListeners('automation-done')
  },
})
