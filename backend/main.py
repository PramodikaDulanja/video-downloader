from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yt_dlp
import requests
from fastapi.responses import StreamingResponse


# Create the FastAPI app
app = FastAPI()

# Enable CORS so our frontend can talk to our backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define what data we expect from the user


class VideoRequest(BaseModel):
    url: str


@app.get("/api/download")
def download_stream(url: str, filename: str = "video.mp4"):
    # Streams raw video chunks straight to the user without storing on your disk
    req = requests.get(url, stream=True)
    return StreamingResponse(
        req.iter_content(chunk_size=1024 * 1024),
        media_type="video/mp4",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@app.post("/api/get-link")
def get_video_link(request: VideoRequest):
    # Configure yt-dlp to find the best single combined file (video+audio)
    ydl_opts = {
        'format': 'best',
        'quiet': True
    }

    try:
        # Extract the information without downloading the file to your server
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(request.url, download=False)

            return {
                "title": info.get('title', 'Unknown Title'),
                "thumbnail": info.get('thumbnail', ''),
                "direct_url": info.get('url')  # The raw stream link
            }
    except Exception as e:
        # If it fails (invalid URL, private video, etc.)
        raise HTTPException(status_code=400, detail=str(e))
