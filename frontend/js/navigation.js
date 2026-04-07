import { api } from './api.js';
import { state, setState } from './state.js';
import { getRoleName, capitalize } from './utils.js';

export async function loadUserInfo() {
    try {
        const user = await api.auth.getMe();
        console.log('User info fetched:', user);
        setState('currentUser', user);
        
        const rolId = parseInt(user.rol_id);
        document.getElementById('userDisplay').textContent = user.username;
        const userAvatar = document.getElementById('userAvatar');
        if (userAvatar && user.username) {
            userAvatar.textContent = user.username.charAt(0).toUpperCase();
        }
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

            // Cerrar sidebar en móvil tras navegar
            if (window.innerWidth <= 768) {
                const sidebar = document.querySelector('.sidebar');
                const overlay = document.getElementById('sidebarOverlay');
                const mobileBtn = document.getElementById('mobileMenuBtn');
                
                sidebar?.classList.remove('active');
                overlay?.classList.remove('active');
                mobileBtn?.classList.remove('active');
            }
        });
    });

    setupSidebarToggle();
}

function setupSidebarToggle() {
    const sidebar = document.querySelector('.sidebar');
    const toggleBtn = document.getElementById('sidebarToggle');
    const mobileBtn = document.getElementById('mobileMenuBtn');
    const overlay = document.getElementById('sidebarOverlay');

    // Desktop Toggle (Collapse)
    toggleBtn?.addEventListener('click', () => {
        sidebar?.classList.toggle('collapsed');
        // Opcional: Guardar estado en localStorage
        localStorage.setItem('sidebarCollapsed', sidebar?.classList.contains('collapsed'));
    });

    // Mobile Toggle (Slide-in)
    mobileBtn?.addEventListener('click', () => {
        sidebar?.classList.toggle('active');
        overlay?.classList.toggle('active');
        mobileBtn?.classList.toggle('active');
    });

    // Close on overlay click
    overlay?.addEventListener('click', () => {
        sidebar?.classList.remove('active');
        overlay?.classList.remove('active');
        mobileBtn?.classList.remove('active');
    });

    // Restaurar estado de colapso en escritorio
    if (window.innerWidth > 768 && localStorage.getItem('sidebarCollapsed') === 'true') {
        sidebar?.classList.add('collapsed');
    }
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
