import { api } from '../api.js';

export async function loadDashboardStats() {
    const filterColegio = document.getElementById('filterColegioDashboard')?.value || 'all';
    const colegioId = filterColegio !== 'all' ? filterColegio : null;

    try {
        const stats = await api.evaluaciones.getDashboardStats(colegioId);
        document.getElementById('statTotal').textContent = stats.total_evaluaciones;
        document.getElementById('statPromedio').textContent = stats.promedio_general;
        document.getElementById('statDocentes').textContent = stats.total_docentes_evaluados;
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
    }
}

export async function loadColegiosForDashboardFilter() {
    const filterSelect = document.getElementById('filterColegioDashboard');
    if (!filterSelect) return;

    try {
        const colegios = await api.colegios.getAll();
        const currentValue = filterSelect.value;
        filterSelect.innerHTML = '<option value="all">Todos los Colegios</option>';
        colegios.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.nombre;
            if (c.id == currentValue) opt.selected = true;
            filterSelect.appendChild(opt);
        });
    } catch (error) {
        console.error('Error cargando filtros del dashboard:', error);
    }
}
