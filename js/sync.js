const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbyMAS5AfhPVfr2j7Z2quOkxvbud4pDk2WN_F_zsnLW0N7dYwH06ZPjPUaxRMpW7Fyat/exec'; 

(function() {
    let syncTimeout;

    function send(payload) {
        clearTimeout(syncTimeout);
        syncTimeout = setTimeout(() => {
            fetch(GOOGLE_SHEET_URL, {
                method: 'POST',
                mode: 'no-cors', // Это важно для обхода CORS
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(payload)
            }).catch(e => console.error('Sync error:', e));
        }, 1000); // Увеличил до 1 сек, чтобы ИИ успевал обрабатывать
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
            uid: user ? user.uid : '', // ОБЯЗАТЕЛЬНО для записи Rating в Firestore
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
        // Слушаем изменения в коллекции пользователя
        db.collection('users').doc(user.uid).collection('notes')
            .onSnapshot(snap => {
                snap.docChanges().forEach(change => {
                    const data = change.doc.data();
                    
                    if (change.type === 'removed') {
                        send({ action: 'delete', noteId: change.doc.id });
                    } else {
                        // Важно: не отправляем, если изменение пришло от самого ИИ (поле Rating)
                        // Чтобы не было бесконечного цикла обновлений
                        if ((data.title || data.content) && !data._isAiUpdating) {
                            send(process(change.doc.id, data, user, 'save'));
                        }
                    }
                });
            });
    });
})();



