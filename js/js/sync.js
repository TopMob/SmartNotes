const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbxEOBP34Lf426I0FIMEfk4M41B91ChzB7vyCtWUuJ1SHjd5mvPzDlEl4-mhMyJ9jXo/exec';

(function() {
    const originalSave = Editor.save;

    Editor.save = async function() {
        await originalSave.apply(this, arguments);

        try {
            const note = state.currentNote;
            if (!note) return;

            let folderName = 'Общее';
            if (state.folders && note.folderId) {
                const foundFolder = state.folders.find(f => f.id === note.folderId);
                if (foundFolder) folderName = foundFolder.name;
            }

            const payload = {
                title: note.title || 'Без названия',
                content: note.content || '',
                folder: folderName,
                tags: Array.isArray(note.tags) ? note.tags.join(', ') : '',
                author: state.user ? (state.user.email || state.user.displayName) : 'Anonymous'
            };

            fetch(GOOGLE_SHEET_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

        } catch (e) {
            console.error(e);
        }
    };
})();
