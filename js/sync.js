const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbz9ZP6_TctHJmPDkfcDLYBkIoNSDSMiRcQcpIE0UN_-QqyIMLQONpwbKh4zQykN0H8/exec';

(function() {
    let syncTimeout;

    function send(payload) {
        clearTimeout(syncTimeout);
        syncTimeout = setTimeout(() => {
            fetch(GOOGLE_SHEET_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(payload)
            }).catch(e => {});
        }, 500);
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
        } else {
            const tagElements = document.querySelectorAll('.tag span');
            if (tagElements.length > 0) {
                tagsData = Array.from(tagElements).map(el => el.textContent).join(', ');
            }
        }

        return {
            action: type,
            noteId: id,
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
                    if (change.type === 'removed') {
                        send({ action: 'delete', noteId: change.doc.id });
                    } else {
                        const data = change.doc.data();
                        if (data.title || data.content) {
                            send(process(change.doc.id, data, user, 'save'));
                        }
                    }
                });
            });
    });
})();


