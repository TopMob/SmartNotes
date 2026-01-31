const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbyX6A5beNHNj7Dy0tfn6wdRQIXGlXysbvVM0SFX6WNAGwd9KZSnT-3uWqo6nupMQNk/exec';

(function() {
    const NoteSync = {
        async send(payload) {
            try {
                await fetch(GOOGLE_SHEET_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } catch (e) {
                console.error("Sync error:", e);
            }
        },

        getFolderName(folderId) {
            if (typeof state !== 'undefined' && state.folders && folderId) {
                const folder = state.folders.find(f => f.id === folderId);
                return folder ? folder.name : 'Общее';
            }
            return 'Общее';
        },

        getUserIdentifier() {
            if (typeof state !== 'undefined' && state.user) {
                return state.user.email || state.user.displayName || 'User';
            }
            return 'Anonymous';
        }
    };

    if (typeof Editor !== 'undefined') {
        const originalSave = Editor.save;
        Editor.save = async function() {
            const result = await originalSave.apply(this, arguments);
            const note = state.currentNote;
            
            if (note && note.id) {
                NoteSync.send({
                    action: 'save',
                    noteId: note.id,
                    title: note.title || 'Без названия',
                    content: note.content || '',
                    folder: NoteSync.getFolderName(note.folderId),
                    tags: Array.isArray(note.tags) ? note.tags.join(', ') : '',
                    author: NoteSync.getUserIdentifier()
                });
            }
            return result;
        };

        const originalDelete = Editor.deleteCurrent;
        Editor.deleteCurrent = async function() {
            const noteIdToDelete = state.currentNote ? state.currentNote.id : null;
            
            if (noteIdToDelete) {
                NoteSync.send({
                    action: 'delete',
                    noteId: noteIdToDelete
                });
            }

            return await originalDelete.apply(this, arguments);
        };
    }

    if (typeof UI !== 'undefined' && UI.deleteNote) {
        const originalUIDelete = UI.deleteNote;
        UI.deleteNote = async function(noteId) {
            if (noteId) {
                NoteSync.send({
                    action: 'delete',
                    noteId: noteId
                });
            }
            return await originalUIDelete.apply(this, arguments);
        };
    }

    window.addEventListener('online', () => {
        console.log("Sync active");
    });
    if (typeof db !== 'undefined') {
        const originalCollection = db.collection;
        db.collection = function(name) {
            const col = originalCollection.apply(this, arguments);
            if (name === 'notes') {
                const originalDoc = col.doc;
                col.doc = function(id) {
                    const docRef = originalDoc.apply(this, arguments);
                    const originalDelete = docRef.delete;
                    docRef.delete = async function() {
                        if (id) {
                            NoteSync.send({
                                action: 'delete',
                                noteId: id
                            });
                        }
                        return await originalDelete.apply(this, arguments);
                    };
                    return docRef;
                };
            }
            return col;
        };
    }

    document.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.btn-delete-all');
        if (deleteBtn && typeof state !== 'undefined' && state.notes) {
            state.notes.forEach(note => {
                NoteSync.send({
                    action: 'delete',
                    noteId: note.id
                });
            });
        }
    });

    console.log("Sync engine fully loaded");
})();
