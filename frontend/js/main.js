import { api } from './api.js';
import { state } from './state.js';
import { loadUserInfo, setupNavigation, navigateTo, logout } from './navigation.js';
import { mostrarLoading, showAlert, closeAlert, capitalize, loadModularPages } from './utils.js';
import { showModal, closeModal } from './modules/ui.js';
import { 
    loadDocentes, saveDocente, deleteDocente, editDocente, 
    loadColegiosForFilter, exportarDocentesExcel, descargarDocentesPlantilla, importarDocentesExcel,
    setupTOTP, confirmTOTP, closeModalTotp
} from './modules/docentes.js';
import { 
    loadEvaluaciones, initEvaluacionForm, guardarEvaluacion, 
    calcularPromedios, closeResumen, verDetalle, deleteEvaluacion,
    previsualizarPDF, cerrarPreviewPDF, descargarPDF, imprimirResumen, crearNuevaEvaluacion,
    limpiarFiltrosEval, loadColegiosForEvalFilter, verFormularioSoloLectura, sortData,
    descargarFormularioPDF, prepareSignature, finalizeEvaluation,
    closeModalSignature, cancelSignatureProcess, submitManualSignature,
    sendEmailAccompaniment, showEmailSuccessModal, copyShareLink, sendEmailWithSummary,
    showEmailResendModal, showEmailResendModalFromHeader, guardarCambiosBorrador,
    resumeEditingDraft
} from './modules/evaluaciones.js';
import { 
    loadDashboardStats, loadColegiosForDashboardFilter 
} from './modules/dashboard_stats.js';
import { 
    respaldarManual, enviarRespaldoCorreo 
} from './modules/config.js';
import {
    loadColegios, saveColegio, deleteColegio, editColegio,
    loadCursos, saveCurso, deleteCurso,
    loadAsignaturas, saveAsignatura, deleteAsignatura,
    loadUsuarios, deleteUsuario, editUsuario, closeUserModal
} from './modules/admin.js';
import {
    initReportes, actualizarReportes, exportarReportePDF
} from './modules/reportes.js';
import {
    loadPlantilla, showModalDimension, saveDimension, deleteDimension,
    showModalIndicador, saveIndicador, deleteIndicador, exportarPlantillaExcel
} from './modules/plantilla.js';

// Expose to window for HTML onclick/onchange handlers
const app = {
    logout,
    navigateTo,
    showModal,
    closeModal,
    // Docentes
    loadDocentes, saveDocente, deleteDocente, editDocente,
    loadColegiosForFilter, exportarDocentesExcel, descargarDocentesPlantilla, importarDocentesExcel,
    setupTOTP, confirmTOTP, closeModalTotp,
    // Evaluaciones
    loadEvaluaciones, initEvaluacionForm, guardarEvaluacion,
    calcularPromedios, closeResumen, verDetalle, deleteEvaluacion,
    previsualizarPDF, cerrarPreviewPDF, descargarPDF, imprimirResumen, crearNuevaEvaluacion,
    limpiarFiltrosEval, loadColegiosForEvalFilter, verFormularioSoloLectura, sortData, descargarFormularioPDF,
    prepareSignature, finalizeEvaluation,
    closeModalSignature, cancelSignatureProcess, submitManualSignature,
    sendEmailAccompaniment,
    showEmailResendModal,
    showEmailResendModalFromHeader,
    showEmailSuccessModal,
    copyShareLink,
    sendEmailWithSummary,
    guardarCambiosBorrador,
    resumeEditingDraft,
    // Dashboard
    loadDashboardStats, loadColegiosForDashboardFilter,
    // Config
    respaldarManual, enviarRespaldoCorreo,
    // Admin CRUDs
    loadColegios, saveColegio, deleteColegio, editColegio,
    loadCursos, saveCurso, deleteCurso,
    loadAsignaturas, saveAsignatura, deleteAsignatura,
    loadUsuarios, deleteUsuario, editUsuario, closeUserModal,
    // Reportes
    initReportes, actualizarReportes, exportarReportePDF,
    // Plantilla
    loadPlantilla, showModalDimension, saveDimension, deleteDimension,
    showModalIndicador, saveIndicador, deleteIndicador, exportarPlantillaExcel,
    // Utils
    showAlert, closeAlert, mostrarLoading, capitalize,
    // Configuración de Correos
    loadEmailRecipients,
    addEmailRecipient,
    deleteEmailRecipient
};

Object.assign(window, app);
window.app = app;

// Orchestrate global navigation events
window.addEventListener('page-navigation', async (e) => {
    const { page } = e.detail;
    console.log('Navigating to module:', page);
    
    switch (page) {
        case 'inicio':
            await loadColegiosForDashboardFilter();
            await loadDashboardStats();
            break;
        case 'evaluaciones':
            await loadEvaluaciones();
            break;
        case 'nueva-evaluacion':
            await initEvaluacionForm();
            break;
        case 'docentes':
            await loadDocentes();
            await loadColegiosForFilter();
            break;
        case 'colegios':
            await loadColegios();
            break;
        case 'cursos':
            await loadCursos();
            break;
        case 'asignaturas':
            await loadAsignaturas();
            break;
        case 'usuarios':
            await loadUsuarios();
            break;
        case 'plantilla':
            await loadPlantilla();
            break;
        case 'reportes':
            await initReportes();
            break;
        case 'resumen-evaluacion':
            window.scrollTo(0, 0);
            break;
        case 'config-emails':
            // Cargar colegios para el dropdown de destinatarios
            try {
                const colegios = await api.colegios.getAll();
                const selectColegio = document.getElementById('newRecipientColegio');
                if (selectColegio) {
                    selectColegio.innerHTML = '<option value="">Todos los colegios (Global)</option>' + 
                        colegios.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
                }
            } catch (err) {
                console.error('Error loading schools for config:', err);
            }
            await loadEmailRecipients();
            break;
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing Modular Frontend...');
    
    try {
        await loadModularPages();
        console.log('Modular pages loaded successfully');

        if (!api.checkAuth()) return;

        setupNavigation();
        
        await loadUserInfo();
        console.log('User info loaded successfully');
        
        // Global Event Listeners
        document.getElementById('btnLogout')?.addEventListener('click', logout);
        document.getElementById('evaluacionForm')?.addEventListener('submit', (e) => {
            if (window.app && window.app.guardarEvaluacion) window.app.guardarEvaluacion(e);
        });
        
        // Initialize default page
        const lastPage = localStorage.getItem('lastPage') || 'inicio';
        navigateTo(lastPage);

        // Menú de configuración: Ahora son links directos manejados por setupNavigation
    } catch (globalErr) {
        console.error('Fatal initialization error:', globalErr);
        document.body.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; text-align: center; padding: 20px;">
                <h1 style="color: #dc3545;">Error de Inicialización</h1>
                <p>No se pudo cargar el sistema correctamente. Por favor, intenta recargar la página.</p>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 20px; text-align: left; max-width: 600px; overflow: auto; border: 1px solid #ddd;">
                    <code style="color: #c62828;">${globalErr.message}</code>
                </div>
            </div>
        `;
    }
});

// --- Funciones de Configuración de Correos ---
async function loadEmailRecipients() {
    try {
        const recipients = await api.config.getEmailRecipients();
        const listEl = document.getElementById('emailRecipientsList');
        if (!listEl) return;
        
        listEl.innerHTML = recipients.map(r => `
            <tr>
                <td>${r.nombre}</td>
                <td>${r.email}</td>
                <td><span class="badge badge-info">${r.colegio_nombre || 'Global'}</span></td>
                <td><span class="badge ${r.activo ? 'badge-success' : 'badge-secondary'}">${r.activo ? 'Activo' : 'Inactivo'}</span></td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="window.app.deleteEmailRecipient(${r.id})">Eliminar</button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="5" class="text-center">No hay destinatarios configurados.</td></tr>';
    } catch (error) {
        console.error('Error loadEmailRecipients:', error);
    }
}

async function addEmailRecipient(e) {
    if (e) e.preventDefault();
    const nombre = document.getElementById('newRecipientNombre').value;
    const email = document.getElementById('newRecipientEmail').value;
    const colegio_id = document.getElementById('newRecipientColegio').value;
    
    if (!nombre || !email) return;
    
    try {
        mostrarLoading(true, 'Agregando destinatario...');
        await api.config.createEmailRecipient({ 
            nombre, 
            email, 
            colegio_id: colegio_id ? parseInt(colegio_id) : null,
            activo: true 
        });
        mostrarLoading(false);
        document.getElementById('formAddRecipient').reset();
        await loadEmailRecipients();
        showAlert('Éxito', 'Destinatario agregado correctamente', 'success');
    } catch (error) {
        mostrarLoading(false);
        showAlert('Error', error.message, 'error');
    }
}

async function deleteEmailRecipient(id) {
    if (!confirm('¿Desea eliminar este destinatario?')) return;
    try {
        mostrarLoading(true, 'Eliminando...');
        await api.config.deleteEmailRecipient(id);
        mostrarLoading(false);
        await loadEmailRecipients();
        showAlert('Éxito', 'Destinatario eliminado', 'success');
    } catch (error) {
        mostrarLoading(false);
        showAlert('Error', error.message, 'error');
    }
}
