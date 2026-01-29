// =========================================
// 1. ОТРИСОВКА ЗАМЕТОК
// =========================================
function renderNotes(notesToRender) {
    const grid = document.getElementById('notes-grid');
    grid.innerHTML = '';

    notesToRender.forEach(note => {
        const card = document.createElement('div');
        // Добавляем класс приоритета для полоски слева
        card.className = `note-card priority-${note.priority || 'low'}`;
        
        // Находим цвет папки, если она есть
        const folder = state.folders.find(f => f.id === note.folderId);
        const folderTag = folder ? `<span class="note-folder-tag" style="color: ${folder.color}">${folder.name}</span>` : '';

        card.innerHTML = `
            <div class="note-card-content">
                <h3>${note.title || 'Без названия'}</h3>
                <p>${note.content || ''}</p>
                <div class="note-footer-ui">
                    ${folderTag}
                    <div class="note-tags">
                        ${(note.tags || []).map(t => `<span class="tag">#${t}</span>`).join('')}
                    </div>
                </div>
            </div>
        `;
        
        card.onclick = () => openEditor(note);
        grid.appendChild(card);
    });
}

// =========================================
// 2. ОТРИСОВКА ПАПОК В САЙДБАРЕ
// =========================================
function renderFolders() {
    const container = document.getElementById('folders-list');
    container.innerHTML = '';

    state.folders.forEach(folder => {
        const item = document.createElement('button');
        item.className = `nav-item ${state.activeFolderId === folder.id ? 'active' : ''}`;
        item.innerHTML = `
            <span class="folder-color-dot" style="background: ${folder.color}"></span>
            <span class="folder-name">${folder.name}</span>
        `;
        
        item.onclick = () => {
            state.currentView = 'folder';
            state.activeFolderId = folder.id;
            // Убираем активный класс у всех и ставим этому
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            filterAndRenderNotes();
        };
        container.appendChild(item);
    });
}

// =========================================
// 3. УПРАВЛЕНИЕ МОДАЛКАМИ
// =========================================
function openFolderModal() {
    document.getElementById('folder-modal').classList.add('active');
}

function closeFolderModal() {
    document.getElementById('folder-modal').classList.remove('active');
}

function openFeedbackModal() {
    document.getElementById('feedback-modal').classList.add('active');
}

function closeFeedbackModal() {
    document.getElementById('feedback-modal').classList.remove('active');
}

// Переключатель сайдбара (для мобилок)
document.getElementById('menu-toggle').onclick = () => {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('active');
};

// Инициализация звезд рейтинга
document.querySelectorAll('.star-rating-mini span, .star-rating span').forEach(star => {
    star.onclick = (e) => {
        const val = e.target.getAttribute('data-value') || e.target.getAttribute('data-v');
        state.currentRating = val;
        updateStars(val);
    };
});

function updateStars(rating) {
    document.querySelectorAll('[data-value], [data-v]').forEach(star => {
        const v = star.getAttribute('data-value') || star.getAttribute('data-v');
        star.innerText = v <= rating ? 'star' : 'star_outline';
    });
}