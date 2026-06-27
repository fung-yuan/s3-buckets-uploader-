import { useState, useEffect } from 'react'
import UploadTab from './UploadTab'
import AutomateTab from './AutomateTab'

export default function App() {
  const [tab, setTab] = useState('upload')
  const [settings, setSettings] = useState({})

  useEffect(() => {
    window.electron.loadSettings().then((s) => setSettings(s || {}))
  }, [])

  const saveSettings = (updates) => {
    const next = { ...settings, ...updates }
    setSettings(next)
    window.electron.saveSettings(next)
  }

  return (
    <div className="app">
      <header>
        <span className="logo">S3 Uploader</span>
        <nav>
          <button className={`nav-btn ${tab === 'upload' ? 'active' : ''}`} onClick={() => setTab('upload')}>
            Upload
          </button>
          <button className={`nav-btn ${tab === 'automate' ? 'active' : ''}`} onClick={() => setTab('automate')}>
            Automate
          </button>
        </nav>
      </header>

      {tab === 'upload' ? (
        <UploadTab settings={settings} saveSettings={saveSettings} />
      ) : (
        <AutomateTab settings={settings} saveSettings={saveSettings} />
      )}
    </div>
  )
}
