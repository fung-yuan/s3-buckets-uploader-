const { app, BrowserWindow } = require('electron')
console.log('app type:', typeof app)
console.log('process.type:', process.type)
app.whenReady().then(() => {
  console.log('Electron ready!')
  app.quit()
})
