const qs = (selector, parent = document) => parent.querySelector(selector);
const qsa = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));

const defaultSettings = {
    format: "video",
    container: "mp4",
    quality: "auto",
    location: "Downloads",
    concurrent: 2,
    theme: "dark",
    language: "en",
    accessibility: "system"
};

const state = {
    media: null,
    downloads: [],
    settings: { ...defaultSettings },
    activeControllers: new Map(),
    rating: 0,
    view: "home"
};

const elements = {
    sidebar: qs("#sidebar"),
    menuToggle: qs("#menu-toggle"),
    sidebarClose: qs("#sidebar-close"),
    navItems: qsa(".nav-item, .footer-link[data-view]"),
    views: qsa(".view"),
    viewTitle: qs("#view-title"),
    hero: qs("#link-hero"),
    mediaPanel: qs("#media-panel"),
    linkForm: qs("#link-form"),
    mediaUrl: qs("#media-url"),
    analyzeBtn: qs("#analyze-btn"),
    linkAlert: qs("#link-alert"),
    mediaThumb: qs("#media-thumb"),
    mediaTitle: qs("#media-title"),
    mediaAuthor: qs("#media-author"),
    mediaType: qs("#media-type"),
    mediaDuration: qs("#media-duration"),
    mediaStats: qs("#media-stats"),
    playlistPanel: qs("#playlist-panel"),
    playlistList: qs("#playlist-list"),
    playlistCount: qs("#playlist-count"),
    formatSelect: qs("#format-select"),
    qualitySelect: qs("#quality-select"),
    containerSelect: qs("#container-select"),
    downloadBtn: qs("#download-btn"),
    resetBtn: qs("#reset-btn"),
    downloadStatus: qs("#download-status"),
    recentList: qs("#recent-list"),
    favoritesList: qs("#favorites-list"),
    rateApp: qs("#rate-app"),
    rateModal: qs("#rate-modal"),
    closeRate: qs("#close-rate"),
    ratingStars: qsa(".star", qs("#rate-modal")),
    submitRating: qs("#submit-rating"),
    toast: qs("#toast"),
    settings: {
        format: qs("#setting-format"),
        container: qs("#setting-container"),
        quality: qs("#setting-quality"),
        location: qs("#setting-location"),
        concurrent: qs("#setting-concurrent"),
        theme: qs("#setting-theme"),
        language: qs("#setting-language"),
        accessibility: qs("#setting-accessibility"),
        save: qs("#save-settings"),
        reset: qs("#reset-settings")
    }
};

const storage = {
    loadSettings() {
        const raw = localStorage.getItem("you_doruto_settings");
        if (!raw) {
            return { ...defaultSettings };
        }
        try {
            const parsed = JSON.parse(raw);
            return { ...defaultSettings, ...parsed };
        } catch {
            return { ...defaultSettings };
        }
    },
    saveSettings(settings) {
        localStorage.setItem("you_doruto_settings", JSON.stringify(settings));
    },
    loadDownloads() {
        const raw = localStorage.getItem("you_doruto_downloads");
        if (!raw) {
            return [];
        }
        try {
            return JSON.parse(raw);
        } catch {
            return [];
        }
    },
    saveDownloads(downloads) {
        localStorage.setItem("you_doruto_downloads", JSON.stringify(downloads));
    }
};

const formatBytes = (bytes) => {
    if (!bytes || Number.isNaN(bytes)) {
        return "Unknown";
    }
    const units = ["B", "KB", "MB", "GB", "TB"];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }
    return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
};

const formatDuration = (seconds) => {
    if (!seconds || Number.isNaN(seconds)) {
        return "Unknown";
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
};

const sanitizeFileName = (name) => {
    const cleaned = name.replace(/[\\/:*?"<>|]/g, "").trim();
    return cleaned.length ? cleaned : "media";
};

let toastTimer;
const showToast = (message) => {
    elements.toast.textContent = message;
    elements.toast.classList.add("active");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        elements.toast.classList.remove("active");
    }, 3000);
};

const setAlert = (message) => {
    elements.linkAlert.textContent = message;
};

const isValidUrl = (value) => {
    try {
        const url = new URL(value);
        return ["http:", "https:"].includes(url.protocol);
    } catch {
        return false;
    }
};

const detectPlaylist = (url) => {
    const value = url.toLowerCase();
    return value.includes("playlist") || value.includes("list=") || value.includes("collection");
};

const withTimeout = (promise, timeoutMs) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    return Promise.race([
        promise(controller.signal),
        new Promise((_, reject) => {
            controller.signal.addEventListener("abort", () => {
                reject(new Error("timeout"));
            });
        })
    ]).finally(() => clearTimeout(timeoutId));
};

const fetchNoEmbed = (url) => withTimeout((signal) => fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`, { signal }), 7000)
    .then((response) => (response.ok ? response.json() : null))
    .catch(() => null);

const fetchHead = (url) => withTimeout((signal) => fetch(url, { method: "HEAD", signal }), 7000)
    .then((response) => (response.ok ? response : null))
    .catch(() => null);

const buildMediaStats = (media) => {
    const stats = [];
    if (media.host) {
        stats.push(`Host: ${media.host}`);
    }
    if (media.fileSize) {
        stats.push(`Size: ${media.fileSize}`);
    }
    if (media.contentType) {
        stats.push(`Type: ${media.contentType}`);
    }
    return stats;
};

const updateHeroState = () => {
    if (state.media) {
        elements.hero.classList.add("compact");
        elements.mediaPanel.classList.add("active");
    } else {
        elements.hero.classList.remove("compact");
        elements.mediaPanel.classList.remove("active");
    }
};

const renderMedia = () => {
    if (!state.media) {
        elements.mediaTitle.textContent = "Waiting for a link";
        elements.mediaAuthor.textContent = "Source: —";
        elements.mediaType.textContent = "Video";
        elements.mediaDuration.textContent = "Duration: Unknown";
        elements.mediaThumb.style.backgroundImage = "";
        elements.mediaStats.textContent = "";
        elements.playlistPanel.style.display = "none";
        return;
    }
    const media = state.media;
    elements.mediaTitle.textContent = media.title;
    elements.mediaAuthor.textContent = `Source: ${media.author}`;
    elements.mediaType.textContent = media.isPlaylist ? "Playlist" : "Single";
    elements.mediaDuration.textContent = `Duration: ${formatDuration(media.duration)}`;
    elements.mediaThumb.style.backgroundImage = media.thumbnail ? `url(${media.thumbnail})` : "";
    elements.mediaStats.innerHTML = buildMediaStats(media).map((stat) => `<span>${stat}</span>`).join("");
    renderPlaylist();
};

const renderPlaylist = () => {
    if (!state.media || !state.media.isPlaylist) {
        elements.playlistPanel.style.display = "none";
        return;
    }
    elements.playlistPanel.style.display = "block";
    const entries = state.media.entries || [];
    elements.playlistCount.textContent = `Items: ${state.media.entriesCount || entries.length || "Unknown"}`;
    if (entries.length === 0) {
        elements.playlistList.innerHTML = `<div class="playlist-item"><span>Playlist items are not accessible in the browser for this source.</span></div>`;
        return;
    }
    elements.playlistList.innerHTML = entries.map((entry, index) => `
        <div class="playlist-item">
            <span>${index + 1}. ${entry.title}</span>
            <span class="muted">${entry.duration || ""}</span>
        </div>
    `).join("");
};

const renderDownloads = () => {
    const sorted = [...state.downloads].sort((a, b) => b.createdAt - a.createdAt);
    const recent = sorted.map((download) => downloadCard(download)).join("");
    elements.recentList.innerHTML = recent || `<div class="download-card"><p class="muted">No downloads yet.</p></div>`;
    const favorites = sorted.filter((download) => download.favorite);
    elements.favoritesList.innerHTML = favorites.length
        ? favorites.map((download) => downloadCard(download)).join("")
        : `<div class="download-card"><p class="muted">No favorites yet.</p></div>`;
    renderActiveDownloads();
};

const renderActiveDownloads = () => {
    const active = state.downloads.filter((download) => ["queued", "downloading"].includes(download.status));
    if (active.length === 0) {
        elements.downloadStatus.innerHTML = `<p class="muted">No active downloads.</p>`;
        return;
    }
    elements.downloadStatus.innerHTML = active.map((download) => {
        const progress = download.progress || 0;
        const speed = download.speed ? `${formatBytes(download.speed)}/s` : "—";
        const eta = download.eta ? `${Math.ceil(download.eta)}s` : "—";
        return `
            <div class="status-row">
                <strong>${download.title}</strong>
                <div class="progress-bar"><div class="progress-fill" style="width:${progress}%;"></div></div>
                <div class="muted">${download.statusLabel} • ${progress.toFixed(0)}% • ${speed} • ETA ${eta}</div>
                <div class="card-actions">
                    ${download.status === "downloading" ? `<button class="action-btn" data-action="cancel" data-id="${download.id}">Cancel</button>` : ""}
                    ${download.status === "queued" ? `<button class="action-btn" data-action="cancel" data-id="${download.id}">Remove</button>` : ""}
                </div>
            </div>
        `;
    }).join("");
};

const downloadCard = (download) => {
    const statusClass = download.status === "completed" ? "badge" : "badge subtle";
    const statusLabel = download.statusLabel;
    const timestamp = new Date(download.createdAt).toLocaleString();
    return `
        <div class="download-card">
            <div class="download-card-header">
                <div>
                    <strong>${download.title}</strong>
                    <p class="muted">${download.url}</p>
                </div>
                <span class="${statusClass}">${statusLabel}</span>
            </div>
            <div class="muted">${timestamp} • ${download.format.toUpperCase()} • ${download.container.toUpperCase()} • ${download.quality}</div>
            <div class="card-actions">
                <button class="action-btn" data-action="open" data-id="${download.id}">Open location</button>
                <button class="action-btn" data-action="retry" data-id="${download.id}">Redownload</button>
                <button class="action-btn" data-action="favorite" data-id="${download.id}">${download.favorite ? "Unfavorite" : "Favorite"}</button>
            </div>
        </div>
    `;
};

const setView = (view) => {
    state.view = view;
    elements.views.forEach((section) => {
        section.classList.toggle("active", section.dataset.view === view);
    });
    elements.navItems.forEach((item) => {
        item.classList.toggle("active", item.dataset.view === view);
    });
    const titleMap = {
        home: "Home",
        recent: "Recent Downloads",
        favorites: "Favorites",
        about: "About",
        settings: "Settings"
    };
    elements.viewTitle.textContent = titleMap[view] || "Home";
    elements.sidebar.classList.remove("open");
};

const applyTheme = () => {
    document.documentElement.dataset.theme = state.settings.theme;
    document.documentElement.dataset.accessibility = state.settings.accessibility === "enhanced" ? "enhanced" : "";
    if (state.settings.accessibility === "reduced") {
        document.documentElement.style.scrollBehavior = "auto";
    } else {
        document.documentElement.style.scrollBehavior = "smooth";
    }
};

const updateSettingsForm = () => {
    elements.settings.format.value = state.settings.format;
    elements.settings.container.value = state.settings.container;
    elements.settings.quality.value = state.settings.quality;
    elements.settings.location.value = state.settings.location;
    elements.settings.concurrent.value = String(state.settings.concurrent);
    elements.settings.theme.value = state.settings.theme;
    elements.settings.language.value = state.settings.language;
    elements.settings.accessibility.value = state.settings.accessibility;
};

const saveSettingsFromForm = () => {
    state.settings = {
        format: elements.settings.format.value,
        container: elements.settings.container.value,
        quality: elements.settings.quality.value,
        location: elements.settings.location.value.trim() || "Downloads",
        concurrent: Number(elements.settings.concurrent.value),
        theme: elements.settings.theme.value,
        language: elements.settings.language.value,
        accessibility: elements.settings.accessibility.value
    };
    storage.saveSettings(state.settings);
    applyTheme();
    updateDownloadOptionDefaults();
    showToast("Settings saved");
};

const resetSettings = () => {
    state.settings = { ...defaultSettings };
    storage.saveSettings(state.settings);
    applyTheme();
    updateSettingsForm();
    updateDownloadOptionDefaults();
    showToast("Settings reset");
};

const syncFormatOptions = () => {
    const format = elements.formatSelect.value;
    const containerOptions = format === "audio" ? ["mp3", "m4a"] : ["mp4", "mkv", "webm"];
    const qualityOptions = format === "audio" ? ["auto", "320k", "192k"] : ["auto", "1080p", "720p", "480p"];
    elements.containerSelect.innerHTML = containerOptions.map((value) => `<option value="${value}">${value.toUpperCase()}</option>`).join("");
    elements.qualitySelect.innerHTML = qualityOptions.map((value) => `<option value="${value}">${value === "auto" ? "Best available" : value}</option>`).join("");
    if (!containerOptions.includes(state.settings.container)) {
        elements.containerSelect.value = containerOptions[0];
    }
    if (!qualityOptions.includes(state.settings.quality)) {
        elements.qualitySelect.value = qualityOptions[0];
    }
};

const updateDownloadOptionDefaults = () => {
    elements.formatSelect.value = state.settings.format;
    elements.containerSelect.value = state.settings.container;
    elements.qualitySelect.value = state.settings.quality;
    syncFormatOptions();
};

const createDownloadRecord = (media, options) => ({
    id: crypto.randomUUID(),
    title: media.title,
    url: media.url,
    format: options.format,
    container: options.container,
    quality: options.quality,
    status: "queued",
    statusLabel: "Queued",
    progress: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    favorite: false,
    fileName: "",
    fileUrl: "",
    speed: 0,
    eta: 0
});

const updateDownload = (id, updates) => {
    const index = state.downloads.findIndex((download) => download.id === id);
    if (index === -1) {
        return;
    }
    state.downloads[index] = { ...state.downloads[index], ...updates, updatedAt: Date.now() };
    storage.saveDownloads(state.downloads);
    renderDownloads();
};

const enqueueDownload = (record) => {
    state.downloads.unshift(record);
    storage.saveDownloads(state.downloads);
    renderDownloads();
    processQueue();
};

const getActiveCount = () => state.downloads.filter((download) => download.status === "downloading").length;

const processQueue = () => {
    const limit = state.settings.concurrent;
    if (getActiveCount() >= limit) {
        return;
    }
    const next = state.downloads.find((download) => download.status === "queued");
    if (!next) {
        return;
    }
    startDownload(next);
    if (getActiveCount() < limit) {
        processQueue();
    }
};

const startDownload = async (record) => {
    updateDownload(record.id, { status: "downloading", statusLabel: "Downloading" });
    const controller = new AbortController();
    state.activeControllers.set(record.id, controller);
    try {
        await performDownload(record, controller);
        updateDownload(record.id, { status: "completed", statusLabel: "Completed", progress: 100, speed: 0, eta: 0 });
        state.activeControllers.delete(record.id);
        showToast("Download completed");
    } catch (error) {
        state.activeControllers.delete(record.id);
        if (error.name === "AbortError" || error.message === "cancelled") {
            updateDownload(record.id, { status: "cancelled", statusLabel: "Cancelled", speed: 0, eta: 0 });
            showToast("Download cancelled");
        } else {
            updateDownload(record.id, { status: "failed", statusLabel: "Failed", speed: 0, eta: 0 });
            const errorMessageMap = {
                blocked: "Source blocks direct downloads",
                large_file: "Large files need the file picker or helper service",
                network: "Network error while downloading",
                audio_unavailable: "Audio-only is not available for this source",
                video_unavailable: "Video format is not available for this source"
            };
            showToast(errorMessageMap[error.message] || "Download failed");
        }
    } finally {
        processQueue();
    }
};

const performDownload = async (record, controller) => {
    if (!state.media) {
        throw new Error("no_media");
    }
    const media = state.media;
    if (!media.directAccess) {
        throw new Error("blocked");
    }
    if (record.format === "audio" && !media.supportsAudio) {
        throw new Error("audio_unavailable");
    }
    if (record.format === "video" && !media.supportsVideo) {
        throw new Error("video_unavailable");
    }
    const response = await fetch(record.url, { signal: controller.signal });
    if (!response.ok || !response.body) {
        throw new Error("network");
    }
    const total = Number(response.headers.get("content-length"));
    if (!window.showSaveFilePicker && total > 1024 * 1024 * 200) {
        throw new Error("large_file");
    }
    const fileName = `${sanitizeFileName(record.title)}.${record.container}`;
    let handle = null;
    if (window.showSaveFilePicker) {
        try {
            handle = await window.showSaveFilePicker({
                suggestedName: fileName,
                types: [{ description: "Media", accept: { "application/octet-stream": [`.${record.container}`] } }]
            });
        } catch (error) {
            if (error.name === "AbortError") {
                throw new Error("cancelled");
            }
            throw error;
        }
    }
    let received = 0;
    const startedAt = performance.now();
    const reader = response.body.getReader();
    if (handle) {
        const writable = await handle.createWritable();
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            await writable.write(value);
            received += value.length;
            updateProgress(record, received, total, startedAt);
        }
        await writable.close();
        updateDownload(record.id, { fileName });
        return;
    }
    const chunks = [];
    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        chunks.push(value);
        received += value.length;
        updateProgress(record, received, total, startedAt);
    }
    const blob = new Blob(chunks, { type: response.headers.get("content-type") || "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    updateDownload(record.id, { fileName, fileUrl: url });
};

const updateProgress = (record, received, total, startedAt) => {
    const percent = total ? (received / total) * 100 : Math.min(99, record.progress + 1);
    const elapsed = (performance.now() - startedAt) / 1000;
    const speed = elapsed > 0 ? received / elapsed : 0;
    const eta = total && speed ? (total - received) / speed : 0;
    updateDownload(record.id, {
        progress: percent,
        speed,
        eta,
        statusLabel: "Downloading"
    });
};

const cancelDownload = (id) => {
    const controller = state.activeControllers.get(id);
    if (controller) {
        controller.abort();
        return;
    }
    updateDownload(id, { status: "cancelled", statusLabel: "Cancelled" });
};

const retryDownload = (id) => {
    const record = state.downloads.find((download) => download.id === id);
    if (!record) {
        return;
    }
    updateDownload(id, { status: "queued", statusLabel: "Queued", progress: 0, speed: 0, eta: 0 });
    processQueue();
};

const toggleFavorite = (id) => {
    const record = state.downloads.find((download) => download.id === id);
    if (!record) {
        return;
    }
    updateDownload(id, { favorite: !record.favorite });
};

const openLocation = (id) => {
    const record = state.downloads.find((download) => download.id === id);
    if (!record) {
        return;
    }
    if (record.fileUrl) {
        window.open(record.fileUrl, "_blank", "noopener,noreferrer");
        return;
    }
    showToast("Browser access to the download location is restricted");
};

const analyzeLink = async (value) => {
    setAlert("");
    const url = value.trim();
    if (!isValidUrl(url)) {
        setAlert("Enter a valid http or https URL.");
        return;
    }
    elements.analyzeBtn.disabled = true;
    elements.analyzeBtn.textContent = "Analyzing";
    const parsed = new URL(url);
    const [noEmbed, headResponse] = await Promise.all([fetchNoEmbed(url), fetchHead(url)]);
    const contentType = headResponse ? headResponse.headers.get("content-type") : "";
    const normalizedType = contentType ? contentType.toLowerCase() : "";
    const contentLength = headResponse ? Number(headResponse.headers.get("content-length")) : null;
    const titleFromUrl = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() || parsed.hostname);
    state.media = {
        url,
        title: noEmbed?.title || titleFromUrl || "Untitled media",
        author: noEmbed?.author_name || parsed.hostname,
        duration: noEmbed?.duration || null,
        thumbnail: noEmbed?.thumbnail_url || "",
        isPlaylist: detectPlaylist(url),
        entries: [],
        entriesCount: null,
        host: parsed.hostname,
        contentType: contentType || "Unknown",
        fileSize: formatBytes(contentLength),
        directAccess: Boolean(headResponse),
        supportsAudio: normalizedType.startsWith("audio"),
        supportsVideo: normalizedType.startsWith("video") || normalizedType === "" || normalizedType.includes("octet-stream")
    };
    renderMedia();
    updateHeroState();
    elements.analyzeBtn.disabled = false;
    elements.analyzeBtn.textContent = "Analyze";
    if (!state.media.directAccess) {
        setAlert("Direct access is blocked by the source. Use a direct media link or local helper service.");
    }
};

const resetMedia = () => {
    state.media = null;
    elements.mediaUrl.value = "";
    setAlert("");
    updateHeroState();
    renderMedia();
};

const handleDownload = () => {
    if (!state.media) {
        showToast("Paste a link first");
        return;
    }
    const options = {
        format: elements.formatSelect.value,
        quality: elements.qualitySelect.value,
        container: elements.containerSelect.value
    };
    if (!state.media.directAccess) {
        showToast("Direct download is blocked for this source");
        return;
    }
    if (options.format === "audio" && !state.media.supportsAudio) {
        showToast("Audio-only format is unavailable for this source");
        return;
    }
    if (options.format === "video" && !state.media.supportsVideo) {
        showToast("Video format is unavailable for this source");
        return;
    }
    const record = createDownloadRecord(state.media, options);
    enqueueDownload(record);
};

const handleRating = () => {
    if (!state.rating) {
        showToast("Select a rating first");
        return;
    }
    elements.rateModal.classList.remove("active");
    showToast("Thanks for your feedback");
};

const bindEvents = () => {
    elements.menuToggle.addEventListener("click", () => {
        elements.sidebar.classList.add("open");
    });
    elements.sidebarClose.addEventListener("click", () => {
        elements.sidebar.classList.remove("open");
    });
    elements.navItems.forEach((item) => {
        item.addEventListener("click", () => setView(item.dataset.view));
    });
    elements.linkForm.addEventListener("submit", (event) => {
        event.preventDefault();
        analyzeLink(elements.mediaUrl.value);
    });
    elements.mediaUrl.addEventListener("input", () => {
        if (elements.mediaUrl.value.length === 0) {
            setAlert("");
        }
    });
    elements.downloadBtn.addEventListener("click", handleDownload);
    elements.resetBtn.addEventListener("click", resetMedia);
    elements.formatSelect.addEventListener("change", syncFormatOptions);
    elements.rateApp.addEventListener("click", () => {
        elements.rateModal.classList.add("active");
    });
    elements.closeRate.addEventListener("click", () => {
        elements.rateModal.classList.remove("active");
    });
    elements.submitRating.addEventListener("click", handleRating);
    elements.ratingStars.forEach((star) => {
        star.addEventListener("click", () => {
            state.rating = Number(star.dataset.rating);
            elements.ratingStars.forEach((item) => {
                item.classList.toggle("active", Number(item.dataset.rating) <= state.rating);
            });
        });
    });
    elements.settings.save.addEventListener("click", saveSettingsFromForm);
    elements.settings.reset.addEventListener("click", resetSettings);
    document.addEventListener("click", (event) => {
        const target = event.target.closest("[data-action]");
        if (!target) {
            return;
        }
        const id = target.dataset.id;
        const action = target.dataset.action;
        if (action === "cancel") {
            cancelDownload(id);
        }
        if (action === "retry") {
            retryDownload(id);
        }
        if (action === "favorite") {
            toggleFavorite(id);
        }
        if (action === "open") {
            openLocation(id);
        }
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            elements.rateModal.classList.remove("active");
            elements.sidebar.classList.remove("open");
        }
    });
};

const initialize = () => {
    state.settings = storage.loadSettings();
    state.downloads = storage.loadDownloads();
    applyTheme();
    updateSettingsForm();
    updateDownloadOptionDefaults();
    renderMedia();
    renderDownloads();
    updateHeroState();
    bindEvents();
};

initialize();
