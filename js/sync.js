const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbzARH6BBomq_AKtOD9H-khGfj01ml8DGD4Z9gh9zkBtkK5m-yTJh-X-JD-CrJvJStM5/exec'; 

(function() {
    let syncTimeout;

    function send(payload) {
        clearTimeout(syncTimeout);
        // Ждем 5 секунд затишья перед отправкой, чтобы сберечь лимиты RPD
        syncTimeout = setTimeout(() => {
            fetch(GOOGLE_SHEET_URL, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(payload)
            }).catch(e => console.error('Sync error:', e));
        }, 5000); 
    }

    function process(id, d, user, type) {
        let folder = "Общее";
        if (window.state && window.state.folders && d.folderId) {
            const f = window.state.folders.find(fol => fol.id === d.folderId);
            if (f) folder = f.name;
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
            tags: Array.isArray(d.tags) ? d.tags.join(', ') : ""
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
                        // Отправляем только если есть текст и это не техническое обновление
                        if ((data.title || data.content) && (data.title.length > 3 || data.content.length > 5) && !data._isAiUpdating) {
                            send(process(change.doc.id, data, user, 'save'));
                        }
                    }
                });
            });
    });
})();
