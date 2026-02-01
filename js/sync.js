const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbxUyXXRjxGjpCZzNJyPsnziKRHvOPxseU279Cf8r8mmLB0MyhsQuJDmIMOBkN4fKrHr/exec';

(function() {
    const syncTimers = {};

    const sendToSheet = (data) => {
        fetch(GOOGLE_SHEET_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(data)
        }).catch(console.error);
    };

    const dispatch = (data) => {
        const id = data.noteId;
        if (syncTimers[id]) clearTimeout(syncTimers[id]);

        syncTimers[id] = setTimeout(() => {
            sendToSheet(data);
            delete syncTimers[id];
        }, 3000);
    };

    const formatNote = (id, data, user, action) => {
        let folderName = "Общее";
        if (window.state && window.state.folders && data.folderId) {
            const foundFolder = window.state.folders.find(f => f.id === data.folderId);
            if (foundFolder) folderName = foundFolder.name;
        }

        return {
            action: action,
            noteId: id,
            user: user.email || 'Anonymous',
            title: data.title || '',
            content: data.content || '',
            folder: folderName,
            isPinned: data.isPinned ? "Да" : "Нет",
            isImportant: data.isImportant ? "Да" : "Нет",
            isArchived: data.isArchived ? "Да" : "Нет",
            tags: Array.isArray(data.tags) ? data.tags.join(', ') : (data.tags || "")
        };
    };

    auth.onAuthStateChanged(user => {
        if (!user) return;

        db.collection('users').doc(user.uid).collection('notes')
            .onSnapshot(snapshot => {
                snapshot.docChanges().forEach(change => {
                    const id = change.doc.id;
                    const data = change.doc.data();

                    if (change.type === 'removed') {
                        dispatch({ action: 'delete', noteId: id });
                    } else {
                        const hasContent = (data.title && data.title.length > 0) || (data.content && data.content.length > 0);
                        
                        if (hasContent) {
                            dispatch(formatNote(id, data, user, 'save'));
                        }
                    }
                });
            });
    });
})();
