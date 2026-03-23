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
    if (!promedio) return '-';
    if (promedio < 2) return 'Bajo (1.0 - 1.9)';
    if (promedio < 3) return 'En Desarrollo (2.0 - 2.9)';
    if (promedio < 4) return 'Adecuado (3.0 - 3.9)';
    if (promedio < 4.5) return 'Alto (4.0 - 4.4)';
    return 'Sobresaliente (4.5 - 5.0)';
}

export function getBadgeClass(promedio) {
    if (!promedio) return 'badge-secondary';
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
    const date = new Date(fechaStr);
    return date.toLocaleDateString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}
