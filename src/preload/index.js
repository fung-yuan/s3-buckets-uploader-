const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  upload: (params) => ipcRenderer.invoke('upload', params),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
})
