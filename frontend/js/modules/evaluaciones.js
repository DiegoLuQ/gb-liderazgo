import { api } from '../api.js';
import { state, setState } from '../state.js';
import { mostrarLoading, showAlert, getInterpretacion, formatFecha, getBadgeClass } from '../utils.js';

// Cache for all evaluaciones to avoid re-fetching on filter change
let _allEvaluaciones = null;
let _sortConfig = { column: 'fecha', direction: 'desc' };

export async function loadEvaluaciones() {
    const tbody = document.getElementById('evaluacionesBody');
    if (!tbody) return;

    try {
        if (!_allEvaluaciones) {
            _allEvaluaciones = await api.evaluaciones.getAll();
            // Load colegios filter the first time
            await loadColegiosForEvalFilter();
        }
        renderEvaluaciones(_allEvaluaciones);
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Error: ${error.message}</td></tr>`;
    }
}

export function sortData(column) {
    if (_sortConfig.column === column) {
        _sortConfig.direction = _sortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
        _sortConfig.column = column;
        _sortConfig.direction = 'asc';
    }
    
    if (_allEvaluaciones) {
        renderEvaluaciones(_allEvaluaciones);
    }
}

export async function loadColegiosForEvalFilter() {
    const select = document.getElementById('filterColegioEval');
    if (!select || select.options.length > 1) return; // Already loaded
    try {
        const colegios = await api.colegios.getAll();
        colegios.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.nombre;
            select.appendChild(opt);
        });
    } catch (e) { console.error('Error cargando colegios para filtro:', e); }
}

function renderEvaluaciones(data) {
    const tbody = document.getElementById('evaluacionesBody');
    if (!tbody) return;

    // Apply filters
    const filterColegioEl = document.getElementById('filterColegioEval');
    const filterDocenteEl = document.getElementById('filterDocenteEval');
    const filterDesdeEl   = document.getElementById('filterFechaDesdeEval');
    const filterHastaEl   = document.getElementById('filterFechaHastaEval');

    const filterColegio  = filterColegioEl?.value || '';
    const filterDocente  = (filterDocenteEl?.value || '').toLowerCase();
    const filterDesde    = filterDesdeEl?.value || '';
    const filterHasta    = filterHastaEl?.value || '';

    let filtered = [...data];
    
    // Sorting
    filtered.sort((a, b) => {
        let valA = a[_sortConfig.column];
        let valB = b[_sortConfig.column];
        
        // Handle nulls
        if (valA === null || valA === undefined) valA = '';
        if (valB === null || valB === undefined) valB = '';
        
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        
        if (valA < valB) return _sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return _sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    if (filterColegio)  filtered = filtered.filter(e => String(e.colegio_id) === filterColegio);
    if (filterDocente)  filtered = filtered.filter(e => (e.docente_nombre || '').toLowerCase().includes(filterDocente));
    if (filterDesde)    filtered = filtered.filter(e => e.fecha >= filterDesde);
    if (filterHasta)    filtered = filtered.filter(e => e.fecha <= filterHasta);

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No se encontraron acompañamientos</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(e => `
        <tr>
            <td style="display:none;">${e.docente_id}</td>
            <td>${formatFecha(e.fecha)}</td>
            <td>${e.docente_nombre || '-'}</td>
            <td>${e.colegio_nombre || '-'}</td>
            <td>${e.curso_nombre || '-'}</td>
            <td><span class="badge ${getBadgeClass(e.promedio)}">${e.promedio ? Number(e.promedio).toFixed(2) : '-'}</span></td>
            <td>
                <div class="actions">
                    <button class="btn btn-info btn-sm" onclick="window.app.verDetalle(${e.id})" title="Ver Resumen">👁️ Ver</button>
                    <button class="btn btn-secondary btn-sm" onclick="window.app.verFormularioSoloLectura(${e.id})" title="Ver Formulario Original">📋 Formulario</button>
                    ${parseInt(localStorage.getItem('userRole')) === 1 ? `<button class="btn btn-danger btn-sm" onclick="window.app.deleteEvaluacion(${e.id})">Eliminar</button>` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

export function limpiarFiltrosEval() {
    const ids = ['filterColegioEval','filterDocenteEval','filterFechaDesdeEval','filterFechaHastaEval'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    if (_allEvaluaciones) renderEvaluaciones(_allEvaluaciones);
}

export async function verFormularioSoloLectura(id) {
    try {
        mostrarLoading(true, 'Cargando formulario...');
        await initEvaluacionForm(); // Resetear y cargar bases
        
        const evaluacion = await api.evaluaciones.getById(id);
        const e = evaluacion;

        // Llenar campos básicos (Diferente ID en HTML)
        const fechaEl = document.getElementById('fechaObservacion');
        if (fechaEl) fechaEl.value = e.fecha || '';
        
        const duracionEl = document.getElementById('duracion');
        if (duracionEl) duracionEl.value = e.duracion || '';

        const comentariosEl = document.getElementById('comentarios');
        if (comentariosEl) comentariosEl.value = e.comentarios || '';

        // Llenar selects (con await para asegurar carga de datos dependientes antes de asignar valor)
        const colegioSelect = document.getElementById('colegioSelect');
        const colId = e.docente?.colegio_id;
        if (colegioSelect && colId) {
            colegioSelect.value = colId;
            await loadDocentesByColegio(colId);
            const docenteSelect = document.getElementById('docenteSelect');
            if (docenteSelect && e.docente_id) docenteSelect.value = e.docente_id;
        }

        const nivelSelect = document.getElementById('nivelSelect');
        const nivId = e.curso?.nivel_id;
        if (nivelSelect && nivId) {
            nivelSelect.value = nivId;
            await loadCursosByNivel(nivId);
            const cursoSelect = document.getElementById('cursoSelect');
            if (cursoSelect && e.curso_id) cursoSelect.value = e.curso_id;
        }
        
        const asignaturaSelect = document.getElementById('asignaturaSelect');
        if (asignaturaSelect && e.asignatura_id) asignaturaSelect.value = e.asignatura_id;

        // Llenar Rúbrica
        if (e.respuestas) {
            e.respuestas.forEach(resp => {
                const radio = document.querySelector(`input[name="ind${resp.subdimension_id}"][value="${resp.valor}"]`);
                if (radio) radio.checked = true;
            });
            calcularPromedios();
        }

        // Llenar Radios Dinámicos
        if (e.func_grupo) {
            const radioFunc = document.querySelector(`input[name="funcGrupo"][value="${e.func_grupo}"]`);
            if (radioFunc) radioFunc.checked = true;
        }
        if (e.orientacion) {
            const radioOri = document.querySelector(`input[name="orientacion"][value="${e.orientacion}"]`);
            if (radioOri) radioOri.checked = true;
        }
        if (e.nivel_apoyo) {
            const radioApo = document.querySelector(`input[name="nivelApoyo"][value="${e.nivel_apoyo}"]`);
            if (radioApo) radioApo.checked = true;
        }

        // Llenar Checkboxes de Apoyo
        if (e.apoyos) {
            e.apoyos.forEach(ap => {
                const cb = document.querySelector(`.tipoApoyo[value="${ap.apoyo}"]`);
                if (cb) cb.checked = true;
            });
        }

        // Fortalezas y Aspectos
        if (e.fortalezas_aspectos) {
            const fort = e.fortalezas_aspectos.find(fa => fa.tipo === 'fortaleza');
            if (fort) document.getElementById('fortalezas').value = fort.contenido;
            
            const asp = e.fortalezas_aspectos.find(fa => fa.tipo === 'aspecto');
            if (asp) document.getElementById('aspectos').value = asp.contenido;
        }

        // Deshabilitar TODO
        document.querySelectorAll('#evaluacionForm input, #evaluacionForm select, #evaluacionForm textarea').forEach(el => {
            el.disabled = true;
        });

        // UI Adjustments
        const btnGuardar = document.getElementById('btnGuardarEvaluacion');
        if (btnGuardar) btnGuardar.style.display = 'none';
        
        const btnPdf = document.getElementById('btnDescargarFormulario');
        if (btnPdf) btnPdf.style.display = 'block';

        document.querySelector('#tituloFormulario').textContent = `Detalle de Acompañamiento #${id} (Solo Lectura)`;
        
        mostrarLoading(false);
        window.app.navigateTo('nueva-evaluacion', true);

    } catch (error) {
        mostrarLoading(false);
        showAlert('Error', `No se pudo cargar el formulario: ${error.message}`, 'error');
    }
}

export async function initEvaluacionForm() {
    try {
        mostrarLoading(true, 'Iniciando formulario de acompañamiento...');
        
        // Reset del estado del formulario (por si viene de solo lectura)
        const form = document.getElementById('evaluacionForm');
        if (form) {
            form.reset();
            const elements = form.querySelectorAll('input, select, textarea');
            elements.forEach(el => el.disabled = false);
        }
        const btnGuardar = document.getElementById('btnGuardarEvaluacion');
        if (btnGuardar) btnGuardar.style.display = 'block';
        
        const btnPdf = document.getElementById('btnDescargarFormulario');
        if (btnPdf) btnPdf.style.display = 'none';

        const titleH1 = document.getElementById('tituloFormulario');
        if (titleH1) titleH1.textContent = 'Nuevo Acompañamiento';

        // Cargar datos para selects
        const [colegios, niveles, cursos, asignaturas] = await Promise.all([
            api.colegios.getAll(),
            api.niveles.getAll(),
            api.cursos.getAll(),
            api.asignaturas.getAll()
        ]);

        setState('colegios', colegios);
        setState('niveles', niveles);
        setState('cursos', cursos);
        setState('asignaturas', asignaturas);

        // Solo poblar si no es rol usuario
        populateSelect('colegioSelect', colegios, 'Seleccione Colegio...');
        populateSelect('nivelSelect', niveles, 'Seleccione Nivel...');
        populateSelect('asignaturaSelect', asignaturas, 'Seleccione Asignatura...');
        
        // Auto-asignar observador desde el usuario logueado
        const obsDisplay = document.getElementById('observadorDisplay');
        const obsSelect = document.getElementById('observadorSelect');
        if (state.currentUser) {
            if (obsDisplay) obsDisplay.value = `${state.currentUser.username} (${state.currentUser.id})`;
            if (obsSelect) obsSelect.value = state.currentUser.id;
        }

        // Habilitar selects que no dependen de otros
        document.getElementById('nivelSelect').disabled = false;
        document.getElementById('asignaturaSelect').disabled = false;

        // Eventos de filtrado en el form
        document.getElementById('colegioSelect').onchange = (e) => loadDocentesByColegio(e.target.value);
        document.getElementById('nivelSelect').onchange = (e) => loadCursosByNivel(e.target.value);

        await loadDimensionesRubric();
        mostrarLoading(false);
    } catch (error) {
        mostrarLoading(false);
        showAlert('Error', 'No se pudo cargar el formulario: ' + error.message, 'error');
    }
}

function populateSelect(id, items, placeholder) {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = `<option value="">${placeholder}</option>`;
    items.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.id;
        opt.textContent = item.nombre || (item.nivel?.nombre + ' ' + item.letra);
        select.appendChild(opt);
    });
}

async function loadDocentesByColegio(colegioId) {
    const select = document.getElementById('docenteSelect');
    if (!select) return;
    if (!colegioId) {
        select.innerHTML = '<option value="">Primero seleccione un colegio</option>';
        select.disabled = true;
        return;
    }

    try {
        select.disabled = false;
        select.innerHTML = '<option value="">Cargando docentes...</option>';
        const docentes = await api.docentes.getAll(colegioId);
        select.innerHTML = '<option value="">Seleccione Docente...</option>';
        const filtrados = docentes.filter(d => d.colegio_id === parseInt(colegioId));
        filtrados.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.id;
            opt.textContent = `${d.nombre} (${d.rut})`;
            select.appendChild(opt);
        });
    } catch (error) {
        console.error('Error cargando docentes:', error);
    }
}

async function loadCursosByNivel(nivelId) {
    const select = document.getElementById('cursoSelect');
    if (!select) return;
    if (!nivelId) {
        select.innerHTML = '<option value="">Primero seleccione un nivel</option>';
        select.disabled = true;
        return;
    }

    try {
        select.disabled = false;
        select.innerHTML = '<option value="">Cargando cursos...</option>';
        const cursos = await api.cursos.getAll();
        select.innerHTML = '<option value="">Seleccione Curso...</option>';
        const filtrados = cursos.filter(c => c.nivel_id === parseInt(nivelId));
        filtrados.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = `${c.nivel.nombre} ${c.letra}`;
            select.appendChild(opt);
        });
    } catch (error) {
        console.error('Error cargando cursos:', error);
    }
}

export async function loadDimensionesRubric() {
    const container = document.getElementById('rubricContainer');
    if (!container) return;
    container.innerHTML = '<div class="text-center p-4"><div class="spinner"></div><p>Cargando rúbrica...</p></div>';

    try {
        const dims = await api.dimensiones.getAll();
        setState('dimensiones', dims);
        
        let html = '';
        let totalIndicadores = 0;

        dims.forEach((dim, dimIndex) => {
            const dimNum = dimIndex + 1;
            html += `
                <div class="dimension-card">
                    <div class="dimension-header" style="background: var(--primary); color: white;">
                        <h3 style="margin: 0; font-size: 1.1em;">Dimensión ${dimNum}: ${dim.nombre}</h3>
                        <div class="dim-score">Promedio: <span id="promedioDim${dimNum}">0.00</span></div>
                    </div>
                    <div class="dimension-body">
            `;

            dim.subdimensiones.forEach(sub => {
                totalIndicadores++;
                html += `
                    <div class="indicador-row">
                        <div class="indicador-info">
                            <h4 class="indicador-title">${sub.nombre}</h4>
                            <p class="indicador-desc">${sub.descripcion || ''}</p>
                        </div>
                        <div class="indicador-selection-wrapper">
                            <div class="indicador-options">
                                <label class="radio-opt" data-value="1"><input type="radio" name="ind${sub.id}" value="1" required><span>1</span></label>
                                <label class="radio-opt" data-value="2"><input type="radio" name="ind${sub.id}" value="2" required><span>2</span></label>
                                <label class="radio-opt" data-value="3"><input type="radio" name="ind${sub.id}" value="3" required><span>3</span></label>
                                <label class="radio-opt" data-value="4"><input type="radio" name="ind${sub.id}" value="4" required><span>4</span></label>
                                <label class="radio-opt" data-value="5"><input type="radio" name="ind${sub.id}" value="5" required><span>5</span></label>
                            </div>
                            <div class="indicador-hint" id="hint-ind${sub.id}">Seleccione puntaje</div>
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

        container.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const val = e.target.value;
                const name = e.target.name;
                const hintEl = document.getElementById(`hint-${name}`);
                if (hintEl) {
                    const texts = {
                        '1': '1 - Bajo',
                        '2': '2 - En Desarrollo',
                        '3': '3 - Adecuado',
                        '4': '4 - Alto',
                        '5': '5 - Muy Alto'
                    };
                    hintEl.textContent = texts[val] || '';
                    hintEl.classList.add('active');
                }
                calcularPromedios();
            });
        });
    } catch (error) {
        console.error('Error cargando rúbrica:', error);
        container.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    }
}

export function calcularPromedios() {
    const { dimensiones } = state;
    const resultados = {};
    let totalSuma = 0;
    let totalCount = 0;

    dimensiones.forEach((dim, dimIndex) => {
        const dimNum = dimIndex + 1;
        let dimSuma = 0;
        let dimCount = 0;

        dim.subdimensiones.forEach(sub => {
            const selected = document.querySelector(`input[name="ind${sub.id}"]:checked`);
            if (selected) {
                const val = parseInt(selected.value);
                dimSuma += val;
                dimCount++;
                totalSuma += val;
                totalCount++;
            }
        });

        const dimPromedio = dimCount > 0 ? (dimSuma / dimCount) : null;
        resultados[`promedio_dim${dimNum}`] = dimPromedio;
        
        const promedioEl = document.getElementById(`promedioDim${dimNum}`);
        if (promedioEl) {
            promedioEl.textContent = dimPromedio !== null ? dimPromedio.toFixed(2) : '0.00';
        }
    });

    const promedioTotal = totalCount > 0 ? (totalSuma / totalCount) : null;
    const display = document.getElementById('promedioDisplay');
    if (display) display.textContent = promedioTotal !== null ? promedioTotal.toFixed(2) : '_____';

    const interpretacionEl = document.getElementById('interpretacionText');
    if (interpretacionEl) {
        if (promedioTotal !== null) {
            interpretacionEl.textContent = getInterpretacion(promedioTotal);
            interpretacionEl.style.fontWeight = 'bold';
        } else {
            interpretacionEl.textContent = 'Complete todos los indicadores';
            interpretacionEl.style.fontWeight = 'normal';
        }
    }

    return { promedioTotal, resultados, totalCount };
}

export async function guardarEvaluacion(e) {
    if (e) e.preventDefault();
    const { promedioTotal, resultados, totalCount } = calcularPromedios();

    if (totalCount === 0) {
        showAlert('Error', 'Debe responder al menos un indicador', 'warning');
        return;
    }

    const respuestas = [];
    document.querySelectorAll('#rubricContainer input[type="radio"]:checked').forEach(r => {
        respuestas.push({
            subdimension_id: parseInt(r.name.replace('ind', '')),
            valor: parseInt(r.value)
        });
    });

    const obsId = parseInt(document.getElementById('observadorSelect').value);
    if (isNaN(obsId)) {
        showAlert('Error', 'El campo Observador es obligatorio y debe tener un valor válido.', 'warning');
        return;
    }

    const data = {
        docente_id: parseInt(document.getElementById('docenteSelect').value),
        curso_id: parseInt(document.getElementById('cursoSelect').value),
        asignatura_id: parseInt(document.getElementById('asignaturaSelect').value),
        observador_id: obsId,
        fecha: document.getElementById('fechaObservacion').value,
        duracion: document.getElementById('duracion').value,
        func_grupo: document.querySelector('input[name="funcGrupo"]:checked')?.value || '',
        promedio: promedioTotal,
        promedio_dim1: resultados.promedio_dim1,
        promedio_dim2: resultados.promedio_dim2,
        promedio_dim3: resultados.promedio_dim3,
        promedio_dim4: resultados.promedio_dim4,
        promedio_dim5: resultados.promedio_dim5,
        orientacion: document.querySelector('input[name="orientacion"]:checked')?.value || '',
        nivel_apoyo: document.querySelector('input[name="nivelApoyo"]:checked')?.value || '',
        comentarios: document.getElementById('comentarios').value,
        respuestas,
        apoyos: Array.from(document.querySelectorAll('.tipoApoyo:checked')).map(cb => ({ apoyo: cb.value })),
        fortalezas_aspectos: [
            ...(document.getElementById('fortalezas').value.trim() ? [{ tipo: 'fortaleza', contenido: document.getElementById('fortalezas').value.trim() }] : []),
            ...(document.getElementById('aspectos').value.trim() ? [{ tipo: 'aspecto', contenido: document.getElementById('aspectos').value.trim() }] : [])
        ]
    };

    try {
        mostrarLoading(true, 'Guardando acompañamiento...');
        const evaluacion = await api.evaluaciones.create(data);
        mostrarLoading(false);
        mostrarResumen(evaluacion);
    } catch (error) {
        mostrarLoading(false);
        showAlert('Error', error.message, 'error');
    }
}

export async function verDetalle(id) {
    try {
        mostrarLoading(true, 'Cargando detalle...');
        const evaluacion = await api.evaluaciones.getById(id);
        mostrarLoading(false);
        mostrarResumen(evaluacion);
    } catch (error) {
        mostrarLoading(false);
        showAlert('Error', error.message, 'error');
    }
}

export async function deleteEvaluacion(id) {
    if (!confirm('¿Está seguro de eliminar este acompañamiento?')) return;
    try {
        await api.evaluaciones.delete(id);
        loadEvaluaciones();
    } catch (error) {
        showAlert('Error', error.message, 'error');
    }
}

export async function mostrarResumen(evaluacion) {
    // Obtener nombres reales de las dimensiones
    let dimNames = ['Dimensión 1', 'Dimensión 2', 'Dimensión 3', 'Dimensión 4', 'Dimensión 5'];
    try {
        const dimensiones = await api.dimensiones.getAll();
        if (dimensiones && dimensiones.length) {
            const sorted = [...dimensiones].sort((a, b) => (a.orden ?? a.id) - (b.orden ?? b.id));
            dimNames = sorted.map(d => d.nombre);
        }
    } catch(e) { /* usa nombres por defecto si falla */ }

    const dims = [
        { key: 'promedio_dim1', label: dimNames[0] || 'Dimensión 1' },
        { key: 'promedio_dim2', label: dimNames[1] || 'Dimensión 2' },
        { key: 'promedio_dim3', label: dimNames[2] || 'Dimensión 3' },
        { key: 'promedio_dim4', label: dimNames[3] || 'Dimensión 4' },
        { key: 'promedio_dim5', label: dimNames[4] || 'Dimensión 5' }
    ];
    const dimsHtml = dims
        .filter(d => evaluacion[d.key] != null)
        .map(d => `<tr><td><strong>${d.label}:</strong></td><td><span class="badge ${getBadgeClass(evaluacion[d.key])}">${Number(evaluacion[d.key]).toFixed(2)}</span></td></tr>`)
        .join('');

    const fortalezas = (evaluacion.fortalezas_aspectos || []).filter(f => f.tipo === 'fortaleza').map(f => f.contenido).join('; ') || '-';
    const aspectos = (evaluacion.fortalezas_aspectos || []).filter(f => f.tipo === 'aspecto').map(f => f.contenido).join('; ') || '-';

    const dimsCards = dims
        .filter(d => evaluacion[d.key] != null)
        .map(d => {
            const val = Number(evaluacion[d.key]).toFixed(2);
            const badgeClass = getBadgeClass(evaluacion[d.key]);
            return `
            <div style="display:flex; align-items:center; justify-content:space-between; padding: 14px 20px; background: #fff; border-radius: 10px; border-left: 4px solid #004080; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                <span style="font-size: 1rem; font-weight: 600; color: #2c3e50;">${d.label}</span>
                <span class="badge ${badgeClass}" style="font-size: 1.1rem; padding: 8px 20px; border-radius: 8px; font-weight: 700; min-width: 65px; text-align:center;">${val}</span>
            </div>`;
        }).join('');

    const html = `
        <!-- Header con promedio destacado -->
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 30px 35px; background: linear-gradient(135deg, #002b5e 0%, #004080 100%); border-radius: 14px; margin-bottom: 30px; color: white; box-shadow: 0 6px 20px rgba(0,43,94,0.25);">
            <div>
                <h2 style="margin: 0 0 6px; font-size: 1.9rem; font-weight: 700; letter-spacing: -0.5px;">Acompañamiento #${evaluacion.id}</h2>
                <p style="margin: 0; font-size: 1.05rem; opacity: 0.85;">📅 Fecha de observación: <strong>${evaluacion.fecha || '-'}</strong></p>
            </div>
            <div style="text-align: center; background: rgba(255,255,255,0.12); padding: 18px 30px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(5px);">
                <p style="margin: 0 0 8px; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8; font-weight: 600;">PROMEDIO GLOBAL</p>
                <span class="badge ${getBadgeClass(evaluacion.promedio)}" style="font-size: 2.4rem; padding: 12px 28px; border-radius: 12px; font-weight: 800; box-shadow: 0 4px 14px rgba(0,0,0,0.2); display: inline-block;">${evaluacion.promedio ? Number(evaluacion.promedio).toFixed(2) : '-'}</span>
                <p style="margin: 10px 0 0; font-size: 0.9rem; opacity: 0.85;">${getInterpretacion(evaluacion.promedio)}</p>
            </div>
        </div>

        <!-- Dos columnas principales: 40% / 60% -->
        <div style="display: grid; grid-template-columns: 40% 60%; gap: 24px; margin-bottom: 24px;">

            <!-- Columna izquierda: Datos del Acompañamiento -->
            <div style="background: #fff; border-radius: 14px; padding: 28px 30px; box-shadow: 0 3px 12px rgba(0,0,0,0.06); border: 1px solid #e8edf3;">
                <h3 style="margin: 0 0 20px; font-size: 1.1rem; color: #002b5e; display: flex; align-items: center; gap: 8px; padding-bottom: 14px; border-bottom: 2px solid #f0f4fa;">
                    <span style="background:#e8f0fe; padding: 6px 10px; border-radius: 8px;">📌</span> Datos del Acompañamiento
                </h3>
                <table style="width: 100%; border-collapse: collapse;">
                    ${[
                        ['Docente', evaluacion.docente?.nombre || '-'],
                        ['RUT', evaluacion.docente?.rut || '-'],
                        ['Colegio', evaluacion.docente?.colegio?.nombre || '-'],
                        ['Curso', evaluacion.curso ? (evaluacion.curso.nivel?.nombre || '') + ' ' + evaluacion.curso.letra : '-'],
                        ['Asignatura', evaluacion.asignatura?.nombre || '-'],
                        ['Observador', evaluacion.observador?.username || '-'],
                        ['Duración', evaluacion.duracion || '-'],
                        ['Func. del Grupo', evaluacion.func_grupo || '-'],
                    ].map(([label, value]) => `
                        <tr style="border-bottom: 1px solid #f4f6fa;">
                            <td style="padding: 12px 0; color: #6c757d; font-size: 0.9rem; font-weight: 600; width: 38%; white-space: nowrap;">${label}</td>
                            <td style="padding: 12px 0 12px 12px; font-size: 0.95rem; color: #2c3e50; font-weight: 500;">${value}</td>
                        </tr>
                    `).join('')}
                </table>
            </div>

            <!-- Columna derecha: Resultados por Dimensión -->
            <div style="background: #fff; border-radius: 14px; padding: 28px 30px; box-shadow: 0 3px 12px rgba(0,0,0,0.06); border: 1px solid #e8edf3;">
                <h3 style="margin: 0 0 20px; font-size: 1.1rem; color: #002b5e; display: flex; align-items: center; gap: 8px; padding-bottom: 14px; border-bottom: 2px solid #f0f4fa;">
                    <span style="background:#e8f0fe; padding: 6px 10px; border-radius: 8px;">📊</span> Resultados por Dimensión
                </h3>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${dimsCards || '<p style="color: #6c757d; text-align:center; padding: 20px;">Sin datos de dimensiones</p>'}
                </div>
                <div style="margin-top: 20px; padding: 20px; background: linear-gradient(135deg, #004080 0%, #002b5e 100%); border-radius: 12px; border: none; box-shadow: inset 0 2px 10px rgba(0,0,0,0.15); color: white;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 0.95rem;">
                        <div style="border-left: 2px solid rgba(255,255,255,0.3); padding-left: 14px;">
                            <strong style="color: rgba(255,255,255,0.7); text-transform: uppercase; font-size: 0.75rem; letter-spacing: 1px; display: block; margin-bottom: 4px;">Orientación</strong>
                            <span style="color: #fff; font-weight: 600; font-size: 1rem;">${evaluacion.orientacion || '-'}</span>
                        </div>
                        <div style="border-left: 2px solid rgba(255,255,255,0.3); padding-left: 14px;">
                            <strong style="color: rgba(255,255,255,0.7); text-transform: uppercase; font-size: 0.75rem; letter-spacing: 1px; display: block; margin-bottom: 4px;">Nivel de Apoyo</strong>
                            <span style="color: #fff; font-weight: 600; font-size: 1rem;">${evaluacion.nivel_apoyo || '-'}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Sección Observaciones -->
        <div class="pdf-page-break" style="background: #fff; border-radius: 14px; padding: 28px 30px; box-shadow: 0 3px 12px rgba(0,0,0,0.06); border: 1px solid #e8edf3;">
            <h3 style="margin: 0 0 20px; font-size: 1.1rem; color: #002b5e; display: flex; align-items: center; gap: 8px; padding-bottom: 14px; border-bottom: 2px solid #f0f4fa;">
                <span style="background:#e8f0fe; padding: 6px 10px; border-radius: 8px;">📝</span> Observaciones Complementarias
            </h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 20px;">
                <div style="background: #f0faf0; padding: 20px; border-radius: 10px; border-left: 4px solid #28a745;">
                    <h4 style="margin: 0 0 10px; color: #1e7e34; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.5px;">✅ Fortalezas</h4>
                    <p style="margin: 0; font-size: 0.95rem; color: #2c4a2c; line-height: 1.7;">${fortalezas}</p>
                </div>
                <div style="background: #fff8f8; padding: 20px; border-radius: 10px; border-left: 4px solid #dc3545;">
                    <h4 style="margin: 0 0 10px; color: #c0392b; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.5px;">⚡ Aspectos a Fortalecer</h4>
                    <p style="margin: 0; font-size: 0.95rem; color: #4a2c2c; line-height: 1.7;">${aspectos}</p>
                </div>
            </div>
            <div style="background: #f8f9fc; padding: 20px; border-radius: 10px; border: 1px solid #e0e6ef;">
                <h4 style="margin: 0 0 10px; color: #495057; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.5px;">💬 Comentarios Generales</h4>
                <p style="margin: 0; font-size: 0.98rem; color: #444; line-height: 1.7; font-style: ${evaluacion.comentarios ? 'normal' : 'italic'};">${evaluacion.comentarios || 'Sin comentarios registrados'}</p>
            </div>
        </div>
    `;

    const container = document.getElementById('resumenPageContent');
    if (container) {
        container.innerHTML = html;
        // Navegar a la página completa en lugar de usar el modal
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const pageEl = document.getElementById('pageResumenEvaluacion');
        if (pageEl) pageEl.classList.add('active');
    }
}

export function imprimirResumen() {
    window.print();
}

export function crearNuevaEvaluacion() {
    initEvaluacionForm();
    window.app.navigateTo('nueva-evaluacion');
}

export function previsualizarPDF() {
    // Detectar qué página estamos exportando: el resumen o el formulario nuevo
    const pageResumen = document.getElementById('pageResumenEvaluacion');
    const pageForm = document.getElementById('pageNuevaEvaluacion');
    
    let targetEl = pageForm;
    if (pageResumen && pageResumen.classList.contains('active')) {
        targetEl = document.getElementById('resumenPageContent');
    }

    if (!targetEl) return;

    // Solo para el formulario necesitamos datos del select para el nombre del archivo
    let filename = `Acompanamiento_${new Date().getTime()}.pdf`;
    if (targetEl === pageForm) {
        const docenteSel = document.getElementById('docenteSelect');
        const docenteText = docenteSel.options[docenteSel.selectedIndex]?.text || '';
        const docenteName = docenteText.split(' (')[0] || 'Docente';
        filename = `Formulario_Acompanamiento_${docenteName.replace(/\s+/g, '_')}.pdf`;
    } else {
        // Si es el resumen, buscamos el ID en el header
        const headerH2 = targetEl.parentElement.querySelector('h2');
        if (headerH2) {
            filename = `Resumen_Acompanamiento_${headerH2.textContent.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        }
    }

    targetEl.classList.add('exporting-pdf');

    const opt = {
        margin: [10, 10, 10, 10],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: 'css', avoid: '.form-section' }
    };

    mostrarLoading(true, 'Generando vista previa...');

    html2pdf().set(opt).from(targetEl).output('bloburl').then(function (pdfUrl) {
        targetEl.classList.remove('exporting-pdf');
        mostrarLoading(false);
        setState('_pdfBlobUrl', pdfUrl);
        document.getElementById('pdfPreviewFrame').src = pdfUrl;
        document.getElementById('pdfPreviewOverlay').classList.add('active');
    }).catch(err => {
        console.error(err);
        targetEl.classList.remove('exporting-pdf');
        mostrarLoading(false);
        showAlert('Error', 'Error al generar PDF: ' + err.message, 'error');
    });
}

export function cerrarPreviewPDF() {
    document.getElementById('pdfPreviewOverlay').classList.remove('active');
    document.getElementById('pdfPreviewFrame').src = '';
    setState('_pdfBlobUrl', null);
}

export function descargarFormularioPDF() {
    const formEl = document.getElementById('evaluacionForm');
    if (!formEl) return;

    // Preparar el estilo temporal para el PDF
    formEl.classList.add('exporting-pdf');

    // Ajustar bordes y visibilidad para una impresión limpia
    const inputs = formEl.querySelectorAll('input, select, textarea');
    inputs.forEach(el => el.style.border = 'none');

    const docenteSel = document.getElementById('docenteSelect');
    const docenteText = docenteSel.options[docenteSel.selectedIndex]?.text || '';
    const docenteName = docenteText.split(' (')[0] || 'Docente';
    const filename = `Acompanamiento_${docenteName.replace(/\s+/g, '_')}.pdf`;

    const opt = {
        margin: [8, 12, 10, 12], // Márgenes equilibrados para hoja carta (top, right, bottom, left)
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            scrollY: 0
        },
        jsPDF: {
            unit: 'mm',
            format: 'letter', // Hoja carta (8.5 x 11 pulgadas)
            orientation: 'portrait'
        },
        pagebreak: {
            mode: 'css',
            before: '.agrupacion-final',
            avoid: ['.form-section:not(.agrupacion-final)', '.dimension-card']
        }
    };

    mostrarLoading(true, 'Generando PDF...');
    html2pdf().set(opt).from(formEl).save().then(() => {
        formEl.classList.remove('exporting-pdf');
        inputs.forEach(el => el.style.border = '');
        mostrarLoading(false);
    }).catch(err => {
        console.error(err);
        formEl.classList.remove('exporting-pdf');
        inputs.forEach(el => el.style.border = '');
        mostrarLoading(false);
        showAlert('Error', 'Error al generar PDF: ' + err.message, 'error');
    });
}

export function descargarPDF() {
    const url = state._pdfBlobUrl;
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `Acompanamiento_${new Date().getTime()}.pdf`;
    a.click();
}

export function closeResumen() {
    const el = document.getElementById('resumenEvaluacion');
    if (el) el.classList.remove('active');
}
