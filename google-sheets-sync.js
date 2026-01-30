const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxVCg0fKMRe27IXrTd0u6Lj3GAOG-ygeidgjFnB-R2czj5F5PSPN9zfjNnLiaTlLx8/exec';

class NoteSyncManager {
    constructor(apiUrl) {
        this.apiUrl = apiUrl;
    }

    async syncNote(noteData) {
        const payload = this._preparePayload(noteData);
        
        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                mode: 'no-cors',
                cache: 'no-cache',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            return { success: true, timestamp: payload.timestamp };
        } catch (error) {
            console.error('Sync Error:', error);
            return { success: false, error: error.message };
        }
    }

    _preparePayload(data) {
        return {
            timestamp: new Date().toISOString(),
            title: data.title || 'Без названия',
            content: data.text || data.content || '',
            category: data.category || data.folder || 'Общее',
            tags: Array.isArray(data.tags) ? data.tags.join(', ') : (data.tags || ''),
            sourceUrl: window.location.href,
            author: data.author || 'Anonymous'
        };
    }

    observeForms(formSelector, fieldsMap) {
        const form = document.querySelector(formSelector);
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            const formData = new FormData(form);
            const noteData = {};
            
            for (const [key, value] of Object.entries(fieldsMap)) {
                noteData[key] = formData.get(value);
            }

            await this.syncNote(noteData);
        });
    }

    injectIntoFirebase(originalSaveFunction) {
        return async (...args) => {
            const result = await originalSaveFunction(...args);
            const noteData = args[0]; 
            
            if (noteData) {
                this.syncNote(noteData);
            }
            
            return result;
        };
    }
}

const NoteSync = new NoteSyncManager(GOOGLE_SCRIPT_URL);

window.syncNoteToSheet = (data) => NoteSync.syncNote(data);

if (typeof db !== 'undefined' && typeof saveNote === 'function') {
    const originalSave = saveNote;
    window.saveNote = NoteSync.injectIntoFirebase(originalSave);
}

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('save-note-btn') || e.target.id === 'save-button') {
        const titleEl = document.querySelector('#note-title');
        const contentEl = document.querySelector('#note-content');
        
        if (titleEl && contentEl) {
            NoteSync.syncNote({
                title: titleEl.value || titleEl.innerText,
                text: contentEl.value || contentEl.innerText,
                category: document.querySelector('#note-category')?.value || 'Web'
            });
        }
    }
});
