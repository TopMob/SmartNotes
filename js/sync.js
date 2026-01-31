const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbxkdNW5BWs8DP4Qw30y65srWrWNrtQr_6AeBY1le2Q1ZdF3MS_sWpGAtE9JF2yPiNkG/exec';

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
            }).catch(e => console.warn("Retry sync..."));
        }, 500); // Задержка 0.5 сек, чтобы не спамить при наборе текста
    }

    function process(id, d, user, type) {
        let s = [];
        if (d.isPinned) s.push("Закреплен");
        if (d.isImportant) s.push("Важное");
        if (d.isArchived) s.push("В архиве");
        if (s.length === 0) s.push("Обычная");

        let f = "Общее";
        if (window.state && window.state.folders && d.folderId) {
            const folder = window.state.folders.find(fol => fol.id === d.folderId);
            if (folder) f = folder.name;
        }

        // Пытаемся взять теги из данных, если пусто - ищем в DOM (интерфейсе)
        let tagsData = "";
        if (Array.isArray(d.tags) && d.tags.length > 0) {
            tagsData = d.tags.join(', ');
        } else {
            const tagElements = document.querySelectorAll('.tag span');
            tagsData = Array.from(tagElements).map(el => el.textContent).join(', ');
        }

        return {
            action: type,
            noteId: id,
            date: new Date().toLocaleString('ru-RU'),
            user: user ? user.email : 'Anonymous',
            title: d.title || 'Без заголовка',
            content: d.content || '',
            folder: f,
            status: s.join(', '),
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
                        // Отправляем только если есть заголовок или текст, чтобы не слать пустые черновики
                        if (data.title || data.content) {
                            send(process(change.doc.id, data, user, 'save'));
                        }
                    }
                });
            });
    });
})();
