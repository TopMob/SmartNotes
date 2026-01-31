const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbzBCA0UaxWKRy5aUpZtoN8OXvlOQnwnJMtTjaScU6oYgK6E8V2fuet3KIyWZ0oH9Ybg/exec'; 

(function() {
    let syncTimeout;

    function send(payload) {
        clearTimeout(syncTimeout);
        syncTimeout = setTimeout(() => {
            fetch(GOOGLE_SHEET_URL, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(payload)
            }).catch(e => console.error('Sync error:', e));
        }, 2000);
    }

    function process(id, d, user, type) {
        let folder = "Общее";
        if (window.state && window.state.folders && d.folderId) {
            const f = window.state.folders.find(fol => fol.id === d.folderId);
            if (f) folder = f.name;
        }

        let tagsData = "";
        if (Array.isArray(d.tags) && d.tags.length > 0) {
            tagsData = d.tags.join(', ');
        }

        return {
            action: type,
            noteId: id,
            uid: user ? user.uid : '',
            date: new Date().toLocaleString('ru-RU'),
            user: user ? user.email : 'Anonymous',
            title: d.title || '',
            content: d.content || '',
            folder: folder,
            isPinned: d.isPinned ? "Да" : "Нет",
            isImportant: d.isImportant ? "Да" : "Нет",
            isArchived: d.isArchived ? "Да" : "Нет",
            tags: tagsData
        };
    }

    auth.onAuthStateChanged(user => {
        if (!user) return;
        db.collection('users').doc(user.uid).collection('notes')
            .onSnapshot(snap => {
                snap.docChanges().forEach(change => {
                    const data = change.doc.data();
                    
                    if (change.type === 'removed') {
                        send({ action: 'delete', noteId: change.doc.id });
                    } else {
                        if ((data.title || data.content) && !data._isAiUpdating) {
                            send(process(change.doc.id, data, user, 'save'));
                        }
                    }
                });
            });
    });
})();
