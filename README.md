# Universal Video Downloader 📥

A full-stack web application that allows users to extract and download high-quality videos directly from platforms like YouTube, Instagram, TikTok, and more.

Instead of relying on third-party, ad-heavy websites, this project provides a clean, modern interface to safely fetch direct media streams to your local device.

## ✨ Features

- **Multi-Platform Support:** Works with 1,000+ websites natively.
- **Direct File Downloads:** Streams the video directly to the user's local disk as an MP4.
- **Modern UI:** Clean, responsive, and professional React frontend.
- **High Performance:** Powered by FastAPI for rapid, asynchronous request handling.

## 🛠️ Tech Stack

- **Frontend:** React, Vite, Lucide-React (Icons)
- **Backend:** Python, FastAPI, Uvicorn
- **Core Engine:** `yt-dlp`

## 🚀 Quick Start (Local Development)

### 1. Start the Backend

Open a terminal and run the following commands:

```bash
cd backend
python -m venv venv
venv\Scripts\activate      # On Mac/Linux use: source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```
