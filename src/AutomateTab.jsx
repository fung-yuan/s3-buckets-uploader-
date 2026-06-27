import { useState, useEffect, useRef } from 'react'

const DEFAULT_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{keyword}</title>
  <meta name="description" content="Complete guide about {keyword}">
</head>
<body>
  <h1>{keyword}</h1>
  <p>This page covers everything about {keyword}.</p>
</body>
</html>`

export default function AutomateTab({ settings, saveSettings }) {
  const [bucketUrl, setBucketUrl] = useState('')
  const [slugPattern, setSlugPattern] = useState('{keyword}-{random}.html')
  const [templateHtml, setTemplateHtml] = useState(DEFAULT_TEMPLATE)
  const [keywords, setKeywords] = useState('nail guide\nnail art\nacrylic nails')
  const [count, setCount] = useState(5)
  const [intervalMin, setIntervalMin] = useState(60)
  const [running, setRunning] = useState(false)
  const [log, setLog] = useState([])
  const logRef = useRef(null)

  const [connStatus, setConnStatus] = useState(null)
  const [testing, setTesting] = useState(false)

  const [redirectEnabled, setRedirectEnabled] = useState(false)
  const [redirectUrl, setRedirectUrl] = useState('')
  const [redirectDelay, setRedirectDelay] = useState(0)

  useEffect(() => {
    if (settings.bucketUrl) setBucketUrl(settings.bucketUrl)
  }, [settings.bucketUrl])

  useEffect(() => {
    window.electron.onAutomationProgress((data) => {
      setLog((prev) => [...prev, { ...data, type: 'progress' }])
    })
    window.electron.onAutomationDone((data) => {
      setRunning(false)
      setLog((prev) => [...prev, { type: 'done', total: data.total }])
    })
    return () => window.electron.removeAutomationListeners()
  }, [])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])

  const kwList = keywords.split('\n').filter((k) => k.trim())
  const firstKw = kwList[0]?.trim() || 'example'

  const previewSlug = slugPattern
    .replace('{keyword}', firstKw.toLowerCase().replace(/\s+/g, '-'))
    .replace('{random}', 'ab3x7z')

  const estimatedDuration = () => {
    const n = parseInt(count) || 1
    const mins = (parseFloat(intervalMin) || 1) * (n - 1)
    if (mins < 60) return `~${Math.round(mins)} min`
    return `~${(mins / 60).toFixed(1)} hrs`
  }

  const handleTestConnection = async () => {
    if (!bucketUrl) return
    setTesting(true)
    setConnStatus(null)
    const result = await window.electron.testConnection(bucketUrl)
    setConnStatus(result)
    setTesting(false)
  }

  const handleStart = async () => {
    if (!bucketUrl) return
    setLog([])
    setRunning(true)

    const redirect = redirectEnabled && redirectUrl
      ? { enabled: true, url: redirectUrl, delay: redirectDelay }
      : { enabled: false }

    const result = await window.electron.startAutomation({
      bucketUrl,
      slugPattern,
      templateHtml,
      keywords: kwList,
      count: parseInt(count) || 1,
      intervalMin: parseFloat(intervalMin) || 1,
      redirect,
    })
    if (result?.error) {
      setRunning(false)
      setLog([{ type: 'error', message: result.error }])
    }
  }

  const handleStop = async () => {
    await window.electron.stopAutomation()
    setRunning(false)
    setLog((prev) => [...prev, { type: 'stopped' }])
  }

  const copyUrl = (url) => window.electron.copyToClipboard(url)

  const connOk = connStatus?.reachable && connStatus?.writable
  const connWarn = connStatus?.reachable && !connStatus?.writable

  return (
    <main className="tab-content auto-tab">
      <div className="auto-layout">

        {/* LEFT — config */}
        <div className="auto-left">
          <div className="card">
            <div className="field-row">
              <div className="field grow">
                <label>BUCKET URL</label>
                <input
                  type="text"
                  placeholder="https://your-bucket.s3.amazonaws.com"
                  value={bucketUrl}
                  onChange={(e) => { setBucketUrl(e.target.value); setConnStatus(null) }}
                />
              </div>
              <div className="field-btn-wrap">
                <button className="test-btn" onClick={handleTestConnection} disabled={!bucketUrl || testing}>
                  {testing ? 'Testing…' : 'Test ↗'}
                </button>
              </div>
            </div>

            {connStatus && (
              <div className={`conn-status ${connOk ? 'ok' : connWarn ? 'warn' : 'bad'}`}>
                {connStatus.reachable
                  ? connStatus.writable
                    ? '✓ Reachable · ✓ Writable'
                    : `✓ Reachable · ✗ ${connStatus.error || 'Not writable'}`
                  : `✗ ${connStatus.error || 'Cannot reach bucket'}`
                }
              </div>
            )}

            <div className="field" style={{ marginTop: '12px' }}>
              <label>SLUG PATTERN</label>
              <input
                type="text"
                value={slugPattern}
                onChange={(e) => setSlugPattern(e.target.value)}
              />
              <span className="hint">
                Variables: <code>{'{keyword}'}</code> <code>{'{random}'}</code>
              </span>
              {bucketUrl && (
                <div className="preview-slug">
                  {bucketUrl.replace(/\/$/, '')}/{previewSlug}
                </div>
              )}
            </div>

            <div className="field">
              <label>KEYWORDS <span className="sub-label">(one per line)</span></label>
              <textarea
                className="keywords-area"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                rows={5}
                placeholder="nail guide&#10;nail art&#10;acrylic nails"
              />
            </div>

            <div className="field-row">
              <div className="field grow">
                <label>NUMBER OF UPLOADS</label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                />
              </div>
              <div className="field grow">
                <label>INTERVAL (minutes)</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={intervalMin}
                  onChange={(e) => setIntervalMin(e.target.value)}
                />
              </div>
            </div>

            {parseInt(count) > 1 && (
              <div className="duration-hint">
                Total duration: <strong>{estimatedDuration()}</strong> — keep the app open while running
              </div>
            )}
          </div>

          <div className="card">
            <div className="field">
              <label>HTML TEMPLATE</label>
              <textarea
                className="code-area template-area"
                value={templateHtml}
                onChange={(e) => setTemplateHtml(e.target.value)}
              />
              <span className="hint">
                Variables: <code>{'{keyword}'}</code> <code>{'{random}'}</code> — replaced on each upload
              </span>
            </div>
          </div>

          <div className={`card redirect-card ${redirectEnabled ? 'redirect-active' : ''}`}>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={redirectEnabled}
                onChange={(e) => setRedirectEnabled(e.target.checked)}
              />
              <span className="toggle-text">Inject redirect into each upload</span>
            </label>

            {redirectEnabled && (
              <div className="redirect-body">
                <div className="field">
                  <label>REDIRECT TO</label>
                  <input
                    type="text"
                    placeholder="https://example.com"
                    value={redirectUrl}
                    onChange={(e) => setRedirectUrl(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>TIMING</label>
                  <div className="timing-row">
                    <label className="radio-opt">
                      <input
                        type="radio"
                        name="auto-rt"
                        checked={redirectDelay === 0}
                        onChange={() => setRedirectDelay(0)}
                      />
                      Instant
                    </label>
                    <label className="radio-opt">
                      <input
                        type="radio"
                        name="auto-rt"
                        checked={redirectDelay > 0}
                        onChange={() => setRedirectDelay((prev) => prev || 3)}
                      />
                      After
                    </label>
                    {redirectDelay > 0 && (
                      <>
                        <input
                          type="number"
                          className="delay-num"
                          min="1"
                          max="60"
                          value={redirectDelay}
                          onChange={(e) => setRedirectDelay(Math.max(1, parseInt(e.target.value) || 1))}
                        />
                        <span className="delay-unit">seconds</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — log + controls */}
        <div className="auto-right">
          <div className="card log-card">
            <div className="log-header">
              <span>Activity Log</span>
              {log.length > 0 && (
                <button className="clear-btn" onClick={() => setLog([])}>Clear</button>
              )}
            </div>

            <div className="log-body" ref={logRef}>
              {log.length === 0 && (
                <p className="log-empty">Uploads will appear here in real time…</p>
              )}
              {log.map((entry, i) => (
                <div key={i} className={`log-entry ${entry.type === 'progress' && !entry.success ? 'fail' : entry.type}`}>
                  {entry.type === 'progress' && (
                    <>
                      <div className="log-meta">
                        <span className={`log-badge ${entry.success ? 'ok' : 'fail'}`}>
                          {entry.success ? '✓' : '✗'}
                        </span>
                        <span className="log-count">{entry.index}/{entry.total}</span>
                        {entry.keyword && <span className="log-kw">{entry.keyword}</span>}
                        {!entry.success && <span className="log-err-msg">{entry.error || `HTTP ${entry.status}`}</span>}
                      </div>
                      <div className="log-url-row">
                        <span className="log-url">{entry.url}</span>
                        <button className="copy-small" onClick={() => copyUrl(entry.url)}>Copy</button>
                      </div>
                    </>
                  )}
                  {entry.type === 'done' && (
                    <span className="log-done">✓ All {entry.total} uploads complete</span>
                  )}
                  {entry.type === 'stopped' && (
                    <span className="log-stopped">⏹ Automation stopped</span>
                  )}
                  {entry.type === 'error' && (
                    <span className="log-err-msg">✗ {entry.message}</span>
                  )}
                </div>
              ))}
            </div>

            <div className="log-footer">
              {!running ? (
                <button
                  className="start-btn"
                  onClick={handleStart}
                  disabled={!bucketUrl || !slugPattern}
                >
                  ▶ Start Automation
                </button>
              ) : (
                <div className="running-row">
                  <span className="pulse-dot" />
                  <span className="running-label">Running…</span>
                  <button className="stop-btn" onClick={handleStop}>Stop</button>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </main>
  )
}
