function toggleSidebar(open) {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    
    if (open) {
        sidebar.classList.add('active');
    } else {
        sidebar.classList.remove('active');
    }
}

function confirmBotTransition() {
    const overlay = document.createElement('div');
    overlay.className = 'custom-confirm-overlay';
    overlay.innerHTML = `
        <div class="custom-confirm-card">
            <span class="material-icons-round" style="font-size: 48px; color: #00d4ff; margin-bottom: 20px;">rocket_launch</span>
            <h3>Связь с базой</h3>
            <p>Хотите переместиться в Telegram-бота для обратной связи с командой разработчиков?</p>
            <div class="confirm-actions">
                <button onclick="executeBotRedirect(this)" class="confirm-yes">Полетели!</button>
                <button onclick="this.closest('.custom-confirm-overlay').remove()" class="confirm-no">Остаться здесь</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}

function executeBotRedirect(btn) {
    btn.innerHTML = '<span class="material-icons-round spin">sync</span>';
    setTimeout(() => {
        window.open('https://t.me/your_bot_link', '_blank');
        btn.closest('.custom-confirm-overlay').remove();
    }, 800);
}

function renderNotes(notes) {
    const grid = document.getElementById('notes-grid');
    if (!grid) return;
    grid.innerHTML = '';

    notes.forEach((note, index) => {
        const card = document.createElement('div');
        card.className = `note-card priority-${note.priority || 'low'}`;
        card.style.animation = `slideUp 0.5s ease forwards ${index * 0.05}s`;
        card.innerHTML = `
            <div class="note-card-inner">
                <h3>${note.title || 'Без названия'}</h3>
                <p>${note.content || ''}</p>
                <div class="note-card-footer">
                    <span class="note-date">${formatDate(note.updatedAt)}</span>
                    <div class="note-tags">
                        ${(note.tags || []).map(t => `<span>#${t}</span>`).join('')}
                    </div>
                </div>
            </div>
        `;
        card.onclick = () => openEditor(note);
        grid.appendChild(card);
    });
}

function renderFolders() {
    const container = document.getElementById('folders-list');
    if (!container) return;
    container.innerHTML = '';

    state.folders.forEach(folder => {
        const item = document.createElement('div');
        item.className = `folder-item ${state.activeFolderId === folder.id ? 'active' : ''}`;
        item.innerHTML = `
            <span class="material-icons-round" style="color: ${folder.color}">folder</span>
            <span class="folder-name">${folder.name}</span>
        `;
        item.onclick = () => {
            state.currentView = 'folder';
            state.activeFolderId = folder.id;
            filterAndRender();
        };
        container.appendChild(item);
    });
}

document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('sidebar');
    const menuBtn = document.querySelector('.menu-toggle-btn');
    if (sidebar && sidebar.classList.contains('active')) {
        if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
            toggleSidebar(false);
        }
    }
});

const userTrigger = document.getElementById('user-menu-trigger');
if (userTrigger) {
    userTrigger.onclick = (e) => {
        e.stopPropagation();
        document.getElementById('user-dropdown').classList.toggle('active');
    };
}

window.onclick = () => {
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown) dropdown.classList.remove('active');
};

function openFeedbackModal() {
    alert("Функционал оценки будет доступен в следующем обновлении.");
}

function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}
