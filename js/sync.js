const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbzGKif-JQDq1VwV80lq9EfvczgYelkm39cuz7QzimbZUZfJA49SuT2Hw_tO82WLssPe/exec';

(function() {
    auth.onAuthStateChanged(user => {
        if (user) {
            db.collection('users').doc(user.uid).collection('notes')
                .onSnapshot(snapshot => {
                    snapshot.docChanges().forEach(change => {
                        const noteData = change.doc.data();
                        
                        // Определяем название папки
                        let folderName = 'Общее';
                        if (noteData.folderId && typeof state !== 'undefined' && state.folders) {
                            const folder = state.folders.find(f => f.id === noteData.folderId);
                            if (folder) folderName = folder.name;
                        }

                        // Собираем все состояния в одну строку
                        let status = [];
                        if (noteData.isArchived) status.push('Архив');
                        if (noteData.isPinned) status.push('Закреплен');
                        if (noteData.isImportant) status.push('Важный');
                        if (noteData.trash) status.push('В мусорке'); // если есть такое поле

                        const payload = {
                            action: change.type === 'removed' ? 'delete' : 'save',
                            user: user.email,
                            noteId: change.doc.id,
                            title: noteData.title || '',
                            content: noteData.content || '',
                            folder: folderName,
                            status: status.join(', ') || 'Обычная',
                            tags: noteData.tags ? noteData.tags.join(', ') : ''
                        };

                        fetch(GOOGLE_SHEET_URL, {
                            method: 'POST',
                            mode: 'no-cors',
                            headers: { 'Content-Type': 'text/plain' },
                            body: JSON.stringify(payload)
                        }).catch(e => console.error(e));
                    });
                });
        }
    });
})();
