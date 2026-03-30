import { api } from '../api.js';
import { mostrarLoading, showAlert } from '../utils.js';

// Registrar plugin de etiquetas si está disponible globalmente
if (typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
}

let charts = {};
let dimensionesCache = [];

export async function initReportes() {
    await loadFiltrosReportes();
    await actualizarReportes();
    
    // Configurar toggle del mapa de talentos si no existe el handler global
    window.toggleTalentMap = toggleTalentMap;
}

async function loadFiltrosReportes() {
    try {
        const selAnio = document.getElementById('repFilterAnio');
        if (selAnio && selAnio.options.length === 0) {
            const currentYear = new Date().getFullYear();
            let options = '';
            for (let y = currentYear - 2; y <= currentYear + 1; y++) {
                options += `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`;
            }
            selAnio.innerHTML = options;
        }

        const colegios = await api.colegios.getAll();
        const asignaturas = await api.asignaturas.getAll();
        
        const selCol = document.getElementById('repFilterColegio');
        const selAsig = document.getElementById('repFilterAsignatura');
        
        if (selCol) {
            selCol.innerHTML = '<option value="">Todos los colegios</option>' + 
                colegios.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
        }
        if (selAsig) {
            selAsig.innerHTML = '<option value="">Todas las asignaturas</option>' + 
                asignaturas.map(a => `<option value="${a.id}">${a.nombre}</option>`).join('');
        }
    } catch (error) {
        console.error('Error cargando filtros:', error);
    }
}

export async function actualizarReportes() {
    const params = {};
    const colId = document.getElementById('repFilterColegio').value;
    const asigId = document.getElementById('repFilterAsignatura').value;
    const from = document.getElementById('repFechaInicio').value;
    const to = document.getElementById('repFechaFin').value;
    const anio = document.getElementById('repFilterAnio').value;

    if (colId) params.colegio_id = colId;
    if (asigId) params.asignatura_id = asigId;
    if (from) params.fecha_inicio = from;
    if (to) params.fecha_fin = to;
    if (anio) params.anio = anio;

    try {
        mostrarLoading(true, 'Generando informes de acompañamiento...');
        
        // Parámetros para el mapa de talentos (incluye tipo de vista)
        const vView = document.getElementById('filterTalentView')?.value || 'promedio';
        const talentParams = { ...params, tipo_vista: vView };

        // Ejecutar peticiones en paralelo
        const [stats, talentMap, dimensiones] = await Promise.all([
            api.evaluaciones.getStats(params),
            api.evaluaciones.getTalentMap(talentParams),
            dimensionesCache.length > 0 ? Promise.resolve(dimensionesCache) : api.dimensiones.getAll()
        ]);
        
        if (dimensionesCache.length === 0) dimensionesCache = dimensiones;
        
        document.getElementById('repStatTotal').textContent = stats.total_evaluaciones;
        document.getElementById('repStatPromedio').textContent = stats.promedio_global.toFixed(2);
        
        renderDocentesNivelesChart(stats.distribucion_func_grupo);
        renderNivelesChart(stats.distribucion_niveles);
        renderMensualChart(stats.por_mes);
        renderColegiosChart(stats.por_colegio);
        renderCursosChart(stats.por_curso);
        renderComparativoChart(stats.dimensiones_por_colegio, dimensiones);
        renderDocentesDimensionesCharts(stats.dimensiones_por_docente, dimensiones);
        renderTalentMap(talentMap.puntaje, '');
        renderTalentMap(talentMap.orientacion, 'Orientacion');
        
    } catch (error) {
        console.error('Error API Stats:', error);
        showAlert('Error', 'No se pudieron cargar las estadísticas', 'error');
    } finally {
        mostrarLoading(false);
    }
}

function renderDocentesNivelesChart(data) {
    const ctx = document.getElementById('chartFuncGrupo').getContext('2d');
    if (charts.docentesNiveles) charts.docentesNiveles.destroy();
    
    if (!data) return;

    // Ordenar niveles según requerimiento
    const labels = ["Bajo", "Regular", "Adecuado", "Bueno", "Muy bueno"];
    const values = labels.map(l => data[l] || 0);

    // Colores profesionales (Rojo -> Naranja -> Amarillo -> Verde -> Azul/Verde)
    const backgroundColors = [
        '#ff4d4d', // Bajo
        '#ffa64d', // Regular
        '#ffdb4d', // Adecuado
        '#88cc00', // Bueno
        '#00cc66'  // Muy bueno
    ];

    charts.docentesNiveles = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Cantidad de Profesores',
                data: values,
                backgroundColor: backgroundColors,
                borderColor: backgroundColors.map(c => c),
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                datalabels: {
                    display: true,
                    anchor: 'end',
                    align: 'top',
                    offset: 5,
                    formatter: (value) => value.toString(),
                    font: { weight: 'bold', size: 14 },
                    color: '#000',
                    textShadowColor: 'rgba(255,255,255,0.8)',
                    textShadowBlur: 3
                }
            },
            scales: { 
                y: { 
                    beginAtZero: true,
                    suggestedMax: 5,
                    ticks: { stepSize: 1, font: { weight: 'bold' } }
                },
                x: {
                    ticks: { font: { weight: '700' } }
                }
            }
        }
    });
}

function renderNivelesChart(data) {
    const ctx = document.getElementById('chartNiveles').getContext('2d');
    if (charts.niveles) charts.niveles.destroy();
    
    const total = Object.values(data).reduce((a, b) => a + b, 0);

    charts.niveles = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(data),
            datasets: [{
                data: Object.values(data),
                backgroundColor: [
                    '#ff4d4d', '#ffa64d', '#ffdb4d', '#88cc00', '#00cc66'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    position: 'bottom',
                    labels: { padding: 20, usePointStyle: true }
                },
                datalabels: {
                    color: '#fff',
                    font: { weight: 'bold', size: 14 },
                    textShadowColor: 'rgba(0,0,0,0.5)',
                    textShadowBlur: 4,
                    formatter: (value) => {
                        if (total === 0) return '';
                        const percentage = ((value / total) * 100).toFixed(1) + '%';
                        return value > 0 ? percentage : '';
                    }
                }
            }
        }
    });
}

function renderMensualChart(data) {
    const el = document.getElementById('chartMensual');
    if (!el) {
        console.warn('Canvas chartMensual no encontrado');
        return;
    }
    const ctx = el.getContext('2d');
    if (charts.mensual) charts.mensual.destroy();
    
    // Si no hay datos, inicializar con ceros
    const monthData = data || { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0, 10:0, 11:0, 12:0 };

    const labels = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const values = labels.map((_, i) => monthData[i + 1] || 0);

    charts.mensual = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Acompañamientos',
                data: values,
                backgroundColor: '#003366',
                borderColor: '#003366',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                datalabels: {
                    display: true,
                    anchor: 'end',
                    align: 'top',
                    offset: 3,
                    formatter: (val) => val > 0 ? val : '0',
                    font: { weight: 'bold', size: 12 },
                    color: '#444'
                }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    suggestedMax: 5,
                    ticks: { stepSize: 1 }
                }
            }
        }
    });
}

function renderColegiosChart(data) {
    const ctx = document.getElementById('chartColegios').getContext('2d');
    if (charts.colegios) charts.colegios.destroy();
    
    const labels = Object.keys(data);
    const backgroundColors = labels.map(label => {
        const lowerLabel = label.toLowerCase();
        if (lowerLabel.includes('macaya')) return '#1b5e20'; // Verde oscuro
        if (lowerLabel.includes('diego portales') || lowerLabel.includes('portales')) return '#0d47a1'; // Azul oscuro
        return 'rgba(255, 159, 64, 0.7)'; // Default
    });

    charts.colegios = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Promedio Global',
                data: Object.values(data),
                backgroundColor: backgroundColors,
                borderColor: backgroundColors.map(c => c.replace('0.7', '1')),
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                datalabels: {
                    anchor: 'end',
                    align: 'start',
                    offset: 5,
                    formatter: (value) => value.toFixed(2),
                    font: { weight: 'bold', size: 12 },
                    color: '#fff',
                    textShadowColor: 'rgba(0,0,0,0.5)',
                    textShadowBlur: 3
                }
            },
            scales: { y: { beginAtZero: true, max: 5 } }
        }
    });
}

function renderCursosChart(data) {
    const ctx = document.getElementById('chartCursos').getContext('2d');
    if (charts.cursos) charts.cursos.destroy();
    
    const labels = Object.keys(data).sort();
    const values = labels.map(l => data[l]);

    charts.cursos = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Promedio por Curso',
                data: values,
                backgroundColor: 'rgba(75, 192, 192, 0.7)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1,
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                datalabels: {
                    anchor: 'end',
                    align: 'start',
                    offset: 5,
                    formatter: (value) => value.toFixed(2),
                    font: { weight: 'bold', size: 12 },
                    color: '#fff',
                    textShadowColor: 'rgba(0,0,0,0.5)',
                    textShadowBlur: 3
                }
            },
            scales: {
                y: { 
                    beginAtZero: true, 
                    max: 5,
                    ticks: { stepSize: 1 }
                },
                x: {
                    ticks: {
                        autoSkip: false,
                        maxRotation: 45,
                        minRotation: 0,
                        font: { size: 10 }
                    }
                }
            }
        }
    });
}

function renderDocentesDimensionesCharts(data, dimensiones) {
    if (!data || Object.keys(data).length === 0) return;

    const docentes = Object.keys(data).sort();
    
    // Nombres de Dimensiones
    const dimNames = dimensiones && dimensiones.length > 0 
        ? dimensiones.map(d => d.nombre)
        : ['Dim 1', 'Dim 2', 'Dim 3', 'Dim 4', 'Dim 5'];

    // Colores para cada gráfico (pueden ser iguales o diferentes)
    const colors = [
        'rgba(54, 162, 235, 0.7)',  // Azul
        'rgba(255, 99, 132, 0.7)',  // Rojo
        'rgba(255, 206, 86, 0.7)',  // Amarillo
        'rgba(75, 192, 192, 0.7)',  // Verde agua
        'rgba(153, 102, 255, 0.7)'  // Púrpura
    ];

    // Iterar por las 5 dimensiones
    for (let i = 0; i < 5; i++) {
        const charId = `chartDocenteDim${i+1}`;
        const titleId = `titleDim${i+1}`;
        const ctx = document.getElementById(charId).getContext('2d');
        const chartKey = `docenteDim${i+1}`;

        if (charts[chartKey]) charts[chartKey].destroy();

        // Actualizar título
        const titleEl = document.getElementById(titleId);
        if (titleEl) titleEl.textContent = dimNames[i] || `Dimensión ${i+1}`;

        const datasetValues = docentes.map(doc => data[doc][i] || 0);

        charts[chartKey] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: docentes,
                datasets: [{
                    label: 'Puntaje',
                    data: datasetValues,
                    backgroundColor: colors[i],
                    borderColor: colors[i].replace('0.7', '1'),
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        anchor: 'end',
                        align: 'start',
                        offset: 2,
                        formatter: (value) => value > 0 ? value.toFixed(2) : '0',
                        font: { size: 10, weight: 'bold' },
                        color: '#fff',
                        textShadowColor: 'rgba(0,0,0,0.5)',
                        textShadowBlur: 3
                    }
                },
                scales: {
                    y: { beginAtZero: true, max: 5, ticks: { stepSize: 1 } },
                    x: {
                        ticks: {
                            autoSkip: false,
                            maxRotation: 45,
                            minRotation: 45,
                            font: { size: 10 }
                        }
                    }
                }
            }
        });
    }
}

function renderComparativoChart(data, dimensiones) {
    const ctx = document.getElementById('chartComparativo').getContext('2d');
    if (charts.comparativo) charts.comparativo.destroy();
    
    if (!data || Object.keys(data).length === 0) return;

    const labels = dimensiones && dimensiones.length > 0 
        ? dimensiones.map(d => d.nombre)
        : ['Dim 1', 'Dim 2', 'Dim 3', 'Dim 4', 'Dim 5'];

    const datasets = Object.keys(data).map(colName => {
        const lowerName = colName.toLowerCase();
        let color = 'rgba(153, 102, 255, 0.7)';
        if (lowerName.includes('macaya')) color = '#1b5e20';
        else if (lowerName.includes('diego portales') || lowerName.includes('portales')) color = '#0d47a1';

        return {
            label: colName,
            data: data[colName],
            backgroundColor: color,
            borderColor: color,
            borderWidth: 1,
            borderRadius: 4
        };
    });

    charts.comparativo = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                datalabels: {
                    anchor: 'end',
                    align: 'start',
                    offset: 2,
                    formatter: (value) => value > 0 ? value.toFixed(2) : '',
                    font: { size: 11, weight: 'bold' },
                    color: '#fff',
                    textShadowColor: 'rgba(0,0,0,0.5)',
                    textShadowBlur: 3
                }
            },
            scales: {
                y: { beginAtZero: true, max: 5 },
                x: {
                    ticks: {
                        autoSkip: false,
                        maxRotation: 45,
                        minRotation: 0,
                        font: { size: 11 }
                    }
                }
            }
        }
    });
}

export function exportarReportePDF() {
    window.print();
}

function renderTalentMap(data, suffix = '') {
    const listIds = {
        avanzado: 'listAvanzado' + suffix,
        intermedio: 'listIntermedio' + suffix,
        en_desarrollo: 'listDesarrollo' + suffix,
        inicial: 'listInicial' + suffix,
        prioritario: 'listPrioritario' + suffix
    };

    Object.keys(listIds).forEach(key => {
        const list = document.getElementById(listIds[key]);
        if (!list) return;
        
        const teachers = data[key] || [];
        list.innerHTML = teachers.length > 0 
            ? teachers.map(t => `
                <li style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; margin-bottom: 6px; background: #fff; border-radius: 6px; border-left: 3px solid currentColor; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <span style="font-weight: 500; color: #444; font-size: 0.95em;">${t.nombre}</span>
                    <span style="background: rgba(0,0,0,0.05); color: #666; padding: 2px 8px; border-radius: 10px; font-size: 0.8em; font-weight: bold; border: 1px solid rgba(0,0,0,0.1);">
                        ${t.puntaje.toFixed(2)}
                    </span>
                </li>
            `).join('')
            : '<li style="color: #999; font-style: italic; background: transparent; border: none; text-align: center; padding: 20px;">Sin docentes</li>';
    });
}

export function toggleTalentMap(suffix = '') {
    const body = document.getElementById('talentMapBody' + suffix);
    const icon = document.getElementById('talentMapIcon' + suffix);
    if (!body || !icon) return;

    if (body.style.display === 'none' || !body.style.display) {
        body.style.display = 'block';
        body.classList.add('active');
        icon.style.transform = 'rotate(180deg)';
    } else {
        body.style.display = 'none';
        body.classList.remove('active');
        icon.style.transform = 'rotate(0deg)';
    }
}
