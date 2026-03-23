import { api } from '../api.js';
import { state, setState } from '../state.js';
import { mostrarLoading, showAlert } from '../utils.js';
import { showModal, closeModal } from './ui.js';

export async function loadDocentes() {
    const tbody = document.getElementById('docentesBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6">Cargando...</td></tr>';

    const filterColegio = document.getElementById('filterColegioDocentes')?.value;

    try {
        let data = await api.docentes.getAll();
        if (filterColegio) {
            data = data.filter(d => d.colegio_id === parseInt(filterColegio));
        }

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay docentes registrados</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(d => `
            <tr>
                <td>${d.id}</td>
                <td>${d.nombre}</td>
                <td>${d.rut}</td>
                <td>${d.email || '-'}</td>
                <td>${d.colegio?.nombre || '-'}</td>
                <td>
                    <div class="actions">
                        <button class="btn btn-warning btn-sm" onclick="window.app.editDocente(${d.id})">Editar</button>
                        <button class="btn btn-danger btn-sm" onclick="window.app.deleteDocente(${d.id})">Eliminar</button>
                    </div>
                </td>
            </tr>
        `).join('');
        
        setState('docentes', data);
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center">Error: ${error.message}</td></tr>`;
    }
}

export async function loadColegiosForFilter() {
    const select = document.getElementById('filterColegioDocentes');
    if (!select) return;

    select.innerHTML = '<option value="">Todos los colegios</option>';

    try {
        const colegios = await api.colegios.getAll();
        setState('colegios', colegios);
        colegios.forEach(c => {
            select.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
        });
    } catch (error) {
        console.error('Error cargando filtros de colegio:', error);
    }
}

export async function saveDocente(id) {
    const nombre = document.getElementById('modalNombre').value;
    const rut = document.getElementById('modalRut').value;
    const email = document.getElementById('modalEmail').value;
    const colegio_id = parseInt(document.getElementById('modalColegio').value);

    if (!nombre || !rut || !colegio_id) { 
        showAlert('Campos requeridos', 'Por favor complete todos los campos obligatorios (*)', 'warning'); 
        return; 
    }

    try {
        if (id && id !== 'null') {
            await api.docentes.update(id, { nombre, rut, email, colegio_id });
        } else {
            await api.docentes.create({ nombre, rut, email, colegio_id });
        }
        closeModal();
        loadDocentes();
    } catch (error) {
        showAlert('Error', 'No se pudo guardar el docente: ' + error.message, 'error');
    }
}

export function editDocente(id) {
    const d = state.docentes.find(doc => doc.id === id);
    if (d) showModal('docente', d);
}

export async function deleteDocente(id) {
    if (!confirm('¿Está seguro de eliminar este docente?')) return;
    try {
        await api.docentes.delete(id);
        loadDocentes();
    } catch (error) {
        console.error('Error al eliminar docente:', error);
        showAlert('No se puede eliminar', error.message, 'warning');
    }
}

export async function exportarDocentesExcel() {
    try {
        mostrarLoading(true, 'Generando archivo Excel...');
        const response = await api.docentes.exportExcel();
        if (!response.ok) throw new Error('Error al exportar docentes');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `docentes_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        mostrarLoading(false);
    } catch (error) {
        mostrarLoading(false);
        showAlert('Error', error.message, 'error');
    }
}

export async function descargarDocentesPlantilla() {
    try {
        mostrarLoading(true, 'Descargando plantilla...');
        const response = await api.docentes.downloadTemplate();
        if (!response.ok) throw new Error('Error al descargar plantilla');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `plantilla_docentes.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        mostrarLoading(false);
    } catch (error) {
        mostrarLoading(false);
        showAlert('Error', error.message, 'error');
    }
}

export async function importarDocentesExcel(input) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    
    if (!confirm(`¿Desea importar los docentes desde el archivo "${file.name}"?`)) {
        input.value = '';
        return;
    }

    try {
        mostrarLoading(true, 'Importando docentes...');
        const res = await api.docentes.importExcel(file);
        mostrarLoading(false);
        
        let msg = res.message;
        if (res.errors && res.errors.length > 0) {
            msg += '\n\nErrores encontrados:\n' + res.errors.join('\n');
        }
        showAlert('Resultado de importación', msg, res.errors?.length ? 'warning' : 'success');
        
        loadDocentes(); 
    } catch (error) {
        mostrarLoading(false);
        showAlert('Error', error.message, 'error');
    } finally {
        input.value = '';
    }
}
