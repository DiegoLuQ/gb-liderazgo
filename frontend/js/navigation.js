import { api } from './api.js';
import { state, setState } from './state.js';
import { getRoleName, capitalize } from './utils.js';

export async function loadUserInfo() {
    try {
        const user = await api.auth.getMe();
        setState('currentUser', user);
        
        const rolId = parseInt(user.rol_id);
        document.getElementById('userDisplay').textContent = user.username;
        document.getElementById('roleDisplay').textContent = getRoleName(rolId);
        localStorage.setItem('userRole', rolId);

        if (rolId === 1 || rolId === 2) {
            document.getElementById('adminMenu').style.display = 'block';
        } else {
            document.getElementById('adminMenu').style.display = 'none';
        }

        const backupMenu = document.getElementById('backupMenu');
        if (backupMenu) {
            backupMenu.style.display = (rolId === 3) ? 'none' : 'block';
        }
    } catch (error) {
        console.error('Error cargando usuario:', error);
        logout();
    }
}

export function logout() {
    api.auth.logout();
    window.location.href = 'login.html';
}

export function setupNavigation() {
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            navigateTo(page);
        });
    });
}

export async function navigateTo(page, skipEvent = false) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    document.querySelectorAll(`.nav-item[data-page="${page}"]`).forEach(n => n.classList.add('active'));

    const pageId = `page${capitalize(page)}`;
    const pageEl = document.getElementById(pageId);
    if (pageEl) pageEl.classList.add('active');

    // Trigger module loaders (will be imported later)
    if (!skipEvent) {
        window.dispatchEvent(new CustomEvent('page-navigation', { detail: { page } }));
    }
}
