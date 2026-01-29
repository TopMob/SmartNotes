function renderNotes(notes) {
    const grid = document.getElementById('notes-grid');
    if (!grid) return;

    grid.style.opacity = '0';
    
    setTimeout(() => {
        grid.innerHTML = '';
        
        if (notes.length === 0) {
            grid.innerHTML = `
                <div class="empty-state-wrapper" style="grid-column: 1/-1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 120px 20px; animation: modalPop 0.6s ease;">
                    <div class="empty-icon-glow" style="width: 120px; height: 120px; border-radius: 40px; background: var(--glass); display: flex; align-items: center; justify-content: center; margin-bottom: 30px; border: 1px solid var(--glass-border); box-shadow: 0 0 30px var(--primary-glow);">
                        <span class="material-icons-round" style="font-size: 60px; color: var(--primary);">auto_awesome</span>
                    </div>
                    <h2 style="font-size: 1.8rem; font-weight: 800; background: linear-gradient(to right, #fff, var(--text-sec)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Здесь начинается творчество</h2>
                    <p style="color: var(--text-sec); margin-top: 15px; font-size: 1.1rem; text-align: center; max-width: 400px;">Твои идеи заслуживают того, чтобы быть записанными. Создай свою первую заметку прямо сейчас.</p>
                </div>
            `;
            grid.style.opacity = '1';
            return;
        }

        notes.forEach((note, index) => {
            const card = document.createElement('div');
            card.className = `note-card priority-${note.priority || 'low'}`;
            card.style.animationDelay = `${index * 0.08}s`;
            
            const folder = state.folders.find(f => f.id === note.folderId);
            const folderLabel = folder ? 
                `<span class="note-folder-tag" style="color: ${folder.color}; border: 1px solid ${folder.color}44; padding: 2px 8px; border-radius: 6px; background: ${folder.color}11;">${folder.name}</span>` : 
                `<span class="note-folder-tag" style="opacity: 0.4;">Инбокс</span>`;

            const tags = (note.tags || []).map(t => `<span class="tag">#${t}</span>`).join('');

            card.innerHTML = `
                <div class="note-card-content">
                    <h3>${note.title || 'Без названия'}</h3>
                    <p>${note.content || 'Нет дополнительного текста...'}</p>
                </div>
                <div class="note-card-footer">
                    ${folderLabel}
                    <div class="note-tags-row" style="display: flex; gap: 6px; overflow: hidden;">
                        ${tags}
                    </div>
                </div>
            `;

            card.onclick = () => openEditor(note);
            grid.appendChild(card);
        });
        
        grid.style.opacity = '1';
    }, 150);
}

function renderFolders() {
    const list = document.getElementById('folders-list');
    if (!list) return;

    list.innerHTML = '';

    state.folders.forEach((folder, index) => {
        const item = document.createElement('div');
        item.className = `nav-item ${state.activeFolderId === folder.id ? 'active' : ''}`;
        item.style.animation = `slideUp 0.4s ease forwards ${index * 0.05}s`;
        item.style.opacity = '0';
        
        item.innerHTML = `
            <div class="folder-icon-wrapper" style="width: 10px; height: 10px; border-radius: 50%; background: ${folder.color}; box-shadow: 0 0 10px ${folder.color}aa;"></div>
            <span style="flex: 1; font-weight: 600;">${folder.name}</span>
            <button class="folder-delete-btn" onclick="requestDeleteFolder('${folder.id}', event)" style="background: none; border: none; color: var(--text-mute); opacity: 0; transition: 0.3s; cursor: pointer;">
                <span class="material-icons-round" style="font-size: 18px;">delete_outline</span>
            </button>
        `;

        item.onmouseenter = () => { item.querySelector('.folder-delete-btn').style.opacity = '1'; };
        item.onmouseleave = () => { item.querySelector('.folder-delete-btn').style.opacity = '0'; };

        item.onclick = () => {
            state.currentView = 'folder';
            state.activeFolderId = folder.id;
            updateNavUI();
            filterAndRender();
            if (window.innerWidth <= 992) toggleSidebar(false);
        };

        list.appendChild(item);
    });
}

function updateNavUI() {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    
    if (state.currentView === 'notes') {
        document.getElementById('nav-all')?.classList.add('active');
    } else if (state.currentView === 'archive') {
        document.getElementById('nav-archive')?.classList.add('active');
    }
}

function toggleSidebar(force) {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('menu-toggle');
    if (!sidebar) return;

    const shouldOpen = force !== undefined ? force : !sidebar.classList.contains('active');

    if (shouldOpen) {
        sidebar.classList.add('active');
        if (toggleBtn) toggleBtn.innerHTML = '<span class="material-icons-round">close</span>';
    } else {
        sidebar.classList.remove('active');
        if (toggleBtn) toggleBtn.innerHTML = '<span class="material-icons-round">menu</span>';
    }
}

function setupEventListeners() {
    const menuBtn = document.getElementById('menu-toggle');
    if (menuBtn) {
        menuBtn.onclick = (e) => {
            e.stopPropagation();
            toggleSidebar();
        };
    }

    document.addEventListener('click', (e) => {
        const sidebar = document.getElementById('sidebar');
        if (window.innerWidth <= 992 && sidebar?.classList.contains('active')) {
            if (!sidebar.contains(e.target) && !e.target.closest('#menu-toggle')) {
                toggleSidebar(false);
            }
        }
    });

    const userTrigger = document.getElementById('user-menu-trigger');
    const userDropdown = document.getElementById('user-dropdown');
    
    if (userTrigger && userDropdown) {
        userTrigger.onclick = (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('active');
        };

        window.addEventListener('click', () => {
            userDropdown.classList.remove('active');
        });
    }
}

function confirmAction(type) {
    const modal = document.getElementById('confirm-modal');
    const title = document.getElementById('confirm-title');
    const actionBtn = document.getElementById('confirm-action-btn');

    if (!modal) return;

    if (type === 'logout') {
        title.innerText = "Выйти из системы?";
        actionBtn.onclick = () => { auth.signOut(); closeConfirm(); };
    } else if (type === 'switch') {
        title.innerText = "Переключить аккаунт?";
        actionBtn.onclick = () => { login(); closeConfirm(); };
    }

    modal.classList.add('active');
}

function closeConfirm() {
    document.getElementById('confirm-modal')?.classList.remove('active');
}

function openFeedbackModal() {
    const feedbackData = {
        rating: prompt("Оцени дизайн и удобство (1-5):", "5"),
        text: prompt("Что нам добавить в следующем обновлении?")
    };
    
    if (feedbackData.rating) {
        addNoteFeedback(feedbackData.rating, feedbackData.text);
    }
}

function requestDeleteFolder(id, event) {
    event.stopPropagation();
    if (confirm("Удалить папку? Заметки останутся во 'Всех заметках'.")) {
        db.collection('users').doc(state.user.uid).collection('folders').doc(id).delete();
    }
}

document.addEventListener('DOMContentLoaded', setupEventListeners);
