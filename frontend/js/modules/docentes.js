import { api } from '../api.js';
import { state, setState } from '../state.js';
import { mostrarLoading, showAlert } from '../utils.js';
import { showModal, closeModal } from './ui.js';

export async function loadDocentes() {
    const tbody = document.getElementById('docentesBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6">Cargando...</td></tr>';

    const filterColegio = document.getElementById('filterColegioDocentes')?.value;
    const filterNombre = document.getElementById('filterNombreDocentes')?.value?.toLowerCase();

    try {
        let data = await api.docentes.getAll();
        
        // Aplicar filtros locales
        if (filterColegio) {
            data = data.filter(d => d.colegio_id === parseInt(filterColegio));
        }
        if (filterNombre) {
            data = data.filter(d => 
                (d.nombre || '').toLowerCase().includes(filterNombre) || 
                (d.rut || '').toLowerCase().includes(filterNombre)
            );
        }

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay docentes registrados</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(d => `
            <tr>
                <td style="display:none;">${d.id}</td>
                <td>${d.nombre}</td>
                <td>${d.rut}</td>
                <td>${d.email || '-'}</td>
                <td>${d.colegio?.nombre || '-'}</td>
                <td>
                    <div class="actions" style="display: flex; gap: 8px; justify-content: center;">
                        ${!d.has_totp ? `
                            <button class="btn btn-primary btn-sm" onclick="window.app.setupTOTP(${d.id})" title="Configurar Firma Digital" style="padding: 5px 10px;">🔑</button>
                        ` : '<span title="Firma Activa" style="font-size: 1.2em; cursor: default;">✅</span>'}
                        <button class="btn btn-warning btn-sm" onclick="window.app.editDocente(${d.id})" title="Editar" style="padding: 5px 10px;">📝</button>
                        <button class="btn btn-danger btn-sm" onclick="window.app.deleteDocente(${d.id})" title="Eliminar" style="padding: 5px 10px;">🗑️</button>
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

// FIRMA DIGITAL (TOTP)
export async function setupTOTP(docenteId) {
    const d = state.docentes.find(doc => doc.id === docenteId);
    if (!d) return;

    try {
        console.log('Setting up TOTP for docente:', docenteId);
        mostrarLoading(true, 'Generando clave de firma...');
        const res = await api.totp.setup(docenteId);
        console.log('TOTP Setup response:', res);
        mostrarLoading(false);

        document.getElementById('totpDocenteNombre').textContent = d.nombre;
        document.getElementById('totpDocenteRut').textContent = `RUT: ${d.rut}`;
        document.getElementById('qrcodeContainer').innerHTML = '';
        document.getElementById('totpVerifyCode').value = '';

        // Generar QR
        console.log('Generating QR Code...');
        new QRCode(document.getElementById('qrcodeContainer'), {
            text: res.provisioning_uri,
            width: 200,
            height: 200
        });

        console.log('Opening modal...');
        document.getElementById('modalTotpOverlay').classList.add('active');

        // Configurar botón de confirmación
        const btn = document.getElementById('btnConfirmTotp');
        btn.onclick = () => confirmTOTP(docenteId, res.secret);

    } catch (error) {
        console.error('Error in setupTOTP:', error);
        mostrarLoading(false);
        showAlert('Error', error.message, 'error');
    }
}

export async function confirmTOTP(docenteId, secret) {
    const code = document.getElementById('totpVerifyCode').value;
    if (!code || code.length !== 6) {
        showAlert('Código inválido', 'Ingrese el código de 6 dígitos de su app', 'warning');
        return;
    }

    try {
        mostrarLoading(true, 'Vinculando autenticador...');
        await api.totp.confirm(docenteId, { secret, code });
        mostrarLoading(false);
        
        closeModalTotp();
        showAlert('¡Éxito!', 'La firma digital ha sido vinculada correctamente.', 'success');
    } catch (error) {
        mostrarLoading(false);
        showAlert('Error de vinculación', error.message, 'error');
    }
}

export function closeModalTotp() {
    document.getElementById('modalTotpOverlay').classList.remove('active');
}
