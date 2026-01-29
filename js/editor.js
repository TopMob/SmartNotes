// =========================================
// 1. ОТКРЫТИЕ И ЗАКРЫТИЕ РЕДАКТОРА
// =========================================
function openEditor(note = null) {
    state.activeNote = note;
    const modal = document.getElementById('editor-modal');
    
    // Элементы полей
    const titleInput = document.getElementById('note-title');
    const contentInput = document.getElementById('note-content');
    const tagsContainer = document.getElementById('note-tags-container');

    if (note) {
        titleInput.value = note.title || '';
        contentInput.value = note.content || '';
        renderEditorTags(note.tags || []);
        updatePriorityUI(note.priority || 'low');
    } else {
        titleInput.value = '';
        contentInput.value = '';
        renderEditorTags([]);
        updatePriorityUI('low');
    }

    modal.classList.add('active');
}

function closeEditor() {
    saveNote(); // Сохраняем при закрытии
    document.getElementById('editor-modal').classList.remove('active');
    state.activeNote = null;
}

// =========================================
// 2. ЛОГИКА СОХРАНЕНИЯ
// =========================================
async function saveNote() {
    const title = document.getElementById('note-title').value.trim();
    const content = document.getElementById('note-content').value.trim();
    
    // Если пусто — не сохраняем
    if (!title && !content) return;

    const noteData = {
        title,
        content,
        priority: state.editorPriority || 'low',
        tags: state.editorTags || [],
        folderId: state.activeFolderId || null,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (state.activeNote) {
        await db.collection('users').doc(state.user.uid).collection('notes').doc(state.activeNote.id).update(noteData);
    } else {
        noteData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        noteData.isArchived = false;
        await db.collection('users').doc(state.user.uid).collection('notes').add(noteData);
    }
}

// =========================================
// 3. ПРИОРИТЕТ И ВРЕМЯ (ИСПРАВЛЕНИЯ)
// =========================================

// Циклическое переключение: Low -> Medium -> High -> Low
function cyclePriority() {
    const sequence = ['low', 'medium', 'high'];
    let current = state.editorPriority || 'low';
    let next = sequence[(sequence.indexOf(current) + 1) % sequence.length];
    updatePriorityUI(next);
}

function updatePriorityUI(level) {
    state.editorPriority = level;
    const btn = document.getElementById('priority-btn');
    const colors = { low: '#00ffcc', medium: '#ffaa00', high: '#ff4444' };
    btn.style.color = colors[level];
}

// Добавление времени (Теперь с часами и минутами!)
function insertCurrentTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateString = now.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
    
    const textarea = document.getElementById('note-content');
    const fullStamp = `\n[${timeString} ${dateString}]\n`;
    
    // Вставляем в место курсора
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.value = textarea.value.substring(0, start) + fullStamp + textarea.value.substring(end);
    textarea.focus();
}

// =========================================
// 4. ТЕГИ В РЕДАКТОРЕ
// =========================================
function renderEditorTags(tags) {
    state.editorTags = tags;
    const container = document.getElementById('note-tags-container');
    container.innerHTML = tags.map(t => `<span class="tag">#${t}</span>`).join('');
}

document.getElementById('note-tags-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const val = e.target.value.trim().replace('#', '');
        if (val && !state.editorTags.includes(val)) {
            state.editorTags.push(val);
            renderEditorTags(state.editorTags);
        }
        e.target.value = '';
    }
});