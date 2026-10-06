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
    """Fetches video metadata, maps standard resolutions, and estimates file sizes."""
    ydl_opts = dict(BASE_YDL_OPTS)

    # Helper function to round weird heights to standard UI buckets
    def snap_resolution(h):
        if h >= 2000:
            return 2160  # 4K
        if h >= 1400:
            return 1440  # 2K
        if h >= 1000:
            return 1080  # FHD (Catches 906p)
        if h >= 700:
            return 720   # HD  (Catches 680p)
        if h >= 470:
            return 480   # SD
        if h >= 350:
            return 360   # SD
        return h

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(request.url, download=False)
            formats = info.get('formats', [])
            duration = info.get('duration', 0)  # Video length in seconds

            # 1. Find the best audio size (Calculate it if hidden)
            audio_formats = [f for f in formats if f.get(
                'vcodec') == 'none' and f.get('acodec') != 'none']
            best_audio_size = 0
            for af in audio_formats:
                a_size = af.get('filesize') or af.get('filesize_approx')
                # If size is hidden, estimate it: (bitrate kbps * 1000 / 8) * seconds
                if not a_size and af.get('tbr') and duration:
                    a_size = (af.get('tbr') * 1000 / 8) * duration
                if a_size and a_size > best_audio_size:
                    best_audio_size = a_size

            # 2. Map resolutions and calculate total sizes
            res_map = {}
            for f in formats:
                raw_height = f.get('height')
                if raw_height and raw_height >= 144:
                    # Clean up the resolution for the UI
                    clean_height = snap_resolution(raw_height)

                    v_size = f.get('filesize') or f.get('filesize_approx')
                    # Estimate video size if hidden
                    if not v_size and f.get('tbr') and duration:
                        v_size = (f.get('tbr') * 1000 / 8) * duration
                    v_size = v_size or 0

                    # Add audio size if this stream is video-only
                    total_size = (
                        v_size + best_audio_size) if f.get('acodec') == 'none' else v_size

                    # Keep the highest file size (best quality) for this resolution bucket
                    if clean_height not in res_map or total_size > res_map[clean_height]:
                        res_map[clean_height] = total_size

            # 3. Format the data for the React frontend
            resolutions = []
            for height in sorted(res_map.keys(), reverse=True):
                size_b = res_map[height]
                if size_b > 0:
                    mb = size_b / (1024 * 1024)
                    # Added ~ to indicate it might be an estimate
                    size_str = f"~{mb:.1f} MB"
                else:
                    size_str = "Size Hidden"

                resolutions.append({
                    "resolution": height,
                    "sizeLabel": size_str
                })

            return {
                "title": info.get('title', 'Unknown Title'),
                "thumbnail": info.get('thumbnail', ''),
                "direct_url": request.url,
                "resolutions": resolutions
            }

    except DownloadError as e:
        error_msg = str(e).lower()
        if "private" in error_msg:
            client_msg = "Video is private."
        elif "sign in" in error_msg:
            client_msg = "Video requires login."
        else:
            client_msg = "Platform blocked the request."
        raise HTTPException(status_code=400, detail=client_msg)
    except Exception:
        raise HTTPException(
            status_code=500, detail="Unexpected error parsing video.")


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
