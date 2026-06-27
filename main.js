const { app, BrowserWindow, ipcMain, dialog, clipboard } = require('electron')
const path = require('path')
const https = require('https')
const http = require('http')
const fs = require('fs')

let mainWindow = null
let automationTimer = null

const settingsPath = () => path.join(app.getPath('userData'), 's3uploader-settings.json')

function loadSettings() {
  try { return JSON.parse(fs.readFileSync(settingsPath(), 'utf8')) }
  catch { return {} }
}

function saveSettings(data) {
  fs.writeFileSync(settingsPath(), JSON.stringify(data, null, 2))
}

function randomSuffix(len = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function doHttpHead(url) {
  return new Promise((resolve) => {
    let parsedUrl
    try { parsedUrl = new URL(url) }
    catch { return resolve({ ok: false, error: 'Invalid URL' }) }

    const isHttps = parsedUrl.protocol === 'https:'
    const protocol = isHttps ? https : http
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname || '/',
      method: 'HEAD',
    }
    const req = protocol.request(options, (res) => resolve({ ok: true, status: res.statusCode }))
    req.on('error', (err) => resolve({ ok: false, error: err.message }))
    req.setTimeout(8000, () => { req.destroy(); resolve({ ok: false, error: 'Connection timed out' }) })
    req.end()
  })
}

function injectRedirectHtml(html, url, delay) {
  const meta = `<meta http-equiv="refresh" content="${delay};url=${url}">`
  const script = delay > 0
    ? `<script>setTimeout(function(){window.location.replace("${url}")},${delay * 1000})</script>`
    : `<script>window.location.replace("${url}")</script>`
  const block = `\n    ${meta}\n    ${script}`
  if (html.includes('</head>')) return html.replace('</head>', block + '\n</head>')
  return block + '\n' + html
}

function doHttpPut(url, body, contentType) {
  return new Promise((resolve) => {
    let parsedUrl
    try { parsedUrl = new URL(url) }
    catch { return resolve({ success: false, error: 'Invalid URL' }) }

    const isHttps = parsedUrl.protocol === 'https:'
    const protocol = isHttps ? https : http

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'PUT',
      headers: { 'Content-Type': contentType, 'Content-Length': body.length },
    }

    const req = protocol.request(options, (res) => {
      let data = ''
      res.on('data', (c) => (data += c))
      res.on('end', () => resolve({
        success: res.statusCode >= 200 && res.statusCode < 300,
        status: res.statusCode,
        body: data,
        url,
      }))
    })
    req.on('error', (err) => resolve({ success: false, error: err.message }))
    req.write(body)
    req.end()
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 740,
    minWidth: 700,
    minHeight: 560,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'S3 Uploader',
  })

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:3700')
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
    if (automationTimer) { clearInterval(automationTimer); automationTimer = null }
  })
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

ipcMain.handle('load-settings', () => loadSettings())
ipcMain.handle('save-settings', (_, data) => { saveSettings(data); return true })
ipcMain.handle('copy-to-clipboard', (_, text) => { clipboard.writeText(text); return true })

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
  const stats = fs.statSync(filePath)
  return { path: filePath, name: filePath.split(/[\\/]/).pop(), size: stats.size }
})

ipcMain.handle('test-connection', async (_, bucketUrl) => {
  const headResult = await doHttpHead(bucketUrl.replace(/\/$/, ''))
  if (!headResult.ok) {
    return { reachable: false, writable: false, error: headResult.error || 'Cannot reach bucket URL' }
  }
  const testUrl = `${bucketUrl.replace(/\/$/, '')}/_s3uploader_test.txt`
  const putResult = await doHttpPut(testUrl, Buffer.from('s3uploader-test', 'utf8'), 'text/plain')
  if (putResult.success) return { reachable: true, writable: true }
  if (putResult.status === 403) return { reachable: true, writable: false, error: 'Access Denied — bucket does not allow public writes' }
  return { reachable: true, writable: false, error: `Write test failed (HTTP ${putResult.status || 'error'})` }
})

ipcMain.handle('upload', async (_, { url, content, contentType, isFile, filePath, redirect }) => {
  let body
  if (isFile) {
    try { body = fs.readFileSync(filePath) }
    catch (err) { return { success: false, error: `Cannot read file: ${err.message}` } }
  } else {
    body = Buffer.from(content, 'utf8')
  }
  if (redirect?.enabled && redirect?.url && contentType === 'text/html') {
    body = Buffer.from(injectRedirectHtml(body.toString('utf8'), redirect.url, redirect.delay || 0), 'utf8')
  }
  return doHttpPut(url, body, contentType)
})

ipcMain.handle('start-automation', async (event, { bucketUrl, slugPattern, templateHtml, keywords, count, intervalSec, redirect }) => {
  if (automationTimer) return { error: 'Automation is already running' }

  const win = BrowserWindow.fromWebContents(event.sender)
  let uploaded = 0

  const runOne = async () => {
    if (uploaded >= count) {
      clearInterval(automationTimer)
      automationTimer = null
      win?.webContents.send('automation-done', { total: uploaded })
      return
    }

    const keyword = keywords.length > 0 ? keywords[uploaded % keywords.length].trim() : ''
    const random = randomSuffix()

    const slug = slugPattern
      .replace(/\{keyword\}/g, slugify(keyword))
      .replace(/\{random\}/g, random)

    let html = templateHtml
      .replace(/\{keyword\}/g, keyword)
      .replace(/\{random\}/g, random)

    if (redirect?.enabled && redirect?.url) {
      html = injectRedirectHtml(html, redirect.url, redirect.delay || 0)
    }

    const url = `${bucketUrl.replace(/\/$/, '')}/${slug}`
    const result = await doHttpPut(url, Buffer.from(html, 'utf8'), 'text/html')
    uploaded++

    win?.webContents.send('automation-progress', {
      index: uploaded,
      total: count,
      url,
      slug,
      keyword,
      success: result.success,
      status: result.status,
      error: result.error,
    })
  }

  await runOne()
  if (uploaded < count) {
    automationTimer = setInterval(runOne, intervalSec * 1000)
  }
  return { started: true }
})

ipcMain.handle('stop-automation', () => {
  if (automationTimer) { clearInterval(automationTimer); automationTimer = null }
  return { stopped: true }
})
