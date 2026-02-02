/**
 * SmartNotes Application Logic
 * Senior Architecture Implementation
 */

// ==========================================================================
// Services
// ==========================================================================

const DriveService = {
    client: null,
    token: null,
    pendingNote: null,

    async init() {
        if (typeof gapi === 'undefined' || typeof google === 'undefined') return;

        try {
            await new Promise(resolve => gapi.load('client', resolve));
            await gapi.client.init({
                apiKey: firebaseConfig.apiKey,
                discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
            });

            this.client = google.accounts.oauth2.initTokenClient({
                client_id: "523799066979-e75bl0vvthlr5193qee8niocvkoqaknq.apps.googleusercontent.com",
                scope: "https://www.googleapis.com/auth/drive.file",
                callback: (resp) => this.handleTokenResponse(resp),
            });
        } catch (e) {
            console.error('Drive Init Error:', e);
        }
    },

    handleTokenResponse(resp) {
        if (resp.error) return console.error(resp);
        this.token = resp.access_token;
        state.driveToken = resp.access_token;
        UI.showToast(UI.getText('drive_connected', 'Drive connected'));
        if (this.pendingNote) {
            this.uploadNote(this.pendingNote);
            this.pendingNote = null;
        }
    },

    connect() {
        this.client ? this.client.requestAccessToken({ prompt: 'consent' }) : UI.showToast(UI.getText('drive_unavailable', 'Drive unavailable'));
    },

    async uploadNote(note) {
        if (!note) return;
        if (!this.client) {
            UI.showToast(UI.getText('drive_unavailable', 'Drive unavailable'));
            return;
        }
        if (!this.token) {
            this.pendingNote = note;
            this.connect();
            return;
        }

        const metadata = {
            name: NoteIO.fileNameFor(note),
            mimeType: 'application/json',
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([NoteIO.exportNote(note)], { type: 'application/json' }));

        try {
            await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.token}` },
                body: form
            });
            UI.showToast(UI.getText('drive_saved', 'Uploaded to Drive'));
        } catch (e) {
            console.error("Drive Sync Error", e);
            UI.showToast(UI.getText('drive_error', 'Drive upload failed'));
        }
    }
};

const VoiceService = {
    recorder: null,
    chunks: [],
    stream: null,

    async toggle() {
        state.recording ? this.stop() : await this.start();
    },

    async start() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
            return UI.showToast(UI.getText('mic_unsupported', 'Microphone not supported'));
        }
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.recorder = new MediaRecorder(this.stream);
            this.chunks = [];

            this.recorder.ondataavailable = e => this.chunks.push(e.data);
            this.recorder.onstop = () => this.processAudio();

            this.recorder.start();
            state.recording = true;

            UI.showToast(UI.getText('recording', 'Recording...'));
            document.getElementById('voice-indicator').classList.add('active');
        } catch (e) {
            UI.showToast(UI.getText('mic_denied', 'Microphone access denied'));
        }
    },

    stop() {
        if (!this.recorder) return;
        this.recorder.stop();
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        state.recording = false;
        document.getElementById('voice-indicator').classList.remove('active');
    },

    processAudio() {
        const reader = new FileReader();
        reader.onloadend = () => {
            const html = `<br><div class="media-wrapper" contenteditable="false"><audio controls src="${reader.result}"></audio></div><br>`;
            document.execCommand('insertHTML', false, html);
            Editor.queueSnapshot();
        };
        reader.readAsDataURL(new Blob(this.chunks, { type: 'audio/mp3' }));
    }
};

const SketchService = {
    canvas: null,
    ctx: null,
    drawing: false,
    history: [],
    resizeObserver: null,
    dpr: 1,
    els: {},

    init() {
        this.canvas = document.getElementById('sketch-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.els = {
            color: document.getElementById('sketch-color-picker'),
            width: document.getElementById('sketch-width-picker')
        };
        this.setupCanvas();
        this.bindEvents();
    },

    setupCanvas() {
        this.syncCanvasSize(false);
        this.saveState();
    },

    bindEvents() {
        const start = (e) => {
            if (e.button !== undefined && e.button !== 0) return;
            this.drawing = true;
            this.ctx.beginPath();
            this.ctx.strokeStyle = this.els.color.value;
            this.ctx.lineWidth = parseFloat(this.els.width.value);
            const pos = this.getCanvasPoint(e);
            this.ctx.moveTo(pos.x, pos.y);
            if (e.pointerId !== undefined) {
                this.canvas.setPointerCapture(e.pointerId);
            }
        };

        const move = (e) => {
            if (!this.drawing) return;
            e.preventDefault();
            const pos = this.getCanvasPoint(e);
            this.ctx.lineTo(pos.x, pos.y);
            this.ctx.stroke();
        };

        const end = (e) => {
            if (!this.drawing) return;
            this.drawing = false;
            this.ctx.closePath();
            if (e && e.pointerId !== undefined) {
                this.canvas.releasePointerCapture(e.pointerId);
            }
            this.saveState();
        };

        if (window.PointerEvent) {
            this.canvas.addEventListener('pointerdown', start);
            this.canvas.addEventListener('pointermove', move);
            this.canvas.addEventListener('pointerup', end);
            this.canvas.addEventListener('pointercancel', end);
            this.canvas.addEventListener('pointerleave', end);
        } else {
            this.canvas.addEventListener('mousedown', start);
            this.canvas.addEventListener('mousemove', move);
            this.canvas.addEventListener('mouseup', end);
            this.canvas.addEventListener('mouseleave', end);
            this.canvas.addEventListener('touchstart', start, { passive: true });
            this.canvas.addEventListener('touchmove', move, { passive: false });
            this.canvas.addEventListener('touchend', end, { passive: true });
        }

        if (window.ResizeObserver) {
            this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
            this.resizeObserver.observe(this.canvas.parentElement);
        }
        window.addEventListener('resize', Utils.debounce(() => this.resizeCanvas(), 150));
        window.addEventListener('orientationchange', Utils.debounce(() => this.resizeCanvas(), 150));
    },

    saveState() {
        if (this.history.length > 10) this.history.shift();
        this.history.push(this.canvas.toDataURL());
    },

    resizeCanvas() {
        if (!this.canvas) return;
        this.syncCanvasSize(true);
    },

    syncCanvasSize(keepDrawing) {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const previous = keepDrawing ? this.canvas.toDataURL() : null;
        this.dpr = window.devicePixelRatio || 1;
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;
        this.canvas.width = Math.round(rect.width * this.dpr);
        this.canvas.height = Math.round(rect.height * this.dpr);
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        if (previous) {
            const img = new Image();
            img.onload = () => {
                this.ctx.clearRect(0, 0, rect.width, rect.height);
                this.ctx.drawImage(img, 0, 0, rect.width, rect.height);
            };
            img.src = previous;
        }
    },

    getCanvasPoint(e) {
        const rect = this.canvas.getBoundingClientRect();
        const point = e.touches ? e.touches[0] : (e.changedTouches ? e.changedTouches[0] : e);
        const x = point.clientX - rect.left;
        const y = point.clientY - rect.top;
        return { x, y };
    },

    undo() {
        if (this.history.length <= 1) return this.clear();
        this.history.pop();
        const img = new Image();
        img.src = this.history[this.history.length - 1];
        img.onload = () => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(img, 0, 0);
        };
    },

    save() {
        Editor.insertMedia(this.canvas.toDataURL('image/png'), 'image');
        UI.closeModal('sketch-modal');
        Editor.queueSnapshot();
    },

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.history = [];
        this.saveState();
    }
};

const NoteIO = {
    schemaVersion: 2,

    exportNote(note) {
        return JSON.stringify({
            schemaVersion: this.schemaVersion,
            exportedAt: new Date().toISOString(),
            note: this.serializeNote(note)
        }, null, 2);
    },

    serializeNote(note) {
        const normalizeExportDate = (value) => {
            if (!value) return new Date().toISOString();
            if (value.toDate) return value.toDate().toISOString();
            if (value instanceof Date) return value.toISOString();
            const date = new Date(value);
            return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
        };
        return {
            id: note.id,
            title: note.title || '',
            content: note.content || '',
            tags: Array.isArray(note.tags) ? note.tags : [],
            folderId: note.folderId || null,
            isPinned: !!note.isPinned,
            isImportant: !!note.isImportant,
            isArchived: !!note.isArchived,
            createdAt: normalizeExportDate(note.createdAt),
            updatedAt: normalizeExportDate(note.updatedAt),
            order: typeof note.order === 'number' ? note.order : 0
        };
    },

    parseImport(data) {
        if (!data) return [];
        if (data.note) return [this.normalizeNote(data.note)];
        if (Array.isArray(data.notes)) return data.notes.map(note => this.normalizeNote(note)).filter(Boolean);
        if (data.schemaVersion && data.content) return [this.normalizeNote(data)];
        return [];
    },

    normalizeNote(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const title = typeof raw.title === 'string' ? raw.title : '';
        const content = typeof raw.content === 'string' ? raw.content : '';
        const tags = Array.isArray(raw.tags) ? raw.tags.filter(t => typeof t === 'string') : [];
        const createdAt = this.normalizeDate(raw.createdAt);
        const updatedAt = this.normalizeDate(raw.updatedAt);
        return {
            id: typeof raw.id === 'string' ? raw.id : Utils.generateId(),
            title,
            content,
            tags,
            folderId: typeof raw.folderId === 'string' ? raw.folderId : null,
            isPinned: !!raw.isPinned,
            isImportant: !!raw.isImportant,
            isArchived: !!raw.isArchived,
            createdAt,
            updatedAt,
            order: typeof raw.order === 'number' ? raw.order : Date.now()
        };
    },

    normalizeDate(value) {
        if (!value) return new Date();
        if (value.toDate) return value.toDate();
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? new Date() : date;
    },

    fileNameFor(note) {
        const base = (note.title || 'SmartNote').toString().trim().slice(0, 40).replace(/[^a-zA-Z0-9-_]+/g, '_');
        return `${base || 'SmartNote'}.json`;
    }
};

const ReminderService = {
    init() {
        if (!('Notification' in window)) return;
        if (Notification.permission !== "granted") {
            Notification.requestPermission().catch(() => null);
        }
        setInterval(() => this.check(), 60000);
    },

    check() {
        if (!('Notification' in window) || Notification.permission !== "granted") return;
        const now = new Date();
        state.notes.forEach(note => {
            if (note.reminder && new Date(note.reminder) <= now && !note.reminderSent) {
                const title = note.title || UI.getText('app_name', 'SmartNotes');
                new Notification(UI.getText('app_name', 'SmartNotes'), { body: title });
                this.markAsSent(note.id);
            }
        });
    },

    set(dateStr) {
        if (!state.currentNote) return;
        state.currentNote.reminder = dateStr;
        state.currentNote.reminderSent = false;
        Editor.save();
        UI.showToast(`${UI.getText('reminder_set', 'Reminder set')}: ${new Date(dateStr).toLocaleString()}`);
    },

    async markAsSent(id) {
        await db.collection('users').doc(state.user.uid).collection('notes').doc(id).update({ reminderSent: true });
    }
};

// ==========================================================================
// Editor Core
// ==========================================================================


const Editor = {
    history: [],
    future: [],
    timer: null,
    snapshotTimer: null,
    config: [],
    selectedMedia: null,
    draggedMedia: null,
    savedRange: null,
    activeFontSize: null,
    toolbarVisible: true,
    toolbarDrag: { active: false, startX: 0, startY: 0, offsetX: 0, offsetY: 0 },
    els: {},
    fontSizes: [12, 14, 16, 18, 20, 24, 28],

    configDefault: [
        { id: 'size', icon: 'text_fields', cmd: 'fontSize', active: true, action: 'toggleSizeSlider' },
        { id: 'bold', icon: 'format_bold', cmd: 'bold', active: true },
        { id: 'italic', icon: 'format_italic', cmd: 'italic', active: true },
        { id: 'list_ul', icon: 'format_list_bulleted', cmd: 'insertUnorderedList', active: true },
        { id: 'task', icon: 'check_circle', cmd: 'task', active: true },
        { id: 'color', icon: 'palette', cmd: 'foreColor', color: true, active: true },
        { id: 'highlight', icon: 'format_color_fill', cmd: 'hiliteColor', color: true, active: true },
        { id: 'image', icon: 'add_photo_alternate', cmd: 'image', active: true },
        { id: 'voice', icon: 'mic', cmd: 'voice', active: true },
        { id: 'sketch', icon: 'brush', cmd: 'sketch', active: true },
        { id: 'clear', icon: 'format_clear', cmd: 'removeFormat', active: true }
    ],

    init() {
        this.els = {
            title: document.getElementById('note-title'),
            content: document.getElementById('note-content-editable'),
            tags: document.getElementById('note-tags-input'),
            tagsContainer: document.getElementById('note-tags-container'),
            toolbar: document.getElementById('editor-toolbar'),
            wrapper: document.getElementById('note-editor'),
            sizePopup: document.getElementById('text-size-popup'),
            sizeRange: document.getElementById('font-size-range'),
            ctxMenu: document.getElementById('media-context-menu'),
            toolbarToggle: document.getElementById('toolbar-toggle'),
            toolbarToggleIcon: document.getElementById('toolbar-toggle-icon')
        };

        this.loadConfig();
        this.loadToolbarVisibility();
        this.renderToolbar();
        this.bindEvents();
        this.applyToolbarMode();
        this.updateToolbarToggle();
        window.addEventListener('resize', Utils.debounce(() => this.applyToolbarMode(), 150));
    },

    loadConfig() {
        const saved = localStorage.getItem('editor-tools');
        if (!saved) {
            this.config = this.configDefault;
            return;
        }
        const parsed = JSON.parse(saved);
        this.config = this.configDefault.map(tool => {
            const existing = parsed.find(item => item.id === tool.id);
            return { ...tool, ...existing };
        });
    },

    bindEvents() {
        this.els.title.addEventListener('input', () => {
            this.queueSnapshot();
            this.triggerSave();
        });

        this.els.content.addEventListener('input', () => {
            this.cleanupZeroWidth();
            this.queueSnapshot();
        });

        this.els.content.addEventListener('paste', () => this.queueSnapshot());
        this.els.content.addEventListener('drop', () => this.queueSnapshot());

        this.els.tags.addEventListener('keydown', e => {
            if (e.key === 'Enter' && e.target.value.trim()) {
                this.addTag(e.target.value.trim().replace(/^#/, ''));
                e.target.value = '';
                this.queueSnapshot();
            }
        });

        this.els.tagsContainer.addEventListener('click', (e) => {
            const chip = e.target.closest('.tag-chip');
            if (!chip || !chip.dataset.tag) return;
            const tag = decodeURIComponent(chip.dataset.tag);
            this.removeTag(tag);
        });

        this.els.content.addEventListener('click', e => {
            const checkbox = e.target.closest('.task-checkbox');
            if (checkbox) {
                this.toggleTask(checkbox);
                return;
            }
            const mediaWrapper = e.target.closest('.media-wrapper');
            if (mediaWrapper) {
                this.selectMedia(mediaWrapper);
                e.stopPropagation();
            } else {
                this.deselectMedia();
            }
        });

        this.els.content.addEventListener('change', e => {
            if (e.target.matches('.task-checkbox')) {
                this.toggleTask(e.target);
            }
        });

        this.els.content.addEventListener('dragstart', (e) => {
            const mediaWrapper = e.target.closest('.media-wrapper');
            if (!mediaWrapper) return;
            this.draggedMedia = mediaWrapper;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', 'media');
        });

        this.els.content.addEventListener('dragover', (e) => {
            if (!this.draggedMedia) return;
            e.preventDefault();
        });

        this.els.content.addEventListener('drop', (e) => {
            if (!this.draggedMedia) return;
            e.preventDefault();
            const range = this.getRangeFromPoint(e.clientX, e.clientY);
            if (range) {
                range.insertNode(this.draggedMedia);
            } else {
                this.els.content.appendChild(this.draggedMedia);
            }
            this.draggedMedia = null;
            this.queueSnapshot();
        });

        this.els.content.addEventListener('pointerdown', (e) => {
            const handle = e.target.closest('.media-resize-handle');
            if (!handle) return;
            e.preventDefault();
            const wrapper = handle.closest('.media-wrapper');
            const img = wrapper.querySelector('img');
            if (!img) return;
            const rect = img.getBoundingClientRect();
            const contentRect = this.els.content.getBoundingClientRect();
            this.resizeState = {
                wrapper,
                startX: e.clientX,
                startWidth: rect.width,
                startHeight: rect.height,
                ratio: rect.width / rect.height,
                maxWidth: contentRect.width - 40
            };
            document.addEventListener('pointermove', this.handleResize);
            document.addEventListener('pointerup', this.stopResize);
        });

        document.addEventListener('selectionchange', () => {
            if (this.els.wrapper.classList.contains('active')) {
                this.saveSelection();
            }
        });

        document.addEventListener('click', e => {
            if (!e.target.closest('.media-wrapper') && !e.target.closest('#media-context-menu')) {
                this.deselectMedia();
            }
            if (!e.target.closest('#text-size-popup') && !e.target.closest('[data-action="toggleSizeSlider"]')) {
                this.els.sizePopup.classList.add('hidden');
            }
        });

        this.els.sizeRange.addEventListener('input', (e) => {
            const idx = parseInt(e.target.value, 10) - 1;
            const size = this.fontSizes[idx] || this.fontSizes[2];
            this.restoreSelection();
            this.applyFontSize(size);
        });

        if (this.els.toolbarToggle) {
            this.els.toolbarToggle.addEventListener('click', () => {
                this.setToolbarVisibility(!this.toolbarVisible);
            });
        }

        document.getElementById('img-upload').addEventListener('change', e => {
            if (e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = ev => this.insertMedia(ev.target.result, 'image');
                reader.readAsDataURL(e.target.files[0]);
            }
        });

        this.els.toolbar.addEventListener('pointerdown', (e) => {
            const handle = e.target.closest('.toolbar-handle');
            if (!handle || !this.els.toolbar.classList.contains('floating')) return;
            e.preventDefault();
            this.toolbarDrag.active = true;
            const rect = this.els.toolbar.getBoundingClientRect();
            this.toolbarDrag.startX = e.clientX;
            this.toolbarDrag.startY = e.clientY;
            this.toolbarDrag.offsetX = rect.left;
            this.toolbarDrag.offsetY = rect.top;
            this.els.toolbar.classList.add('dragging');
            document.addEventListener('pointermove', this.dragToolbar);
            document.addEventListener('pointerup', this.stopDragToolbar);
        });

        this.els.content.addEventListener('focusin', () => this.showToolbar());
        this.els.content.addEventListener('focusout', () => this.scheduleHideToolbar());
        this.els.title.addEventListener('focusin', () => this.showToolbar());
        this.els.title.addEventListener('focusout', () => this.scheduleHideToolbar());
    },

    dragToolbar: (e) => {
        if (!Editor.toolbarDrag.active) return;
        const rect = Editor.els.toolbar.getBoundingClientRect();
        const dx = e.clientX - Editor.toolbarDrag.startX;
        const dy = e.clientY - Editor.toolbarDrag.startY;
        const newLeft = Utils.clamp(Editor.toolbarDrag.offsetX + dx, 8, window.innerWidth - rect.width - 8);
        const newTop = Utils.clamp(Editor.toolbarDrag.offsetY + dy, 80, window.innerHeight - rect.height - 120);
        Editor.els.toolbar.style.left = `${newLeft}px`;
        Editor.els.toolbar.style.top = `${newTop}px`;
        Editor.els.toolbar.style.bottom = 'auto';
    },

    stopDragToolbar: () => {
        if (!Editor.toolbarDrag.active) return;
        Editor.toolbarDrag.active = false;
        Editor.els.toolbar.classList.remove('dragging');
        const rect = Editor.els.toolbar.getBoundingClientRect();
        const snapThreshold = 40;
        let left = rect.left;
        if (left < snapThreshold) left = 8;
        if (window.innerWidth - rect.right < snapThreshold) left = window.innerWidth - rect.width - 8;
        Editor.els.toolbar.style.left = `${left}px`;
        Editor.saveToolbarPosition();
        document.removeEventListener('pointermove', Editor.dragToolbar);
        document.removeEventListener('pointerup', Editor.stopDragToolbar);
    },

    saveToolbarPosition() {
        if (!this.els.toolbar.classList.contains('floating')) return;
        const rect = this.els.toolbar.getBoundingClientRect();
        localStorage.setItem('toolbar-position', JSON.stringify({ left: rect.left, top: rect.top }));
    },

    loadToolbarPosition() {
        const saved = localStorage.getItem('toolbar-position');
        if (!saved) return;
        try {
            const pos = JSON.parse(saved);
            if (typeof pos.left === 'number' && typeof pos.top === 'number') {
                this.els.toolbar.style.left = `${pos.left}px`;
                this.els.toolbar.style.top = `${pos.top}px`;
                this.els.toolbar.style.bottom = 'auto';
            }
        } catch (e) {
            return;
        }
    },

    showToolbar() {
        clearTimeout(this.toolbarHideTimer);
        if (!this.isToolbarVisible()) return;
        this.els.toolbar.classList.remove('auto-hidden');
    },

    scheduleHideToolbar() {
        clearTimeout(this.toolbarHideTimer);
        if (!this.els.toolbar.classList.contains('floating') || !this.isToolbarVisible()) return;
        this.toolbarHideTimer = setTimeout(() => {
            this.els.toolbar.classList.add('auto-hidden');
        }, 1800);
    },

    applyToolbarMode() {
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        if (isMobile) {
            this.els.toolbar.classList.add('floating');
            this.loadToolbarPosition();
            this.showToolbar();
        } else {
            this.els.toolbar.classList.remove('floating');
            this.els.toolbar.classList.remove('auto-hidden');
            this.els.toolbar.style.left = '';
            this.els.toolbar.style.top = '';
            this.els.toolbar.style.bottom = '';
        }
    },

    loadToolbarVisibility() {
        const saved = localStorage.getItem('editor-toolbar-visible');
        this.toolbarVisible = saved === null ? true : saved === 'true';
    },

    setToolbarVisibility(visible) {
        this.toolbarVisible = visible;
        localStorage.setItem('editor-toolbar-visible', String(visible));
        this.updateToolbarVisibility();
        this.updateToolbarToggle();
        if (visible) {
            this.showToolbar();
        }
    },

    updateToolbarToggle() {
        if (!this.els.toolbarToggle || !this.els.toolbarToggleIcon) return;
        const dict = LANG[state.config.lang] || LANG.ru;
        const isVisible = this.isToolbarVisible();
        this.els.toolbarToggleIcon.textContent = isVisible ? 'expand_less' : 'expand_more';
        const label = isVisible ? (dict.hide_toolbar || 'Hide toolbar') : (dict.show_toolbar || 'Show toolbar');
        this.els.toolbarToggle.setAttribute('aria-label', label);
    },

    hasActiveTools() {
        return this.config.some(tool => tool.active);
    },

    isToolbarVisible() {
        return this.toolbarVisible && this.hasActiveTools();
    },

    updateToolbarVisibility() {
        const visible = this.isToolbarVisible();
        this.els.toolbar.classList.toggle('is-hidden', !visible);
        if (!visible) {
            this.els.toolbar.classList.remove('auto-hidden');
        }
    },

    handleResize: (e) => {
        if (!Editor.resizeState) return;
        const { startX, startWidth, ratio, maxWidth } = Editor.resizeState;
        const deltaX = e.clientX - startX;
        let nextWidth = startWidth + deltaX;
        nextWidth = Utils.snap(nextWidth, 8);
        nextWidth = Utils.clamp(nextWidth, 120, maxWidth);
        const nextHeight = nextWidth / ratio;
        const img = Editor.resizeState.wrapper.querySelector('img');
        if (!img) return;
        img.style.width = `${nextWidth}px`;
        img.style.height = `${nextHeight}px`;
        Editor.resizeState.wrapper.dataset.width = `${nextWidth}`;
        Editor.resizeState.wrapper.dataset.height = `${nextHeight}`;
    },

    stopResize: () => {
        if (!Editor.resizeState) return;
        Editor.queueSnapshot();
        Editor.resizeState = null;
        document.removeEventListener('pointermove', Editor.handleResize);
        document.removeEventListener('pointerup', Editor.stopResize);
    },

    open(note = null) {
        state.currentNote = note ? JSON.parse(JSON.stringify(note)) : {
            id: Utils.generateId(),
            title: '',
            content: '',
            tags: [],
            folderId: state.view === 'folder' ? state.activeFolderId : null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            order: Date.now()
        };

        this.history = [];
        this.future = [];
        this.renderState();
        this.els.wrapper.classList.add('active');
        setTimeout(() => this.els.content.focus(), 100);
    },

    renderState() {
        const n = state.currentNote;
        this.els.title.value = n.title || '';
        this.els.content.innerHTML = n.content || '';
        this.migrateLegacyTasks();
        this.renderTags();
        this.makeMediaDraggable();
        this.syncTaskStates();
    },

    insertMedia(src, type) {
        const id = Utils.generateId();
        let html = '';
        if (type === 'image') {
            html = `<div class="media-wrapper" id="${id}" contenteditable="false" draggable="true" data-scale="1"><img src="${src}" alt=""><span class="media-resize-handle" aria-hidden="true"></span></div><br>`;
        }
        document.execCommand('insertHTML', false, html);
        this.queueSnapshot();
        this.makeMediaDraggable();
    },

    selectMedia(el) {
        if (this.selectedMedia) this.selectedMedia.classList.remove('selected');
        this.selectedMedia = el;
        this.selectedMedia.classList.add('selected');

        const rect = el.getBoundingClientRect();
        const menu = this.els.ctxMenu;
        menu.classList.remove('hidden');
        menu.style.top = `${rect.top + window.scrollY - 50}px`;
        menu.style.left = `${(rect.left + rect.width / 2) - (menu.offsetWidth / 2)}px`;
    },

    deselectMedia() {
        if (this.selectedMedia) this.selectedMedia.classList.remove('selected');
        this.selectedMedia = null;
        this.els.ctxMenu.classList.add('hidden');
    },

    deleteSelectedMedia() {
        if (this.selectedMedia) {
            this.selectedMedia.remove();
            this.deselectMedia();
            this.queueSnapshot();
        }
    },

    resetMediaTransform() {
        if (!this.selectedMedia) return;
        const img = this.selectedMedia.querySelector('img');
        if (!img) return;
        img.style.width = '';
        img.style.height = '';
        this.selectedMedia.dataset.width = '';
        this.selectedMedia.dataset.height = '';
        this.queueSnapshot();
    },

    alignMedia(align) {
        if (this.selectedMedia) {
            this.selectedMedia.style.display = 'block';
            this.selectedMedia.style.textAlign = align;
            this.selectedMedia.style.margin = align === 'center' ? '10px auto' : (align === 'right' ? '10px 0 10px auto' : '10px 0');
            this.queueSnapshot();
        }
    },

    alignMediaOrText(align) {
        if (this.selectedMedia) {
            this.alignMedia(align);
            return;
        }
        const commands = { left: 'justifyLeft', center: 'justifyCenter', right: 'justifyRight' };
        const cmd = commands[align];
        if (cmd) {
            document.execCommand(cmd, false, null);
        }
    },

    getRangeFromPoint(x, y) {
        if (document.caretRangeFromPoint) {
            return document.caretRangeFromPoint(x, y);
        }
        if (document.caretPositionFromPoint) {
            const position = document.caretPositionFromPoint(x, y);
            const range = document.createRange();
            range.setStart(position.offsetNode, position.offset);
            range.collapse(true);
            return range;
        }
        return null;
    },

    makeMediaDraggable() {
        this.els.content.querySelectorAll('.media-wrapper').forEach(wrapper => {
            wrapper.setAttribute('draggable', 'true');
        });
    },

    saveSelection() {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        this.savedRange = selection.getRangeAt(0).cloneRange();
    },

    restoreSelection() {
        if (!this.savedRange) return;
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(this.savedRange);
    },

    applyFontSize(size) {
        this.activeFontSize = size;
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        const span = document.createElement('span');
        span.style.fontSize = `${size}px`;
        if (range.collapsed) {
            span.appendChild(document.createTextNode('​'));
            range.insertNode(span);
            const newRange = document.createRange();
            newRange.setStart(span.firstChild, 1);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            this.savedRange = newRange.cloneRange();
        } else {
            const contents = range.extractContents();
            span.appendChild(contents);
            range.insertNode(span);
            selection.removeAllRanges();
            const newRange = document.createRange();
            newRange.selectNodeContents(span);
            newRange.collapse(false);
            selection.addRange(newRange);
            this.savedRange = newRange.cloneRange();
        }
        this.queueSnapshot();
    },

    cleanupZeroWidth() {
        const nodes = this.els.content.querySelectorAll('span');
        nodes.forEach(node => {
            if (node.textContent === '​') {
                node.textContent = '';
            }
        });
    },

    insertTaskListFromSelection() {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        const dict = LANG[state.config.lang] || LANG.ru;
        const fallbackLabel = dict.task_item || 'Task';
        let targetRange = range;
        let lines = [];

        if (range.collapsed) {
            const block = this.getClosestBlock(range.startContainer);
            if (block && block !== this.els.content) {
                targetRange = document.createRange();
                targetRange.selectNode(block);
                lines = block.innerText.split(/\n+/);
            } else {
                lines = [range.startContainer.textContent || ''];
            }
        } else {
            const fragment = range.cloneContents();
            const container = document.createElement('div');
            container.appendChild(fragment);
            lines = container.innerText.split(/\n+/);
        }

        const normalized = lines.map(line => line.replace(/\u200B/g, ''));
        const trimmed = normalized.map(line => line.trim());
        const hasContent = trimmed.some(line => line !== '');
        const finalLines = hasContent ? trimmed : [fallbackLabel];

        targetRange.deleteContents();
        const list = this.buildTaskList(finalLines, fallbackLabel);
        targetRange.insertNode(list);
        this.placeCursorAtTask(list);
        this.queueSnapshot();
    },

    getClosestBlock(node) {
        if (!node) return null;
        const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
        if (!element) return null;
        return element.closest('.task-item, li, p, div, blockquote');
    },

    buildTaskList(lines, fallbackLabel) {
        const list = document.createElement('ul');
        list.className = 'task-list';
        lines.forEach(line => {
            const item = document.createElement('li');
            item.className = 'task-item';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'task-checkbox';
            checkbox.setAttribute('contenteditable', 'false');
            checkbox.setAttribute('aria-label', line || fallbackLabel);
            const text = document.createElement('span');
            text.className = 'task-text';
            text.textContent = line || '';
            item.append(checkbox, text);
            list.appendChild(item);
        });
        return list;
    },

    placeCursorAtTask(list) {
        const selection = window.getSelection();
        const target = list.querySelector('.task-item:last-child .task-text');
        if (!selection || !target) return;
        const newRange = document.createRange();
        newRange.selectNodeContents(target);
        newRange.collapse(false);
        selection.removeAllRanges();
        selection.addRange(newRange);
    },

    syncTaskStates() {
        this.els.content.querySelectorAll('.task-item').forEach(item => {
            const checkbox = item.querySelector('.task-checkbox');
            if (checkbox) item.classList.toggle('checked', checkbox.checked);
        });
    },

    migrateLegacyTasks() {
        const legacyTasks = this.els.content.querySelectorAll('.task-line');
        if (!legacyTasks.length) return;
        legacyTasks.forEach(line => {
            const text = line.querySelector('.task-text')?.textContent || '';
            const checked = line.classList.contains('checked');
            const item = document.createElement('li');
            item.className = 'task-item' + (checked ? ' checked' : '');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'task-checkbox';
            checkbox.checked = checked;
            checkbox.setAttribute('contenteditable', 'false');
            const span = document.createElement('span');
            span.className = 'task-text';
            span.textContent = text;
            item.append(checkbox, span);
            const list = document.createElement('ul');
            list.className = 'task-list';
            list.appendChild(item);
            line.replaceWith(list);
        });
        this.queueSnapshot();
    },

    exec(cmd, val = null, action = '') {
        this.els.content.focus();
        const actions = {
            toggleSizeSlider: () => {
                const target = document.querySelector('[data-action="toggleSizeSlider"]');
                if (!target) return;
                const rect = target.getBoundingClientRect();
                this.saveSelection();
                const wasHidden = this.els.sizePopup.classList.contains('hidden');
                if (wasHidden) {
                    this.els.sizePopup.classList.remove('hidden');
                }
                const popupHeight = this.els.sizePopup.getBoundingClientRect().height || 0;
                const top = Math.max(12, rect.top - popupHeight - 12);
                this.els.sizePopup.style.left = `${rect.left + rect.width / 2}px`;
                this.els.sizePopup.style.top = `${top}px`;
                this.els.sizePopup.style.bottom = 'auto';
                if (wasHidden) {
                    const active = this.activeFontSize || this.fontSizes[2];
                    const idx = this.fontSizes.indexOf(active);
                    this.els.sizeRange.value = idx === -1 ? 3 : idx + 1;
                } else {
                    this.els.sizePopup.classList.add('hidden');
                }
            },
            task: () => {
                this.insertTaskListFromSelection();
            },
            align_left: () => this.alignMediaOrText('left'),
            align_center: () => this.alignMediaOrText('center'),
            align_right: () => this.alignMediaOrText('right'),
            voice: () => VoiceService.toggle(),
            image: () => document.getElementById('img-upload').click(),
            sketch: () => { UI.openModal('sketch-modal'); SketchService.init(); },
            clear: () => document.execCommand('removeFormat')
        };

        if (action && actions[action]) {
            actions[action]();
        } else if (actions[cmd]) {
            actions[cmd]();
        } else {
            document.execCommand(cmd, false, val);
        }
        this.queueSnapshot();
        this.updateToolbarState();
    },

    updateToolbarState() {},

    queueSnapshot() {
        clearTimeout(this.snapshotTimer);
        this.snapshotTimer = setTimeout(() => this.snapshot(), 250);
    },

    snapshot() {
        const current = {
            t: this.els.title.value,
            c: this.els.content.innerHTML,
            tags: [...(state.currentNote.tags || [])]
        };

        const last = this.history[this.history.length - 1];
        if (last && last.t === current.t && last.c === current.c && JSON.stringify(last.tags) === JSON.stringify(current.tags)) return;

        this.history.push(current);
        if (this.history.length > 80) this.history.shift();
        this.future = [];
        this.triggerSave();
    },

    undo() {
        if (!this.history.length) return;
        this.future.push(this.getCurrentState());
        this.applyState(this.history.pop());
    },

    redo() {
        if (!this.future.length) return;
        this.history.push(this.getCurrentState());
        this.applyState(this.future.pop());
    },

    getCurrentState() {
        return {
            t: this.els.title.value,
            c: this.els.content.innerHTML,
            tags: [...state.currentNote.tags]
        };
    },

    applyState(data) {
        if (!data) return;
        this.els.title.value = data.t;
        this.els.content.innerHTML = data.c;
        state.currentNote.tags = data.tags;
        this.renderTags();
        this.triggerSave();
    },

    triggerSave() {
        clearTimeout(this.timer);
        document.getElementById('last-edited').innerText = UI.getText('saving', 'Saving...');
        this.timer = setTimeout(() => this.save(), 800);
    },

    async save() {
        if (!state.user || !state.currentNote) return;

        state.currentNote.title = this.els.title.value;
        state.currentNote.content = this.els.content.innerHTML;
        state.currentNote.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        state.currentNote.authorId = state.user.uid;
        if (!state.currentNote.order) state.currentNote.order = Date.now();

        try {
            await db.collection('users').doc(state.user.uid)
                .collection('notes').doc(state.currentNote.id)
                .set(state.currentNote, { merge: true });
            document.getElementById('last-edited').innerText = UI.getText('saved', 'Saved');
        } catch (e) {
            console.error('Save failed:', e);
        }
    },

    async manualSave() {
        await this.save();
        this.close();
    },

    deleteCurrent() {
        UI.confirm('delete', async () => {
            if (state.currentNote.id) {
                await db.collection('users').doc(state.user.uid).collection('notes').doc(state.currentNote.id).delete();
            }
            this.close(true);
        });
    },

    close(skip = false) {
        if (!skip) this.save();
        this.els.wrapper.classList.remove('active');
        state.currentNote = null;
    },

    renderToolbar() {
        const dict = LANG[state.config.lang] || LANG.ru;
        const activeTools = this.config.filter(t => t.active);
        if (!activeTools.length) {
            this.els.toolbar.innerHTML = '';
            this.updateToolbarVisibility();
            this.updateToolbarToggle();
            return;
        }
        const handle = `<button type="button" class="tool-btn toolbar-handle" aria-label="${Utils.escapeHtml(dict.move_toolbar || 'Move toolbar')}"><i class="material-icons-round">drag_indicator</i></button>`;
        this.els.toolbar.innerHTML = handle + activeTools.map(t => {
            if (t.color) return `
                <div class="tool-wrapper">
                    <label class="tool-btn"><i class="material-icons-round" style="color:var(--text)">${t.icon}</i>
                    <input type="color" class="hidden-color-input" onchange="Editor.exec('${t.cmd}', this.value)" aria-label="${Utils.escapeHtml(dict[`tool_${t.id}`] || t.id)}">
                    </label>
                </div>`;
            return `<button type="button" class="tool-btn" data-action="${t.action || ''}" onmousedown="event.preventDefault(); Editor.exec('${t.cmd}', '${t.val || ''}', '${t.action || ''}')" aria-label="${Utils.escapeHtml(dict[`tool_${t.id}`] || t.id)}"><i class="material-icons-round">${t.icon}</i></button>`;
        }).join('');
        this.updateToolbarVisibility();
        this.updateToolbarToggle();
    },

    addTag(tag) {
        if (!state.currentNote.tags) state.currentNote.tags = [];
        if (!state.currentNote.tags.includes(tag)) {
            state.currentNote.tags.push(tag);
            this.renderTags();
        }
    },

    removeTag(tag) {
        state.currentNote.tags = state.currentNote.tags.filter(t => t !== tag);
        this.renderTags();
        this.queueSnapshot();
    },

    renderTags() {
        const tags = state.currentNote.tags || [];
        this.els.tagsContainer.innerHTML = tags.map(t => {
            const escaped = Utils.escapeHtml(t);
            const encoded = encodeURIComponent(t);
            return `<button type="button" class="tag-chip" data-tag="${encoded}">#${escaped}<i class="material-icons-round" aria-hidden="true">close</i></button>`;
        }).join('');
    },

    toggleTask(el) {
        const item = el.closest('.task-item');
        if (item) item.classList.toggle('checked', el.checked);
        this.queueSnapshot();
    }
};

// ==========================================================================
// UI Controller
// ==========================================================================


const UI = {
    els: {},
    currentNoteActionId: null,
    draggedNoteId: null,
    dragTargetId: null,
    dragPosition: null,
    visibleNotes: [],

    init() {
        this.els = {
            sidebar: document.getElementById('sidebar'),
            grid: document.getElementById('notes-container'),
            empty: document.getElementById('empty-state'),
            userMenu: document.getElementById('user-dropdown'),
            confirmModal: document.getElementById('confirm-modal'),
            promptModal: document.getElementById('prompt-modal'),
            fab: document.querySelector('.btn-fab'),
            folderList: document.getElementById('folder-list-root')
        };
        this.bindEvents();
        this.applyAppearanceSettings();
        this.updatePrimaryActionLabel();
    },

    getText(key, fallback = '') {
        const dict = LANG[state.config.lang] || LANG.ru;
        return dict[key] || fallback || key;
    },

    bindEvents() {
        document.addEventListener('click', (e) => {
            if (this.els.sidebar.classList.contains('active') && !this.els.sidebar.contains(e.target) && !e.target.closest('#menu-toggle')) {
                this.toggleSidebar(false);
            }
            if (this.els.userMenu.classList.contains('active') && !e.target.closest('.user-avatar-wrapper')) {
                this.toggleUserMenu(false);
            }
        });

        document.querySelectorAll('.star').forEach(star => {
            star.onclick = () => {
                const val = parseInt(star.dataset.val, 10);
                state.tempRating = val;
                document.querySelectorAll('.star').forEach(s => {
                    s.textContent = parseInt(s.dataset.val, 10) <= val ? 'star' : 'star_border';
                    s.classList.toggle('active', parseInt(s.dataset.val, 10) <= val);
                });
            };
        });

        document.getElementById('prompt-input').onkeydown = (e) => {
            if (e.key === 'Enter') document.getElementById('prompt-ok').click();
        };

        document.body.addEventListener('click', e => {
            if (e.target.tagName === 'A' && e.target.getAttribute('href')?.startsWith('#note/')) {
                e.preventDefault();
                const id = e.target.getAttribute('href').replace('#note/', '');
                const note = state.notes.find(n => n.id === id);
                if (note) Editor.open(note);
            }
        });

        this.els.grid.addEventListener('click', (e) => {
            const card = e.target.closest('.note-card');
            const actions = e.target.closest('.action-btn');
            if (actions) return;
            if (!card) return;
            const id = card.dataset.noteId ? decodeURIComponent(card.dataset.noteId) : null;
            const note = state.notes.find(n => n.id === id);
            if (note) Editor.open(note);
        });

        this.els.grid.addEventListener('dragstart', (e) => {
            const card = e.target.closest('.note-card');
            if (!card) return;
            this.draggedNoteId = decodeURIComponent(card.dataset.noteId);
            card.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', this.draggedNoteId);
        });

        this.els.grid.addEventListener('dragend', (e) => {
            const card = e.target.closest('.note-card');
            if (card) card.classList.remove('dragging');
            this.clearDragIndicators();
            this.draggedNoteId = null;
        });

        this.els.grid.addEventListener('dragover', (e) => {
            if (!this.draggedNoteId) return;
            e.preventDefault();
            const card = e.target.closest('.note-card');
            if (!card) return;
            const rect = card.getBoundingClientRect();
            const position = (e.clientY - rect.top) / rect.height > 0.5 ? 'after' : 'before';
            this.setDropIndicator(card, position);
            this.dragTargetId = decodeURIComponent(card.dataset.noteId);
            this.dragPosition = position;
            this.autoScroll(e.clientY);
        });

        this.els.grid.addEventListener('drop', (e) => {
            if (!this.draggedNoteId || !this.dragTargetId) return;
            e.preventDefault();
            this.reorderNotes(this.draggedNoteId, this.dragTargetId, this.dragPosition);
            this.clearDragIndicators();
        });

        document.getElementById('note-import').addEventListener('change', (e) => this.handleNoteImport(e));
    },

    toggleSidebar(force) { this.els.sidebar.classList.toggle('active', force); },
    toggleUserMenu(force) { this.els.userMenu.classList.toggle('active', force); },

    applyAppearanceSettings() {
        const saved = JSON.parse(localStorage.getItem('app-preferences')) || {};
        state.config.folderViewMode = saved.folderViewMode || state.config.folderViewMode;
        state.config.reduceMotion = saved.reduceMotion || false;
        this.syncFolderModeButtons();
        const toggle = document.getElementById('reduce-motion-toggle');
        if (toggle) {
            toggle.classList.toggle('on', state.config.reduceMotion);
            toggle.classList.toggle('off', !state.config.reduceMotion);
        }
        ThemeManager.revertToLastSaved();
        this.renderFolders();
    },

    syncFolderModeButtons() {
        document.querySelectorAll('[data-folder-mode]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.folderMode === state.config.folderViewMode);
        });
    },

    setFolderViewMode(mode) {
        state.config.folderViewMode = mode;
        localStorage.setItem('app-preferences', JSON.stringify({
            folderViewMode: state.config.folderViewMode,
            reduceMotion: state.config.reduceMotion
        }));
        this.syncFolderModeButtons();
        this.renderFolders();
        if (state.view === 'folders') {
            switchView('folders');
        }
    },

    toggleReduceMotion() {
        state.config.reduceMotion = !state.config.reduceMotion;
        localStorage.setItem('app-preferences', JSON.stringify({
            folderViewMode: state.config.folderViewMode,
            reduceMotion: state.config.reduceMotion
        }));
        const toggle = document.getElementById('reduce-motion-toggle');
        if (toggle) {
            toggle.classList.toggle('on', state.config.reduceMotion);
            toggle.classList.toggle('off', !state.config.reduceMotion);
        }
        ThemeManager.revertToLastSaved();
    },

    openModal(id) {
        document.getElementById(id).classList.add('active');
        this.toggleSidebar(false);
        if (id === 'settings-modal' || id === 'appearance-modal' || id === 'editor-settings-modal') {
            this.loadSettings();
        }
    },

    closeModal(id) {
        document.getElementById(id).classList.remove('active');
        if (id === 'appearance-modal') ThemeManager.revertToLastSaved();

        if (id === 'about-modal') {
            document.querySelector('.team-list').innerHTML = `
                <li class="team-member name-alexandrov">Александров Арсений</li>
                <li class="team-member name-malyshev">Малышев Егор</li>
                <li class="team-member name-kopaev">Копаев Иван</li>
                <li class="team-member name-minyaev">Миняев Иван</li>
             `;
        }
    },

    openSettings() { this.openModal('settings-modal'); },
    closeSettings() { this.closeModal('settings-modal'); },
    showConfirm(type, cb) { this.confirm(type, cb); },

    confirm(type, cb) {
        const titles = {
            delete: this.getText('confirm_delete', 'Delete?'),
            exit: this.getText('confirm_exit', 'Sign out?'),
            account: this.getText('confirm_account', 'Switch account?'),
            delete_f: this.getText('confirm_delete_folder', 'Delete folder?')
        };
        document.getElementById('confirm-title').textContent = titles[type] || this.getText('confirm_default', 'Confirm');

        const okBtn = document.getElementById('confirm-ok');
        const newBtn = okBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newBtn, okBtn);

        newBtn.onclick = () => {
            cb();
            this.els.confirmModal.classList.remove('active');
        };

        this.els.confirmModal.classList.add('active');
        document.getElementById('confirm-cancel').onclick = () => this.els.confirmModal.classList.remove('active');
    },

    showPrompt(title, placeholder, cb) {
        const modal = this.els.promptModal;
        const input = document.getElementById('prompt-input');
        const ok = document.getElementById('prompt-ok');
        const cancel = document.getElementById('prompt-cancel');

        document.getElementById('prompt-title').textContent = title;
        input.value = '';
        input.placeholder = placeholder;

        const finish = (val) => {
            if (val) cb(val);
            modal.classList.remove('active');
            input.onkeydown = null;
        };

        const okClone = ok.cloneNode(true);
        ok.parentNode.replaceChild(okClone, ok);

        okClone.onclick = () => finish(input.value.trim());
        cancel.onclick = () => modal.classList.remove('active');

        modal.classList.add('active');
        setTimeout(() => input.focus(), 100);
    },

    renderFolders() {
        const root = this.els.folderList;
        if (!root) return;
        const hideList = state.config.folderViewMode === 'full';
        root.classList.toggle('hidden', hideList);
        if (hideList) {
            root.innerHTML = '';
            return;
        }
        root.innerHTML = state.folders.map(f => `
            <button type="button" class="nav-item ${state.activeFolderId === f.id ? 'active' : ''}" onclick="switchView('folder', '${f.id}')">
                <i class="material-icons-round">folder</i>
                <span>${Utils.escapeHtml(f.name)}</span>
                <i class="material-icons-round" style="margin-left:auto; opacity:0.5; font-size:16px" onclick="event.stopPropagation(); deleteFolder('${f.id}')">close</i>
            </button>
        `).join('');
    },

    renderFolderGrid() {
        this.updateEmptyState('folder_open', this.getText('folders_empty', 'No folders yet'));
        this.els.empty.classList.toggle('hidden', state.folders.length > 0);
        this.els.grid.classList.add('folder-grid');
        this.els.grid.innerHTML = state.folders.map(folder => {
            const count = state.notes.filter(note => note.folderId === folder.id && !note.isArchived).length;
            const label = count === 1 ? this.getText('note_single', 'note') : this.getText('note_plural', 'notes');
            return `
                <div class="folder-card" onclick="switchView('folder', '${folder.id}')">
                    <div class="folder-title">${Utils.escapeHtml(folder.name)}</div>
                    <div class="folder-meta">${count} ${label}</div>
                </div>
            `;
        }).join('');
    },

    renderNotes(notes) {
        this.updateEmptyState('note_add', this.getText('empty', 'Nothing here yet'));
        this.els.grid.classList.remove('folder-grid');
        this.els.empty.classList.toggle('hidden', notes.length > 0);
        this.els.grid.innerHTML = notes.map(n => `
            <div class="note-card" data-note-id="${encodeURIComponent(n.id)}" draggable="true">
                <div class="card-actions">
                    <button type="button" class="action-btn ${n.isPinned ? 'active' : ''}" onclick="event.stopPropagation(); toggleProp('${n.id}', 'isPinned', ${!n.isPinned})" aria-label="${this.getText('pin_note', 'Pin')}">
                        <i class="material-icons-round">push_pin</i>
                    </button>
                    <button type="button" class="action-btn ${n.isImportant ? 'active' : ''}" onclick="event.stopPropagation(); toggleProp('${n.id}', 'isImportant', ${!n.isImportant})" aria-label="${this.getText('favorite_note', 'Favorite')}">
                        <i class="material-icons-round">star</i>
                    </button>
                    <button type="button" class="action-btn" onclick="event.stopPropagation(); toggleProp('${n.id}', 'isArchived', ${!n.isArchived})" aria-label="${this.getText('archive_note', 'Archive')}">
                        <i class="material-icons-round">${n.isArchived ? 'unarchive' : 'archive'}</i>
                    </button>
                    <button type="button" class="action-btn action-more" onclick="event.stopPropagation(); UI.openNoteActions('${n.id}')" aria-label="${this.getText('note_actions', 'Actions')}">
                        <i class="material-icons-round">more_vert</i>
                    </button>
                </div>
                <h3>${Utils.escapeHtml(n.title || this.getText('untitled_note', 'Untitled'))}</h3>
                <p>${Utils.escapeHtml(Utils.stripHtml(n.content) || this.getText('empty_note', 'No content'))}</p>
                <div class="tags-list">
                    ${(n.tags || []).map(t => `<span class="tag-chip">#${Utils.escapeHtml(t)}</span>`).join('')}
                </div>
            </div>
        `).join('');
    },

    openNoteActions(noteId) {
        this.currentNoteActionId = noteId;
        this.openModal('note-actions-modal');
    },

    updateEmptyState(icon, text) {
        const iconEl = this.els.empty.querySelector('i');
        const textEl = this.els.empty.querySelector('p');
        if (iconEl) iconEl.textContent = icon;
        if (textEl) textEl.textContent = text;
    },

    downloadSelectedNote() {
        const note = state.notes.find(n => n.id === this.currentNoteActionId);
        if (!note) return;
        const exportData = NoteIO.exportNote(note);
        const blob = new Blob([exportData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = NoteIO.fileNameFor(note);
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        this.showToast(this.getText('download_success', 'Downloaded'));
        this.closeModal('note-actions-modal');
    },

    async uploadSelectedNote() {
        const note = state.notes.find(n => n.id === this.currentNoteActionId);
        if (!note) return;
        await DriveService.uploadNote(note);
        this.closeModal('note-actions-modal');
    },

    triggerImport() {
        const input = document.getElementById('note-import');
        input.value = '';
        input.click();
    },

    async handleNoteImport(e) {
        if (!db || !state.user) return;
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.includes('json')) {
            this.showToast(this.getText('import_invalid', 'Unsupported file'));
            return;
        }
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const text = String(reader.result || '').replace(/^\uFEFF/, '');
                const parsed = JSON.parse(text);
                const notes = NoteIO.parseImport(parsed);
                if (!notes.length) {
                    this.showToast(this.getText('import_empty', 'No notes found'));
                    return;
                }
                const batch = db.batch();
                notes.forEach(note => {
                    if (state.notes.some(n => n.id === note.id)) {
                        note.id = Utils.generateId();
                    }
                    if (note.folderId && !state.folders.find(f => f.id === note.folderId)) {
                        note.folderId = null;
                    }
                    const ref = db.collection('users').doc(state.user.uid).collection('notes').doc(note.id);
                    batch.set(ref, note, { merge: true });
                });
                await batch.commit();
                this.showToast(this.getText('import_success', 'Imported'));
            } catch (err) {
                console.error(err);
                this.showToast(this.getText('import_failed', 'Import failed'));
            }
        };
        reader.onerror = () => this.showToast(this.getText('import_failed', 'Import failed'));
        reader.readAsText(file, 'utf-8');
    },

    primaryAction() {
        if (state.view === 'folders') {
            if (state.folders.length >= 10) return this.showToast(this.getText('folder_limit', 'Folder limit reached'));
            this.showPrompt(this.getText('new_folder', 'New folder'), this.getText('folder_placeholder', 'Folder name'), async (name) => {
                await db.collection('users').doc(state.user.uid).collection('folders').add({
                    name,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });
            return;
        }
        Editor.open();
    },

    showToast(msg, options = {}) {
        const div = document.createElement('div');
        div.className = 'toast show';
        div.setAttribute('role', 'status');
        const text = document.createElement('span');
        text.textContent = msg;
        div.appendChild(text);
        if (options.actionLabel && options.onAction) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'toast-action';
            btn.textContent = options.actionLabel;
            btn.onclick = () => {
                options.onAction();
                div.remove();
            };
            div.appendChild(btn);
        }
        document.getElementById('toast-container').appendChild(div);
        setTimeout(() => { div.classList.remove('show'); setTimeout(() => div.remove(), 300); }, options.duration || 2500);
    },

    loadSettings() {
        const style = getComputedStyle(document.documentElement);
        ['text', 'primary', 'bg'].forEach(k => {
            const el = document.getElementById(`cp-${k}`);
            if (el) el.value = style.getPropertyValue(`--${k}`).trim();
        });
        this.renderToolsConfig();
        this.syncFolderModeButtons();
        const toggle = document.getElementById('reduce-motion-toggle');
        if (toggle) {
            toggle.classList.toggle('on', state.config.reduceMotion);
            toggle.classList.toggle('off', !state.config.reduceMotion);
        }
    },

    saveAppearance() {
        const p = document.getElementById('cp-primary').value;
        const bg = document.getElementById('cp-bg').value;
        const t = document.getElementById('cp-text').value;
        ThemeManager.setManual(p, bg, t);
        this.closeModal('appearance-modal');
    },

    renderToolsConfig() {
        const root = document.getElementById('tools-config-root');
        if (root) {
            const dict = LANG[state.config.lang] || LANG.ru;
            root.innerHTML = Editor.config.map((t, i) => `
                <div class="tool-toggle-item">
                    <div class="tool-info"><i class="material-icons-round">${t.icon}</i><span>${dict[`tool_${t.id}`] || t.id}</span></div>
                    <button type="button" class="toggle-btn ${t.active ? 'on' : 'off'}" onclick="UI.toggleTool(${i})"></button>
                </div>
            `).join('');
        }
    },

    toggleTool(idx) {
        Editor.config[idx].active = !Editor.config[idx].active;
        localStorage.setItem('editor-tools', JSON.stringify(Editor.config));
        this.renderToolsConfig();
        Editor.renderToolbar();
        Editor.updateToolbarVisibility();
        Editor.updateToolbarToggle();
    },

    setLang(lang) {
        state.config.lang = lang;
        localStorage.setItem('app-lang', lang);
        document.documentElement.lang = lang;
        document.title = this.getText('app_name', 'SmartNotes');
        document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.innerText.toLowerCase() === lang));
        const dict = LANG[lang];
        document.querySelectorAll('[data-lang]').forEach(el => {
            const k = el.getAttribute('data-lang');
            if (dict[k]) el.textContent = dict[k];
        });
        document.querySelectorAll('[data-lang-placeholder]').forEach(el => {
            const k = el.getAttribute('data-lang-placeholder');
            if (dict[k]) el.setAttribute('placeholder', dict[k]);
        });
        document.querySelectorAll('[data-lang-aria]').forEach(el => {
            const k = el.getAttribute('data-lang-aria');
            if (dict[k]) el.setAttribute('aria-label', dict[k]);
        });
        this.renderToolsConfig();
        this.updateViewTitle();
        this.updatePrimaryActionLabel();
        ThemeManager.renderPicker();
        Editor.updateToolbarToggle();
        switchView(state.view, state.activeFolderId);
    },

    updateViewTitle() {
        const dict = LANG[state.config.lang] || LANG.ru;
        const titles = {
            notes: dict.view_notes || 'Notes',
            favorites: dict.view_favorites || 'Favorites',
            archive: dict.view_archive || 'Archive',
            folder: dict.view_folder || 'Folder',
            folders: dict.view_folders || 'Folders'
        };
        let title = titles[state.view] || 'SmartNotes';
        if (state.view === 'folder' && state.activeFolderId) {
            const folder = state.folders.find(f => f.id === state.activeFolderId);
            if (folder) title = folder.name;
        }
        document.getElementById('current-view-title').textContent = title;
    },

    updatePrimaryActionLabel() {
        if (!this.els.fab) return;
        const label = state.view === 'folders' ? this.getText('create_folder', 'Create folder') : this.getText('create_note', 'Create note');
        this.els.fab.setAttribute('aria-label', label);
    },

    async submitFeedback() {
        const text = document.getElementById('feedback-text').value;
        if (!state.tempRating) return this.showToast(this.getText('rate_required', 'Please rate'));

        await db.collection('feedback').add({
            uid: state.user.uid, rating: state.tempRating, text, ts: firebase.firestore.FieldValue.serverTimestamp()
        });

        this.showToast(this.getText('feedback_thanks', 'Thanks!'));
        this.closeModal('rate-modal');
    },

    setDropIndicator(card, position) {
        this.clearDragIndicators();
        card.classList.add(position === 'before' ? 'drop-before' : 'drop-after');
    },

    clearDragIndicators() {
        this.els.grid.querySelectorAll('.note-card').forEach(card => {
            card.classList.remove('drop-before', 'drop-after');
        });
    },

    autoScroll(cursorY) {
        const container = document.getElementById('notes-content-area');
        const rect = container.getBoundingClientRect();
        const threshold = 80;
        if (cursorY < rect.top + threshold) {
            container.scrollBy({ top: -12, behavior: 'smooth' });
        } else if (cursorY > rect.bottom - threshold) {
            container.scrollBy({ top: 12, behavior: 'smooth' });
        }
    },

    reorderNotes(draggedId, targetId, position) {
        if (!db || !state.user) return;
        if (draggedId === targetId) return;
        const visibleIds = this.visibleNotes.map(n => n.id);
        const fromIndex = visibleIds.indexOf(draggedId);
        const toIndex = visibleIds.indexOf(targetId);
        if (fromIndex === -1 || toIndex === -1) return;
        visibleIds.splice(fromIndex, 1);
        const insertIndex = position === 'after' ? toIndex + 1 : toIndex;
        visibleIds.splice(insertIndex > fromIndex ? insertIndex - 1 : insertIndex, 0, draggedId);

        const previous = this.visibleNotes.map(n => ({ id: n.id, order: n.order || 0 }));
        state.orderHistory.push(previous);
        if (state.orderHistory.length > 20) state.orderHistory.shift();

        const updates = visibleIds.map((id, index) => ({ id, order: index + 1 }));
        updates.forEach(update => {
            const note = state.notes.find(n => n.id === update.id);
            if (note) note.order = update.order;
        });

        const batch = db.batch();
        updates.forEach(update => {
            const ref = db.collection('users').doc(state.user.uid).collection('notes').doc(update.id);
            batch.update(ref, { order: update.order });
        });
        batch.commit();
        this.showToast(this.getText('order_updated', 'Order updated'), {
            actionLabel: this.getText('undo', 'Undo'),
            onAction: () => this.undoOrder()
        });
        filterAndRender(document.getElementById('search-input')?.value || '');
    },

    undoOrder() {
        if (!db || !state.user) return;
        const last = state.orderHistory.pop();
        if (!last) return;
        const batch = db.batch();
        last.forEach(item => {
            const note = state.notes.find(n => n.id === item.id);
            if (note) note.order = item.order;
            const ref = db.collection('users').doc(state.user.uid).collection('notes').doc(item.id);
            batch.update(ref, { order: item.order });
        });
        batch.commit();
        filterAndRender(document.getElementById('search-input')?.value || '');
    }
};

// ==========================================================================
// Global Logic
// ==========================================================================

function initApp() {
    DriveService.init();
    ReminderService.init();
    Editor.init();
    UI.init();
    UI.setLang(localStorage.getItem('app-lang') || 'ru');

    if (!db || !state.user) {
        console.error('Database not available.');
        return;
    }

    // Data Sync
    db.collection('users').doc(state.user.uid).collection('folders')
        .orderBy('createdAt', 'asc').onSnapshot(snap => {
            state.folders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            UI.renderFolders();
        });

    db.collection('users').doc(state.user.uid).collection('notes')
        .onSnapshot(snap => {
            state.notes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            filterAndRender(document.getElementById('search-input')?.value);
        });
}

// Window Exposures (for HTML onclick binding)
window.switchView = (view, folderId = null) => {
    state.view = view;
    state.activeFolderId = folderId;

    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (!folderId) document.querySelector(`.nav-item[data-view="${view}"]`)?.classList.add('active');

    UI.updateViewTitle();
    UI.updatePrimaryActionLabel();

    UI.toggleSidebar(false);
    filterAndRender(document.getElementById('search-input').value);
    UI.renderFolders();
};

window.filterAndRender = (query = '') => {
    const q = query.toLowerCase().trim();
    if (state.view === 'folders') {
        UI.visibleNotes = [];
        UI.renderFolderGrid();
        return;
    }

    const res = state.notes.filter(n => {
        const title = n.title || '';
        const content = n.content || '';
        const match = (title + content).toLowerCase().includes(q) || (n.tags || []).some(t => t.toLowerCase().includes(q));
        if (state.view === 'notes') return match && !n.isArchived;
        if (state.view === 'favorites') return match && !n.isArchived && n.isImportant;
        if (state.view === 'archive') return match && n.isArchived;
        if (state.view === 'folder') return match && !n.isArchived && n.folderId === state.activeFolderId;
        return false;
    });

    const getUpdated = (n) => n.updatedAt?.seconds ? n.updatedAt.seconds : (n.updatedAt ? new Date(n.updatedAt).getTime() : 0);
    const sortByOrder = (a, b) => (a.order || 0) - (b.order || 0) || getUpdated(b) - getUpdated(a);
    const pinned = res.filter(n => n.isPinned);
    const rest = res.filter(n => !n.isPinned);
    const sorted = [...pinned.sort(sortByOrder), ...rest.sort(sortByOrder)];
    UI.visibleNotes = sorted;
    UI.renderNotes(sorted);
};

window.toggleProp = async (id, prop, val) => {
    if (!db || !state.user) return;
    const update = { [prop]: val };
    if (prop === 'isArchived' && val) update.isPinned = false;
    await db.collection('users').doc(state.user.uid).collection('notes').doc(id).update(update);
    if (prop === 'isArchived') UI.showToast(val ? UI.getText('archived', 'Archived') : UI.getText('restored', 'Restored'));
};

window.openNoteById = (id) => {
    const note = state.notes.find(n => n.id === id);
    if (note) Editor.open(note);
};

window.deleteFolder = (id) => {
    UI.confirm('delete_f', async () => {
        await db.collection('users').doc(state.user.uid).collection('folders').doc(id).delete();
        if (state.view === 'folder' && state.activeFolderId === id) switchView('notes');
    });
};

// Global Event Listeners
document.getElementById('add-folder-btn').onclick = () => {
    if (state.folders.length >= 10) return UI.showToast(UI.getText('folder_limit', 'Folder limit reached'));
    UI.showPrompt(UI.getText('new_folder', 'New folder'), UI.getText('folder_placeholder', 'Folder name'), async (name) => {
        await db.collection('users').doc(state.user.uid).collection('folders').add({
            name, createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    });
};

// System Override (Easter Egg)
let eggSeq = 0;
document.addEventListener('click', e => {
    if (e.target.classList.contains('name-kopaev')) eggSeq = 1;
    else if (e.target.classList.contains('name-minyaev') && eggSeq === 1) {
        document.querySelector('.team-list').innerHTML = `<li class="team-member" style="color:#00f2ff;font-size:1.5rem;text-shadow:0 0 20px #00f2ff">Тайлер²</li>`;
        UI.showToast(UI.getText('system_override', 'System Override'));
        eggSeq = 0;
    } else eggSeq = 0;
});
