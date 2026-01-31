const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbzT3YbK3Uwf8PWuHcECUWcCj4rZe4M5uWGEIz5u4Tae9t1ba8b_Edq1KIkPId-xsEZV/exec';

(function() {
    let syncQueue = null;

    const dispatch = (data) => {
        if (syncQueue) clearTimeout(syncQueue);
        // Задержка 3 секунды, чтобы не спамить запросами при печати
        syncQueue = setTimeout(() => {
            fetch(GOOGLE_SHEET_URL, {
                method: 'POST',
                mode: 'no-cors', // Оставляем no-cors для обхода ограничений Google Script
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(data)
            }).catch(e => console.error('DeepSeek Sync Error:', e));
        }, 3000);
    };

    const formatNote = (id, data, user, action) => {
        let folderName = "Общее";
        if (window.state?.folders && data.folderId) {
            folderName = window.state.folders.find(f => f.id === data.folderId)?.name || "Общее";
        }

        return {
            action: action,
            noteId: id,
            uid: user?.uid || '',
            // Передаем дату просто для лога, основную дату теперь ставит сервер Google
            date: new Date().toLocaleString('ru-RU'),
            user: user?.email || 'Anonymous',
            title: data.title || '',
            content: data.content || '',
            folder: folderName,
            isPinned: data.isPinned ? "Да" : "Нет",
            isImportant: data.isImportant ? "Да" : "Нет",
            isArchived: data.isArchived ? "Да" : "Нет",
            // Превращаем массив тегов в строку для таблицы
            tags: Array.isArray(data.tags) ? data.tags.join(', ') : (data.tags || "")
        };
    };

    auth.onAuthStateChanged(user => {
        if (!user) return;

        // Следим за изменениями в Firestore
        db.collection('users').doc(user.uid).collection('notes')
            .onSnapshot(snapshot => {
                snapshot.docChanges().forEach(change => {
                    const data = change.doc.data();
                    const id = change.doc.id;

                    if (change.type === 'removed') {
                        dispatch({ action: 'delete', noteId: id });
                    } else {
                        // Валидация: не отправляем пустые или слишком короткие заметки
                        const isValid = (data.title?.length > 1 || data.content?.length > 2);
                        // Проверка на флаг _isAiUpdating, чтобы избежать бесконечного цикла обновлений
                        if (isValid && !data._isAiUpdating) {
                            dispatch(formatNote(id, data, user, 'save'));
                        }
                    }
                });
            });
    });
})();

