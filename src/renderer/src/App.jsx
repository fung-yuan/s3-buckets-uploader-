import { useState } from 'react'

const CONTENT_TYPES = [
  { label: 'HTML', value: 'text/html', ext: ['html', 'htm'] },
  { label: 'PDF', value: 'application/pdf', ext: ['pdf'] },
  { label: 'Plain Text', value: 'text/plain', ext: ['txt'] },
  { label: 'JSON', value: 'application/json', ext: ['json'] },
  { label: 'JPEG Image', value: 'image/jpeg', ext: ['jpg', 'jpeg'] },
  { label: 'PNG Image', value: 'image/png', ext: ['png'] },
  { label: 'WebP Image', value: 'image/webp', ext: ['webp'] },
  { label: 'GIF Image', value: 'image/gif', ext: ['gif'] },
  { label: 'SVG', value: 'image/svg+xml', ext: ['svg'] },
  { label: 'CSS', value: 'text/css', ext: ['css'] },
  { label: 'JavaScript', value: 'application/javascript', ext: ['js'] },
  { label: 'XML', value: 'application/xml', ext: ['xml'] },
]

function guessContentType(filename) {
  const ext = filename.split('.').pop().toLowerCase()
  const match = CONTENT_TYPES.find(ct => ct.ext.includes(ext))
  return match ? match.value : 'application/octet-stream'
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export default function App() {
  const [bucketUrl, setBucketUrl] = useState('')
  const [filePath, setFilePath] = useState('')
  const [contentType, setContentType] = useState('text/html')
  const [mode, setMode] = useState('text')
  const [textContent, setTextContent] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [status, setStatus] = useState(null)
  const [uploading, setUploading] = useState(false)

  const fullUrl = () => {
    const base = bucketUrl.replace(/\/$/, '')
    const path = filePath.replace(/^\//, '')
    return base && path ? `${base}/${path}` : ''
  }

  const handlePickFile = async () => {
    const file = await window.electron.openFileDialog()
    if (!file) return
    setSelectedFile(file)
    if (!filePath) setFilePath(file.name)
    setContentType(guessContentType(file.name))
  }

  const handleUpload = async () => {
    const url = fullUrl()
    if (!url) {
      setStatus({ type: 'error', message: 'Bucket URL and file path are both required.' })
      return
    }
    if (mode === 'text' && !textContent.trim()) {
      setStatus({ type: 'error', message: 'Content area is empty.' })
      return
    }
    if (mode === 'file' && !selectedFile) {
      setStatus({ type: 'error', message: 'No file selected.' })
      return
    }

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
      setStatus({ type: 'success', message: `Uploaded! Public URL:\n${url}` })
    } else {
      const detail = result.error || `HTTP ${result.status}${result.body ? ': ' + result.body : ''}`
      setStatus({ type: 'error', message: `Upload failed — ${detail}` })
    }
  }

  return (
    <div className="app">
      <header>
        <span className="logo">S3 Uploader</span>
      </header>

      <main>
        <div className="card">
          <div className="form-group">
            <label>Bucket URL</label>
            <input
              type="text"
              placeholder="https://your-bucket.s3.amazonaws.com"
              value={bucketUrl}
              onChange={e => setBucketUrl(e.target.value)}
            />
          </div>

          <div className="form-row">
            <div className="form-group grow">
              <label>File Path (key)</label>
              <input
                type="text"
                placeholder="folder/my-file.html"
                value={filePath}
                onChange={e => setFilePath(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Content Type</label>
              <select value={contentType} onChange={e => setContentType(e.target.value)}>
                {CONTENT_TYPES.map(ct => (
                  <option key={ct.value} value={ct.value}>{ct.label}</option>
                ))}
              </select>
            </div>
          </div>

          {fullUrl() && (
            <div className="url-preview">
              <span className="url-label">Full URL →</span>
              <span className="url-text">{fullUrl()}</span>
            </div>
          )}
        </div>

        <div className="card">
          <div className="mode-tabs">
            <button className={mode === 'text' ? 'tab active' : 'tab'} onClick={() => setMode('text')}>
              Paste HTML / Text
            </button>
            <button className={mode === 'file' ? 'tab active' : 'tab'} onClick={() => setMode('file')}>
              Upload File
            </button>
          </div>

          {mode === 'text' ? (
            <textarea
              placeholder="Paste your HTML, text, JSON, or any content here..."
              value={textContent}
              onChange={e => setTextContent(e.target.value)}
            />
          ) : (
            <div className="file-zone" onClick={handlePickFile}>
              {selectedFile ? (
                <div className="file-info">
                  <div className="file-icon">📄</div>
                  <div>
                    <strong>{selectedFile.name}</strong>
                    <span className="file-size">{formatSize(selectedFile.size)}</span>
                  </div>
                  <span className="file-change">Click to change</span>
                </div>
              ) : (
                <div className="file-placeholder">
                  <div className="file-icon">📁</div>
                  <p>Click to pick a file</p>
                  <p className="hint">PDF, image, HTML, or any file type</p>
                </div>
              )}
            </div>
          )}
        </div>

        <button className="upload-btn" onClick={handleUpload} disabled={uploading}>
          {uploading ? (
            <span>Uploading<span className="dots">...</span></span>
          ) : (
            'Upload to S3'
          )}
        </button>

        {status && (
          <div className={`status ${status.type}`}>
            {status.message.split('\n').map((line, i) => (
              <span key={i}>{line}{i < status.message.split('\n').length - 1 && <br />}</span>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
