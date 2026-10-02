import { useState } from 'react'
import { DownloadCloud, Loader2, AlertCircle } from 'lucide-react'
import './App.css'

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFetchVideo = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Calling your Python FastAPI server
      const response = await fetch('http://localhost:8000/api/get-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to fetch video information');
      }

      setResult(data);
    } catch (err) {
      setError(err.message || 'Make sure your Python backend is running!');
    } finally {
      setLoading(false);
    }
  };

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
          {loading ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            'Process'
          )}
        </button>
      </form>

      {error && (
        <div className="error-message">
          <AlertCircle size={20} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
          {error}
        </div>
      )}

      {result && (
        <div className="result-card">
          {result.thumbnail && (
            <img src={result.thumbnail} alt="Video Thumbnail" className="thumbnail" />
          )}
          <h3 className="video-title">{result.title}</h3>
          
          <a href={result.direct_url} target="_blank" rel="noopener noreferrer" className="download-link">
            <DownloadCloud size={20} />
            Download Video
          </a>
        </div>
      )}
    </div>
  )
}

export default App