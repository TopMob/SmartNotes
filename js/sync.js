const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbxkdNW5BWs8DP4Qw30y65srWrWNrtQr_6AeBY1le2Q1ZdF3MS_sWpGAtE9JF2yPiNkG/exec';

(function() {
    function send(payload) {
        fetch(GOOGLE_SHEET_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload)
        }).catch(e => {});
    }

    function process(id, d, user, type) {
        let s = [];
        s.push(d.isPinned ? "Закреплен" : "Не закреплен");
        s.push(d.isImportant ? "Важное" : "Обычное");
        s.push(d.isArchived ? "В архиве" : "Не в архиве");

        let f = "Общее";
        if (window.state && window.state.folders && d.folderId) {
            const folder = window.state.folders.find(f => f.id === d.folderId);
            if (folder) f = folder.name;
        }

        return {
            action: type,
            noteId: id,
            date: new Date().toLocaleString('ru-RU'),
            user: user ? user.email : 'Anonymous',
            title: d.title || '',
            content: d.content || '',
            folder: f,
            status: s.join(', '),
            tags: Array.isArray(d.tags) ? d.tags.join(', ') : (d.tags || '')
        };
    }

    auth.onAuthStateChanged(user => {
        if (!user) return;
        db.collection('users').doc(user.uid).collection('notes')
            .onSnapshot(snap => {
                snap.docChanges().forEach(change => {
                    if (change.type === 'removed') {
                        send({ action: 'delete', noteId: change.doc.id });
                    } else {
                        send(process(change.doc.id, change.doc.data(), user, 'save'));
                    }
                });
            });
    });
})();

