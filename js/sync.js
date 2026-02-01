/**
 * SmartNotes - Synchronization Service
 * Handles data transmission to Google Sheets via Web App
 */

const SYNC_CONFIG = {
    ENDPOINT: 'АПИСЮДА', // Вставьте ваш URL от Google Apps Script
    DEBOUNCE_MS: 3000,
    BATCH_LIMIT: 50000 // Лимит символов для ячейки Google Sheets (примерно)
};

const SyncService = {
    queue: new Map(),

    init() {
        // Wait for Auth to be ready
        auth.onAuthStateChanged(user => {
            if (user) this.startListening(user);
        });
    },

    startListening(user) {
        db.collection('users').doc(user.uid).collection('notes')
            .onSnapshot(snapshot => {
                snapshot.docChanges().forEach(change => {
                    const data = change.doc.data();
                    const id = change.doc.id;

                    if (change.type === 'removed') {
                        // Mark as in trash instead of hard delete in Sheet
                        this.schedule(id, this.formatPayload(id, data, user, true));
                    } else {
                        // Skip system updates or empty notes
                        if (data._isAiUpdating || (!data.title && !data.content)) return;
                        this.schedule(id, this.formatPayload(id, data, user, false));
                    }
                });
            });
    },

    schedule(id, payload) {
        if (this.queue.has(id)) {
            clearTimeout(this.queue.get(id));
        }

        const timer = setTimeout(() => {
            this.send(payload);
            this.queue.delete(id);
        }, SYNC_CONFIG.DEBOUNCE_MS);

        this.queue.set(id, timer);
    },

    async send(payload) {
        if (!SYNC_CONFIG.ENDPOINT || SYNC_CONFIG.ENDPOINT === 'АПИСЮДА') return;

        try {
            await fetch(SYNC_CONFIG.ENDPOINT, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(payload)
            });
        } catch (e) {
            console.error('Sync Transmission Failed:', e);
        }
    },

    formatPayload(id, data, user, isDeleted) {
        // Folder Name Resolution
        const folderId = data.folderId;
        const folderName = window.state?.folders?.find(f => f.id === folderId)?.name || "Общее";

        // Content Processing (Strip HTML for cleaner sheet view)
        const plainText = this.stripHtml(data.content || "");
        
        // Attachment Detection (Count images/audio in HTML)
        const attachments = this.detectAttachments(data.content || "");

        return {
            noteId: id,
            uid: user.uid,
            email: user.email || 'Anonymous',
            title: data.title || "Без названия",
            content: plainText.substring(0, SYNC_CONFIG.BATCH_LIMIT), // Prevent overflow
            tags: Array.isArray(data.tags) ? data.tags.join(', ') : "",
            folder: folderName,
            isPinned: data.isPinned ? "Да" : "Нет",
            isImportant: data.isImportant ? "Да" : "Нет",
            isArchived: data.isArchived ? "Да" : "Нет",
            isTrash: isDeleted ? "Да" : "Нет",
            attachments: attachments
        };
    },

    stripHtml(html) {
        const tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        return (tmp.textContent || tmp.innerText || "").trim();
    },

    detectAttachments(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        const imgs = div.querySelectorAll('img').length;
        const audio = div.querySelectorAll('audio').length;
        
        const types = [];
        if (imgs > 0) types.push(`${imgs} фото`);
        if (audio > 0) types.push(`${audio} аудио`);
        
        return types.length > 0 ? types.join(', ') : "Нет";
    }
};

// Initialize
SyncService.init();
