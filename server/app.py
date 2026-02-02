import json
import os
import platform
import subprocess
import threading
import time
import uuid
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS
from yt_dlp import YoutubeDL
from yt_dlp.utils import DownloadCancelled

app = Flask(__name__)
CORS(app)

BASE_DIR = Path(__file__).resolve().parent
DOWNLOAD_DIR = BASE_DIR / "downloads"
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

jobs = {}
lock = threading.Lock()


def now_ts():
    return int(time.time() * 1000)


def format_bytes(value):
    if not value:
        return "Unknown"
    units = ["B", "KB", "MB", "GB", "TB"]
    size = float(value)
    idx = 0
    while size >= 1024 and idx < len(units) - 1:
        size /= 1024
        idx += 1
    precision = 0 if size >= 10 else 1
    return f"{size:.{precision}f} {units[idx]}"


def is_playlist(info):
    return info.get("_type") == "playlist" or bool(info.get("entries"))


def extract_entries(info, limit=50):
    entries = info.get("entries") or []
    result = []
    for entry in entries[:limit]:
        if not entry:
            continue
        duration = entry.get("duration")
        result.append({
            "title": entry.get("title") or "Untitled",
            "duration": duration,
        })
    return result


def summarize_formats(formats):
    video_formats = []
    audio_formats = []
    for fmt in formats or []:
        if fmt.get("ext") == "mhtml":
            continue
        entry = {
            "id": fmt.get("format_id"),
            "ext": fmt.get("ext"),
            "filesize": fmt.get("filesize") or fmt.get("filesize_approx"),
            "resolution": fmt.get("resolution") or fmt.get("format_note") or fmt.get("height"),
            "fps": fmt.get("fps"),
            "abr": fmt.get("abr"),
            "vcodec": fmt.get("vcodec"),
            "acodec": fmt.get("acodec"),
            "protocol": fmt.get("protocol")
        }
        if fmt.get("vcodec") != "none":
            video_formats.append(entry)
        elif fmt.get("acodec") != "none":
            audio_formats.append(entry)
    return video_formats, audio_formats


def format_label(entry):
    size = format_bytes(entry.get("filesize"))
    if entry.get("vcodec") and entry.get("vcodec") != "none":
        resolution = entry.get("resolution") or "Source"
        fps = entry.get("fps")
        fps_label = f"{fps}fps" if fps else ""
        return " ".join([str(resolution), fps_label, entry.get("ext") or "", size]).strip()
    abr = entry.get("abr")
    abr_label = f"{int(abr)}kbps" if abr else "Audio"
    return " ".join([abr_label, entry.get("ext") or "", size]).strip()


def build_format_response(formats):
    video_formats, audio_formats = summarize_formats(formats)
    return {
        "video": [
            {
                "id": entry.get("id"),
                "label": format_label(entry),
                "ext": entry.get("ext")
            }
            for entry in video_formats
        ],
        "audio": [
            {
                "id": entry.get("id"),
                "label": format_label(entry),
                "ext": entry.get("ext")
            }
            for entry in audio_formats
        ]
    }


def build_metadata(info):
    playlist = is_playlist(info)
    title = info.get("title") or "Untitled media"
    return {
        "title": title,
        "author": info.get("uploader") or info.get("channel") or info.get("uploader_id") or "Unknown",
        "duration": info.get("duration"),
        "thumbnail": info.get("thumbnail") or "",
        "isPlaylist": playlist,
        "entries": extract_entries(info),
        "entriesCount": info.get("playlist_count") or (len(info.get("entries") or [])),
        "webpageUrl": info.get("webpage_url") or info.get("original_url") or ""
    }


def get_info(url):
    with YoutubeDL({"quiet": True, "skip_download": True, "extract_flat": False}) as ydl:
        return ydl.extract_info(url, download=False)


def create_job(url, options):
    job_id = str(uuid.uuid4())
    job = {
        "id": job_id,
        "url": url,
        "status": "queued",
        "statusLabel": "Queued",
        "progress": 0,
        "speed": 0,
        "eta": 0,
        "createdAt": now_ts(),
        "updatedAt": now_ts(),
        "formatId": options.get("formatId"),
        "formatType": options.get("formatType"),
        "container": options.get("container"),
        "title": options.get("title"),
        "filePath": "",
        "error": "",
        "cancelled": False
    }
    with lock:
        jobs[job_id] = job
    return job


def update_job(job_id, updates):
    with lock:
        job = jobs.get(job_id)
        if not job:
            return None
        job.update(updates)
        job["updatedAt"] = now_ts()
        return job


def download_worker(job_id, url, options):
    update_job(job_id, {"status": "downloading", "statusLabel": "Downloading"})

    def hook(data):
        job = jobs.get(job_id)
        if job and job.get("cancelled"):
            raise DownloadCancelled()
        if data.get("status") == "downloading":
            total = data.get("total_bytes") or data.get("total_bytes_estimate")
            downloaded = data.get("downloaded_bytes", 0)
            progress = (downloaded / total) * 100 if total else min(99, job.get("progress", 0) + 1)
            update_job(job_id, {
                "progress": progress,
                "speed": data.get("speed") or 0,
                "eta": data.get("eta") or 0
            })
        if data.get("status") == "finished":
            update_job(job_id, {"progress": 100})

    audio_only = options.get("formatType") == "audio"
    requested_format = options.get("formatId") or ("bestaudio/best" if audio_only else "bestvideo+bestaudio/best")
    outtmpl = str(DOWNLOAD_DIR / "%(title).200s.%(ext)s")
    ydl_opts = {
        "format": requested_format,
        "outtmpl": outtmpl,
        "progress_hooks": [hook],
        "noplaylist": False,
        "merge_output_format": options.get("container") if not audio_only else None
    }
    if audio_only:
        ydl_opts["postprocessors"] = [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": options.get("container") or "mp3",
            "preferredquality": "0"
        }]
    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            file_path = ydl.prepare_filename(info)
            if audio_only:
                ext = options.get("container") or "mp3"
                file_path = str(Path(file_path).with_suffix(f".{ext}"))
            update_job(job_id, {
                "status": "completed",
                "statusLabel": "Completed",
                "filePath": file_path
            })
    except DownloadCancelled:
        update_job(job_id, {"status": "cancelled", "statusLabel": "Cancelled"})
    except Exception as exc:
        update_job(job_id, {
            "status": "failed",
            "statusLabel": "Failed",
            "error": str(exc)
        })


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "timestamp": now_ts()})


@app.post("/api/inspect")
def inspect_media():
    payload = request.get_json(silent=True) or {}
    url = payload.get("url")
    if not url:
        return jsonify({"error": "Missing URL"}), 400
    try:
        info = get_info(url)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400
    formats = info.get("formats") or []
    if is_playlist(info):
        for entry in info.get("entries") or []:
            if entry and entry.get("formats"):
                formats = entry.get("formats")
                break
    return jsonify({
        "metadata": build_metadata(info),
        "formats": build_format_response(formats)
    })


@app.post("/api/download")
def start_download():
    payload = request.get_json(silent=True) or {}
    url = payload.get("url")
    if not url:
        return jsonify({"error": "Missing URL"}), 400
    job = create_job(url, payload)
    thread = threading.Thread(target=download_worker, args=(job["id"], url, payload), daemon=True)
    thread.start()
    return jsonify({"jobId": job["id"]})


@app.get("/api/status/<job_id>")
def download_status(job_id):
    job = jobs.get(job_id)
    if not job:
        return jsonify({"error": "Not found"}), 404
    return jsonify(job)


@app.post("/api/cancel")
def cancel_download():
    payload = request.get_json(silent=True) or {}
    job_id = payload.get("jobId")
    job = jobs.get(job_id)
    if not job:
        return jsonify({"error": "Not found"}), 404
    update_job(job_id, {"cancelled": True})
    return jsonify({"status": "ok"})


@app.post("/api/reveal")
def reveal_path():
    payload = request.get_json(silent=True) or {}
    path = payload.get("path")
    if not path:
        return jsonify({"error": "Missing path"}), 400
    target = Path(path)
    if not target.exists():
        return jsonify({"error": "File not found"}), 404
    system = platform.system().lower()
    if system == "windows":
        subprocess.Popen(["explorer", "/select,", str(target)])
    elif system == "darwin":
        subprocess.Popen(["open", "-R", str(target)])
    else:
        subprocess.Popen(["xdg-open", str(target.parent)])
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    port = int(os.environ.get("YDRT_PORT", "5178"))
    app.run(host="0.0.0.0", port=port)
