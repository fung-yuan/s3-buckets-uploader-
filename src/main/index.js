import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import https from 'https'
import http from 'http'
import { readFileSync, statSync } from 'fs'

function createWindow() {
  const win = new BrowserWindow({
    width: 860,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'S3 Uploader',
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'All Files', extensions: ['*'] },
      { name: 'HTML', extensions: ['html', 'htm'] },
      { name: 'PDF', extensions: ['pdf'] },
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'] },
      { name: 'Text', extensions: ['txt', 'csv', 'json', 'xml', 'css', 'js'] },
    ],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const filePath = result.filePaths[0]
  const stats = statSync(filePath)
  const name = filePath.split(/[\\/]/).pop()
  return { path: filePath, name, size: stats.size }
})

ipcMain.handle('upload', async (_event, { url, content, contentType, isFile, filePath }) => {
  return new Promise((resolve) => {
    let parsedUrl
    try {
      parsedUrl = new URL(url)
    } catch {
      return resolve({ success: false, error: 'Invalid URL.' })
    }

    const isHttps = parsedUrl.protocol === 'https:'
    const protocol = isHttps ? https : http

    let body
    if (isFile) {
      try {
        body = readFileSync(filePath)
      } catch (err) {
        return resolve({ success: false, error: `Cannot read file: ${err.message}` })
      }
    } else {
      body = Buffer.from(content, 'utf8')
    }

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Content-Length': body.length,
      },
    }

    const req = protocol.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        resolve({
          success: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          body: data,
          url,
        })
      })
    })

    req.on('error', (err) => resolve({ success: false, error: err.message }))
    req.write(body)
    req.end()
  })
})
