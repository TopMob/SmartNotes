/**
 * Smart Notes - Управление интерфейсом и отрисовка
 */

// 1. ОТРИСОВКА КАРТОЧЕК ЗАМЕТОК
function renderNotes(notes) {
    const grid = document.getElementById('notes-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (notes.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; opacity: 0.5; margin-top: 50px;">
            <span class="material-icons-round" style="font-size: 48px;">note_stack</span>
            <p>Здесь пока пусто...</p>
        </div>`;
        return;
    }

    notes.forEach(note => {
        const card = document.createElement('div');
        card.className = `note-card priority-${note.priority || 'low'}`;
        
        // Поиск имени папки для тега на карточке
        const folder = state.folders.find(f => f.id === note.folderId);
        const folderTag = folder ? `<span class="note-folder-info" style="color: ${folder.color}">${folder.name}</span>` : '';

        card.innerHTML = `
            <h3>${note.title || 'Без названия'}</h3>
            <p>${note.content || ''}</p>
            <div class="note-card-footer">
                ${folderTag}
                <div class="tags">
                    ${(note.tags || []).map(t => `<span class="tag">#${t}</span>`).join('')}
                </div>
            </div>
        `;
        
        card.onclick = () => openEditor(note);
        grid.appendChild(card);
    });
}

// 2. ОТРИСОВКА ПАПОК В САЙДБАРЕ
function renderFolders() {
    const list = document.getElementById('folders-list');
    if (!list) return;
    list.innerHTML = '';

    state.folders.forEach(folder => {
        const item = document.createElement('div');
        item.className = `folder-item ${state.activeFolderId === folder.id ? 'active' : ''}`;
        item.innerHTML = `
            <span class="folder-dot" style="background: ${folder.color}"></span>
            <span class="folder-text">${folder.name}</span>
        `;
        
        item.onclick = () => {
            state.currentView = 'folder';
            state.activeFolderId = folder.id;
            
            // На мобилках закрываем меню после выбора папки
            if (window.innerWidth <= 768) toggleSidebar(false);
            
            filterAndRender();
        };
        list.appendChild(item);
    });
}

// 3. УПРАВЛЕНИЕ МОБИЛЬНЫМ МЕНЮ (SIDEBAR)
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.getElementById('sidebar');

function toggleSidebar(forceState = null) {
    if (!sidebar) return;
    const isActive = forceState !== null ? forceState : !sidebar.classList.contains('active');
    
    if (isActive) {
        sidebar.classList.add('active');
    } else {
        sidebar.classList.remove('active');
    }
}

if (menuToggle) {
    menuToggle.onclick = (e) => {
        e.stopPropagation();
        toggleSidebar();
    };
}

// Закрытие сайдбара при клике вне его (на мобилках)
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('active')) {
        if (!sidebar.contains(e.target) && e.target !== menuToggle) {
            toggleSidebar(false);
        }
    }
});

// 4. ПЕРЕКЛЮЧЕНИЕ ОСНОВНЫХ ВИДОВ
function setView(view) {
    state.currentView = view;
    state.activeFolderId = null;
    
    // Обновляем активные классы в меню
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    if(view === 'notes') document.getElementById('nav-all')?.classList.add('active');
    if(view === 'archive') document.getElementById('nav-archive')?.classList.add('active');

    if (window.innerWidth <= 768) toggleSidebar(false);
    filterAndRender();
}
