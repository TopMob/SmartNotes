const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbx53OdiUUZXzPfSVpIuzQBl4aPHCok2V0H0hU0gnLRXFlLwWeRY-W4AnyLQw7BxlzI/exec';

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

        isEmpty(note) {
            if (!note) return true;
            const title = (note.title || '').trim();
            const content = (note.content || '').trim();
            return title === '' && content === '';
        }
    };

    if (typeof Editor !== 'undefined') {
        const originalSave = Editor.save;
        Editor.save = async function() {
            const result = await originalSave.apply(this, arguments);
            const note = state.currentNote;
            
            if (note && note.id) {
                if (NoteSync.isEmpty(note)) {
                    NoteSync.send({
                        action: 'delete',
                        noteId: note.id
                    });
                } else {
                    NoteSync.send({
                        action: 'save',
                        noteId: note.id,
                        title: note.title || '',
                        content: note.content || '',
                        folder: NoteSync.getFolderName(note.folderId),
                        tags: Array.isArray(note.tags) ? note.tags.join(', ') : '',
                        author: state.user ? (state.user.email || state.user.displayName) : 'User'
                    });
                }
            }
            return result;
        };

        const originalClose = Editor.close;
        Editor.close = async function() {
            const note = state.currentNote;
            if (note && note.id && NoteSync.isEmpty(note)) {
                NoteSync.send({
                    action: 'delete',
                    noteId: note.id
                });
            }
            return await originalClose.apply(this, arguments);
        };

        const originalDelete = Editor.deleteCurrent;
        Editor.deleteCurrent = async function() {
            const noteId = state.currentNote ? state.currentNote.id : null;
            if (noteId) {
                NoteSync.send({
                    action: 'delete',
                    noteId: noteId
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

    window.addEventListener('beforeunload', () => {
        const note = (typeof state !== 'undefined') ? state.currentNote : null;
        if (note && note.id && NoteSync.isEmpty(note)) {
            NoteSync.send({
                action: 'delete',
                noteId: note.id
            });
        }
    });

    console.log("Sync engine with empty-note-cleanup active");
})();
