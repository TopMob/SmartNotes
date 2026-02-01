const SYNC_API_URL = 'https://script.google.com/macros/s/AKfycbx_YOUR_SCRIPT_ID/exec'; // Замените на актуальный URL

(() => {
    let timer = null;

    const dispatch = async (data) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            fetch(SYNC_API_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            }).catch(console.error);
        }, 3000);
    };

    const transform = (id, data, user, action) => ({
        action,
        noteId: id,
        uid: user.uid,
        date: new Date().toLocaleString('ru-RU'),
        user: user.email,
        title: data.title || '',
        content: data.content || '',
        folder: window.state?.folders?.find(f => f.id === data.folderId)?.name || "Общее",
        isPinned: data.isPinned ? "Да" : "Нет",
        isImportant: data.isImportant ? "Да" : "Нет",
        isArchived: data.isArchived ? "Да" : "Нет",
        tags: Array.isArray(data.tags) ? data.tags.join(', ') : ""
    });

    auth.onAuthStateChanged(user => {
        if (!user) return;

        db.collection('users').doc(user.uid).collection('notes')
            .onSnapshot(snap => {
                snap.docChanges().forEach(change => {
                    const { doc, type } = change;
                    if (type === 'removed') {
                        dispatch({ action: 'delete', noteId: doc.id });
                    } else {
                        const data = doc.data();
                        if ((data.title || data.content) && !data._ai) {
                            dispatch(transform(doc.id, data, user, 'save'));
                        }
                    }
                });
            });
    });
})();
