/* ==========================================================================
   Services & Integrations
   ========================================================================== */

const DriveService = {
    client: null,
    token: null,
    
    async init() {
        if (typeof gapi === 'undefined' || typeof google === 'undefined') return;
        
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
    },

    handleTokenResponse(resp) {
        if (resp.error) return console.error(resp);
        this.token = resp.access_token;
        state.driveToken = resp.access_token;
        UI.showToast("Google Drive подключен");
        this.syncCurrentNote();
    },

    connect() {
        if (!this.client) return UI.showToast("Сервис Drive не доступен");
        this.client.requestAccessToken({ prompt: 'consent' });
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

    async toggle() {
        state.recording ? this.stop() : await this.start();
    },

    async start() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.recorder = new MediaRecorder(stream);
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
        state.recording = false;
        document.getElementById('voice-indicator').classList.remove('active');
    },

    processAudio() {
        const reader = new FileReader();
        reader.onloadend = () => {
            const html = `<br><audio controls src="${reader.result}"></audio><br>`;
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

    init() {
        this.canvas = document.getElementById('sketch-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.setupCanvas();
        this.bindEvents();
    },

    setupCanvas() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        this.ctx.strokeStyle = '#00f2ff';
    },

    bindEvents() {
        const start = (e) => {
            this.drawing = true;
            this.ctx.beginPath();
            this.draw(e);
        };
        const end = () => {
            this.drawing = false;
            this.ctx.closePath();
        };
        
        this.canvas.onmousedown = start;
        this.canvas.onmousemove = e => this.draw(e);
        this.canvas.onmouseup = end;
        this.canvas.onmouseout = end;
        
        this.canvas.ontouchstart = e => start(e.touches[0]);
        this.canvas.ontouchmove = e => { e.preventDefault(); this.draw(e.touches[0]); };
        this.canvas.ontouchend = end;
    },

    draw(e) {
        if (!this.drawing) return;
        const rect = this.canvas.getBoundingClientRect();
        this.ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        this.ctx.stroke();
    },

    save() {
        const html = `<img src="${this.canvas.toDataURL('image/png')}" class="note-sketch" style="max-width:100%; border-radius:12px; margin:10px 0;">`;
        document.execCommand('insertHTML', false, html);
        UI.closeModal('sketch-modal');
        Editor.snapshot();
    },

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
};

const ReminderService = {
    init() {
        if (Notification.permission !== "granted") Notification.requestPermission();
        setInterval(() => this.check(), 60000);
    },

    check() {
        const now = new Date();
        state.notes.forEach(note => {
            if (note.reminder && new Date(note.reminder) <= now && !note.reminderSent) {
                new Notification("SmartNotes", { body: note.title });
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

/* ==========================================================================
   Editor Logic
   ========================================================================== */

const Editor = {
    history: [],
    future: [],
    timer: null,
    config: [],

    init() {
        this.els = {
            title: document.getElementById('note-title'),
            content: document.getElementById('note-content-editable'),
            tags: document.getElementById('note-tags-input'),
            toolbar: document.getElementById('editor-toolbar'),
            wrapper: document.getElementById('note-editor')
        };
        
        this.loadConfig();
        this.renderToolbar();
        this.bindEvents();
    },

    configDefault: [
        { id: 'bold', icon: 'format_bold', cmd: 'bold', active: true },
        { id: 'italic', icon: 'format_italic', cmd: 'italic', active: true },
        { id: 'underline', icon: 'format_underlined', cmd: 'underline', active: true },
        { id: 'strike', icon: 'strikethrough_s', cmd: 'strikeThrough', active: true },
        { id: 'h1', icon: 'looks_one', cmd: 'formatBlock', val: 'H1', active: true },
        { id: 'h2', icon: 'looks_two', cmd: 'formatBlock', val: 'H2', active: true },
        { id: 'list_ul', icon: 'format_list_bulleted', cmd: 'insertUnorderedList', active: true },
        { id: 'list_ol', icon: 'format_list_numbered', cmd: 'insertOrderedList', active: true },
        { id: 'task', icon: 'check_circle', cmd: 'task', active: true },
        { id: 'color', icon: 'palette', cmd: 'foreColor', color: true, active: true },
        { id: 'highlight', icon: 'format_color_fill', cmd: 'hiliteColor', color: true, active: true },
        { id: 'clear', icon: 'format_clear', cmd: 'removeFormat', active: true },
        { id: 'voice', icon: 'mic', cmd: 'voice', active: true },
        { id: 'image', icon: 'image', cmd: 'image', active: true },
        { id: 'sketch', icon: 'brush', cmd: 'sketch', active: true },
        { id: 'drive', icon: 'cloud_upload', cmd: 'drive', active: true },
        { id: 'alarm', icon: 'alarm', cmd: 'alarm', active: true },
        { id: 'link', icon: 'link', cmd: 'link', active: true }
    ],

    loadConfig() {
        const saved = localStorage.getItem('editor-tools');
        this.config = saved ? JSON.parse(saved) : this.configDefault;
    },

    bindEvents() {
        const change = () => this.snapshot();
        this.els.title.oninput = change;
        this.els.content.oninput = change;
        
        this.els.tags.onkeydown = e => {
            if (e.key === 'Enter' && e.target.value.trim()) {
                this.addTag(e.target.value.trim().replace(/^#/, ''));
                e.target.value = '';
                this.snapshot();
            }
        };

        this.els.content.addEventListener('click', e => {
            if (e.target.classList.contains('task-checkbox')) this.toggleTask(e.target);
        });

        // Image Upload
        document.getElementById('img-upload').addEventListener('change', e => {
            if (e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = ev => {
                    document.execCommand('insertHTML', false, `<img src="${ev.target.result}" style="max-width:100%; border-radius:12px;">`);
                    this.snapshot();
                };
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
    },

    renderTags() {
        const container = document.getElementById('note-tags-container');
        container.innerHTML = (state.currentNote.tags || []).map(t => `
            <span class="tag-chip">#${t}<i class="material-icons-round" onclick="Editor.removeTag('${t}')">close</i></span>
        `).join('');
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

    exec(cmd, val = null) {
        this.els.content.focus();
        
        const actions = {
            task: () => {
                const id = Utils.generateId();
                const html = `<div class="task-line" id="${id}"><span class="task-checkbox" contenteditable="false"></span><span class="task-text">Задача</span></div><br>`;
                document.execCommand('insertHTML', false, html);
            },
            voice: () => VoiceService.toggle(),
            image: () => document.getElementById('img-upload').click(),
            sketch: () => { UI.openModal('sketch-modal'); SketchService.init(); },
            drive: () => DriveService.connect(),
            alarm: () => {
                const d = prompt("Дата (YYYY-MM-DDTHH:MM)");
                if (d) ReminderService.set(d);
            },
            link: () => {
                const url = prompt("URL или ID:");
                if (url) document.execCommand('insertHTML', false, `<a href="${url.startsWith('http') ? url : '#note/'+url}" class="internal-link" contenteditable="false">Ссылка</a>`);
            }
        };

        if (actions[cmd]) actions[cmd]();
        else document.execCommand(cmd, false, val);
        
        this.snapshot();
    },

    toggleTask(el) {
        el.closest('.task-line').classList.toggle('checked');
        this.snapshot();
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
            console.error(e);
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
        this.els.toolbar.innerHTML = this.config.map(t => {
            if (!t.active) return '';
            if (t.color) return `
                <div class="tool-wrapper">
                    <label class="tool-btn"><i class="material-icons-round" style="color:var(--text)">${t.icon}</i>
                    <input type="color" class="hidden-color-input" onchange="Editor.exec('${t.cmd}', this.value)">
                    </label>
                </div>`;
            return `<button class="tool-btn" onmousedown="event.preventDefault(); Editor.exec('${t.cmd}', '${t.val || ''}')"><i class="material-icons-round">${t.icon}</i></button>`;
        }).join('');
    }
};

/* ==========================================================================
   UI Controller
   ========================================================================== */

const UI = {
    init() {
        this.els = {
            sidebar: document.getElementById('sidebar'),
            grid: document.getElementById('notes-container'),
            empty: document.getElementById('empty-state'),
            userMenu: document.getElementById('user-dropdown')
        };
        
        this.bindEvents();
        this.renderToolsSettings();
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
        
        // Internal Linking
        document.body.addEventListener('click', e => {
            if (e.target.tagName === 'A' && e.target.getAttribute('href').startsWith('#note/')) {
                e.preventDefault();
                const id = e.target.getAttribute('href').replace('#note/', '');
                const note = state.notes.find(n => n.id === id);
                if (note) Editor.open(note);
            }
        });
    },

    toggleSidebar(state) {
        this.els.sidebar.classList.toggle('active', state);
    },

    toggleUserMenu(state) {
        this.els.userMenu.classList.toggle('active', state);
    },

    openModal(id) {
        document.getElementById(id).classList.add('active');
        this.toggleSidebar(false);
        if(id === 'settings-modal') this.loadSettings();
    },

    closeModal(id) {
        document.getElementById(id).classList.remove('active');
        if(id === 'settings-modal') ThemeManager.revertToLastSaved();
    },

    confirm(type, cb) {
        const el = document.getElementById('confirm-modal');
        const titles = { delete: 'Удалить?', exit: 'Выйти?', account: 'Сменить аккаунт?' };
        document.getElementById('confirm-title').textContent = titles[type] || 'Подтвердите';
        
        const okBtn = document.getElementById('confirm-ok');
        const newBtn = okBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newBtn, okBtn);
        
        newBtn.onclick = () => {
            cb();
            el.classList.remove('active');
        };
        
        el.classList.add('active');
        document.getElementById('confirm-cancel').onclick = () => el.classList.remove('active');
    },

    showToast(msg) {
        const div = document.createElement('div');
        div.className = 'toast show';
        div.textContent = msg;
        document.getElementById('toast-container').appendChild(div);
        setTimeout(() => {
            div.classList.remove('show');
            setTimeout(() => div.remove(), 300);
        }, 2000);
    },

    renderFolders() {
        const root = document.getElementById('folder-list-root');
        root.innerHTML = state.folders.map(f => `
            <button class="nav-item ${state.activeFolderId === f.id ? 'active' : ''}" onclick="switchView('folder', '${f.id}')">
                <i class="material-icons-round">folder</i>
                <span>${f.name}</span>
                <i class="material-icons-round" style="margin-left:auto; opacity:0.5; font-size:16px" 
                   onclick="event.stopPropagation(); deleteFolder('${f.id}')">close</i>
            </button>
        `).join('');
    },

    renderNotes(notes) {
        this.els.empty.classList.toggle('hidden', notes.length > 0);
        this.els.grid.innerHTML = notes.map(n => `
            <div class="note-card" onclick='openNoteById("${n.id}")'>
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
                <h3>${n.title || 'Без названия'}</h3>
                <p>${Utils.stripHtml(n.content) || 'Нет содержимого'}</p>
                <div class="tags-list">
                    ${(n.tags || []).map(t => `<span class="tag-chip">#${t}</span>`).join('')}
                </div>
            </div>
        `).join('');
    },

    loadSettings() {
        const style = getComputedStyle(document.documentElement);
        ['text', 'primary', 'bg'].forEach(k => {
            const el = document.getElementById(`cp-${k}`);
            if(el) el.value = style.getPropertyValue(`--${k}`).trim();
        });
    },

    saveSettings() {
        const p = document.getElementById('cp-primary').value;
        const bg = document.getElementById('cp-bg').value;
        const t = document.getElementById('cp-text').value;
        ThemeManager.setManual(p, bg, t);
        this.closeModal('settings-modal');
    },

    renderToolsSettings() {
        const root = document.getElementById('tools-config-root');
        if(!root) return;
        root.innerHTML = Editor.config.map((t, i) => `
            <div class="tool-toggle-item">
                <div class="tool-info"><i class="material-icons-round">${t.icon}</i><span>${t.id}</span></div>
                <button class="toggle-btn ${t.active ? 'on' : 'off'}" onclick="UI.toggleTool(${i})"></button>
            </div>
        `).join('');
    },

    toggleTool(idx) {
        Editor.config[idx].active = !Editor.config[idx].active;
        localStorage.setItem('editor-tools', JSON.stringify(Editor.config));
        this.renderToolsSettings();
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
    },

    async submitFeedback() {
        const text = document.getElementById('feedback-text').value;
        if (!state.tempRating) return this.showToast('Поставьте оценку');
        
        await db.collection('feedback').add({
            uid: state.user.uid,
            rating: state.tempRating,
            text,
            ts: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        this.showToast('Спасибо!');
        this.closeModal('rate-modal');
    }
};

/* ==========================================================================
   Global App Logic
   ========================================================================== */

function initApp() {
    DriveService.init();
    ReminderService.init();
    Editor.init();
    UI.init();
    UI.setLang(localStorage.getItem('app-lang') || 'ru');

    // Sync Logic
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

window.switchView = (view, folderId = null) => {
    state.view = view;
    state.activeFolderId = folderId;
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if(!folderId) document.querySelector(`.nav-item[data-view="${view}"]`)?.classList.add('active');
    
    const titles = { notes: 'Все записи', favorites: 'Важное', archive: 'Архив', folder: 'Папка' };
    document.getElementById('current-view-title').textContent = titles[view] || 'SmartNotes';
    
    UI.toggleSidebar(false);
    filterAndRender(document.getElementById('search-input').value);
    UI.renderFolders();
};

window.filterAndRender = (query = '') => {
    const q = query.toLowerCase().trim();
    let res = state.notes.filter(n => {
        const match = (n.title+n.content).toLowerCase().includes(q) || (n.tags||[]).some(t => t.includes(q));
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
    const update = { [prop]: val };
    if (prop === 'isArchived' && val) update.isPinned = false;
    await db.collection('users').doc(state.user.uid).collection('notes').doc(id).update(update);
    if(prop === 'isArchived') UI.showToast(val ? "В архиве" : "Восстановлено");
};

window.openNoteById = (id) => {
    const note = state.notes.find(n => n.id === id);
    if(note) Editor.open(note);
};

window.deleteFolder = (id) => {
    UI.confirm('delete', async () => {
        await db.collection('users').doc(state.user.uid).collection('folders').doc(id).delete();
        if(state.view === 'folder' && state.activeFolderId === id) switchView('notes');
    });
};

document.getElementById('add-folder-btn').onclick = async () => {
    if(state.folders.length >= 10) return UI.showToast("Лимит папок (10)");
    const name = prompt("Название папки:");
    if(name) {
        await db.collection('users').doc(state.user.uid).collection('folders').add({
            name, createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
};

// Easter Egg
let eggSeq = 0;
document.addEventListener('click', e => {
    if(e.target.classList.contains('name-kopaev')) eggSeq = 1;
    else if(e.target.classList.contains('name-minyaev') && eggSeq === 1) {
        const list = document.querySelector('.team-list');
        list.innerHTML = `<li class="team-member" style="color:#00f2ff;font-size:1.5rem;text-shadow:0 0 20px #00f2ff">Тайлер²</li>`;
        UI.showToast("System Override");
        eggSeq = 0;
    } else eggSeq = 0;
});
