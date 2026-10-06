import { useState } from 'react'
import {
  DownloadCloud,
  Loader2,
  AlertCircle,
  ClipboardPaste,
  X,
  Film,
  Sparkles,
} from 'lucide-react'
import './App.css'

function App() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  
  // This state holds the integer resolution (e.g., 1080, 720)
  const [selectedQuality, setSelectedQuality] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setUrl(text.trim())
    } catch {
      // Clipboard access denied or unsupported in browser
    }
  }

  const handleReset = () => {
    setUrl('')
    setResult(null)
    setError(null)
    setSelectedQuality('')
  }

  const handleFetchVideo = async (e) => {
    e.preventDefault()
    if (!url.trim()) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('http://localhost:8000/api/get-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Unable to fetch video information.')
      }

      setResult(data)
      // The backend now returns an array of objects: [{resolution: 1080, sizeLabel: "45.2 MB"}, ...]
      if (data.resolutions && data.resolutions.length > 0) {
        setSelectedQuality(data.resolutions[0].resolution)
      }
    } catch (err) {
      setError(err.message || 'Make sure your Python backend is running.')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    if (!result || !selectedQuality) return
    setIsDownloading(true)
    setError(null)

    try {
      const downloadUrl = `http://localhost:8000/api/download?url=${encodeURIComponent(
        result.direct_url
      )}&title=${encodeURIComponent(result.title)}&resolution=${selectedQuality}`

      const response = await fetch(downloadUrl)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Server encountered an error while merging streams.')
      }

      const blob = await response.blob()
      const localUrl = window.URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = localUrl
      const cleanTitle = result.title.replace(/[^a-zA-Z0-9 -]/g, '').trim() || 'video'
      a.download = `${cleanTitle}_${selectedQuality}p.mp4`
      document.body.appendChild(a)
      a.click()

      a.remove()
      window.URL.revokeObjectURL(localUrl)
    } catch (err) {
      setError(err.message || 'An error occurred during download.')
    } finally {
      setIsDownloading(false)
    }
  }

  const getBadgeLabel = (res) => {
    const num = Number(res)
    if (num >= 2160) return '4K'
    if (num >= 1440) return '2K'
    if (num >= 1080) return 'FHD'
    if (num >= 720) return 'HD'
    return 'SD'
  }

  return (
    <div className="page-wrapper">
      <main className="container">
        {/* Header Section */}
        <header className="header">
          <div className="badge-chip">
            <Sparkles size={14} className="sparkle-icon" /> Fast & Free
          </div>
          <h1>Universal Media Downloader</h1>
          <p>Extract high-definition video directly to your device without ads or watermarks.</p>
        </header>

        {/* Search / Input Box */}
        <div className="card input-card">
          <form onSubmit={handleFetchVideo} className="search-form">
            <div className="input-group">
              <Film size={18} className="input-icon" />
              <input
                type="url"
                placeholder="Paste video link from YouTube, Instagram, TikTok..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading || isDownloading}
                required
              />
              {url ? (
                <button
                  type="button"
                  className="icon-action-btn"
                  onClick={handleReset}
                  title="Clear link"
                >
                  <X size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  className="icon-action-btn"
                  onClick={handlePaste}
                  title="Paste from clipboard"
                >
                  <ClipboardPaste size={16} />
                </button>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || isDownloading || !url}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  <span>Fetching...</span>
                </>
              ) : (
                <span>Fetch Media</span>
              )}
            </button>
          </form>

          {/* Supported Platforms Tag Row */}
          <div className="platform-hints">
            <span>Supports:</span>
            <span className="pill">YouTube</span>
            <span className="pill">Instagram</span>
            <span className="pill">TikTok</span>
            <span className="pill">Facebook</span>
            <span className="pill">Twitter / X</span>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="alert alert-error">
            <AlertCircle size={20} className="alert-icon" />
            <div className="alert-content">{error}</div>
            <button className="alert-close" onClick={() => setError(null)}>
              <X size={16} />
            </button>
          </div>
        )}

        {/* Result & Actions Card */}
        {result && (
          <div className="card result-card">
            <div className="media-preview">
              {result.thumbnail ? (
                <div className="thumbnail-wrapper">
                  <img src={result.thumbnail} alt={result.title} />
                  <span className="quality-indicator-tag">
                    {getBadgeLabel(selectedQuality)} {selectedQuality}p
                  </span>
                </div>
              ) : (
                <div className="thumbnail-placeholder">
                  <Film size={40} />
                </div>
              )}

              <div className="media-details">
                <h2 className="media-title" title={result.title}>
                  {result.title}
                </h2>

                {/* Resolution Pill Selector with File Sizes */}
                {result.resolutions && result.resolutions.length > 0 && (
                  <div className="quality-selector-group">
                    <label>Select Resolution</label>
                    <div className="quality-pills">
                      {result.resolutions.map((resObj) => (
                        <button
                          key={resObj.resolution}
                          type="button"
                          className={`quality-pill ${selectedQuality === resObj.resolution ? 'active' : ''}`}
                          onClick={() => setSelectedQuality(resObj.resolution)}
                          disabled={isDownloading}
                        >
                          <div className="pill-main-row">
                            <span className="res-value">{resObj.resolution}p</span>
                            <span className="res-badge">{getBadgeLabel(resObj.resolution)}</span>
                          </div>
                          {/* Here is the file size rendered under the resolution */}
                          <div className="res-size">{resObj.sizeLabel}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Download Actions & Progress */}
                <div className="action-area">
                  {isDownloading ? (
                    <div className="downloading-state">
                      <div className="status-header">
                        <span className="status-label">
                          <Loader2 className="animate-spin" size={16} /> Processing & Merging...
                        </span>
                        <span className="status-note">Please do not close this window</span>
                      </div>
                      <div className="progress-track">
                        <div className="progress-bar-fill" />
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="btn btn-success btn-lg"
                      disabled={!selectedQuality}
                    >
                      <DownloadCloud size={20} />
                      Download {selectedQuality}p MP4
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App