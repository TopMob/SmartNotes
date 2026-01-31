const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycby3v6HgSOk92HuWoc3D3hRB8urMH5sIkb38Q8JizUZycDTKEkiI2oHXqAdsgp9WCj5r/exec';

(function() {
    let syncQueue = null;

    const dispatch = (data) => {
        if (syncQueue) clearTimeout(syncQueue);
        syncQueue = setTimeout(() => {
            fetch(GOOGLE_SHEET_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(data)
            }).catch(console.error);
        }, 3000);
    };

    const formatNote = (id, data, user, action) => {
        let folderName = "Общее";
        if (window.state?.folders && data.folderId) {
            folderName = window.state.folders.find(f => f.id === data.folderId)?.name || "Общее";
        }

        return {
            action,
            noteId: id,
            uid: user?.uid || '',
            date: new Date().toLocaleString('ru-RU'),
            user: user?.email || 'Anonymous',
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
                    const data = change.doc.data();
                    const id = change.doc.id;

                    if (change.type === 'removed') {
                        dispatch({ action: 'delete', noteId: id });
                    } else {
                        const isValid = (data.title?.length > 2 || data.content?.length > 5);
                        if (isValid && !data._isAiUpdating) {
                            dispatch(formatNote(id, data, user, 'save'));
                        }
                    }
                });
            });
    });
})();



