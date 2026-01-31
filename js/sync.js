const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbzGKif-JQDq1VwV80lq9EfvczgYelkm39cuz7QzimbZUZfJA49SuT2Hw_tO82WLssPe/exec';

(function() {
    async function send(payload) {
        try {
            await fetch(GOOGLE_SHEET_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(payload)
            });
        } catch (e) {
            console.error(e);
        }
    }

    function formatNoteData(docId, d, user, type = 'save') {
        let status = [];
        if (d.isPinned) status.push("Закреплен");
        if (d.isImportant) status.push("Важное");
        if (d.isArchived) status.push("В архиве");
        if (status.length === 0) status.push("Обычная");

        let folder = "Общее";
        if (window.state && window.state.folders && d.folderId) {
            const f = window.state.folders.find(f => f.id === d.folderId);
            if (f) folder = f.name;
        }

        return {
            action: type,
            noteId: docId,
            date: new Date().toLocaleString('ru-RU'),
            user: user ? user.email : (window.state?.user?.email || 'Anonymous'),
            title: d.title || 'Без заголовка',
            content: d.content || '',
            folder: folder,
            status: status.join(', '),
            tags: Array.isArray(d.tags) ? d.tags.join(', ') : ''
        };
    }

    auth.onAuthStateChanged(user => {
        if (!user) return;

        db.collection('users').doc(user.uid).collection('notes')
            .onSnapshot(snapshot => {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'removed') {
                        send({ action: 'delete', noteId: change.doc.id });
                    } else {
                        send(formatNoteData(change.doc.id, change.doc.data(), user));
                    }
                });
            });
    });

    const checkEditor = setInterval(() => {
        if (window.Editor && window.Editor.save) {
            const originalSave = window.Editor.save;
            window.Editor.save = async function() {
                const res = await originalSave.apply(this, arguments);
                if (window.state && window.state.currentNote) {
                    send(formatNoteData(window.state.currentNote.id, window.state.currentNote, auth.currentUser));
                }
                return res;
            };
            clearInterval(checkEditor);
        }
    }, 1000);
})();
