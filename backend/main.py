import os
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import yt_dlp
from yt_dlp.utils import DownloadError

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class VideoRequest(BaseModel):
    url: str


def remove_file(path: str):
    if os.path.exists(path):
        try:
            os.remove(path)
        except OSError:
            pass


# Reusable baseline options to minimize bot detection and scraping blocks
BASE_YDL_OPTS = {
    'quiet': True,
    'no_warnings': True,
    # Spoof mobile clients to bypass web bot-verification barriers on YouTube
    'extractor_args': {
        'youtube': {
            'player_client': ['android', 'ios']
        }
    },
    # Mimic standard browser request headers
    'http_headers': {
        'User-Agent': (
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
            'AppleWebKit/537.36 (KHTML, like Gecko) '
            'Chrome/124.0.0.0 Safari/537.36'
        ),
        'Accept-Language': 'en-US,en;q=0.9',
    },
}

# Automatically use cookies.txt if you place one in the backend directory
if os.path.exists("cookies.txt"):
    BASE_YDL_OPTS['cookiefile'] = "cookies.txt"


@app.post("/api/get-info")
def get_video_info(request: VideoRequest):
    ydl_opts = dict(BASE_YDL_OPTS)

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(request.url, download=False)

            # Extract distinct video heights
            resolutions = set()
            for f in info.get('formats', []):
                height = f.get('height')
                if height and height >= 144:
                    resolutions.add(height)

            # Sort descending: 4K (2160) -> 1080 -> 720 ...
            sorted_resolutions = sorted(list(resolutions), reverse=True)

            return {
                "title": info.get('title', 'Unknown Title'),
                "thumbnail": info.get('thumbnail', ''),
                "direct_url": request.url,
                "resolutions": sorted_resolutions
            }

    except DownloadError as e:
        error_msg = str(e).lower()
        if "private video" in error_msg:
            client_msg = "This video is private. Access is restricted."
        elif "sign in" in error_msg or "login" in error_msg:
            client_msg = "This video requires login. Provide a valid cookies.txt file."
        elif "geo restricted" in error_msg or "country" in error_msg:
            client_msg = "This video is unavailable in the server's region."
        elif "format" in error_msg:
            client_msg = "No suitable stream formats could be extracted for this video."
        else:
            client_msg = "The platform blocked the request or the URL is invalid."

        raise HTTPException(status_code=400, detail=client_msg)

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while parsing the video."
        )


@app.get("/api/download")
def download_stream(url: str, title: str, resolution: int, background_tasks: BackgroundTasks):
    safe_title = "".join(x for x in title if x.isalnum() or x in " -_").strip()
    filename = f"{safe_title}_{resolution}p.mp4"

    # Merge custom format rules with the anti-blocking base options
    ydl_opts = dict(BASE_YDL_OPTS)
    ydl_opts.update({
        'format': (
            f"bestvideo[height<={resolution}][ext=mp4]+bestaudio[ext=m4a]/"
            f"bestvideo[height<={resolution}]+bestaudio/"
            f"best[height<={resolution}]/best"
        ),
        'merge_output_format': 'mp4',
        'outtmpl': filename,
    })

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        # Ensure the file was generated before serving
        if not os.path.exists(filename):
            raise HTTPException(
                status_code=500,
                detail="Processing failed: Output file was not created."
            )

        # Remove the temporary video once transmitted to the client
        background_tasks.add_task(remove_file, filename)

        return FileResponse(
            path=filename,
            filename=filename,
            media_type="video/mp4"
        )

    except DownloadError as e:
        remove_file(filename)
        error_msg = str(e).lower()
        if "sign in" in error_msg or "bot" in error_msg:
            detail = "Download blocked by platform bot detection. Try passing cookies or a proxy."
        else:
            detail = "Failed to download stream due to platform restrictions."
        raise HTTPException(status_code=400, detail=detail)

    except Exception:
        remove_file(filename)
        raise HTTPException(
            status_code=500,
            detail="Failed to complete video processing."
        )
