import { api } from './api.js';
import { state } from './state.js';
import { loadUserInfo, setupNavigation, navigateTo, logout } from './navigation.js';
import { mostrarLoading, showAlert, closeAlert, capitalize } from './utils.js';
import { showModal, closeModal } from './modules/ui.js';
import { 
    loadDocentes, saveDocente, deleteDocente, editDocente, 
    loadColegiosForFilter, exportarDocentesExcel, descargarDocentesPlantilla, importarDocentesExcel 
} from './modules/docentes.js';
import { 
    loadEvaluaciones, initEvaluacionForm, guardarEvaluacion, 
    calcularPromedios, closeResumen, verDetalle, deleteEvaluacion,
    previsualizarPDF, cerrarPreviewPDF, descargarPDF, imprimirResumen, crearNuevaEvaluacion,
    limpiarFiltrosEval, loadColegiosForEvalFilter, verFormularioSoloLectura, sortData,
    descargarFormularioPDF
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
    // Evaluaciones
    loadEvaluaciones, initEvaluacionForm, guardarEvaluacion,
    calcularPromedios, closeResumen, verDetalle, deleteEvaluacion,
    previsualizarPDF, cerrarPreviewPDF, descargarPDF, imprimirResumen, crearNuevaEvaluacion,
    limpiarFiltrosEval, loadColegiosForEvalFilter, verFormularioSoloLectura, sortData, descargarFormularioPDF,
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
    showAlert, closeAlert, mostrarLoading, capitalize
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
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing Modular Frontend...');
    
    try {
        if (!api.checkAuth()) return;

        setupNavigation();
        
        try {
            await loadUserInfo();
        } catch (authErr) {
            console.warn('Non-blocking auth error:', authErr);
        }
        
        // Global Event Listeners
        document.getElementById('btnLogout')?.addEventListener('click', logout);
        document.getElementById('evaluacionForm')?.addEventListener('submit', (e) => {
            if (window.app && window.app.guardarEvaluacion) window.app.guardarEvaluacion(e);
        });
        
        // Initialize default page
        const lastPage = localStorage.getItem('lastPage') || 'inicio';
        navigateTo(lastPage);

        // Initialize SlimSelect for Config with safety
        if (document.getElementById('sidebarConfigSelect') && typeof SlimSelect !== 'undefined') {
            new SlimSelect({
                select: '#sidebarConfigSelect',
                settings: { showSearch: false, placeholderText: 'Configuración' }
            });
            
            document.getElementById('sidebarConfigSelect').addEventListener('change', (e) => {
                const value = e.target.value;
                if (value === 'backup_manual') respaldarManual();
                else if (value === 'backup_email') enviarRespaldoCorreo();
                if (value) setTimeout(() => { e.target.value = ''; }, 1000);
            });
        }
    } catch (globalErr) {
        console.error('Fatal initialization error:', globalErr);
    }
});
