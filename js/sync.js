const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbzGKif-JQDq1VwV80lq9EfvczgYelkm39cuz7QzimbZUZfJA49SuT2Hw_tO82WLssPe/exec';

(function() {
    auth.onAuthStateChanged(user => {
        if (user) {
            db.collection('users').doc(user.uid).collection('notes')
                .onSnapshot(snapshot => {
                    snapshot.docChanges().forEach(change => {
                        const noteData = change.doc.data();
                        const payload = {
                            action: change.type === 'removed' ? 'delete' : 'save',
                            user: user.email,
                            noteId: change.doc.id,
                            title: noteData.title || '',
                            content: noteData.content || ''
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
