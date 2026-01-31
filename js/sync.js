const SYNC_URL = 'https://script.google.com/macros/s/AKfycbyfD1l8-87X6K1p5qYk1h6q8W9S7_4W6F1/exec';

(function() {
    function initFirebaseSync() {
        // Ждем, пока пользователь авторизуется
        auth.onAuthStateChanged(user => {
            if (user) {
                console.log("Sync: Начинаю отслеживание Firestore для", user.email);
                
                // Слушаем изменения во всей коллекции заметок пользователя
                db.collection('users').doc(user.uid).collection('notes')
                    .onSnapshot(snapshot => {
                        snapshot.docChanges().forEach(change => {
                            const noteData = change.doc.data();
                            const payload = {
                                action: change.type === 'removed' ? 'delete' : 'save',
                                user: user.email,
                                noteId: change.doc.id,
                                title: noteData.title || '',
                                content: noteData.content || '',
                                timestamp: new Date().toISOString()
                            };

                            if (change.type !== 'removed' || change.type === 'added' || change.type === 'modified') {
                                sendToSheets(payload);
                            }
                        });
                    });
            }
        });
    }

    async function sendToSheets(payload) {
        try {
            // Используем текстовый формат, так как Apps Script лучше его переваривает при no-cors
            await fetch(SYNC_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(payload)
            });
            console.log("Sync: Данные отправлены в очередь Google");
        } catch (e) {
            console.error("Sync Error:", e);
        }
    }

    // Запуск после загрузки страницы
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFirebaseSync);
    } else {
        initFirebaseSync();
    }
})();
