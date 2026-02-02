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

const defaultApiBase = window.location.protocol === "file:"
    ? "http://localhost:5178"
    : `${window.location.protocol}//${window.location.hostname}:5178`;

const state = {
    media: null,
    formats: { video: [], audio: [] },
    downloads: [],
    settings: { ...defaultSettings },
    rating: 0,
    view: "home",
    helperOnline: false,
    apiBase: defaultApiBase
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
    connectionStatus: qs("#connection-status"),
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
    let hostLabel = null;
    if (media.webpageUrl) {
        try {
            hostLabel = `Host: ${new URL(media.webpageUrl).hostname}`;
        } catch {
            hostLabel = null;
        }
    }
    elements.mediaStats.innerHTML = [
        hostLabel,
        media.entriesCount ? `Items: ${media.entriesCount}` : null
    ].filter(Boolean).map((stat) => `<span>${stat}</span>`).join("");
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
        elements.playlistList.innerHTML = `<div class="playlist-item"><span>Playlist entries are available once download starts.</span></div>`;
        return;
    }
    elements.playlistList.innerHTML = entries.map((entry, index) => `
        <div class="playlist-item">
            <span>${index + 1}. ${entry.title}</span>
            <span class="muted">${entry.duration ? formatDuration(entry.duration) : ""}</span>
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
            <div class="muted">${timestamp} • ${download.format.toUpperCase()} • ${download.qualityLabel || download.quality} • ${download.container.toUpperCase()}</div>
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
    const formatList = state.formats[format] || [];
    elements.qualitySelect.innerHTML = formatList.length
        ? formatList.map((entry) => `<option value="${entry.id}">${entry.label}</option>`).join("")
        : `<option value="auto">Best available</option>`;
    const containerOptions = format === "audio" ? ["mp3", "m4a", "opus"] : ["mp4", "mkv", "webm"];
    elements.containerSelect.innerHTML = containerOptions.map((value) => `<option value="${value}">${value.toUpperCase()}</option>`).join("");
    if (!containerOptions.includes(state.settings.container)) {
        elements.containerSelect.value = containerOptions[0];
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
    jobId: options.jobId || "",
    title: media.title,
    url: media.url,
    format: options.format,
    container: options.container,
    quality: options.quality,
    qualityLabel: options.qualityLabel || options.quality,
    status: "queued",
    statusLabel: "Queued",
    progress: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    favorite: false,
    filePath: "",
    speed: 0,
    eta: 0,
    error: ""
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
};

const checkHelperStatus = async () => {
    try {
        const response = await fetch(`${state.apiBase}/api/health`);
        state.helperOnline = response.ok;
    } catch {
        state.helperOnline = false;
    }
    renderHelperStatus();
};

const renderHelperStatus = () => {
    const label = state.helperOnline ? "Helper online" : "Helper offline";
    elements.connectionStatus.querySelector("span:last-child").textContent = label;
    elements.connectionStatus.querySelector(".status-dot").style.background = state.helperOnline ? "#36c68e" : "#e63946";
};

const analyzeLink = async (value) => {
    setAlert("");
    const url = value.trim();
    if (!isValidUrl(url)) {
        setAlert("Enter a valid http or https URL.");
        return;
    }
    if (!state.helperOnline) {
        setAlert("Local helper service is offline. Start it to analyze this link.");
        return;
    }
    elements.analyzeBtn.disabled = true;
    elements.analyzeBtn.textContent = "Analyzing";
    try {
        const response = await fetch(`${state.apiBase}/api/inspect`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url })
        });
        const data = await response.json();
        if (!response.ok) {
            setAlert(data.error || "Unable to analyze the link.");
            return;
        }
        state.media = {
            url,
            title: data.metadata.title,
            author: data.metadata.author,
            duration: data.metadata.duration,
            thumbnail: data.metadata.thumbnail,
            isPlaylist: data.metadata.isPlaylist,
            entries: data.metadata.entries,
            entriesCount: data.metadata.entriesCount,
            webpageUrl: data.metadata.webpageUrl
        };
        state.formats = data.formats || { video: [], audio: [] };
        renderMedia();
        updateHeroState();
        syncFormatOptions();
    } catch {
        setAlert("Unable to connect to the helper service.");
    } finally {
        elements.analyzeBtn.disabled = false;
        elements.analyzeBtn.textContent = "Analyze";
    }
};

const resetMedia = () => {
    state.media = null;
    state.formats = { video: [], audio: [] };
    elements.mediaUrl.value = "";
    setAlert("");
    updateHeroState();
    renderMedia();
};

const requestDownload = async (record) => {
    const payload = {
        url: record.url,
        title: record.title,
        formatId: record.quality === "auto" ? null : record.quality,
        formatType: record.format,
        container: record.container
    };
    const response = await fetch(`${state.apiBase}/api/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || "Download failed");
    }
    return data.jobId;
};

const startDownloadFromRecord = async (record) => {
    try {
        const jobId = await requestDownload(record);
        updateDownload(record.id, { jobId, status: "downloading", statusLabel: "Downloading" });
    } catch (error) {
        updateDownload(record.id, { status: "failed", statusLabel: "Failed", error: error.message });
        showToast(error.message);
    }
};

const handleDownload = async () => {
    if (!state.media) {
        showToast("Paste a link first");
        return;
    }
    if (!state.helperOnline) {
        showToast("Helper service is offline");
        return;
    }
    const format = elements.formatSelect.value;
    const quality = elements.qualitySelect.value;
    const container = elements.containerSelect.value;
    const qualityLabel = elements.qualitySelect.selectedOptions[0]?.textContent?.trim() || quality;
    const record = createDownloadRecord(state.media, { format, quality, container, qualityLabel });
    enqueueDownload(record);
    await startDownloadFromRecord(record);
};

const pollDownloads = async () => {
    if (!state.helperOnline) {
        return;
    }
    const active = state.downloads.filter((download) => ["queued", "downloading"].includes(download.status) && download.jobId);
    await Promise.all(active.map(async (download) => {
        try {
            const response = await fetch(`${state.apiBase}/api/status/${download.jobId}`);
            if (!response.ok) {
                return;
            }
            const data = await response.json();
            updateDownload(download.id, {
                status: data.status,
                statusLabel: data.statusLabel,
                progress: data.progress,
                speed: data.speed,
                eta: data.eta,
                filePath: data.filePath || download.filePath,
                error: data.error || ""
            });
        } catch {
            return;
        }
    }));
};

const cancelDownload = async (id) => {
    const record = state.downloads.find((download) => download.id === id);
    if (!record) {
        return;
    }
    if (!record.jobId) {
        updateDownload(id, { status: "cancelled", statusLabel: "Cancelled" });
        return;
    }
    try {
        await fetch(`${state.apiBase}/api/cancel`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId: record.jobId })
        });
        updateDownload(id, { status: "cancelled", statusLabel: "Cancelled" });
    } catch {
        showToast("Unable to cancel download");
    }
};

const retryDownload = async (id) => {
    const record = state.downloads.find((download) => download.id === id);
    if (!record) {
        return;
    }
    if (!state.helperOnline) {
        showToast("Helper service is offline");
        return;
    }
    updateDownload(id, { status: "queued", statusLabel: "Queued", progress: 0, speed: 0, eta: 0, jobId: "" });
    const updated = state.downloads.find((download) => download.id === id);
    if (updated) {
        await startDownloadFromRecord(updated);
    }
};

const toggleFavorite = (id) => {
    const record = state.downloads.find((download) => download.id === id);
    if (!record) {
        return;
    }
    updateDownload(id, { favorite: !record.favorite });
};

const openLocation = async (id) => {
    const record = state.downloads.find((download) => download.id === id);
    if (!record || !record.filePath) {
        showToast("Download location is not available yet");
        return;
    }
    try {
        const response = await fetch(`${state.apiBase}/api/reveal`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: record.filePath })
        });
        if (!response.ok) {
            const data = await response.json();
            showToast(data.error || "Unable to open location");
        }
    } catch {
        showToast("Unable to open location");
    }
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
    checkHelperStatus();
    setInterval(checkHelperStatus, 5000);
    setInterval(pollDownloads, 1200);
};

initialize();
