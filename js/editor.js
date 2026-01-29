let currentEditorNote = null;
let currentPriority = 'low';
let editorTags = [];

function openEditor(note = null) {
    currentEditorNote = note;
    const modal = document.getElementById('editor-modal');
    const titleInp = document.getElementById('note-title');
    const contentInp = document.getElementById('note-content');
    const priorityBtn = document.getElementById('priority-btn');
    
    editorTags = note && note.tags ? [...note.tags] : [];
    currentPriority = note && note.priority ? note.priority : 'low';

    if (note) {
        titleInp.value = note.title || "";
        contentInp.value = note.content || "";
    } else {
        titleInp.value = "";
        contentInp.value = "";
    }
    
    updatePriorityUI();
    renderEditorTags();
    
    modal.classList.add('active');
    setTimeout(() => titleInp.focus(), 300);
}

async function closeEditor() {
    const modal = document.getElementById('editor-modal');
    const title = document.getElementById('note-title').value.trim();
    const content = document.getElementById('note-content').value.trim();

    if (title || content) {
        await saveNote(title, content);
    }

    modal.classList.remove('active');
    currentEditorNote = null;
}

async function saveNote(title, content) {
    const noteData = {
        title: title,
        content: content,
        priority: currentPriority,
        tags: editorTags,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        folderId: state.activeFolderId || null,
        isArchived: currentEditorNote ? currentEditorNote.isArchived : false
    };

    try {
        if (currentEditorNote) {
            await db.collection('users').doc(state.user.uid)
                .collection('notes').doc(currentEditorNote.id).update(noteData);
        } else {
            noteData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('users').doc(state.user.uid)
                .collection('notes').add(noteData);
        }
    } catch (error) {
        console.error("Save error:", error);
    }
}

function cyclePriority() {
    const priorities = ['low', 'medium', 'high'];
    let index = priorities.indexOf(currentPriority);
    currentPriority = priorities[(index + 1) % priorities.length];
    updatePriorityUI();
}

function updatePriorityUI() {
    const btn = document.getElementById('priority-btn');
    if (!btn) return;

    const colors = {
        low: 'var(--primary)',
        medium: '#ffaa00',
        high: '#ff4444'
    };

    btn.style.color = colors[currentPriority];
    btn.style.borderColor = colors[currentPriority];
    btn.style.boxShadow = `0 0 15px ${colors[currentPriority]}33`;
}

function insertCurrentTime() {
    const contentInp = document.getElementById('note-content');
    const now = new Date();
    const timestamp = `\n[${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}] `;
    
    const start = contentInp.selectionStart;
    const end = contentInp.selectionEnd;
    const text = contentInp.value;
    
    contentInp.value = text.slice(0, start) + timestamp + text.slice(end);
    contentInp.focus();
}

const tagInput = document.getElementById('note-tags-input');
if (tagInput) {
    tagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const val = tagInput.value.replace('#', '').trim();
            if (val && !editorTags.includes(val)) {
                editorTags.push(val);
                renderEditorTags();
                tagInput.value = '';
            }
        }
    });
}

function renderEditorTags() {
    const container = document.getElementById('note-tags-container');
    if (!container) return;

    container.innerHTML = editorTags.map((tag, index) => `
        <span class="tag" onclick="removeTag(${index})">
            #${tag}
            <span style="margin-left: 5px; opacity: 0.5;">×</span>
        </span>
    `).join('');
}

function removeTag(index) {
    editorTags.splice(index, 1);
    renderEditorTags();
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('editor-modal');
        if (modal && modal.classList.contains('active')) {
            closeEditor();
        }
    }
});
