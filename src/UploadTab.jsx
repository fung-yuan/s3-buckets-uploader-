import { useState, useEffect } from 'react'

const CONTENT_TYPES = [
  { label: 'HTML',       value: 'text/html',                ext: ['html', 'htm'] },
  { label: 'PDF',        value: 'application/pdf',          ext: ['pdf'] },
  { label: 'Plain Text', value: 'text/plain',               ext: ['txt'] },
  { label: 'JSON',       value: 'application/json',         ext: ['json'] },
  { label: 'JPEG',       value: 'image/jpeg',               ext: ['jpg', 'jpeg'] },
  { label: 'PNG',        value: 'image/png',                ext: ['png'] },
  { label: 'WebP',       value: 'image/webp',               ext: ['webp'] },
  { label: 'GIF',        value: 'image/gif',                ext: ['gif'] },
  { label: 'SVG',        value: 'image/svg+xml',            ext: ['svg'] },
  { label: 'CSS',        value: 'text/css',                 ext: ['css'] },
  { label: 'JavaScript', value: 'application/javascript',   ext: ['js'] },
  { label: 'XML',        value: 'application/xml',          ext: ['xml'] },
]

function guessContentType(filename) {
  const ext = filename.split('.').pop().toLowerCase()
  const match = CONTENT_TYPES.find((ct) => ct.ext.includes(ext))
  return match ? match.value : 'application/octet-stream'
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export default function UploadTab({ settings, saveSettings }) {
  const [bucketUrl, setBucketUrl] = useState('')
  const [filePath, setFilePath] = useState('')
  const [contentType, setContentType] = useState('text/html')
  const [mode, setMode] = useState('text')
  const [textContent, setTextContent] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [status, setStatus] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [bucketSaved, setBucketSaved] = useState(false)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (settings.bucketUrl) setBucketUrl(settings.bucketUrl)
  }, [settings.bucketUrl])

  const fullUrl = () => {
    const base = bucketUrl.replace(/\/$/, '')
    const key = filePath.replace(/^\//, '')
    return base && key ? `${base}/${key}` : ''
  }

  const handleSaveBucket = () => {
    saveSettings({ bucketUrl })
    setBucketSaved(true)
    setTimeout(() => setBucketSaved(false), 2000)
  }

  const handleCopyUrl = async () => {
    const url = status?.url || fullUrl()
    if (!url) return
    await window.electron.copyToClipboard(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const applyFile = (file) => {
    setSelectedFile(file)
    if (!filePath) setFilePath(file.name)
    setContentType(guessContentType(file.name))
  }

  const handlePickFile = async () => {
    const file = await window.electron.openFileDialog()
    if (file) applyFile(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    setMode('file')
    applyFile({ path: file.path, name: file.name, size: file.size })
  }

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false) }

  const handleUpload = async () => {
    const url = fullUrl()
    if (!url) { setStatus({ type: 'error', message: 'Enter bucket URL and file path.' }); return }
    if (mode === 'text' && !textContent.trim()) { setStatus({ type: 'error', message: 'Content is empty.' }); return }
    if (mode === 'file' && !selectedFile) { setStatus({ type: 'error', message: 'No file selected.' }); return }

    setUploading(true)
    setStatus(null)

    const result = await window.electron.upload({
      url,
      contentType,
      isFile: mode === 'file',
      content: mode === 'text' ? textContent : null,
      filePath: mode === 'file' ? selectedFile.path : null,
    })

    setUploading(false)

    if (result.success) {
      setStatus({ type: 'success', message: 'Uploaded successfully!', url })
    } else {
      setStatus({ type: 'error', message: result.error || `HTTP ${result.status}: ${result.body?.slice(0, 200)}` })
    }
  }

  return (
    <main
      className="tab-content"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {dragging && (
        <div className="drop-overlay">
          <div className="drop-overlay-box">
            <span className="drop-icon">📁</span>
            <p>Drop file to upload</p>
          </div>
        </div>
      )}

      <div className="card">
        <div className="field-row">
          <div className="field grow">
            <label>BUCKET URL</label>
            <input
              type="text"
              placeholder="https://your-bucket.s3.amazonaws.com"
              value={bucketUrl}
              onChange={(e) => setBucketUrl(e.target.value)}
            />
          </div>
          <div className="field-btn-wrap">
            <button className={`save-btn ${bucketSaved ? 'saved' : ''}`} onClick={handleSaveBucket}>
              {bucketSaved ? '✓ Saved' : 'Save'}
            </button>
          </div>
        </div>

        <div className="field-row">
          <div className="field grow">
            <label>FILE PATH (KEY)</label>
            <input
              type="text"
              placeholder="folder/my-file.html"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
            />
          </div>
          <div className="field">
            <label>CONTENT TYPE</label>
            <select value={contentType} onChange={(e) => setContentType(e.target.value)}>
              {CONTENT_TYPES.map((ct) => (
                <option key={ct.value} value={ct.value}>{ct.label}</option>
              ))}
            </select>
          </div>
        </div>

        {fullUrl() && (
          <div className="url-preview">
            <span className="url-label">URL →</span>
            <span className="url-text">{fullUrl()}</span>
          </div>
        )}
      </div>

      <div className="card">
        <div className="mode-tabs">
          <button className={`tab ${mode === 'text' ? 'active' : ''}`} onClick={() => setMode('text')}>
            Paste HTML / Text
          </button>
          <button className={`tab ${mode === 'file' ? 'active' : ''}`} onClick={() => setMode('file')}>
            Upload File
          </button>
        </div>

        {mode === 'text' ? (
          <textarea
            className="code-area"
            placeholder="Paste your HTML, text, or any content here..."
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
          />
        ) : (
          <div className={`file-zone ${dragging ? 'dragging' : ''}`} onClick={handlePickFile}>
            {selectedFile ? (
              <div className="file-info">
                <span className="drop-icon">📄</span>
                <div className="file-meta">
                  <strong>{selectedFile.name}</strong>
                  <span className="file-size">{formatSize(selectedFile.size)}</span>
                </div>
                <span className="file-change">Click or drop to change</span>
              </div>
            ) : (
              <div className="file-placeholder">
                <span className="drop-icon">📁</span>
                <p>Click to pick a file or drag &amp; drop anywhere</p>
                <p className="hint">PDF, image, HTML, or any file type</p>
              </div>
            )}
          </div>
        )}
      </div>

      <button className="upload-btn" onClick={handleUpload} disabled={uploading}>
        {uploading ? 'Uploading...' : 'Upload to S3'}
      </button>

      {status && (
        <div className={`status ${status.type}`}>
          <span className="status-msg">{status.message}</span>
          {status.url && (
            <div className="status-url-row">
              <span className="status-url">{status.url}</span>
              <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopyUrl}>
                {copied ? '✓ Copied!' : 'Copy URL'}
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
