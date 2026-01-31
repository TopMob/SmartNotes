const SYNC_URL = 'https://script.google.com/macros/s/AKfycbyfD1l8-87X6K1p5qYk1h6q8W9S7_4W6F1/exec';

class NoteSync {
    constructor() {
        this.queue = [];
        this.isSyncing = false;
        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.hookState());
        } else {
            this.hookState();
        }
    }

    hookState() {
        const checkState = setInterval(() => {
            if (window.state) {
                clearInterval(checkState);
                this.applyHooks();
            }
        }, 100);
    }

    applyHooks() {
        const originalSave = window.state.saveNote;
        window.state.saveNote = (note) => {
            originalSave.call(window.state, note);
            this.push('save', note);
        };

        const originalDelete = window.state.deleteNote;
        window.state.deleteNote = (id) => {
            originalDelete.call(window.state, id);
            this.push('delete', { id });
        };
    }

    push(action, data) {
        this.queue.push({ action, data });
        this.sync();
    }

    async sync() {
        if (this.isSyncing || !this.queue.length) return;
        this.isSyncing = true;
        
        const payload = this.queue[0];

        try {
            await fetch(SYNC_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(payload)
            });
            this.queue.shift();
        } catch (e) {
            console.error(e);
        } finally {
            this.isSyncing = false;
            if (this.queue.length) {
                setTimeout(() => this.sync(), 1000);
            }
        }
    }
}

new NoteSync();
