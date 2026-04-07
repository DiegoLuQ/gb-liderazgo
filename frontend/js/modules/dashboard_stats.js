import { api } from '../api.js';

export async function loadDashboardStats() {
    const filterColegio = document.getElementById('filterColegioDashboard')?.value || 'all';
    const colegioId = filterColegio !== 'all' ? filterColegio : null;

    try {
        // 1. Cargar estadísticas principales
        const stats = await api.evaluaciones.getDashboardStats(colegioId);
        document.getElementById('statTotal').textContent = stats.total_cerradas;
        document.getElementById('statPromedio').textContent = stats.promedio_general;
        document.getElementById('statDocentes').textContent = stats.total_docentes_evaluados;

        // 2. Cargar evaluaciones para extraer los borradores
        const todas = await api.evaluaciones.getAll(colegioId);
        const borradores = todas.filter(ev => ev.estado === 'BORRADOR');
        
        renderBorradoresDashboard(borradores);
        
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
    }
}

function renderBorradoresDashboard(borradores) {
    const tbody = document.getElementById('tableBorradoresDashboard');
    const badge = document.getElementById('badgeBorradoresCount');
    if (!tbody) return;

    if (borradores.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="padding: 40px; text-align: center; color: #94a3b8;">
                    <i class="fas fa-check-circle" style="font-size: 2rem; color: #10b981; margin-bottom: 10px; display: block;"></i>
                    No tienes borradores pendientes. ¡Buen trabajo!
                </td>
            </tr>
        `;
        if (badge) badge.style.display = 'none';
        return;
    }

    if (badge) {
        badge.textContent = `${borradores.length} Pendientes`;
        badge.style.display = 'inline-block';
    }

    tbody.innerHTML = borradores.map(ev => `
        <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.2s;">
            <td style="padding: 12px 15px;">
                <div style="font-weight: 700; color: #1e293b; font-size: 1em;">${ev.docente_nombre || 'Sin nombre'}</div>
                <div style="font-size: 0.8em; color: #004080; font-weight: 500;">🏫 ${ev.colegio_nombre || 'Sin colegio'}</div>
            </td>
            <td style="padding: 12px 15px; color: #475569; font-size: 0.9em;">
                ${new Date(ev.fecha).toLocaleDateString('es-CL')}
            </td>
            <td style="padding: 12px 15px; text-align: center;">
                <span style="background: #eff6ff; color: #1e40af; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 0.9em;">
                    ${ev.promedio ? ev.promedio.toFixed(2) : '-.--'}
                </span>
            </td>
            <td style="padding: 12px 15px; text-align: right; display: flex; gap: 8px; justify-content: flex-end;">
                <button class="btn btn-sm" onclick="app.verFormularioSoloLectura(${ev.id})" 
                        style="background: #e2e8f0; border: 1px solid #cbd5e1; color: #334155; padding: 7px 12px; border-radius: 6px; font-size: 0.85em; font-weight: 600; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 5px;">
                    📋 Ver Formulario
                </button>
                <button class="btn btn-sm" onclick="app.verDetalle(${ev.id})" 
                        style="background: #fff; border: 1px solid #cbd5e1; color: #334155; padding: 7px 12px; border-radius: 6px; font-size: 0.85em; font-weight: 600; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 5px;">
                    🔍 Ver Resumen
                </button>
            </td>
        </tr>
    `).join('');
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
