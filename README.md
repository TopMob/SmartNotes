YouDoRuTo

A polished, privacy-first personal media downloader for direct video and audio links. Designed for modern browsers with a clean, responsive interface and local-only storage.

Core highlights:
- URL-first workflow for downloading videos, audio, or playlists
- Detailed media panel with metadata, format selection, and download progress
- Recent downloads history with favorites and quick actions
- Configurable defaults for format, container, quality, save location, concurrency, and UI theme
- Local helper service powered by yt-dlp for platform-safe downloads

Local helper service
1. Install dependencies:
   - Python 3.10+
   - ffmpeg
   - `pip install -r server/requirements.txt`
2. Start the helper:
   - `python server/app.py`
3. Open `index.html` or serve the frontend; the app will connect to `http://localhost:5178` by default.
