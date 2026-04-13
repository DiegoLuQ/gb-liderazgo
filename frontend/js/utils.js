/**
 * UI Utilities and Helpers
 */

export function mostrarLoading(show, text = 'Cargando...') {
    const overlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    if (!overlay) return;

    if (show) {
        if (loadingText) loadingText.textContent = text;
        overlay.classList.add('active');
    } else {
        overlay.classList.remove('active');
    }
}

export function showAlert(title, message, type = 'info') {
    const overlay = document.getElementById('alertOverlay');
    if (!overlay) {
        alert(`${title}: ${message}`);
        return;
    }
    
    document.getElementById('alertTitle').textContent = title;
    document.getElementById('alertBody').innerHTML = `<p style="font-size: 1.1em; line-height: 1.5;">${message}</p>`;
    
    const header = document.getElementById('alertHeader');
    header.className = 'modal-header ' + type;
    
    overlay.classList.add('active');
}

export function closeAlert() {
    const overlay = document.getElementById('alertOverlay');
    if (overlay) overlay.classList.remove('active');
}

export function capitalize(str) {
    if (!str) return '';
    return str.replace(/-/g, ' ').split(' ').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
}

export function getInterpretacion(promedio) {
    if (promedio === null || promedio === undefined || promedio === 0) return 'N/A';
    if (promedio >= 4.0) return 'Liderazgo consolidado';
    if (promedio >= 3.0) return 'Liderazgo adecuado';
    if (promedio >= 2.0) return 'Liderazgo en desarrollo';
    return 'Liderazgo bajo';
}

export function getBadgeClass(promedio) {
    if (promedio === null || promedio === undefined || promedio === 0) return 'badge-secondary';
    if (promedio >= 4.5) return 'badge-success-dark';
    if (promedio >= 4) return 'badge-success';
    if (promedio >= 3) return 'badge-primary';
    if (promedio >= 2) return 'badge-warning';
    return 'badge-danger';
}

export function getRoleName(rolId) {
    switch (parseInt(rolId)) {
        case 1: return 'Administrador';
        case 2: return 'Auditor';
        case 3: return 'Observador';
        default: return 'Usuario';
    }
}

export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function formatFecha(fechaStr) {
    if (!fechaStr) return '-';
    // Si viene como YYYY-MM-DD (fecha pura sin hora), evitar el shift de zona horaria
    if (typeof fechaStr === 'string' && fechaStr.includes('-') && !fechaStr.includes('T') && !fechaStr.includes(':')) {
        const parts = fechaStr.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const date = new Date(fechaStr);
    return date.toLocaleDateString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

export async function loadModularPages() {
    const container = document.querySelector('.main-content');
    if (!container) return;

    const pages = [
        'page-inicio.html',
        'page-evaluaciones.html',
        'page-nueva-evaluacion.html',
        'page-colegios.html',
        'page-docentes.html',
        'page-cursos.html',
        'page-reportes.html',
        'page-asignaturas.html',
        'page-plantilla.html',
        'page-usuarios.html',
        'page-respaldo.html',
        'page-config-emails.html',
        'page-sistema.html',
        'page-resumen-evaluacion.html'
    ];

    // Limpiar contenedor (opcional, pero para asegurar que está vacío)
    container.innerHTML = '<div class="text-center p-5"><div class="spinner"></div><p>Cargando módulos...</p></div>';

    try {
        const results = await Promise.all(pages.map(async (page) => {
            const resp = await fetch(page);
            if (!resp.ok) throw new Error(`No se pudo cargar el módulo: ${page}`);
            return await resp.text();
        }));

        container.innerHTML = results.join('\n');
    } catch (err) {
        console.error('Error cargando páginas modulares:', err);
        container.innerHTML = `<p class="text-danger text-center">Error al cargar los módulos del sistema: ${err.message}</p>`;
        throw err; // Re-throw to be caught by main.js
    }
}
