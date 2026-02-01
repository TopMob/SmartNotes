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
        UI.showToast("Google Drive подключен");
        this.syncCurrentNote();
    },

    connect() {
        this.client ? this.client.requestAccessToken({ prompt: 'consent' }) : UI.showToast("Сервис Drive недоступен");
    },

    async syncCurrentNote() {
        if (!state.currentNote || !this.token) return;

        const metadata = {
            name: `SmartNote_${state.currentNote.title || 'Untitled'}.json`,
            mimeType: 'application/json',
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([JSON.stringify(state.currentNote)], { type: 'application/json' }));

        try {
            await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.token}` },
                body: form
            });
            UI.showToast("Сохранено в Drive");
        } catch (e) {
            console.error("Drive Sync Error", e);
            UI.showToast("Ошибка синхронизации");
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
            return UI.showToast("Микрофон не поддерживается");
        }
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.recorder = new MediaRecorder(this.stream);
            this.chunks = [];

            this.recorder.ondataavailable = e => this.chunks.push(e.data);
            this.recorder.onstop = () => this.processAudio();

            this.recorder.start();
            state.recording = true;

            UI.showToast("Запись...");
            document.getElementById('voice-indicator').classList.add('active');
        } catch (e) {
            UI.showToast("Нет доступа к микрофону");
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
            Editor.snapshot();
        };
        reader.readAsDataURL(new Blob(this.chunks, { type: 'audio/mp3' }));
    }
};

const SketchService = {
    canvas: null,
    ctx: null,
    drawing: false,
    history: [],
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
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.saveState();
    },

    bindEvents() {
        const getPos = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return { x: clientX - rect.left, y: clientY - rect.top };
        };

        const start = (e) => {
            this.drawing = true;
            this.ctx.beginPath();
            this.ctx.strokeStyle = this.els.color.value;
            this.ctx.lineWidth = this.els.width.value;
            const pos = getPos(e);
            this.ctx.moveTo(pos.x, pos.y);
        };

        const move = (e) => {
            if (!this.drawing) return;
            e.preventDefault();
            const pos = getPos(e);
            this.ctx.lineTo(pos.x, pos.y);
            this.ctx.stroke();
        };

        const end = () => {
            if (!this.drawing) return;
            this.drawing = false;
            this.ctx.closePath();
            this.saveState();
        };

        this.canvas.onmousedown = start;
        this.canvas.onmousemove = move;
        this.canvas.onmouseup = end;
        this.canvas.onmouseout = end;

        this.canvas.addEventListener('touchstart', start, { passive: true });
        this.canvas.addEventListener('touchmove', move, { passive: false });
        this.canvas.addEventListener('touchend', end, { passive: true });

        window.addEventListener('resize', Utils.debounce(() => this.resizeCanvas(), 150));
    },

    saveState() {
        if (this.history.length > 10) this.history.shift();
        this.history.push(this.canvas.toDataURL());
    },

    resizeCanvas() {
        if (!this.canvas) return;
        const prev = new Image();
        prev.src = this.canvas.toDataURL();
        prev.onload = () => {
            this.setupCanvas();
            this.ctx.drawImage(prev, 0, 0, this.canvas.width, this.canvas.height);
        };
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
        const html = `<div class="media-wrapper"><img src="${this.canvas.toDataURL('image/png')}" style="max-width:100%; border-radius:12px;"></div><br>`;
        document.execCommand('insertHTML', false, html);
        UI.closeModal('sketch-modal');
        Editor.snapshot();
    },

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.history = [];
        this.saveState();
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
                const title = note.title || "SmartNotes";
                new Notification("SmartNotes", { body: title });
                this.markAsSent(note.id);
            }
        });
    },

    set(dateStr) {
        if (!state.currentNote) return;
        state.currentNote.reminder = dateStr;
        state.currentNote.reminderSent = false;
        Editor.save();
        UI.showToast(`Напоминание: ${new Date(dateStr).toLocaleString()}`);
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
    config: [],
    selectedMedia: null,
    els: {},

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
        { id: 'drive', icon: 'cloud_upload', cmd: 'drive', active: true },
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
            ctxMenu: document.getElementById('media-context-menu')
        };

        this.loadConfig();
        this.renderToolbar();
        this.bindEvents();
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
        const change = () => {
            this.snapshot();
            this.updateToolbarState();
        };

        this.els.title.oninput = () => { this.snapshot(); this.triggerSave(); };
        this.els.content.oninput = change;

        // Tags
        this.els.tags.onkeydown = e => {
            if (e.key === 'Enter' && e.target.value.trim()) {
                this.addTag(e.target.value.trim().replace(/^#/, ''));
                e.target.value = '';
                this.snapshot();
            }
        };

        this.els.tagsContainer.addEventListener('click', (e) => {
            const chip = e.target.closest('.tag-chip');
            if (!chip || !chip.dataset.tag) return;
            const tag = decodeURIComponent(chip.dataset.tag);
            this.removeTag(tag);
        });

        // Editor Interactivity (Tasks, Media)
        this.els.content.addEventListener('click', e => {
            if (e.target.classList.contains('task-checkbox')) {
                this.toggleTask(e.target);
            }
            const mediaWrapper = e.target.closest('.media-wrapper');
            if (mediaWrapper) {
                this.selectMedia(mediaWrapper);
                e.stopPropagation();
            } else {
                this.deselectMedia();
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
            this.snapshot();
        });

        // Global Clicks (Context Menus)
        document.addEventListener('click', e => {
            if (!e.target.closest('.media-wrapper') && !e.target.closest('#media-context-menu')) {
                this.deselectMedia();
            }
            if (!e.target.closest('#text-size-popup') && !e.target.closest('[data-action="toggleSizeSlider"]')) {
                this.els.sizePopup.classList.add('hidden');
            }
        });

        // Font Size
        this.els.sizeRange.oninput = (e) => {
            this.restoreSelection();
            document.execCommand('fontSize', false, e.target.value);
            this.snapshot();
        };

        // Image Upload
        document.getElementById('img-upload').addEventListener('change', e => {
            if (e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = ev => this.insertMedia(ev.target.result, 'image');
                reader.readAsDataURL(e.target.files[0]);
            }
        });
    },

    open(note = null) {
        state.currentNote = note ? JSON.parse(JSON.stringify(note)) : {
            id: Utils.generateId(),
            title: '',
            content: '',
            tags: [],
            folderId: state.view === 'folder' ? state.activeFolderId : null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
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
        this.renderTags();
        this.makeMediaDraggable();
    },

    // Media Logic
    insertMedia(src, type) {
        const id = Utils.generateId();
        let html = '';
        if (type === 'image') {
            html = `<div class="media-wrapper" id="${id}" contenteditable="false" draggable="true"><img src="${src}" alt=""></div><br>`;
        }
        document.execCommand('insertHTML', false, html);
        this.snapshot();
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
            this.snapshot();
        }
    },

    alignMedia(align) {
        if (this.selectedMedia) {
            this.selectedMedia.style.display = 'block';
            this.selectedMedia.style.textAlign = align;
            this.selectedMedia.style.margin = align === 'center' ? '10px auto' : (align === 'right' ? '10px 0 10px auto' : '10px 0');
            this.snapshot();
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

    // Exec Commands
    exec(cmd, val = null) {
        this.els.content.focus();

        const actions = {
            toggleSizeSlider: () => {
                const target = document.querySelector('[data-action="toggleSizeSlider"]');
                if (!target) return;
                const rect = target.getBoundingClientRect();
                this.els.sizePopup.style.bottom = '60px';
                this.els.sizePopup.style.left = `${rect.left + rect.width / 2}px`;
                this.els.sizePopup.classList.toggle('hidden');
                if (!this.els.sizePopup.classList.contains('hidden')) {
                    this.saveSelection();
                }
            },
            task: () => {
                const id = Utils.generateId();
                const label = LANG[state.config.lang]?.task_item || 'Задача';
                const html = `<div class="task-line" id="${id}"><span class="task-checkbox" contenteditable="false"></span><span class="task-text">${Utils.escapeHtml(label)}</span></div>`;
                document.execCommand('insertHTML', false, html);
                const taskText = this.els.content.querySelector(`#${id} .task-text`);
                if (taskText) {
                    const range = document.createRange();
                    range.selectNodeContents(taskText);
                    range.collapse(false);
                    const selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            },
            align_left: () => this.alignMediaOrText('left'),
            align_center: () => this.alignMediaOrText('center'),
            align_right: () => this.alignMediaOrText('right'),
            voice: () => VoiceService.toggle(),
            image: () => document.getElementById('img-upload').click(),
            sketch: () => { UI.openModal('sketch-modal'); SketchService.init(); },
            drive: () => DriveService.connect(),
            clear: () => document.execCommand('removeFormat')
        };

        actions[cmd] ? actions[cmd]() : document.execCommand(cmd, false, val);

        this.snapshot();
        this.updateToolbarState();
    },

    updateToolbarState() {
        // Placeholder for advanced state reflection (e.g. bold button highlight)
    },

    // History & Persistence
    snapshot() {
        const current = {
            t: this.els.title.value,
            c: this.els.content.innerHTML,
            tags: [...(state.currentNote.tags || [])]
        };

        const last = this.history[this.history.length - 1];
        if (last && last.t === current.t && last.c === current.c && JSON.stringify(last.tags) === JSON.stringify(current.tags)) return;

        this.history.push(current);
        if (this.history.length > 30) this.history.shift();
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
        document.getElementById('last-edited').innerText = '...';
        this.timer = setTimeout(() => this.save(), 800);
    },

    async save() {
        if (!state.user || !state.currentNote) return;

        state.currentNote.title = this.els.title.value;
        state.currentNote.content = this.els.content.innerHTML;
        state.currentNote.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        state.currentNote.authorId = state.user.uid;

        try {
            await db.collection('users').doc(state.user.uid)
                .collection('notes').doc(state.currentNote.id)
                .set(state.currentNote, { merge: true });
            document.getElementById('last-edited').innerText = 'Сохранено';
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

    // Toolbar & Tags
    renderToolbar() {
        this.els.toolbar.innerHTML = this.config.map(t => {
            if (!t.active) return '';
            if (t.color) return `
                <div class="tool-wrapper">
                    <label class="tool-btn"><i class="material-icons-round" style="color:var(--text)">${t.icon}</i>
                    <input type="color" class="hidden-color-input" onchange="Editor.exec('${t.cmd}', this.value)" aria-label="${Utils.escapeHtml(LANG[state.config.lang]?.[t.labelKey] || t.id)}">
                    </label>
                </div>`;
            return `<button class="tool-btn" data-action="${t.action || ''}" onmousedown="event.preventDefault(); Editor.exec('${t.cmd}', '${t.val || ''}')" aria-label="${Utils.escapeHtml(LANG[state.config.lang]?.[t.labelKey] || t.id)}"><i class="material-icons-round">${t.icon}</i></button>`;
        }).join('');
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
        this.snapshot();
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
        el.closest('.task-line').classList.toggle('checked');
        this.snapshot();
    }
};

// ==========================================================================
// UI Controller
// ==========================================================================

const UI = {
    els: {},

    init() {
        this.els = {
            sidebar: document.getElementById('sidebar'),
            grid: document.getElementById('notes-container'),
            empty: document.getElementById('empty-state'),
            userMenu: document.getElementById('user-dropdown'),
            confirmModal: document.getElementById('confirm-modal'),
            promptModal: document.getElementById('prompt-modal')
        };
        this.bindEvents();
        this.loadSettings();
    },

    bindEvents() {
        document.onclick = (e) => {
            if (this.els.sidebar.classList.contains('active') && !this.els.sidebar.contains(e.target) && !e.target.closest('#menu-toggle')) {
                this.toggleSidebar(false);
            }
            if (this.els.userMenu.classList.contains('active') && !e.target.closest('.user-avatar-wrapper')) {
                this.toggleUserMenu(false);
            }
        };

        // Star Rating
        document.querySelectorAll('.star').forEach(star => {
            star.onclick = () => {
                const val = parseInt(star.dataset.val);
                state.tempRating = val;
                document.querySelectorAll('.star').forEach(s => {
                    s.textContent = parseInt(s.dataset.val) <= val ? 'star' : 'star_border';
                    s.classList.toggle('active', parseInt(s.dataset.val) <= val);
                });
            };
        });

        // Prompt Input Key
        document.getElementById('prompt-input').onkeydown = (e) => {
            if (e.key === 'Enter') document.getElementById('prompt-ok').click();
        };

        // Internal Links
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
            if (!card || e.target.closest('.action-btn')) return;
            const id = card.dataset.noteId ? decodeURIComponent(card.dataset.noteId) : null;
            const note = state.notes.find(n => n.id === id);
            if (note) Editor.open(note);
        });
    },

    toggleSidebar(force) { this.els.sidebar.classList.toggle('active', force); },
    toggleUserMenu(force) { this.els.userMenu.classList.toggle('active', force); },

    // Modals
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

        // Reset Easter Egg on Close
        if (id === 'about-modal') {
            document.querySelector('.team-list').innerHTML = `
                <li class="team-member name-alexandrov">Александров Арсений</li>
                <li class="team-member name-malyshev">Малышев Егор</li>
                <li class="team-member name-kopaev">Копаев Иван</li>
                <li class="team-member name-minyaev">Миняев Иван</li>
             `;
        }
    },

    // Shortcuts
    openSettings() { this.openModal('settings-modal'); },
    closeSettings() { this.closeModal('settings-modal'); },
    showConfirm(type, cb) { this.confirm(type, cb); },

    // Native-like Dialogs
    confirm(type, cb) {
        const titles = { delete: 'Удалить?', exit: 'Выйти?', account: 'Сменить аккаунт?', delete_f: 'Удалить папку?' };
        document.getElementById('confirm-title').textContent = titles[type] || 'Подтвердите';

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

    // Renderers
    renderFolders() {
        const root = document.getElementById('folder-list-root');
        if (!root) return;
        root.innerHTML = state.folders.map(f => `
            <button class="nav-item ${state.activeFolderId === f.id ? 'active' : ''}" onclick="switchView('folder', '${f.id}')">
                <i class="material-icons-round">folder</i>
                <span>${Utils.escapeHtml(f.name)}</span>
                <i class="material-icons-round" style="margin-left:auto; opacity:0.5; font-size:16px" 
                   onclick="event.stopPropagation(); deleteFolder('${f.id}')">close</i>
            </button>
        `).join('');
    },

    renderNotes(notes) {
        this.els.empty.classList.toggle('hidden', notes.length > 0);
        this.els.grid.innerHTML = notes.map(n => `
            <div class="note-card" data-note-id="${encodeURIComponent(n.id)}">
                <div class="card-actions">
                    <button class="action-btn ${n.isPinned ? 'active' : ''}" onclick="event.stopPropagation(); toggleProp('${n.id}', 'isPinned', ${!n.isPinned})">
                        <i class="material-icons-round">push_pin</i>
                    </button>
                    <button class="action-btn ${n.isImportant ? 'active' : ''}" onclick="event.stopPropagation(); toggleProp('${n.id}', 'isImportant', ${!n.isImportant})">
                        <i class="material-icons-round">star</i>
                    </button>
                    <button class="action-btn" onclick="event.stopPropagation(); toggleProp('${n.id}', 'isArchived', ${!n.isArchived})">
                        <i class="material-icons-round">${n.isArchived ? 'unarchive' : 'archive'}</i>
                    </button>
                </div>
                <h3>${Utils.escapeHtml(n.title || 'Без названия')}</h3>
                <p>${Utils.escapeHtml(Utils.stripHtml(n.content) || 'Нет содержимого')}</p>
                <div class="tags-list">
                    ${(n.tags || []).map(t => `<span class="tag-chip">#${Utils.escapeHtml(t)}</span>`).join('')}
                </div>
            </div>
        `).join('');
    },

    showToast(msg) {
        const div = document.createElement('div');
        div.className = 'toast show';
        div.textContent = msg;
        document.getElementById('toast-container').appendChild(div);
        setTimeout(() => { div.classList.remove('show'); setTimeout(() => div.remove(), 300); }, 2000);
    },

    // Settings & Feedback
    loadSettings() {
        const style = getComputedStyle(document.documentElement);
        ['text', 'primary', 'bg'].forEach(k => {
            const el = document.getElementById(`cp-${k}`);
            if (el) el.value = style.getPropertyValue(`--${k}`).trim();
        });
        this.renderToolsConfig();
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
                    <button class="toggle-btn ${t.active ? 'on' : 'off'}" onclick="UI.toggleTool(${i})"></button>
                </div>
            `).join('');
        }
    },

    toggleTool(idx) {
        Editor.config[idx].active = !Editor.config[idx].active;
        localStorage.setItem('editor-tools', JSON.stringify(Editor.config));
        this.renderToolsConfig();
        Editor.renderToolbar();
    },

    setLang(lang) {
        state.config.lang = lang;
        localStorage.setItem('app-lang', lang);
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
        this.renderToolsConfig();
        switchView(state.view, state.activeFolderId);
    },

    async submitFeedback() {
        const text = document.getElementById('feedback-text').value;
        if (!state.tempRating) return this.showToast('Поставьте оценку');

        await db.collection('feedback').add({
            uid: state.user.uid, rating: state.tempRating, text, ts: firebase.firestore.FieldValue.serverTimestamp()
        });

        this.showToast('Спасибо!');
        this.closeModal('rate-modal');
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

    const titles = { notes: 'Все записи', favorites: 'Важное', archive: 'Архив', folder: 'Папка' };
    document.getElementById('current-view-title').textContent = titles[view] || 'SmartNotes';

    UI.toggleSidebar(false);
    filterAndRender(document.getElementById('search-input').value);
    UI.renderFolders();
};

window.filterAndRender = (query = '') => {
    const q = query.toLowerCase().trim();
    let res = state.notes.filter(n => {
        const title = n.title || '';
        const content = n.content || '';
        const match = (title + content).toLowerCase().includes(q) || (n.tags || []).some(t => t.toLowerCase().includes(q));
        if (state.view === 'notes') return match && !n.isArchived;
        if (state.view === 'favorites') return match && !n.isArchived && n.isImportant;
        if (state.view === 'archive') return match && n.isArchived;
        if (state.view === 'folder') return match && !n.isArchived && n.folderId === state.activeFolderId;
        return false;
    });

    res.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) || (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
    UI.renderNotes(res);
};

window.toggleProp = async (id, prop, val) => {
    if (!db || !state.user) return;
    const update = { [prop]: val };
    if (prop === 'isArchived' && val) update.isPinned = false;
    await db.collection('users').doc(state.user.uid).collection('notes').doc(id).update(update);
    if (prop === 'isArchived') UI.showToast(val ? "В архиве" : "Восстановлено");
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
    if (state.folders.length >= 10) return UI.showToast("Лимит папок (10)");
    UI.showPrompt("Новая папка", "Название...", async (name) => {
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
        UI.showToast("System Override");
        eggSeq = 0;
    } else eggSeq = 0;
});
