const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbzGKif-JQDq1VwV80lq9EfvczgYelkm39cuz7QzimbZUZfJA49SuT2Hw_tO82WLssPe/exec';

(function() {
    auth.onAuthStateChanged(user => {
        if (user) {
            db.collection('users').doc(user.uid).collection('notes')
                .onSnapshot(snapshot => {
                    snapshot.docChanges().forEach(change => {
                        const d = change.doc.data();
                        
                        // Формируем текст состояния
                        let statusParts = [];
                        statusParts.push(d.isPinned ? "Закреплен" : "Не закреплен");
                        statusParts.push(d.isImportant ? "Важное" : "Обычное");
                        statusParts.push(d.isArchived ? "В архиве" : "Не в архиве");
                        // Если у вас есть поле удаления в БД, можно добавить и его
                        
                        // Получаем название папки (если доступно в state)
                        let folderName = "Общее";
                        if (window.state && window.state.folders && d.folderId) {
                            const f = window.state.folders.find(f => f.id === d.folderId);
                            if (f) folderName = f.name;
                        }

                        const payload = {
                            action: change.type === 'removed' ? 'delete' : 'save',
                            noteId: change.doc.id,
                            date: new Date().toLocaleString('ru-RU'),
                            title: d.title || 'Без заголовка',
                            content: d.content || '',
                            folder: folderName,
                            status: statusParts.join(', '),
                            tags: d.tags ? d.tags.join(', ') : ''
                        };

                        fetch(GOOGLE_SHEET_URL, {
                            method: 'POST',
                            mode: 'no-cors',
                            headers: { 'Content-Type': 'text/plain' },
                            body: JSON.stringify(payload)
                        }).catch(e => console.error("Sync Error:", e));
                    });
                });
        }
    });
})();
