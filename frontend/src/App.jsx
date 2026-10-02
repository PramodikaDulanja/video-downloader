import { useState } from 'react'
import { DownloadCloud, Loader2, AlertCircle } from 'lucide-react'
import './App.css'

function App() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [selectedQuality, setSelectedQuality] = useState('')

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
        throw new Error(data.detail || 'Failed to fetch video info')
      }

      setResult(data)
      if (data.resolutions && data.resolutions.length > 0) {
        setSelectedQuality(data.resolutions[0])
      }
    } catch (err) {
      setError(err.message || 'Make sure your Python backend is running!')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-container">
      <header className="header">
        <h1>Universal Downloader</h1>
        <p>Download high-quality videos from any platform</p>
      </header>

      <form onSubmit={handleFetchVideo} className="search-box">
        <input
          type="text"
          placeholder="Paste video URL here (YouTube, TikTok, Instagram)..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={loading}
        />
        <button type="submit" className="btn-primary" disabled={loading || !url}>
          {loading ? <Loader2 className="animate-spin" size={20} /> : 'Process'}
        </button>
      </form>

      {error && (
        <div className="error-message">
          <AlertCircle
            size={20}
            style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }}
          />
          {error}
        </div>
      )}

      {result && (
        <div className="result-card">
          {result.thumbnail && (
            <img src={result.thumbnail} alt="Thumbnail" className="thumbnail" />
          )}
          <h3 className="video-title">{result.title}</h3>

          {result.resolutions && result.resolutions.length > 0 && (
            <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
              <label style={{ fontWeight: 'bold', marginRight: '10px' }}>
                Select Quality:
              </label>
              <select
                value={selectedQuality}
                onChange={(e) => setSelectedQuality(e.target.value)}
                style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }}
              >
                {result.resolutions.map((res) => (
                  <option key={res} value={res}>
                    {res}p {res >= 1080 ? '(HD)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <a
            href={`http://localhost:8000/api/download?url=${encodeURIComponent(result.direct_url)}&title=${encodeURIComponent(result.title)}&resolution=${selectedQuality}`}
            className="download-link"
          >
            <DownloadCloud size={20} />
            Download {selectedQuality}p Video
          </a>
        </div>
      )}
    </div>
  )
}

export default App